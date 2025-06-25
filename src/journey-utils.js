// Journey utilities - date/time handling and journey data extraction

// Format date for display
export function formatDate(date) {
    return new Intl.DateTimeFormat('en-US', { 
        weekday: 'short', 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    }).format(date);
}

// Format time for display
export function formatTime(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

// Parse date with flexible year handling
export function parseFlexibleDate(input) {
    const trimmed = input.trim();
    
    // Check if it's in MM-DD format (missing year)
    if (/^\d{1,2}-\d{1,2}$/.test(trimmed)) {
        const currentYear = new Date().getFullYear();
        return new Date(`${currentYear}-${trimmed}`);
    }
    
    // Check if it's in YYYY-MM-DD format
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(trimmed)) {
        return new Date(trimmed);
    }
    
    // Try parsing as-is for other formats
    return new Date(trimmed);
}

// Validate date input with flexible year handling
export function validateDate(input) {
    if (!input || input.trim().length === 0) {
        return 'Please enter a date';
    }
    
    const date = parseFlexibleDate(input);
    if (isNaN(date.getTime())) {
        return 'Please enter a valid date (YYYY-MM-DD or MM-DD for current year)';
    }
    
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Reset time to start of day for comparison
    date.setHours(0, 0, 0, 0); // Reset input date time as well
    
    if (date <= now) { // Use <= to reject today as well
        return 'Date must be in the future';
    }
    
    return true;
}

// Extract journey information
export function extractJourneyInfo(journey) {
    const firstLeg = journey.legs[0];
    const lastLeg = journey.legs[journey.legs.length - 1];
    
    // Get transportation legs only (skip walking)
    const transportationLegs = journey.legs.filter(leg => leg.line);
    
    // Create combined train name for multi-leg journeys
    const trainNames = transportationLegs
        .map(leg => leg.line.name || 'Unknown')
        .filter((name, index, array) => array.indexOf(name) === index); // Remove duplicates
    
    const combinedTrainName = trainNames.length > 1 
        ? trainNames.join(' + ') 
        : trainNames[0] || 'Unknown';
    
    // Calculate actual transfers: number of transportation segments minus 1
    const actualTransfers = Math.max(0, transportationLegs.length - 1);
    
    return {
        departure: firstLeg.plannedDeparture || firstLeg.departure,
        arrival: lastLeg.plannedArrival || lastLeg.arrival,
        price: journey.price.amount,
        currency: journey.price.currency || 'EUR',
        trainName: combinedTrainName,
        product: firstLeg.line?.product || 'train',
        transfers: actualTransfers,
        legs: journey.legs.length,
        transportationLegs: transportationLegs.length,
        allTrains: trainNames // Keep individual train names for additional info if needed
    };
}