// Search management functionality for DB Price Analyzer
import { 
    loadConfig, 
    saveConfig, 
    saveSearch, 
    loadSearch, 
    listSavedSearches, 
    deleteSavedSearch 
} from './config.js';
import { formatStationDisplay } from './station-selector.js';

// Save current search parameters
export function saveCurrentSearch(searchName, searchParams) {
    const config = loadConfig();
    
    // Extract saveable parameters
    const saveableParams = {
        departureStation: searchParams.departureStation,
        destinationStation: searchParams.destinationStation,
        returnDepartureStation: searchParams.returnDepartureStation,
        tripType: searchParams.tripType,
        dates: searchParams.dates,
        timePreferences: searchParams.timePreferences,
        maxResults: searchParams.maxResults,
        outputFormat: searchParams.outputFormat
    };
    
    saveSearch(config, searchName, saveableParams);
    
    if (saveConfig(config)) {
        console.log(`✅ Search saved as "${searchName}"`);
        return true;
    } else {
        console.log(`❌ Failed to save search "${searchName}"`);
        return false;
    }
}

// Load and return saved search parameters
export function loadSavedSearch(searchName) {
    const config = loadConfig();
    const savedSearch = loadSearch(config, searchName);
    
    if (!savedSearch) {
        console.log(`❌ Search "${searchName}" not found`);
        return null;
    }
    
    console.log(`✅ Loaded search "${searchName}"`);
    return savedSearch;
}

// Display all saved searches
export function displaySavedSearches() {
    const config = loadConfig();
    const searches = listSavedSearches(config);
    
    if (searches.length === 0) {
        console.log('📭 No saved searches found');
        return;
    }
    
    console.log('\n💾 Saved Searches:');
    console.log('='.repeat(50));
    
    searches.forEach(search => {
        console.log(`\n📌 ${search.name}`);
        console.log(`   Route: ${formatStationDisplay(search.departureStation)} → ${formatStationDisplay(search.destinationStation)}`);
        
        if (search.returnDepartureStation && search.returnDepartureStation.id !== search.destinationStation.id) {
            console.log(`   Return: ${formatStationDisplay(search.returnDepartureStation)} → ${formatStationDisplay(search.departureStation)}`);
        }
        
        console.log(`   Trip Type: ${search.tripType}`);
        
        if (search.dates && search.dates.length > 0) {
            if (search.dates.length === 1) {
                console.log(`   Date: ${search.dates[0]}`);
            } else {
                console.log(`   Date Range: ${search.dates[0]} to ${search.dates[search.dates.length - 1]} (${search.dates.length} dates)`);
            }
        }
        
        if (search.timePreferences && search.timePreferences.outbound && search.timePreferences.outbound.departurePreference !== 'any') {
            console.log(`   Time Preference: ${search.timePreferences.outbound.departurePreference}`);
        }
        
        console.log(`   Saved: ${new Date(search.savedAt).toLocaleDateString()}`);
    });
    
    console.log('\n' + '='.repeat(50));
    console.log(`Total: ${searches.length} saved search${searches.length === 1 ? '' : 'es'}`);
}

// Delete a saved search
export function deleteSavedSearchByName(searchName) {
    const config = loadConfig();
    
    if (deleteSavedSearch(config, searchName)) {
        if (saveConfig(config)) {
            console.log(`✅ Deleted search "${searchName}"`);
            return true;
        } else {
            console.log(`❌ Failed to save changes after deleting "${searchName}"`);
            return false;
        }
    } else {
        console.log(`❌ Search "${searchName}" not found`);
        return false;
    }
}

// Validate search name
export function validateSearchName(name) {
    if (!name || typeof name !== 'string') {
        return 'Search name must be a non-empty string';
    }
    
    if (name.length < 1 || name.length > 50) {
        return 'Search name must be between 1 and 50 characters';
    }
    
    // Check for invalid characters
    const invalidChars = /[<>:"/\\|?*]/;
    if (invalidChars.test(name)) {
        return 'Search name contains invalid characters. Avoid: < > : " / \\ | ? *';
    }
    
    return null; // Valid
}

// Check if search name already exists
export function searchNameExists(searchName) {
    const config = loadConfig();
    return loadSearch(config, searchName) !== null;
}

// Get search names for autocomplete/suggestions
export function getSearchNames() {
    const config = loadConfig();
    const searches = listSavedSearches(config);
    return searches.map(search => search.name);
}

// Convert saved search parameters to format expected by main app
export function convertSavedSearchToParams(savedSearch) {
    return {
        departureStation: savedSearch.departureStation,
        destinationStation: savedSearch.destinationStation,
        returnDepartureStation: savedSearch.returnDepartureStation,
        tripType: savedSearch.tripType || 'same-day',
        dates: savedSearch.dates || [],
        timePreferences: savedSearch.timePreferences || {
            outbound: { departurePreference: 'any', arrivalConstraintType: 'any' },
            return: { departurePreference: 'any', arrivalConstraintType: 'any' }
        },
        maxResults: savedSearch.maxResults || 10,
        outputFormat: savedSearch.outputFormat || 'console'
    };
}