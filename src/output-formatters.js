// Output formatters for different display formats
import { writeFileSync } from 'fs';

// Format results as a table
export function formatAsTable(results, tripType, departureCity, destinationCity, returnDepartureCity = null) {
    if (results.length === 0) {
        return 'No results found.';
    }

    // Sort by price
    const sortedResults = [...results].sort((a, b) => a.totalPrice - b.totalPrice);

    // Create table headers
    const headers = tripType === 'one-way' 
        ? ['Date', 'Train', 'Departure', 'Arrival', 'Transfers', 'Price']
        : ['Date', 'Outbound Train', 'Out Dep', 'Out Arr', 'Return Train', 'Ret Dep', 'Ret Arr', 'Total Price'];

    // Calculate column widths
    const colWidths = headers.map(header => header.length);
    
    // Update widths based on data
    sortedResults.slice(0, 10).forEach(result => {
        if (tripType === 'one-way') {
            const journey = result.journey;
            colWidths[0] = Math.max(colWidths[0], result.date.length);
            colWidths[1] = Math.max(colWidths[1], journey.trainName.length);
            colWidths[2] = Math.max(colWidths[2], formatTime(journey.departure).length);
            colWidths[3] = Math.max(colWidths[3], formatTime(journey.arrival).length);
            colWidths[4] = Math.max(colWidths[4], journey.transfers.toString().length);
            colWidths[5] = Math.max(colWidths[5], `€${journey.price.toFixed(2)}`.length);
        } else {
            const dateStr = tripType === 'same-day' ? result.date : `${getShortDate(result.outboundDate)}-${getShortDate(result.returnDate)}`;
            colWidths[0] = Math.max(colWidths[0], dateStr.length);
            colWidths[1] = Math.max(colWidths[1], result.outbound.trainName.length);
            colWidths[2] = Math.max(colWidths[2], formatTime(result.outbound.departure).length);
            colWidths[3] = Math.max(colWidths[3], formatTime(result.outbound.arrival).length);
            colWidths[4] = Math.max(colWidths[4], result.return.trainName.length);
            colWidths[5] = Math.max(colWidths[5], formatTime(result.return.departure).length);
            colWidths[6] = Math.max(colWidths[6], formatTime(result.return.arrival).length);
            colWidths[7] = Math.max(colWidths[7], `€${result.totalPrice.toFixed(2)}`.length);
        }
    });

    // Build table
    let table = '';
    
    // Route information
    if (tripType === 'one-way') {
        table += `Route: ${departureCity} → ${destinationCity}\n`;
    } else if (returnDepartureCity && returnDepartureCity !== destinationCity) {
        table += `Outbound: ${departureCity} → ${destinationCity}\n`;
        table += `Return: ${returnDepartureCity} → ${departureCity}\n`;
    } else {
        table += `Route: ${departureCity} ⇄ ${destinationCity}\n`;
    }
    table += '\n';

    // Header row
    table += '┌' + headers.map((_, i) => '─'.repeat(colWidths[i] + 2)).join('┬') + '┐\n';
    table += '│' + headers.map((header, i) => ` ${header.padEnd(colWidths[i])} `).join('│') + '│\n';
    table += '├' + headers.map((_, i) => '─'.repeat(colWidths[i] + 2)).join('┼') + '┤\n';

    // Data rows
    sortedResults.slice(0, 10).forEach(result => {
        if (tripType === 'one-way') {
            const journey = result.journey;
            const row = [
                result.date.padEnd(colWidths[0]),
                journey.trainName.padEnd(colWidths[1]),
                formatTime(journey.departure).padEnd(colWidths[2]),
                formatTime(journey.arrival).padEnd(colWidths[3]),
                journey.transfers.toString().padEnd(colWidths[4]),
                `€${journey.price.toFixed(2)}`.padEnd(colWidths[5])
            ];
            table += '│' + row.map(cell => ` ${cell} `).join('│') + '│\n';
        } else {
            const dateStr = tripType === 'same-day' ? result.date : `${getShortDate(result.outboundDate)}-${getShortDate(result.returnDate)}`;
            const row = [
                dateStr.padEnd(colWidths[0]),
                result.outbound.trainName.padEnd(colWidths[1]),
                formatTime(result.outbound.departure).padEnd(colWidths[2]),
                formatTime(result.outbound.arrival).padEnd(colWidths[3]),
                result.return.trainName.padEnd(colWidths[4]),
                formatTime(result.return.departure).padEnd(colWidths[5]),
                formatTime(result.return.arrival).padEnd(colWidths[6]),
                `€${result.totalPrice.toFixed(2)}`.padEnd(colWidths[7])
            ];
            table += '│' + row.map(cell => ` ${cell} `).join('│') + '│\n';
        }
    });

    table += '└' + headers.map((_, i) => '─'.repeat(colWidths[i] + 2)).join('┴') + '┘\n';

    return table;
}

// Format results as JSON
export function formatAsJson(results, tripType, departureCity, destinationCity, returnDepartureCity = null) {
    const output = {
        metadata: {
            searchTime: new Date().toISOString(),
            tripType,
            route: {
                departure: departureCity,
                destination: destinationCity,
                returnDeparture: returnDepartureCity
            },
            resultCount: results.length
        },
        results: results.map(result => {
            if (tripType === 'one-way') {
                return {
                    date: result.date,
                    price: result.totalPrice,
                    currency: 'EUR',
                    journey: {
                        trainName: result.journey.trainName,
                        departure: result.journey.departure,
                        arrival: result.journey.arrival,
                        transfers: result.journey.transfers,
                        price: result.journey.price,
                        allTrains: result.journey.allTrains
                    }
                };
            } else {
                const baseResult = {
                    totalPrice: result.totalPrice,
                    currency: 'EUR',
                    outbound: {
                        trainName: result.outbound.trainName,
                        departure: result.outbound.departure,
                        arrival: result.outbound.arrival,
                        transfers: result.outbound.transfers,
                        price: result.outbound.price,
                        allTrains: result.outbound.allTrains
                    },
                    return: {
                        trainName: result.return.trainName,
                        departure: result.return.departure,
                        arrival: result.return.arrival,
                        transfers: result.return.transfers,
                        price: result.return.price,
                        allTrains: result.return.allTrains
                    }
                };

                if (tripType === 'same-day') {
                    baseResult.date = result.date;
                } else {
                    baseResult.outboundDate = result.outboundDate;
                    baseResult.returnDate = result.returnDate;
                }

                return baseResult;
            }
        })
    };

    return JSON.stringify(output, null, 2);
}

// Format results as CSV
export function formatAsCsv(results, tripType) {
    if (results.length === 0) {
        return 'No results found.';
    }

    let csv = '';
    
    if (tripType === 'one-way') {
        // CSV headers for one-way trips
        csv += 'Date,Train,Departure,Arrival,Transfers,Price\n';
        
        results.forEach(result => {
            const journey = result.journey;
            csv += `"${result.date}","${journey.trainName}","${journey.departure}","${journey.arrival}",${journey.transfers},${journey.price.toFixed(2)}\n`;
        });
    } else {
        // CSV headers for round trips
        if (tripType === 'same-day') {
            csv += 'Date,Outbound Train,Outbound Departure,Outbound Arrival,Outbound Transfers,Outbound Price,Return Train,Return Departure,Return Arrival,Return Transfers,Return Price,Total Price\n';
        } else {
            csv += 'Outbound Date,Return Date,Outbound Train,Outbound Departure,Outbound Arrival,Outbound Transfers,Outbound Price,Return Train,Return Departure,Return Arrival,Return Transfers,Return Price,Total Price\n';
        }
        
        results.forEach(result => {
            const dateColumns = tripType === 'same-day' 
                ? `"${result.date}"`
                : `"${result.outboundDate}","${result.returnDate}"`;
                
            csv += `${dateColumns},"${result.outbound.trainName}","${result.outbound.departure}","${result.outbound.arrival}",${result.outbound.transfers},${result.outbound.price.toFixed(2)},"${result.return.trainName}","${result.return.departure}","${result.return.arrival}",${result.return.transfers},${result.return.price.toFixed(2)},${result.totalPrice.toFixed(2)}\n`;
        });
    }

    return csv;
}

// Save output to file
export function saveToFile(content, filename, format) {
    try {
        // Add appropriate file extension if not present
        let finalFilename = filename;
        const extensions = { json: '.json', csv: '.csv', table: '.txt' };
        const ext = extensions[format];
        
        if (ext && !finalFilename.endsWith(ext)) {
            finalFilename += ext;
        }

        writeFileSync(finalFilename, content, 'utf8');
        return { success: true, filename: finalFilename };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Helper functions
function formatTime(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function getShortDate(dateStr) {
    // Convert "Tue, Aug 12, 2025" to "Aug 12"
    const parts = dateStr.split(', ');
    return parts.length >= 2 ? parts[1] : dateStr;
}

// Progress indicator for long-running operations
export class ProgressIndicator {
    constructor(message = 'Processing', showSpinner = true, useTrainAnimation = false) {
        this.message = message;
        this.showSpinner = showSpinner;
        this.useTrainAnimation = useTrainAnimation;
        
        // Traditional spinner characters
        this.spinnerChars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
        
        // Train animation sequences
        this.trainAnimations = [
            // High-speed train sequence
            ['🚅💨    ', ' 🚅💨   ', '  🚅💨  ', '   🚅💨 ', '    🚅💨', '   🚅💨 ', '  🚅💨  ', ' 🚅💨   '],
            // Traditional train sequence
            ['🚂🚃🚃💨', '🚃🚂🚃💨', '🚃🚃🚂💨', '💨🚃🚃🚂', '💨🚃🚂🚃', '💨🚂🚃🚃'],
            // Modern train sequence
            ['🚄💨    ', ' 🚄💨   ', '  🚄💨  ', '   🚄💨 ', '    🚄💨', '   🚄💨 ', '  🚄💨  ', ' 🚄💨   '],
            // Subway sequence
            ['🚇💨    ', ' 🚇💨   ', '  🚇💨  ', '   🚇💨 ', '    🚇💨', '   🚇💨 ', '  🚇💨  ', ' 🚇💨   '],
            // ICE train sequence
            ['🚈💨    ', ' 🚈💨   ', '  🚈💨  ', '   🚈💨 ', '    🚈💨', '   🚈💨 ', '  🚈💨  ', ' 🚈💨   ']
        ];
        
        // Select random train animation
        this.currentAnimation = this.trainAnimations[Math.floor(Math.random() * this.trainAnimations.length)];
        this.currentFrame = 0;
        this.interval = null;
        this.startTime = Date.now();
    }

    start() {
        if (!this.showSpinner) {
            console.log(`${this.message}...`);
            return;
        }

        if (this.useTrainAnimation) {
            process.stdout.write(`${this.currentAnimation[0]} ${this.message}...`);
            
            this.interval = setInterval(() => {
                this.currentFrame = (this.currentFrame + 1) % this.currentAnimation.length;
                const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
                process.stdout.write(`\r${this.currentAnimation[this.currentFrame]} ${this.message}... (${elapsed}s)`);
            }, 200); // Slower animation for trains
        } else {
            process.stdout.write(`${this.spinnerChars[0]} ${this.message}...`);
            
            this.interval = setInterval(() => {
                this.currentFrame = (this.currentFrame + 1) % this.spinnerChars.length;
                const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
                process.stdout.write(`\r${this.spinnerChars[this.currentFrame]} ${this.message}... (${elapsed}s)`);
            }, 100);
        }
    }

    update(newMessage) {
        this.message = newMessage;
        if (this.showSpinner && this.interval) {
            const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
            if (this.useTrainAnimation) {
                process.stdout.write(`\r${this.currentAnimation[this.currentFrame]} ${this.message}... (${elapsed}s)`);
            } else {
                process.stdout.write(`\r${this.spinnerChars[this.currentFrame]} ${this.message}... (${elapsed}s)`);
            }
        }
    }

    stop(finalMessage = null) {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }

        if (this.showSpinner) {
            const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
            if (this.useTrainAnimation) {
                process.stdout.write(`\r🏁 ${finalMessage || this.message} (${elapsed}s)\n`);
            } else {
                process.stdout.write(`\r✓ ${finalMessage || this.message} (${elapsed}s)\n`);
            }
        } else if (finalMessage) {
            console.log(`✓ ${finalMessage}`);
        }
    }

    error(errorMessage) {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }

        if (this.showSpinner) {
            if (this.useTrainAnimation) {
                process.stdout.write(`\r🚑 ${errorMessage}\n`);
            } else {
                process.stdout.write(`\r✗ ${errorMessage}\n`);
            }
        } else {
            console.log(`✗ ${errorMessage}`);
        }
    }
}

// Specialized train progress indicators
export class TrainProgressIndicator extends ProgressIndicator {
    constructor(message = 'Searching for trains', searchType = 'general') {
        super(message, true, true);
        
        // Different train animations based on search type
        const trainTypes = {
            'same-day': [
                ['🚅➡️🏙️ ', ' 🚅➡️🏙️', '  🚅➡️🏙️', '🏙️⬅️🚅 ', ' 🏙️⬅️🚅', '  🏙️⬅️🚅'], // Round trip animation
            ],
            'one-way': [
                ['🚄💨    ', ' 🚄💨   ', '  🚄💨  ', '   🚄💨 ', '    🚄💨', '     🚄'], // One direction
            ],
            'multi-day': [
                ['🚅🌅    ', ' 🚅🌅   ', '  🚅🌅  ', '   🚅🌅 ', '    🚅🌅', '🌙🚅    ', ' 🌙🚅   '], // Day/night travel
            ],
            'general': [
                ['🚈💨    ', ' 🚈💨   ', '  🚈💨  ', '   🚈💨 ', '    🚈💨', '   🚈💨 ', '  🚈💨  ', ' 🚈💨   '], // Generic train
            ]
        };
        
        this.currentAnimation = trainTypes[searchType] ? 
            trainTypes[searchType][0] : 
            trainTypes['general'][0];
    }
}

// Date-specific progress indicator
export class DateProgressIndicator {
    constructor(dateStr, showAnimation = true) {
        this.dateStr = dateStr;
        this.showAnimation = showAnimation;
        this.trains = ['🚅', '🚄', '🚈', '🚇', '🚆'];
        this.currentTrain = this.trains[Math.floor(Math.random() * this.trains.length)];
    }
    
    start() {
        if (this.showAnimation) {
            process.stdout.write(`\n${this.currentTrain} Checking ${this.dateStr}...`);
        } else {
            console.log(`\nChecking ${this.dateStr}...`);
        }
    }
    
    found(price) {
        if (this.showAnimation) {
            process.stdout.write(` ✅ Found: €${price.toFixed(2)}`);
        } else {
            console.log(`  ✓ Found: €${price.toFixed(2)}`);
        }
    }
    
    notFound(reason = 'No suitable journeys') {
        if (this.showAnimation) {
            process.stdout.write(` ❌ ${reason}`);
        } else {
            console.log(`  ✗ ${reason}`);
        }
    }
    
    error(message) {
        if (this.showAnimation) {
            process.stdout.write(` 🚫 Error: ${message}`);
        } else {
            console.log(`  ✗ Error: ${message}`);
        }
    }
}

// Parallel search progress indicator with train animation
export class ParallelSearchProgress {
    constructor(totalDates, concurrency, useAnimation = true) {
        this.totalDates = totalDates;
        this.concurrency = concurrency;
        this.completedDates = 0;
        this.useAnimation = useAnimation;
        this.startTime = Date.now();
        
        // Train animation for parallel search
        this.trains = ['🚅', '🚄', '🚈', '🚇', '🚆'];
        this.currentTrain = 0;
        this.animationInterval = null;
        this.currentMessage = '';
    }
    
    start() {
        if (this.useAnimation) {
            // Show initial train
            this.updateDisplay();
            
            // Animate train every 500ms
            this.animationInterval = setInterval(() => {
                this.currentTrain = (this.currentTrain + 1) % this.trains.length;
                this.updateDisplay();
            }, 500);
        } else {
            console.log(`Starting parallel search for ${this.totalDates} dates (concurrency: ${this.concurrency})`);
        }
    }
    
    updateProgress(message, completed = null) {
        this.currentMessage = message;
        if (completed !== null) {
            this.completedDates = completed;
        }
        
        if (this.useAnimation) {
            this.updateDisplay();
        } else {
            console.log(`  ${message}`);
        }
    }
    
    updateDisplay() {
        const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
        const percentage = Math.round((this.completedDates / this.totalDates) * 100);
        const train = this.trains[this.currentTrain];
        
        // Create a progress bar
        const barLength = 20;
        const filled = Math.round(barLength * (this.completedDates / this.totalDates));
        const empty = barLength - filled;
        const progressBar = '█'.repeat(filled) + '░'.repeat(empty);
        
        process.stdout.write(`\r${train} [${progressBar}] ${percentage}% | ${this.currentMessage} (${elapsed}s)`);
    }
    
    stop(successCount, failureCount = 0) {
        if (this.animationInterval) {
            clearInterval(this.animationInterval);
        }
        
        const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
        
        if (this.useAnimation) {
            // Clear the current line and show final message
            process.stdout.write('\r' + ' '.repeat(80) + '\r');
        }
        
        if (failureCount > 0) {
            console.log(`⚠️  Completed search in ${elapsed}s: ${successCount} successful, ${failureCount} failed`);
        } else {
            console.log(`✅ Completed all ${successCount} searches successfully in ${elapsed}s`);
        }
    }
}