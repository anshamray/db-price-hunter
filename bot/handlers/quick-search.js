// Quick search handler for parsing text-based searches

import { searchSameDayTrips, searchOneWayTrips, TRIP_TYPES } from '../../src/journey-search.js';
import { lookupStation } from '../../src/cli-handler.js';
import { validateDate } from '../utils/validator.js';
import { formatTelegramResults, formatSearchProgress } from '../utils/formatter.js';
import { createSearchActionKeyboard } from './keyboards.js';

export async function handleQuickSearch(ctx, text, client, config) {
    // Parse patterns like:
    // "Berlin Munich 2025-08-15"
    // "Hamburg Frankfurt 2025-08-20 one-way"
    // "Cologne Dortmund 2025-08-15 to 2025-08-20"
    
    const patterns = [
        // Station1 Station2 Date [trip-type]
        /^(.+?)\s+(.+?)\s+(\d{4}-\d{2}-\d{2}(?:\s+to\s+\d{4}-\d{2}-\d{2})?)\s*(one-way|same-day|multi-day)?$/i,
        // Station1 to Station2 Date [trip-type]
        /^(.+?)\s+to\s+(.+?)\s+(\d{4}-\d{2}-\d{2}(?:\s+to\s+\d{4}-\d{2}-\d{2})?)\s*(one-way|same-day|multi-day)?$/i
    ];
    
    let match = null;
    for (const pattern of patterns) {
        match = text.match(pattern);
        if (match) break;
    }
    
    if (!match) {
        return false; // Not a recognized quick search pattern
    }
    
    const [, departureText, destinationText, dateText, tripTypeText] = match;
    
    try {
        // Show initial processing message
        const progressMsg = await ctx.reply(formatSearchProgress('looking_up_station', 'departure'));
        
        // Validate and parse date
        const dateValidation = validateDate(dateText.trim());
        if (!dateValidation.valid) {
            await ctx.api.editMessageText(
                ctx.chat.id, 
                progressMsg.message_id, 
                `❌ ${dateValidation.error}`
            );
            return true;
        }
        
        // Lookup departure station
        await ctx.api.editMessageText(
            ctx.chat.id, 
            progressMsg.message_id, 
            formatSearchProgress('looking_up_station', departureText.trim())
        );
        
        const departureStation = await lookupStation(client, departureText.trim());
        
        // Lookup destination station
        await ctx.api.editMessageText(
            ctx.chat.id, 
            progressMsg.message_id, 
            formatSearchProgress('looking_up_station', destinationText.trim())
        );
        
        const destinationStation = await lookupStation(client, destinationText.trim());
        
        // Determine trip type
        let tripType = TRIP_TYPES.SAME_DAY; // default
        if (tripTypeText) {
            const typeMap = {
                'one-way': TRIP_TYPES.ONE_WAY,
                'same-day': TRIP_TYPES.SAME_DAY,
                'multi-day': TRIP_TYPES.MULTI_DAY
            };
            tripType = typeMap[tripTypeText.toLowerCase()] || TRIP_TYPES.SAME_DAY;
        }
        
        // Start search
        await ctx.api.editMessageText(
            ctx.chat.id, 
            progressMsg.message_id, 
            formatSearchProgress('searching')
        );
        
        const searchParams = {
            departureStation,
            destinationStation,
            startDate: dateValidation.startDate,
            endDate: dateValidation.endDate || dateValidation.startDate,
            tripType,
            timePreferences: null
        };
        
        let results;
        const searchConfig = { 
            preferences: { 
                maxConcurrency: 2,
                retryAttempts: 2
            } 
        };
        
        if (tripType === TRIP_TYPES.ONE_WAY) {
            results = await searchOneWayTrips(
                client,
                searchConfig,
                departureStation.id,
                destinationStation.id,
                searchParams.startDate,
                searchParams.endDate,
                null, // timePreferences
                true, // silent
                true  // isNestedSearch
            );
        } else {
            results = await searchSameDayTrips(
                client,
                searchConfig,
                departureStation.id,
                destinationStation.id,
                searchParams.startDate,
                searchParams.endDate,
                null, // timePreferences
                null, // returnDepartureStation
                true, // silent
                true  // isNestedSearch
            );
        }
        
        // Delete progress message
        await ctx.api.deleteMessage(ctx.chat.id, progressMsg.message_id);
        
        // Format and send results
        const formattedResults = formatTelegramResults(results, searchParams);
        await ctx.reply(formattedResults, { 
            parse_mode: 'Markdown',
            reply_markup: createSearchActionKeyboard()
        });
        
        // Store search in session history
        if (!ctx.session.searchHistory) {
            ctx.session.searchHistory = [];
        }
        ctx.session.searchHistory.push({
            searchParams,
            results: results?.length || 0,
            timestamp: new Date()
        });
        
        return true;
        
    } catch (error) {
        console.error('Quick search error:', error);
        
        // Try to clean up progress message
        try {
            await ctx.api.deleteMessage(ctx.chat.id, progressMsg.message_id);
        } catch (deleteError) {
            // Ignore delete errors
        }
        
        let errorMessage = '❌ Search failed: ';
        
        if (error.message.includes('station')) {
            errorMessage += 'Could not find one of the stations. Please check spelling.';
        } else if (error.message.includes('network') || error.message.includes('timeout')) {
            errorMessage += 'Network error. Please try again.';
        } else {
            errorMessage += 'An unexpected error occurred. Please try again.';
        }
        
        await ctx.reply(errorMessage);
        return true;
    }
}