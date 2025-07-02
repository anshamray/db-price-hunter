#!/usr/bin/env node

// Test script to verify bot setup without starting the bot

import { createClient } from 'db-vendo-client';
import { profile as dbnavProfile } from 'db-vendo-client/p/dbnav/index.js';
import { loadConfig } from '../src/config.js';
import { validateDate, validateStationName } from './utils/validator.js';
import { formatTelegramResults } from './utils/formatter.js';

console.log('🧪 Testing DB Price Hunter Bot Setup...\n');

// Test 1: Configuration loading
console.log('1. Testing configuration loading...');
try {
    const config = loadConfig();
    console.log('✅ Configuration loaded successfully');
    console.log(`   - Common routes: ${Object.keys(config.commonRoutes).length}`);
    console.log(`   - Max concurrency: ${config.preferences.maxConcurrency}`);
} catch (error) {
    console.log('❌ Configuration failed:', error.message);
}

// Test 2: DB Client initialization
console.log('\n2. Testing DB client initialization...');
try {
    const client = createClient(dbnavProfile, 'db-price-hunter-bot-test');
    console.log('✅ DB client initialized successfully');
} catch (error) {
    console.log('❌ DB client failed:', error.message);
}

// Test 3: Validator functions
console.log('\n3. Testing validator functions...');
try {
    const dateTest = validateDate('2025-08-15');
    console.log('✅ Date validation:', dateTest.valid ? 'passed' : 'failed');
    
    const stationTest = validateStationName('Berlin Hbf');
    console.log('✅ Station validation:', stationTest.valid ? 'passed' : 'failed');
} catch (error) {
    console.log('❌ Validator test failed:', error.message);
}

// Test 4: Formatter functions
console.log('\n4. Testing formatter functions...');
try {
    const mockResults = [{
        totalPrice: 89.90,
        date: '2025-08-15',
        outbound: {
            departure: '2025-08-15T08:30:00',
            arrival: '2025-08-15T12:30:00',
            line: 'ICE 123'
        },
        return: {
            departure: '2025-08-15T18:30:00',
            arrival: '2025-08-15T22:30:00',
            line: 'ICE 456'
        }
    }];
    
    const mockParams = {
        departureStation: { name: 'Berlin Hbf' },
        destinationStation: { name: 'München Hbf' },
        tripType: 'same-day'
    };
    
    const formatted = formatTelegramResults(mockResults, mockParams);
    console.log('✅ Formatter test passed');
    console.log('   Sample output length:', formatted.length, 'characters');
} catch (error) {
    console.log('❌ Formatter test failed:', error.message);
}

// Test 5: Environment check
console.log('\n5. Testing environment...');
if (process.env.BOT_TOKEN) {
    console.log('✅ BOT_TOKEN is set');
    console.log('   Token length:', process.env.BOT_TOKEN.length, 'characters');
} else {
    console.log('⚠️  BOT_TOKEN not set (required for running bot)');
    console.log('   Set with: export BOT_TOKEN="your_token_here"');
}

console.log('\n🎉 Bot setup test completed!');
console.log('\nTo run the bot:');
console.log('1. Get token from @BotFather');
console.log('2. export BOT_TOKEN="your_token_here"');
console.log('3. npm run bot:dev');