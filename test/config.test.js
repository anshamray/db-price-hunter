// Test suite for configuration management
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import {
    DEFAULT_CONFIG,
    loadConfig,
    saveConfig,
    validateConfig,
    addFavoriteStation,
    getCommonRoute
} from '../src/config.js';

describe('Configuration Management', () => {
    let testConfigDir;
    let testConfigFile;
    let originalEnv;

    beforeEach(() => {
        // Create temporary config directory for testing
        testConfigDir = join(tmpdir(), 'db-price-hunter-test');
        testConfigFile = join(testConfigDir, 'config.json');
        
        // Mock the config path
        originalEnv = process.env.HOME;
        process.env.HOME = tmpdir();
        
        // Clean up any existing test config
        if (existsSync(testConfigFile)) {
            unlinkSync(testConfigFile);
        }
    });

    afterEach(() => {
        // Restore environment
        if (originalEnv) {
            process.env.HOME = originalEnv;
        }
        
        // Clean up test files
        if (existsSync(testConfigFile)) {
            unlinkSync(testConfigFile);
        }
    });

    describe('loadConfig', () => {
        it('should return default config when no file exists', () => {
            const config = loadConfig();
            expect(config).toEqual(DEFAULT_CONFIG);
        });

        it('should load and merge user config', () => {
            // Create test config directory
            if (!existsSync(testConfigDir)) {
                mkdirSync(testConfigDir, { recursive: true });
            }
            
            const userConfig = {
                preferences: {
                    outputFormat: 'json',
                    maxResults: 20
                }
            };
            
            writeFileSync(testConfigFile, JSON.stringify(userConfig));
            
            const config = loadConfig();
            expect(config.preferences.outputFormat).toBe('json');
            expect(config.preferences.maxResults).toBe(20);
            expect(config.preferences.defaultTripType).toBe('same-day'); // Should keep defaults
        });
    });

    describe('validateConfig', () => {
        it('should validate correct config', () => {
            const errors = validateConfig(DEFAULT_CONFIG);
            expect(errors).toHaveLength(0);
        });

        it('should detect invalid output format', () => {
            const invalidConfig = {
                ...DEFAULT_CONFIG,
                preferences: {
                    ...DEFAULT_CONFIG.preferences,
                    outputFormat: 'invalid'
                }
            };
            
            const errors = validateConfig(invalidConfig);
            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0]).toContain('Invalid output format');
        });

        it('should detect invalid max results', () => {
            const invalidConfig = {
                ...DEFAULT_CONFIG,
                preferences: {
                    ...DEFAULT_CONFIG.preferences,
                    maxResults: 100
                }
            };
            
            const errors = validateConfig(invalidConfig);
            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0]).toContain('maxResults must be between 1 and 50');
        });
    });

    describe('addFavoriteStation', () => {
        it('should add new favorite station', () => {
            const config = { ...DEFAULT_CONFIG };
            const station = { id: '8011160', name: 'Berlin Hbf' };
            
            const result = addFavoriteStation(config, station);
            
            expect(result).toBe(true);
            expect(config.favoriteStations).toContain(station);
        });

        it('should not add duplicate stations', () => {
            const config = { ...DEFAULT_CONFIG };
            const station = { id: '8011160', name: 'Berlin Hbf' };
            
            addFavoriteStation(config, station);
            const result = addFavoriteStation(config, station);
            
            expect(result).toBe(false);
            expect(config.favoriteStations).toHaveLength(1);
        });
    });

    describe('getCommonRoute', () => {
        it('should return existing route', () => {
            const route = getCommonRoute(DEFAULT_CONFIG, 'berlin-munich');
            expect(route).toBeDefined();
            expect(route.departure.name).toBe('Berlin Hbf');
            expect(route.destination.name).toBe('München Hbf');
        });

        it('should return null for non-existent route', () => {
            const route = getCommonRoute(DEFAULT_CONFIG, 'non-existent');
            expect(route).toBeNull();
        });
    });
});