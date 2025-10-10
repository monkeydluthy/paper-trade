// Content script for Crypto Paper Trader - Axiom Snipe Integration
// This script runs on web pages to inject snipe buttons into Axiom

class AxiomSnipeInjector {
  constructor() {
    this.observers = new Map();
    this.injectedButtons = new Set();
    this.lastCopiedAddress = null; // Store the last copied contract address
    this.setupGlobalClipboardInterceptor(); // Set up global clipboard monitoring
    this.init();
  }

  setupGlobalClipboardInterceptor() {
    // Intercept clipboard writes globally to capture contract addresses
    const originalWriteText = navigator.clipboard.writeText.bind(navigator.clipboard);
    const self = this;
    
    navigator.clipboard.writeText = async function(text) {
      console.log('📋 Global clipboard interceptor - captured write:', text);
      
      // Check if it's a valid contract address
      if (text && text.length >= 32 && /^[A-Za-z0-9]+$/.test(text)) {
        console.log('✅ Detected contract address in clipboard:', text);
        self.lastCopiedAddress = text;
      }
      
      return originalWriteText(text);
    };
    
    console.log('🔍 Global clipboard interceptor installed');
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

      case 'scrapeTokenPrice':
        console.log(`🔍 Scraping price for token: ${request.symbol}`);
        const price = this.scrapeTokenPriceFromPage(request.symbol);
        sendResponse({ price: price });
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
      console.log(
        '🔍 Debug: No buttons found. Let me check all buttons on page...'
      );
      const allButtons = document.querySelectorAll('button');
      console.log(`📊 Total buttons on page: ${allButtons.length}`);

      // Log first few buttons for debugging
      Array.from(allButtons)
        .slice(0, 5)
        .forEach((btn, i) => {
          console.log(`Button ${i}:`, {
            text: btn.textContent?.trim(),
            classes: btn.className,
            tagName: btn.tagName,
          });
        });
    }

    instantBuyButtons.forEach((button, index) => {
      // Find the token row for this button to check if we've already injected
      const tokenRow =
        button.closest(
          '[class*="row"], [class*="item"], [class*="card"], [class*="pair"], tr, div[class*="token"]'
        ) || button.parentElement;

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
      const tokenRow =
        button.closest(
          '[class*="row"], [class*="item"], [class*="card"], [class*="pair"], tr, div[class*="token"]'
        ) || button.parentElement;

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

    console.log(
      `🔍 Found ${potentialButtons.length} potential buttons, grouped into ${finalButtons.length} rows`
    );
    return finalButtons;
  }

  isInstantBuyButton(element) {
    const text = element.textContent || element.innerText || '';
    const classes = element.className || '';

    // Only target actual buy/trade buttons, not general token listings
    return (
      element.tagName === 'BUTTON' &&
      // Has lightning bolt icon (Axiom's instant buy indicator)
      (element.querySelector('svg[class*="lightning"], svg[class*="bolt"]') ||
        // Has specific buy/trade text
        (text.includes('Buy') && text.length < 20) ||
        (text.includes('Trade') && text.length < 20) ||
        // Has SOL text (Axiom trading buttons)
        (text.includes('SOL') && text.length < 10) ||
        // Has instant/trade classes
        classes.includes('instant') ||
        classes.includes('buy') ||
        classes.includes('trade') ||
        classes.includes('lightning'))
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
      const existingFlexContainer = parent.querySelector(
        '.crypto-paper-trader-button-group'
      );

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

    confirmBtn.addEventListener('click', async () => {
      const amount = parseFloat(amountInput.value) || 0;
      if (amount <= 0) {
        alert('Please enter a valid amount');
        return;
      }

      // Extract token data from the surrounding context
      const tokenData = await this.extractTokenDataFromContext(instantBuyButton);
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

  async extractTokenDataFromContext(button) {
    console.log('🔍 Extracting token data from Axiom context...');
    let tokenData = {
      symbol: 'Unknown',
      contractAddress: null,
      price: null,
      timestamp: Date.now(),
      source: 'axiom',
    };

    // Method 1: Look for Axiom-specific containers - go higher up the DOM tree
    let currentElement = button;
    let bestContainer = null;

    // Go up to 10 levels to find the main token container
    for (let i = 0; i < 10 && currentElement; i++) {
      const text = currentElement.textContent || '';
      console.log(
        `🔍 Level ${i} container text:`,
        text.substring(0, 200) + '...'
      );

      // Look for containers that have token data (symbol + MC + contract)
      if (text.includes('MC$') && text.length > 50) {
        bestContainer = currentElement;
        console.log(
          `✅ Found token container at level ${i}:`,
          text.substring(0, 100) + '...'
        );
        break;
      }
      currentElement = currentElement.parentElement;
    }

    if (bestContainer) {
      console.log('📦 Using best container for extraction');
      tokenData.symbol =
        this.extractSymbolFromAxiom(bestContainer) || tokenData.symbol;
      tokenData.contractAddress =
        await this.extractContractFromAxiom(bestContainer) ||
        tokenData.contractAddress;
      tokenData.price =
        this.extractPriceFromAxiom(bestContainer) || tokenData.price;
    }

    // Method 2: If we didn't find good data OR missing contract address, try parent elements
    if (
      tokenData.symbol === 'Unknown' ||
      !tokenData.price ||
      tokenData.price === 0.000001 ||
      !tokenData.contractAddress
    ) {
      console.log('🔄 Trying parent elements for better data...');
      console.log('🔍 Current tokenData before parent search:', tokenData);
      currentElement = button.parentElement;
      for (let i = 0; i < 5 && currentElement; i++) {
        console.log(`🔍 Checking parent element ${i}:`, currentElement.tagName, currentElement.className);
        const symbol = this.extractSymbolFromAxiom(currentElement);
        const contract = await this.extractContractFromAxiom(currentElement);
        const price = this.extractPriceFromAxiom(currentElement);
        
        console.log(`🔍 Parent ${i} results:`, { symbol, contract, price });

        if (
          symbol &&
          symbol !== 'Unknown' &&
          !this.isCommonWord(symbol) &&
          tokenData.symbol === 'Unknown'
        ) {
          tokenData.symbol = symbol;
          console.log('✅ Found symbol in parent:', symbol);
        }
        if (contract && !tokenData.contractAddress) {
          tokenData.contractAddress = contract;
          console.log('✅ Found contract in parent:', contract);
        }
        if (price && price !== 0.000001 && !tokenData.price) {
          tokenData.price = price;
          console.log('✅ Found price in parent:', price);
        }

        currentElement = currentElement.parentElement;
      }
    }

    // Method 3: Look for specific Axiom patterns in nearby elements
    const nearbyElements = [
      button.parentElement,
      button.parentElement?.parentElement,
      button.parentElement?.parentElement?.parentElement,
      button.parentElement?.parentElement?.parentElement?.parentElement,
    ].filter(Boolean);

    for (const element of nearbyElements) {
      const axiomData = this.extractAxiomSpecificData(element);
      if (
        axiomData.symbol &&
        !this.isCommonWord(axiomData.symbol) &&
        tokenData.symbol === 'Unknown'
      )
        tokenData.symbol = axiomData.symbol;
      // Only accept contract addresses from this method if we still don't have one
      // This is a fallback that will accept truncated addresses as a last resort
      if (axiomData.contractAddress && !tokenData.contractAddress)
        tokenData.contractAddress = axiomData.contractAddress;
      if (axiomData.price && axiomData.price !== 0.000001 && !tokenData.price)
        tokenData.price = axiomData.price;
    }

    console.log('✅ Final extracted token data:', tokenData);
    return tokenData;
  }

  extractAxiomSpecificData(button) {
    // Look for Axiom-specific data patterns
    const result = { symbol: null, contractAddress: null, price: null };

    // Look for token symbol in nearby text - expand search area
    const nearbyElements = [
      button.parentElement,
      button.parentElement?.parentElement,
      button.parentElement?.parentElement?.parentElement,
      button.parentElement?.parentElement?.parentElement?.parentElement,
    ].filter(Boolean);

    console.log(
      '🔍 Searching for token data in nearby elements:',
      nearbyElements.length
    );

    for (const element of nearbyElements) {
      const text = element.textContent || '';
      console.log('📝 Element text:', text.substring(0, 100) + '...');

      // Look for token symbols - more comprehensive patterns
      const symbolPatterns = [
        /\b([A-Z]{2,10})\b/, // Basic uppercase
        /^([A-Z]{2,10})\s/, // Start of line
        /\s([A-Z]{2,10})\s/, // Between spaces
        /([A-Z]{2,10})\//, // Before slash
      ];

      for (const pattern of symbolPatterns) {
        const symbolMatch = text.match(pattern);
        if (
          symbolMatch &&
          ![
            'BUY',
            'SELL',
            'TRADE',
            'SOL',
            'USD',
            'MC',
            'VOL',
            'P',
            'Q',
            'DS',
          ].includes(symbolMatch[1])
        ) {
          result.symbol = symbolMatch[1];
          console.log('✅ Found symbol:', result.symbol);
          break;
        }
      }

      // Look for contract addresses - more comprehensive patterns
      const addressPatterns = [
        /\b([A-Za-z0-9]{32,44})\b/, // Basic pattern
        /^([A-Za-z0-9]{32,44})\s/, // Start of line
        /\s([A-Za-z0-9]{32,44})\s/, // Between spaces
        /([A-Za-z0-9]{32,44})\.\.\./, // Truncated addresses
      ];

      for (const pattern of addressPatterns) {
        const addressMatch = text.match(pattern);
        if (addressMatch && addressMatch[1].length >= 32) {
          result.contractAddress = addressMatch[1];
          console.log('✅ Found contract:', result.contractAddress);
          break;
        }
      }

      // Look for prices - more comprehensive patterns
      const pricePatterns = [
        /\$([0-9]+\.?[0-9]*[KMB]?)/, // $123.45 or $123K
        /F=\s*([0-9]+\.?[0-9]*[KMB]?)/, // F= 123.45
        /MC\s*\$([0-9]+\.?[0-9]*[KMB]?)/, // MC $123.45
        /([0-9]+\.?[0-9]*[KMB]?)\s*\$/, // 123.45$
      ];

      for (const pattern of pricePatterns) {
        const priceMatch = text.match(pattern);
        if (priceMatch) {
          let price = parseFloat(priceMatch[1]);
          // Handle K, M, B suffixes based on the matched value, not the full text
          if (priceMatch[1].toUpperCase().includes('K')) price *= 1000;
          if (priceMatch[1].toUpperCase().includes('M')) price *= 1000000;
          if (priceMatch[1].toUpperCase().includes('B')) price *= 1000000000;
          result.price = price;
          console.log('✅ Found price:', result.price);
          break;
        }
      }
    }

    console.log('🎯 Final extracted data:', result);
    return result;
  }

  extractSymbol(element) {
    // Look for token symbol in various patterns - more comprehensive
    const selectors = [
      '[class*="symbol"]',
      '[class*="token"]',
      '[class*="name"]',
      '[class*="pair"]',
      '[class*="title"]',
      '[data-testid*="symbol"]',
      '[data-testid*="token"]',
      '[data-testid*="name"]',
      'h1',
      'h2',
      'h3',
      'h4',
      '.title',
      '.token-name',
      '.pair-name',
      'span[class*="text"]',
      'div[class*="text"]',
      'p[class*="text"]',
    ];

    for (const selector of selectors) {
      const symbolElements = element.querySelectorAll(selector);
      for (const symbolElement of symbolElements) {
        const text = symbolElement.textContent?.trim();
        if (text && text.length >= 2 && text.length <= 10) {
          // Check if it's a valid token symbol (letters only, not common words)
          if (
            /^[A-Za-z]+$/.test(text) &&
            ![
              'BUY',
              'SELL',
              'TRADE',
              'SOL',
              'USD',
              'MC',
              'VOL',
              'Price',
              'Amount',
              'Contract',
              'Address',
            ].includes(text.toUpperCase())
          ) {
            console.log('✅ Found symbol via selector:', text.toUpperCase());
            return text.toUpperCase();
          }
        }
      }
    }

    // Fallback: look for uppercase text patterns in the element
    const text = element.textContent || '';
    const patterns = [
      /\b([A-Z]{2,10})\b/, // Basic uppercase
      /^([A-Z]{2,10})\s/, // Start of line
      /\s([A-Z]{2,10})\s/, // Between spaces
      /([A-Z]{2,10})\//, // Before slash
      /([A-Z]{2,10})-$/, // Before dash
      /([A-Z]{2,10})\$/, // Before dollar
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (
        match &&
        ![
          'BUY',
          'SELL',
          'TRADE',
          'SOL',
          'USD',
          'MC',
          'VOL',
          'P',
          'Q',
          'DS',
        ].includes(match[1])
      ) {
        console.log('✅ Found symbol via pattern:', match[1]);
        return match[1];
      }
    }

    console.log('❌ No symbol found in element');
    return 'UNKNOWN';
  }

  extractContractAddress(element) {
    // Look for contract address (copy buttons, links, etc.) - more comprehensive
    const selectors = [
      'button[class*="copy"]',
      '[class*="address"]',
      '[data-address]',
      '[data-contract]',
      '[data-testid*="address"]',
      '[data-testid*="contract"]',
      'span[class*="text"]',
      'div[class*="text"]',
      'p[class*="text"]',
    ];

    // Check for data attributes first
    for (const selector of selectors) {
      const elements = element.querySelectorAll(selector);
      for (const el of elements) {
        const address =
          el.getAttribute('data-address') ||
          el.getAttribute('data-contract') ||
          el.getAttribute('data-value') ||
          el.textContent?.trim();
        if (address && this.isValidAddress(address)) {
          console.log('✅ Found contract via selector:', address);
          return address;
        }
      }
    }

    // Look for links with addresses
    const linkSelectors = [
      'a[href*="solscan"]',
      'a[href*="etherscan"]',
      'a[href*="explorer"]',
      'a[href*="scan"]',
      'a[href*="address"]',
    ];

    for (const selector of linkSelectors) {
      const links = element.querySelectorAll(selector);
      for (const link of links) {
        const href = link.getAttribute('href');
        if (href) {
          // Extract address from various URL patterns
          const addressPatterns = [
            /\/([A-Za-z0-9]{32,44})/, // Basic pattern
            /address\/([A-Za-z0-9]{32,44})/, // /address/...
            /token\/([A-Za-z0-9]{32,44})/, // /token/...
            /contract\/([A-Za-z0-9]{32,44})/, // /contract/...
          ];

          for (const pattern of addressPatterns) {
            const addressMatch = href.match(pattern);
            if (addressMatch && this.isValidAddress(addressMatch[1])) {
              console.log('✅ Found contract via link:', addressMatch[1]);
              return addressMatch[1];
            }
          }
        }
      }
    }

    // Fallback: search text content for address patterns
    const text = element.textContent || '';
    const addressPatterns = [
      /\b([A-Za-z0-9]{32,44})\b/, // Basic pattern
      /^([A-Za-z0-9]{32,44})\s/, // Start of line
      /\s([A-Za-z0-9]{32,44})\s/, // Between spaces
      /([A-Za-z0-9]{32,44})\.\.\./, // Truncated addresses
    ];

    for (const pattern of addressPatterns) {
      const match = text.match(pattern);
      if (match && this.isValidAddress(match[1])) {
        console.log('✅ Found contract via text pattern:', match[1]);
        return match[1];
      }
    }

    console.log('❌ No contract address found in element');
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

  // Axiom-specific extraction methods
  extractSymbolFromAxiom(element) {
    console.log('🔍 Extracting symbol from Axiom element...');
    console.log(
      '📦 Element HTML:',
      element.outerHTML.substring(0, 500) + '...'
    );

    // Look for common Axiom patterns
    const text = element.textContent || '';
    console.log('📝 Element text:', text.substring(0, 300) + '...');

    // Look for token name patterns first (prioritize these)
    const tokenNamePatterns = [
      // Specific Axiom patterns from the logs
      /([A-Z][a-zA-Z]+)\s+Speed\s+Of\s+Light/i, // "SOL Speed Of Light"
      /([A-Z][a-zA-Z]+)\s+Of\s+Light/i, // "SOL Of Light"
      /([A-Z][a-zA-Z]+)\s+Inconvenience/i, // "BNB Inconvenience"
      
      // PumpFun patterns
      /([A-Z][a-zA-Z]+)\s+PumpFun/i, // "PFF PumpFunFloki"
      /([A-Z][a-zA-Z]+)\s+Pump/i, // "PFF Pump"
      /([A-Z][a-zA-Z]+)\s+Fun/i, // "PFF Fun"

      // General patterns
      /([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+)*)\s+Coin/i, // "Inconvenience Coin", "Bitcoin Coin"
      /([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+)*)\s+Token/i, // "Inconvenience Token"
      /([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+)*)\s+MC\$/i, // "BNB Inconvenience Coin MC$21.1K"
      /([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+)*)\s+MC/i, // "BNB Inconvenience Coin MC"
    ];

    for (const pattern of tokenNamePatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        let symbol = match[1].trim();

        // Clean up the symbol
        symbol = symbol.replace(/\s+Coin$/, '').replace(/\s+Token$/, '');

        // For multi-word symbols, take the first word or create a short version
        if (symbol.includes(' ')) {
          const words = symbol.split(' ');
          if (words.length > 1) {
            // Take first word if it's reasonable, otherwise create acronym
            const firstWord = words[0];
            if (firstWord.length >= 2 && firstWord.length <= 8) {
              symbol = firstWord;
            } else {
              // Create acronym from first letters
              symbol = words
                .map((w) => w.charAt(0))
                .join('')
                .toUpperCase();
            }
          }
        }

        console.log(`🔍 Processing token name: ${match[1]} → ${symbol}`);

        // Filter out common words and invalid symbols
        if (
          !this.isCommonWord(symbol) &&
          symbol.length >= 2 &&
          symbol.length <= 15 &&
          /^[A-Za-z]+$/.test(symbol)
        ) {
          console.log('✅ Found token name:', symbol);
          return symbol;
        }
      }
    }

    // Look for MEMESEM-like patterns (all caps, 3-10 characters)
    const tokenSymbolPatterns = [
      /\b([A-Z]{3,10})\b/, // Basic uppercase letters (3-10 chars)
      /^([A-Z]{3,10})\s/, // Start of line
      /\s([A-Z]{3,10})\s/, // Between spaces
      /([A-Z]{3,10})\//, // Before slash
      /([A-Z]{3,10})-$/, // Before dash
      /([A-Z]{3,10})\$/, // Before dollar
      /([A-Z]{3,10})\s*SOL/, // Before SOL
      /([A-Z]{3,10})\s*USDC/, // Before USDC
      /([A-Z]{3,10})\s*MC/, // Before MC
      /([A-Z]{3,10})\s*V/, // Before V
    ];

    // Extract all potential symbols and filter
    const potentialSymbols = [];
    for (const pattern of tokenSymbolPatterns) {
      const matches = text.match(new RegExp(pattern.source, 'g'));
      if (matches) {
        matches.forEach((match) => {
          const symbol = match.replace(/[^A-Z]/g, '');
          if (
            symbol &&
            symbol.length >= 3 &&
            symbol.length <= 10 &&
            !this.isCommonWord(symbol)
          ) {
            potentialSymbols.push(symbol);
          }
        });
      }
    }

    if (potentialSymbols.length > 0) {
      // Return the first valid symbol found
      const symbol = potentialSymbols[0];
      console.log('✅ Found Axiom symbol:', symbol);
      return symbol;
    }

    // Look in specific elements with more targeted approach
    const symbolSelectors = [
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      '[class*="title"]',
      '[class*="name"]',
      '[class*="symbol"]',
      '[class*="token"]',
      '[class*="pair"]',
      'span',
      'div',
      'p',
      'strong',
      'b',
    ];

    for (const selector of symbolSelectors) {
      const elements = element.querySelectorAll(selector);
      for (const el of elements) {
        const text = el.textContent?.trim();
        if (text && text.length >= 3 && text.length <= 10) {
          // Check if it's all uppercase letters (token symbol)
          if (/^[A-Z]+$/.test(text) && !this.isCommonWord(text)) {
            console.log('✅ Found Axiom symbol via selector:', text);
            return text;
          }
        }
      }
    }

    console.log('❌ No symbol found in Axiom element');
    return null;
  }

  async extractContractFromAxiom(element) {
    console.log('🔍 Extracting contract from Axiom element...');
    console.log(
      '📦 Element HTML for contract:',
      element.outerHTML.substring(0, 500) + '...'
    );

    // NEW METHOD: Try to click copy buttons and capture clipboard content
    const allButtons = Array.from(element.querySelectorAll('button'));
    console.log(`🔍 Total buttons in element: ${allButtons.length}`);
    
    const copyButtonsWithIcons = allButtons.filter(btn => {
      // Find buttons that have SVG icons (likely copy buttons)
      const hasSvg = btn.querySelector('svg');
      const isEmpty = btn.textContent?.trim() === '';
      const hasIconClass = btn.className.toLowerCase().includes('icon');
      
      console.log(`🔍 Button check:`, {
        hasSvg,
        isEmpty,
        hasIconClass,
        text: btn.textContent?.substring(0, 20),
        className: btn.className
      });
      
      return (hasSvg && isEmpty) || hasIconClass;
    });

    console.log(`🔍 Found ${copyButtonsWithIcons.length} icon-only buttons (potential copy buttons)`);

    for (const button of copyButtonsWithIcons) {
      try {
        console.log('🔍 Attempting to click copy button:', button.outerHTML.substring(0, 150));
        
        // Clear the last copied address before clicking
        this.lastCopiedAddress = null;

        // Click the button
        button.click();
        console.log('🖱️ Clicked button, waiting for clipboard...');

        // Wait a bit for the clipboard to be written
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Check if our global interceptor caught an address
        if (this.lastCopiedAddress && this.isValidAddress(this.lastCopiedAddress)) {
          console.log('✅ Successfully extracted full contract address via global interceptor:', this.lastCopiedAddress);
          return this.lastCopiedAddress;
        }
        
        // Also try reading clipboard directly (with focus)
        try {
          // Ensure document is focused before reading clipboard
          window.focus();
          await new Promise(resolve => setTimeout(resolve, 100)); // Small delay for focus
          
          const readText = await navigator.clipboard.readText();
          if (readText && this.isValidAddress(readText)) {
            console.log('✅ Successfully extracted full contract address from clipboard:', readText);
            return readText;
          }
        } catch (e) {
          console.log('⚠️ Cannot read clipboard:', e.message);
        }
        
      } catch (error) {
        console.log('⚠️ Error clicking copy button:', error);
      }
    }

    // Fallback to attribute checking
    const copySelectors = [
      // Common copy button patterns
      '[data-clipboard-text]',
      '[data-copy]', 
      '[data-address]',
      '[data-contract]',
      '[data-value]',
      // Axiom-specific patterns
      'button[title*="copy"]',
      'button[aria-label*="copy"]',
      '[class*="copy"]',
      '[class*="clipboard"]',
      '[class*="paste"]',
      // Icon-based selectors
      'button svg[class*="copy"]',
      'button svg[class*="clipboard"]',
      '[class*="copy-icon"]',
      '[class*="clipboard-icon"]',
      // Generic button with copy-like attributes
      'button[onclick*="copy"]',
      'button[onclick*="clipboard"]',
      // More specific Axiom patterns
      'button[class*="icon"]',
      '[class*="address"] button',
      '[class*="contract"] button',
      'button svg',
      'button[data-testid*="copy"]',
      'button[data-testid*="address"]'
    ];
    
    const copyButtons = element.querySelectorAll(copySelectors.join(', '));
    console.log(`🔍 Found ${copyButtons.length} potential copy buttons`);
    
    for (const button of copyButtons) {
      console.log('🔍 Checking copy button:', button.tagName, button.className, button.outerHTML.substring(0, 200));
      
      // Check various attributes for the full address
      const fullAddress = button.getAttribute('data-clipboard-text') || 
                         button.getAttribute('data-copy') || 
                         button.getAttribute('data-address') || 
                         button.getAttribute('data-contract') || 
                         button.getAttribute('data-value') ||
                         button.getAttribute('title') ||
                         button.getAttribute('aria-label') ||
                         button.textContent?.trim();
      
      console.log('🔍 Copy button address candidate:', fullAddress);
      
      if (fullAddress && this.isValidAddress(fullAddress)) {
        console.log('✅ Found full contract address from copy button:', fullAddress);
        return fullAddress;
      }
    }

    // Also check for onclick handlers that might contain the full address
    const allButtons = element.querySelectorAll('button');
    for (const button of allButtons) {
      const onclick = button.getAttribute('onclick');
      if (onclick) {
        console.log('🔍 Checking onclick handler:', onclick);
        // Look for addresses in onclick handlers
        const addressMatch = onclick.match(/([A-Za-z0-9]{32,44})/);
        if (addressMatch && this.isValidAddress(addressMatch[1])) {
          console.log('✅ Found full contract address from onclick:', addressMatch[1]);
          return addressMatch[1];
        }
      }
    }

    const text = element.textContent || '';
    console.log(
      '📝 Element text for contract search:',
      text.substring(0, 300) + '...'
    );

    // Axiom-specific contract address patterns - handle truncated addresses
    const contractPatterns = [
      /\b([A-Za-z0-9]{32,44})\b/, // Basic full pattern
      /^([A-Za-z0-9]{32,44})\s/, // Start of line
      /\s([A-Za-z0-9]{32,44})\s/, // Between spaces
      /([A-Za-z0-9]{32,44})\.\.\./, // Truncated addresses with dots
      /([A-Za-z0-9]{32,44})...$/, // End truncated
      /([A-Za-z0-9]{4})\.\.\.([A-Za-z0-9]{4})/, // Pattern like "Ck5D...BAGS"
    ];

    for (const pattern of contractPatterns) {
      const match = text.match(pattern);
      if (match) {
        if (match[1] && this.isValidAddress(match[1])) {
          console.log('✅ Found Axiom contract via pattern:', match[1]);
          return match[1];
        }
        // Handle truncated pattern like "Ck5D...BAGS"
        if (match[1] && match[2] && match[0].includes('...')) {
          // For truncated addresses, we'll store the partial info
          const truncatedAddress = match[0];
          console.log('⚠️ Found truncated contract:', truncatedAddress);
          return truncatedAddress; // We'll handle this in the background
        }
      }
    }

    // Look in specific elements for contract addresses
    const contractSelectors = [
      '[class*="address"]',
      '[class*="contract"]',
      '[class*="hash"]',
      '[class*="token-address"]',
      '[class*="contract-address"]',
      '[data-address]',
      '[data-contract]',
      '[data-value]',
      '[data-token-address]',
      '[data-contract-address]',
      'button',
      'span',
      'div',
      'p',
      'a',
      // Axiom-specific patterns
      '[class*="token"]',
      '[class*="pair"]',
      '[class*="symbol"]'
    ];

    for (const selector of contractSelectors) {
      const elements = element.querySelectorAll(selector);
      for (const el of elements) {
        // Check attributes first
        const address =
          el.getAttribute('data-address') ||
          el.getAttribute('data-contract') ||
          el.getAttribute('data-value') ||
          el.getAttribute('href') ||
          el.textContent?.trim();

        if (address) {
          // Check if it's a full valid address
          if (this.isValidAddress(address)) {
            console.log('✅ Found Axiom contract via selector:', address);
            return address;
          }
          // Check if it's a truncated address
          if (address.includes('...') && address.length > 10) {
            console.log('⚠️ Found truncated contract via selector:', address);
            return address;
          }
        }
      }
    }

    // NEW: Look for full addresses in the entire page DOM by searching for specific patterns
    // This is more aggressive but should find full addresses that are displayed elsewhere
    console.log('🔍 Searching entire page for full contract addresses...');
    
    // Look for any element that contains a full contract address
    const allElements = document.querySelectorAll('*');
    const fullAddresses = new Set();
    
    for (const el of allElements) {
      const text = el.textContent || '';
      const attributes = Array.from(el.attributes || []).map(attr => attr.value);
      
      // Check text content
      const textMatches = text.match(/\b([A-Za-z0-9]{32,44})\b/g);
      if (textMatches) {
        for (const match of textMatches) {
          if (this.isValidAddress(match)) {
            fullAddresses.add(match);
          }
        }
      }
      
      // Check attributes
      for (const attrValue of attributes) {
        const attrMatches = attrValue.match(/\b([A-Za-z0-9]{32,44})\b/g);
        if (attrMatches) {
          for (const match of attrMatches) {
            if (this.isValidAddress(match)) {
              fullAddresses.add(match);
            }
          }
        }
      }
    }
    
    console.log('🔍 Found full addresses on page:', Array.from(fullAddresses));
    
    // If we found full addresses, try to match them with our truncated one
    if (fullAddresses.size > 0) {
      const truncatedAddress = this.extractTruncatedAddress(element);
      if (truncatedAddress) {
        console.log('🔍 Looking for match with truncated address:', truncatedAddress);
        for (const fullAddress of fullAddresses) {
          if (fullAddress.startsWith(truncatedAddress.substring(0, 4)) || 
              fullAddress.endsWith(truncatedAddress.substring(truncatedAddress.length - 4))) {
            console.log('✅ Matched truncated to full address:', truncatedAddress, '->', fullAddress);
            return fullAddress;
          }
        }
      }
    }

    console.log('❌ No contract found in Axiom element');
    return null;
  }

  extractPriceFromAxiom(element) {
    console.log('🔍 Extracting price from Axiom element...');
    console.log(
      '📦 Element HTML for price:',
      element.outerHTML.substring(0, 1000) + '...'
    );

    const text = element.textContent || '';
    console.log('📝 Full element text for price search:', text);

    // Look for all dollar amounts first
    const dollarMatches = text.match(/\$[0-9]+\.?[0-9]*[KMB]?/g);
    console.log('💵 All dollar amounts found:', dollarMatches);

    // Axiom-specific patterns - be more aggressive in finding prices
    const pricePatterns = [
      // Market Cap patterns (prioritize these)
      /MC\s*\$([0-9]+\.?[0-9]*[KMB]?)/i, // MC $4.58M
      /Market\s*Cap[:\s]*\$([0-9]+\.?[0-9]*[KMB]?)/i, // Market Cap: $4.58M
      /MC[:\s]*([0-9]+\.?[0-9]*[KMB]?)/i, // MC: 4.58M

      // Volume patterns
      /V\s*\$([0-9]+\.?[0-9]*[KMB]?)/i, // V $157K
      /Volume[:\s]*\$([0-9]+\.?[0-9]*[KMB]?)/i, // Volume: $157K

      // Any dollar amount pattern
      /\$([0-9]+\.?[0-9]*[KMB]?)/g, // $123.45 or $123K
    ];

    // First, try to find market cap specifically
    const mcPatterns = [
      /MC\s*\$([0-9]+\.?[0-9]*[KMB]?)/i,
      /Market\s*Cap[:\s]*\$([0-9]+\.?[0-9]*[KMB]?)/i,
      /MC[:\s]*([0-9]+\.?[0-9]*[KMB]?)/i,
    ];

    console.log('🔍 Looking for market cap patterns in:', text);

    for (const pattern of mcPatterns) {
      const match = text.match(pattern);
      if (match) {
        console.log(`🔍 MC Pattern match: ${match[0]} -> ${match[1]}`);

        let price = parseFloat(match[1]);
        const originalPrice = price;

        // Handle K, M, B suffixes based on the captured value, not the full match
        if (match[1].toUpperCase().includes('K')) price *= 1000;
        if (match[1].toUpperCase().includes('M')) price *= 1000000;
        if (match[1].toUpperCase().includes('B')) price *= 1000000000;

        console.log(
          `💰 Market cap calculation: ${originalPrice} → ${price} (${match[1]})`
        );

        // Market cap should be reasonable (between $1K and $1T)
        if (price >= 1000 && price <= 1000000000000) {
          console.log('✅ Found market cap:', price);
          return price;
        } else {
          console.log(`⚠️ Market cap out of range: ${price}`);
        }
      }
    }

    // Try to find any reasonable dollar amount
    if (dollarMatches) {
      for (const dollarMatch of dollarMatches) {
        const numberMatch = dollarMatch.match(/\$([0-9]+\.?[0-9]*[KMB]?)/);
        if (numberMatch) {
          let price = parseFloat(numberMatch[1]);

          // Skip very large numbers that are likely not prices
          if (price > 1000000000000) {
            console.log('⚠️ Skipping very large number:', price);
            continue;
          }

          // Handle K, M, B suffixes
          if (dollarMatch.toUpperCase().includes('K')) price *= 1000;
          if (dollarMatch.toUpperCase().includes('M')) price *= 1000000;
          if (dollarMatch.toUpperCase().includes('B')) price *= 1000000000;

          // Skip transaction counts, fees, etc.
          const context = text.substring(
            Math.max(0, text.indexOf(dollarMatch) - 10),
            text.indexOf(dollarMatch) + 20
          );
          if (
            context.includes('TX') ||
            context.includes('F ') ||
            context.includes('F=')
          ) {
            console.log('⚠️ Skipping TX/F context:', dollarMatch);
            continue;
          }

          // Accept reasonable prices
          if (price >= 100 && price <= 100000000000) {
            console.log(
              '✅ Found reasonable price:',
              price,
              'from:',
              dollarMatch
            );
            return price;
          }
        }
      }
    }

    // If still no price found, try to find any number that could be a price
    const numberPatterns = [
      /([0-9]+\.[0-9]+[KMB]?)/g, // 4.58M, 157K
      /([0-9]+[KMB])/g, // 458M, 157K
    ];

    for (const pattern of numberPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        for (const match of matches) {
          let price = parseFloat(match.replace(/[KMB]/g, ''));

          // Handle K, M, B suffixes
          if (match.toUpperCase().includes('K')) price *= 1000;
          if (match.toUpperCase().includes('M')) price *= 1000000;
          if (match.toUpperCase().includes('B')) price *= 1000000000;

          // Accept reasonable prices (but skip if we already found a good one)
          if (price >= 100 && price <= 100000000000) {
            console.log(
              '✅ Found reasonable number price:',
              price,
              'from:',
              match
            );
            return price;
          }
        }
      }
    }

    // If no price found, use a default memecoin price
    console.log('⚠️ No price found, using default memecoin price');
    return 0.000001;
  }

  isValidAddress(address) {
    if (!address || typeof address !== 'string') return false;

    // Ethereum address validation (0x + 40 hex characters)
    const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;

    // Solana address validation (Base58, 32-44 characters)
    const solanaAddressRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

    return ethAddressRegex.test(address) || solanaAddressRegex.test(address);
  }

  extractTruncatedAddress(element) {
    // Extract truncated address from element text
    const text = element.textContent || '';
    const truncatedPatterns = [
      /([A-Za-z0-9]{4})\.\.\.([A-Za-z0-9]{4})/, // Pattern like "Ck5D...BAGS"
      /([A-Za-z0-9]{4})...([A-Za-z0-9]{4})/, // Pattern like "Ck5D...BAGS" (no dots)
    ];
    
    for (const pattern of truncatedPatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[0]; // Return the full truncated string
      }
    }
    
    return null;
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

  isCommonWord(word) {
    const commonWords = [
      'BUY',
      'SELL',
      'TRADE',
      'SOL',
      'USD',
      'USDC',
      'MC',
      'VOL',
      'P',
      'Q',
      'DS',
      'Price',
      'Amount',
      'Contract',
      'Address',
      'Token',
      'Pair',
      'Market',
      'Volume',
      'Liquidity',
      'Holders',
      'Supply',
      'Cap',
      'Change',
      'Percent',
      'Total',
      'Value',
      'SNIPE',
      'SNIPED',
      'INJECT',
      'AXIOM',
      'BUTTON',
      'CLICK',
    ];
    return commonWords.includes(word.toUpperCase());
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

  scrapeTokenPriceFromPage(symbol) {
    console.log(`🔍 Scraping price for ${symbol} from current page...`);

    try {
      // Look for the token in the current page content
      const pageText = document.body.textContent || '';
      console.log(`📄 Page text length: ${pageText.length} characters`);

      // Search for market cap patterns with the token symbol
      const patterns = [
        new RegExp(`${symbol}[^>]*MC\\$([0-9]+\\.[0-9]*[KMB]?)`, 'i'),
        new RegExp(`MC\\$([0-9]+\\.[0-9]*[KMB]?)[^>]*${symbol}`, 'i'),
        new RegExp(
          `${symbol}[^>]*Market\\s*Cap[^>]*\\$([0-9]+\\.[0-9]*[KMB]?)`,
          'i'
        ),
      ];

      for (const pattern of patterns) {
        const match = pageText.match(pattern);
        if (match) {
          let price = parseFloat(match[1]);
          if (match[1].includes('K')) price *= 1000;
          if (match[1].includes('M')) price *= 1000000;
          if (match[1].includes('B')) price *= 1000000000;

          console.log(`✅ Found price for ${symbol}: $${price}`);
          return price;
        }
      }

      // If no specific pattern found, look for any market cap near the symbol
      const symbolIndex = pageText.indexOf(symbol);
      if (symbolIndex !== -1) {
        const context = pageText.substring(
          Math.max(0, symbolIndex - 100),
          symbolIndex + 200
        );
        const mcMatch = context.match(/MC\s*\$([0-9]+\.?[0-9]*[KMB]?)/i);
        if (mcMatch) {
          let price = parseFloat(mcMatch[1]);
          if (mcMatch[1].includes('K')) price *= 1000;
          if (mcMatch[1].includes('M')) price *= 1000000;
          if (mcMatch[1].includes('B')) price *= 1000000000;

          console.log(`✅ Found context price for ${symbol}: $${price}`);
          return price;
        }
      }

      console.log(`❌ No price found for ${symbol} on current page`);
      return null;
    } catch (error) {
      console.error(`Error scraping price for ${symbol}:`, error);
      return null;
    }
  }
}

// Initialize the Axiom snipe injector
const axiomInjector = new AxiomSnipeInjector();

// Export for potential use by other scripts
window.axiomSnipeInjector = axiomInjector;
