// Results display - formatting and outputting search results

import { formatTime } from './journey-utils.js';
import { TRIP_TYPES } from './journey-search.js';
import { getTimePreferenceDisplayName } from './time-preferences.js';
import { formatAsTable, formatAsJson, formatAsCsv, saveToFile } from './output-formatters.js';
import { formatStationDisplay } from './station-selector.js';

// Display results
export function displayResults(results, tripType, departureCity, destinationCity, timePreferences = null, returnDepartureCity = null) {
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

// Enhanced output function
export function outputResults(results, tripType, departureCity, destinationCity, returnDepartureCity, outputFormat, outputFile, timePreferences = null) {
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
            displayResults(results, tripType, departureCity, destinationCity, timePreferences, returnDepartureCity);
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