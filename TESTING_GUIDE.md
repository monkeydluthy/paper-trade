# Testing Guide for Crypto Paper Trader Extension

## 🚀 Quick Start Testing

### 1. Load the Extension in Chrome

1. **Open Chrome** and navigate to `chrome://extensions/`
2. **Enable Developer Mode** (toggle in top-right corner)
3. **Click "Load unpacked"** and select your `paper-trade` folder
4. **Pin the extension** to your toolbar (click the puzzle piece icon, then pin)

### 2. Basic Functionality Test

#### Test 1: Extension Loading

- ✅ Extension appears in Chrome toolbar
- ✅ Clicking extension opens popup window
- ✅ All three tabs (Trading, Portfolio, Settings) are visible

#### Test 2: Settings Configuration

1. Go to **Settings** tab
2. Set starting balance to `50000` (or any amount)
3. Click **"Update Balance"**
4. Verify notification appears: "Starting balance updated"

#### Test 3: Coin Search & Trading

1. Go to **Trading** tab
2. Search for `DOGE` (or any coin symbol)
3. Verify:
   - Coin info appears with price and change
   - Price shows in format like `$0.000123`
   - 24h change shows as percentage

#### Test 4: Execute Trades

1. Enter amount: `1000` (coins to buy)
2. Select **Buy** from dropdown
3. Click **"Execute Trade"**
4. Verify:
   - Success notification appears
   - Trade amount field clears
   - Portfolio value updates

#### Test 5: Portfolio Tracking

1. Go to **Portfolio** tab
2. Verify:
   - Total Invested shows your trade amount
   - Current Value shows current portfolio value
   - P&L shows profit/loss
   - Holdings list shows your DOGE position

### 3. Advanced Testing

#### Test 6: Multiple Coins

1. Search for `SHIB`
2. Buy 500,000 SHIB
3. Search for `PEPE`
4. Buy 1,000,000 PEPE
5. Check Portfolio tab shows all holdings

#### Test 7: Sell Orders

1. Go back to DOGE
2. Change to **Sell** in dropdown
3. Enter amount: `500` (half your DOGE)
4. Execute trade
5. Verify holdings updated

#### Test 8: Balance Validation

1. Try to buy more than your balance allows
2. Verify error message: "Insufficient balance for this trade"

#### Test 9: Data Persistence

1. Close the extension popup
2. Reopen the extension
3. Verify your portfolio data is still there

## 🔧 Developer Testing

### Console Testing

1. **Open Chrome DevTools** (F12)
2. **Go to Console tab**
3. **Test extension functions:**

```javascript
// Test if extension is loaded
console.log('Extension loaded:', !!window.cryptoPaperTrader);

// Test storage
chrome.storage.local.get(['portfolio', 'settings'], (data) => {
  console.log('Stored data:', data);
});

// Test price fetching
chrome.runtime.sendMessage(
  {
    action: 'getPrice',
    symbol: 'DOGE',
  },
  (response) => {
    console.log('Price response:', response);
  }
);
```

### Network Testing

1. **Open DevTools → Network tab**
2. **Search for a coin**
3. **Verify no external API calls** (extension uses simulated data)

### Storage Testing

1. **Go to DevTools → Application tab**
2. **Click "Storage" → "Local Storage"**
3. **Look for your extension data**
4. **Verify portfolio and settings are stored**

## 🐛 Common Issues & Solutions

### Issue 1: Extension Won't Load

**Symptoms:** "Load unpacked" button doesn't work
**Solutions:**

- Ensure all files are in the same folder
- Check `manifest.json` syntax
- Try refreshing the extensions page

### Issue 2: Popup Doesn't Open

**Symptoms:** Clicking extension icon does nothing
**Solutions:**

- Check if extension is enabled
- Verify `popup.html` exists
- Check console for JavaScript errors

### Issue 3: Trades Not Saving

**Symptoms:** Portfolio resets after closing popup
**Solutions:**

- Check Chrome storage permissions
- Verify `popup.js` saveData() function
- Check console for storage errors

### Issue 4: Price Not Updating

**Symptoms:** Prices stay the same
**Solutions:**

- Check background script is running
- Verify price update interval
- Check console for fetch errors

## 📊 Test Data Scenarios

### Scenario 1: New User

- Starting balance: $10,000
- Buy 1,000 DOGE at $0.08
- Expected: $9,920 remaining, 1,000 DOGE held

### Scenario 2: Active Trader

- Multiple coin positions
- Mix of profitable and losing trades
- Portfolio value changes over time

### Scenario 3: Edge Cases

- Try to sell more than you own
- Enter negative amounts
- Search for invalid coin symbols

## 🔍 Debugging Tips

### Enable Debug Mode

Add this to your browser console:

```javascript
// Enable detailed logging
localStorage.setItem('debug', 'true');
```

### Check Extension State

```javascript
// Get current extension state
chrome.storage.local.get(null, (data) => {
  console.log('Full extension state:', data);
});
```

### Monitor Price Updates

```javascript
// Listen for price updates
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'priceUpdate') {
    console.log('Price updated:', message.data);
  }
});
```

## ✅ Testing Checklist

### Basic Functionality

- [ ] Extension loads without errors
- [ ] Popup opens and displays correctly
- [ ] All tabs are accessible
- [ ] Settings can be modified
- [ ] Coin search works
- [ ] Trades can be executed
- [ ] Portfolio updates correctly
- [ ] Data persists between sessions

### Advanced Features

- [ ] Multiple coins can be traded
- [ ] Buy and sell orders work
- [ ] Balance validation works
- [ ] Error messages display properly
- [ ] Notifications appear
- [ ] Price updates in background

### Edge Cases

- [ ] Invalid inputs are handled
- [ ] Insufficient balance is caught
- [ ] Network errors are handled
- [ ] Extension works after browser restart

## 🚀 Performance Testing

### Memory Usage

1. **Open Chrome Task Manager** (Shift+Esc)
2. **Monitor extension memory usage**
3. **Trade multiple coins**
4. **Verify memory doesn't grow excessively**

### Speed Testing

1. **Time how long trades take to execute**
2. **Test price update frequency**
3. **Verify UI responsiveness**

## 📱 Cross-Platform Testing

### Different Chrome Versions

- Test on Chrome 90+
- Verify Manifest V3 compatibility
- Check for deprecated API usage

### Different Operating Systems

- Windows 10/11
- macOS
- Linux

## 🎯 User Acceptance Testing

### Real User Scenarios

1. **New user onboarding**
2. **Daily trading routine**
3. **Portfolio monitoring**
4. **Settings management**

### Usability Testing

- Is the interface intuitive?
- Are error messages clear?
- Is the workflow logical?
- Are notifications helpful?

---

## 🏆 Success Criteria

Your extension is working correctly if:

- ✅ All basic functionality works
- ✅ No console errors
- ✅ Data persists correctly
- ✅ UI is responsive
- ✅ Error handling works
- ✅ Performance is acceptable

**Happy Testing! 🚀📈**
