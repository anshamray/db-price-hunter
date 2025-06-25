import inquirer from 'inquirer';
import {
    TIME_PREFERENCES,
    TIME_CONSTRAINT_TYPES,
    getTimePreferenceDisplayName,
    getTimeConstraintDisplayName,
    validateTimeFormat
} from './time-preferences.js';

// Get departure time preferences
export async function selectDepartureTimePreference(type = 'outbound') {
    const typeLabel = type === 'outbound' ? 'departure' : 'return departure';
    
    const preferenceAnswer = await inquirer.prompt([{
        type: 'list',
        name: 'preference',
        message: `Select ${typeLabel} time preference:`,
        choices: [
            { name: getTimePreferenceDisplayName(TIME_PREFERENCES.ANY), value: TIME_PREFERENCES.ANY },
            { name: getTimePreferenceDisplayName(TIME_PREFERENCES.EARLY), value: TIME_PREFERENCES.EARLY },
            { name: getTimePreferenceDisplayName(TIME_PREFERENCES.MORNING), value: TIME_PREFERENCES.MORNING },
            { name: getTimePreferenceDisplayName(TIME_PREFERENCES.AFTERNOON), value: TIME_PREFERENCES.AFTERNOON },
            { name: getTimePreferenceDisplayName(TIME_PREFERENCES.EVENING), value: TIME_PREFERENCES.EVENING },
            { name: getTimePreferenceDisplayName(TIME_PREFERENCES.LATE), value: TIME_PREFERENCES.LATE },
            { name: getTimePreferenceDisplayName(TIME_PREFERENCES.CUSTOM), value: TIME_PREFERENCES.CUSTOM }
        ],
        default: TIME_PREFERENCES.ANY
    }]);

    const result = { preference: preferenceAnswer.preference };

    // If custom time selected, get the custom time details
    if (preferenceAnswer.preference === TIME_PREFERENCES.CUSTOM) {
        const customAnswer = await inquirer.prompt([
            {
                type: 'list',
                name: 'customType',
                message: 'Custom time preference:',
                choices: [
                    { name: 'After specific time', value: 'after' },
                    { name: 'Between two times', value: 'between' }
                ]
            }
        ]);

        if (customAnswer.customType === 'after') {
            const timeAnswer = await inquirer.prompt([{
                type: 'input',
                name: 'time',
                message: 'Enter earliest departure time (HH:MM):',
                validate: validateTimeFormat,
                default: '06:00'
            }]);
            result.customTime = timeAnswer.time;
        } else { // between
            const timeRangeAnswer = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'startTime',
                    message: 'Enter earliest departure time (HH:MM):',
                    validate: validateTimeFormat,
                    default: '08:00'
                },
                {
                    type: 'input',
                    name: 'endTime',
                    message: 'Enter latest departure time (HH:MM):',
                    validate: validateTimeFormat,
                    default: '18:00'
                }
            ]);
            result.customTime = timeRangeAnswer.startTime;
            result.customTimeEnd = timeRangeAnswer.endTime;
        }
    }

    return result;
}

// Get arrival time constraints
export async function selectArrivalTimeConstraint(type = 'outbound') {
    const typeLabel = type === 'outbound' ? 'arrival' : 'return arrival';
    
    const constraintAnswer = await inquirer.prompt([{
        type: 'list',
        name: 'constraintType',
        message: `Select ${typeLabel} time constraint:`,
        choices: [
            { name: getTimeConstraintDisplayName(TIME_CONSTRAINT_TYPES.ANY), value: TIME_CONSTRAINT_TYPES.ANY },
            { name: getTimeConstraintDisplayName(TIME_CONSTRAINT_TYPES.BEFORE), value: TIME_CONSTRAINT_TYPES.BEFORE },
            { name: getTimeConstraintDisplayName(TIME_CONSTRAINT_TYPES.AFTER), value: TIME_CONSTRAINT_TYPES.AFTER },
            { name: getTimeConstraintDisplayName(TIME_CONSTRAINT_TYPES.BETWEEN), value: TIME_CONSTRAINT_TYPES.BETWEEN }
        ],
        default: TIME_CONSTRAINT_TYPES.ANY
    }]);

    const result = { constraintType: constraintAnswer.constraintType };

    // If specific constraint selected, get the time details
    if (constraintAnswer.constraintType !== TIME_CONSTRAINT_TYPES.ANY) {
        if (constraintAnswer.constraintType === TIME_CONSTRAINT_TYPES.BEFORE) {
            const timeAnswer = await inquirer.prompt([{
                type: 'input',
                name: 'time',
                message: `Enter latest ${typeLabel} time (HH:MM):`,
                validate: validateTimeFormat,
                default: '18:00'
            }]);
            result.constraintTime = timeAnswer.time;
            
        } else if (constraintAnswer.constraintType === TIME_CONSTRAINT_TYPES.AFTER) {
            const timeAnswer = await inquirer.prompt([{
                type: 'input',
                name: 'time',
                message: `Enter earliest ${typeLabel} time (HH:MM):`,
                validate: validateTimeFormat,
                default: '09:00'
            }]);
            result.constraintTime = timeAnswer.time;
            
        } else if (constraintAnswer.constraintType === TIME_CONSTRAINT_TYPES.BETWEEN) {
            const timeRangeAnswer = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'startTime',
                    message: `Enter earliest ${typeLabel} time (HH:MM):`,
                    validate: validateTimeFormat,
                    default: '09:00'
                },
                {
                    type: 'input',
                    name: 'endTime',
                    message: `Enter latest ${typeLabel} time (HH:MM):`,
                    validate: validateTimeFormat,
                    default: '18:00'
                }
            ]);
            result.constraintTime = timeRangeAnswer.startTime;
            result.constraintTimeEnd = timeRangeAnswer.endTime;
        }
    }

    return result;
}

// Get complete time preferences for a journey leg
export async function selectTimePreferences(type = 'outbound') {
    console.log(`\n🕐 Step: ${type.charAt(0).toUpperCase() + type.slice(1)} time preferences`);
    
    const departurePrefs = await selectDepartureTimePreference(type);
    const arrivalConstraints = await selectArrivalTimeConstraint(type);
    
    return {
        departurePreference: departurePrefs.preference,
        customDepartureTime: departurePrefs.customTime,
        customDepartureTimeEnd: departurePrefs.customTimeEnd,
        arrivalConstraintType: arrivalConstraints.constraintType,
        arrivalConstraintTime: arrivalConstraints.constraintTime,
        arrivalConstraintTimeEnd: arrivalConstraints.constraintTimeEnd
    };
}

// Display selected time preferences
export function displayTimePreferences(prefs, type = 'outbound') {
    const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
    
    console.log(`\n✅ ${typeLabel} time preferences:`);
    
    // Departure preference
    if (prefs.departurePreference === TIME_PREFERENCES.CUSTOM) {
        if (prefs.customDepartureTimeEnd) {
            console.log(`   Departure: Between ${prefs.customDepartureTime} - ${prefs.customDepartureTimeEnd}`);
        } else {
            console.log(`   Departure: After ${prefs.customDepartureTime}`);
        }
    } else {
        console.log(`   Departure: ${getTimePreferenceDisplayName(prefs.departurePreference)}`);
    }
    
    // Arrival constraint
    if (prefs.arrivalConstraintType === TIME_CONSTRAINT_TYPES.ANY) {
        console.log(`   Arrival: Any time`);
    } else if (prefs.arrivalConstraintType === TIME_CONSTRAINT_TYPES.BEFORE) {
        console.log(`   Arrival: Before ${prefs.arrivalConstraintTime}`);
    } else if (prefs.arrivalConstraintType === TIME_CONSTRAINT_TYPES.AFTER) {
        console.log(`   Arrival: After ${prefs.arrivalConstraintTime}`);
    } else if (prefs.arrivalConstraintType === TIME_CONSTRAINT_TYPES.BETWEEN) {
        console.log(`   Arrival: Between ${prefs.arrivalConstraintTime} - ${prefs.arrivalConstraintTimeEnd}`);
    }
}

// Ask if user wants to set time preferences
export async function askForTimePreferences() {
    const answer = await inquirer.prompt([{
        type: 'confirm',
        name: 'useTimePreferences',
        message: 'Would you like to set time preferences for your journey?',
        default: false
    }]);
    
    return answer.useTimePreferences;
}