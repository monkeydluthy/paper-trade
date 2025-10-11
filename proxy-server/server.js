const http = require('http');
const https = require('https');
const url = require('url');

const PORT = 3000;

// CORS headers for Chrome extension
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

// Helper to fetch from external API
function fetchAPI(apiUrl) {
  return new Promise((resolve, reject) => {
    https.get(apiUrl, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ ok: res.statusCode === 200, data: JSON.parse(data), status: res.statusCode });
        } catch (e) {
          reject(new Error('Invalid JSON response'));
        }
      });
    }).on('error', reject);
  });
}

// Parse price from different API formats
function parsePrice(data, apiName) {
  console.log(`\n📊 Parsing ${apiName} response:`, JSON.stringify(data).slice(0, 200));
  
  // PumpPortal format
  if (data.usd_market_cap) {
    console.log(`✅ Found market cap in PumpPortal format: $${data.usd_market_cap}`);
    return data.usd_market_cap;
  }
  
  // Jupiter format
  if (data.data) {
    const firstKey = Object.keys(data.data)[0];
    if (data.data[firstKey]?.price) {
      const price = parseFloat(data.data[firstKey].price);
      console.log(`✅ Found price in Jupiter format: $${price}`);
      return price * 100000000; // Convert to market cap estimate
    }
  }
  
  // Pump.fun format (alternative)
  if (data.market_cap) {
    console.log(`✅ Found market_cap: $${data.market_cap}`);
    return data.market_cap;
  }
  
  // DexScreener format
  if (data.pairs && data.pairs.length > 0) {
    const pair = data.pairs[0];
    if (pair.fdv) {
      console.log(`✅ Found FDV (market cap) in DexScreener: $${pair.fdv}`);
      return parseFloat(pair.fdv);
    }
    if (pair.marketCap) {
      console.log(`✅ Found marketCap in DexScreener: $${pair.marketCap}`);
      return parseFloat(pair.marketCap);
    }
  }
  
  console.log(`❌ No price found in ${apiName} response`);
  return null;
}

// Main request handler
const server = http.createServer(async (req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200, corsHeaders);
    res.end();
    return;
  }
  
  // Parse query parameters
  const parsedUrl = url.parse(req.url, true);
  const { address } = parsedUrl.query;
  
  console.log(`\n🔔 Received request for address: ${address}`);
  
  if (!address) {
    res.writeHead(400, corsHeaders);
    res.end(JSON.stringify({ error: 'Missing address parameter' }));
    return;
  }
  
  // List of APIs to try (in order)
  const apis = [
    {
      name: 'PumpPortal',
      url: `https://api.pumpportal.fun/coin/${address}`
    },
    {
      name: 'Jupiter',
      url: `https://price.jup.ag/v4/price?ids=${address}`
    },
    {
      name: 'Pump.fun',
      url: `https://frontend-api.pump.fun/coins/${address}`
    },
    {
      name: 'DexScreener',
      url: `https://api.dexscreener.com/latest/dex/tokens/solana/${address}`
    }
  ];
  
  // Try each API in sequence
  for (const api of apis) {
    try {
      console.log(`\n🌐 Trying ${api.name}: ${api.url}`);
      const result = await fetchAPI(api.url);
      
      if (result.ok) {
        const price = parsePrice(result.data, api.name);
        
        if (price && price > 0) {
          console.log(`\n✅ SUCCESS! Got price $${price} from ${api.name}`);
          res.writeHead(200, corsHeaders);
          res.end(JSON.stringify({
            success: true,
            price: price,
            source: api.name,
            address: address
          }));
          return;
        }
      } else {
        console.log(`⚠️ ${api.name} returned status ${result.status}`);
      }
    } catch (error) {
      console.log(`❌ ${api.name} failed:`, error.message);
      continue;
    }
  }
  
  // If we get here, all APIs failed
  console.log(`\n❌ All APIs failed for ${address}`);
  res.writeHead(404, corsHeaders);
  res.end(JSON.stringify({
    success: false,
    error: 'No price found from any API',
    address: address
  }));
});

server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🚀 Crypto Paper Trader Proxy Server                     ║
║                                                            ║
║   Status: Running                                          ║
║   Port: ${PORT}                                               ║
║   URL: http://localhost:${PORT}                              ║
║                                                            ║
║   Usage:                                                   ║
║   GET http://localhost:${PORT}?address=<solana_address>      ║
║                                                            ║
║   Ready to proxy API requests! 🎯                         ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});

