// Journey search functions - all trip search implementations

import { formatDate, extractJourneyInfo } from './journey-utils.js';
import { filterJourneysByTime } from './time-preferences.js';
import { withProgressiveSearch } from './error-handler.js';

// Trip type definitions
export const TRIP_TYPES = {
    SAME_DAY: 'same-day',
    MULTI_DAY: 'multi-day',
    ONE_WAY: 'one-way'
};

// Base search configuration
export const searchConfig = {
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

// Search for same-day trips with resilient retry logic
export async function searchSameDayTrips(client, config, departureStation, destinationStation, startDate, endDate, timePreferences = null, returnDepartureStation = null, silent = false, isNestedSearch = false) {
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
export async function searchOneWayTrips(client, config, departureStation, destinationStation, startDate, endDate, timePreferences = null, silent = false, isNestedSearch = false) {
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
export async function searchMultiDayTrips(client, config, departureStation, destinationStation, outboundStart, outboundEnd, returnDate, timePreferences = null, returnDepartureStation = null, isNestedSearch = false) {
    console.log('\n🔍 Searching for multi-day trips...\n');
    
    // Set nested search flag to silence sub-searches
    const previousNestedState = isNestedSearch;
    isNestedSearch = true;
    
    try {
        // First, find all outbound options
        console.log('📅 Searching outbound journeys...');
        const outboundResults = await searchOneWayTrips(client, config, departureStation, destinationStation, outboundStart, outboundEnd, timePreferences?.outbound, true, true);
    
    if (outboundResults.length === 0) {
        console.log('No outbound journeys found');
        return [];
    }
    
    // Then search for return journey
    console.log('\n📅 Searching return journey...');
    const actualReturnDeparture = returnDepartureStation || destinationStation;
    const returnResults = await searchOneWayTrips(client, config, actualReturnDeparture, departureStation, returnDate, returnDate, timePreferences?.return, true, true);
    
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
export async function searchFlexibleDurationTrips(client, config, departureStation, destinationStation, outboundStart, outboundEnd, numberOfDays, timePreferences = null, returnDepartureStation = null, silent = false, isNestedSearch = false) {
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
            client,
            config,
            departureStation, 
            destinationStation, 
            departureDate.toISOString().split('T')[0], 
            departureDate.toISOString().split('T')[0], 
            timePreferences?.outbound,
            true, // silent mode
            true  // nested search
        );
        
        if (outboundResults.length === 0) {
            throw new Error(`No outbound journey found for ${departureDateStr}`);
        }
        
        // Search return journey
        const actualReturnDeparture = returnDepartureStation || destinationStation;
        
        const returnResults = await searchOneWayTrips(
            client,
            config,
            actualReturnDeparture, 
            departureStation, 
            returnDateStr, 
            returnDateStr, 
            timePreferences?.return,
            true, // silent mode
            true  // nested search
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