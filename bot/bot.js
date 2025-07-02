#!/usr/bin/env node

import { Bot, GrammyError, HttpError, session } from 'grammy';
import { conversations, createConversation } from '@grammyjs/conversations';
import { setupCommands } from './handlers/commands.js';
import { setupConversations } from './handlers/conversations.js';
import { setupErrorHandling } from './middleware/error.js';

// Validate required environment variables
if (!process.env.BOT_TOKEN) {
    console.error('❌ BOT_TOKEN environment variable is required');
    console.error('   Get your token from @BotFather on Telegram');
    console.error('   Then run: export BOT_TOKEN="your_bot_token_here"');
    process.exit(1);
}

// Initialize bot
const bot = new Bot(process.env.BOT_TOKEN);

// Session middleware for storing user state
function initial() {
    return {
        selectedRoute: null,
        searchHistory: []
    };
}

bot.use(session({ initial }));

// Conversations middleware
bot.use(conversations());

// Setup error handling
setupErrorHandling(bot);

// Setup handlers
setupCommands(bot);
setupConversations(bot);

// Global error handling
bot.catch((err) => {
    const ctx = err.ctx;
    console.error(`Error while handling update ${ctx.update.update_id}:`);
    const e = err.error;
    
    if (e instanceof GrammyError) {
        console.error("Error in request:", e.description);
        ctx.reply("❌ Sorry, there was an error processing your request. Please try again.");
    } else if (e instanceof HttpError) {
        console.error("Could not contact Telegram:", e);
    } else {
        console.error("Unknown error:", e);
        ctx.reply("❌ An unexpected error occurred. Please try again later.");
    }
});

// Start bot
const startBot = async () => {
    try {
        console.log('🚀 Starting DB Price Hunter Bot...');
        
        // Set bot commands for Telegram UI
        await bot.api.setMyCommands([
            { command: 'start', description: 'Start the bot and show main menu' },
            { command: 'search', description: 'Search for train tickets' },
            { command: 'route', description: 'Quick search with predefined routes' },
            { command: 'help', description: 'Show help and usage information' }
        ]);
        
        await bot.start();
        console.log('🤖 DB Price Hunter Bot is running!');
        console.log('📍 Bot commands have been set up in Telegram');
        
    } catch (error) {
        console.error('❌ Failed to start bot:', error);
        process.exit(1);
    }
};

// Handle graceful shutdown
const gracefulShutdown = () => {
    console.log('🛑 Shutting down bot gracefully...');
    bot.stop();
    process.exit(0);
};

process.once('SIGINT', gracefulShutdown);
process.once('SIGTERM', gracefulShutdown);

// Start if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    startBot();
}

export { bot };