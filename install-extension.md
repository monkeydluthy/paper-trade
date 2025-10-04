# 🚀 How to Install and Test Your Chrome Extension

## Step-by-Step Installation

### 1. Prepare Your Extension

```bash
# Navigate to your extension folder
cd /Users/monkeydluthy/Desktop/paper-trade

# Verify all files are present
ls -la
# You should see:
# - manifest.json
# - popup.html
# - popup.js
# - styles.css
# - background.js
# - content.js
# - README.md
# - test-extension.html
```

### 2. Load Extension in Chrome

1. **Open Chrome** and go to `chrome://extensions/`
2. **Enable Developer Mode** (toggle switch in top-right corner)
3. **Click "Load unpacked"**
4. **Select your `paper-trade` folder**
5. **Verify the extension appears** in the list

### 3. Pin the Extension

1. **Click the puzzle piece icon** in Chrome toolbar
2. **Find "Crypto Paper Trader"** in the list
3. **Click the pin icon** to pin it to toolbar
4. **Click the extension icon** to open the popup

## 🧪 Testing Your Extension

### Quick Test (5 minutes)

1. **Open the extension popup**
2. **Go to Settings tab**
3. **Set starting balance to 50000**
4. **Click "Update Balance"**
5. **Go to Trading tab**
6. **Search for "DOGE"**
7. **Enter amount: 1000**
8. **Click "Execute Trade"**
9. **Go to Portfolio tab**
10. **Verify your holdings appear**

### Advanced Test (15 minutes)

1. **Open `test-extension.html` in Chrome**
2. **Run all test buttons**
3. **Check console for errors**
4. **Test multiple coins (DOGE, SHIB, PEPE)**
5. **Test buy and sell orders**
6. **Verify data persists after closing popup**

## 🔍 Debugging

### Check Console for Errors

1. **Right-click extension icon → "Inspect popup"**
2. **Go to Console tab**
3. **Look for any red error messages**
4. **Test functionality and watch for errors**

### Common Issues & Fixes

#### Issue: Extension won't load

**Fix:** Check `manifest.json` syntax

```bash
# Validate JSON syntax
cat manifest.json | python -m json.tool
```

#### Issue: Popup doesn't open

**Fix:** Check file paths in manifest

```json
{
  "action": {
    "default_popup": "popup.html" // Must match filename
  }
}
```

#### Issue: Trades not saving

**Fix:** Check Chrome storage permissions

```json
{
  "permissions": ["storage"] // Must be included
}
```

## 📊 Test Scenarios

### Scenario 1: New User

- Starting balance: $10,000
- Buy 1,000 DOGE at $0.08
- Expected: $9,920 remaining, 1,000 DOGE held

### Scenario 2: Active Trading

- Buy multiple coins
- Mix of profitable/losing trades
- Portfolio value changes

### Scenario 3: Error Handling

- Try to sell more than you own
- Enter negative amounts
- Search invalid symbols

## ✅ Success Checklist

- [ ] Extension loads without errors
- [ ] Popup opens and displays correctly
- [ ] All tabs are accessible
- [ ] Settings can be modified
- [ ] Coin search works
- [ ] Trades can be executed
- [ ] Portfolio updates correctly
- [ ] Data persists between sessions
- [ ] No console errors
- [ ] Performance is acceptable

## 🚀 Ready to Test!

Your extension is ready for testing! Follow the steps above and use the test page to verify everything works correctly.

**Happy Trading! 📈🚀**
