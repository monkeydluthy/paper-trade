// Debug Script for Contract Address Extraction
// Run this in the browser console on the Axiom page to debug contract extraction

console.log('🔍 Starting Contract Address Debug...');

// Find all instant buy buttons
const buttons = Array.from(document.querySelectorAll('button'));
const instantBuyButtons = buttons.filter((btn) => {
  const text = btn.textContent?.trim().toUpperCase() || '';
  return text.includes('SOL') && text.length < 10;
});

console.log(`Found ${instantBuyButtons.length} instant buy buttons`);

// For the first button, extract all relevant data
if (instantBuyButtons.length > 0) {
  const button = instantBuyButtons[0];

  console.log('===== BUTTON ANALYSIS =====');
  console.log('Button element:', button);
  console.log('Button HTML:', button.outerHTML);

  // Find parent containers
  let currentElement = button;
  for (let i = 0; i < 10; i++) {
    console.log(`\n----- LEVEL ${i} PARENT -----`);
    console.log('Element:', currentElement);
    console.log('Class:', currentElement.className);
    console.log('ID:', currentElement.id);
    console.log(
      'Text (first 200 chars):',
      currentElement.textContent?.substring(0, 200)
    );
    console.log(
      'HTML (first 500 chars):',
      currentElement.outerHTML?.substring(0, 500)
    );

    // Look for all buttons in this container
    const buttonsInContainer = currentElement.querySelectorAll('button');
    console.log(`Buttons in container: ${buttonsInContainer.length}`);
    buttonsInContainer.forEach((btn, idx) => {
      console.log(`  Button ${idx}:`, btn.textContent?.trim(), btn.className);
      // Check for copy-related attributes
      const attrs = Array.from(btn.attributes).map(
        (a) => `${a.name}="${a.value}"`
      );
      console.log(`    Attributes:`, attrs);
    });

    // Look for all links in this container
    const linksInContainer = currentElement.querySelectorAll('a');
    console.log(`Links in container: ${linksInContainer.length}`);
    linksInContainer.forEach((link, idx) => {
      console.log(`  Link ${idx}:`, link.textContent?.trim());
      console.log(`    href:`, link.href);
      const attrs = Array.from(link.attributes).map(
        (a) => `${a.name}="${a.value}"`
      );
      console.log(`    Attributes:`, attrs);
    });

    // Look for spans that might contain addresses
    const spansInContainer = currentElement.querySelectorAll('span');
    console.log(`Spans in container: ${spansInContainer.length}`);
    spansInContainer.forEach((span, idx) => {
      const text = span.textContent?.trim() || '';
      // Only show spans that might contain addresses
      if (text.includes('...') || text.match(/^[A-Za-z0-9]{8,}$/)) {
        console.log(`  Span ${idx}:`, text);
        const attrs = Array.from(span.attributes).map(
          (a) => `${a.name}="${a.value}"`
        );
        console.log(`    Attributes:`, attrs);
      }
    });

    currentElement = currentElement.parentElement;
    if (!currentElement) break;
  }

  console.log('\n===== FULL PAGE CONTRACT SEARCH =====');

  // Search entire page for full contract addresses
  const allElements = document.querySelectorAll('*');
  const potentialAddresses = new Set();

  allElements.forEach((el) => {
    // Check text content
    const text = el.textContent || '';
    const textMatches = text.match(/\b([A-Za-z0-9]{32,44})\b/g);
    if (textMatches) {
      textMatches.forEach((match) => potentialAddresses.add(match));
    }

    // Check all attributes
    Array.from(el.attributes || []).forEach((attr) => {
      const matches = attr.value.match(/\b([A-Za-z0-9]{32,44})\b/g);
      if (matches) {
        matches.forEach((match) => potentialAddresses.add(match));
      }
    });
  });

  console.log('All potential contract addresses found on page:');
  potentialAddresses.forEach((addr) => {
    console.log(`  ${addr}`);

    // Find where this address appears
    const elementsWithAddress = Array.from(allElements).filter((el) => {
      return (
        el.textContent?.includes(addr) ||
        Array.from(el.attributes || []).some((a) => a.value.includes(addr))
      );
    });

    console.log(`    Found in ${elementsWithAddress.length} elements`);
    elementsWithAddress.slice(0, 3).forEach((el) => {
      console.log(
        `      - ${el.tagName}.${el.className}`,
        el.outerHTML.substring(0, 150)
      );
    });
  });

  console.log('\n===== TRUNCATED ADDRESS SEARCH =====');

  // Search for truncated addresses
  const truncatedPattern = /([A-Za-z0-9]{4})\.\.\.([A-Za-z0-9]{4})/g;
  const pageText = document.body.textContent || '';
  const truncatedMatches = [...pageText.matchAll(truncatedPattern)];

  console.log(`Found ${truncatedMatches.length} truncated addresses:`);
  truncatedMatches.forEach((match) => {
    console.log(`  ${match[0]} (start: ${match[1]}, end: ${match[2]})`);
  });
} else {
  console.log('❌ No instant buy buttons found on page');
}

console.log('\n✅ Debug complete! Copy the console output and share it.');
