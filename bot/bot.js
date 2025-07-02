#!/usr/bin/env node

import { Bot, GrammyError, HttpError } from 'grammy';
import { conversations } from '@grammyjs/conversations';
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

// Simple session storage (in-memory for now)
const userSessions = new Map();

// Middleware to add session to context
bot.use((ctx, next) => {
    const userId = ctx.from?.id;
    if (userId) {
        if (!userSessions.has(userId)) {
            userSessions.set(userId, {
                selectedRoute: null,
                searchHistory: []
            });
        }
        ctx.session = userSessions.get(userId);
    }
    return next();
});

// Conversations middleware
bot.use(conversations());

// Setup conversations FIRST (before commands that use them)
setupConversations(bot);

// Setup error handling
setupErrorHandling(bot);

// Setup commands (after conversations are registered)
setupCommands(bot);

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
        
        console.log('📍 Bot commands have been set up in Telegram');
        
        // In production/Railway, use webhooks. In development, try polling with timeout
        if (process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT) {
            console.log('🔄 Production mode: Setting up webhook server...');
            await bot.init(); // Initialize bot for webhook mode
            await setupWebhookServer();
            await configureWebhook();
        } else {
            console.log('🔄 Development mode: Attempting polling...');
            try {
                await Promise.race([
                    bot.start({
                        drop_pending_updates: true,
                        timeout: 10,
                        limit: 100,
                        allowed_updates: ['message', 'callback_query']
                    }),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Polling timeout')), 10000)
                    )
                ]);
                console.log('🤖 DB Price Hunter Bot is running with polling!');
            } catch (pollError) {
                console.log('⚠️ Polling failed (this is normal in some networks)');
                console.log('💡 Bot should still work when deployed to Railway');
                console.log('🔄 Setting up webhook server for local testing...');
                await setupWebhookServer();
            }
        }
        
    } catch (error) {
        console.error('❌ Failed to start bot:', error);
        process.exit(1);
    }
};

// Configure webhook URL with Telegram
const configureWebhook = async () => {
    try {
        // Get webhook URL from Railway or environment
        const WEBHOOK_URL = process.env.RAILWAY_STATIC_URL 
            ? `${process.env.RAILWAY_STATIC_URL}/webhook`
            : process.env.WEBHOOK_URL;

        if (!WEBHOOK_URL) {
            console.log('⚠️ Could not determine webhook URL - will receive updates when Railway assigns domain');
            return;
        }

        console.log('🔧 Configuring webhook...');
        console.log('🔗 Webhook URL:', WEBHOOK_URL);

        // Set webhook
        const result = await bot.api.setWebhook(WEBHOOK_URL, {
            allowed_updates: ['message', 'callback_query']
        });

        console.log('✅ Webhook configured successfully!');
        
        // Get webhook info to verify
        const webhookInfo = await bot.api.getWebhookInfo();
        console.log('📊 Webhook status:');
        console.log('  🔗 URL:', webhookInfo.url);
        console.log('  📥 Pending updates:', webhookInfo.pending_update_count);
        if (webhookInfo.last_error_message) {
            console.log('  ⚠️ Last error:', webhookInfo.last_error_message);
        }
        
    } catch (error) {
        console.error('❌ Failed to configure webhook:', error.message);
        console.log('💡 Bot will still work once Railway assigns the public domain');
    }
};

// Setup webhook server for production or when polling fails
const setupWebhookServer = async () => {
    const { createServer } = await import('http');
    
    const server = createServer(async (req, res) => {
        if (req.method === 'POST' && req.url === '/webhook') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', async () => {
                try {
                    const update = JSON.parse(body);
                    await bot.handleUpdate(update);
                } catch (error) {
                    console.error('Webhook error:', error);
                }
                res.writeHead(200);
                res.end('OK');
            });
        } else {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('🤖 DB Price Hunter Bot is running!\n\nSend a POST request to /webhook to handle updates.');
        }
    });
    
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
        console.log(`🚀 Webhook server listening on port ${PORT}`);
        console.log('✅ Bot ready for webhooks');
        console.log(`🔗 Test: http://localhost:${PORT}`);
    });
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