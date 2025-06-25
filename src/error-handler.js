// Enhanced error handling for DB Price Analyzer
import { ProgressIndicator } from './output-formatters.js';

// Custom error types
export class ConfigurationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ConfigurationError';
    }
}

export class NetworkError extends Error {
    constructor(message, cause = null) {
        super(message);
        this.name = 'NetworkError';
        this.cause = cause;
    }
}

export class ValidationError extends Error {
    constructor(message, field = null) {
        super(message);
        this.name = 'ValidationError';
        this.field = field;
    }
}

export class SearchError extends Error {
    constructor(message, searchParams = null) {
        super(message);
        this.name = 'SearchError';
        this.searchParams = searchParams;
    }
}

// Enhanced error formatter
export function formatError(error, verbose = false) {
    let message = '';
    
    switch (error.name) {
        case 'ConfigurationError':
            message = `⚙️  Configuration Error: ${error.message}`;
            break;
        case 'NetworkError':
            message = `🌐 Network Error: ${error.message}`;
            if (verbose && error.cause) {
                message += `\n   Cause: ${error.cause.message}`;
            }
            break;
        case 'ValidationError':
            message = `📋 Validation Error: ${error.message}`;
            if (error.field) {
                message += `\n   Field: ${error.field}`;
            }
            break;
        case 'SearchError':
            message = `🔍 Search Error: ${error.message}`;
            if (verbose && error.searchParams) {
                message += `\n   Search parameters: ${JSON.stringify(error.searchParams, null, 2)}`;
            }
            break;
        default:
            message = `❌ Error: ${error.message}`;
    }
    
    if (verbose && error.stack) {
        message += `\n\nStack trace:\n${error.stack}`;
    }
    
    return message;
}

// Retry mechanism with exponential backoff
export async function withRetry(operation, maxAttempts = 3, baseDelay = 1000, context = 'operation') {
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            
            if (attempt === maxAttempts) {
                throw new NetworkError(
                    `${context} failed after ${maxAttempts} attempts: ${error.message}`,
                    error
                );
            }
            
            // Calculate delay with exponential backoff
            const delay = baseDelay * Math.pow(2, attempt - 1);
            console.warn(`⚠️  ${context} failed (attempt ${attempt}/${maxAttempts}). Retrying in ${delay}ms...`);
            console.warn(`   Error: ${error.message}`);
            
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    
    throw lastError;
}

// Individual date search with retry (preserves other results)
export async function withDateRetry(operation, date, maxAttempts = 2, baseDelay = 2000) {
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            
            if (attempt === maxAttempts) {
                console.warn(`⚠️  Search for ${date} failed after ${maxAttempts} attempts: ${error.message}`);
                return null; // Return null instead of throwing, so other dates can continue
            }
            
            const delay = baseDelay;
            console.warn(`⚠️  Search for ${date} failed (attempt ${attempt}/${maxAttempts}). Retrying in ${delay}ms...`);
            
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    
    return null;
}

// Progress-aware search with result preservation and parallel processing
export async function withProgressiveSearch(dates, searchFunction, progressCallback, maxConcurrency = 3, useAnimation = true) {
    const results = [];
    const failures = [];
    const total = dates.length;
    let completed = 0;
    
    // Import progress indicator
    const { ParallelSearchProgress } = await import('./output-formatters.js');
    const progress = new ParallelSearchProgress(total, maxConcurrency, useAnimation);
    
    // Start progress animation
    progress.start();
    
    // Function to search a single date with silent progress tracking
    const searchWithProgress = async (date) => {
        try {
            const result = await withDateRetry(
                () => searchFunction(date),
                date,
                2, // 2 attempts per date
                2000 // 2 second delay between retries
            );
            
            completed++;
            progress.updateProgress(`Searching dates...`, completed);
            
            if (result) {
                results.push(result);
                return { success: true, date, result };
            } else {
                failures.push(date);
                return { success: false, date, error: 'No result returned' };
            }
            
        } catch (error) {
            completed++;
            failures.push(date);
            progress.updateProgress(`Searching dates...`, completed);
            return { success: false, date, error: error.message };
        }
    };
    
    // Process dates in parallel batches
    for (let i = 0; i < dates.length; i += maxConcurrency) {
        const batch = dates.slice(i, i + maxConcurrency);
        const batchNumber = Math.floor(i / maxConcurrency) + 1;
        const totalBatches = Math.ceil(dates.length / maxConcurrency);
        
        progress.updateProgress(`Batch ${batchNumber}/${totalBatches}`, completed);
        
        const batchPromises = batch.map(date => searchWithProgress(date));
        
        // Wait for current batch to complete before starting next batch
        await Promise.all(batchPromises);
        
        // Small delay between batches to avoid overwhelming the API
        if (i + maxConcurrency < dates.length) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
    
    // Stop progress animation and show summary
    progress.stop(results.length, failures.length);
    
    return {
        results,
        failures,
        successCount: results.length,
        failureCount: failures.length
    };
}

// Timeout wrapper
export function withTimeout(promise, timeoutMs, context = 'operation') {
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            setTimeout(() => {
                reject(new NetworkError(`${context} timed out after ${timeoutMs}ms`));
            }, timeoutMs);
        })
    ]);
}

// Progress-aware operation wrapper
export async function withProgress(operation, message, showSpinner = true, useTrainAnimation = false) {
    const progress = new ProgressIndicator(message, showSpinner, useTrainAnimation);
    
    try {
        progress.start();
        const result = await operation((newMessage) => progress.update(newMessage));
        progress.stop();
        return result;
    } catch (error) {
        progress.error(error.message);
        throw error;
    }
}

// Train-themed progress wrapper for search operations
export async function withTrainProgress(operation, message, searchType = 'general') {
    const { TrainProgressIndicator } = await import('./output-formatters.js');
    const progress = new TrainProgressIndicator(message, searchType);
    
    try {
        progress.start();
        const result = await operation((newMessage) => progress.update(newMessage));
        progress.stop();
        return result;
    } catch (error) {
        progress.error(error.message);
        throw error;
    }
}

// Input validation helpers
export function validateStationInput(input) {
    if (!input || typeof input !== 'string') {
        throw new ValidationError('Station input must be a non-empty string', 'station');
    }
    
    const trimmed = input.trim();
    if (trimmed.length === 0) {
        throw new ValidationError('Station input cannot be empty', 'station');
    }
    
    // Check if it looks like a station ID (8 digits)
    if (/^\d{8}$/.test(trimmed)) {
        return { type: 'id', value: trimmed };
    }
    
    // Check if it's a reasonable station name
    if (trimmed.length < 2) {
        throw new ValidationError('Station name must be at least 2 characters long', 'station');
    }
    
    if (trimmed.length > 100) {
        throw new ValidationError('Station name cannot exceed 100 characters', 'station');
    }
    
    return { type: 'name', value: trimmed };
}

export function validateDateInput(input) {
    if (!input || typeof input !== 'string') {
        throw new ValidationError('Date must be a string', 'date');
    }
    
    const trimmed = input.trim();
    
    // Check format
    if (!/^\d{4}-\d{1,2}-\d{1,2}$/.test(trimmed) && !/^\d{1,2}-\d{1,2}$/.test(trimmed)) {
        throw new ValidationError('Date must be in YYYY-MM-DD or MM-DD format', 'date');
    }
    
    // Parse and validate
    let date;
    if (/^\d{1,2}-\d{1,2}$/.test(trimmed)) {
        const currentYear = new Date().getFullYear();
        date = new Date(`${currentYear}-${trimmed}`);
    } else {
        date = new Date(trimmed);
    }
    
    if (isNaN(date.getTime())) {
        throw new ValidationError('Invalid date', 'date');
    }
    
    // Check if date is in the future
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    
    if (date <= now) {
        throw new ValidationError('Date must be in the future', 'date');
    }
    
    return date;
}

export function validateTripType(tripType) {
    const validTypes = ['same-day', 'multi-day', 'one-way'];
    
    if (!validTypes.includes(tripType)) {
        throw new ValidationError(
            `Invalid trip type: ${tripType}. Must be one of: ${validTypes.join(', ')}`,
            'tripType'
        );
    }
    
    return tripType;
}

export function validateOutputFormat(format) {
    const validFormats = ['console', 'table', 'json', 'csv'];
    
    if (!validFormats.includes(format)) {
        throw new ValidationError(
            `Invalid output format: ${format}. Must be one of: ${validFormats.join(', ')}`,
            'outputFormat'
        );
    }
    
    return format;
}

// Global error handler for unhandled errors
export function setupGlobalErrorHandling(verbose = false) {
    process.on('unhandledRejection', (reason, promise) => {
        console.error('\n💥 Unhandled Rejection at:', promise);
        console.error(formatError(reason, verbose));
        process.exit(1);
    });
    
    process.on('uncaughtException', (error) => {
        console.error('\n💥 Uncaught Exception:');
        console.error(formatError(error, verbose));
        process.exit(1);
    });
}

// Graceful shutdown handler
export function setupGracefulShutdown() {
    const shutdown = (signal) => {
        console.log(`\n\n🛑 Received ${signal}. Shutting down gracefully...`);
        // Clean up any ongoing operations here
        process.exit(0);
    };
    
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// API error handler for db-vendo-client errors
export function handleApiError(error, context) {
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        throw new NetworkError(`Cannot connect to Deutsche Bahn API. Check your internet connection.`, error);
    }
    
    if (error.code === 'ETIMEDOUT') {
        throw new NetworkError(`Request to Deutsche Bahn API timed out. Try again later.`, error);
    }
    
    if (error.response) {
        const status = error.response.status;
        const statusText = error.response.statusText;
        
        if (status === 429) {
            throw new NetworkError(`Rate limit exceeded. Please wait before making more requests.`, error);
        }
        
        if (status >= 500) {
            throw new NetworkError(`Deutsche Bahn API server error (${status}). Try again later.`, error);
        }
        
        if (status === 404) {
            throw new SearchError(`No results found for ${context}`, error);
        }
    }
    
    // Generic API error
    throw new NetworkError(`API request failed: ${error.message}`, error);
}

// Validation for search parameters
export function validateSearchParams(params) {
    const errors = [];
    
    if (!params.departureStation) {
        errors.push('Departure station is required');
    }
    
    if (!params.destinationStation) {
        errors.push('Destination station is required');
    }
    
    if (params.departureStation === params.destinationStation) {
        errors.push('Departure and destination stations cannot be the same');
    }
    
    if (!params.startDate) {
        errors.push('Start date is required');
    }
    
    if (params.tripType === 'multi-day' && !params.returnDate && !params.flexibleDuration) {
        errors.push('Return date is required for multi-day trips');
    }
    
    if (params.tripType === 'multi-day' && params.flexibleDuration && !params.numberOfDays) {
        errors.push('Number of days is required for flexible duration trips');
    }
    
    if (errors.length > 0) {
        throw new ValidationError(`Search validation failed:\n  - ${errors.join('\n  - ')}`);
    }
    
    return true;
}