// CLI handler - command line interface and argument processing

import { loadConfig, getCommonRoute, listCommonRoutes } from './config.js';
import { 
    displaySavedSearches, 
    deleteSavedSearchByName, 
    loadSavedSearch, 
    convertSavedSearchToParams 
} from './search-management.js';
import { getPopularCities, searchStations } from './cities.js';
import { parseFlexibleDate } from './journey-utils.js';
import { getTimePreferenceFromCli } from './cli-args.js';
import { ValidationError } from './error-handler.js';

// Handle command-line mode
export async function handleCliMode(client, cliOptions, config) {
    // Handle informational commands
    if (cliOptions['list-routes']) {
        const routes = listCommonRoutes(config);
        console.log('\n🗺️  Available Routes:');
        routes.forEach(route => {
            console.log(`  ${route.name}: ${route.departure.name} → ${route.destination.name}`);
        });
        return;
    }
    
    if (cliOptions['list-favorites']) {
        console.log('\n⭐ Favorite Stations:');
        if (config.favoriteStations.length === 0) {
            console.log('  No favorite stations saved.');
        } else {
            config.favoriteStations.forEach(station => {
                console.log(`  ${station.name} (${station.id})`);
            });
        }
        return;
    }
    
    // Handle saved search commands
    if (cliOptions['list-searches']) {
        displaySavedSearches();
        return;
    }
    
    if (cliOptions['delete-search']) {
        deleteSavedSearchByName(cliOptions['delete-search']);
        return;
    }
    
    if (cliOptions['load-search']) {
        const savedSearch = loadSavedSearch(cliOptions['load-search']);
        if (!savedSearch) {
            return;
        }
        
        // Convert saved search to search parameters
        const searchParams = convertSavedSearchToParams(savedSearch);
        
        // Override with any CLI options that were also provided
        if (cliOptions.output) {
            searchParams.outputFormat = cliOptions.output;
        }
        if (cliOptions['max-results']) {
            searchParams.maxResults = parseInt(cliOptions['max-results']);
        }
        
        return searchParams;
    }
    
    // Build search parameters from CLI options
    const searchParams = {};
    
    // Handle route selection
    if (cliOptions.route) {
        const route = getCommonRoute(config, cliOptions.route);
        if (!route) {
            throw new ValidationError(`Unknown route: ${cliOptions.route}. Use --list-routes to see available routes.`);
        }
        searchParams.departureStation = route.departure;
        searchParams.destinationStation = route.destination;
    } else if (cliOptions.from && cliOptions.to) {
        // Direct station lookup
        searchParams.departureStation = await lookupStation(client, cliOptions.from);
        searchParams.destinationStation = await lookupStation(client, cliOptions.to);
    } else {
        throw new ValidationError('Either --route or both --from and --to must be specified.');
    }
    
    // Handle dates
    if (!cliOptions.date) {
        throw new ValidationError('--date is required for CLI mode.');
    }
    
    // Parse dates with flexible year handling
    const startDate = parseFlexibleDate(cliOptions.date);
    const endDate = parseFlexibleDate(cliOptions['end-date'] || cliOptions.date);
    
    searchParams.startDate = startDate.toISOString().split('T')[0];
    searchParams.endDate = endDate.toISOString().split('T')[0];
    searchParams.tripType = cliOptions['trip-type'] || config.preferences.defaultTripType;
    
    // Handle multi-day trip options
    if (searchParams.tripType === 'multi-day') {
        if (cliOptions.days) {
            // Flexible duration mode
            const days = parseInt(cliOptions.days);
            if (isNaN(days) || days < 1 || days > 365) {
                throw new ValidationError('--days must be a number between 1 and 365');
            }
            searchParams.numberOfDays = days;
            searchParams.flexibleDuration = true;
        } else if (cliOptions['return-date']) {
            // Fixed return date mode
            searchParams.returnDate = cliOptions['return-date'];
        } else {
            throw new ValidationError('Multi-day trips require either --return-date or --days');
        }
    }
    
    // Handle return departure station
    if (cliOptions['return-from']) {
        searchParams.returnDepartureStation = await lookupStation(client, cliOptions['return-from']);
    }
    
    // Handle time preferences
    const timePrefs = getTimePreferenceFromCli(cliOptions);
    if (timePrefs) {
        if (timePrefs.outbound && timePrefs.return) {
            // Multi-day with separate outbound/return preferences
            searchParams.timePreferences = timePrefs;
        } else {
            // Single preference for both directions
            searchParams.timePreferences = {
                outbound: timePrefs,
                return: timePrefs
            };
        }
    }
    
    return searchParams;
}

// Station lookup function for CLI
export async function lookupStation(client, query) {
    console.log(`🔍 Looking up station: ${query}`);
    
    // First check if it's a popular city
    const popularCities = getPopularCities();
    const matchingCity = popularCities.find(city => 
        city.name.toLowerCase() === query.toLowerCase() || 
        city.stationName.toLowerCase() === query.toLowerCase()
    );
    
    if (matchingCity) {
        console.log(`✅ Found popular city: ${matchingCity.stationName}`);
        return {
            id: matchingCity.id,
            name: matchingCity.stationName,
            isPopular: true
        };
    }
    
    // Search for stations
    const searchResults = await searchStations(client, query);
    
    if (searchResults.length === 0) {
        throw new ValidationError(`No stations found for "${query}"`);
    }
    
    if (searchResults.length === 1) {
        const station = searchResults[0];
        console.log(`✅ Found: ${station.name} (${station.id})`);
        return station;
    }
    
    // Multiple results - use the first one (most relevant)
    const station = searchResults[0];
    console.log(`✅ Found ${searchResults.length} stations, using: ${station.name} (${station.id})`);
    return station;
}