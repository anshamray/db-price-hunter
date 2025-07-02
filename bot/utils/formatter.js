// Message formatting utilities for the Telegram bot

export function formatTelegramResults(results, searchParams) {
    if (!results || results.length === 0) {
        return '😔 *No results found*\n\nTry different dates or stations, or check if the route exists.';
    }

    const { departureStation, destinationStation, tripType } = searchParams;
    let message = `🎯 *Search Results*\n`;
    message += `📍 ${departureStation.name} → ${destinationStation.name}\n`;
    message += `🚂 Trip type: ${formatTripType(tripType)}\n\n`;

    // Show up to 5 best results
    const topResults = results.slice(0, 5);
    
    topResults.forEach((result, index) => {
        const price = result.totalPrice ? `€${result.totalPrice}` : 'Price unavailable';
        const date = new Date(result.date).toLocaleDateString('en-GB', {
            weekday: 'short',
            day: '2-digit',
            month: '2-digit'
        });
        
        message += `*${index + 1}. ${price}* - ${date}\n`;
        
        if (result.outbound) {
            const outDep = new Date(result.outbound.departure).toLocaleTimeString('en-GB', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            const outArr = new Date(result.outbound.arrival).toLocaleTimeString('en-GB', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            const outDuration = formatDuration(result.outbound.departure, result.outbound.arrival);
            message += `   🚄 Out: ${result.outbound.line || 'Train'} | ${outDep} → ${outArr} (${outDuration})\n`;
        }
        
        if (result.return) {
            const retDep = new Date(result.return.departure).toLocaleTimeString('en-GB', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            const retArr = new Date(result.return.arrival).toLocaleTimeString('en-GB', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            const retDuration = formatDuration(result.return.departure, result.return.arrival);
            message += `   🔄 Ret: ${result.return.line || 'Train'} | ${retDep} → ${retArr} (${retDuration})\n`;
        }
        
        message += '\n';
    });

    if (results.length > 5) {
        message += `_... and ${results.length - 5} more results available_\n\n`;
    }
    
    message += `💡 *Tip:* Book early for better prices!\n`;
    message += `🔗 Book on: [DB Navigator](https://www.bahn.de)`;

    return message;
}

export function formatTripType(tripType) {
    const types = {
        'same-day': '🔄 Same Day Return',
        'one-way': '➡️ One Way',
        'multi-day': '📅 Multi-Day'
    };
    return types[tripType] || tripType;
}

export function formatDuration(departureTime, arrivalTime) {
    const dep = new Date(departureTime);
    const arr = new Date(arrivalTime);
    const durationMs = arr - dep;
    
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
        return `${hours}h${minutes > 0 ? ` ${minutes}m` : ''}`;
    } else {
        return `${minutes}m`;
    }
}

export function formatWelcomeMessage() {
    return `
🎯 *Welcome to DB Price Hunter Bot!*

I help you find the cheapest Deutsche Bahn train tickets with flexible routing and time preferences.

*What I can do:*
🔍 Search for train tickets
🚄 Quick searches with popular routes
💰 Find the best prices across multiple dates
⏰ Filter by departure times
📊 Compare different travel options

*Get started:*
• Use the buttons below
• Type /search for ticket search
• Type /route for quick routes
• Type /help for more information

Ready to hunt for cheap train tickets? 🚂💰
    `.trim();
}

export function formatHelpMessage() {
    return `
🆘 *DB Price Hunter Bot Help*

*Main Commands:*
• /start - Show main menu
• /search - Interactive ticket search
• /route - Quick predefined route search
• /help - Show this help message

*Quick Search Examples:*
You can also send messages like:
• \`Berlin Munich 2025-08-15\` - Same day return
• \`Hamburg Frankfurt 2025-08-20 one-way\` - One way trip
• \`Cologne Dortmund 2025-08-15 to 2025-08-20\` - Date range

*Search Features:*
✅ Multiple trip types (same-day, one-way, multi-day)
✅ Flexible date ranges
✅ Time preferences (morning, afternoon, etc.)
✅ Popular route shortcuts
✅ Price comparison across dates

*Tips:*
💡 Book early for better prices
💡 Try different dates for cheaper options
💡 Use date ranges to find the best deals
💡 Check both directions for different cities

*Need help?* Just type your message and I'll try to help!
    `.trim();
}

export function formatErrorMessage(error, context = '') {
    const baseMessage = '❌ *Oops! Something went wrong*\n\n';
    
    if (error.message && error.message.includes('station')) {
        return baseMessage + 
               '🚉 Could not find the station you specified.\n' +
               'Please check the spelling and try again.\n\n' +
               '💡 *Tip:* Try "Berlin Hbf" instead of just "Berlin"';
    }
    
    if (error.message && error.message.includes('network')) {
        return baseMessage + 
               '🌐 Network connection problem.\n' +
               'Please try again in a moment.\n\n' +
               '💡 *Tip:* Check your internet connection';
    }
    
    return baseMessage + 
           'Please try again or contact support if the problem persists.\n\n' +
           (context ? `*Context:* ${context}` : '');
}

export function formatSearchProgress(stage, details = '') {
    const messages = {
        'looking_up_station': `🔍 Looking up station${details ? `: ${details}` : ''}...`,
        'searching': '🚂 Searching for connections...',
        'processing': '⚙️ Processing results...',
        'formatting': '📋 Formatting results...'
    };
    
    return messages[stage] || `⏳ ${stage}...`;
}