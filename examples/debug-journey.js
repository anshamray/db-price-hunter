#!/usr/bin/env node

import { createClient } from 'db-vendo-client';
import { profile as dbnavProfile } from 'db-vendo-client/p/dbnav/index.js';

// Initialize the client
const client = createClient(dbnavProfile, 'debug-journey-analyzer');

// Station IDs
const BERLIN_ZOO = '8010406'; // Berlin Zoologischer Garten
const DORTMUND_HBF = '8000080'; // Dortmund Hbf

// Search configuration
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

async function debugSpecificJourney() {
    console.log('🔍 Debugging journey from Berlin Zoologischer Garten to Dortmund Hbf');
    console.log('Date: August 11, 2025');
    console.log('Expected trains: ICE 654 + ICE 1052\n');

    try {
        // Search for the specific date and time (trying different times)
        const searchTimes = [
            new Date('2025-08-11T05:00:00Z'), // 5 AM
            new Date('2025-08-11T06:00:00Z'), // 6 AM  
            new Date('2025-08-11T07:00:00Z'), // 7 AM
        ];
        
        for (const searchDate of searchTimes) {
            console.log(`\n🕐 Searching departures after ${searchDate.toLocaleString()}`);
        
            const result = await client.journeys(BERLIN_ZOO, DORTMUND_HBF, {
                ...searchConfig,
                departure: searchDate,
                results: 20 // Get more results to find the specific journey
            });

        console.log(`Found ${result.journeys.length} journeys\n`);

        // First, show a summary of all journeys
        console.log('=== ALL JOURNEYS SUMMARY ===');
        result.journeys.forEach((journey, index) => {
            if (!journey.price || !journey.price.amount || !journey.legs || journey.legs.length === 0) return;

            const firstLeg = journey.legs[0];
            const lastLeg = journey.legs[journey.legs.length - 1];
            const departure = new Date(firstLeg.plannedDeparture || firstLeg.departure);
            const arrival = new Date(lastLeg.plannedArrival || lastLeg.arrival);
            
            const trainNames = journey.legs
                .filter(leg => leg.line)
                .map(leg => leg.line.name || 'Unknown')
                .filter((name, idx, arr) => arr.indexOf(name) === idx);
            
            console.log(`${index + 1}. ${departure.toLocaleTimeString('de-DE')} → ${arrival.toLocaleTimeString('de-DE')} | €${journey.price.amount.toFixed(2)} | ${trainNames.join(' + ')} | ${journey.legs.length} legs`);
        });

        console.log('\n');

        // Look for journeys that might match the ICE 654 + ICE 1052 pattern
        result.journeys.forEach((journey, index) => {
            if (!journey.price || !journey.price.amount) return;

            const firstLeg = journey.legs[0];
            const lastLeg = journey.legs[journey.legs.length - 1];
            
            const departure = new Date(firstLeg.plannedDeparture || firstLeg.departure);
            const arrival = new Date(lastLeg.plannedArrival || lastLeg.arrival);
            
            // Show all journeys but highlight potential matches
            const isPotentialMatch = (departure.getHours() === 7 && departure.getMinutes() >= 0 && departure.getMinutes() <= 15) ||
                                   journey.legs.some(leg => leg.line?.name?.includes('ICE 654') || leg.line?.name?.includes('ICE 1052'));
            
            if (isPotentialMatch) {
                console.log(`\n${'='.repeat(60)}`);
                console.log(`JOURNEY ${index + 1} - Potential Match`);
                console.log(`${'='.repeat(60)}`);
                console.log(`Departure: ${departure.toLocaleString()}`);
                console.log(`Arrival: ${arrival.toLocaleString()}`);
                console.log(`Price: €${journey.price.amount.toFixed(2)}`);
                console.log(`Total legs: ${journey.legs.length}\n`);

                // Analyze each leg in detail
                journey.legs.forEach((leg, legIndex) => {
                    console.log(`--- LEG ${legIndex + 1} ---`);
                    
                    if (leg.line) {
                        console.log(`Type: Transportation`);
                        console.log(`Train: ${leg.line.name || 'Unknown'}`);
                        console.log(`Product: ${leg.line.product || 'Unknown'}`);
                        console.log(`Mode: ${leg.line.mode || 'Unknown'}`);
                    } else {
                        console.log(`Type: Walking/Transfer`);
                        console.log(`Mode: ${leg.mode || 'walking'}`);
                    }
                    
                    const legDep = new Date(leg.plannedDeparture || leg.departure);
                    const legArr = new Date(leg.plannedArrival || leg.arrival);
                    
                    console.log(`Departure: ${legDep.toLocaleTimeString('de-DE')} from ${leg.origin?.name || 'Unknown'}`);
                    console.log(`Arrival: ${legArr.toLocaleTimeString('de-DE')} at ${leg.destination?.name || 'Unknown'}`);
                    
                    if (leg.distance) {
                        console.log(`Distance: ${leg.distance}m`);
                    }
                    
                    console.log('');
                });

                // Show what our extraction function would produce
                console.log(`--- EXTRACTION RESULT ---`);
                
                const transportationLegs = journey.legs.filter(leg => leg.line);
                const trainNames = transportationLegs
                    .map(leg => leg.line.name || 'Unknown')
                    .filter((name, index, array) => array.indexOf(name) === index);
                
                const combinedTrainName = trainNames.length > 1 
                    ? trainNames.join(' + ') 
                    : trainNames[0] || 'Unknown';
                
                const actualTransfers = Math.max(0, transportationLegs.length - 1);
                
                console.log(`Combined train name: ${combinedTrainName}`);
                console.log(`Transportation legs: ${transportationLegs.length}`);
                console.log(`Total legs: ${journey.legs.length}`);
                console.log(`Calculated transfers: ${actualTransfers}`);
                console.log(`Individual trains: [${trainNames.join(', ')}]`);
            }
        });

        // Also show the raw JSON for the first few matching journeys
        const matchingJourneys = result.journeys.filter(journey => {
            if (!journey.legs || journey.legs.length === 0) return false;
            const firstLeg = journey.legs[0];
            const departure = new Date(firstLeg.plannedDeparture || firstLeg.departure);
            return departure.getHours() === 7 && departure.getMinutes() <= 10;
        });

        if (matchingJourneys.length > 0) {
            console.log(`\n${'='.repeat(60)}`);
            console.log(`RAW API DATA FOR FIRST MATCHING JOURNEY`);
            console.log(`${'='.repeat(60)}`);
            console.log(JSON.stringify(matchingJourneys[0], null, 2));
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

// Run the debug analysis
debugSpecificJourney();