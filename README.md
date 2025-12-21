# MCP Web3 Wallet Tester

An MCP server that acts as a programmable Ethereum wallet for automated Web3 dApp testing. LLMs can control wallet operations (approve transactions, sign messages, manage accounts) via MCP tools while Playwright automates the browser.

## Features

- **Full EIP-1193 Provider** - Injects a complete Ethereum provider into any dApp
- **EIP-6963 Support** - Modern wallet discovery for multi-wallet environments
- **MCP Integration** - Control wallet via MCP tools from any LLM
- **Multi-Account** - Switch between 10 Anvil test accounts or use custom keys
- **Auto-Approve Mode** - Enable fully automated testing when needed
- **Provider Serving** - Fetch provider script via HTTP for easy injection

## Quick Start

### Prerequisites

- **Node.js 18+**
- **Anvil** (from Foundry): `curl -L https://foundry.paradigm.xyz | bash && foundryup`

### Installation

```bash
npm install
npm run build
```

### Start the Server

The easiest way to start everything:

```bash
# Terminal 1: Start Anvil (local blockchain)
anvil

# Terminal 2: Start the wallet server
npm start
```

Or use the CLI:

```bash
npx web3-wallet-tester
```

### Register with Claude Code

```bash
claude mcp add --transport http wallet-tester http://localhost:3000/mcp
```

## Architecture

```
Browser (dApp)                     Wallet Server                    Blockchain
     │                                  │                               │
     │  window.ethereum.request()       │                               │
     ├─────────────────────────────────►│                               │
     │         WebSocket                │  wallet_approveRequest()      │
     │                                  │◄──────────────────────────────┤ LLM
     │                                  │         MCP Tools             │
     │                                  │                               │
     │                                  │  eth_sendTransaction          │
     │                                  ├──────────────────────────────►│
     │                                  │       JSON-RPC                │ Anvil
     │          result                  │                               │
     │◄─────────────────────────────────┤                               │
```

## Usage

### 1. Inject the Provider (Playwright)

```typescript
// Fetch provider from the wallet server
const providerScript = await fetch('http://localhost:3000/provider.js').then(r => r.text());

// Inject BEFORE navigating (critical for proper detection)
await page.addInitScript(providerScript);

// Navigate to dApp
await page.goto('https://app.uniswap.org');
```

### 2. Control via MCP Tools

```javascript
// Check wallet status
const status = await wallet_getStatus();

// Wait for a wallet request
const request = await wallet_waitForRequest({ timeoutMs: 30000 });

// Approve the request
await wallet_approveRequest({ requestId: request.id });

// Or enable auto-approve for automated testing
await wallet_setAutoApprove({ enabled: true });
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `wallet_getStatus` | Get wallet status (address, chain, balance, pending count) |
| `wallet_getAddress` | Get current wallet address |
| `wallet_getBalance` | Get ETH balance |
| `wallet_getChainId` | Get chain ID |
| `wallet_getPendingRequests` | List pending requests awaiting approval |
| `wallet_approveRequest` | Approve a pending request |
| `wallet_rejectRequest` | Reject a pending request |
| `wallet_waitForRequest` | Wait for a request to arrive |
| `wallet_setAutoApprove` | Enable/disable auto-approve mode |
| `wallet_getTransactionReceipt` | Get transaction receipt by hash |
| `wallet_listAccounts` | List all 10 Anvil test accounts |
| `wallet_switchAccount` | Switch to Anvil account by index (0-9) |
| `wallet_setPrivateKey` | Use a custom private key |
| `wallet_getProviderScript` | Get provider.js for injection |

## MCP Resources

The server exposes documentation as MCP resources:

| Resource URI | Description |
|--------------|-------------|
| `wallet://docs/instructions` | LLM usage guide with workflow and examples |
| `wallet://docs/testing-guide` | Complete testing documentation |
| `wallet://docs/tools` | Tool reference with parameters |

LLMs can read these resources to learn how to use the wallet tester.

## HTTP Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check |
| `GET /provider.js` | Get the injectable provider script |
| `POST /mcp` | MCP server endpoint |

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `MCP_PORT` | 3000 | HTTP server port |
| `WS_PORT` | 8546 | WebSocket bridge port |
| `ANVIL_RPC_URL` | http://127.0.0.1:8545 | Anvil RPC URL |
| `CHAIN_ID` | (auto-detected) | Chain ID to report |
| `ACCOUNT_INDEX` | 0 | Anvil account index (0-9) |
| `PRIVATE_KEY` | (from index) | Custom private key |

## Working with MetaMask

When MetaMask is installed, it locks `window.ethereum`. The wallet tester handles this by:

1. **EIP-6963 Announcements** - Modern dApps discover wallets via events
2. **Repeated Announcements** - Announces multiple times to catch late discovery
3. **Modal Detection** - Re-announces when wallet selection UI opens

For reliable testing:
- Use Playwright's `addInitScript` (injects before MetaMask)
- Use incognito mode (extensions disabled)
- Disable MetaMask temporarily in `chrome://extensions`

## Example: Complete Test Flow

```javascript
// 1. Setup
const providerScript = await fetch('http://localhost:3000/provider.js').then(r => r.text());
await page.addInitScript(providerScript);
await page.goto('https://example-dapp.com');

// 2. Connect wallet
await page.click('button:has-text("Connect Wallet")');
await new Promise(r => setTimeout(r, 500)); // Wait for requests

// 3. Approve connection
const pending = await wallet_getPendingRequests();
for (const req of pending) {
  await wallet_approveRequest({ requestId: req.id });
}

// 4. Send transaction
await page.fill('input[name="amount"]', '1.5');
await page.click('button:has-text("Send")');
await new Promise(r => setTimeout(r, 500));

// 5. Approve transaction
const txRequests = await wallet_getPendingRequests();
const txReq = txRequests.find(r => r.method === 'eth_sendTransaction');
const result = await wallet_approveRequest({ requestId: txReq.id });

// 6. Verify
const receipt = await wallet_getTransactionReceipt({ hash: result.result });
console.log('Transaction confirmed:', receipt.status);
```

## Development

```bash
# Type check
npm run type-check

# Build everything
npm run build

# Build provider only
npm run build:provider

# Build with dev UI enabled
npm run build:provider:dev

# Watch mode
npm run dev
```

## Project Structure

```
├── src/
│   ├── index.ts           # Entry point, starts all services
│   ├── mcp-server.ts      # MCP server with tools and resources
│   ├── ws-bridge.ts       # WebSocket bridge for browser
│   ├── queue.ts           # Request queue management
│   ├── wallet.ts          # Viem wallet wrapper
│   ├── types.ts           # TypeScript types
│   └── provider/
│       ├── injected.ts    # Browser provider (EIP-1193)
│       └── ui/            # Developer wallet UI (optional)
├── dist/
│   ├── index.js           # Compiled server
│   └── provider.js        # Compiled browser provider
├── docs/
│   ├── LLM_INSTRUCTIONS.md
│   ├── TESTING_GUIDE.md
│   └── ...
└── examples/
    ├── test-dapp.html     # Test dApp for development
    └── bookmarklet.html   # Manual injection bookmarklet
```

## Documentation

- [LLM Instructions](./docs/LLM_INSTRUCTIONS.md) - Step-by-step guide for AI agents
- [Testing Guide](./docs/TESTING_GUIDE.md) - Complete testing procedures
- [Provider Injection](./docs/guides/provider-injection-2025-12-21.md) - How to inject the provider
- [Architecture](./docs/architecture/overview-2025-12-21.md) - System design

## License

MIT

## Author

Dennison Bertram
