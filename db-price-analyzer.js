#!/usr/bin/env node

// Suppress Node.js warnings
process.removeAllListeners('warning');
process.on('warning', () => {});

import inquirer from 'inquirer';
import { createClient } from 'db-vendo-client';
import { profile as dbnavProfile } from 'db-vendo-client/p/dbnav/index.js';
import { loadConfig, saveConfig, getConfigPath } from './src/config.js';
import { 
    saveCurrentSearch, 
    validateSearchName,
    searchNameExists
} from './src/search-management.js';
import { parseCliArgs, showHelp, showVersion, validateCliArgs, cliToConfig } from './src/cli-args.js';
import { 
    setupGlobalErrorHandling, 
    setupGracefulShutdown, 
    formatError, 
    withRetry, 
    withTimeout, 
    withProgress,
    validateSearchParams,
    ValidationError,
    NetworkError,
    SearchError
} from './src/error-handler.js';
import { getUserInput } from './src/user-interface.js';
import { handleCliMode, lookupStation } from './src/cli-handler.js';
import { outputResults } from './src/results-display.js';
import { 
    searchSameDayTrips, 
    searchOneWayTrips, 
    searchMultiDayTrips, 
    searchFlexibleDurationTrips,
    TRIP_TYPES
} from './src/journey-search.js';
import { formatStationDisplay } from './src/station-selector.js';

// Global configuration
let config = loadConfig();
let quietMode = false;
let verboseMode = false;
let isNestedSearch = false; // Flag to silence nested searches

// Initialize the client
const client = createClient(dbnavProfile, 'db-price-analyzer');

// Main function
async function main() {
    // Setup error handling
    setupGlobalErrorHandling(verboseMode);
    setupGracefulShutdown();
    
    try {
        // Parse command-line arguments
        const { options: cliOptions, success, error } = parseCliArgs();
        
        if (!success) {
            throw new ValidationError(error);
        }
        
        // Handle help and version
        if (cliOptions.help) {
            showHelp();
            return;
        }
        
        if (cliOptions.version) {
            showVersion();
            return;
        }
        
        // Validate CLI arguments
        const validationErrors = validateCliArgs(cliOptions);
        if (validationErrors.length > 0) {
            throw new ValidationError(`Command line validation failed:\n  - ${validationErrors.join('\n  - ')}`);
        }
        
        // Update configuration from CLI options
        config = cliToConfig(cliOptions, config);
        quietMode = config.preferences.quietMode || false;
        verboseMode = config.preferences.verboseMode || false;
        
        // Determine if running in CLI mode or interactive mode
        const isCliMode = cliOptions.route || (cliOptions.from && cliOptions.to) || 
                         cliOptions['list-routes'] || cliOptions['list-favorites'] ||
                         cliOptions['list-searches'] || cliOptions['delete-search'] || cliOptions['load-search'];
        
        let searchParams;
        
        if (isCliMode) {
            searchParams = await handleCliMode(client, cliOptions, config);
            if (!searchParams) {
                // Handled informational command
                process.exit(0);
                return;
            }
        } else {
            // Interactive mode
            if (!quietMode) {
                console.log('\n🎯 DB Price Hunter v1.4.0\n');
            }
            searchParams = await getUserInput(client);
        }
        
        // Validate search parameters
        validateSearchParams(searchParams);
        
        // Extract station IDs
        const departureStationId = searchParams.departureStation.id;
        const destinationStationId = searchParams.destinationStation.id;
        const returnDepartureStationId = searchParams.returnDepartureStation?.id;
        
        // Prepare time preferences
        const timePreferences = searchParams.timePreferences;
        
        // Perform search with enhanced error handling and progress indication
        const searchOperation = async () => {
            switch (searchParams.tripType) {
                case TRIP_TYPES.SAME_DAY:
                    return await withTimeout(
                        withRetry(() => searchSameDayTrips(
                            client,
                            config,
                            departureStationId, 
                            destinationStationId, 
                            searchParams.startDate, 
                            searchParams.endDate,
                            timePreferences,
                            returnDepartureStationId,
                            false,
                            isNestedSearch
                        ), config.preferences.retryAttempts, 1000, 'Same-day trip search'),
                        config.preferences.searchTimeout,
                        'Same-day trip search'
                    );
                    
                case TRIP_TYPES.ONE_WAY:
                    return await withTimeout(
                        withRetry(() => searchOneWayTrips(
                            client,
                            config,
                            departureStationId, 
                            destinationStationId, 
                            searchParams.startDate, 
                            searchParams.endDate,
                            timePreferences?.outbound,
                            false,
                            isNestedSearch
                        ), config.preferences.retryAttempts, 1000, 'One-way trip search'),
                        config.preferences.searchTimeout,
                        'One-way trip search'
                    );
                    
                case TRIP_TYPES.MULTI_DAY:
                    if (searchParams.flexibleDuration) {
                        // Flexible duration search (N days stay)
                        return await withTimeout(
                            withRetry(() => searchFlexibleDurationTrips(
                                client,
                                config,
                                departureStationId, 
                                destinationStationId, 
                                searchParams.startDate, 
                                searchParams.endDate,
                                searchParams.numberOfDays,
                                timePreferences,
                                returnDepartureStationId,
                                false,
                                isNestedSearch
                            ), config.preferences.retryAttempts, 1000, `${searchParams.numberOfDays}-night trip search`),
                            config.preferences.searchTimeout,
                            `${searchParams.numberOfDays}-night trip search`
                        );
                    } else {
                        // Fixed return date search
                        return await withTimeout(
                            withRetry(() => searchMultiDayTrips(
                                client,
                                config,
                                departureStationId, 
                                destinationStationId, 
                                searchParams.startDate, 
                                searchParams.endDate,
                                searchParams.returnDate,
                                timePreferences,
                                returnDepartureStationId,
                                isNestedSearch
                            ), config.preferences.retryAttempts, 1000, 'Multi-day trip search'),
                            config.preferences.searchTimeout,
                            'Multi-day trip search'
                        );
                    }
            }
        };
        
        const results = await withProgress(
            searchOperation,
            'Searching for train connections',
            !quietMode,
            config.preferences.useTrainAnimations
        );
        
        // Output results
        const outputFormat = cliOptions.output || config.preferences.outputFormat;
        
        outputResults(
            results,
            searchParams.tripType,
            formatStationDisplay(searchParams.departureStation),
            formatStationDisplay(searchParams.destinationStation),
            searchParams.returnDepartureStation ? formatStationDisplay(searchParams.returnDepartureStation) : null,
            outputFormat,
            cliOptions['output-file'],
            timePreferences
        );
        
        // Handle search saving
        if (cliOptions['save-search']) {
            const searchName = cliOptions['save-search'];
            const validationError = validateSearchName(searchName);
            
            if (validationError) {
                console.error(`❌ Invalid search name: ${validationError}`);
                process.exit(1);
            }
            
            if (searchNameExists(searchName)) {
                console.warn(`⚠️  Search "${searchName}" already exists and will be overwritten.`);
            }
            
            // Save the search parameters (excluding results)
            saveCurrentSearch(searchName, searchParams);
        }
        
        // Interactive mode: offer to save search if results were found
        if (!isCliMode && results && results.length > 0 && !quietMode) {
            try {
                const saveAnswer = await inquirer.prompt([{
                    type: 'confirm',
                    name: 'saveSearch',
                    message: '💾 Would you like to save this search for later reuse?',
                    default: false
                }]);
                
                if (saveAnswer.saveSearch) {
                    const nameAnswer = await inquirer.prompt([{
                        type: 'input',
                        name: 'searchName',
                        message: 'Enter a name for this search:',
                        validate: (input) => {
                            const validationError = validateSearchName(input);
                            if (validationError) {
                                return validationError;
                            }
                            return true;
                        }
                    }]);
                    
                    const searchName = nameAnswer.searchName.trim();
                    
                    if (searchNameExists(searchName)) {
                        const overwriteAnswer = await inquirer.prompt([{
                            type: 'confirm',
                            name: 'overwrite',
                            message: `Search "${searchName}" already exists. Overwrite it?`,
                            default: false
                        }]);
                        
                        if (!overwriteAnswer.overwrite) {
                            console.log('Search not saved.');
                        } else {
                            saveCurrentSearch(searchName, searchParams);
                        }
                    } else {
                        saveCurrentSearch(searchName, searchParams);
                    }
                }
            } catch (saveError) {
                // Don't crash the app if saving fails
                console.warn('⚠️  Could not prompt to save search:', saveError.message);
            }
        }
        
        // Save configuration if it was modified
        if (cliOptions['add-favorite'] || cliOptions['remove-favorite']) {
            saveConfig(config);
        }
        
        // Exit successfully
        process.exit(0);
        
    } catch (error) {
        // Enhanced error handling
        if (error.name === 'ValidationError' || error.name === 'ConfigurationError') {
            console.error('\n' + formatError(error, verboseMode));
            if (!verboseMode) {
                console.error('\nUse --verbose for more details or --help for usage information.');
            }
            process.exit(1);
        } else if (error.name === 'NetworkError') {
            console.error('\n' + formatError(error, verboseMode));
            console.error('\nTip: Check your internet connection and try again.');
            process.exit(2);
        } else if (error.name === 'SearchError') {
            console.error('\n' + formatError(error, verboseMode));
            console.error('\nTip: Try different dates or stations.');
            process.exit(3);
        } else {
            console.error('\n' + formatError(error, verboseMode));
            console.error('\nThis appears to be an unexpected error. Please report it.');
            console.error(`Configuration file: ${getConfigPath()}`);
            process.exit(4);
        }
    }
}

// Debug function to show all trains for a route on a specific date
async function debugTrainsForRoute(fromStation, toStation, date) {
    console.log(`\n🔍 DEBUG: All trains from ${fromStation} to ${toStation} on ${date}`);
    console.log('='.repeat(80));
    
    try {
        // Search multiple times throughout the day
        const allJourneys = [];
        
        // Morning search (00:00-12:00)
        const morningSearch = new Date(date);
        morningSearch.setHours(0, 0, 0, 0);
        
        // Evening search (12:00-23:59)
        const eveningSearch = new Date(date);
        eveningSearch.setHours(12, 0, 0, 0);
        
        // Search morning departures
        console.log('🌅 Searching morning departures (00:00-12:00)...');
        const morningResult = await client.journeys(fromStation, toStation, {
            results: 25,
            departure: morningSearch,
            transfers: 3,
            stopovers: false,
            tickets: true
        });
        
        // Search evening departures  
        console.log('🌆 Searching evening departures (12:00-23:59)...');
        const eveningResult = await client.journeys(fromStation, toStation, {
            results: 25,
            departure: eveningSearch,
            transfers: 3,
            stopovers: false,
            tickets: true
        });
        
        // Combine all journeys
        allJourneys.push(...morningResult.journeys);
        allJourneys.push(...eveningResult.journeys);
        
        // Remove duplicates and sort by departure time
        const uniqueJourneys = allJourneys.filter((journey, index, self) => {
            const firstLeg = journey.legs[0];
            const depTime = firstLeg.plannedDeparture || firstLeg.departure;
            return index === self.findIndex(j => {
                const jFirstLeg = j.legs[0];
                const jDepTime = jFirstLeg.plannedDeparture || jFirstLeg.departure;
                return depTime === jDepTime;
            });
        }).sort((a, b) => {
            const aTime = new Date(a.legs[0].plannedDeparture || a.legs[0].departure);
            const bTime = new Date(b.legs[0].plannedDeparture || b.legs[0].departure);
            return aTime - bTime;
        });
        
        console.log(`📊 Total unique journeys found: ${uniqueJourneys.length}`);
        console.log(`   Morning results: ${morningResult.journeys.length}, Evening results: ${eveningResult.journeys.length}`);
        
        uniqueJourneys.forEach((journey, i) => {
            const firstLeg = journey.legs[0];
            const lastLeg = journey.legs[journey.legs.length - 1];
            
            const depTime = new Date(firstLeg.plannedDeparture || firstLeg.departure);
            const arrTime = new Date(lastLeg.plannedArrival || lastLeg.arrival);
            
            const depTimeStr = depTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
            const arrTimeStr = arrTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
            
            const price = journey.price ? `€${journey.price.amount}` : 'No price';
            const duration = Math.round((arrTime - depTime) / (1000 * 60)); // minutes
            
            // Count transfers (transportation legs - 1)
            const transportationLegs = journey.legs.filter(leg => leg.line);
            const transfers = Math.max(0, transportationLegs.length - 1);
            const transferStr = transfers === 0 ? 'direct' : `${transfers} transfer${transfers > 1 ? 's' : ''}`;
            
            // Show route if there are transfers
            let routeInfo = '';
            if (transfers > 0) {
                const stations = [firstLeg.origin.name];
                journey.legs.forEach(leg => {
                    if (leg.line && leg.destination) {
                        stations.push(leg.destination.name);
                    }
                });
                routeInfo = ` via ${stations.slice(1, -1).join(', ')}`;
            }
            
            console.log(`${(i + 1).toString().padStart(2, ' ')}. ${depTimeStr} → ${arrTimeStr} (${Math.floor(duration/60)}h ${duration%60}m, ${transferStr}) - ${price}${routeInfo}`);
        });
        
    } catch (error) {
        console.error(`❌ Error fetching trains: ${error.message}`);
    }
}

// Add debug command
if (process.argv.includes('--debug-trains')) {
    const fromIndex = process.argv.indexOf('--debug-from');
    const toIndex = process.argv.indexOf('--debug-to');
    const dateIndex = process.argv.indexOf('--debug-date');
    
    if (fromIndex > -1 && toIndex > -1 && dateIndex > -1) {
        const fromStation = process.argv[fromIndex + 1];
        const toStation = process.argv[toIndex + 1];
        const date = process.argv[dateIndex + 1];
        
        (async () => {
            const from = await lookupStation(client, fromStation);
            const to = await lookupStation(client, toStation);
            await debugTrainsForRoute(from.id, to.id, date);
            process.exit(0);
        })();
    } else {
        console.log('Usage: --debug-trains --debug-from "Station" --debug-to "Station" --debug-date "YYYY-MM-DD"');
        process.exit(1);
    }
} else if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}