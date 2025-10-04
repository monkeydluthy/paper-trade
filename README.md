# Crypto Paper Trader - Chrome Extension

A Chrome extension for paper trading cryptocurrency with real-time price tracking and portfolio management. Perfect for testing trading strategies without risking real money.

## Features

- 🚀 **Paper Trading**: Buy and sell crypto without real money
- 📊 **Real-time Price Tracking**: Scrape prices from multiple sources
- 💰 **Portfolio Management**: Track your holdings and P&L
- 🎯 **Memecoin Focus**: Optimized for trading memecoins and altcoins
- 🔄 **Auto Price Updates**: Background price monitoring
- 💾 **Data Persistence**: Your trades are saved locally
- 🎨 **Modern UI**: Clean, responsive interface

## Installation

### Method 1: Load as Unpacked Extension (Development)

1. **Download/Clone** this repository to your local machine
2. **Open Chrome** and navigate to `chrome://extensions/`
3. **Enable Developer Mode** by toggling the switch in the top right
4. **Click "Load unpacked"** and select the extension folder
5. **Pin the extension** to your toolbar for easy access

### Method 2: Build from Source

```bash
# Clone the repository
git clone <repository-url>
cd paper-trade

# No build process required - it's a pure JavaScript extension
# Just load the folder as an unpacked extension in Chrome
```

## Usage

### Getting Started

1. **Open the Extension**: Click the extension icon in your Chrome toolbar
2. **Set Starting Balance**: Go to Settings tab and set your paper trading balance (default: $10,000)
3. **Search for Coins**: Use the Trading tab to search for any cryptocurrency
4. **Execute Trades**: Buy or sell coins with the current market price

### Trading Interface

- **Search**: Enter any coin symbol (e.g., DOGE, SHIB, PEPE)
- **Price Display**: See current price and 24h change
- **Trade Execution**: Enter amount and choose buy/sell
- **Portfolio Tracking**: Monitor your holdings and P&L

### Portfolio Management

- **Real-time Updates**: Prices update automatically every 30 seconds
- **P&L Tracking**: See your profit/loss for each holding
- **Balance Tracking**: Monitor your available balance
- **Holdings List**: View all your current positions

### Price Sources

The extension can scrape prices from:

- CoinMarketCap
- CoinGecko
- Binance
- Coinbase
- Generic web scraping from any trading platform

## Technical Details

### Architecture

- **Manifest V3**: Modern Chrome extension architecture
- **Service Worker**: Background script for price monitoring
- **Content Scripts**: Web scraping capabilities
- **Chrome Storage**: Local data persistence
- **Real-time Updates**: Background price fetching

### File Structure

```
paper-trade/
├── manifest.json          # Extension configuration
├── popup.html            # Main UI interface
├── popup.js              # Main application logic
├── styles.css            # UI styling
├── background.js         # Background service worker
├── content.js            # Web scraping script
└── README.md            # This file
```

### Data Storage

- **Portfolio Data**: Stored in Chrome's local storage
- **Settings**: User preferences and configuration
- **Price Cache**: Temporary price data for performance

## Development

### Adding New Price Sources

To add support for new trading platforms:

1. **Update `content.js`**: Add platform detection and selectors
2. **Update `background.js`**: Add new API endpoints
3. **Test**: Verify price scraping works correctly

### Customizing the UI

- **Styles**: Modify `styles.css` for visual changes
- **Layout**: Update `popup.html` for structural changes
- **Functionality**: Extend `popup.js` for new features

## Security & Privacy

- **No External APIs**: All data stays on your device
- **No Personal Data**: No account linking or personal information
- **Local Storage Only**: All data stored locally in Chrome
- **No Network Requests**: Price data scraped from public pages

## Troubleshooting

### Common Issues

1. **Extension Not Loading**

   - Ensure Developer Mode is enabled
   - Check for JavaScript errors in console
   - Verify all files are present

2. **Price Not Updating**

   - Check if the website is supported
   - Try refreshing the page
   - Verify internet connection

3. **Data Not Saving**
   - Check Chrome storage permissions
   - Clear extension data and restart
   - Verify storage quota isn't exceeded

### Debug Mode

Enable debug logging:

1. Open Chrome DevTools
2. Go to Console tab
3. Look for extension-related messages

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is open source and available under the MIT License.

## Disclaimer

This is a paper trading extension for educational purposes only. It does not provide real trading capabilities or financial advice. Always do your own research before making any real investment decisions.

## Support

For issues, questions, or feature requests:

- Open an issue on GitHub
- Check the troubleshooting section
- Review the code comments for implementation details

---

**Happy Paper Trading! 🚀📈**
