// Crypto Paper Trader - Main Popup Script
class CryptoPaperTrader {
  constructor() {
    this.currentCoin = null;
    this.portfolio = {};
    this.settings = {
      startingBalanceSOL: 100, // Starting balance in SOL
      priceSource: 'coinmarketcap',
    };
    this.solPriceUSD = 100; // SOL price in USD (will be fetched)
    this.init();
  }

  async init() {
    // Force popup width to 400px
    this.forcePopupWidth();
    await this.loadData();
    this.setupEventListeners();
    this.updateUI();
    this.startPriceUpdates();
  }

  forcePopupWidth() {
    // Multiple approaches to ensure 400px width
    document.body.style.width = '400px';
    document.body.style.minWidth = '400px';
    document.body.style.maxWidth = '400px';
    document.documentElement.style.width = '400px';
    document.documentElement.style.minWidth = '400px';
    document.documentElement.style.maxWidth = '400px';

    // Also set on the container
    const container = document.querySelector('.container');
    if (container) {
      container.style.width = '400px';
      container.style.minWidth = '400px';
      container.style.maxWidth = '400px';
    }
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

  async fetchFromEtherscan(contractAddress) {
    // Simulate Etherscan API call
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
    // Simulate CoinGecko contract API
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
    // Simulate DexScreener API for new tokens
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
    // Simulate CoinMarketCap contract API
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
    // Simulate Solscan API call for Solana tokens
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
    // Simulate Jupiter API call for Solana tokens
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
    // Simulate DexScreener API for Solana tokens
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
    // Simulate CoinGecko API for Solana tokens
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
      const currentBalance = this.getCurrentBalance();
      if (totalValue > currentBalance) {
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

  getCurrentBalance() {
    const totalInvested = Object.values(this.portfolio).reduce(
      (sum, holding) => sum + holding.totalInvested,
      0
    );
    return this.settings.startingBalance - totalInvested;
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
    const portfolioValue = this.getPortfolioValue();
    const currentBalance = this.getCurrentBalance();
    const totalValue = portfolioValue + currentBalance;

    document.getElementById(
      'portfolioValue'
    ).textContent = `$${totalValue.toFixed(2)}`;
  }

  updatePortfolioView() {
    const totalInvested = Object.values(this.portfolio).reduce(
      (sum, holding) => sum + holding.totalInvested,
      0
    );
    const currentValue = this.getPortfolioValue();
    const pnl = currentValue - totalInvested;

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

  updateHoldingsList() {
    const holdingsList = document.getElementById('holdingsList');
    holdingsList.innerHTML = '';

    if (Object.keys(this.portfolio).length === 0) {
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
                    <div class="holding-amount">${holding.amount.toFixed(
                      6
                    )} coins</div>
                </div>
                <div>
                    <div class="holding-value">$${currentValue.toFixed(2)}</div>
                    <div class="holding-pnl ${
                      pnl >= 0 ? 'positive' : 'negative'
                    }">
                        ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(
        2
      )} (${pnlPercent.toFixed(1)}%)
                    </div>
                </div>
            `;
      holdingsList.appendChild(holdingElement);
    }
  }

  async updateStartingBalance() {
    const newBalance = parseFloat(
      document.getElementById('startingBalance').value
    );
    if (newBalance && newBalance > 0) {
      this.settings.startingBalance = newBalance;
      await this.saveData();
      this.updateUI();
      this.showNotification('Starting balance updated', 'success');
    } else {
      this.showNotification('Please enter a valid balance', 'warning');
    }
  }

  async clearAllData() {
    if (
      confirm('Are you sure you want to clear all data? This cannot be undone.')
    ) {
      this.portfolio = {};
      this.settings.startingBalance = 10000;
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
      const result = await chrome.storage.local.get(['portfolio', 'settings']);
      this.portfolio = result.portfolio || {};
      this.settings = { ...this.settings, ...result.settings };
    } catch (error) {
      console.error('Error loading data:', error);
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
          <span class="snipe-symbol">${snipe.symbol || 'Unknown'}</span>
          <span class="snipe-time">${this.formatTime(snipe.timestamp)}</span>
        </div>
        <div class="snipe-details">
          <div class="snipe-detail">
            <span class="snipe-detail-label">Contract</span>
            <span class="snipe-detail-value">${
              snipe.contractAddress
                ? snipe.contractAddress.slice(0, 8) + '...'
                : 'N/A'
            }</span>
          </div>
          <div class="snipe-detail">
            <span class="snipe-detail-label">Price</span>
            <span class="snipe-detail-value">${
              snipe.price ? '$' + snipe.price : 'N/A'
            }</span>
          </div>
        </div>
        <span class="snipe-source">${snipe.source || 'unknown'}</span>
      </div>
    `
      )
      .join('');
  }

  formatTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 60000) {
      // Less than 1 minute
      return 'Just now';
    } else if (diff < 3600000) {
      // Less than 1 hour
      const minutes = Math.floor(diff / 60000);
      return `${minutes}m ago`;
    } else if (diff < 86400000) {
      // Less than 1 day
      const hours = Math.floor(diff / 3600000);
      return `${hours}h ago`;
    } else {
      const days = Math.floor(diff / 86400000);
      return `${days}d ago`;
    }
  }

  async updateSnipes() {
    // This method will be called when we switch to the snipes tab
    await this.loadSnipes();
  }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new CryptoPaperTrader();
});
