# 🚀 Quick Start: Local Proxy Server

## Why You Need This
The Chrome extension cannot fetch prices directly from APIs due to CORS restrictions. This local proxy server solves that problem by running on your machine and fetching prices on behalf of the extension.

---

## 📋 Step-by-Step Setup

### Step 1: Start the Proxy Server

Open a **new terminal window** and run:

```bash
cd /Users/monkeydluthy/Desktop/paper-trade/proxy-server
node server.js
```

You should see this:
```
╔════════════════════════════════════════════════════════════╗
║   🚀 Crypto Paper Trader Proxy Server                     ║
║   Status: Running                                          ║
║   Port: 3000                                               ║
║   URL: http://localhost:3000                               ║
╚════════════════════════════════════════════════════════════╝
```

✅ **Leave this terminal window open!** The server must keep running.

---

### Step 2: Test the Proxy

Open your browser and visit:
```
http://localhost:3000?address=51aXwxgrWKRXJGwWVVgE3Jrs2tWKhuNadfsEt6j2pump
```

You should see JSON response like:
```json
{
  "success": true,
  "price": 288000,
  "source": "DexScreener",
  "address": "51aX..."
}
```

If you see this, **the proxy is working!** 🎉

---

### Step 3: Reload the Extension

1. Go to `chrome://extensions`
2. Find "Crypto Paper Trader"
3. Click the **reload icon** (🔄)

---

### Step 4: Test a Snipe

1. Go to https://axiom.trade/pulse
2. Click a **SNIPE** button on any token
3. Open the side panel to see your portfolio
4. **Wait 30 seconds** for the first price update

---

## 🔍 How to Verify It's Working

### In the Browser Console

Look for these logs after sniping:
```
📡 Fetching price for tariffcoin (51aX...)
🔍 Trying local proxy server for tariffcoin...
✅ Local proxy returned price for tariffcoin: $288000 (source: DexScreener)
📈 New price for tariffcoin: $288000
```

### In the Proxy Server Terminal

You should see:
```
🔔 Received request for address: 51aX...
🌐 Trying PumpPortal: https://api.pumpportal.fun/coin/51aX...
❌ PumpPortal failed: Connection error
🌐 Trying Jupiter: https://price.jup.ag/v4/price?ids=51aX...
✅ SUCCESS! Got price $288000 from Jupiter
```

---

## ✅ Success Indicators

| Indicator | What to Look For |
|-----------|-----------------|
| **Proxy Server** | Terminal shows "Running on port 3000" |
| **Test URL** | Browser shows JSON with `"success": true` |
| **Extension Console** | Logs show "✅ Local proxy returned price" |
| **Portfolio** | P&L updates after 30 seconds |

---

## ❌ Troubleshooting

### Problem: "Port 3000 already in use"

**Solution**: Use a different port

1. Edit `proxy-server/server.js`:
   ```javascript
   const PORT = 3001; // Change to 3001 or any free port
   ```

2. Edit `background.js`:
   ```javascript
   const proxyUrl = `http://localhost:3001?address=${contractAddress}`;
   ```

3. Restart proxy server and reload extension

---

### Problem: Extension logs show "Local proxy not available"

**Checklist**:
- ✅ Is proxy server running? (Check terminal)
- ✅ Can you access `http://localhost:3000?address=test` in browser?
- ✅ Did you reload the extension after starting the proxy?
- ✅ Is `http://localhost:*` in manifest.json permissions?

---

### Problem: Proxy returns `"success": false`

This means **all APIs failed** for that specific token. Possible reasons:
- Token is too new (not indexed by any API yet)
- Token has graduated from Pump.fun (moved to Raydium)
- APIs are temporarily down

**Fallback**: Extension will keep the last known price or try content script scraping

---

### Problem: Node.js not found

**Solution**: Install Node.js

```bash
# Check if Node.js is installed
node --version

# If not installed, download from:
# https://nodejs.org/ (use LTS version)
```

---

## 🎯 Expected Behavior

### When Proxy is Running ✅
```
Snipe Token → Extension calls proxy → Proxy calls API → Returns price → Portfolio updates
```

**Price updates every 30 seconds** automatically!

### When Proxy is NOT Running ⚠️
```
Snipe Token → Extension tries APIs directly → CORS error → Falls back to scraping → Limited updates
```

**Only updates when on Axiom page** with token visible

---

## 🔄 Daily Workflow

### Starting Your Session
1. Open terminal
2. `cd paper-trade/proxy-server`
3. `node server.js`
4. Leave terminal open
5. Use extension normally

### Stopping
- Close the terminal window, or
- Press `Ctrl+C` in the terminal

---

## 📊 What the Proxy Does

```
Extension Request:
GET http://localhost:3000?address=51aX...

↓

Proxy tries in order:
1. PumpPortal API    → usd_market_cap
2. Jupiter API       → price (token price in SOL)
3. Pump.fun API      → market_cap
4. DexScreener API   → fdv (market cap)

↓

First successful API returns data:
{
  "success": true,
  "price": 288000,
  "source": "DexScreener"
}

↓

Extension updates portfolio:
✅ P&L recalculated
✅ Balance updated
✅ UI refreshed
```

---

## 🚀 Next Steps

Once you confirm the local proxy works:

1. **Deploy to Vercel** (free, takes 5 minutes)
   - No need to keep terminal open
   - Works from any computer
   - More reliable

2. **Share with friends**
   - They can use your deployed proxy
   - Or deploy their own

---

## 💡 Pro Tips

### Keep Proxy Running in Background

**macOS/Linux**:
```bash
nohup node server.js > proxy.log 2>&1 &
```

**Windows** (use PM2):
```bash
npm install -g pm2
pm2 start server.js --name crypto-proxy
```

### Monitor Proxy Logs
```bash
tail -f proxy.log  # Follow logs in real-time
```

### Test Specific Token
```bash
curl "http://localhost:3000?address=YOUR_TOKEN_ADDRESS_HERE"
```

---

## 📞 Need Help?

If the proxy isn't working:

1. **Check proxy server logs** (terminal where `node server.js` is running)
2. **Check extension console** (F12 → Console tab)
3. **Test the proxy URL directly** in your browser
4. **Verify Node.js version**: `node --version` (should be v14+)

---

## 🎉 You're All Set!

Once you see `✅ Local proxy returned price` in the extension console, you're good to go!

The extension will now **automatically fetch real-time prices** every 30 seconds. 🚀

