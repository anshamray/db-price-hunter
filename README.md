# 🎯 DB Price Hunter

Hunt for the cheapest Deutsche Bahn train tickets with flexible routing, time preferences, and fun train emoji animations. Never overpay for train travel again!

[![Node.js](https://img.shields.io/badge/Node.js-v18+-green.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## ✨ Features

### 🎯 Smart Price Hunting
- **Flexible routing**: Return from different cities (Berlin → Munich, Dortmund → Berlin)
- **Multiple trip types**: Same-day returns, multi-day trips, one-way journeys
- **Time preferences**: Early (04:00-07:59), Morning, Afternoon, Evening, Late departures
- **Custom time constraints**: Arrive before/after specific times, time ranges
- **Parallel search**: Configurable concurrency (1-8 parallel searches) for faster results

### 🚅 Interactive & Visual
- **Fun train animations**: Animated emoji trains while searching 🚂💨
- **Progress indicators**: Real-time search progress with elapsed time
- **Color-coded results**: Clear visual feedback for all operations
- **Date-by-date progress**: See results as they're found

### 💻 Multiple Interfaces
- **Interactive CLI**: Guided prompts for easy use
- **Command-line mode**: Direct arguments for automation
- **Multiple output formats**: Console, table, JSON, CSV
- **File export**: Save results for further analysis

### ⚙️ Advanced Configuration
- **Persistent settings**: Save preferences in `~/.db-price-hunter/config.json`
- **Common routes**: Pre-configured popular routes (Berlin-Munich, etc.)
- **Favorite stations**: Bookmark frequently used stations
- **Saved searches**: Save and reuse search parameters for frequent trips
- **Retry logic**: Automatic retry with exponential backoff
- **Performance tuning**: Configurable batch processing and API rate limiting

## 🚀 Quick Start

```bash
# Clone and install
git clone https://github.com/yourusername/db-price-hunter.git
cd db-price-hunter
npm install

# Interactive mode (guided prompts)
node db-price-analyzer.js

# Quick search with predefined route
node db-price-analyzer.js --route berlin-munich --date 08-15

# Morning departures with JSON export
node db-price-analyzer.js --route hamburg-frankfurt --date 2025-08-20 --morning --output json
```

## 📋 Command Examples

```bash
# Basic searches
node db-price-analyzer.js --route berlin-munich --date 08-15
node db-price-analyzer.js --route hamburg-frankfurt --date 08-15 --trip-type one-way

# With time preferences
node db-price-analyzer.js --route berlin-munich --date 08-15 --morning
node db-price-analyzer.js --route cologne-dortmund --date 08-15 --evening

# Performance options
node db-price-analyzer.js --route berlin-munich --date 08-15 --concurrency 6
node db-price-analyzer.js --route hamburg-frankfurt --date 08-15 --concurrency 2

# Output formats
node db-price-analyzer.js --route berlin-munich --date 08-15 --output table
node db-price-analyzer.js --route berlin-munich --date 08-15 --output json --output-file results.json

# Save and reuse searches
node db-price-analyzer.js --route berlin-munich --date 08-15 --save-search "weekend-trip"
node db-price-analyzer.js --load-search "weekend-trip"
node db-price-analyzer.js --list-searches
node db-price-analyzer.js --delete-search "old-search"

# Utility commands
node db-price-analyzer.js --list-routes
node db-price-analyzer.js --help
npm run demo  # Watch train animations
```

## 📊 Output Examples

### Console Output (Default)
```
🎯 DB Price Hunter

🚅 Checking Sat, Aug 15, 2025... ✅ Found: €89.90
🚄 Checking Sun, Aug 16, 2025... ✅ Found: €76.90

1. 💰 €76.90 - Available on 1 date:
   📅 Sun, Aug 16, 2025
      🚄 Out: ICE 587 | 08:34 → 12:28 | €38.45 | Direct
      🔄 Ret: ICE 1006 | 18:32 → 22:28 | €38.45 | Direct
```

### Table Format
```
┌─────────────┬──────────┬────────┬────────┬──────────┬────────┬────────┬─────────────┐
│ Date        │ Out Train│ Out Dep│ Out Arr│ Ret Train│ Ret Dep│ Ret Arr│ Total Price │
├─────────────┼──────────┼────────┼────────┼──────────┼────────┼────────┼─────────────┤
│ Aug 16      │ ICE 587  │ 08:34  │ 12:28  │ ICE 1006 │ 18:32  │ 22:28  │ €76.90      │
└─────────────┴──────────┴────────┴────────┴──────────┴────────┴────────┴─────────────┘
```

## 🛠️ Configuration

Auto-generated config at `~/.db-price-hunter/config.json`:

```json
{
  "preferences": {
    "outputFormat": "console",
    "useTrainAnimations": true,
    "maxResults": 10,
    "defaultTripType": "same-day",
    "maxConcurrency": 3
  },
  "commonRoutes": {
    "berlin-munich": {
      "departure": { "id": "8011160", "name": "Berlin Hbf" },
      "destination": { "id": "8000261", "name": "München Hbf" }
    }
  },
  "savedSearches": {
    "weekend-trip": {
      "departureStation": { "id": "8011160", "name": "Berlin Hbf" },
      "destinationStation": { "id": "8000261", "name": "München Hbf" },
      "tripType": "same-day",
      "savedAt": "2025-06-25T10:30:00.000Z"
    }
  }
}
```

## 🏗️ Project Structure

```
db-price-hunter/
├── db-price-analyzer.js      # Main CLI application
├── src/                      # Core modules
│   ├── cli-args.js          # Command-line parsing & concurrency options
│   ├── config.js            # Configuration management
│   ├── search-management.js # Save/load search functionality
│   ├── output-formatters.js # Output formats & parallel search progress
│   ├── error-handler.js     # Parallel search with batch processing
│   ├── time-preferences.js  # Time filtering logic
│   └── ...                  # Other core modules
├── examples/                 # Demo scripts
│   ├── animation-demo.js    # Train animation showcase
│   └── ...                  # Debug utilities
└── README.md
```

## 🤝 Contributing

Contributions welcome! Please open an issue or submit a Pull Request.

## 📝 License

MIT License - see [LICENSE](LICENSE) file.

## 🙏 Acknowledgments

- Built with [db-vendo-client](https://github.com/derhuerst/db-vendo-client)
- Train emoji animations make CLI tools fun! 🚂✨

---

**Happy train travels!** 🚄🎫