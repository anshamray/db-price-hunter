// Configuration management for DB Price Analyzer
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Default configuration
export const DEFAULT_CONFIG = {
    // Default preferences
    preferences: {
        outputFormat: 'console', // console, table, json, csv
        maxResults: 10,
        defaultTripType: 'same-day',
        useTimePreferences: false,
        searchTimeout: 300000, // 5 minutes for full search
        dateSearchTimeout: 60000, // 1 minute per individual date
        retryAttempts: 3,
        dateRetryAttempts: 2, // Retry individual dates
        delayBetweenRequests: 3000, // 3 seconds
        delayBetweenRetries: 5000, // 5 seconds between retries
        useTrainAnimations: true, // Fun train emoji animations
        animationSpeed: 200, // milliseconds between animation frames
        maxConcurrency: 3 // Maximum parallel searches (1-5 recommended)
    },
    
    // Common routes for quick access
    commonRoutes: {
        'berlin-munich': {
            departure: { id: '8011160', name: 'Berlin Hbf' },
            destination: { id: '8000261', name: 'München Hbf' }
        },
        'hamburg-frankfurt': {
            departure: { id: '8002549', name: 'Hamburg Hbf' },
            destination: { id: '8000105', name: 'Frankfurt(Main)Hbf' }
        },
        'cologne-dortmund': {
            departure: { id: '8000207', name: 'Köln Hbf' },
            destination: { id: '8000080', name: 'Dortmund Hbf' }
        },
        'berlin-cologne': {
            departure: { id: '8011160', name: 'Berlin Hbf' },
            destination: { id: '8000207', name: 'Köln Hbf' }
        }
    },
    
    // User's favorite stations
    favoriteStations: [],
    
    // Saved searches for reuse
    savedSearches: {},
    
    // Default time preferences
    defaultTimePreferences: {
        outbound: {
            departurePreference: 'any',
            arrivalConstraintType: 'any'
        },
        return: {
            departurePreference: 'any',
            arrivalConstraintType: 'any'
        }
    }
};

// Configuration file path - store in project directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');
const CONFIG_DIR = join(PROJECT_ROOT, 'config');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

// Load configuration from file
export function loadConfig() {
    try {
        if (existsSync(CONFIG_FILE)) {
            const configData = readFileSync(CONFIG_FILE, 'utf8');
            const userConfig = JSON.parse(configData);
            
            // Merge with defaults (deep merge)
            return mergeConfig(DEFAULT_CONFIG, userConfig);
        }
    } catch (error) {
        console.warn(`⚠️  Warning: Could not load config file: ${error.message}`);
        console.warn('Using default configuration...');
    }
    
    return { ...DEFAULT_CONFIG };
}

// Save configuration to file
export function saveConfig(config) {
    try {
        // Ensure config directory exists
        if (!existsSync(CONFIG_DIR)) {
            mkdirSync(CONFIG_DIR, { recursive: true });
        }
        
        writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
        return true;
    } catch (error) {
        console.error(`❌ Error saving configuration: ${error.message}`);
        return false;
    }
}

// Deep merge two configuration objects
function mergeConfig(defaultConfig, userConfig) {
    const merged = { ...defaultConfig };
    
    for (const key in userConfig) {
        if (userConfig[key] && typeof userConfig[key] === 'object' && !Array.isArray(userConfig[key])) {
            merged[key] = mergeConfig(defaultConfig[key] || {}, userConfig[key]);
        } else {
            merged[key] = userConfig[key];
        }
    }
    
    return merged;
}

// Add a favorite station
export function addFavoriteStation(config, station) {
    if (!config.favoriteStations.find(fav => fav.id === station.id)) {
        config.favoriteStations.push(station);
        return true;
    }
    return false;
}

// Remove a favorite station
export function removeFavoriteStation(config, stationId) {
    const index = config.favoriteStations.findIndex(fav => fav.id === stationId);
    if (index !== -1) {
        config.favoriteStations.splice(index, 1);
        return true;
    }
    return false;
}

// Add a common route
export function addCommonRoute(config, routeName, departure, destination) {
    config.commonRoutes[routeName] = {
        departure,
        destination
    };
}

// Get common route by name
export function getCommonRoute(config, routeName) {
    return config.commonRoutes[routeName] || null;
}

// List all common routes
export function listCommonRoutes(config) {
    return Object.keys(config.commonRoutes).map(name => ({
        name,
        ...config.commonRoutes[name]
    }));
}

// Update user preferences
export function updatePreferences(config, newPreferences) {
    config.preferences = { ...config.preferences, ...newPreferences };
}

// Validate configuration
export function validateConfig(config) {
    const errors = [];
    
    // Validate output format
    const validFormats = ['console', 'table', 'json', 'csv'];
    if (!validFormats.includes(config.preferences.outputFormat)) {
        errors.push(`Invalid output format: ${config.preferences.outputFormat}. Must be one of: ${validFormats.join(', ')}`);
    }
    
    // Validate trip type
    const validTripTypes = ['same-day', 'multi-day', 'one-way'];
    if (!validTripTypes.includes(config.preferences.defaultTripType)) {
        errors.push(`Invalid default trip type: ${config.preferences.defaultTripType}. Must be one of: ${validTripTypes.join(', ')}`);
    }
    
    // Validate numeric values
    if (config.preferences.maxResults < 1 || config.preferences.maxResults > 50) {
        errors.push('maxResults must be between 1 and 50');
    }
    
    if (config.preferences.searchTimeout < 30000 || config.preferences.searchTimeout > 600000) {
        errors.push('searchTimeout must be between 30 seconds and 10 minutes');
    }
    
    return errors;
}

// Save a search for later reuse
export function saveSearch(config, searchName, searchParams) {
    config.savedSearches[searchName] = {
        ...searchParams,
        savedAt: new Date().toISOString()
    };
}

// Load a saved search
export function loadSearch(config, searchName) {
    return config.savedSearches[searchName] || null;
}

// List all saved searches
export function listSavedSearches(config) {
    return Object.keys(config.savedSearches).map(name => ({
        name,
        ...config.savedSearches[name]
    }));
}

// Delete a saved search
export function deleteSavedSearch(config, searchName) {
    if (config.savedSearches[searchName]) {
        delete config.savedSearches[searchName];
        return true;
    }
    return false;
}

// Get configuration file path for display
export function getConfigPath() {
    return CONFIG_FILE;
}