# 🤖 DB Price Hunter Telegram Bot

A Telegram bot version of the DB Price Hunter CLI tool that helps you find the cheapest Deutsche Bahn train tickets.

## 🚀 Quick Start

### 1. Create Telegram Bot

1. Open Telegram and find `@BotFather`
2. Send `/newbot` and follow the instructions
3. Choose a name (e.g., "DB Price Hunter Bot")
4. Choose a username ending in `bot` (e.g., `db_price_hunter_bot`)
5. Save the bot token

### 2. Set Up Bot Commands

Send `/setcommands` to BotFather and paste:
```
start - Start the bot and show main menu
search - Search for train tickets
route - Quick search with predefined routes
help - Show help and usage information
```

### 3. Run the Bot

```bash
# Set your bot token
export BOT_TOKEN="your_bot_token_here"

# Test the setup
node bot/test-bot.js

# Run in development mode (with auto-restart)
npm run bot:dev

# Run in production mode
npm run bot
```

## 🎯 Features

### Interactive Search
- **Guided conversation**: Step-by-step prompts for easy searching
- **Station lookup**: Smart station name resolution
- **Multiple trip types**: Same-day return, one-way, multi-day
- **Date flexibility**: Single dates or date ranges

### Quick Search
Send messages like:
- `Berlin Munich 2025-08-15` - Same day return
- `Hamburg Frankfurt 2025-08-20 one-way` - One way trip
- `Cologne Dortmund 2025-08-15 to 2025-08-20` - Date range

### Smart Interface
- **Inline keyboards**: Easy button navigation
- **Error handling**: Helpful error messages and recovery
- **Progress indicators**: Real-time search progress
- **Formatted results**: Clean, readable ticket information

## 🛠️ Development

### Project Structure
```
bot/
├── bot.js                 # Main bot entry point
├── handlers/
│   ├── commands.js        # Command handlers (/start, /help, etc.)
│   ├── conversations.js   # Interactive search conversation
│   ├── keyboards.js       # Inline keyboard layouts
│   └── quick-search.js    # Text-based quick search
├── utils/
│   ├── formatter.js       # Message formatting
│   └── validator.js       # Input validation
├── middleware/
│   └── error.js          # Error handling
└── test-bot.js           # Setup verification script
```

### Key Components

**Main Bot** (`bot.js`)
- Bot initialization and configuration
- Session management
- Global error handling
- Graceful shutdown

**Commands** (`handlers/commands.js`)
- `/start` - Welcome message and main menu
- `/search` - Start interactive search
- `/route` - Quick route selection
- `/help` - Usage information

**Conversations** (`handlers/conversations.js`)
- Interactive 4-step search process
- Station lookup and validation
- Trip type selection
- Date input and validation

**Quick Search** (`handlers/quick-search.js`)
- Parse text messages for quick searches
- Support various input formats
- Integrate with existing search functions

## 🔧 Configuration

The bot uses the same configuration as the CLI tool (`~/.db-price-hunter/config.json`):

```json
{
  "preferences": {
    "maxConcurrency": 2,
    "retryAttempts": 3,
    "searchTimeout": 300000
  },
  "commonRoutes": {
    "berlin-munich": {
      "departure": { "id": "8011160", "name": "Berlin Hbf" },
      "destination": { "id": "8000261", "name": "München Hbf" }
    }
  }
}
```

## 🚀 Deployment

### Railway (Recommended)

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Add Telegram bot"
   git push origin main
   ```

2. **Deploy on Railway**
   - Go to [railway.app](https://railway.app)
   - Create new project from GitHub repo
   - Set environment variable: `BOT_TOKEN=your_token`
   - Deploy automatically

3. **Configuration**
   - The `railway.json` file configures the deployment
   - Uses `npm run bot` as the start command
   - Includes health checks and restart policies

### Environment Variables

- `BOT_TOKEN` - Your Telegram bot token (required)
- `NODE_ENV` - Set to `production` for production deployment

## 📊 Usage Examples

### Interactive Search
```
User: /search
Bot: 🚉 Step 1/4: Departure Station
     Enter your departure station (e.g., "Berlin Hbf"):

User: Berlin
Bot: ✅ Departure: Berlin Hbf
     🎯 Step 2/4: Destination Station
     Enter your destination station:

User: Munich
Bot: ✅ Destination: München Hbf
     🚂 Step 3/4: Trip Type
     What type of trip are you planning?
     [Same Day Return] [One Way] [Multi-Day]

User: [Same Day Return]
Bot: ✅ Trip type: 🔄 Same Day Return
     📅 Step 4/4: Travel Date
     Enter your travel date: 2025-08-15

User: 2025-08-15
Bot: 🔍 Searching for connections...
     
     🎯 Search Results
     📍 Berlin Hbf → München Hbf
     
     1. €89.90 - Thu, 15/08
        🚄 Out: ICE 587 | 08:34 → 12:28 (3h54m)
        🔄 Ret: ICE 1006 | 18:32 → 22:28 (3h56m)
```

### Quick Search
```
User: Berlin Munich 2025-08-15
Bot: 🔍 Looking up stations...
     🚂 Searching for connections...
     
     🎯 Search Results
     📍 Berlin Hbf → München Hbf
     🚂 Trip type: 🔄 Same Day Return
     
     1. €89.90 - Thu, 15/08
        🚄 Out: ICE 587 | 08:34 → 12:28 (3h54m)
        🔄 Ret: ICE 1006 | 18:32 → 22:28 (3h56m)
```

## 🐛 Troubleshooting

### Common Issues

**Bot doesn't respond**
- Check if BOT_TOKEN is set correctly
- Verify bot is running (`npm run bot`)
- Check logs for errors

**"Station not found" errors**
- Try more specific station names (e.g., "Berlin Hbf" vs "Berlin")
- Check spelling of station names
- Use common German station names

**Search timeouts**
- Reduce date ranges for faster searches
- Check internet connection
- Try again during off-peak hours

### Development Tips

- Use `npm run bot:dev` for development (auto-restart on changes)
- Check `node bot/test-bot.js` to verify setup
- Monitor logs for errors and debugging info
- Test with different date ranges and station combinations

## 📝 License

MIT License - same as the main DB Price Hunter project.