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
    results: 20,
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

async function findSpecificJourney() {
    console.log('🔍 Searching Berlin Zoologischer Garten → Dortmund Hbf');
    console.log('Looking for ICE 654 + ICE 1052 journey\n');

    try {
        // Search early morning departures
        const searchDate = new Date('2025-08-11T05:00:00Z');
        
        const result = await client.journeys(BERLIN_ZOO, DORTMUND_HBF, {
            ...searchConfig,
            departure: searchDate
        });

        console.log(`Found ${result.journeys.length} journeys:\n`);

        result.journeys.forEach((journey, index) => {
            if (!journey.price || !journey.price.amount || !journey.legs) return;

            const firstLeg = journey.legs[0];
            const lastLeg = journey.legs[journey.legs.length - 1];
            const departure = new Date(firstLeg.plannedDeparture || firstLeg.departure);
            const arrival = new Date(lastLeg.plannedArrival || lastLeg.arrival);
            
            // Get all train names
            const trainNames = journey.legs
                .filter(leg => leg.line)
                .map(leg => leg.line.name || 'Unknown');
            
            console.log(`${index + 1}. ${departure.toLocaleTimeString('de-DE')} → ${arrival.toLocaleTimeString('de-DE')}`);
            console.log(`   Price: €${journey.price.amount.toFixed(2)}`);
            console.log(`   Trains: ${trainNames.join(' + ')}`);
            console.log(`   Total legs: ${journey.legs.length}`);
            
            // Check if this could be our target journey
            const hasICE654 = trainNames.some(name => name.includes('ICE 654'));
            const hasICE1052 = trainNames.some(name => name.includes('ICE 1052'));
            const isEarlyMorning = departure.getHours() >= 6 && departure.getHours() <= 8;
            
            if (hasICE654 || hasICE1052 || isEarlyMorning) {
                console.log(`   ⭐ POTENTIAL MATCH - Analyzing legs:`);
                
                journey.legs.forEach((leg, legIndex) => {
                    console.log(`      Leg ${legIndex + 1}:`);
                    
                    if (leg.line) {
                        console.log(`        🚄 ${leg.line.name} (${leg.line.product})`);
                    } else {
                        console.log(`        🚶 Walking/Transfer (${leg.mode || 'walking'})`);
                    }
                    
                    const legDep = new Date(leg.plannedDeparture || leg.departure);
                    const legArr = new Date(leg.plannedArrival || leg.arrival);
                    console.log(`        ${legDep.toLocaleTimeString('de-DE')} → ${legArr.toLocaleTimeString('de-DE')}`);
                    console.log(`        ${leg.origin?.name || 'Unknown'} → ${leg.destination?.name || 'Unknown'}`);
                    
                    if (leg.distance) {
                        console.log(`        Distance: ${leg.distance}m`);
                    }
                });
                
                // Show extraction results
                const transportLegs = journey.legs.filter(leg => leg.line);
                const uniqueTrains = transportLegs
                    .map(leg => leg.line.name || 'Unknown')
                    .filter((name, idx, arr) => arr.indexOf(name) === idx);
                
                console.log(`   📊 Analysis:`);
                console.log(`      Combined name: ${uniqueTrains.join(' + ')}`);
                console.log(`      Transportation legs: ${transportLegs.length}`);
                console.log(`      Transfers: ${Math.max(0, transportLegs.length - 1)}`);
                console.log(`      Total legs: ${journey.legs.length}`);
            }
            
            console.log('');
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

findSpecificJourney();