// Content script for Crypto Paper Trader - Axiom Snipe Integration
// This script runs on web pages to inject snipe buttons into Axiom

class AxiomSnipeInjector {
  constructor() {
    this.observers = new Map();
    this.injectedButtons = new Set();
    this.init();
  }

  init() {
    this.setupMessageListener();
    this.detectAxiom();
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true;
    });
  }

  handleMessage(request, sender, sendResponse) {
    switch (request.action) {
      case 'injectSnipeButtons':
        this.injectAllSnipeButtons();
        sendResponse({ success: true });
        break;

      case 'getAxiomData':
        const data = this.extractAxiomTokenData();
        sendResponse({ success: true, data });
        break;

      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }
  }

  detectAxiom() {
    const currentUrl = window.location.href;
    console.log('🔍 Checking for Axiom on:', currentUrl);

    // Check if we're on Axiom
    if (this.isAxiomPage()) {
      console.log('✅ Axiom detected - setting up snipe injection');
      this.setupAxiomInjection();
    } else {
      console.log('❌ Not an Axiom page');
    }
  }

  isAxiomPage() {
    const currentUrl = window.location.href;
    const domain = window.location.hostname;

    const isAxiom =
      domain.includes('axiom') ||
      currentUrl.includes('axiom') ||
      document.title.toLowerCase().includes('axiom') ||
      document.querySelector('[class*="axiom"], [id*="axiom"]') !== null;

    console.log('🔍 Axiom detection check:', {
      domain,
      url: currentUrl,
      title: document.title,
      isAxiom,
    });

    return isAxiom;
  }

  setupAxiomInjection() {
    // Only setup observer - don't auto-inject
    // Injection will happen when user clicks "Inject into Axiom" button
    this.setupAxiomObserver();
  }

  setupAxiomObserver() {
    const observer = new MutationObserver((mutations) => {
      let shouldInject = false;

      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check if new instant buy buttons were added
              if (this.hasInstantBuyButton(node)) {
                shouldInject = true;
              }
            }
          });
        }
      });

      if (shouldInject) {
        setTimeout(() => this.injectAllSnipeButtons(), 500);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    this.observers.set('axiom', observer);
  }

  hasInstantBuyButton(element) {
    // Look for Axiom instant buy button patterns
    const selectors = [
      'button[class*="buy"]',
      'button[class*="instant"]',
      'button[class*="lightning"]',
      '[class*="buy-button"]',
      '[class*="instant-trade"]',
      '[class*="lightning"]',
    ];

    for (const selector of selectors) {
      if (element.querySelector && element.querySelector(selector)) {
        return true;
      }
      if (element.matches && element.matches(selector)) {
        return true;
      }
    }

    // Check for text-based patterns using JavaScript
    if (element.textContent && element.textContent.includes('SOL')) {
      return true;
    }

    return false;
  }

  injectAllSnipeButtons() {
    console.log('🎯 Injecting snipe buttons into Axiom...');

    // Find all instant buy buttons (now grouped by row)
    const instantBuyButtons = this.findInstantBuyButtons();
    console.log(`🔍 Found ${instantBuyButtons.length} instant buy buttons`);

    // Debug: Log all buttons found
    if (instantBuyButtons.length === 0) {
      console.log('🔍 Debug: No buttons found. Let me check all buttons on page...');
      const allButtons = document.querySelectorAll('button');
      console.log(`📊 Total buttons on page: ${allButtons.length}`);
      
      // Log first few buttons for debugging
      Array.from(allButtons).slice(0, 5).forEach((btn, i) => {
        console.log(`Button ${i}:`, {
          text: btn.textContent?.trim(),
          classes: btn.className,
          tagName: btn.tagName
        });
      });
    }

    instantBuyButtons.forEach((button, index) => {
      // Find the token row for this button to check if we've already injected
      const tokenRow = button.closest('[class*="row"], [class*="item"], [class*="card"], [class*="pair"], tr, div[class*="token"]') || button.parentElement;
      
      // Check if we've already injected into this row
      if (tokenRow && !this.injectedButtons.has(tokenRow)) {
        this.injectSnipeButton(button, index);
        this.injectedButtons.add(tokenRow); // Track by row instead of individual button
      }
    });

    console.log(
      `✅ Injected snipe buttons into ${this.injectedButtons.size} token rows total`
    );
  }

  findInstantBuyButtons() {
    // Find all buttons that could be trading buttons
    const allButtons = document.querySelectorAll('button');
    const potentialButtons = [];

    allButtons.forEach((button) => {
      const text = button.textContent || button.innerText || '';
      if (
        text.includes('SOL') ||
        text.includes('Buy') ||
        text.includes('Trade') ||
        text.includes('0 SOL') ||
        text.includes('1 SOL') ||
        this.isInstantBuyButton(button)
      ) {
        potentialButtons.push(button);
      }
    });

    // Group buttons by their parent token row to avoid multiple injections per row
    const buttonsByRow = new Map();
    
    potentialButtons.forEach((button) => {
      // Find the token row container (look for common patterns)
      const tokenRow = button.closest('[class*="row"], [class*="item"], [class*="card"], [class*="pair"], tr, div[class*="token"]') || button.parentElement;
      
      if (tokenRow) {
        // Use the token row as the key
        const rowKey = tokenRow;
        
        if (!buttonsByRow.has(rowKey)) {
          buttonsByRow.set(rowKey, []);
        }
        buttonsByRow.get(rowKey).push(button);
      }
    });

    // Return only one button per row (prefer the first/most relevant one)
    const finalButtons = [];
    buttonsByRow.forEach((buttonsInRow, rowKey) => {
      // Prefer buttons with SOL text, then Buy/Trade, then others
      const sortedButtons = buttonsInRow.sort((a, b) => {
        const aText = a.textContent || '';
        const bText = b.textContent || '';
        
        if (aText.includes('SOL') && !bText.includes('SOL')) return -1;
        if (!aText.includes('SOL') && bText.includes('SOL')) return 1;
        if (aText.includes('Buy') && !bText.includes('Buy')) return -1;
        if (!aText.includes('Buy') && bText.includes('Buy')) return 1;
        return 0;
      });
      
      // Take only the first (most relevant) button from each row
      finalButtons.push(sortedButtons[0]);
    });

    console.log(`🔍 Found ${potentialButtons.length} potential buttons, grouped into ${finalButtons.length} rows`);
    return finalButtons;
  }

  isInstantBuyButton(element) {
    const text = element.textContent || element.innerText || '';
    const classes = element.className || '';

    // Only target actual buy/trade buttons, not general token listings
    return (
      element.tagName === 'BUTTON' &&
      (
        // Has lightning bolt icon (Axiom's instant buy indicator)
        element.querySelector('svg[class*="lightning"], svg[class*="bolt"]') ||
        // Has specific buy/trade text
        (text.includes('Buy') && text.length < 20) ||
        (text.includes('Trade') && text.length < 20) ||
        // Has SOL text (Axiom trading buttons)
        (text.includes('SOL') && text.length < 10) ||
        // Has instant/trade classes
        classes.includes('instant') ||
        classes.includes('buy') ||
        classes.includes('trade') ||
        classes.includes('lightning')
      )
    );
  }

  injectSnipeButton(instantBuyButton, index) {
    try {
      // Create snipe button
      const snipeButton = this.createSnipeButton(instantBuyButton, index);

      // Insert next to the instant buy button
      this.insertSnipeButton(instantBuyButton, snipeButton);

      console.log(`Injected snipe button ${index + 1}`);
    } catch (error) {
      console.error('Error injecting snipe button:', error);
    }
  }

  createSnipeButton(instantBuyButton, index) {
    const snipeButton = document.createElement('button');

    // Style the button to match Axiom's design
    snipeButton.className = 'crypto-paper-trader-snipe-btn';
    snipeButton.innerHTML = `
      <span class="snipe-icon">🎯</span>
      <span class="snipe-text">SNIPE</span>
    `;

    // Add inline styles for better compatibility
    Object.assign(snipeButton.style, {
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      border: 'none',
      'border-radius': '8px',
      padding: '8px 12px',
      'font-size': '12px',
      'font-weight': '600',
      cursor: 'pointer',
      display: 'flex',
      'align-items': 'center',
      gap: '4px',
      transition: 'all 0.2s ease',
      'box-shadow': '0 2px 8px rgba(102, 126, 234, 0.3)',
      'min-width': '80px',
      height: '32px',
      flex: 'none', // Prevent flex shrinking
    });

    // Add hover effect
    snipeButton.addEventListener('mouseenter', () => {
      snipeButton.style.transform = 'translateY(-1px)';
      snipeButton.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
    });

    snipeButton.addEventListener('mouseleave', () => {
      snipeButton.style.transform = 'translateY(0)';
      snipeButton.style.boxShadow = '0 2px 8px rgba(102, 126, 234, 0.3)';
    });

    // Add click handler
    snipeButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.handleSnipeClick(instantBuyButton, index);
    });

    return snipeButton;
  }

  insertSnipeButton(instantBuyButton, snipeButton) {
    // Find the parent container and create a flex container for side-by-side layout
    const parent = instantBuyButton.parentNode;

    if (parent) {
      // Check if we need to create a flex container
      const existingFlexContainer = parent.querySelector('.crypto-paper-trader-button-group');
      
      if (!existingFlexContainer) {
        // Create a flex container to hold both buttons side by side
        const buttonGroup = document.createElement('div');
        buttonGroup.className = 'crypto-paper-trader-button-group';
        buttonGroup.style.cssText = `
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        `;

        // Replace the original button with our flex container
        parent.replaceChild(buttonGroup, instantBuyButton);
        
        // Add the original button back into the flex container
        buttonGroup.appendChild(instantBuyButton);
        
        // Add our snipe button to the flex container
        buttonGroup.appendChild(snipeButton);
      } else {
        // Flex container already exists, just add our snipe button
        existingFlexContainer.appendChild(snipeButton);
      }
    }
  }

  handleSnipeClick(instantBuyButton, index) {
    console.log(`Snipe button clicked for button ${index}`);

    // Show amount input popup
    this.showAmountInputPopup(instantBuyButton, index);
  }

  showAmountInputPopup(instantBuyButton, index) {
    // Create popup overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    // Create popup content
    const popup = document.createElement('div');
    popup.style.cssText = `
      background: #1a1a1a;
      border: 2px solid #667eea;
      border-radius: 12px;
      padding: 24px;
      min-width: 320px;
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    popup.innerHTML = `
      <h3 style="margin: 0 0 16px 0; color: #667eea;">🎯 Snipe Token</h3>
      <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Snipe Amount (SOL):</label>
        <input type="number" id="snipeAmount" placeholder="0.1" step="0.01" min="0" 
               style="width: 100%; padding: 8px; border: 1px solid #333; border-radius: 6px; background: #2a2a2a; color: white; font-size: 14px;">
        <div style="font-size: 11px; color: #999; margin-top: 4px;">
          Amount will be used directly in Axiom for trading
        </div>
      </div>
      <div style="display: flex; gap: 8px; justify-content: flex-end;">
        <button id="cancelSnipe" style="padding: 8px 16px; border: 1px solid #666; border-radius: 6px; background: #333; color: white; cursor: pointer;">Cancel</button>
        <button id="confirmSnipe" style="padding: 8px 16px; border: none; border-radius: 6px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; cursor: pointer; font-weight: 600;">Snipe</button>
      </div>
    `;

    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    // Focus on amount input
    const amountInput = popup.querySelector('#snipeAmount');
    amountInput.focus();
    amountInput.value = '0.1'; // Default amount

    // Event handlers
    const cancelBtn = popup.querySelector('#cancelSnipe');
    const confirmBtn = popup.querySelector('#confirmSnipe');

    const cleanup = () => {
      document.body.removeChild(overlay);
    };

    cancelBtn.addEventListener('click', cleanup);

    confirmBtn.addEventListener('click', () => {
      const amount = parseFloat(amountInput.value) || 0;
      if (amount <= 0) {
        alert('Please enter a valid amount');
        return;
      }

      // Extract token data from the surrounding context
      const tokenData = this.extractTokenDataFromContext(instantBuyButton);
      tokenData.amount = amount;

      // Send message to background script
      chrome.runtime.sendMessage({
        action: 'snipeToken',
        tokenData: tokenData,
        source: 'axiom',
      });

      cleanup();

      // Visual feedback
      const snipeButton = instantBuyButton.nextElementSibling;
      if (
        snipeButton &&
        snipeButton.classList.contains('crypto-paper-trader-snipe-btn')
      ) {
        snipeButton.style.background = '#28a745';
        snipeButton.innerHTML = '<span>✓ SNIPED</span>';

        setTimeout(() => {
          snipeButton.style.background =
            'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
          snipeButton.innerHTML =
            '<span class="snipe-icon">🎯</span><span class="snipe-text">SNIPE</span>';
        }, 2000);
      }
    });

    // Close on escape key
    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        cleanup();
      }
    });
  }

  extractTokenDataFromContext(button) {
    console.log('🔍 Extracting token data from context...');

    // Try multiple approaches to find token data
    let tokenData = {
      symbol: 'Unknown',
      contractAddress: null,
      price: null,
      timestamp: Date.now(),
      source: 'axiom',
    };

    // Method 1: Look for closest token container
    const tokenCard = button.closest(
      '[class*="card"], [class*="item"], [class*="token"], [class*="row"], [class*="pair"]'
    );

    if (tokenCard) {
      console.log('📦 Found token card:', tokenCard);
      tokenData.symbol = this.extractSymbol(tokenCard) || tokenData.symbol;
      tokenData.contractAddress =
        this.extractContractAddress(tokenCard) || tokenData.contractAddress;
      tokenData.price = this.extractPrice(tokenCard) || tokenData.price;
    }

    // Method 2: Look in the same row/container as the button
    const parentRow = button.closest('div[class*="row"], tr, [class*="item"]');
    if (parentRow && parentRow !== tokenCard) {
      console.log('📋 Found parent row:', parentRow);
      const symbol = this.extractSymbol(parentRow);
      const contractAddress = this.extractContractAddress(parentRow);
      const price = this.extractPrice(parentRow);

      if (symbol && symbol !== 'Unknown') tokenData.symbol = symbol;
      if (contractAddress) tokenData.contractAddress = contractAddress;
      if (price) tokenData.price = price;
    }

    // Method 3: Look for specific Axiom patterns
    const axiomTokenInfo = this.extractAxiomSpecificData(button);
    if (axiomTokenInfo.symbol) tokenData.symbol = axiomTokenInfo.symbol;
    if (axiomTokenInfo.contractAddress)
      tokenData.contractAddress = axiomTokenInfo.contractAddress;
    if (axiomTokenInfo.price) tokenData.price = axiomTokenInfo.price;

    console.log('✅ Extracted token data:', tokenData);
    return tokenData;
  }

  extractAxiomSpecificData(button) {
    // Look for Axiom-specific data patterns
    const result = { symbol: null, contractAddress: null, price: null };

    // Look for token symbol in nearby text
    const nearbyElements = [
      button.parentElement,
      button.parentElement?.parentElement,
      button.parentElement?.parentElement?.parentElement,
    ].filter(Boolean);

    for (const element of nearbyElements) {
      const text = element.textContent || '';

      // Look for token symbols (uppercase letters, 2-10 chars)
      const symbolMatch = text.match(/\b([A-Z]{2,10})\b/);
      if (
        symbolMatch &&
        !['BUY', 'SELL', 'TRADE', 'SOL', 'USD'].includes(symbolMatch[1])
      ) {
        result.symbol = symbolMatch[1];
      }

      // Look for contract addresses
      const addressMatch = text.match(/\b([A-Za-z0-9]{32,44})\b/);
      if (addressMatch) {
        result.contractAddress = addressMatch[1];
      }

      // Look for prices
      const priceMatch = text.match(/\$?([0-9]+\.?[0-9]*[KMB]?)/);
      if (priceMatch) {
        result.price = parseFloat(priceMatch[1]);
      }
    }

    return result;
  }

  extractSymbol(element) {
    // Look for token symbol in various patterns
    const selectors = [
      '[class*="symbol"]',
      '[class*="token"]',
      'span[class*="text"]',
      'div[class*="name"]',
    ];

    for (const selector of selectors) {
      const el = element.querySelector(selector);
      if (el && el.textContent) {
        const text = el.textContent.trim();
        if (text.length <= 10 && /^[A-Z0-9]+$/.test(text)) {
          return text;
        }
      }
    }

    return 'UNKNOWN';
  }

  extractContractAddress(element) {
    // Look for contract address (copy buttons, links, etc.)
    const copyButtons = element.querySelectorAll(
      'button[class*="copy"], [class*="address"]'
    );

    for (const button of copyButtons) {
      const address =
        button.getAttribute('data-address') ||
        button.getAttribute('data-contract') ||
        button.textContent;

      if (address && (address.startsWith('0x') || address.length >= 32)) {
        return address;
      }
    }

    return null;
  }

  extractPrice(element) {
    // Look for price information
    const priceElements = element.querySelectorAll(
      '[class*="price"], [class*="value"]'
    );

    for (const el of priceElements) {
      const text = el.textContent;
      const priceMatch = text.match(/\$?([0-9]+\.?[0-9]*)/);
      if (priceMatch) {
        return parseFloat(priceMatch[1]);
      }
    }

    return null;
  }

  extractAxiomTokenData() {
    // Extract general token data from the current page
    return {
      url: window.location.href,
      title: document.title,
      timestamp: Date.now(),
      buttons: this.findInstantBuyButtons().length,
    };
  }
}

// Initialize the Axiom snipe injector
const axiomInjector = new AxiomSnipeInjector();

// Export for potential use by other scripts
window.axiomSnipeInjector = axiomInjector;
