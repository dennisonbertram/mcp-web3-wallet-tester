# MCP Web3 Wallet Tester - LLM Usage Instructions

## What This MCP Server Does

The MCP Web3 Wallet Tester is a wallet server that enables automated testing of Web3 dApps using browser automation tools like Playwright. It acts as a bridge between your test scripts and a blockchain (typically Anvil local testnet), allowing you to:

1. Inject a Web3 provider into any web page
2. Intercept and control wallet requests from dApps
3. Approve/reject transactions, signatures, and permissions programmatically
4. Test Web3 applications without manual wallet interactions

## Architecture Overview

```
Browser (dApp) <--WebSocket--> MCP Wallet Server <--RPC--> Anvil/Blockchain
                                      ^
                                      |
                                   MCP Tools
                                   (HTTP API)
```

The server has three components:
- **MCP HTTP Server** (port 3001): Provides MCP tools for controlling the wallet
- **WebSocket Bridge** (port 8546): Receives wallet requests from the browser
- **Viem Wallet**: Signs and sends transactions to the blockchain

## Available MCP Tools

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `wallet_getStatus` | Get full wallet status | Check connection, balance, pending requests count |
| `wallet_getPendingRequests` | List pending requests | See what requests need approval |
| `wallet_approveRequest` | Approve a request | Allow a transaction, signature, or connection |
| `wallet_rejectRequest` | Reject a request | Deny a request (e.g., malicious tx) |
| `wallet_waitForRequest` | Block until request arrives | Synchronous approval workflow |
| `wallet_setAutoApprove` | Enable auto-approval | Skip manual approval for all requests |
| `wallet_getAddress` | Get wallet address | Verify which account is active |
| `wallet_getBalance` | Get ETH balance | Check available funds |
| `wallet_getChainId` | Get chain ID | Verify correct network |
| `wallet_getTransactionReceipt` | Get tx receipt | Check transaction result |
| `wallet_listAccounts` | List Anvil accounts | See all 10 test accounts |
| `wallet_switchAccount` | Switch account | Test with different accounts |
| `wallet_setPrivateKey` | Use custom key | Test with specific private key |

## Step-by-Step Testing Workflow

### Prerequisites

1. **Start Anvil** (local blockchain):
   ```bash
   tmux new-session -d -s anvil "anvil"
   ```

2. **Start MCP Wallet Server**:
   ```bash
   cd /path/to/mcp-web3-wallet-tester
   tmux new-session -d -s wallet-tester "npm start"
   ```

3. **Verify server is running**:
   ```bash
   curl http://localhost:3001/health
   ```

### Step 1: Inject Web3 Provider

Before interacting with a dApp, inject the provider script into the page:

```javascript
// Using Playwright
await page.evaluate(async () => {
  const script = document.createElement('script');
  script.src = 'http://localhost:3001/provider.js';
  document.head.appendChild(script);

  // Wait for provider to initialize
  await new Promise(resolve => setTimeout(resolve, 1000));
});
```

**Critical:** The provider MUST be injected before any wallet interactions occur. It connects to `ws://localhost:8546` and implements EIP-1193 on `window.ethereum`.

### Step 2: Trigger Wallet Action

Click a button or trigger an action in the dApp:

```javascript
await page.getByRole('button', { name: 'Connect Wallet' }).click();
```

### Step 3: Wait for Requests

After triggering an action, wait briefly for requests to queue:

```javascript
await new Promise(r => setTimeout(r, 500));
```

### Step 4: Check Pending Requests

Use `wallet_getPendingRequests` to see what needs approval:

```javascript
const result = await mcp__wallet__getPendingRequests();
const requests = JSON.parse(result.content[0].text);

// Example output:
// [
//   {
//     "id": "req_32e05da6",
//     "method": "eth_requestAccounts",
//     "params": []
//   }
// ]
```

### Step 5: Approve Requests

Approve each request by ID:

```javascript
for (const request of requests) {
  await mcp__wallet__approveRequest({ requestId: request.id });
  await new Promise(r => setTimeout(r, 100)); // Small delay
}
```

### Step 6: Handle Multi-Request Patterns

Many wallet operations trigger multiple requests in sequence. After approving the first batch, check again:

```javascript
// Wait for potential additional requests
await new Promise(r => setTimeout(r, 500));

// Check and approve again
const moreRequests = await mcp__wallet__getPendingRequests();
// ... approve if needed ...
```

### Step 7: Verify Result

Check the dApp UI or use MCP tools to verify success:

```javascript
// Get transaction receipt
const receipt = await mcp__wallet__getTransactionReceipt({
  hash: transactionHash
});
```

## Multi-Request Approval Pattern

**Critical Concept:** Most wallet operations trigger 2-3 requests in sequence.

### Example: Wallet Connection

When a user clicks "Connect Wallet", expect:
1. `eth_chainId` - Get chain ID
2. `eth_requestAccounts` - Request account access
3. Possibly `wallet_requestPermissions` - Request permissions (may fail - this is OK)

### Example: Send Transaction

When sending a transaction, expect:
1. `eth_chainId` - Verify chain
2. `eth_sendTransaction` - The actual transaction

### Handling Pattern

```javascript
async function approveAllPending() {
  const pending = await mcp__wallet__getPendingRequests();
  const requests = JSON.parse(pending.content[0].text);

  for (const req of requests) {
    await mcp__wallet__approveRequest({ requestId: req.id });
    await new Promise(r => setTimeout(r, 100));
  }

  return requests.length;
}

// After triggering an action
await page.click('button');
await new Promise(r => setTimeout(r, 500));

let totalApproved = await approveAllPending();

// Check for additional requests
await new Promise(r => setTimeout(r, 500));
totalApproved += await approveAllPending();
```

## Common Request Types

| Method | Purpose | Expected Params |
|--------|---------|-----------------|
| `eth_requestAccounts` | Connect wallet | `[]` |
| `eth_accounts` | Get current accounts | `[]` |
| `eth_chainId` | Get chain ID | `[]` |
| `eth_sendTransaction` | Send transaction | `[{ from, to, value, data, gas }]` |
| `personal_sign` | Sign message | `[message, address]` |
| `eth_signTypedData_v4` | Sign typed data | `[address, typedData]` |
| `wallet_requestPermissions` | Request permissions | `[{ eth_accounts: {} }]` |

## Common Pitfalls to Avoid

### 1. Injecting Provider Too Late

**Wrong:**
```javascript
await page.goto('http://localhost:3000');
await page.click('button'); // dApp already checked for wallet
await page.evaluate(() => { /* inject provider */ });
```

**Right:**
```javascript
await page.goto('http://localhost:3000');
await page.evaluate(() => { /* inject provider */ });
await new Promise(r => setTimeout(r, 1000)); // Wait for init
await page.click('button');
```

### 2. Not Waiting Between Actions

**Wrong:**
```javascript
await page.click('button');
await mcp__wallet__getPendingRequests(); // Might return empty
```

**Right:**
```javascript
await page.click('button');
await new Promise(r => setTimeout(r, 500)); // Wait for requests to queue
await mcp__wallet__getPendingRequests();
```

### 3. Approving Requests Without Checking

**Wrong:**
```javascript
await mcp__wallet__approveRequest({ requestId: 'req_12345678' }); // Hardcoded ID
```

**Right:**
```javascript
const pending = await mcp__wallet__getPendingRequests();
const requests = JSON.parse(pending.content[0].text);
for (const req of requests) {
  await mcp__wallet__approveRequest({ requestId: req.id });
}
```

### 4. Not Handling Unsupported Methods

Some methods like `wallet_requestPermissions` may not be supported. This is expected and doesn't block the flow:

```javascript
const pending = await mcp__wallet__getPendingRequests();
const requests = JSON.parse(pending.content[0].text);

for (const req of requests) {
  try {
    await mcp__wallet__approveRequest({ requestId: req.id });
  } catch (error) {
    // Log but don't fail on unsupported methods
    console.log(`Method ${req.method} not supported (OK)`);
  }
}
```

### 5. Forgetting to Check for Additional Requests

After approving the first batch, always check again:

```javascript
// First batch
await approveAllPending();

// Check for more requests (common pattern)
await new Promise(r => setTimeout(r, 500));
await approveAllPending();
```

## Using Auto-Approve Mode

For automated testing where all requests should be approved, use auto-approve:

```javascript
// Enable auto-approve
await mcp__wallet__setAutoApprove({ enabled: true });

// Now all requests are automatically approved
await page.click('button'); // No manual approval needed

// Disable when done
await mcp__wallet__setAutoApprove({ enabled: false });
```

**Warning:** Auto-approve should only be used in trusted test environments. Never use in production.

## Testing Multiple Accounts

The wallet server has access to 10 Anvil test accounts (0-9), each with 10,000 ETH:

```javascript
// List all accounts
const accounts = await mcp__wallet__listAccounts();

// Switch to account 1
await mcp__wallet__switchAccount({ accountIndex: 1 });

// Verify switch
const status = await mcp__wallet__getStatus();
// status.address will be the new account
```

## Debugging Tips

### Check Server Status

```javascript
const status = await mcp__wallet__getStatus();
console.log(JSON.parse(status.content[0].text));
// {
//   "address": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
//   "accountIndex": 0,
//   "chainId": 31337,
//   "pendingRequests": 2,
//   "autoApprove": false,
//   "balance": "9998.5"
// }
```

### Monitor Pending Requests Count

```javascript
const status = await mcp__wallet__getStatus();
const count = JSON.parse(status.content[0].text).pendingRequests;
console.log(`Pending: ${count}`);
```

### Check Transaction Receipt

```javascript
const receipt = await mcp__wallet__getTransactionReceipt({
  hash: '0xa7f3326544a3c26a6681654070cdfe0934d1e78cd0cf754e291db8d0ca7ce3f0'
});
console.log(JSON.parse(receipt.content[0].text));
```

### View Server Logs

```bash
tmux capture-pane -t wallet-tester -p | tail -50
```

## Complete Testing Example

Here's a complete example of testing a wallet connection and transaction:

```javascript
// 1. Navigate to dApp
await page.goto('http://localhost:3000');

// 2. Inject provider
await page.evaluate(async () => {
  const script = document.createElement('script');
  script.src = 'http://localhost:3001/provider.js';
  document.head.appendChild(script);
  await new Promise(resolve => setTimeout(resolve, 1000));
});

// 3. Connect wallet
await page.getByRole('button', { name: 'Connect Wallet' }).click();
await new Promise(r => setTimeout(r, 500));

// 4. Approve connection requests
let pending = await mcp__wallet__getPendingRequests();
let requests = JSON.parse(pending.content[0].text);
for (const req of requests) {
  await mcp__wallet__approveRequest({ requestId: req.id });
  await new Promise(r => setTimeout(r, 100));
}

// 5. Check for additional requests
await new Promise(r => setTimeout(r, 500));
pending = await mcp__wallet__getPendingRequests();
requests = JSON.parse(pending.content[0].text);
for (const req of requests) {
  await mcp__wallet__approveRequest({ requestId: req.id });
  await new Promise(r => setTimeout(r, 100));
}

// 6. Verify connection
await page.waitForSelector('text=Connected');

// 7. Send transaction
await page.getByRole('textbox', { name: 'To' })
  .fill('0x70997970C51812dc3A010C7d01b50e0d17dc79C8');
await page.getByRole('textbox', { name: 'Amount' }).fill('1.5');
await page.getByRole('button', { name: 'Send' }).click();

// 8. Approve transaction
await new Promise(r => setTimeout(r, 500));
pending = await mcp__wallet__getPendingRequests();
requests = JSON.parse(pending.content[0].text);
const txRequest = requests.find(r => r.method === 'eth_sendTransaction');
const result = await mcp__wallet__approveRequest({
  requestId: txRequest.id
});

// 9. Get transaction hash from result
const approval = JSON.parse(result.content[0].text);
const txHash = approval.result;

// 10. Wait for confirmation
await new Promise(r => setTimeout(r, 1000));

// 11. Verify transaction
const receipt = await mcp__wallet__getTransactionReceipt({ hash: txHash });
console.log('Transaction confirmed:', JSON.parse(receipt.content[0].text));
```

## Error Handling

All MCP tool responses include success/error information:

```javascript
const result = await mcp__wallet__approveRequest({ requestId: 'invalid-id' });
const response = JSON.parse(result.content[0].text);

if (!response.success) {
  console.error('Approval failed:', response.error);
}
```

## Summary

The MCP Web3 Wallet Tester enables fully automated Web3 dApp testing by:

1. **Injecting a Web3 provider** into any page
2. **Intercepting wallet requests** via WebSocket
3. **Controlling request approval** via MCP tools
4. **Supporting multiple accounts** for complex scenarios
5. **Providing transaction receipts** for verification

Key success factors:
- Inject provider BEFORE any wallet interactions
- Wait for requests to queue before checking
- Use polling pattern to handle multi-request flows
- Check for additional requests after first approval
- Use auto-approve mode for fully automated testing
- Verify results with transaction receipts

For detailed testing procedures and troubleshooting, see the [TESTING_GUIDE.md](./TESTING_GUIDE.md).
