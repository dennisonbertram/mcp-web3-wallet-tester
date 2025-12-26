---
title: Guide: Provider Injection
category: guide
date: 2025-12-21
difficulty: intermediate
estimated_time: 15 minutes
---

# Guide: Web3 Provider Injection

## Overview

This guide explains how to inject the Web3 Test Wallet provider into dApps for automated testing. The provider implements EIP-1193 and EIP-6963 for maximum compatibility.

## Prerequisites

- MCP Web3 Wallet Tester server running (`npm start`)
- Anvil local blockchain running (`anvil`)
- Playwright or similar browser automation tool

## Methods of Injection

### Method 1: Playwright addInitScript (Recommended)

For automated testing, inject the provider **before** the page loads:

```typescript
// Fetch the provider script from the wallet server
const providerScript = await fetch('http://localhost:3001/provider.js').then(r => r.text());

// Inject BEFORE navigating to the dApp
await page.addInitScript(providerScript);

// Now navigate - the provider is already available
await page.goto('https://app.uniswap.org');
```

**Why this works:** The provider is injected at `document_start`, before any dApp JavaScript runs. This ensures:
- `window.ethereum` is set before dApp checks for it
- EIP-6963 announcements happen before dApp discovery

### Method 2: Script Tag Injection (Development Only)

For development and testing your own dApps:

```html
<!-- Add to your HTML before any dApp scripts -->
<script src="http://localhost:3001/provider.js"></script>
```

Or dynamically:

```javascript
const script = document.createElement('script');
script.src = 'http://localhost:3001/provider.js';
document.head.appendChild(script);
await new Promise(r => setTimeout(r, 1000)); // Wait for init
```

### Method 3: MCP Tool (For LLMs)

LLMs can get the provider script via MCP:

```javascript
// Get the provider script with optional custom WebSocket URL
const result = await wallet_getProviderScript({ wsUrl: 'ws://localhost:8546' });
const script = result.content[0].text;

// Inject via Playwright
await page.addInitScript(script);
```

## Configuration

### Custom WebSocket URL

By default, the provider connects to `ws://localhost:8546`. To use a different URL:

```javascript
// Set before loading the provider
window.__WEB3_TEST_WALLET_WS_URL__ = 'ws://my-server:9999';
```

Or use the MCP tool with the `wsUrl` parameter.

## Verification

After injection, verify the provider is working:

```javascript
await page.evaluate(() => {
  return {
    ethereumExists: typeof window.ethereum !== 'undefined',
    isTestWallet: window.ethereum?.isWeb3TestWallet,
    directAccess: typeof window.__web3TestWallet__ !== 'undefined'
  };
});
// Expected: { ethereumExists: true, isTestWallet: true, directAccess: true }
```

## Working with MetaMask

When MetaMask is installed, it locks `window.ethereum`. Our provider:

1. **Uses EIP-6963** - Modern dApps discover wallets via events
2. **Announces repeatedly** - Multiple announcements ensure visibility
3. **Monitors modals** - Re-announces when wallet selection UI opens

For reliable testing with MetaMask present:
- Use Playwright's `addInitScript` (injects before MetaMask)
- Use incognito mode (extensions disabled)
- Disable MetaMask temporarily

## Troubleshooting

### Provider Not Detected

**Symptom:** dApp shows "No wallet detected"

**Solution:** Ensure injection happens before page loads:
```javascript
// WRONG - provider loaded after dApp
await page.goto('https://app.example.com');
await page.addInitScript(providerScript);

// CORRECT - provider loaded before dApp
await page.addInitScript(providerScript);
await page.goto('https://app.example.com');
```

### WebSocket Connection Failed

**Symptom:** Console shows "[Web3TestWallet] WebSocket error"

**Solution:** Ensure wallet server is running:
```bash
curl http://localhost:3001/health
# Should return: {"status":"ok"}
```

### EIP-6963 Not Working

**Symptom:** Wallet doesn't appear in wallet selector

**Solution:** Check console for announcements:
```javascript
// Look for these log messages
// [Web3TestWallet] Announcing via EIP-6963: Web3 Test Wallet
// [Web3TestWallet] Received EIP-6963 request, announcing...
```

## Next Steps

- [Testing Guide](../TESTING_GUIDE.md) - Complete testing procedures
- [LLM Instructions](../LLM_INSTRUCTIONS.md) - Using with AI agents

## Related Documents

- [Architecture Overview](../architecture/overview-2025-12-21.md)
- [Testing Guide](../TESTING_GUIDE.md)
