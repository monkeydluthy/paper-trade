// Crypto Paper Trader - Side Panel Script
class CryptoPaperTraderSidePanel {
  constructor() {
    this.currentCoin = null;
    this.portfolio = {};
    this.settings = {
      startingBalanceSOL: 100, // Starting balance in SOL
      priceSource: 'coinmarketcap',
      preferredView: 'sidepanel',
    };
    this.solPriceUSD = 100; // SOL price in USD (will be fetched)
    this.init();
  }

  async init() {
    await this.loadData();
    await this.fetchSOLPrice();
    this.setupEventListeners();
    this.updateUI();
    this.startPriceUpdates();
    this.setupViewToggle();
  }

  setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.tab-button').forEach((button) => {
      button.addEventListener('click', (e) => {
        this.switchTab(e.target.dataset.tab);
      });
    });

    // Search functionality
    document.getElementById('searchBtn').addEventListener('click', () => {
      this.searchCoin();
    });

    document.getElementById('coinSearch').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.searchCoin();
      }
    });

    // Auto-detect contract addresses
    document.getElementById('coinSearch').addEventListener('input', (e) => {
      const value = e.target.value.trim();
      if (this.isValidContractAddress(value)) {
        // Auto-select contract address mode
        document.querySelector(
          'input[name="searchType"][value="contract"]'
        ).checked = true;
      } else if (
        value.length > 0 &&
        !value.startsWith('0x') &&
        !this.isValidContractAddress(value)
      ) {
        // Auto-select symbol mode for non-contract addresses
        document.querySelector(
          'input[name="searchType"][value="symbol"]'
        ).checked = true;
      }
    });

    // Trading
    document.getElementById('executeTrade').addEventListener('click', () => {
      this.executeTrade();
    });

    // Settings
    document.getElementById('updateBalance').addEventListener('click', () => {
      this.updateStartingBalance();
    });

    document.getElementById('clearData').addEventListener('click', () => {
      this.clearAllData();
    });

    // Snipe functionality
    document
      .getElementById('injectSnipeButtons')
      .addEventListener('click', () => {
        this.injectSnipeButtons();
      });

    document.getElementById('clearSnipes').addEventListener('click', () => {
      this.clearSnipes();
    });

    // Listen for portfolio updates from background script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'portfolioUpdate') {
        console.log('📊 Portfolio update received:', request.data);
        // Force reload data and refresh UI
        this.loadData().then(() => {
          this.updateUI();
          this.updatePortfolioView();
          this.showNotification(`Added ${request.data.symbol} to portfolio!`, 'success');
        });
      } else if (request.action === 'priceUpdate') {
        console.log('📈 Price update received:', request.data);
        // Update the UI when prices change
        this.loadData().then(() => {
          this.updateUI();
          this.updatePortfolioView();
          this.showNotification(`${request.data.symbol} price updated: ${this.formatPrice(request.data.oldPrice)} → ${this.formatPrice(request.data.newPrice)}`, 'info');
        });
      }
    });

    // View preference
    document.getElementById('rememberView').addEventListener('change', (e) => {
      this.settings.rememberView = e.target.checked;
      this.saveData();
    });
  }

  setupViewToggle() {
    const popupViewBtn = document.getElementById('popupView');
    const sidepanelViewBtn = document.getElementById('sidepanelView');

    popupViewBtn.addEventListener('click', () => {
      this.switchToPopup();
    });

    sidepanelViewBtn.addEventListener('click', () => {
      this.switchToSidePanel();
    });

    // Set initial view based on preference
    if (this.settings.preferredView === 'popup') {
      this.switchToPopup();
    } else {
      this.switchToSidePanel();
    }
  }

  switchToPopup() {
    // Open popup view
    chrome.action.openPopup();
  }

  switchToSidePanel() {
    // Already in side panel, just update UI
    document.getElementById('popupView').classList.remove('active');
    document.getElementById('sidepanelView').classList.add('active');
    this.settings.preferredView = 'sidepanel';
    this.saveData();
  }

  switchTab(tabName) {
    // Remove active class from all tabs and content
    document
      .querySelectorAll('.tab-button')
      .forEach((btn) => btn.classList.remove('active'));
    document
      .querySelectorAll('.tab-content')
      .forEach((content) => content.classList.remove('active'));

    // Add active class to selected tab and content
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`${tabName}-tab`).classList.add('active');

    if (tabName === 'portfolio') {
      this.updatePortfolioView();
    } else if (tabName === 'snipes') {
      this.updateSnipes();
    }
  }

  async searchCoin() {
    const searchTerm = document.getElementById('coinSearch').value.trim();
    if (!searchTerm) {
      this.showNotification(
        'Please enter a coin symbol or contract address',
        'warning'
      );
      return;
    }

    const searchType = document.querySelector(
      'input[name="searchType"]:checked'
    ).value;

    try {
      this.showNotification('Searching for coin data...', 'info');
      let coinData;

      if (searchType === 'contract') {
        coinData = await this.fetchContractData(searchTerm);
      } else {
        coinData = await this.fetchCoinData(searchTerm);
      }

      if (coinData) {
        this.currentCoin = coinData;
        this.displayCoinInfo(coinData);
        document.getElementById('coinInfo').classList.remove('hidden');
      } else {
        this.showNotification(
          'Coin not found. Try a different symbol or contract address.',
          'error'
        );
      }
    } catch (error) {
      console.error('Error searching for coin:', error);
      this.showNotification(
        'Error fetching coin data. Please try again.',
        'error'
      );
    }
  }

  async fetchCoinData(symbol) {
    // Try multiple sources for price data
    const sources = [
      () => this.fetchFromCoinMarketCap(symbol),
      () => this.fetchFromCoinGecko(symbol),
      () => this.fetchFromWebScraping(symbol),
    ];

    for (const source of sources) {
      try {
        const data = await source();
        if (data) return data;
      } catch (error) {
        console.warn('Price source failed:', error);
      }
    }

    return null;
  }

  async fetchFromCoinMarketCap(symbol) {
    // This would require API key in production
    // For demo purposes, we'll simulate data
    return {
      symbol: symbol.toUpperCase(),
      name: `${symbol} Token`,
      price: Math.random() * 0.01 + 0.0001, // Simulate memecoin price
      change24h: (Math.random() - 0.5) * 20,
      marketCap: Math.random() * 1000000000,
    };
  }

  async fetchFromCoinGecko(symbol) {
    // Simulate CoinGecko API call
    return {
      symbol: symbol.toUpperCase(),
      name: `${symbol} Token`,
      price: Math.random() * 0.01 + 0.0001,
      change24h: (Math.random() - 0.5) * 20,
      marketCap: Math.random() * 1000000000,
    };
  }

  async fetchFromWebScraping(symbol) {
    // This would scrape from actual trading platforms
    // For now, return simulated data
    return {
      symbol: symbol.toUpperCase(),
      name: `${symbol} Token`,
      price: Math.random() * 0.01 + 0.0001,
      change24h: (Math.random() - 0.5) * 20,
      marketCap: Math.random() * 1000000000,
    };
  }

  async fetchContractData(contractAddress) {
    // Validate contract address format
    if (!this.isValidContractAddress(contractAddress)) {
      throw new Error('Invalid contract address format');
    }

    const addressType = this.getAddressType(contractAddress);

    // Try multiple sources based on address type
    let sources;
    if (addressType === 'ethereum') {
      sources = [
        () => this.fetchFromEtherscan(contractAddress),
        () => this.fetchFromCoinGeckoContract(contractAddress),
        () => this.fetchFromDexScreener(contractAddress),
        () => this.fetchFromCoinMarketCapContract(contractAddress),
      ];
    } else if (addressType === 'solana') {
      sources = [
        () => this.fetchFromSolscan(contractAddress),
        () => this.fetchFromJupiter(contractAddress),
        () => this.fetchFromDexScreenerSolana(contractAddress),
        () => this.fetchFromCoinGeckoSolana(contractAddress),
      ];
    } else {
      throw new Error('Unsupported address type');
    }

    for (const source of sources) {
      try {
        const data = await source();
        if (data) return data;
      } catch (error) {
        console.warn('Contract source failed:', error);
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

  // Include all the contract fetching methods from popup.js
  async fetchFromEtherscan(contractAddress) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          symbol: 'NEW',
          name: 'New Token',
          price: Math.random() * 0.001 + 0.000001,
          change24h: (Math.random() - 0.5) * 50,
          marketCap: Math.random() * 10000000,
          contractAddress: contractAddress,
          source: 'etherscan',
          isNewToken: true,
          liquidity: Math.random() * 100000,
          holders: Math.floor(Math.random() * 1000),
        });
      }, 500);
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
          marketCap: Math.random() * 10000000,
          contractAddress: contractAddress,
          source: 'coingecko',
          isNewToken: true,
          liquidity: Math.random() * 100000,
          holders: Math.floor(Math.random() * 1000),
        });
      }, 600);
    });
  }

  async fetchFromDexScreener(contractAddress) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          symbol: 'NEW',
          name: 'New Token',
          price: Math.random() * 0.001 + 0.000001,
          change24h: (Math.random() - 0.5) * 50,
          marketCap: Math.random() * 10000000,
          contractAddress: contractAddress,
          source: 'dexscreener',
          isNewToken: true,
          liquidity: Math.random() * 100000,
          holders: Math.floor(Math.random() * 1000),
        });
      }, 400);
    });
  }

  async fetchFromCoinMarketCapContract(contractAddress) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          symbol: 'NEW',
          name: 'New Token',
          price: Math.random() * 0.001 + 0.000001,
          change24h: (Math.random() - 0.5) * 50,
          marketCap: Math.random() * 10000000,
          contractAddress: contractAddress,
          source: 'coinmarketcap',
          isNewToken: true,
          liquidity: Math.random() * 100000,
          holders: Math.floor(Math.random() * 1000),
        });
      }, 700);
    });
  }

  // Solana-specific fetching functions
  async fetchFromSolscan(contractAddress) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          symbol: 'SOL',
          name: 'Solana Memecoin',
          price: Math.random() * 0.0001 + 0.000001,
          change24h: (Math.random() - 0.5) * 100,
          marketCap: Math.random() * 5000000,
          contractAddress: contractAddress,
          source: 'solscan',
          blockchain: 'solana',
          isNewToken: true,
          liquidity: Math.random() * 50000,
          holders: Math.floor(Math.random() * 500),
        });
      }, 300);
    });
  }

  async fetchFromJupiter(contractAddress) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          symbol: 'SOL',
          name: 'Solana Memecoin',
          price: Math.random() * 0.0001 + 0.000001,
          change24h: (Math.random() - 0.5) * 100,
          marketCap: Math.random() * 5000000,
          contractAddress: contractAddress,
          source: 'jupiter',
          blockchain: 'solana',
          isNewToken: true,
          liquidity: Math.random() * 50000,
          holders: Math.floor(Math.random() * 500),
        });
      }, 400);
    });
  }

  async fetchFromDexScreenerSolana(contractAddress) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          symbol: 'SOL',
          name: 'Solana Memecoin',
          price: Math.random() * 0.0001 + 0.000001,
          change24h: (Math.random() - 0.5) * 100,
          marketCap: Math.random() * 5000000,
          contractAddress: contractAddress,
          source: 'dexscreener',
          blockchain: 'solana',
          isNewToken: true,
          liquidity: Math.random() * 50000,
          holders: Math.floor(Math.random() * 500),
        });
      }, 200);
    });
  }

  async fetchFromCoinGeckoSolana(contractAddress) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          symbol: 'SOL',
          name: 'Solana Memecoin',
          price: Math.random() * 0.0001 + 0.000001,
          change24h: (Math.random() - 0.5) * 100,
          marketCap: Math.random() * 5000000,
          contractAddress: contractAddress,
          source: 'coingecko',
          blockchain: 'solana',
          isNewToken: true,
          liquidity: Math.random() * 50000,
          holders: Math.floor(Math.random() * 500),
        });
      }, 500);
    });
  }

  displayCoinInfo(coinData) {
    document.getElementById('coinSymbol').textContent = coinData.symbol;
    document.getElementById(
      'coinPrice'
    ).textContent = `$${coinData.price.toFixed(6)}`;

    const changeElement = document.getElementById('priceChange');
    const change = coinData.change24h;
    changeElement.textContent = `${change > 0 ? '+' : ''}${change.toFixed(2)}%`;
    changeElement.className = `change ${change >= 0 ? 'positive' : 'negative'}`;

    // Add contract address info if available
    if (coinData.contractAddress) {
      this.displayContractInfo(coinData);
    }
  }

  displayContractInfo(coinData) {
    const coinInfoDiv = document.getElementById('coinInfo');

    // Remove existing contract info
    const existingContractInfo = coinInfoDiv.querySelector('.contract-info');
    if (existingContractInfo) {
      existingContractInfo.remove();
    }

    // Create contract info section
    const contractInfoDiv = document.createElement('div');
    contractInfoDiv.className = 'contract-info';
    contractInfoDiv.innerHTML = `
      <div class="contract-address">
        <strong>Contract:</strong> ${coinData.contractAddress}
      </div>
      <div class="token-metadata">
        <div class="metadata-item">
          <span class="metadata-label">Source:</span>
          <span class="metadata-value">${coinData.source || 'Unknown'}</span>
        </div>
        ${
          coinData.blockchain
            ? `
        <div class="metadata-item">
          <span class="metadata-label">Blockchain:</span>
          <span class="metadata-value">${coinData.blockchain.toUpperCase()}</span>
        </div>
        `
            : ''
        }
        ${
          coinData.liquidity
            ? `
        <div class="metadata-item">
          <span class="metadata-label">Liquidity:</span>
          <span class="metadata-value">$${coinData.liquidity.toLocaleString()}</span>
        </div>
        `
            : ''
        }
        ${
          coinData.holders
            ? `
        <div class="metadata-item">
          <span class="metadata-label">Holders:</span>
          <span class="metadata-value">${coinData.holders.toLocaleString()}</span>
        </div>
        `
            : ''
        }
        ${
          coinData.isNewToken
            ? `
        <div class="metadata-item">
          <span class="metadata-label">Status:</span>
          <span class="metadata-value" style="color: #ff9800;">🆕 New Token</span>
        </div>
        `
            : ''
        }
      </div>
    `;

    // Insert after coin header
    const coinHeader = coinInfoDiv.querySelector('.coin-header');
    coinHeader.insertAdjacentElement('afterend', contractInfoDiv);
  }

  async executeTrade() {
    if (!this.currentCoin) {
      this.showNotification('Please search for a coin first', 'warning');
      return;
    }

    const amount = parseFloat(document.getElementById('tradeAmount').value);
    const tradeType = document.getElementById('tradeType').value;

    if (!amount || amount <= 0) {
      this.showNotification('Please enter a valid amount', 'warning');
      return;
    }

    const coinSymbol = this.currentCoin.symbol;
    const currentPrice = this.currentCoin.price;
    const totalValue = amount * currentPrice;

    // Check if user has enough balance for buy orders
    if (tradeType === 'buy') {
      const currentBalanceUSD = this.getCurrentBalanceUSD();
      if (totalValue > currentBalanceUSD) {
        this.showNotification('Insufficient balance for this trade', 'error');
        return;
      }
    }

    // Check if user has enough coins for sell orders
    if (tradeType === 'sell') {
      const currentHolding = this.portfolio[coinSymbol]?.amount || 0;
      if (amount > currentHolding) {
        this.showNotification('Insufficient coins for this trade', 'error');
        return;
      }
    }

    // Execute the trade
    this.processTrade(coinSymbol, amount, currentPrice, tradeType);
    this.showNotification(
      `${tradeType.toUpperCase()} order executed: ${amount} ${coinSymbol}`,
      'success'
    );

    // Clear form
    document.getElementById('tradeAmount').value = '';
    this.updateUI();
  }

  processTrade(symbol, amount, price, type) {
    if (!this.portfolio[symbol]) {
      this.portfolio[symbol] = { amount: 0, avgPrice: 0, totalInvested: 0 };
    }

    const holding = this.portfolio[symbol];

    if (type === 'buy') {
      const totalCost = amount * price;
      const newTotalAmount = holding.amount + amount;
      const newTotalInvested = holding.totalInvested + totalCost;

      holding.amount = newTotalAmount;
      holding.totalInvested = newTotalInvested;
      holding.avgPrice = newTotalInvested / newTotalAmount;
    } else {
      holding.amount -= amount;
      if (holding.amount <= 0) {
        delete this.portfolio[symbol];
      }
    }

    this.saveData();
  }

  getCurrentBalanceSOL() {
    const totalInvestedUSD = Object.values(this.portfolio).reduce(
      (sum, holding) => sum + (holding.totalInvested || 0),
      0
    );
    const totalInvestedSOL = totalInvestedUSD / this.solPriceUSD;
    const currentBalance = this.settings.startingBalanceSOL - totalInvestedSOL;
    console.log(`💰 Balance calculation: ${this.settings.startingBalanceSOL} SOL - ${totalInvestedSOL.toFixed(4)} SOL = ${currentBalance.toFixed(4)} SOL`);
    return currentBalance;
  }

  getCurrentBalanceUSD() {
    return this.getCurrentBalanceSOL() * this.solPriceUSD;
  }

  getPortfolioValue() {
    let totalValue = 0;
    for (const [symbol, holding] of Object.entries(this.portfolio)) {
      if (this.currentCoin && this.currentCoin.symbol === symbol) {
        totalValue += holding.amount * this.currentCoin.price;
      } else {
        // Use stored average price for other coins
        totalValue += holding.amount * holding.avgPrice;
      }
    }
    return totalValue;
  }

  updateUI() {
    this.updateBalance();
    this.updatePortfolioView();
  }

  updateBalance() {
    const portfolioValueUSD = this.getPortfolioValue();
    const currentBalanceSOL = this.getCurrentBalanceSOL();
    const currentBalanceUSD = this.getCurrentBalanceUSD();
    const totalValueSOL = currentBalanceSOL + (portfolioValueUSD / this.solPriceUSD);
    const totalValueUSD = portfolioValueUSD + currentBalanceUSD;

    document.getElementById('portfolioValueSOL').textContent = `${totalValueSOL.toFixed(2)} SOL`;
    document.getElementById('portfolioValueUSD').textContent = `$${totalValueUSD.toFixed(2)}`;
  }

  updatePortfolioView() {
    console.log('📊 Updating portfolio view with data:', this.portfolio);
    
    const totalInvested = Object.values(this.portfolio).reduce(
      (sum, holding) => sum + (holding.totalInvested || 0),
      0
    );
    const currentValue = this.getPortfolioValue();
    const pnl = currentValue - totalInvested;

    console.log(`💰 Portfolio calculations: Total Invested=$${totalInvested.toFixed(2)}, Current Value=$${currentValue.toFixed(2)}, P&L=$${pnl.toFixed(2)}`);

    document.getElementById(
      'totalInvested'
    ).textContent = `$${totalInvested.toFixed(2)}`;
    document.getElementById(
      'currentValue'
    ).textContent = `$${currentValue.toFixed(2)}`;

    const pnlElement = document.getElementById('totalPnL');
    pnlElement.textContent = `$${pnl.toFixed(2)}`;
    pnlElement.className = `pnl ${pnl >= 0 ? 'positive' : 'negative'}`;

    this.updateHoldingsList();
  }

  formatPrice(price) {
    if (!price || price === 0) return '$0';
    
    const absPrice = Math.abs(price);
    
    if (absPrice >= 1000000000) {
      return `$${(price / 1000000000).toFixed(1)}B`;
    } else if (absPrice >= 1000000) {
      return `$${(price / 1000000).toFixed(1)}M`;
    } else if (absPrice >= 1000) {
      return `$${(price / 1000).toFixed(1)}K`;
    } else if (absPrice >= 1) {
      return `$${price.toFixed(2)}`;
    } else {
      return `$${price.toFixed(6)}`;
    }
  }

  updateHoldingsList() {
    console.log('📈 Updating holdings list with portfolio:', this.portfolio);
    
    const holdingsList = document.getElementById('holdingsList');
    holdingsList.innerHTML = '';

    console.log(`📈 Portfolio has ${Object.keys(this.portfolio).length} holdings`);

    if (Object.keys(this.portfolio).length === 0) {
      console.log('📈 No holdings found, showing empty message');
      holdingsList.innerHTML =
        '<p style="text-align: center; color: #6c757d; padding: 20px;">No holdings yet</p>';
      return;
    }

    for (const [symbol, holding] of Object.entries(this.portfolio)) {
      const currentPrice =
        this.currentCoin && this.currentCoin.symbol === symbol
          ? this.currentCoin.price
          : holding.avgPrice;

      const currentValue = holding.amount * currentPrice;
      const pnl = currentValue - holding.totalInvested;
      const pnlPercent = (pnl / holding.totalInvested) * 100;

      const holdingElement = document.createElement('div');
      holdingElement.className = 'holding-item';
      holdingElement.innerHTML = `
                <div>
                    <div class="holding-symbol">${symbol}</div>
                    <div class="holding-amount">${(holding.amount || 0).toFixed(
                      6
                    )} coins</div>
                </div>
                <div>
                    <div class="holding-value">${this.formatPrice(currentValue)}</div>
                    <div class="holding-pnl ${
                      pnl >= 0 ? 'positive' : 'negative'
                    }">
                        ${pnl >= 0 ? '+' : ''}${this.formatPrice(pnl)} (${pnlPercent.toFixed(1)}%)
                    </div>
                </div>
            `;
      holdingsList.appendChild(holdingElement);
    }
  }

  async updateStartingBalance() {
    const newBalanceSOL = parseFloat(
      document.getElementById('startingBalance').value
    );
    if (newBalanceSOL && newBalanceSOL > 0) {
      this.settings.startingBalanceSOL = newBalanceSOL;
      await this.saveData();
      this.updateUI();
      this.showNotification('Starting balance updated', 'success');
    } else {
      this.showNotification('Please enter a valid SOL balance', 'warning');
    }
  }

  async clearAllData() {
    if (
      confirm('Are you sure you want to clear all data? This cannot be undone.')
    ) {
      this.portfolio = {};
      this.settings.startingBalanceSOL = 100;
      await this.saveData();
      this.updateUI();
      this.showNotification('All data cleared', 'success');
    }
  }

  startPriceUpdates() {
    // Update prices every 30 seconds
    setInterval(() => {
      if (this.currentCoin) {
        this.updateCurrentCoinPrice();
      }
    }, 30000);
  }

  async updateCurrentCoinPrice() {
    try {
      const updatedData = await this.fetchCoinData(this.currentCoin.symbol);
      if (updatedData) {
        this.currentCoin = updatedData;
        this.displayCoinInfo(updatedData);
        this.updateUI();
      }
    } catch (error) {
      console.error('Error updating price:', error);
    }
  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;

    document.getElementById('notifications').appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  async loadData() {
    try {
      const result = await chrome.storage.local.get(['portfolio', 'settings', 'solPriceUSD']);
      this.portfolio = result.portfolio || {};
      this.settings = { ...this.settings, ...result.settings };
      this.solPriceUSD = result.solPriceUSD || 100;

      // Set remember view checkbox
      if (this.settings.rememberView) {
        document.getElementById('rememberView').checked = true;
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }

  async fetchSOLPrice() {
    try {
      // Fetch SOL price from CoinGecko API
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
      const data = await response.json();
      this.solPriceUSD = data.solana.usd;
      
      // Save SOL price to storage
      await chrome.storage.local.set({ solPriceUSD: this.solPriceUSD });
    } catch (error) {
      console.error('Error fetching SOL price:', error);
      // Use fallback price if API fails
      this.solPriceUSD = 100;
    }
  }

  async saveData() {
    try {
      await chrome.storage.local.set({
        portfolio: this.portfolio,
        settings: this.settings,
      });
    } catch (error) {
      console.error('Error saving data:', error);
    }
  }

  // Snipe functionality
  async injectSnipeButtons() {
    try {
      const button = document.getElementById('injectSnipeButtons');
      button.textContent = 'Injecting...';
      button.disabled = true;

      const response = await chrome.runtime.sendMessage({
        action: 'injectSnipeButtons',
      });

      if (response.success) {
        this.showNotification('Snipe buttons injected into Axiom!', 'success');
      } else {
        this.showNotification('Failed to inject snipe buttons', 'error');
      }
    } catch (error) {
      console.error('Error injecting snipe buttons:', error);
      this.showNotification('Error injecting snipe buttons', 'error');
    } finally {
      const button = document.getElementById('injectSnipeButtons');
      button.textContent = 'Inject into Axiom';
      button.disabled = false;
    }
  }

  async clearSnipes() {
    if (
      confirm(
        'Are you sure you want to clear all snipes? This cannot be undone.'
      )
    ) {
      try {
        await chrome.storage.local.remove(['snipes']);
        this.showNotification('All snipes cleared', 'success');
        this.loadSnipes();
      } catch (error) {
        console.error('Error clearing snipes:', error);
        this.showNotification('Error clearing snipes', 'error');
      }
    }
  }

  async loadSnipes() {
    try {
      const { snipes = [] } = await chrome.storage.local.get(['snipes']);
      this.displaySnipes(snipes);
    } catch (error) {
      console.error('Error loading snipes:', error);
    }
  }

  displaySnipes(snipes) {
    const container = document.getElementById('snipesList');

    if (snipes.length === 0) {
      container.innerHTML = `
        <div class="no-snipes">
          <p>No snipes yet! Click "Inject into Axiom" to get started.</p>
        </div>
      `;
      return;
    }

    // Sort by timestamp (newest first)
    const sortedSnipes = snipes.sort((a, b) => b.timestamp - a.timestamp);

    container.innerHTML = sortedSnipes
      .map(
        (snipe) => `
      <div class="snipe-item">
        <div class="snipe-header">
          <span class="snipe-symbol">${snipe.symbol}</span>
          <span class="snipe-time">${this.formatTime(snipe.timestamp)}</span>
        </div>
        <div class="snipe-details">
          <div class="snipe-info">
            <span class="snipe-price">${this.formatPrice(snipe.price || 0)}</span>
            <span class="snipe-source">${snipe.source}</span>
          </div>
          <div class="snipe-actions">
            <button class="snipe-buy-btn" onclick="this.snipeToken('${
              snipe.symbol
            }', '${snipe.contractAddress || ''}', ${snipe.price || 0})">
              Execute Snipe
            </button>
          </div>
        </div>
        ${
          snipe.contractAddress
            ? `<div class="snipe-address">${snipe.contractAddress}</div>`
            : ''
        }
      </div>
    `
      )
      .join('');
  }

  async updateSnipes() {
    // This method will be called when we switch to the snipes tab
    await this.loadSnipes();
  }

  formatTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new CryptoPaperTraderSidePanel();
});
