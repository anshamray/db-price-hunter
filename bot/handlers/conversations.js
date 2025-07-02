// Conversation handlers for interactive searches

import { createConversation } from '@grammyjs/conversations';
import { createClient } from 'db-vendo-client';
import { profile as dbnavProfile } from 'db-vendo-client/p/dbnav/index.js';
import { searchSameDayTrips, searchOneWayTrips, searchMultiDayTrips, TRIP_TYPES } from '../../src/journey-search.js';
import { lookupStation } from '../../src/cli-handler.js';
import { validateDate, validateStationName, sanitizeInput } from '../utils/validator.js';
import { formatTelegramResults, formatSearchProgress } from '../utils/formatter.js';
import { createTripTypeKeyboard, createTimePreferenceKeyboard, createSearchActionKeyboard } from './keyboards.js';

const client = createClient(dbnavProfile, 'db-price-hunter-bot');

// Define the search conversation function
async function searchConversation(conversation, ctx) {
    try {
        // Step 1: Get departure station
        await ctx.reply('🚉 *Step 1/4: Departure Station*\n\nEnter your departure station (e.g., "Berlin Hbf", "Munich Central"):', {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[
                    { text: '❌ Cancel', callback_data: 'cancel_search' }
                ]]
            }
        });
        
        const departureCtx = await conversation.wait();
        
        // Handle cancel button
        if (departureCtx.callbackQuery?.data === 'cancel_search') {
            await departureCtx.answerCallbackQuery();
            await departureCtx.editMessageText('❌ Search cancelled.');
            return;
        }
        
        if (!departureCtx.message?.text) {
            await ctx.reply('❌ Please enter a valid station name or use /search to try again.');
            return;
        }

        const departureText = sanitizeInput(departureCtx.message.text);
        const departureValidation = validateStationName(departureText);
        
        if (!departureValidation.valid) {
            await ctx.reply(`❌ ${departureValidation.error}\n\nUse /search to try again.`);
            return;
        }

        // Lookup departure station
        let departureStation;
        const lookupMsg = await ctx.reply(formatSearchProgress('looking_up_station', departureText));
        
        try {
            departureStation = await lookupStation(client, departureText);
            await ctx.api.deleteMessage(ctx.chat.id, lookupMsg.message_id);
        } catch (error) {
            await ctx.api.deleteMessage(ctx.chat.id, lookupMsg.message_id);
            await ctx.reply(`❌ Could not find station "${departureText}". Please check the spelling and try /search again.`);
            return;
        }

        // Step 2: Get destination station
        await ctx.reply(`✅ Departure: *${departureStation.name}*\n\n🎯 *Step 2/4: Destination Station*\n\nEnter your destination station:`, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[
                    { text: '❌ Cancel', callback_data: 'cancel_search' }
                ]]
            }
        });
        
        const destinationCtx = await conversation.wait();
        
        if (destinationCtx.callbackQuery?.data === 'cancel_search') {
            await destinationCtx.answerCallbackQuery();
            await destinationCtx.editMessageText('❌ Search cancelled.');
            return;
        }
        
        if (!destinationCtx.message?.text) {
            await ctx.reply('❌ Please enter a valid station name or use /search to try again.');
            return;
        }

        const destinationText = sanitizeInput(destinationCtx.message.text);
        const destinationValidation = validateStationName(destinationText);
        
        if (!destinationValidation.valid) {
            await ctx.reply(`❌ ${destinationValidation.error}\n\nUse /search to try again.`);
            return;
        }

        // Lookup destination station
        let destinationStation;
        const lookupDestMsg = await ctx.reply(formatSearchProgress('looking_up_station', destinationText));
        
        try {
            destinationStation = await lookupStation(client, destinationText);
            await ctx.api.deleteMessage(ctx.chat.id, lookupDestMsg.message_id);
        } catch (error) {
            await ctx.api.deleteMessage(ctx.chat.id, lookupDestMsg.message_id);
            await ctx.reply(`❌ Could not find station "${destinationText}". Please check the spelling and try /search again.`);
            return;
        }

        // Step 3: Get trip type
        await ctx.reply(
            `✅ Destination: *${destinationStation.name}*\n\n` +
            `🚂 *Step 3/4: Trip Type*\n\n` +
            `What type of trip are you planning?`,
            {
                parse_mode: 'Markdown',
                reply_markup: createTripTypeKeyboard()
            }
        );
        
        const tripTypeCtx = await conversation.wait();
        
        if (!tripTypeCtx.callbackQuery) {
            await ctx.reply('❌ Please select a trip type using the buttons or use /search to try again.');
            return;
        }
        
        await tripTypeCtx.answerCallbackQuery();
        
        if (tripTypeCtx.callbackQuery.data === 'cancel_search') {
            await tripTypeCtx.editMessageText('❌ Search cancelled.');
            return;
        }
        
        const tripTypeMap = {
            'trip_same_day': TRIP_TYPES.SAME_DAY,
            'trip_one_way': TRIP_TYPES.ONE_WAY,
            'trip_multi_day': TRIP_TYPES.MULTI_DAY
        };
        
        const tripType = tripTypeMap[tripTypeCtx.callbackQuery.data];
        if (!tripType) {
            await tripTypeCtx.editMessageText('❌ Invalid trip type selected. Please use /search to try again.');
            return;
        }

        // Step 4: Get travel date
        const tripTypeLabel = {
            [TRIP_TYPES.SAME_DAY]: '🔄 Same Day Return',
            [TRIP_TYPES.ONE_WAY]: '➡️ One Way',
            [TRIP_TYPES.MULTI_DAY]: '📅 Multi-Day'
        }[tripType];
        
        await tripTypeCtx.editMessageText(
            `✅ Trip type: *${tripTypeLabel}*\n\n` +
            `📅 *Step 4/4: Travel Date*\n\n` +
            `Enter your travel date or date range:\n` +
            `• Single date: \`2025-08-15\`\n` +
            `• Date range: \`2025-08-15 to 2025-08-20\``,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[
                        { text: '❌ Cancel', callback_data: 'cancel_search' }
                    ]]
                }
            }
        );
        
        const dateCtx = await conversation.wait();
        
        if (dateCtx.callbackQuery?.data === 'cancel_search') {
            await dateCtx.answerCallbackQuery();
            await dateCtx.editMessageText('❌ Search cancelled.');
            return;
        }
        
        if (!dateCtx.message?.text) {
            await ctx.reply('❌ Please enter a valid date or use /search to try again.');
            return;
        }

        const dateText = sanitizeInput(dateCtx.message.text);
        const dateValidation = validateDate(dateText);
        
        if (!dateValidation.valid) {
            await ctx.reply(`❌ ${dateValidation.error}\n\nUse /search to try again.`);
            return;
        }

        // Perform search
        const searchMsg = await ctx.reply(formatSearchProgress('searching'));
        
        try {
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
                    retryAttempts: 3
                } 
            };

            switch (tripType) {
                case TRIP_TYPES.ONE_WAY:
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
                    break;
                    
                case TRIP_TYPES.SAME_DAY:
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
                    break;
                    
                case TRIP_TYPES.MULTI_DAY:
                    // For multi-day, use same-day logic for now
                    // In production, implement proper multi-day search
                    results = await searchSameDayTrips(
                        client,
                        searchConfig,
                        departureStation.id,
                        destinationStation.id,
                        searchParams.startDate,
                        searchParams.endDate,
                        null,
                        null,
                        true,
                        true
                    );
                    break;
                    
                default:
                    throw new Error('Invalid trip type');
            }

            // Delete search progress message
            await ctx.api.deleteMessage(ctx.chat.id, searchMsg.message_id);

            if (!results || results.length === 0) {
                await ctx.reply(
                    '😔 *No connections found*\n\n' +
                    'Try:\n' +
                    '• Different dates\n' +
                    '• Different stations\n' +
                    '• Check if the route exists\n\n' +
                    'Use /search to try again.',
                    { parse_mode: 'Markdown' }
                );
                return;
            }

            // Format and send results
            const formattedResults = formatTelegramResults(results, searchParams);
            await ctx.reply(formattedResults, { 
                parse_mode: 'Markdown',
                reply_markup: createSearchActionKeyboard()
            });

            // Store search in session
            if (!ctx.session.searchHistory) {
                ctx.session.searchHistory = [];
            }
            ctx.session.searchHistory.push({
                searchParams,
                results: results.length,
                timestamp: new Date()
            });

        } catch (error) {
            console.error('Search error in conversation:', error);
            
            // Clean up search message
            try {
                await ctx.api.deleteMessage(ctx.chat.id, searchMsg.message_id);
            } catch (deleteError) {
                // Ignore delete errors
            }
            
            let errorMessage = '❌ *Search failed*\n\n';
            
            if (error.message.includes('timeout')) {
                errorMessage += 'The search took too long. Please try again with a shorter date range.';
            } else if (error.message.includes('network')) {
                errorMessage += 'Network error. Please check your connection and try again.';
            } else {
                errorMessage += 'An unexpected error occurred. Please try again later.';
            }
            
            errorMessage += '\n\nUse /search to try again.';
            
            await ctx.reply(errorMessage, { parse_mode: 'Markdown' });
        }

    } catch (error) {
        console.error('Conversation error:', error);
        await ctx.reply('❌ An error occurred during the search. Please try /search again.');
    }
}

// Export setup function
export function setupConversations(bot) {
    // Create and register the search conversation
    bot.use(createConversation(searchConversation));
}