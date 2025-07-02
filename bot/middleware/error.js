// Error handling middleware for the Telegram bot

import { formatErrorMessage } from '../utils/formatter.js';

export function setupErrorHandling(bot) {
    // Middleware to catch and handle errors gracefully
    bot.use(async (ctx, next) => {
        try {
            await next();
        } catch (error) {
            console.error('Bot error:', error);
            
            // Try to send error message to user
            try {
                const errorMsg = formatErrorMessage(error, 'command processing');
                await ctx.reply(errorMsg, { parse_mode: 'Markdown' });
            } catch (replyError) {
                console.error('Failed to send error message:', replyError);
            }
        }
    });

    // Handle specific error types
    bot.errorBoundary(async (err, ctx) => {
        console.error('Error boundary caught:', err);
        
        try {
            if (err.error?.message?.includes('message is not modified')) {
                // Ignore "message is not modified" errors
                return;
            }
            
            if (err.error?.message?.includes('query is too old')) {
                await ctx.answerCallbackQuery('This button is no longer active. Please try again.');
                return;
            }
            
            if (err.error?.message?.includes('blocked')) {
                console.log('User blocked the bot, removing from session');
                return;
            }
            
            // Generic error handling
            const errorMsg = formatErrorMessage(err.error, 'processing your request');
            await ctx.reply(errorMsg, { parse_mode: 'Markdown' });
            
        } catch (handlingError) {
            console.error('Error while handling error:', handlingError);
        }
    });
}

export class BotError extends Error {
    constructor(message, code = 'GENERIC_ERROR', context = {}) {
        super(message);
        this.name = 'BotError';
        this.code = code;
        this.context = context;
    }
}

export class ValidationError extends BotError {
    constructor(message, field = null) {
        super(message, 'VALIDATION_ERROR', { field });
        this.name = 'ValidationError';
    }
}

export class SearchError extends BotError {
    constructor(message, searchParams = {}) {
        super(message, 'SEARCH_ERROR', { searchParams });
        this.name = 'SearchError';
    }
}