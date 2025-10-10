// Debug Script to Test Copy Button Click
// This will find the copy buttons and simulate clicking them to extract the contract address

console.log('🔍 Starting Copy Button Click Test...');

// Find all instant buy buttons first
const buttons = Array.from(document.querySelectorAll('button'));
const instantBuyButtons = buttons.filter((btn) => {
  const text = btn.textContent?.trim().toUpperCase() || '';
  return text.includes('SOL') && text.length < 10;
});

console.log(`Found ${instantBuyButtons.length} instant buy buttons`);

if (instantBuyButtons.length > 0) {
  const button = instantBuyButtons[0];
  console.log('Testing on first instant buy button:', button);

  // Find the token container (go up the DOM)
  let container = button;
  for (let i = 0; i < 10; i++) {
    container = container.parentElement;
    if (!container) break;
    
    const text = container.textContent || '';
    if (text.includes('MC$') && text.length > 50) {
      console.log('✅ Found token container at level', i);
      break;
    }
  }

  if (container) {
    console.log('\n===== LOOKING FOR COPY BUTTONS =====');
    
    // Find all buttons in this container
    const allButtons = container.querySelectorAll('button');
    console.log(`Found ${allButtons.length} buttons in container`);
    
    allButtons.forEach((btn, idx) => {
      console.log(`\nButton ${idx}:`);
      console.log('  Text:', btn.textContent?.trim());
      console.log('  Class:', btn.className);
      console.log('  HTML:', btn.outerHTML.substring(0, 200));
      
      // Check if it might be a copy button
      const isCopyButton = 
        btn.querySelector('svg') || // Has an icon
        btn.className.toLowerCase().includes('copy') ||
        btn.className.toLowerCase().includes('icon') ||
        btn.getAttribute('aria-label')?.toLowerCase().includes('copy') ||
        btn.textContent?.trim() === ''; // Empty button (likely icon only)
      
      if (isCopyButton) {
        console.log('  ⭐ POTENTIAL COPY BUTTON DETECTED!');
      }
    });

    console.log('\n===== TESTING CLIPBOARD ACCESS =====');
    
    // Method 1: Try to read clipboard before clicking
    navigator.clipboard.readText().then(text => {
      console.log('Clipboard BEFORE click:', text);
    }).catch(err => {
      console.log('Cannot read clipboard (permission denied):', err.message);
    });

    // Method 2: Listen for copy events
    let copiedText = null;
    const copyHandler = (e) => {
      copiedText = e.clipboardData.getData('text');
      console.log('🎯 COPY EVENT DETECTED! Copied text:', copiedText);
      document.removeEventListener('copy', copyHandler);
    };
    document.addEventListener('copy', copyHandler);

    // Method 3: Intercept clipboard API
    const originalWriteText = navigator.clipboard.writeText.bind(navigator.clipboard);
    navigator.clipboard.writeText = function(text) {
      console.log('🎯 CLIPBOARD WRITE DETECTED! Text:', text);
      copiedText = text;
      return originalWriteText(text);
    };

    console.log('\n===== CLICKING COPY BUTTONS =====');
    console.log('Now I will try to click potential copy buttons...');
    
    // Find buttons that look like copy buttons
    const potentialCopyButtons = Array.from(allButtons).filter(btn => {
      return (
        btn.querySelector('svg') || // Has an icon
        btn.className.toLowerCase().includes('copy') ||
        btn.className.toLowerCase().includes('icon') ||
        (btn.textContent?.trim() === '' && btn.querySelector('*')) // Empty with child element
      );
    });

    console.log(`Found ${potentialCopyButtons.length} potential copy buttons`);

    // Try clicking each one
    potentialCopyButtons.forEach((btn, idx) => {
      console.log(`\n--- Attempting to click button ${idx} ---`);
      console.log('Button:', btn.outerHTML.substring(0, 200));
      
      try {
        // Wait a bit for clipboard to be ready
        setTimeout(() => {
          console.log(`Clicking button ${idx}...`);
          btn.click();
          
          // Check clipboard after click
          setTimeout(() => {
            navigator.clipboard.readText().then(text => {
              console.log(`✅ Clipboard AFTER clicking button ${idx}:`, text);
              
              // Check if it looks like a contract address
              if (text && text.length >= 32 && text.match(/^[A-Za-z0-9]+$/)) {
                console.log('🎉 THIS LOOKS LIKE A CONTRACT ADDRESS!');
                console.log('Full address:', text);
              }
            }).catch(err => {
              console.log('Cannot read clipboard:', err.message);
              if (copiedText) {
                console.log('But we caught it via event:', copiedText);
              }
            });
          }, 500);
        }, idx * 1000); // Stagger clicks
      } catch (error) {
        console.error(`Error clicking button ${idx}:`, error);
      }
    });

    // After all clicks, show summary
    setTimeout(() => {
      console.log('\n===== COPY TEST COMPLETE =====');
      if (copiedText) {
        console.log('✅ Successfully captured copied text:', copiedText);
      } else {
        console.log('❌ No text was captured. Try manually clicking the copy button and checking the clipboard.');
      }
    }, potentialCopyButtons.length * 1000 + 2000);

  } else {
    console.log('❌ Could not find token container');
  }
} else {
  console.log('❌ No instant buy buttons found');
}

console.log('\n💡 TIP: After running this script, manually click the copy/paste icon and run:');
console.log('   navigator.clipboard.readText().then(t => console.log("Clipboard:", t))');

