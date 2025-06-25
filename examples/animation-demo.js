#!/usr/bin/env node

// Demo script to show off the train animations
import { ProgressIndicator, TrainProgressIndicator, DateProgressIndicator } from '../src/output-formatters.js';

console.log('🚄 DB Train Price Analyzer - Animation Demo\n');

// Demo 1: Traditional spinner
console.log('1. Traditional Spinner:');
const spinner = new ProgressIndicator('Processing request', true, false);
spinner.start();
await new Promise(resolve => setTimeout(resolve, 3000));
spinner.stop('Request completed');

await new Promise(resolve => setTimeout(resolve, 1000));

// Demo 2: Train animation
console.log('\n2. Train Animation:');
const trainProgress = new ProgressIndicator('Searching for connections', true, true);
trainProgress.start();
await new Promise(resolve => setTimeout(resolve, 4000));
trainProgress.stop('Connections found');

await new Promise(resolve => setTimeout(resolve, 1000));

// Demo 3: Date progress indicators
console.log('\n3. Date Progress Demo:');
const dates = ['Sat, Aug 2, 2025', 'Sun, Aug 3, 2025', 'Mon, Aug 4, 2025'];
const prices = [53.98, 45.98, 55.98];

for (let i = 0; i < dates.length; i++) {
    const dateProgress = new DateProgressIndicator(dates[i], true);
    dateProgress.start();
    
    // Simulate search time
    await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));
    
    if (Math.random() > 0.1) { // 90% success rate
        dateProgress.found(prices[i]);
    } else {
        dateProgress.notFound('No suitable journeys');
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
}

// Demo 4: Different train types
console.log('\n4. Different Train Types:');
const trainTypes = ['same-day', 'one-way', 'multi-day'];
const messages = [
    'Searching for same-day return trips',
    'Searching for one-way journeys', 
    'Searching for multi-day trips'
];

for (let i = 0; i < trainTypes.length; i++) {
    console.log(`\n${trainTypes[i].toUpperCase()} trips:`);
    const trainSearch = new TrainProgressIndicator(messages[i], trainTypes[i]);
    trainSearch.start();
    await new Promise(resolve => setTimeout(resolve, 2500));
    trainSearch.stop(`Found ${Math.floor(Math.random() * 10) + 1} options`);
    await new Promise(resolve => setTimeout(resolve, 500));
}

console.log('\n🎉 Animation demo completed!');
console.log('\nTo disable animations in the main app, use:');
console.log('  db-price-analyzer --no-animations');
console.log('\nTo enable them explicitly:');
console.log('  db-price-analyzer --train-animations');