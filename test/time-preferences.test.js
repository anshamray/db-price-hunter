// Test suite for time preferences functionality
import { describe, it, expect } from 'vitest';
import {
    TIME_PREFERENCES,
    TIME_CONSTRAINT_TYPES,
    parseTimeToMinutes,
    minutesToTimeString,
    timeMatchesPreference,
    arrivalMeetsConstraint,
    filterJourneysByTime
} from '../src/time-preferences.js';

describe('Time Preferences', () => {
    describe('parseTimeToMinutes', () => {
        it('should parse valid time strings', () => {
            expect(parseTimeToMinutes('08:30')).toBe(510);
            expect(parseTimeToMinutes('00:00')).toBe(0);
            expect(parseTimeToMinutes('23:59')).toBe(1439);
        });

        it('should handle invalid input', () => {
            expect(parseTimeToMinutes('25:00')).toBeNull();
            expect(parseTimeToMinutes('08:60')).toBeNull();
            expect(parseTimeToMinutes('invalid')).toBeNull();
        });
    });

    describe('timeMatchesPreference', () => {
        it('should match early preference (04:00-07:59)', () => {
            expect(timeMatchesPreference(300, TIME_PREFERENCES.EARLY)).toBe(true); // 05:00
            expect(timeMatchesPreference(479, TIME_PREFERENCES.EARLY)).toBe(true); // 07:59
            expect(timeMatchesPreference(480, TIME_PREFERENCES.EARLY)).toBe(false); // 08:00
        });

        it('should match morning preference (08:00-11:59)', () => {
            expect(timeMatchesPreference(480, TIME_PREFERENCES.MORNING)).toBe(true); // 08:00
            expect(timeMatchesPreference(719, TIME_PREFERENCES.MORNING)).toBe(true); // 11:59
            expect(timeMatchesPreference(720, TIME_PREFERENCES.MORNING)).toBe(false); // 12:00
        });

        it('should handle custom time ranges', () => {
            expect(timeMatchesPreference(540, TIME_PREFERENCES.CUSTOM, '09:00', '17:00')).toBe(true); // 09:00
            expect(timeMatchesPreference(1020, TIME_PREFERENCES.CUSTOM, '09:00', '17:00')).toBe(true); // 17:00
            expect(timeMatchesPreference(1021, TIME_PREFERENCES.CUSTOM, '09:00', '17:00')).toBe(false); // 17:01
        });
    });

    describe('filterJourneysByTime', () => {
        const mockJourneys = [
            {
                legs: [
                    { plannedDeparture: '2025-08-15T06:30:00', departure: '2025-08-15T06:30:00' },
                    { plannedArrival: '2025-08-15T10:30:00', arrival: '2025-08-15T10:30:00' }
                ]
            },
            {
                legs: [
                    { plannedDeparture: '2025-08-15T14:30:00', departure: '2025-08-15T14:30:00' },
                    { plannedArrival: '2025-08-15T18:30:00', arrival: '2025-08-15T18:30:00' }
                ]
            }
        ];

        it('should filter journeys by early preference', () => {
            const preferences = { departurePreference: TIME_PREFERENCES.EARLY };
            const filtered = filterJourneysByTime(mockJourneys, preferences);
            expect(filtered).toHaveLength(1);
            expect(filtered[0].legs[0].plannedDeparture).toBe('2025-08-15T06:30:00');
        });

        it('should filter journeys by afternoon preference', () => {
            const preferences = { departurePreference: TIME_PREFERENCES.AFTERNOON };
            const filtered = filterJourneysByTime(mockJourneys, preferences);
            expect(filtered).toHaveLength(1);
            expect(filtered[0].legs[0].plannedDeparture).toBe('2025-08-15T14:30:00');
        });
    });
});