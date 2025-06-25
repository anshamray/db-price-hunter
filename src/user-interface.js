// User interface - interactive prompts and input handling

import inquirer from 'inquirer';
import { selectCityStation, formatStationDisplay } from './station-selector.js';
import { askForTimePreferences, selectTimePreferences, displayTimePreferences } from './time-selector.js';
import { parseFlexibleDate, validateDate } from './journey-utils.js';
import { TRIP_TYPES } from './journey-search.js';

// Get user input
export async function getUserInput(client) {
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