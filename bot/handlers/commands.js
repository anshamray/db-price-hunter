// Command handlers for the Telegram bot

import { createClient } from 'db-vendo-client';
import { profile as dbnavProfile } from 'db-vendo-client/p/dbnav/index.js';
import { loadConfig } from '../../src/config.js';
import { 
    createMainMenuKeyboard, 
    createRouteKeyboard, 
    createSearchActionKeyboard 
} from './keyboards.js';
import { 
    formatWelcomeMessage, 
    formatHelpMessage,
    formatSearchProgress 
} from '../utils/formatter.js';
import { handleQuickSearch } from './quick-search.js';

const client = createClient(dbnavProfile, 'db-price-hunter-bot');
const config = loadConfig();

export function setupCommands(bot) {
    // Start command
    bot.command('start', async (ctx) => {
        const welcomeMessage = formatWelcomeMessage();
        
        await ctx.reply(welcomeMessage, {
            parse_mode: 'Markdown',
            reply_markup: createMainMenuKeyboard()
        });
    });

    // Help command
    bot.command('help', async (ctx) => {
        const helpMessage = formatHelpMessage();
        await ctx.reply(helpMessage, { parse_mode: 'Markdown' });
    });

    // Search command - starts conversation
    bot.command('search', async (ctx) => {
        await ctx.conversation.enter('searchConversation');
    });

    // Route command - quick predefined routes
    bot.command('route', async (ctx) => {
        await ctx.reply('🚄 *Quick Routes*\n\nSelect a popular route for quick search:', {
            parse_mode: 'Markdown',
            reply_markup: createRouteKeyboard(config.commonRoutes)
        });
    });

    // Handle callback queries (button presses)
    setupCallbackHandlers(bot);
    
    // Handle text messages for quick search
    setupTextHandlers(bot);
}

function setupCallbackHandlers(bot) {
    // Main menu buttons
    bot.callbackQuery('cmd_search', async (ctx) => {
        await ctx.answerCallbackQuery();
        await ctx.conversation.enter('searchConversation');
    });

    bot.callbackQuery('cmd_routes', async (ctx) => {
        await ctx.answerCallbackQuery();
        await ctx.editMessageText('🚄 *Quick Routes*\n\nSelect a popular route for quick search:', {
            parse_mode: 'Markdown',
            reply_markup: createRouteKeyboard(config.commonRoutes)
        });
    });

    bot.callbackQuery('cmd_help', async (ctx) => {
        await ctx.answerCallbackQuery();
        const helpMessage = formatHelpMessage();
        await ctx.editMessageText(helpMessage, { parse_mode: 'Markdown' });
    });

    // Route selection
    bot.callbackQuery(/route_(.+)/, async (ctx) => {
        const routeKey = ctx.match[1];
        const route = config.commonRoutes[routeKey];
        
        if (!route) {
            await ctx.answerCallbackQuery('❌ Route not found');
            return;
        }

        await ctx.answerCallbackQuery();
        
        // Store route in session
        ctx.session.selectedRoute = route;
        
        await ctx.editMessageText(
            `🚄 *Selected Route*\n` +
            `📍 ${route.departure.name} → ${route.destination.name}\n\n` +
            `📅 Please enter your travel date:\n` +
            `• Single date: \`2025-08-15\`\n` +
            `• Date range: \`2025-08-15 to 2025-08-20\``,
            { 
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[
                        { text: '🔙 Back to Routes', callback_data: 'cmd_routes' }
                    ]]
                }
            }
        );
    });

    // Back to menu
    bot.callbackQuery('back_to_menu', async (ctx) => {
        await ctx.answerCallbackQuery();
        const welcomeMessage = formatWelcomeMessage();
        await ctx.editMessageText(welcomeMessage, {
            parse_mode: 'Markdown',
            reply_markup: createMainMenuKeyboard()
        });
    });

    // New search
    bot.callbackQuery('new_search', async (ctx) => {
        await ctx.answerCallbackQuery();
        await ctx.conversation.enter('searchConversation');
    });

    // Save search (placeholder)
    bot.callbackQuery('save_search', async (ctx) => {
        await ctx.answerCallbackQuery('💾 Search saving feature coming soon!');
    });
}

function setupTextHandlers(bot) {
    // Handle text messages that might be quick searches
    bot.on('message:text', async (ctx, next) => {
        const text = ctx.message.text.trim();
        
        // Skip if it's a command
        if (text.startsWith('/')) {
            return next();
        }
        
        // Skip if user has selected a route and is providing date
        if (ctx.session.selectedRoute) {
            await handleRouteWithDate(ctx, text);
            return;
        }
        
        // Try to parse as quick search
        if (await handleQuickSearch(ctx, text, client, config)) {
            return; // Quick search handled
        }
        
        // Default response for unrecognized text
        await ctx.reply(
            '🤔 I didn\'t understand that.\n\n' +
            'Try:\n' +
            '• /search - for guided search\n' +
            '• /route - for quick routes\n' +
            '• /help - for more options\n\n' +
            'Or try a quick search like:\n' +
            '`Berlin Munich 2025-08-15`',
            { parse_mode: 'Markdown' }
        );
    });
}

async function handleRouteWithDate(ctx, dateText) {
    const route = ctx.session.selectedRoute;
    if (!route) return;
    
    try {
        // Clear the selected route
        ctx.session.selectedRoute = null;
        
        // Use the quick search handler with predefined route
        const searchText = `${route.departure.name} ${route.destination.name} ${dateText}`;
        await handleQuickSearch(ctx, searchText, client, config);
        
    } catch (error) {
        console.error('Error handling route with date:', error);
        await ctx.reply('❌ Sorry, there was an error processing your search. Please try again.');
    }
}