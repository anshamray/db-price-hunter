// Calendar utility for date selection in the bot

import Calendar from 'telegram-inline-calendar';

// Create calendar instance
let calendar;

export function initializeCalendar(bot) {
    calendar = new Calendar(bot, {
        date_format: 'YYYY-MM-DD',
        language: 'en',
        bot_api: 'grammy',
        close_calendar: true,
        start_week_day: 1, // Monday
        time_selector_mod: false,
        time_range: '00:00-23:59',
        custom_start_msg: '📅 Select a date:',
        custom_select_msg: '✅ You selected: ',
        min_date: new Date().toISOString().split('T')[0], // Today or later
        max_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // One year from now
    });
    
    console.log('📅 Calendar initialized');
    return calendar;
}

export function getCalendar() {
    if (!calendar) {
        throw new Error('Calendar not initialized. Call initializeCalendar first.');
    }
    return calendar;
}

// Show calendar for date selection
export async function showCalendar(ctx, message = '📅 Select your travel date:') {
    const cal = getCalendar();
    
    try {
        await cal.startNavCalendar(ctx, message);
        return true;
    } catch (error) {
        console.error('Error showing calendar:', error);
        await ctx.reply('❌ Calendar error. Please enter date manually (YYYY-MM-DD):');
        return false;
    }
}

// Handle calendar callback
export function handleCalendarCallback(ctx) {
    const cal = getCalendar();
    
    try {
        const result = cal.clickButtonCalendar(ctx.callbackQuery);
        
        if (result !== -1) {
            // Date was selected
            return {
                success: true,
                date: result,
                formattedDate: result
            };
        }
        
        // Still navigating calendar
        return {
            success: false,
            navigating: true
        };
        
    } catch (error) {
        console.error('Calendar callback error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Check if callback is for calendar
export function isCalendarCallback(ctx) {
    const cal = getCalendar();
    
    try {
        // Check if this message ID matches a calendar instance
        return cal.chats && cal.chats.get(ctx.chat.id) === ctx.msg?.message_id;
    } catch (error) {
        return false;
    }
}

// Show date range selection (start and end dates)
export async function showDateRangeSelection(ctx) {
    await ctx.reply(
        '📅 *Date Range Selection*\n\n' +
        'I\'ll help you select a date range for your search.\n\n' +
        'First, select your **start date**:',
        { parse_mode: 'Markdown' }
    );
    
    return await showCalendar(ctx, '📅 Select start date:');
}

// Format date for display
export function formatDateForDisplay(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Validate if date is in acceptable range
export function validateCalendarDate(dateString) {
    const date = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
    
    if (date < today) {
        return { valid: false, error: 'Date cannot be in the past.' };
    }
    
    if (date > oneYearFromNow) {
        return { valid: false, error: 'Date cannot be more than one year from now.' };
    }
    
    return { valid: true };
}