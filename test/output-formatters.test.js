// Test suite for output formatting
import { describe, it, expect } from 'vitest';
import {
    formatAsJson,
    formatAsCsv,
    ProgressIndicator,
    DateProgressIndicator
} from '../src/output-formatters.js';

describe('Output Formatters', () => {
    const mockResults = [
        {
            date: 'Mon, Aug 15, 2025',
            totalPrice: 89.90,
            outbound: {
                trainName: 'ICE 587',
                departure: '2025-08-15T08:34:00',
                arrival: '2025-08-15T12:28:00',
                transfers: 0,
                price: 44.95,
                allTrains: ['ICE 587']
            },
            return: {
                trainName: 'ICE 1006',
                departure: '2025-08-15T18:32:00',
                arrival: '2025-08-15T22:28:00',
                transfers: 0,
                price: 44.95,
                allTrains: ['ICE 1006']
            }
        }
    ];

    describe('formatAsJson', () => {
        it('should format same-day results as JSON', () => {
            const json = formatAsJson(mockResults, 'same-day', 'Berlin Hbf', 'München Hbf');
            const parsed = JSON.parse(json);
            
            expect(parsed.metadata.tripType).toBe('same-day');
            expect(parsed.metadata.route.departure).toBe('Berlin Hbf');
            expect(parsed.metadata.route.destination).toBe('München Hbf');
            expect(parsed.results).toHaveLength(1);
            expect(parsed.results[0].totalPrice).toBe(89.90);
            expect(parsed.results[0].outbound.trainName).toBe('ICE 587');
        });

        it('should include return departure city when different', () => {
            const json = formatAsJson(mockResults, 'same-day', 'Berlin Hbf', 'München Hbf', 'Dortmund Hbf');
            const parsed = JSON.parse(json);
            
            expect(parsed.metadata.route.returnDeparture).toBe('Dortmund Hbf');
        });
    });

    describe('formatAsCsv', () => {
        it('should format same-day results as CSV', () => {
            const csv = formatAsCsv(mockResults, 'same-day');
            const lines = csv.split('\n');
            
            expect(lines[0]).toContain('Date,Outbound Train,Outbound Departure');
            expect(lines[1]).toContain('Mon, Aug 15, 2025');
            expect(lines[1]).toContain('ICE 587');
            expect(lines[1]).toContain('89.90');
        });

        it('should handle one-way trips', () => {
            const oneWayResults = [{
                date: 'Mon, Aug 15, 2025',
                totalPrice: 44.95,
                journey: {
                    trainName: 'ICE 587',
                    departure: '2025-08-15T08:34:00',
                    arrival: '2025-08-15T12:28:00',
                    transfers: 0,
                    price: 44.95
                }
            }];
            
            const csv = formatAsCsv(oneWayResults, 'one-way');
            const lines = csv.split('\n');
            
            expect(lines[0]).toBe('Date,Train,Departure,Arrival,Transfers,Price');
            expect(lines[1]).toContain('ICE 587');
            expect(lines[1]).toContain('44.95');
        });
    });

    describe('ProgressIndicator', () => {
        it('should create progress indicator with train animation', () => {
            const progress = new ProgressIndicator('Testing', true, true);
            expect(progress.useTrainAnimation).toBe(true);
            expect(progress.message).toBe('Testing');
            expect(progress.currentAnimation).toBeDefined();
        });

        it('should create progress indicator without animation', () => {
            const progress = new ProgressIndicator('Testing', true, false);
            expect(progress.useTrainAnimation).toBe(false);
            expect(progress.spinnerChars).toBeDefined();
        });
    });

    describe('DateProgressIndicator', () => {
        it('should create date progress indicator', () => {
            const dateProgress = new DateProgressIndicator('Mon, Aug 15, 2025', true);
            expect(dateProgress.dateStr).toBe('Mon, Aug 15, 2025');
            expect(dateProgress.showAnimation).toBe(true);
            expect(dateProgress.currentTrain).toBeDefined();
            expect(['🚅', '🚄', '🚈', '🚇', '🚆']).toContain(dateProgress.currentTrain);
        });

        it('should handle animation disabled', () => {
            const dateProgress = new DateProgressIndicator('Mon, Aug 15, 2025', false);
            expect(dateProgress.showAnimation).toBe(false);
        });
    });
});