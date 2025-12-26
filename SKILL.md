---
name: web3-wallet-tester
description: Test Web3 dApps with a programmatic wallet. Use when testing dApps, simulating wallet connections, approving transactions, signing messages, or automating Web3 testing. Triggers: "test wallet", "connect wallet", "approve transaction", "Web3 testing", "dApp testing", "Ethereum wallet", "MetaMask replacement", "Anvil testing".
---

# Web3 Wallet Tester Skill

A programmable Ethereum wallet for automated Web3 dApp testing. Inject a Web3 provider into any page, intercept wallet requests, and control approvals programmatically. Works with Anvil local testnet for fast, deterministic testing.

## What This Does

The Web3 Wallet Tester acts as a bridge between browser automation and blockchain testing:

1. **Injects EIP-1193 Provider** - Full `window.ethereum` implementation
2. **Intercepts Wallet Requests** - Captures eth_sendTransaction, personal_sign, etc.
3. **Programmatic Control** - Approve/reject via TypeScript client
4. **Multi-Account Support** - Switch between 10 Anvil test accounts
5. **Transaction Management** - Sign and send transactions to Anvil

Use this when testing dApps that require wallet interactions without manual MetaMask clicking.

## Prerequisites

Before using the wallet tester, you need:

1. **Anvil running** - Local blockchain on port 8545
2. **Wallet server running** - MCP server on port 3001
3. **Built provider** - Compiled provider.js script

## Setup

Start the required services in separate tmux sessions:

```bash
# Terminal 1: Start Anvil (local blockchain)
tmux new-session -d -s anvil "cd /Users/dennisonbertram/conductor/workspaces/mcp-web3-wallet-tester/ottawa && anvil"

# Terminal 2: Build and start wallet server
tmux new-session -d -s wallet-tester "cd /Users/dennisonbertram/conductor/workspaces/mcp-web3-wallet-tester/ottawa && npm run build && npm start"

# Wait for services to start
sleep 3

# Verify server is ready
curl http://localhost:3001/health
```

**Wait for both services to be ready before running scripts.**

## How It Works

The server has three components that work together:

```
Browser (dApp) <--WebSocket--> Wallet Server <--RPC--> Anvil
                                    ^
                                    |
                              HTTP Client API
                              (TypeScript scripts)
```

1. **HTTP Server** (port 3001) - Serves provider.js and client API
2. **WebSocket Bridge** (port 8546) - Receives wallet requests from browser
3. **Viem Wallet** - Signs and sends transactions to Anvil (port 8545)

The client API connects to the HTTP server to control the wallet.

## Writing Scripts

Execute scripts inline using heredocs—no need to write files for one-off automation:

```bash
cd /Users/dennisonbertram/conductor/workspaces/mcp-web3-wallet-tester/ottawa && bun x tsx <<'EOF'
import { connect } from "./src/client.js";

const client = await connect("http://localhost:3001");

// Your wallet automation code here
const status = await client.getStatus();
console.log({ address: status.address, balance: status.balance });

await client.disconnect();
EOF
```

**Only write to files when:**
- The script needs to be reused multiple times
- The script is complex and you need to iterate on it
- The user explicitly asks for a saved script

### Basic Template

```bash
cd /Users/dennisonbertram/conductor/workspaces/mcp-web3-wallet-tester/ottawa && bun x tsx <<'EOF'
import { connect } from "./src/client.js";

const client = await connect("http://localhost:3001");

// Your automation code here
const status = await client.getStatus();
console.log({
  address: status.address,
  chainId: status.chainId,
  balance: status.balance,
  pendingRequests: status.pendingRequests
});

// Always disconnect so the script exits
await client.disconnect();
EOF
```

### Key Principles

1. **Small scripts** - Each script should do ONE thing (inject, approve, check status)
2. **Evaluate state** - Always log status at the end to decide next steps
3. **Disconnect to exit** - Call `await client.disconnect()` at the end
4. **Wait for requests** - Add delays after triggering wallet actions
5. **Check pending twice** - Many operations queue multiple requests

## Client API

The `WalletClient` interface provides these methods:

```typescript
// Status and monitoring
await client.getStatus();              // Get address, balance, pending count, chain ID
await client.getPendingRequests();     // List all pending requests

// Request management
await client.waitForRequest(opts);     // Block until request arrives (sync pattern)
await client.approveRequest(id);       // Approve by request ID
await client.rejectRequest(id, reason); // Reject with optional reason

// Configuration
await client.setAutoApprove(enabled);  // Enable/disable auto-approval

// Provider injection
await client.getProviderScript(wsUrl); // Get provider.js for injection

// High-level helpers
await client.approveAllPending(opts);  // Approve all pending requests
await client.approveUntilEmpty(opts);  // Approve in rounds until queue empty

// Cleanup
await client.disconnect();             // Disconnect (important for script exit)
```

### Status Response

```typescript
{
  address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  accountIndex: 0,
  chainId: 31337,
  pendingRequests: 2,
  autoApprove: false,
  balance: "9998.5"
}
```

### Request Object

```typescript
{
  id: "req_32e05da6",
  method: "eth_sendTransaction",
  params: [{ from, to, value, data, gas }],
  timestamp: 1640995200000
}
```

## Workflow Loop

Follow this pattern for Web3 dApp testing:

### 1. Inject Provider BEFORE page.goto

**Critical:** Provider must be injected before the page loads.

```bash
cd /Users/dennisonbertram/conductor/workspaces/mcp-web3-wallet-tester/ottawa && bun x tsx <<'EOF'
import { connect } from "./src/client.js";

const client = await connect("http://localhost:3001");

// Get provider script
const providerScript = await client.getProviderScript();
console.log("Provider script length:", providerScript.length);

await client.disconnect();
EOF
```

Then inject it in your browser automation before navigation.

### 2. Trigger Action in dApp

Click a button or interact with the dApp to trigger a wallet request.

### 3. Wait for Requests

After triggering an action, wait ~500ms for requests to queue:

```bash
cd /Users/dennisonbertram/conductor/workspaces/mcp-web3-wallet-tester/ottawa && bun x tsx <<'EOF'
import { connect } from "./src/client.js";

const client = await connect("http://localhost:3001");

// Wait for requests to arrive
await new Promise(r => setTimeout(r, 500));

// Check what's pending
const pending = await client.getPendingRequests();
console.log("Pending requests:", pending.length);
pending.forEach(req => console.log(`- ${req.method} (${req.id})`));

await client.disconnect();
EOF
```

### 4. Approve Pending Requests

```bash
cd /Users/dennisonbertram/conductor/workspaces/mcp-web3-wallet-tester/ottawa && bun x tsx <<'EOF'
import { connect } from "./src/client.js";

const client = await connect("http://localhost:3001");

// Get pending requests
const pending = await client.getPendingRequests();

// Approve each one
for (const req of pending) {
  try {
    const result = await client.approveRequest(req.id);
    console.log(`✓ Approved ${req.method}`);
  } catch (error) {
    console.log(`✗ Failed to approve ${req.method}:`, error.message);
  }
  await new Promise(r => setTimeout(r, 100)); // Small delay
}

await client.disconnect();
EOF
```

### 5. Check Again (Multi-Request Pattern)

**Critical:** Most wallet operations trigger 2-3 requests in sequence. Always check twice:

```bash
cd /Users/dennisonbertram/conductor/workspaces/mcp-web3-wallet-tester/ottawa && bun x tsx <<'EOF'
import { connect } from "./src/client.js";

const client = await connect("http://localhost:3001");

// First round
let result = await client.approveAllPending({ delayMsBetween: 100 });
console.log(`Round 1: Approved ${result.approved} requests`);

// Wait for additional requests
await new Promise(r => setTimeout(r, 500));

// Second round
result = await client.approveAllPending({ delayMsBetween: 100 });
console.log(`Round 2: Approved ${result.approved} requests`);

await client.disconnect();
EOF
```

### Complete Pattern Example

```bash
cd /Users/dennisonbertram/conductor/workspaces/mcp-web3-wallet-tester/ottawa && bun x tsx <<'EOF'
import { connect } from "./src/client.js";

const client = await connect("http://localhost:3001");

// Helper function for the approval loop
async function approveLoop() {
  let totalApproved = 0;

  // Round 1
  await new Promise(r => setTimeout(r, 500));
  let result = await client.approveAllPending({ delayMsBetween: 100 });
  totalApproved += result.approved;

  // Round 2 (catch additional requests)
  await new Promise(r => setTimeout(r, 500));
  result = await client.approveAllPending({ delayMsBetween: 100 });
  totalApproved += result.approved;

  console.log(`Total approved: ${totalApproved}`);
  return totalApproved;
}

// Use after triggering wallet actions
// await page.click('button'); // (in your browser script)
// await approveLoop();

await client.disconnect();
EOF
```

## Composing with dev-browser

Use the wallet tester with dev-browser for complete end-to-end testing:

```bash
# Start both services first
tmux new-session -d -s anvil "cd /Users/dennisonbertram/conductor/workspaces/mcp-web3-wallet-tester/ottawa && anvil"
tmux new-session -d -s wallet-tester "cd /Users/dennisonbertram/conductor/workspaces/mcp-web3-wallet-tester/ottawa && npm start"
# Also start dev-browser server...

# Then run combined script
cd /Users/dennisonbertram/conductor/workspaces/mcp-web3-wallet-tester/ottawa && bun x tsx <<'EOF'
import { connect as connectWallet } from "./src/client.js";
// Assuming dev-browser client is available
// import { connect as connectBrowser } from "../dev-browser/client.js";

const wallet = await connectWallet("http://localhost:3001");
// const browser = await connectBrowser("http://localhost:9222");
// const page = await browser.page("main");

// 1. Get provider script
const providerScript = await wallet.getProviderScript();

// 2. Inject provider BEFORE navigation
// await page.addInitScript(providerScript);

// 3. Navigate to dApp
// await page.goto("http://localhost:8080");

// 4. Click connect button
// await page.click('button:has-text("Connect")');

// 5. Wait and approve
await new Promise(r => setTimeout(r, 500));
const result = await wallet.approveAllPending();
console.log(`Approved ${result.approved} requests`);

// 6. Check for more requests
await new Promise(r => setTimeout(r, 500));
const result2 = await wallet.approveAllPending();
console.log(`Approved ${result2.approved} more requests`);

// 7. Verify connection
const status = await wallet.getStatus();
console.log("Wallet status:", status);

await wallet.disconnect();
// await browser.disconnect();
EOF
```

### Example: Complete dApp Test

When composing both skills:

1. **Browser** navigates and interacts with UI
2. **Wallet** approves requests as they arrive
3. **Browser** verifies the result in the UI

The pattern is always:
- Browser action → Wait → Wallet approval → Wait → Check again

## Auto-Approve Mode

For fully automated testing, enable auto-approve:

```bash
cd /Users/dennisonbertram/conductor/workspaces/mcp-web3-wallet-tester/ottawa && bun x tsx <<'EOF'
import { connect } from "./src/client.js";

const client = await connect("http://localhost:3001");

// Enable auto-approve
await client.setAutoApprove(true);
console.log("Auto-approve enabled - all requests will be automatically approved");

// Now all wallet requests are approved immediately
// No need to manually approve each one

// When done, disable it
await client.setAutoApprove(false);
console.log("Auto-approve disabled");

await client.disconnect();
EOF
```

**When to use auto-approve:**
- Trusted test environments only
- Long test sequences with many transactions
- When you've already verified the workflow manually

**Never use auto-approve:**
- In production or with real funds
- When testing security or rejection flows
- When you need to inspect each request

## Using approveUntilEmpty

The `approveUntilEmpty` helper automatically handles multi-request patterns:

```bash
cd /Users/dennisonbertram/conductor/workspaces/mcp-web3-wallet-tester/ottawa && bun x tsx <<'EOF'
import { connect } from "./src/client.js";

const client = await connect("http://localhost:3001");

// Approve all requests in multiple rounds until queue is empty
const result = await client.approveUntilEmpty({
  maxRounds: 10,        // Maximum rounds to check
  roundDelayMs: 500     // Wait between rounds
});

console.log(`Approved ${result.approved} requests total`);
if (result.errors.length > 0) {
  console.log("Errors:", result.errors);
}

await client.disconnect();
EOF
```

This is equivalent to the manual loop pattern but more concise.

## Error Recovery

If a script fails or requests aren't being approved:

### Check Server Status

```bash
cd /Users/dennisonbertram/conductor/workspaces/mcp-web3-wallet-tester/ottawa && bun x tsx <<'EOF'
import { connect } from "./src/client.js";

const client = await connect("http://localhost:3001");

const status = await client.getStatus();
console.log({
  address: status.address,
  chainId: status.chainId,
  balance: status.balance,
  pendingRequests: status.pendingRequests,
  autoApprove: status.autoApprove
});

await client.disconnect();
EOF
```

### List Pending Requests

```bash
cd /Users/dennisonbertram/conductor/workspaces/mcp-web3-wallet-tester/ottawa && bun x tsx <<'EOF'
import { connect } from "./src/client.js";

const client = await connect("http://localhost:3001");

const pending = await client.getPendingRequests();
console.log(`${pending.length} pending requests:`);
pending.forEach(req => {
  console.log(`- [${req.id}] ${req.method}`);
  console.log(`  Params:`, JSON.stringify(req.params, null, 2));
  console.log(`  Timestamp:`, new Date(req.timestamp).toISOString());
});

await client.disconnect();
EOF
```

### Clear Queue

```bash
cd /Users/dennisonbertram/conductor/workspaces/mcp-web3-wallet-tester/ottawa && bun x tsx <<'EOF'
import { connect } from "./src/client.js";

const client = await connect("http://localhost:3001");

// Reject all pending requests
const pending = await client.getPendingRequests();
for (const req of pending) {
  await client.rejectRequest(req.id, "Clearing queue");
}
console.log(`Rejected ${pending.length} requests`);

await client.disconnect();
EOF
```

### Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| `Failed to connect to wallet server` | Server not running | Start server: `npm start` |
| `ECONNREFUSED 127.0.0.1:8545` | Anvil not running | Start Anvil: `anvil` |
| No pending requests | Injected provider too late | Inject BEFORE page.goto |
| Requests never approved | Didn't wait for queue | Add `await new Promise(r => setTimeout(r, 500))` |
| Only approved 1 of 2 requests | Didn't check twice | Use `approveUntilEmpty` or manual loop |

## Debugging Tips

### 1. Check if Services are Running

```bash
# Check Anvil
curl -X POST http://127.0.0.1:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}'

# Check wallet server
curl http://localhost:3001/health
```

### 2. Monitor Anvil Logs

```bash
tmux capture-pane -t anvil -p | tail -20
```

### 3. Monitor Wallet Server Logs

```bash
tmux capture-pane -t wallet-tester -p | tail -20
```

### 4. Test Provider Injection

```bash
cd /Users/dennisonbertram/conductor/workspaces/mcp-web3-wallet-tester/ottawa && bun x tsx <<'EOF'
import { connect } from "./src/client.js";

const client = await connect("http://localhost:3001");
const script = await client.getProviderScript();
console.log("Provider script:", {
  length: script.length,
  hasEthereum: script.includes("window.ethereum"),
  hasRequest: script.includes("request(")
});
await client.disconnect();
EOF
```

### 5. Wait and Watch Pattern

When debugging approval issues:

```bash
cd /Users/dennisonbertram/conductor/workspaces/mcp-web3-wallet-tester/ottawa && bun x tsx <<'EOF'
import { connect } from "./src/client.js";

const client = await connect("http://localhost:3001");

console.log("Waiting for requests...");
for (let i = 0; i < 5; i++) {
  await new Promise(r => setTimeout(r, 1000));
  const status = await client.getStatus();
  console.log(`${i+1}s: ${status.pendingRequests} pending`);

  if (status.pendingRequests > 0) {
    const pending = await client.getPendingRequests();
    pending.forEach(req => console.log(`  - ${req.method}`));
  }
}

await client.disconnect();
EOF
```

## Multi-Request Patterns

Understanding these patterns is critical for reliable testing:

### Pattern 1: Wallet Connection

When user clicks "Connect Wallet":
1. `eth_chainId` - Get chain ID
2. `eth_requestAccounts` - Request account access
3. Possibly `wallet_requestPermissions` - Request permissions (may fail - OK)

Expect 2-3 requests.

### Pattern 2: Send Transaction

When user sends a transaction:
1. `eth_chainId` - Verify chain
2. `eth_sendTransaction` - The actual transaction

Expect 2 requests.

### Pattern 3: Sign Message

When user signs a message:
1. `personal_sign` - The signature request

Expect 1 request.

### Pattern 4: Sign Typed Data

When user signs typed data:
1. `eth_signTypedData_v4` - The typed data signature

Expect 1 request.

### Handling Multi-Request Patterns

Always use one of these approaches:

**Option 1: approveUntilEmpty (Recommended)**
```typescript
await client.approveUntilEmpty({ maxRounds: 10, roundDelayMs: 500 });
```

**Option 2: Manual Loop**
```typescript
// First round
await new Promise(r => setTimeout(r, 500));
await client.approveAllPending();

// Second round
await new Promise(r => setTimeout(r, 500));
await client.approveAllPending();
```

**Option 3: Auto-Approve**
```typescript
await client.setAutoApprove(true);
// ... trigger actions ...
await client.setAutoApprove(false);
```

## Testing Multiple Accounts

The wallet has access to 10 Anvil test accounts (each with 10,000 ETH):

This is handled via MCP tools, not the TypeScript client. Use the MCP tools for account management:
- `wallet_listAccounts` - List all accounts
- `wallet_switchAccount` - Switch to different account

The TypeScript client works with whichever account is currently active.

## Summary

The Web3 Wallet Tester enables automated dApp testing by:

1. **Injecting a Web3 provider** into any page
2. **Intercepting wallet requests** via WebSocket
3. **Controlling approvals** via TypeScript client
4. **Supporting multi-request patterns** with approval loops
5. **Providing test accounts** for safe testing

### Critical Success Factors

- **Inject provider BEFORE page loads** - Use addInitScript or inject before goto
- **Wait after actions** - Always wait ~500ms for requests to queue
- **Check twice** - Most operations trigger multiple requests
- **Use approveUntilEmpty** - Handles multi-request patterns automatically
- **Monitor status** - Check pendingRequests count to know when to approve

### Typical Workflow

1. Start services (Anvil + wallet server)
2. Get provider script from server
3. Inject provider in browser automation
4. Navigate to dApp
5. Trigger action (click button)
6. Wait 500ms
7. Approve all pending (round 1)
8. Wait 500ms
9. Approve all pending (round 2)
10. Verify result

For more details, see:
- [LLM Instructions](/Users/dennisonbertram/conductor/workspaces/mcp-web3-wallet-tester/ottawa/docs/LLM_INSTRUCTIONS.md)
- [Testing Guide](/Users/dennisonbertram/conductor/workspaces/mcp-web3-wallet-tester/ottawa/docs/TESTING_GUIDE.md)
- [README](/Users/dennisonbertram/conductor/workspaces/mcp-web3-wallet-tester/ottawa/README.md)
