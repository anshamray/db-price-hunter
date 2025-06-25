// Command-line argument parsing for DB Price Analyzer
import { parseArgs } from 'util';

// Define command-line options
export const CLI_OPTIONS = {
    help: {
        type: 'boolean',
        short: 'h',
        description: 'Show help information'
    },
    version: {
        type: 'boolean',
        short: 'v',
        description: 'Show version information'
    },
    config: {
        type: 'string',
        short: 'c',
        description: 'Path to configuration file'
    },
    from: {
        type: 'string',
        short: 'f',
        description: 'Departure station (station ID or name)'
    },
    to: {
        type: 'string',
        short: 't',
        description: 'Destination station (station ID or name)'
    },
    date: {
        type: 'string',
        short: 'd',
        description: 'Travel date (YYYY-MM-DD or MM-DD)'
    },
    'end-date': {
        type: 'string',
        description: 'End date for date range (YYYY-MM-DD or MM-DD)'
    },
    'return-date': {
        type: 'string',
        description: 'Return date for multi-day trips (YYYY-MM-DD or MM-DD)'
    },
    'days': {
        type: 'string',
        description: 'Number of nights to stay (1-365). E.g., "2" = arrive Mon, return Wed (2 nights)'
    },
    'return-from': {
        type: 'string',
        description: 'Return departure station (different from destination)'
    },
    'trip-type': {
        type: 'string',
        description: 'Trip type: same-day, multi-day, or one-way'
    },
    route: {
        type: 'string',
        short: 'r',
        description: 'Use predefined route (e.g., berlin-munich)'
    },
    output: {
        type: 'string',
        short: 'o',
        description: 'Output format: console, table, json, csv'
    },
    'output-file': {
        type: 'string',
        description: 'Save results to file'
    },
    quiet: {
        type: 'boolean',
        short: 'q',
        description: 'Suppress non-essential output'
    },
    verbose: {
        type: 'boolean',
        description: 'Enable verbose output'
    },
    'max-results': {
        type: 'string',
        description: 'Maximum number of results to show'
    },
    'no-time-prefs': {
        type: 'boolean',
        description: 'Skip time preference prompts'
    },
    'early': {
        type: 'boolean',
        description: 'Prefer early departures (04:00-07:59). Can combine with another for return.'
    },
    'morning': {
        type: 'boolean',
        description: 'Prefer morning departures (08:00-11:59). Can combine with another for return.'
    },
    'afternoon': {
        type: 'boolean',
        description: 'Prefer afternoon departures (12:00-17:59). Can combine with another for return.'
    },
    'evening': {
        type: 'boolean',
        description: 'Prefer evening departures (18:00-21:59). Can combine with another for return.'
    },
    'late': {
        type: 'boolean',
        description: 'Prefer late departures (22:00-03:59). Can combine with another for return.'
    },
    'list-routes': {
        type: 'boolean',
        description: 'List all available predefined routes'
    },
    'list-favorites': {
        type: 'boolean',
        description: 'List favorite stations'
    },
    'add-favorite': {
        type: 'string',
        description: 'Add a station to favorites (station ID)'
    },
    'remove-favorite': {
        type: 'string',
        description: 'Remove a station from favorites (station ID)'
    },
    'no-animations': {
        type: 'boolean',
        description: 'Disable fun train emoji animations'
    },
    'train-animations': {
        type: 'boolean',
        description: 'Enable fun train emoji animations (default: true)'
    },
    'concurrency': {
        type: 'string',
        description: 'Number of parallel searches (1-8, default: 3). Higher = faster but more API load'
    },
    'save-search': {
        type: 'string',
        description: 'Save current search parameters with a name for later reuse'
    },
    'load-search': {
        type: 'string',
        description: 'Load and execute a previously saved search'
    },
    'list-searches': {
        type: 'boolean',
        description: 'List all saved searches'
    },
    'delete-search': {
        type: 'string',
        description: 'Delete a saved search by name'
    }
};

// Parse command-line arguments
export function parseCliArgs() {
    try {
        const { values, positionals } = parseArgs({
            options: CLI_OPTIONS,
            allowPositionals: true
        });
        
        return {
            options: values,
            positionals,
            success: true
        };
    } catch (error) {
        return {
            error: error.message,
            success: false
        };
    }
}

// Show help information
export function showHelp() {
    console.log(`
🎯 DB Price Hunter - Hunt for the Best Train Deals

USAGE:
  db-price-analyzer [OPTIONS]
  db-price-analyzer --from "Berlin Hbf" --to "München Hbf" --date 2025-08-15
  db-price-analyzer --route berlin-munich --date 08-15

OPTIONS:
`);

    // Group options by category
    const categories = {
        'General': ['help', 'version', 'config', 'quiet', 'verbose'],
        'Route Selection': ['from', 'to', 'route', 'list-routes'],
        'Trip Configuration': ['date', 'end-date', 'return-date', 'days', 'return-from', 'trip-type'],
        'Time Preferences': ['no-time-prefs', 'early', 'morning', 'afternoon', 'evening', 'late'],
        'Output Options': ['output', 'output-file', 'max-results'],
        'Favorites Management': ['list-favorites', 'add-favorite', 'remove-favorite'],
        'Saved Searches': ['save-search', 'load-search', 'list-searches', 'delete-search'],
        'Performance Options': ['concurrency'],
        'Animation Options': ['no-animations', 'train-animations']
    };

    for (const [category, optionNames] of Object.entries(categories)) {
        console.log(`  ${category}:`);
        for (const optionName of optionNames) {
            const option = CLI_OPTIONS[optionName];
            if (option) {
                const short = option.short ? `-${option.short}, ` : '    ';
                const name = `--${optionName}`;
                const type = option.type === 'boolean' ? '' : ' <value>';
                console.log(`    ${short}${name}${type.padEnd(20)} ${option.description}`);
            }
        }
        console.log('');
    }

    console.log(`EXAMPLES:
  # Interactive mode
  db-price-analyzer

  # Quick search with predefined route
  db-price-analyzer --route berlin-munich --date 08-15

  # Specific stations with time preference
  db-price-analyzer --from "8011160" --to "8000261" --date 2025-08-15 --morning

  # Export results to JSON
  db-price-analyzer --from "Berlin" --to "Munich" --date 08-15 --output json --output-file results.json

  # Same-day trip with different time preferences for outbound/return
  db-price-analyzer --route berlin-munich --date 08-15 --trip-type same-day --early --evening

  # Flexible duration: 3-night stay (arrive Mon, return Thu)
  db-price-analyzer --route berlin-munich --date 08-30 --end-date 09-30 --trip-type multi-day --days 3

  # Save and reuse searches
  db-price-analyzer --route berlin-munich --date 08-15 --save-search "weekend-trip"
  db-price-analyzer --load-search "weekend-trip"
  db-price-analyzer --list-searches

  # List available routes
  db-price-analyzer --list-routes

For more information, visit: https://github.com/your-repo/db-price-hunter
`);
}

// Show version information
export function showVersion() {
    console.log(`DB Price Hunter v1.4.0
Built with db-vendo-client
Node.js ${process.version}
Platform: ${process.platform}`);
}

// Validate command-line arguments
export function validateCliArgs(options) {
    const errors = [];
    
    // Check trip type
    if (options['trip-type']) {
        const validTripTypes = ['same-day', 'multi-day', 'one-way'];
        if (!validTripTypes.includes(options['trip-type'])) {
            errors.push(`Invalid trip type: ${options['trip-type']}. Must be one of: ${validTripTypes.join(', ')}`);
        }
    }
    
    // Check output format
    if (options.output) {
        const validFormats = ['console', 'table', 'json', 'csv'];
        if (!validFormats.includes(options.output)) {
            errors.push(`Invalid output format: ${options.output}. Must be one of: ${validFormats.join(', ')}`);
        }
    }
    
    // Check max results
    if (options['max-results']) {
        const maxResults = parseInt(options['max-results']);
        if (isNaN(maxResults) || maxResults < 1 || maxResults > 50) {
            errors.push('max-results must be a number between 1 and 50');
        }
    }
    
    // Check that from/to are provided together (if using direct station specification)
    if ((options.from && !options.to) || (!options.from && options.to)) {
        if (!options.route) {
            errors.push('Both --from and --to must be specified, or use --route for predefined routes');
        }
    }
    
    // Check for conflicting time preferences
    const timePrefs = ['early', 'morning', 'afternoon', 'evening', 'late'];
    const selectedTimePrefs = timePrefs.filter(pref => options[pref]);
    
    // For same-day and multi-day trips, allow up to 2 time preferences (outbound + return)
    // For one-way trips, allow only 1
    const maxTimePrefs = options['trip-type'] === 'one-way' ? 1 : 2;
    
    if (selectedTimePrefs.length > maxTimePrefs) {
        if (maxTimePrefs === 1) {
            errors.push(`Only one time preference can be specified for one-way trips. Found: ${selectedTimePrefs.join(', ')}`);
        } else {
            errors.push(`Maximum ${maxTimePrefs} time preferences can be specified. Found: ${selectedTimePrefs.join(', ')}`);
        }
    }
    
    return errors;
}

// Convert CLI options to application configuration
export function cliToConfig(options, config) {
    const updates = {};
    
    // Map CLI options to config
    if (options.output) {
        updates.outputFormat = options.output;
    }
    
    if (options['max-results']) {
        updates.maxResults = parseInt(options['max-results']);
    }
    
    if (options['trip-type']) {
        updates.defaultTripType = options['trip-type'];
    }
    
    if (options['no-time-prefs']) {
        updates.useTimePreferences = false;
    }
    
    if (options.quiet) {
        updates.quietMode = true;
    }
    
    if (options.verbose) {
        updates.verboseMode = true;
    }
    
    if (options['no-animations']) {
        updates.useTrainAnimations = false;
    }
    
    if (options['train-animations']) {
        updates.useTrainAnimations = true;
    }
    
    if (options.concurrency) {
        const concurrency = parseInt(options.concurrency);
        if (!isNaN(concurrency) && concurrency >= 1 && concurrency <= 8) {
            updates.maxConcurrency = concurrency;
        }
    }
    
    // Update config preferences
    config.preferences = { ...config.preferences, ...updates };
    
    return config;
}

// Get time preference from CLI arguments
export function getTimePreferenceFromCli(options) {
    const timePrefs = {
        early: 'early',
        morning: 'morning', 
        afternoon: 'afternoon',
        evening: 'evening',
        late: 'late'
    };
    
    const selectedPrefs = [];
    for (const [option, preference] of Object.entries(timePrefs)) {
        if (options[option]) {
            selectedPrefs.push(preference);
        }
    }
    
    if (selectedPrefs.length === 0) {
        return null;
    }
    
    if (selectedPrefs.length === 1) {
        // Single preference - use for both outbound and return
        return {
            departurePreference: selectedPrefs[0],
            arrivalConstraintType: 'any'
        };
    }
    
    if (selectedPrefs.length === 2) {
        // Two preferences for multi-day trips - first for outbound, second for return
        return {
            outbound: {
                departurePreference: selectedPrefs[0],
                arrivalConstraintType: 'any'
            },
            return: {
                departurePreference: selectedPrefs[1], 
                arrivalConstraintType: 'any'
            }
        };
    }
    
    return null;
}