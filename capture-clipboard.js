// Simple Clipboard Capture Script
// 1. Run this script in the console
// 2. Click the copy/paste icon on Axiom
// 3. The script will automatically show you what was copied

console.log('📋 Clipboard Monitor Started!');
console.log('👉 Now click the copy/paste icon on the token...');

// Method 1: Listen for copy events
document.addEventListener('copy', (e) => {
  const copiedText = e.clipboardData.getData('text');
  console.log('\n🎯 COPY DETECTED!');
  console.log('Copied text:', copiedText);
  console.log('Length:', copiedText.length);
  
  // Check if it's a contract address
  if (copiedText && copiedText.length >= 32 && copiedText.match(/^[A-Za-z0-9]+$/)) {
    console.log('✅ This looks like a Solana contract address!');
  }
});

// Method 2: Intercept clipboard API
const originalWriteText = navigator.clipboard.writeText.bind(navigator.clipboard);
navigator.clipboard.writeText = function(text) {
  console.log('\n🎯 CLIPBOARD API WRITE DETECTED!');
  console.log('Text:', text);
  console.log('Length:', text.length);
  
  if (text && text.length >= 32 && text.match(/^[A-Za-z0-9]+$/)) {
    console.log('✅ This looks like a Solana contract address!');
  }
  
  return originalWriteText(text);
};

// Method 3: Manual check command
console.log('\n💡 Or run this command after clicking the copy button:');
console.log('navigator.clipboard.readText().then(t => console.log("Clipboard:", t))');

// Keep monitoring
console.log('\n⏳ Monitoring clipboard... Click the copy button now!');

