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

  startPriceMonitoring() {
    // Update prices every 30 seconds
    this.priceUpdateInterval = setInterval(async () => {
      await this.updateAllPrices();
    }, 30000);
  }

  async updateAllPrices() {
    try {
      const { portfolio } = await chrome.storage.local.get(['portfolio']);
      if (!portfolio || Object.keys(portfolio).length === 0) return;

      const updatedPrices = {};
      for (const symbol of Object.keys(portfolio)) {
        try {
          const priceData = await this.fetchCoinPrice(symbol);
          if (priceData) {
            updatedPrices[symbol] = priceData;
          }
        } catch (error) {
          console.warn(`Failed to update price for ${symbol}:`, error);
        }
      }

      // Store updated prices
      if (Object.keys(updatedPrices).length > 0) {
        await chrome.storage.local.set({ priceData: updatedPrices });

        // Notify popup if it's open
        chrome.runtime
          .sendMessage({
            action: 'priceUpdate',
            data: updatedPrices,
          })
          .catch(() => {
            // Popup might not be open, ignore error
          });
      }
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

      // If it's a valid contract address, also add to portfolio for tracking
      if (
        tokenData.contractAddress &&
        this.isValidContractAddress(tokenData.contractAddress)
      ) {
        await this.addSnipeToPortfolio(tokenData);
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
      const { portfolio = {}, settings = {} } = await chrome.storage.local.get(['portfolio', 'settings']);
      
      // Get SOL price for calculations
      const { solPriceUSD = 100 } = await chrome.storage.local.get(['solPriceUSD']);

      const symbol = tokenData.symbol || 'UNKNOWN';
      const snipeAmountSOL = tokenData.amount || 0.1; // Default 0.1 SOL if not specified
      const snipeAmountUSD = snipeAmountSOL * solPriceUSD;
      const tokenPrice = tokenData.price || 0.000001; // Default price if not found

      // Calculate how many tokens we can buy with the snipe amount
      const tokensToBuy = snipeAmountUSD / tokenPrice;

      if (!portfolio[symbol]) {
        portfolio[symbol] = {
          symbol: symbol,
          contractAddress: tokenData.contractAddress,
          amount: 0,
          avgPrice: 0,
          totalInvested: 0,
          lastPrice: tokenPrice,
          source: 'snipe',
          firstSeen: Date.now(),
          snipeHistory: []
        };
      }

      // Add the snipe as a buy order
      const currentHolding = portfolio[symbol];
      const newTotalAmount = currentHolding.amount + tokensToBuy;
      const newTotalInvested = currentHolding.totalInvested + snipeAmountUSD;

      currentHolding.amount = newTotalAmount;
      currentHolding.totalInvested = newTotalInvested;
      currentHolding.avgPrice = newTotalInvested / newTotalAmount;
      currentHolding.lastPrice = tokenPrice;

      // Track snipe history
      currentHolding.snipeHistory = currentHolding.snipeHistory || [];
      currentHolding.snipeHistory.push({
        amountSOL: snipeAmountSOL,
        amountUSD: snipeAmountUSD,
        tokensReceived: tokensToBuy,
        price: tokenPrice,
        timestamp: Date.now(),
        source: tokenData.source || 'axiom'
      });

      // Keep only last 10 snipes per token
      if (currentHolding.snipeHistory.length > 10) {
        currentHolding.snipeHistory = currentHolding.snipeHistory.slice(-10);
      }

      await chrome.storage.local.set({ portfolio });
      
      console.log(`✅ Added snipe to portfolio: ${tokensToBuy.toFixed(6)} ${symbol} tokens for ${snipeAmountSOL} SOL`);
    } catch (error) {
      console.error('Error adding snipe to portfolio:', error);
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
