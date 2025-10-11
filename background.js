// Background script for Crypto Paper Trader
class BackgroundService {
  constructor() {
    this.priceUpdateInterval = null;
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.startPriceMonitoring();
  }

  setupEventListeners() {
    // Listen for messages from popup and content scripts
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // Keep message channel open for async responses
    });

    // Handle extension installation/update
    chrome.runtime.onInstalled.addListener((details) => {
      this.handleInstallation(details);
    });

    // Handle side panel opening
    chrome.action.onClicked.addListener((tab) => {
      this.openSidePanel(tab);
    });
  }

  async openSidePanel(tab) {
    try {
      // First, set the side panel path
      await chrome.sidePanel.setOptions({
        tabId: tab.id,
        path: 'sidepanel.html',
        enabled: true,
      });

      // Then open the side panel
      await chrome.sidePanel.open({ tabId: tab.id });
    } catch (error) {
      console.error('Error opening side panel:', error);
      // Fallback to popup if side panel fails
      try {
        chrome.action.openPopup();
      } catch (popupError) {
        console.error('Error opening popup:', popupError);
      }
    }
  }

  async handleMessage(request, sender, sendResponse) {
    try {
      switch (request.action) {
        case 'getPrice':
          const price = await this.fetchCoinPrice(request.symbol);
          sendResponse({ success: true, data: price });
          break;

        case 'scrapePrice':
          const scrapedPrice = await this.scrapePriceFromPage(
            request.url,
            request.symbol
          );
          sendResponse({ success: true, data: scrapedPrice });
          break;

        case 'getPortfolioData':
          const portfolioData = await this.getPortfolioData();
          sendResponse({ success: true, data: portfolioData });
          break;

        case 'snipeToken':
          const snipeResult = await this.handleSnipeToken(
            request.tokenData,
            request.source
          );
          sendResponse({ success: true, data: snipeResult });
          break;

        case 'injectSnipeButtons':
          const injectResult = await this.injectSnipeButtonsToAxiom();
          sendResponse({ success: true, data: injectResult });
          break;

        case 'testPumpPortal':
          const isConnected = await this.testPumpPortalConnectivity();
          sendResponse({ success: true, connected: isConnected });
          break;

        case 'testPriceUpdate':
          console.log('🧪 Manual price update test triggered');
          await this.updateAllPrices();
          sendResponse({
            success: true,
            message: 'Price update test completed',
          });
          break;

        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Background script error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async handleInstallation(details) {
    if (details.reason === 'install') {
      // Set default settings on first install
      await chrome.storage.local.set({
        settings: {
          startingBalanceSOL: 100, // Starting balance in SOL
          priceSource: 'coinmarketcap',
          updateInterval: 30000,
        },
        portfolio: {},
        solPriceUSD: 100, // Default SOL price
      });
    }
  }

  async startPriceMonitoring() {
    console.log('🚀 Starting price monitoring...');

    // Test PumpPortal connectivity on startup
    const isPumpPortalConnected = await this.testPumpPortalConnectivity();
    if (isPumpPortalConnected) {
      console.log('✅ PumpPortal API is ready for price fetching');
    } else {
      console.log(
        '⚠️ PumpPortal API is not accessible, will use fallback methods'
      );
    }

    // Update prices every 30 seconds
    console.log('⏰ Setting up 30-second price update interval...');
    this.priceUpdateInterval = setInterval(async () => {
      console.log('⏰ Price update interval triggered');
      await this.updateAllPrices();
    }, 30000);
    console.log(
      `✅ Price update interval set with ID: ${this.priceUpdateInterval}`
    );
  }

  async updateAllPrices() {
    try {
      console.log('🔄 Starting periodic price updates...');
      const { portfolio } = await chrome.storage.local.get(['portfolio']);
      if (!portfolio || Object.keys(portfolio).length === 0) {
        console.log('📊 No portfolio holdings to update');
        return;
      }

      console.log(
        `📊 Updating prices for ${Object.keys(portfolio).length} holdings`
      );

      for (const [symbol, holding] of Object.entries(portfolio)) {
        try {
          console.log(`🔄 Updating price for ${symbol}...`);
          console.log(`📊 Holding data for ${symbol}:`, holding);

          // Prefer full contract address, fall back to truncated
          const contractAddress =
            holding.fullContractAddress || holding.contractAddress;

          console.log(`🔍 Contract address check for ${symbol}:`, {
            fullContractAddress: holding.fullContractAddress,
            contractAddress: holding.contractAddress,
            finalAddress: contractAddress,
          });

          if (contractAddress) {
            const addressType = holding.fullContractAddress
              ? 'full'
              : 'truncated';
            console.log(
              `📡 Using ${addressType} contract address for ${symbol}: ${contractAddress}`
            );

            const newPrice = await this.fetchTokenPrice(
              symbol,
              contractAddress
            );
            if (newPrice && newPrice > 0) {
              console.log(`📈 New price for ${symbol}: $${newPrice}`);
              await this.updateTokenPrice(symbol, newPrice);
            } else {
              console.log(`⚠️ No valid price update for ${symbol}`);
            }
          } else {
            console.log(
              `⚠️ No contract address for ${symbol}, skipping update`
            );
          }
        } catch (error) {
          console.error(`Failed to update price for ${symbol}:`, error);
        }
      }

      console.log('✅ Completed periodic price updates');
    } catch (error) {
      console.error('Error updating prices:', error);
    }
  }

  async fetchCoinPrice(symbol) {
    // Check if it's a contract address
    if (this.isValidContractAddress(symbol)) {
      return await this.fetchContractPrice(symbol);
    }

    const sources = [
      () => this.fetchFromCoinMarketCap(symbol),
      () => this.fetchFromCoinGecko(symbol),
      () => this.fetchFromAlternativeSources(symbol),
    ];

    for (const source of sources) {
      try {
        const data = await source();
        if (data && data.price) {
          return data;
        }
      } catch (error) {
        console.warn(`Price source failed for ${symbol}:`, error);
      }
    }

    return null;
  }

  isValidContractAddress(address) {
    // Ethereum address validation (0x + 40 hex characters)
    const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;

    // Solana address validation (Base58, 32-44 characters)
    const solanaAddressRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

    return ethAddressRegex.test(address) || solanaAddressRegex.test(address);
  }

  getAddressType(address) {
    if (/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return 'ethereum';
    } else if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
      return 'solana';
    }
    return null;
  }

  async fetchContractPrice(contractAddress) {
    const addressType = this.getAddressType(contractAddress);

    let sources;
    if (addressType === 'ethereum') {
      sources = [
        () => this.fetchFromEtherscanContract(contractAddress),
        () => this.fetchFromDexScreenerContract(contractAddress),
        () => this.fetchFromCoinGeckoContract(contractAddress),
      ];
    } else if (addressType === 'solana') {
      sources = [
        () => this.fetchFromSolscanContract(contractAddress),
        () => this.fetchFromJupiterContract(contractAddress),
        () => this.fetchFromDexScreenerSolanaContract(contractAddress),
      ];
    } else {
      return null;
    }

    for (const source of sources) {
      try {
        const data = await source();
        if (data && data.price) {
          return data;
        }
      } catch (error) {
        console.warn(`Contract source failed for ${contractAddress}:`, error);
      }
    }

    return null;
  }

  async fetchFromEtherscanContract(contractAddress) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          symbol: 'NEW',
          name: 'New Token',
          price: Math.random() * 0.001 + 0.000001,
          change24h: (Math.random() - 0.5) * 50,
          contractAddress: contractAddress,
          source: 'etherscan',
          isNewToken: true,
          timestamp: Date.now(),
        });
      }, 300);
    });
  }

  async fetchFromDexScreenerContract(contractAddress) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          symbol: 'NEW',
          name: 'New Token',
          price: Math.random() * 0.001 + 0.000001,
          change24h: (Math.random() - 0.5) * 50,
          contractAddress: contractAddress,
          source: 'dexscreener',
          isNewToken: true,
          timestamp: Date.now(),
        });
      }, 200);
    });
  }

  async fetchFromCoinGeckoContract(contractAddress) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          symbol: 'NEW',
          name: 'New Token',
          price: Math.random() * 0.001 + 0.000001,
          change24h: (Math.random() - 0.5) * 50,
          contractAddress: contractAddress,
          source: 'coingecko',
          isNewToken: true,
          timestamp: Date.now(),
        });
      }, 400);
    });
  }

  // Solana-specific fetching functions
  async fetchFromSolscanContract(contractAddress) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          symbol: 'SOL',
          name: 'Solana Memecoin',
          price: Math.random() * 0.0001 + 0.000001,
          change24h: (Math.random() - 0.5) * 100,
          contractAddress: contractAddress,
          source: 'solscan',
          blockchain: 'solana',
          isNewToken: true,
          timestamp: Date.now(),
        });
      }, 300);
    });
  }

  async fetchFromJupiterContract(contractAddress) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          symbol: 'SOL',
          name: 'Solana Memecoin',
          price: Math.random() * 0.0001 + 0.000001,
          change24h: (Math.random() - 0.5) * 100,
          contractAddress: contractAddress,
          source: 'jupiter',
          blockchain: 'solana',
          isNewToken: true,
          timestamp: Date.now(),
        });
      }, 250);
    });
  }

  async fetchFromDexScreenerSolanaContract(contractAddress) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          symbol: 'SOL',
          name: 'Solana Memecoin',
          price: Math.random() * 0.0001 + 0.000001,
          change24h: (Math.random() - 0.5) * 100,
          contractAddress: contractAddress,
          source: 'dexscreener',
          blockchain: 'solana',
          isNewToken: true,
          timestamp: Date.now(),
        });
      }, 200);
    });
  }

  async fetchFromCoinMarketCap(symbol) {
    // In a real implementation, you would use the CoinMarketCap API
    // For demo purposes, we'll simulate API calls
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          symbol: symbol.toUpperCase(),
          price: Math.random() * 0.01 + 0.0001,
          change24h: (Math.random() - 0.5) * 20,
          timestamp: Date.now(),
        });
      }, 100);
    });
  }

  async fetchFromCoinGecko(symbol) {
    // Simulate CoinGecko API call
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          symbol: symbol.toUpperCase(),
          price: Math.random() * 0.01 + 0.0001,
          change24h: (Math.random() - 0.5) * 20,
          timestamp: Date.now(),
        });
      }, 150);
    });
  }

  async fetchFromAlternativeSources(symbol) {
    // This would scrape from various trading platforms
    // For now, return simulated data
    return {
      symbol: symbol.toUpperCase(),
      price: Math.random() * 0.01 + 0.0001,
      change24h: (Math.random() - 0.5) * 20,
      timestamp: Date.now(),
    };
  }

  async scrapePriceFromPage(url, symbol) {
    try {
      // This would inject content script to scrape price from the page
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab) {
        throw new Error('No active tab found');
      }

      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: this.scrapePriceFromDOM,
        args: [symbol],
      });

      return results[0]?.result || null;
    } catch (error) {
      console.error('Error scraping price from page:', error);
      return null;
    }
  }

  // This function will be injected into the page
  scrapePriceFromDOM(symbol) {
    // Look for common price patterns in the DOM
    const priceSelectors = [
      '[data-testid*="price"]',
      '.price',
      '[class*="price"]',
      '[id*="price"]',
      'span:contains("$")',
      'div:contains("$")',
    ];

    for (const selector of priceSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        const text = element.textContent || element.innerText;
        const priceMatch = text.match(/\$?([0-9]+\.?[0-9]*)/);
        if (priceMatch) {
          return {
            symbol: symbol.toUpperCase(),
            price: parseFloat(priceMatch[1]),
            source: 'web-scraping',
            timestamp: Date.now(),
          };
        }
      }
    }

    return null;
  }

  async getPortfolioData() {
    try {
      const { portfolio, priceData } = await chrome.storage.local.get([
        'portfolio',
        'priceData',
      ]);
      return { portfolio, priceData };
    } catch (error) {
      console.error('Error getting portfolio data:', error);
      return { portfolio: {}, priceData: {} };
    }
  }

  async handleSnipeToken(tokenData, source) {
    try {
      console.log('Handling snipe token:', tokenData);

      // Store the snipe data
      const snipeData = {
        ...tokenData,
        source: source,
        timestamp: Date.now(),
        status: 'sniped',
      };

      // Get existing snipes
      const { snipes = [] } = await chrome.storage.local.get(['snipes']);

      // Add new snipe
      snipes.push(snipeData);

      // Keep only last 50 snipes
      if (snipes.length > 50) {
        snipes.splice(0, snipes.length - 50);
      }

      // Save to storage
      await chrome.storage.local.set({ snipes });

      // If it has a contract address (even truncated), add to portfolio for tracking
      if (tokenData.contractAddress) {
        console.log(
          '📝 Adding snipe to portfolio with contract address:',
          tokenData.contractAddress
        );
        await this.addSnipeToPortfolio(tokenData);
      } else {
        console.log(
          '⚠️ No contract address found for snipe, skipping portfolio addition'
        );
      }

      return {
        success: true,
        message: `Sniped ${tokenData.symbol || 'token'}`,
        tokenData: snipeData,
      };
    } catch (error) {
      console.error('Error handling snipe token:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async addSnipeToPortfolio(tokenData) {
    try {
      console.log('🎯 Adding snipe to portfolio:', tokenData);

      const { portfolio = {}, settings = {} } = await chrome.storage.local.get([
        'portfolio',
        'settings',
      ]);
      console.log('📊 Current portfolio before adding snipe:', portfolio);

      // Get SOL price for calculations
      const { solPriceUSD = 100 } = await chrome.storage.local.get([
        'solPriceUSD',
      ]);
      console.log('💱 SOL price USD:', solPriceUSD);

      const symbol = tokenData.symbol || 'UNKNOWN';
      const snipeAmountSOL = tokenData.amount || 0.1; // Default 0.1 SOL if not specified
      const snipeAmountUSD = snipeAmountSOL * solPriceUSD;
      const tokenPrice = tokenData.price || 0.000001; // Default price if not found

      console.log(
        `💰 Snipe details: Symbol=${symbol}, Amount=${snipeAmountSOL} SOL, Price=$${tokenPrice}`
      );

      // Handle contract addresses (both full and truncated)
      let contractAddress = tokenData.contractAddress;
      let fullContractAddress = null;

      if (contractAddress) {
        if (contractAddress.includes('...')) {
          console.log(
            '⚠️ Truncated contract address detected:',
            contractAddress
          );
          // Store truncated as the main address, but try to resolve full address later
        } else if (this.isValidContractAddress(contractAddress)) {
          console.log('✅ Full contract address detected:', contractAddress);
          fullContractAddress = contractAddress;
          // Use full address as the main contract address
          contractAddress = fullContractAddress;
        } else {
          console.log('⚠️ Invalid contract address format:', contractAddress);
        }
      }

      // Calculate how many tokens we can buy with the snipe amount
      const tokensToBuy = snipeAmountUSD / tokenPrice;

      console.log(
        `💰 Snipe calculation: ${snipeAmountSOL} SOL = $${snipeAmountUSD.toFixed(
          2
        )} = ${tokensToBuy.toFixed(6)} ${symbol} tokens at $${tokenPrice}`
      );

      if (!portfolio[symbol]) {
        portfolio[symbol] = {
          symbol: symbol,
          contractAddress: contractAddress, // May be truncated
          fullContractAddress: fullContractAddress, // Full address if available
          amount: 0,
          avgPrice: 0,
          totalInvested: 0,
          lastPrice: tokenPrice,
          source: 'snipe',
          firstSeen: Date.now(),
          snipeHistory: [],
          priceUpdateInterval: null, // For real-time price updates
        };
        console.log('🆕 Created new portfolio entry for:', symbol);
        if (fullContractAddress) {
          console.log('✅ Stored full contract address:', fullContractAddress);
        } else {
          console.log('⚠️ Only truncated address available:', contractAddress);
        }
      } else {
        // Update existing portfolio entry with better contract address if available
        const existingEntry = portfolio[symbol];
        if (fullContractAddress && !existingEntry.fullContractAddress) {
          console.log('✅ Upgrading existing entry with full contract address:', fullContractAddress);
          existingEntry.fullContractAddress = fullContractAddress;
          existingEntry.contractAddress = fullContractAddress; // Update main address too
        }
      }

      // Add the snipe as a buy order
      const currentHolding = portfolio[symbol];
      const currentAmount = currentHolding.amount || 0; // Initialize to 0 if undefined
      const currentInvested = currentHolding.totalInvested || 0; // Initialize to 0 if undefined
      const newTotalAmount = currentAmount + tokensToBuy;
      const newTotalInvested = currentInvested + snipeAmountUSD;

      currentHolding.amount = newTotalAmount;
      currentHolding.totalInvested = newTotalInvested;
      currentHolding.avgPrice = newTotalInvested / newTotalAmount;
      currentHolding.lastPrice = tokenPrice;

      console.log(`📊 Updated holding for ${symbol}:`, {
        amount: currentHolding.amount,
        totalInvested: currentHolding.totalInvested,
        avgPrice: currentHolding.avgPrice,
        lastPrice: currentHolding.lastPrice,
        contractAddress: currentHolding.contractAddress,
        fullContractAddress: currentHolding.fullContractAddress,
      });

      // Update contract addresses if we found better ones
      if (fullContractAddress) {
        currentHolding.fullContractAddress = fullContractAddress;
        console.log(
          '✅ Updated full contract address for',
          symbol,
          ':',
          fullContractAddress
        );
      }
      if (contractAddress && !contractAddress.includes('...')) {
        currentHolding.contractAddress = contractAddress;
        console.log(
          '✅ Updated main contract address for',
          symbol,
          ':',
          contractAddress
        );
      }

      // Track snipe history
      currentHolding.snipeHistory = currentHolding.snipeHistory || [];
      currentHolding.snipeHistory.push({
        amountSOL: snipeAmountSOL,
        amountUSD: snipeAmountUSD,
        tokensReceived: tokensToBuy,
        price: tokenPrice,
        timestamp: Date.now(),
        source: tokenData.source || 'axiom',
      });

      // Keep only last 10 snipes per token
      if (currentHolding.snipeHistory.length > 10) {
        currentHolding.snipeHistory = currentHolding.snipeHistory.slice(-10);
      }

      // Start real-time price updates for this token (prefer full address)
      const addressForUpdates = fullContractAddress || contractAddress;
      await this.startPriceUpdates(symbol, addressForUpdates);

      console.log('💾 Saving portfolio to storage...');
      await chrome.storage.local.set({ portfolio });

      // Verify the save worked
      const { portfolio: savedPortfolio } = await chrome.storage.local.get([
        'portfolio',
      ]);
      console.log('✅ Portfolio saved successfully:', savedPortfolio);
      console.log(
        `📊 Portfolio now contains ${
          Object.keys(savedPortfolio).length
        } tokens:`,
        Object.keys(savedPortfolio)
      );

      console.log(
        `✅ Added snipe to portfolio: ${tokensToBuy.toFixed(
          6
        )} ${symbol} tokens for ${snipeAmountSOL} SOL`
      );
      console.log(
        `📊 Portfolio now has ${Object.keys(savedPortfolio).length} tokens`
      );

      // Notify popup/sidepanel to update
      chrome.runtime
        .sendMessage({
          action: 'portfolioUpdate',
          data: { symbol, tokensToBuy, snipeAmountSOL },
        })
        .catch(() => {
          // Popup might not be open, ignore error
        });
    } catch (error) {
      console.error('Error adding snipe to portfolio:', error);
    }
  }

  async startPriceUpdates(symbol, contractAddress) {
    console.log(`🔄 Starting price updates for ${symbol} (${contractAddress})`);

    // Get current portfolio data
    const { portfolio } = await chrome.storage.local.get(['portfolio']);
    const currentPortfolio = portfolio || {};
    
    // Clear any existing interval for this token
    if (currentPortfolio[symbol] && currentPortfolio[symbol].priceUpdateInterval) {
      clearInterval(currentPortfolio[symbol].priceUpdateInterval);
      console.log(`🔄 Cleared existing interval for ${symbol}`);
    }

    // Update price every 30 seconds
    const intervalId = setInterval(async () => {
      try {
        console.log(`📡 Fetching price update for ${symbol}...`);
        const newPrice = await this.fetchTokenPrice(symbol, contractAddress);
        if (newPrice && newPrice > 0) {
          console.log(`📈 New price for ${symbol}: $${newPrice}`);
          await this.updateTokenPrice(symbol, newPrice);
        } else {
          console.log(`⚠️ No valid price update for ${symbol}`);
        }
      } catch (error) {
        console.error(`Error updating price for ${symbol}:`, error);
      }
    }, 30000); // 30 seconds

    // Store interval ID in portfolio (preserve existing data)
    if (!currentPortfolio[symbol]) {
      currentPortfolio[symbol] = {};
    }
    currentPortfolio[symbol].priceUpdateInterval = intervalId;
    await chrome.storage.local.set({ portfolio: currentPortfolio });

    console.log(
      `✅ Price update interval started for ${symbol} (ID: ${intervalId})`
    );

    // Do an immediate price fetch
    setTimeout(async () => {
      try {
        console.log(`🚀 Immediate price fetch for ${symbol}...`);
        const newPrice = await this.fetchTokenPrice(symbol, contractAddress);
        if (newPrice && newPrice > 0) {
          await this.updateTokenPrice(symbol, newPrice);
        }
      } catch (error) {
        console.error(`Error in immediate price fetch for ${symbol}:`, error);
      }
    }, 2000); // 2 seconds delay for immediate fetch
  }

  async fetchTokenPrice(symbol, contractAddress) {
    try {
      console.log(`📡 Fetching price for ${symbol} (${contractAddress})`);

      // Strategy 1: Try PumpPortal API (best for Pump.fun tokens, requires full address)
      if (
        contractAddress &&
        !contractAddress.includes('...') &&
        this.isValidContractAddress(contractAddress)
      ) {
        try {
          console.log(
            `🔍 Trying PumpPortal API for ${symbol} with full address...`
          );
          // Use CORS proxy to avoid CORS issues
          const pumpportalResponse = await fetch(
            `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://api.pumpportal.fun/coin/${contractAddress}`)}`,
            {
              method: 'GET',
              headers: {
                Accept: 'application/json',
                'User-Agent': 'CryptoPaperTrader/1.0',
              },
            }
          );

          if (pumpportalResponse.ok) {
            const pumpportalData = await pumpportalResponse.json();
            console.log(
              `📊 PumpPortal response for ${symbol}:`,
              pumpportalData
            );

            // PumpPortal returns market cap directly
            if (pumpportalData.usd_market_cap) {
              console.log(
                `✅ PumpPortal market cap for ${symbol}: $${pumpportalData.usd_market_cap}`
              );
              return pumpportalData.usd_market_cap;
            }

            // If no market cap, try to calculate from price and supply
            if (pumpportalData.price && pumpportalData.supply) {
              const marketCap = pumpportalData.price * pumpportalData.supply;
              console.log(
                `✅ PumpPortal calculated market cap for ${symbol}: $${marketCap}`
              );
              return marketCap;
            }
          } else {
            console.log(
              `⚠️ PumpPortal API returned ${pumpportalResponse.status} for ${symbol}`
            );
          }
        } catch (error) {
          console.log(`⚠️ PumpPortal API failed for ${symbol}:`, error.message);
        }
      }

      // Strategy 2: Try Jupiter API (works well for Solana tokens, requires full address)
      if (
        contractAddress &&
        !contractAddress.includes('...') &&
        this.isValidContractAddress(contractAddress)
      ) {
        try {
          console.log(
            `🔍 Trying Jupiter API for ${symbol} with full address...`
          );
          // Use CORS proxy for Jupiter API
          const jupiterResponse = await fetch(
            `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://price.jup.ag/v4/price?ids=${contractAddress}`)}`,
            {
              method: 'GET',
              headers: {
                Accept: 'application/json',
              },
            }
          );

          if (jupiterResponse.ok) {
            const jupiterData = await jupiterResponse.json();
            if (jupiterData.data && jupiterData.data[contractAddress]) {
              const price = jupiterData.data[contractAddress].price;
              const solPrice = await this.getSOLPrice();
              const marketCap = price * solPrice * 1000000; // Assuming 1M supply
              console.log(
                `✅ Jupiter price for ${symbol}: $${marketCap.toFixed(0)}`
              );
              return marketCap;
            }
          }
        } catch (error) {
          console.log(`⚠️ Jupiter API failed for ${symbol}:`, error.message);
        }
      }

      // Strategy 3: Try Pump.fun API directly (sometimes works, requires full address)
      if (
        contractAddress &&
        !contractAddress.includes('...') &&
        this.isValidContractAddress(contractAddress)
      ) {
        try {
          console.log(
            `🔍 Trying Pump.fun API directly for ${symbol} with full address...`
          );
          // Use CORS proxy for Pump.fun API
          const pumpfunResponse = await fetch(
            `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://frontend-api.pump.fun/coins/${contractAddress}`)}`,
            {
              method: 'GET',
              headers: {
                Accept: 'application/json',
                'User-Agent': 'CryptoPaperTrader/1.0',
              },
            }
          );

          if (pumpfunResponse.ok) {
            const pumpfunData = await pumpfunResponse.json();
            if (pumpfunData.usd_market_cap) {
              console.log(
                `✅ Pump.fun direct price for ${symbol}: $${pumpfunData.usd_market_cap}`
              );
              return pumpfunData.usd_market_cap;
            }
          }
        } catch (error) {
          console.log(
            `⚠️ Pump.fun direct API failed for ${symbol}:`,
            error.message
          );
        }
      }

      // Strategy 4: Try DexScreener API (very reliable for Solana tokens)
      if (
        contractAddress &&
        !contractAddress.includes('...') &&
        this.isValidContractAddress(contractAddress)
      ) {
        try {
          console.log(
            `🔍 Trying DexScreener API for ${symbol} with full address...`
          );
          // Use CORS proxy for DexScreener API
          const dexscreenerResponse = await fetch(
            `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://api.dexscreener.com/latest/dex/tokens/${contractAddress}`)}`,
            {
              method: 'GET',
              headers: {
                Accept: 'application/json',
                'User-Agent': 'CryptoPaperTrader/1.0',
              },
            }
          );

          if (dexscreenerResponse.ok) {
            const dexscreenerData = await dexscreenerResponse.json();
            console.log(`📊 DexScreener full response for ${symbol}:`, dexscreenerData);
            if (dexscreenerData.pairs && dexscreenerData.pairs.length > 0) {
              const pair = dexscreenerData.pairs[0]; // Get the first (usually most liquid) pair
              console.log(`📊 DexScreener pair data for ${symbol}:`, pair);
              
              // Try to get the actual token price first
              if (pair.priceUsd) {
                console.log(
                  `✅ DexScreener token price for ${symbol}: $${pair.priceUsd}`
                );
                return parseFloat(pair.priceUsd);
              }
              
              // Fallback to market cap if no price available
              if (pair.fdv) {
                console.log(
                  `✅ DexScreener market cap for ${symbol}: $${pair.fdv}`
                );
                return pair.fdv;
              }
            }
          }
        } catch (error) {
          console.log(`⚠️ DexScreener API failed for ${symbol}:`, error.message);
        }
      }

      // Strategy 5: Ask content script to scrape from current Axiom page (works with truncated addresses)
      try {
        console.log(
          `🔍 Asking content script to scrape price for ${symbol} (works with truncated addresses)...`
        );
        const tabs = await chrome.tabs.query({ url: ['*://axiom.trade/*'] });
        if (tabs.length > 0) {
          const response = await chrome.tabs.sendMessage(tabs[0].id, {
            action: 'scrapeTokenPrice',
            symbol: symbol,
          });
          if (response && response.price) {
            console.log(
              `✅ Content script price for ${symbol}: $${response.price}`
            );
            return response.price;
          }
        }
      } catch (error) {
        console.log(
          `⚠️ Content script scraping failed for ${symbol}:`,
          error.message
        );
      }

      // Strategy 5: Use CoinGecko API for well-known tokens
      try {
        console.log(`🔍 Trying CoinGecko API for ${symbol}...`);
        const coingeckoResponse = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${symbol.toLowerCase()}&vs_currencies=usd&include_market_cap=true`
        );
        if (coingeckoResponse.ok) {
          const cgData = await coingeckoResponse.json();
          if (
            cgData[symbol.toLowerCase()] &&
            cgData[symbol.toLowerCase()].usd_market_cap
          ) {
            console.log(
              `✅ CoinGecko market cap for ${symbol}: $${
                cgData[symbol.toLowerCase()].usd_market_cap
              }`
            );
            return cgData[symbol.toLowerCase()].usd_market_cap;
          }
        }
      } catch (error) {
        console.log(`⚠️ CoinGecko API failed for ${symbol}:`, error.message);
      }

      console.log(`❌ No price found for ${symbol}`);
      return null;
    } catch (error) {
      console.error(`Error fetching price for ${symbol}:`, error);
      return null;
    }
  }

  async getSOLPrice() {
    try {
      const response = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd'
      );
      if (response.ok) {
        const data = await response.json();
        return data.solana.usd;
      }
    } catch (error) {
      console.log('⚠️ Failed to get SOL price, using default');
    }
    return 100; // Default SOL price
  }

  async testPumpPortalConnectivity() {
    try {
      console.log('🔍 Testing PumpPortal connectivity...');
      const response = await fetch('https://api.pumpportal.fun/health', {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'CryptoPaperTrader/1.0',
        },
      });

      if (response.ok) {
        console.log('✅ PumpPortal API is accessible');
        return true;
      } else {
        console.log(`⚠️ PumpPortal API returned ${response.status}`);
        return false;
      }
    } catch (error) {
      console.log('❌ PumpPortal API is not accessible:', error.message);
      return false;
    }
  }

  async updateTokenPrice(symbol, newPrice) {
    try {
      const { portfolio = {} } = await chrome.storage.local.get(['portfolio']);

      if (portfolio[symbol]) {
        const oldPrice = portfolio[symbol].lastPrice;
        portfolio[symbol].lastPrice = newPrice;

        await chrome.storage.local.set({ portfolio });

        console.log(`📈 Updated ${symbol} price: $${oldPrice} → $${newPrice}`);

        // Notify UI of price update
        chrome.runtime
          .sendMessage({
            action: 'priceUpdate',
            data: { symbol, oldPrice, newPrice },
          })
          .catch(() => {
            // Popup might not be open, ignore error
          });
      }
    } catch (error) {
      console.error(`Error updating token price for ${symbol}:`, error);
    }
  }

  async injectSnipeButtonsToAxiom() {
    try {
      console.log('🚀 Starting snipe button injection...');

      // Get all tabs that might have Axiom
      const tabs = await chrome.tabs.query({ url: ['*://*/*'] });
      console.log(`🔍 Checking ${tabs.length} tabs for Axiom`);

      let injectedCount = 0;
      for (const tab of tabs) {
        if (this.isAxiomTab(tab.url)) {
          console.log(`✅ Found Axiom tab: ${tab.url}`);
          try {
            await chrome.tabs.sendMessage(tab.id, {
              action: 'injectSnipeButtons',
            });
            injectedCount++;
            console.log(
              `✅ Successfully sent injection message to tab ${tab.id}`
            );
          } catch (error) {
            // Tab might not have content script loaded yet
            console.warn(`❌ Could not inject into tab ${tab.id}:`, error);
          }
        }
      }

      console.log(`🎯 Injection complete: ${injectedCount} tabs processed`);
      return {
        success: true,
        message: `Snipe buttons injection attempted on ${injectedCount} tabs`,
      };
    } catch (error) {
      console.error('❌ Error injecting snipe buttons:', error);
      return { success: false, error: error.message };
    }
  }

  isAxiomTab(url) {
    return (
      url.includes('axiom') ||
      url.includes('bullx') ||
      url.includes('raydium') ||
      url.includes('jupiter')
    );
  }

  isValidContractAddress(address) {
    if (!address) return false;

    // Ethereum address
    if (address.startsWith('0x') && address.length === 42) {
      return /^0x[a-fA-F0-9]{40}$/.test(address);
    }

    // Solana address
    if (address.length >= 32 && address.length <= 44) {
      return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
    }

    return false;
  }
}

// Initialize background service
new BackgroundService();
