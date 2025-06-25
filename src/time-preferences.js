// Time preference constants and utilities

export const TIME_PREFERENCES = {
    EARLY: 'early',        // 04:00-07:59
    MORNING: 'morning',    // 08:00-11:59
    AFTERNOON: 'afternoon', // 12:00-17:59
    EVENING: 'evening',    // 18:00-21:59
    LATE: 'late',          // 22:00-03:59
    CUSTOM: 'custom',      // User-defined time
    ANY: 'any'             // No preference
};

export const TIME_CONSTRAINT_TYPES = {
    BEFORE: 'before',      // Before specific time
    AFTER: 'after',        // After specific time
    BETWEEN: 'between',    // Between two times
    ANY: 'any'             // No constraint
};

// Predefined time ranges
export const TIME_RANGES = {
    [TIME_PREFERENCES.EARLY]: { start: '04:00', end: '07:59' },
    [TIME_PREFERENCES.MORNING]: { start: '08:00', end: '11:59' },
    [TIME_PREFERENCES.AFTERNOON]: { start: '12:00', end: '17:59' },
    [TIME_PREFERENCES.EVENING]: { start: '18:00', end: '21:59' },
    [TIME_PREFERENCES.LATE]: { start: '22:00', end: '03:59' }
};

// Parse time string (HH:MM) to minutes since midnight
export function parseTimeToMinutes(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return null;
    
    const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    
    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    
    return hours * 60 + minutes;
}

// Convert minutes since midnight to time string (HH:MM)
export function minutesToTimeString(minutes) {
    if (minutes < 0 || minutes >= 24 * 60) return null;
    
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

// Extract time from ISO date string
export function extractTimeFromDate(dateStr) {
    const date = new Date(dateStr);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    return hours * 60 + minutes;
}

// Validate time string format (HH:MM)
export function validateTimeFormat(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') {
        return 'Please enter a time';
    }
    
    const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) {
        return 'Please enter time in HH:MM format (e.g., 09:30)';
    }
    
    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    
    if (hours < 0 || hours > 23) {
        return 'Hours must be between 00 and 23';
    }
    
    if (minutes < 0 || minutes > 59) {
        return 'Minutes must be between 00 and 59';
    }
    
    return true;
}

// Check if a time falls within a preference range
export function timeMatchesPreference(timeMinutes, preference, customTime = null, customTimeEnd = null) {
    if (preference === TIME_PREFERENCES.ANY) return true;
    
    if (preference === TIME_PREFERENCES.CUSTOM) {
        if (!customTime) return true;
        
        const customMinutes = parseTimeToMinutes(customTime);
        if (customMinutes === null) return true;
        
        if (customTimeEnd) {
            const customEndMinutes = parseTimeToMinutes(customTimeEnd);
            if (customEndMinutes === null) return timeMinutes >= customMinutes;
            
            // Handle overnight ranges (e.g., 22:00-04:00)
            if (customEndMinutes < customMinutes) {
                return timeMinutes >= customMinutes || timeMinutes <= customEndMinutes;
            } else {
                return timeMinutes >= customMinutes && timeMinutes <= customEndMinutes;
            }
        } else {
            return timeMinutes >= customMinutes;
        }
    }
    
    const range = TIME_RANGES[preference];
    if (!range) return true;
    
    const startMinutes = parseTimeToMinutes(range.start);
    const endMinutes = parseTimeToMinutes(range.end);
    
    if (startMinutes === null || endMinutes === null) return true;
    
    // Handle overnight ranges (like "late": 22:00-04:59)
    if (endMinutes < startMinutes) {
        return timeMinutes >= startMinutes || timeMinutes <= endMinutes;
    } else {
        return timeMinutes >= startMinutes && timeMinutes <= endMinutes;
    }
}

// Check if arrival time meets constraint
export function arrivalMeetsConstraint(arrivalMinutes, constraintType, constraintTime, constraintTimeEnd = null) {
    if (constraintType === TIME_CONSTRAINT_TYPES.ANY) return true;
    
    const constraintMinutes = parseTimeToMinutes(constraintTime);
    if (constraintMinutes === null) return true;
    
    switch (constraintType) {
        case TIME_CONSTRAINT_TYPES.BEFORE:
            return arrivalMinutes <= constraintMinutes;
            
        case TIME_CONSTRAINT_TYPES.AFTER:
            return arrivalMinutes >= constraintMinutes;
            
        case TIME_CONSTRAINT_TYPES.BETWEEN:
            if (!constraintTimeEnd) return arrivalMinutes >= constraintMinutes;
            
            const endMinutes = parseTimeToMinutes(constraintTimeEnd);
            if (endMinutes === null) return arrivalMinutes >= constraintMinutes;
            
            // Handle overnight ranges
            if (endMinutes < constraintMinutes) {
                return arrivalMinutes >= constraintMinutes || arrivalMinutes <= endMinutes;
            } else {
                return arrivalMinutes >= constraintMinutes && arrivalMinutes <= endMinutes;
            }
            
        default:
            return true;
    }
}

// Filter journeys based on time preferences
export function filterJourneysByTime(journeys, preferences) {
    return journeys.filter(journey => {
        if (!journey.legs || journey.legs.length === 0) return false;
        
        const firstLeg = journey.legs[0];
        const lastLeg = journey.legs[journey.legs.length - 1];
        
        const departureTime = extractTimeFromDate(firstLeg.plannedDeparture || firstLeg.departure);
        const arrivalTime = extractTimeFromDate(lastLeg.plannedArrival || lastLeg.arrival);
        
        // Check departure time preference
        if (preferences.departurePreference) {
            const departureMatches = timeMatchesPreference(
                departureTime,
                preferences.departurePreference,
                preferences.customDepartureTime,
                preferences.customDepartureTimeEnd
            );
            if (!departureMatches) return false;
        }
        
        // Check arrival time constraint
        if (preferences.arrivalConstraintType && preferences.arrivalConstraintType !== TIME_CONSTRAINT_TYPES.ANY) {
            const arrivalMatches = arrivalMeetsConstraint(
                arrivalTime,
                preferences.arrivalConstraintType,
                preferences.arrivalConstraintTime,
                preferences.arrivalConstraintTimeEnd
            );
            if (!arrivalMatches) return false;
        }
        
        return true;
    });
}

// Get display name for time preference
export function getTimePreferenceDisplayName(preference) {
    const names = {
        [TIME_PREFERENCES.EARLY]: 'Early (04:00-07:59)',
        [TIME_PREFERENCES.MORNING]: 'Morning (08:00-11:59)',
        [TIME_PREFERENCES.AFTERNOON]: 'Afternoon (12:00-17:59)',
        [TIME_PREFERENCES.EVENING]: 'Evening (18:00-21:59)',
        [TIME_PREFERENCES.LATE]: 'Late (22:00-03:59)',
        [TIME_PREFERENCES.CUSTOM]: 'Custom time',
        [TIME_PREFERENCES.ANY]: 'Any time'
    };
    return names[preference] || preference;
}

// Get display name for time constraint
export function getTimeConstraintDisplayName(constraintType) {
    const names = {
        [TIME_CONSTRAINT_TYPES.BEFORE]: 'Before specific time',
        [TIME_CONSTRAINT_TYPES.AFTER]: 'After specific time',
        [TIME_CONSTRAINT_TYPES.BETWEEN]: 'Between two times',
        [TIME_CONSTRAINT_TYPES.ANY]: 'Any time'
    };
    return names[constraintType] || constraintType;
}