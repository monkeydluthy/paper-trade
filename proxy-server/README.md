# Local Proxy Server for Crypto Paper Trader

## 🎯 Purpose
This proxy server runs locally on your machine to bypass CORS restrictions when fetching crypto prices from external APIs.

## 🚀 Quick Start

### 1. Start the Server
```bash
cd proxy-server
node server.js
```

You should see:
```
╔════════════════════════════════════════════════════════════╗
║   🚀 Crypto Paper Trader Proxy Server                     ║
║   Status: Running                                          ║
║   Port: 3000                                               ║
║   URL: http://localhost:3000                               ║
╚════════════════════════════════════════════════════════════╝
```

### 2. Test the Server
Open your browser and visit:
```
http://localhost:3000?address=51aXwxgrWKRXJGwWVVgE3Jrs2tWKhuNadfsEt6j2pump
```

You should get a JSON response like:
```json
{
  "success": true,
  "price": 288000,
  "source": "DexScreener",
  "address": "51aX..."
}
```

### 3. Update the Extension
The extension will automatically use `http://localhost:3000` when it detects the proxy is running.

## 📊 How It Works

1. Extension sends contract address to proxy: `http://localhost:3000?address=<address>`
2. Proxy tries multiple APIs in order:
   - PumpPortal API
   - Jupiter API  
   - Pump.fun API
   - DexScreener API
3. Returns first successful price to extension
4. Extension updates portfolio with new price

## 🔍 API Strategies

The proxy tries these APIs in order:

| API | Endpoint | Format |
|-----|----------|--------|
| PumpPortal | `api.pumpportal.fun/coin/{address}` | `usd_market_cap` |
| Jupiter | `price.jup.ag/v4/price?ids={address}` | `data.{address}.price` |
| Pump.fun | `frontend-api.pump.fun/coins/{address}` | `market_cap` |
| DexScreener | `api.dexscreener.com/latest/dex/tokens/solana/{address}` | `pairs[0].fdv` |

## 🐛 Debugging

The server logs all requests:
```
🔔 Received request for address: 51aX...
🌐 Trying PumpPortal: https://api.pumpportal.fun/coin/51aX...
❌ PumpPortal failed: Connection timeout
🌐 Trying Jupiter: https://price.jup.ag/v4/price?ids=51aX...
✅ SUCCESS! Got price $288000 from Jupiter
```

## 🛠️ Troubleshooting

### Port 3000 already in use
Change the PORT in `server.js`:
```javascript
const PORT = 3001; // or any other port
```

Then update `background.js` to match:
```javascript
const PROXY_URL = 'http://localhost:3001';
```

### Server won't start
Make sure Node.js is installed:
```bash
node --version  # Should show v14 or higher
```

### Extension can't connect
Make sure:
1. Server is running (`node server.js`)
2. Console shows "Running on port 3000"
3. Test URL works in browser: `http://localhost:3000?address=test`

## 📝 Notes

- This is for **local testing only**
- Server must be running for price updates to work
- For production, deploy to Vercel (see main README)
- CORS is enabled for all origins (`*`) - safe for local testing

