#!/usr/bin/env node

// Suppress Node.js warnings
process.removeAllListeners('warning');
process.on('warning', () => {});

import inquirer from 'inquirer';
import { createClient } from 'db-vendo-client';
import { profile as dbnavProfile } from 'db-vendo-client/p/dbnav/index.js';
import { cities, getCityNames, getStationId, getStationName, searchStations, getPopularCities } from './src/cities.js';
import { selectCityStation, formatStationDisplay, validateStation } from './src/station-selector.js';
import { askForTimePreferences, selectTimePreferences, displayTimePreferences } from './src/time-selector.js';
import { filterJourneysByTime, getTimePreferenceDisplayName } from './src/time-preferences.js';
import { loadConfig, saveConfig, getCommonRoute, listCommonRoutes, addFavoriteStation, getConfigPath } from './src/config.js';
import { 
    saveCurrentSearch, 
    loadSavedSearch, 
    displaySavedSearches, 
    deleteSavedSearchByName, 
    validateSearchName,
    searchNameExists,
    convertSavedSearchToParams 
} from './src/search-management.js';
import { parseCliArgs, showHelp, showVersion, validateCliArgs, cliToConfig, getTimePreferenceFromCli } from './src/cli-args.js';
import { formatAsTable, formatAsJson, formatAsCsv, saveToFile, ProgressIndicator, DateProgressIndicator } from './src/output-formatters.js';
import { 
    setupGlobalErrorHandling, 
    setupGracefulShutdown, 
    formatError, 
    withRetry, 
    withTimeout, 
    withProgress,
    withDateRetry,
    withProgressiveSearch,
    handleApiError,
    validateSearchParams,
    ValidationError,
    NetworkError,
    SearchError
} from './src/error-handler.js';

// Global configuration
let config = loadConfig();
let quietMode = false;
let verboseMode = false;
let isNestedSearch = false; // Flag to silence nested searches

// Initialize the client
const client = createClient(dbnavProfile, 'db-price-analyzer');

// Base search configuration
const searchConfig = {
    results: 10,
    stopovers: false,
    transfers: -1,
    tickets: true,
    polylines: false,
    subStops: false,
    entrances: false,
    remarks: true,
    walkingSpeed: 'normal',
    startWithWalking: true,
    language: 'en'
};

// Trip type definitions
const TRIP_TYPES = {
    SAME_DAY: 'same-day',
    MULTI_DAY: 'multi-day',
    ONE_WAY: 'one-way'
};

// Format date for display
function formatDate(date) {
    return new Intl.DateTimeFormat('en-US', { 
        weekday: 'short', 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    }).format(date);
}

// Format time for display
function formatTime(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

// Parse date with flexible year handling
function parseFlexibleDate(input) {
    const trimmed = input.trim();
    
    // Check if it's in MM-DD format (missing year)
    if (/^\d{1,2}-\d{1,2}$/.test(trimmed)) {
        const currentYear = new Date().getFullYear();
        return new Date(`${currentYear}-${trimmed}`);
    }
    
    // Check if it's in YYYY-MM-DD format
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(trimmed)) {
        return new Date(trimmed);
    }
    
    // Try parsing as-is for other formats
    return new Date(trimmed);
}

// Validate date input with flexible year handling
function validateDate(input) {
    if (!input || input.trim().length === 0) {
        return 'Please enter a date';
    }
    
    const date = parseFlexibleDate(input);
    if (isNaN(date.getTime())) {
        return 'Please enter a valid date (YYYY-MM-DD or MM-DD for current year)';
    }
    
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Reset time to start of day for comparison
    date.setHours(0, 0, 0, 0); // Reset input date time as well
    
    if (date <= now) { // Use <= to reject today as well
        return 'Date must be in the future';
    }
    
    return true;
}

// Get user input
async function getUserInput() {
    console.log('\n🎯 DB Price Hunter\n');
    
    // First get trip type
    const tripTypeAnswer = await inquirer.prompt([{
        type: 'list',
        name: 'tripType',
        message: 'Select trip type:',
        choices: [
            { name: 'Same-day return trip', value: TRIP_TYPES.SAME_DAY },
            { name: 'Multi-day trip (different dates)', value: TRIP_TYPES.MULTI_DAY },
            { name: 'One-way trip', value: TRIP_TYPES.ONE_WAY }
        ]
    }]);

    // Select departure station
    console.log('\n📍 Step 1: Choose departure station');
    const departureStation = await selectCityStation(client, 'Select departure station:');
    
    if (!departureStation) {
        console.log('❌ No departure station selected. Exiting...');
        process.exit(1);
    }

    console.log(`✅ Departure: ${formatStationDisplay(departureStation)}`);

    // Select destination station
    console.log('\n📍 Step 2: Choose destination station');
    let destinationStation;
    
    do {
        destinationStation = await selectCityStation(client, 'Select destination station:');
        
        if (!destinationStation) {
            console.log('❌ No destination station selected. Exiting...');
            process.exit(1);
        }

        // Check if destination is same as departure
        if (destinationStation.id === departureStation.id) {
            console.log('❌ Destination cannot be the same as departure. Please choose a different station.');
            destinationStation = null;
        }
    } while (!destinationStation);

    console.log(`✅ Destination: ${formatStationDisplay(destinationStation)}`);

    // For round trips, ask about return departure location
    let returnDepartureStation = null;
    if (tripTypeAnswer.tripType === TRIP_TYPES.SAME_DAY || tripTypeAnswer.tripType === TRIP_TYPES.MULTI_DAY) {
        console.log('\n🔄 Step 3: Choose return departure location');
        
        const returnLocationAnswer = await inquirer.prompt([{
            type: 'list',
            name: 'returnFromSameCity',
            message: 'Return from same city or different city?',
            choices: [
                { name: `Same city (${formatStationDisplay(destinationStation)})`, value: true },
                { name: 'Different city', value: false }
            ],
            default: true
        }]);
        
        if (returnLocationAnswer.returnFromSameCity) {
            returnDepartureStation = destinationStation;
            console.log(`✅ Return departure: ${formatStationDisplay(returnDepartureStation)}`);
        } else {
            console.log('\n📍 Select return departure station');
            
            do {
                returnDepartureStation = await selectCityStation(client, 'Select return departure station:');
                
                if (!returnDepartureStation) {
                    console.log('❌ No return departure station selected. Exiting...');
                    process.exit(1);
                }
                
                // Check if return departure is same as original departure
                if (returnDepartureStation.id === departureStation.id) {
                    console.log('❌ Return departure cannot be the same as original departure for different city option. Please choose a different station.');
                    returnDepartureStation = null;
                }
            } while (!returnDepartureStation);
            
            console.log(`✅ Return departure: ${formatStationDisplay(returnDepartureStation)}`);
        }
    }

    // Get date information
    console.log('\n📅 Step 4: Choose dates');
    
    // First get start date
    const startDateAnswer = await inquirer.prompt([{
        type: 'input',
        name: 'startDate',
        message: 'Enter start date (YYYY-MM-DD or MM-DD for current year):',
        validate: validateDate,
        default: () => {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
            const day = String(tomorrow.getDate()).padStart(2, '0');
            return `${month}-${day}`;
        }
    }]);
    
    // Then get end date with access to start date
    const endDateAnswer = await inquirer.prompt([{
        type: 'input',
        name: 'endDate',
        message: 'Enter end date (YYYY-MM-DD or MM-DD for current year):',
        validate: (input) => {
            const validation = validateDate(input);
            if (validation !== true) return validation;
            
            const startDate = parseFlexibleDate(startDateAnswer.startDate);
            const endDate = parseFlexibleDate(input);
            if (endDate < startDate) {
                return 'End date must be after start date';
            }
            
            const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
            if (daysDiff > 365) {
                return 'Date range cannot exceed 365 days';
            }
            
            return true;
        },
        default: startDateAnswer.startDate
    }]);
    
    // Convert flexible dates to ISO format for consistency
    const startDate = parseFlexibleDate(startDateAnswer.startDate);
    const endDate = parseFlexibleDate(endDateAnswer.endDate);
    
    const dateAnswers = {
        startDate: startDate.toISOString().split('T')[0], // Convert to YYYY-MM-DD format
        endDate: endDate.toISOString().split('T')[0]
    };

    const answers = {
        ...tripTypeAnswer,
        departureStation,
        destinationStation,
        returnDepartureStation,
        ...dateAnswers
    };
    
    // Add multi-day specific questions
    if (answers.tripType === TRIP_TYPES.MULTI_DAY) {
        // Ask how they want to specify the return
        const returnTypeAnswer = await inquirer.prompt([
            {
                type: 'list',
                name: 'returnType',
                message: 'How would you like to specify your return?',
                choices: [
                    { name: 'Specific return date', value: 'date' },
                    { name: 'Number of days to stay', value: 'days' }
                ]
            }
        ]);
        
        let returnDate;
        
        if (returnTypeAnswer.returnType === 'date') {
            // Ask for specific return date
            const multiDayAnswers = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'returnDate',
                    message: 'Enter return date (YYYY-MM-DD or MM-DD for current year):',
                    validate: (input) => {
                        const validation = validateDate(input);
                        if (validation !== true) return validation;
                        
                        const outDate = new Date(answers.startDate);
                        const retDate = parseFlexibleDate(input);
                        if (retDate <= outDate) {
                            return 'Return date must be after departure date';
                        }
                        
                        return true;
                    }
                }
            ]);
            
            returnDate = parseFlexibleDate(multiDayAnswers.returnDate);
        } else {
            // Ask for number of days
            const daysAnswer = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'numberOfDays',
                    message: 'How many days do you want to stay at your destination? (1-365)\n  Note: This is nights spent there. E.g., "2" means arrive Mon, return Wed (2 nights).',
                    validate: (input) => {
                        const days = parseInt(input);
                        if (isNaN(days) || days < 1 || days > 365) {
                            return 'Please enter a number between 1 and 365';
                        }
                        return true;
                    }
                }
            ]);
            
            // Store the number of days for flexible search
            answers.numberOfDays = parseInt(daysAnswer.numberOfDays);
            answers.flexibleDuration = true;
            
            console.log(`✅ Trip duration: ${answers.numberOfDays} nights at destination`);
            console.log('Will search for cheapest departure dates within your date range');
            
            // Set return date to null to indicate flexible duration mode
            returnDate = null;
        }
        
        // Convert return date to ISO format (only if we have a specific date)
        if (returnDate) {
            answers.returnDate = returnDate.toISOString().split('T')[0];
        }
    }
    
    // Ask about time preferences
    const useTimePrefs = await askForTimePreferences();
    
    if (useTimePrefs) {
        // Get outbound time preferences
        const outboundTimePrefs = await selectTimePreferences('outbound');
        displayTimePreferences(outboundTimePrefs, 'outbound');
        
        // Get return time preferences for round trips
        if (answers.tripType === TRIP_TYPES.SAME_DAY || answers.tripType === TRIP_TYPES.MULTI_DAY) {
            const returnTimePrefs = await selectTimePreferences('return');
            displayTimePreferences(returnTimePrefs, 'return');
            
            answers.returnTimePreferences = returnTimePrefs;
        }
        
        answers.outboundTimePreferences = outboundTimePrefs;
        answers.useTimePreferences = true;
    } else {
        answers.useTimePreferences = false;
    }
    
    return answers;
}

// Search for same-day trips with resilient retry logic
async function searchSameDayTrips(departureStation, destinationStation, startDate, endDate, timePreferences = null, returnDepartureStation = null, silent = false) {
    const shouldBeQuiet = silent || isNestedSearch;
    if (!shouldBeQuiet) {
        console.log('\n🔍 Searching for same-day return trips...\n');
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    const dates = [];
    
    // Generate all dates to search
    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
        dates.push(new Date(date));
    }
    
    // Individual date search function
    const searchSingleDate = async (date) => {
        const dateStr = formatDate(date);
        
        // Morning departure (6 AM)
        const morningDeparture = new Date(date);
        morningDeparture.setHours(6, 0, 0, 0);
        
        const outboundResult = await client.journeys(departureStation, destinationStation, {
            ...searchConfig,
            departure: morningDeparture,
            results: 15
        });
        
        // Filter outbound journeys with pricing
        let validOutbound = outboundResult.journeys.filter(journey => {
            if (!journey.legs || journey.legs.length === 0) return false;
            return journey.price && journey.price.amount;
        });
        
        // Apply time preferences for outbound if specified
        if (timePreferences?.outbound) {
            validOutbound = filterJourneysByTime(validOutbound, timePreferences.outbound);
        } else {
            // Default: arrivals before 12 PM for same-day trips
            validOutbound = validOutbound.filter(journey => {
                const lastLeg = journey.legs[journey.legs.length - 1];
                const arrivalTime = new Date(lastLeg.plannedArrival || lastLeg.arrival);
                return arrivalTime.getHours() < 12;
            });
        }
        
        if (validOutbound.length === 0) {
            throw new Error('No suitable outbound journeys found');
        }
        
        // Evening departure (6 PM)
        const eveningDeparture = new Date(date);
        eveningDeparture.setHours(18, 0, 0, 0);
        
        const actualReturnDeparture = returnDepartureStation || destinationStation;
        const returnResult = await client.journeys(actualReturnDeparture, departureStation, {
            ...searchConfig,
            departure: eveningDeparture,
            results: 15
        });
        
        let validReturn = returnResult.journeys.filter(journey => {
            return journey.price && journey.price.amount;
        });
        
        // For same-day trips, exclude return trains that depart after midnight (next day)
        validReturn = validReturn.filter(journey => {
            const firstLeg = journey.legs[0];
            const departureTime = new Date(firstLeg.plannedDeparture || firstLeg.departure);
            const departureHour = departureTime.getHours();
            // Exclude trains departing between 00:00 and 05:59 (early morning next day)
            return departureHour >= 6 && departureHour <= 23;
        });
        
        // Apply time preferences for return if specified
        if (timePreferences?.return) {
            validReturn = filterJourneysByTime(validReturn, timePreferences.return);
        }
        
        if (validReturn.length === 0) {
            throw new Error('No suitable return journeys found');
        }
        
        // Find cheapest combination
        const cheapestOutbound = validOutbound.reduce((min, journey) => 
            journey.price.amount < min.price.amount ? journey : min
        );
        
        const cheapestReturn = validReturn.reduce((min, journey) => 
            journey.price.amount < min.price.amount ? journey : min
        );
        
        const totalPrice = cheapestOutbound.price.amount + cheapestReturn.price.amount;
        
        return {
            date: dateStr,
            totalPrice,
            outbound: extractJourneyInfo(cheapestOutbound),
            return: extractJourneyInfo(cheapestReturn)
        };
    };
    
    // Use progressive search with retry and configurable concurrency
    const searchResult = await withProgressiveSearch(
        dates.map(date => formatDate(date)),
        async (dateStr) => {
            const date = dates.find(d => formatDate(d) === dateStr);
            const result = await searchSingleDate(date);
            // Individual date results will be shown in summary
            return result;
        },
        (message) => {
            if (!shouldBeQuiet) {
                console.log(`  ${message}`);
            }
        },
        config.preferences.maxConcurrency,
        shouldBeQuiet ? false : config.preferences.useTrainAnimations
    );
    
    // Show successful results summary
    if (!shouldBeQuiet && searchResult.results.length > 0) {
        console.log(`\n✓ Found ${searchResult.results.length} same-day options:`);
        searchResult.results.forEach(result => {
            console.log(`  ${result.date}: €${result.totalPrice.toFixed(2)} total`);
        });
    }
    
    return searchResult.results;
}

// Search for one-way trips with resilient retry logic
async function searchOneWayTrips(departureStation, destinationStation, startDate, endDate, timePreferences = null, silent = false) {
    const shouldBeQuiet = silent || isNestedSearch;
    if (!shouldBeQuiet) {
        console.log('\n🔍 Searching for one-way trips...\n');
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    const dates = [];
    
    // Generate all dates to search
    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
        dates.push(new Date(date));
    }
    
    // Individual date search function
    const searchSingleDate = async (date) => {
        const dateStr = formatDate(date);
        
        // Search throughout the day (starting from 6 AM)
        const searchTime = new Date(date);
        searchTime.setHours(6, 0, 0, 0);
        
        // Search with multiple time windows to find all trains
        const morningTime = new Date(searchTime);
        const afternoonTime = new Date(searchTime);
        afternoonTime.setHours(searchTime.getHours() + 12);
        
        const allResults = [];
        
        // Morning/early search
        const morningResult = await client.journeys(departureStation, destinationStation, {
            ...searchConfig,
            departure: morningTime,
            results: 15
        });
        allResults.push(...morningResult.journeys);
        
        // Afternoon/evening search if the time allows
        if (searchTime.getHours() < 12) {
            const afternoonResult = await client.journeys(departureStation, destinationStation, {
                ...searchConfig,
                departure: afternoonTime,
                results: 15
            });
            allResults.push(...afternoonResult.journeys);
        }
        
        // Remove duplicates and combine results
        const uniqueJourneys = allResults.filter((journey, index, self) => {
            const firstLeg = journey.legs[0];
            const depTime = firstLeg.plannedDeparture || firstLeg.departure;
            return index === self.findIndex(j => {
                const jFirstLeg = j.legs[0];
                const jDepTime = jFirstLeg.plannedDeparture || jFirstLeg.departure;
                return depTime === jDepTime;
            });
        });
        
        const journeyResult = { journeys: uniqueJourneys };
        
        // Filter journeys with pricing
        let validJourneys = journeyResult.journeys.filter(journey => {
            return journey.price && journey.price.amount;
        });
        
        // Apply time preferences if specified
        if (timePreferences) {
            validJourneys = filterJourneysByTime(validJourneys, timePreferences);
        }
        
        if (validJourneys.length === 0) {
            if (timePreferences) {
                throw new Error(`No journeys found matching time preference: ${timePreferences.departurePreference}`);
            } else {
                throw new Error('No journeys with pricing found');
            }
        }
        
        // Find cheapest journey
        const cheapestJourney = validJourneys.reduce((min, journey) => 
            journey.price.amount < min.price.amount ? journey : min
        );
        
        return {
            date: dateStr,
            totalPrice: cheapestJourney.price.amount,
            journey: extractJourneyInfo(cheapestJourney)
        };
    };
    
    // Use progressive search with retry and configurable concurrency
    const searchResult = await withProgressiveSearch(
        dates.map(date => formatDate(date)),
        async (dateStr) => {
            const date = dates.find(d => formatDate(d) === dateStr);
            const result = await searchSingleDate(date);
            // Individual date results will be shown in summary
            return result;
        },
        (message) => {
            if (!shouldBeQuiet) {
                console.log(`  ${message}`);
            }
        },
        config.preferences.maxConcurrency,
        config.preferences.useTrainAnimations
    );
    
    // Show successful results summary
    if (!shouldBeQuiet && searchResult.results.length > 0) {
        console.log(`\n✓ Found ${searchResult.results.length} one-way options:`);
        searchResult.results.forEach(result => {
            console.log(`  ${result.date}: €${result.totalPrice.toFixed(2)}`);
        });
    }
    
    return searchResult.results;
}

// Search for multi-day trips with fixed return date
async function searchMultiDayTrips(departureStation, destinationStation, outboundStart, outboundEnd, returnDate, timePreferences = null, returnDepartureStation = null) {
    console.log('\n🔍 Searching for multi-day trips...\n');
    
    // Set nested search flag to silence sub-searches
    const previousNestedState = isNestedSearch;
    isNestedSearch = true;
    
    try {
        // First, find all outbound options
        console.log('📅 Searching outbound journeys...');
        const outboundResults = await searchOneWayTrips(departureStation, destinationStation, outboundStart, outboundEnd, timePreferences?.outbound, true);
    
    if (outboundResults.length === 0) {
        console.log('No outbound journeys found');
        return [];
    }
    
    // Then search for return journey
    console.log('\n📅 Searching return journey...');
    const actualReturnDeparture = returnDepartureStation || destinationStation;
    const returnResults = await searchOneWayTrips(actualReturnDeparture, departureStation, returnDate, returnDate, timePreferences?.return, true);
    
    if (returnResults.length === 0) {
        console.log('No return journey found');
        return [];
    }
    
    // Combine results
    const returnJourney = returnResults[0]; // Only one date for return
    const results = outboundResults.map(outbound => ({
        outboundDate: outbound.date,
        returnDate: returnJourney.date,
        totalPrice: outbound.totalPrice + returnJourney.totalPrice,
        outbound: outbound.journey,
        return: returnJourney.journey
    }));
    
    return results;
    } finally {
        // Restore previous nested state
        isNestedSearch = previousNestedState;
    }
}

// Search for multi-day trips with flexible duration (N days stay)
async function searchFlexibleDurationTrips(departureStation, destinationStation, outboundStart, outboundEnd, numberOfDays, timePreferences = null, returnDepartureStation = null, silent = false) {
    const shouldBeQuiet = silent || isNestedSearch;
    if (!shouldBeQuiet) {
        console.log(`\n🔍 Searching for ${numberOfDays}-night trips...\n`);
    }
    
    const start = new Date(outboundStart);
    const end = new Date(outboundEnd);
    const dates = [];
    const results = [];
    
    // Generate all possible departure dates
    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
        dates.push(new Date(date));
    }
    
    // Search function for a specific departure date
    const searchSingleDeparture = async (departureDate) => {
        // Set nested search flag to silence sub-searches
        const previousNestedState = isNestedSearch;
        isNestedSearch = true;
        
        try {
        const departureDateStr = formatDate(departureDate);
        
        // Calculate return date based on numberOfDays
        const returnDate = new Date(departureDate);
        returnDate.setDate(departureDate.getDate() + numberOfDays);
        const returnDateStr = returnDate.toISOString().split('T')[0];
        
        // Search outbound journey for this specific date
        const outboundResults = await searchOneWayTrips(
            departureStation, 
            destinationStation, 
            departureDate.toISOString().split('T')[0], 
            departureDate.toISOString().split('T')[0], 
            timePreferences?.outbound,
            true // silent mode
        );
        
        if (outboundResults.length === 0) {
            throw new Error(`No outbound journey found for ${departureDateStr}`);
        }
        
        // Search return journey
        const actualReturnDeparture = returnDepartureStation || destinationStation;
        
        const returnResults = await searchOneWayTrips(
            actualReturnDeparture, 
            departureStation, 
            returnDateStr, 
            returnDateStr, 
            timePreferences?.return,
            true // silent mode
        );
        
        if (returnResults.length === 0) {
            throw new Error(`No return journey found for ${formatDate(returnDate)}`);
        }
        
        // Get cheapest options
        const outboundJourney = outboundResults[0]; // Already sorted by price
        const returnJourney = returnResults[0];
        
        return {
            outboundDate: departureDateStr,
            returnDate: formatDate(returnDate),
            totalPrice: outboundJourney.totalPrice + returnJourney.totalPrice,
            outbound: outboundJourney.journey,
            return: returnJourney.journey,
            duration: numberOfDays
        };
        } finally {
            // Restore previous nested state
            isNestedSearch = previousNestedState;
        }
    };
    
    // Use progressive search with retry
    const searchResult = await withProgressiveSearch(
        dates.map(date => formatDate(date)),
        async (dateStr) => {
            const date = dates.find(d => formatDate(d) === dateStr);
            const result = await searchSingleDeparture(date);
            // Individual date results will be shown in summary
            return result;
        },
        (message) => {
            if (!shouldBeQuiet) {
                console.log(`  ${message}`);
            }
        },
        config.preferences.maxConcurrency,
        shouldBeQuiet ? false : config.preferences.useTrainAnimations
    );
    
    // Show successful results summary
    if (!shouldBeQuiet && searchResult.results.length > 0) {
        console.log(`\n✓ Found ${searchResult.results.length} ${numberOfDays}-night options:`);
        searchResult.results.forEach(result => {
            console.log(`  ${result.outboundDate} → ${result.returnDate}: €${result.totalPrice.toFixed(2)} total`);
        });
    }
    
    return searchResult.results;
}

// Extract journey information
function extractJourneyInfo(journey) {
    const firstLeg = journey.legs[0];
    const lastLeg = journey.legs[journey.legs.length - 1];
    
    // Get transportation legs only (skip walking)
    const transportationLegs = journey.legs.filter(leg => leg.line);
    
    // Create combined train name for multi-leg journeys
    const trainNames = transportationLegs
        .map(leg => leg.line.name || 'Unknown')
        .filter((name, index, array) => array.indexOf(name) === index); // Remove duplicates
    
    const combinedTrainName = trainNames.length > 1 
        ? trainNames.join(' + ') 
        : trainNames[0] || 'Unknown';
    
    // Calculate actual transfers: number of transportation segments minus 1
    const actualTransfers = Math.max(0, transportationLegs.length - 1);
    
    return {
        departure: firstLeg.plannedDeparture || firstLeg.departure,
        arrival: lastLeg.plannedArrival || lastLeg.arrival,
        price: journey.price.amount,
        currency: journey.price.currency || 'EUR',
        trainName: combinedTrainName,
        product: firstLeg.line?.product || 'train',
        transfers: actualTransfers,
        legs: journey.legs.length,
        transportationLegs: transportationLegs.length,
        allTrains: trainNames // Keep individual train names for additional info if needed
    };
}

// Display results
function displayResults(results, tripType, departureCity, destinationCity, timePreferences = null, returnDepartureCity = null) {
    console.log('\n' + '='.repeat(60));
    console.log('🎯 SEARCH RESULTS');
    console.log('='.repeat(60));
    // Display route information
    if (tripType === TRIP_TYPES.ONE_WAY) {
        console.log(`Route: ${departureCity} → ${destinationCity}`);
    } else {
        if (returnDepartureCity && returnDepartureCity !== destinationCity) {
            console.log(`Outbound: ${departureCity} → ${destinationCity}`);
            console.log(`Return: ${returnDepartureCity} → ${departureCity}`);
        } else {
            console.log(`Route: ${departureCity} ⇄ ${destinationCity} (round trip)`);
        }
    }
    console.log(`Trip type: ${tripType}`);
    
    // Display time preferences if used
    if (timePreferences) {
        console.log('\n🕰️ Time Preferences Applied:');
        if (timePreferences.outbound) {
            const outbound = timePreferences.outbound;
            if (outbound.departurePreference !== 'any') {
                if (outbound.departurePreference === 'custom') {
                    if (outbound.customDepartureTimeEnd) {
                        console.log(`  Outbound departure: ${outbound.customDepartureTime} - ${outbound.customDepartureTimeEnd}`);
                    } else {
                        console.log(`  Outbound departure: After ${outbound.customDepartureTime}`);
                    }
                } else {
                    console.log(`  Outbound departure: ${getTimePreferenceDisplayName(outbound.departurePreference)}`);
                }
            }
            if (outbound.arrivalConstraintType !== 'any') {
                if (outbound.arrivalConstraintType === 'between') {
                    console.log(`  Outbound arrival: ${outbound.arrivalConstraintTime} - ${outbound.arrivalConstraintTimeEnd}`);
                } else if (outbound.arrivalConstraintType === 'before') {
                    console.log(`  Outbound arrival: Before ${outbound.arrivalConstraintTime}`);
                } else if (outbound.arrivalConstraintType === 'after') {
                    console.log(`  Outbound arrival: After ${outbound.arrivalConstraintTime}`);
                }
            }
        }
        if (timePreferences.return) {
            const returnPrefs = timePreferences.return;
            if (returnPrefs.departurePreference !== 'any') {
                if (returnPrefs.departurePreference === 'custom') {
                    if (returnPrefs.customDepartureTimeEnd) {
                        console.log(`  Return departure: ${returnPrefs.customDepartureTime} - ${returnPrefs.customDepartureTimeEnd}`);
                    } else {
                        console.log(`  Return departure: After ${returnPrefs.customDepartureTime}`);
                    }
                } else {
                    console.log(`  Return departure: ${getTimePreferenceDisplayName(returnPrefs.departurePreference)}`);
                }
            }
            if (returnPrefs.arrivalConstraintType !== 'any') {
                if (returnPrefs.arrivalConstraintType === 'between') {
                    console.log(`  Return arrival: ${returnPrefs.arrivalConstraintTime} - ${returnPrefs.arrivalConstraintTimeEnd}`);
                } else if (returnPrefs.arrivalConstraintType === 'before') {
                    console.log(`  Return arrival: Before ${returnPrefs.arrivalConstraintTime}`);
                } else if (returnPrefs.arrivalConstraintType === 'after') {
                    console.log(`  Return arrival: After ${returnPrefs.arrivalConstraintTime}`);
                }
            }
        }
    }
    console.log('');
    
    if (results.length === 0) {
        console.log('❌ No trips found with pricing information.');
        console.log('This could be due to:');
        console.log('  - Limited pricing data availability');
        console.log('  - No connections on selected dates');
        console.log('  - API rate limiting');
        return;
    }
    
    // Sort by price
    results.sort((a, b) => a.totalPrice - b.totalPrice);
    
    // Group by price
    const priceGroups = {};
    results.forEach(result => {
        const price = result.totalPrice.toFixed(2);
        if (!priceGroups[price]) {
            priceGroups[price] = [];
        }
        priceGroups[price].push(result);
    });
    
    // Display top 3 price groups
    const sortedPrices = Object.keys(priceGroups).sort((a, b) => parseFloat(a) - parseFloat(b));
    
    for (let i = 0; i < Math.min(3, sortedPrices.length); i++) {
        const price = sortedPrices[i];
        const group = priceGroups[price];
        
        console.log(`\n${i + 1}. 💰 €${price} - Available on ${group.length} date${group.length > 1 ? 's' : ''}:`);
        console.log('   ' + '-'.repeat(55));
        
        // Show first few results in detail, then compact format for the rest
        const detailedCount = Math.min(3, group.length);
        const compactCount = group.length - detailedCount;
        
        // Show detailed results
        group.slice(0, detailedCount).forEach(result => {
            if (tripType === TRIP_TYPES.ONE_WAY) {
                const journey = result.journey;
                console.log(`   📅 ${result.date}`);
                console.log(`      🚄 ${journey.trainName} | ${formatTime(journey.departure)} → ${formatTime(journey.arrival)}`);
                if (journey.transfers > 0) {
                    console.log(`      💵 €${journey.price.toFixed(2)} | ${journey.transfers} transfer${journey.transfers !== 1 ? 's' : ''}`);
                } else {
                    console.log(`      💵 €${journey.price.toFixed(2)} | Direct`);
                }
            } else if (tripType === TRIP_TYPES.SAME_DAY) {
                console.log(`   📅 ${result.date}`);
                // Outbound journey
                if (returnDepartureCity && returnDepartureCity !== destinationCity) {
                    console.log(`      🚄 Out (${departureCity}→${destinationCity}): ${result.outbound.trainName} | ${formatTime(result.outbound.departure)} → ${formatTime(result.outbound.arrival)} | €${result.outbound.price.toFixed(2)}`);
                } else {
                    console.log(`      🚄 Out: ${result.outbound.trainName} | ${formatTime(result.outbound.departure)} → ${formatTime(result.outbound.arrival)} | €${result.outbound.price.toFixed(2)}`);
                }
                if (result.outbound.transfers > 0) {
                    console.log(`           ${result.outbound.transfers} transfer${result.outbound.transfers !== 1 ? 's' : ''}`);
                }
                // Return journey
                if (returnDepartureCity && returnDepartureCity !== destinationCity) {
                    console.log(`      🔄 Ret (${returnDepartureCity}→${departureCity}): ${result.return.trainName} | ${formatTime(result.return.departure)} → ${formatTime(result.return.arrival)} | €${result.return.price.toFixed(2)}`);
                } else {
                    console.log(`      🔄 Ret: ${result.return.trainName} | ${formatTime(result.return.departure)} → ${formatTime(result.return.arrival)} | €${result.return.price.toFixed(2)}`);
                }
                if (result.return.transfers > 0) {
                    console.log(`           ${result.return.transfers} transfer${result.return.transfers !== 1 ? 's' : ''}`);
                }
            } else { // MULTI_DAY
                console.log(`   📅 Out: ${result.outboundDate} | Ret: ${result.returnDate}`);
                // Outbound journey
                if (returnDepartureCity && returnDepartureCity !== destinationCity) {
                    console.log(`      🚄 Out (${departureCity}→${destinationCity}): ${result.outbound.trainName} | ${formatTime(result.outbound.departure)} → ${formatTime(result.outbound.arrival)} | €${result.outbound.price.toFixed(2)}`);
                } else {
                    console.log(`      🚄 Out: ${result.outbound.trainName} | ${formatTime(result.outbound.departure)} → ${formatTime(result.outbound.arrival)} | €${result.outbound.price.toFixed(2)}`);
                }
                if (result.outbound.transfers > 0) {
                    console.log(`           ${result.outbound.transfers} transfer${result.outbound.transfers !== 1 ? 's' : ''}`);
                }
                // Return journey
                if (returnDepartureCity && returnDepartureCity !== destinationCity) {
                    console.log(`      🔄 Ret (${returnDepartureCity}→${departureCity}): ${result.return.trainName} | ${formatTime(result.return.departure)} → ${formatTime(result.return.arrival)} | €${result.return.price.toFixed(2)}`);
                } else {
                    console.log(`      🔄 Ret: ${result.return.trainName} | ${formatTime(result.return.departure)} → ${formatTime(result.return.arrival)} | €${result.return.price.toFixed(2)}`);
                }
                if (result.return.transfers > 0) {
                    console.log(`           ${result.return.transfers} transfer${result.return.transfers !== 1 ? 's' : ''}`);
                }
            }
        });
        
        // Show remaining results in compact format
        if (compactCount > 0) {
            const compactDates = group.slice(detailedCount).map(result => {
                if (tripType === TRIP_TYPES.ONE_WAY || tripType === TRIP_TYPES.SAME_DAY) {
                    // Convert "Tue, Aug 12, 2025" to "Aug 12"
                    const parts = result.date.split(', ');
                    return parts.length >= 2 ? parts[1] : result.date;
                } else { // MULTI_DAY
                    // Convert dates to compact format for multi-day
                    const outParts = result.outboundDate.split(', ');
                    const retParts = result.returnDate.split(', ');
                    const outCompact = outParts.length >= 2 ? outParts[1] : result.outboundDate;
                    const retCompact = retParts.length >= 2 ? retParts[1] : result.returnDate;
                    return `${outCompact}→${retCompact}`;
                }
            });
            
            console.log(`   📅 Also available: ${compactDates.join(', ')}`);
        }
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total options found: ${results.length}`);
    console.log(`Best price: €${results[0].totalPrice.toFixed(2)}`);
    console.log(`Price range: €${results[0].totalPrice.toFixed(2)} - €${results[results.length - 1].totalPrice.toFixed(2)}`);
}

// Handle command-line mode
async function handleCliMode(cliOptions) {
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

// Enhanced output function
function outputResults(results, tripType, departureCity, destinationCity, returnDepartureCity, outputFormat, outputFile) {
    let content = '';
    
    switch (outputFormat) {
        case 'table':
            content = formatAsTable(results, tripType, departureCity, destinationCity, returnDepartureCity);
            break;
        case 'json':
            content = formatAsJson(results, tripType, departureCity, destinationCity, returnDepartureCity);
            break;
        case 'csv':
            content = formatAsCsv(results, tripType);
            break;
        default: // console
            displayResults(results, tripType, departureCity, destinationCity, null, returnDepartureCity);
            return;
    }
    
    if (outputFile) {
        const saveResult = saveToFile(content, outputFile, outputFormat);
        if (saveResult.success) {
            console.log(`✅ Results saved to: ${saveResult.filename}`);
        } else {
            console.error(`❌ Failed to save file: ${saveResult.error}`);
        }
    } else {
        console.log(content);
    }
}

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
            searchParams = await handleCliMode(cliOptions);
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
            searchParams = await getUserInput();
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
                            departureStationId, 
                            destinationStationId, 
                            searchParams.startDate, 
                            searchParams.endDate,
                            timePreferences,
                            returnDepartureStationId
                        ), config.preferences.retryAttempts, 1000, 'Same-day trip search'),
                        config.preferences.searchTimeout,
                        'Same-day trip search'
                    );
                    
                case TRIP_TYPES.ONE_WAY:
                    return await withTimeout(
                        withRetry(() => searchOneWayTrips(
                            departureStationId, 
                            destinationStationId, 
                            searchParams.startDate, 
                            searchParams.endDate,
                            timePreferences?.outbound
                        ), config.preferences.retryAttempts, 1000, 'One-way trip search'),
                        config.preferences.searchTimeout,
                        'One-way trip search'
                    );
                    
                case TRIP_TYPES.MULTI_DAY:
                    if (searchParams.flexibleDuration) {
                        // Flexible duration search (N days stay)
                        return await withTimeout(
                            withRetry(() => searchFlexibleDurationTrips(
                                departureStationId, 
                                destinationStationId, 
                                searchParams.startDate, 
                                searchParams.endDate,
                                searchParams.numberOfDays,
                                timePreferences,
                                returnDepartureStationId
                            ), config.preferences.retryAttempts, 1000, `${searchParams.numberOfDays}-night trip search`),
                            config.preferences.searchTimeout,
                            `${searchParams.numberOfDays}-night trip search`
                        );
                    } else {
                        // Fixed return date search
                        return await withTimeout(
                            withRetry(() => searchMultiDayTrips(
                                departureStationId, 
                                destinationStationId, 
                                searchParams.startDate, 
                                searchParams.endDate,
                                searchParams.returnDate,
                                timePreferences,
                                returnDepartureStationId
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
            cliOptions['output-file']
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

// Station lookup function for CLI
async function lookupStation(client, query) {
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
            ...searchConfig,
            departure: morningSearch,
            results: 25,
            transfers: 3,
            stopovers: false,
            tickets: true
        });
        
        // Search evening departures  
        console.log('🌆 Searching evening departures (12:00-23:59)...');
        const eveningResult = await client.journeys(fromStation, toStation, {
            ...searchConfig,
            departure: eveningSearch,
            results: 25,
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