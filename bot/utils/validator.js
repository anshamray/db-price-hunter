// Input validation utilities for the Telegram bot

export function validateDate(dateText) {
    if (!dateText || typeof dateText !== 'string') {
        return { valid: false, error: 'Please provide a valid date.' };
    }
    
    const dateRange = dateText.trim();
    
    // Check for date range (YYYY-MM-DD to YYYY-MM-DD)
    if (dateRange.includes(' to ')) {
        const [startStr, endStr] = dateRange.split(' to ').map(s => s.trim());
        const startDate = parseDate(startStr);
        const endDate = parseDate(endStr);
        
        if (!startDate) {
            return { valid: false, error: `Invalid start date format: "${startStr}". Please use YYYY-MM-DD format.` };
        }
        if (!endDate) {
            return { valid: false, error: `Invalid end date format: "${endStr}". Please use YYYY-MM-DD format.` };
        }
        if (startDate > endDate) {
            return { valid: false, error: 'Start date must be before or equal to end date.' };
        }
        if (startDate < new Date().setHours(0, 0, 0, 0)) {
            return { valid: false, error: 'Start date cannot be in the past.' };
        }
        
        return { valid: true, startDate, endDate };
    }
    
    // Single date
    const singleDate = parseDate(dateRange);
    if (!singleDate) {
        return { valid: false, error: `Invalid date format: "${dateRange}". Please use YYYY-MM-DD format (e.g., 2025-08-15).` };
    }
    if (singleDate < new Date().setHours(0, 0, 0, 0)) {
        return { valid: false, error: 'Date cannot be in the past.' };
    }
    
    return { valid: true, startDate: singleDate };
}

export function parseDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return null;
    
    // Try different date formats
    const formats = [
        /^(\d{4})-(\d{2})-(\d{2})$/, // YYYY-MM-DD
        /^(\d{2})\.(\d{2})\.(\d{4})$/, // DD.MM.YYYY
        /^(\d{2})\/(\d{2})\/(\d{4})$/, // DD/MM/YYYY
    ];
    
    for (const format of formats) {
        const match = dateStr.match(format);
        if (match) {
            let year, month, day;
            
            if (format === formats[0]) { // YYYY-MM-DD
                [, year, month, day] = match;
            } else { // DD.MM.YYYY or DD/MM/YYYY
                [, day, month, year] = match;
            }
            
            const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            
            // Validate the date is real
            if (date.getFullYear() == year && 
                date.getMonth() == month - 1 && 
                date.getDate() == day) {
                return date;
            }
        }
    }
    
    return null;
}

export function validateStationName(stationName) {
    if (!stationName || typeof stationName !== 'string') {
        return { valid: false, error: 'Please provide a valid station name.' };
    }
    
    const trimmed = stationName.trim();
    if (trimmed.length < 2) {
        return { valid: false, error: 'Station name must be at least 2 characters long.' };
    }
    
    if (trimmed.length > 100) {
        return { valid: false, error: 'Station name is too long (max 100 characters).' };
    }
    
    return { valid: true, stationName: trimmed };
}

export function sanitizeInput(input) {
    if (!input || typeof input !== 'string') return '';
    
    // Remove potentially harmful characters but keep German umlauts and common punctuation
    return input.replace(/[<>{}[\]\\]/g, '').trim();
}