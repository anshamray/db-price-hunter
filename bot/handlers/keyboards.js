// Keyboard layouts for the Telegram bot

export function createMainMenuKeyboard() {
    return {
        inline_keyboard: [
            [{ text: '🔍 Search Tickets', callback_data: 'cmd_search' }],
            [{ text: '🚄 Quick Routes', callback_data: 'cmd_routes' }],
            [{ text: '📖 Help', callback_data: 'cmd_help' }]
        ]
    };
}

export function createRouteKeyboard(routes) {
    const keyboard = [];
    
    Object.entries(routes).slice(0, 8).forEach(([key, route]) => {
        keyboard.push([{ 
            text: `${route.departure.name} → ${route.destination.name}`, 
            callback_data: `route_${key}` 
        }]);
    });
    
    // Add back button
    keyboard.push([{ text: '🔙 Back to Menu', callback_data: 'back_to_menu' }]);
    
    return { inline_keyboard: keyboard };
}

export function createSearchActionKeyboard() {
    return {
        inline_keyboard: [
            [
                { text: '💾 Save Search', callback_data: 'save_search' },
                { text: '🔄 New Search', callback_data: 'cmd_search' }
            ],
            [{ text: '🔙 Main Menu', callback_data: 'back_to_menu' }]
        ]
    };
}

export function createTripTypeKeyboard() {
    return {
        inline_keyboard: [
            [{ text: '🔄 Same Day Return', callback_data: 'trip_same_day' }],
            [{ text: '➡️ One Way', callback_data: 'trip_one_way' }],
            [{ text: '📅 Multi-Day', callback_data: 'trip_multi_day' }],
            [{ text: '🔙 Cancel', callback_data: 'cancel_search' }]
        ]
    };
}

export function createTimePreferenceKeyboard() {
    return {
        inline_keyboard: [
            [
                { text: '🌅 Early (4-8)', callback_data: 'time_early' },
                { text: '🌄 Morning (8-12)', callback_data: 'time_morning' }
            ],
            [
                { text: '☀️ Afternoon (12-18)', callback_data: 'time_afternoon' },
                { text: '🌆 Evening (18-22)', callback_data: 'time_evening' }
            ],
            [{ text: '🕐 Any Time', callback_data: 'time_any' }],
            [{ text: '🔙 Skip', callback_data: 'skip_time_prefs' }]
        ]
    };
}