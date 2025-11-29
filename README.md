# MCP Web3 Wallet Tester

An MCP server that acts as an Ethereum wallet, allowing LLMs to control Web3 dApp testing via Playwright. When a dApp requests a transaction, the LLM can approve/reject it through MCP tools.

## Prerequisites

Before using this MCP server, ensure you have:

- **Node.js 18+** - Required for running the server
- **Anvil** (from Foundry) - Required for local Ethereum testing
  - Install via: `curl -L https://foundry.paradigm.xyz | bash && foundryup`
  - Verify with: `anvil --version`

**IMPORTANT**: The wallet server must be running BEFORE Claude Code can use the wallet tools. The server persists across LLM calls to maintain state.

## Quick Start

Follow these steps to get up and running:

### 1. Install Dependencies

```bash
npm install
```

### 2. Build the Project

```bash
npm run build
```

### 3. Start Anvil (Local Ethereum Node)

In a separate terminal, start Anvil:

```bash
anvil
```

Leave this running. You should see:
```
Listening on 127.0.0.1:8545
```

### 4. Start the Wallet Server

In another terminal, start the wallet server:

```bash
npm start
```

You should see:
```
MCP Server:        http://localhost:3001/mcp
WebSocket Bridge:  ws://localhost:8546
```

**Keep this running** - the server must stay active for Claude Code to use the wallet tools.

### 5. Add to Claude Code

In a third terminal, register the server with Claude Code:

```bash
claude mcp add --transport http wallet-tester http://localhost:3001/mcp
```

That's it! Claude Code can now use the wallet tools to interact with Web3 dApps in Playwright tests.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Wallet Server Process                         │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              HTTP/SSE MCP Server (:3001)                │    │
│  │         (Long-lived, persists across LLM calls)         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                            │                                     │
│                    ┌───────┴───────┐                            │
│                    │ Request Queue │                            │
│                    │   (in-memory) │                            │
│                    └───────┬───────┘                            │
│                            │                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │            WebSocket Bridge (:8546)                     │    │
│  │      (Browser provider connects here)                   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                            │                                     │
│                    ┌───────┴───────┐                            │
│                    │  Viem Wallet  │                            │
│                    │  (signing)    │                            │
│                    └───────┬───────┘                            │
└────────────────────────────│────────────────────────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │     Anvil       │
                    │   (:8545)       │
                    └─────────────────┘
```

## Installation

```bash
npm install
npm run build
```

## Usage

### 1. Start Anvil (local Ethereum node)

```bash
anvil
```

### 2. Start the wallet server

```bash
npm start
```

Output:
```
MCP Server:        http://localhost:3001/mcp
WebSocket Bridge:  ws://localhost:8546
```

### 3. Add to Claude Code

```bash
claude mcp add --transport http wallet-tester http://localhost:3001/mcp
```

### 4. Use in Playwright tests

Inject the provider before page loads:

```typescript
import { readFileSync } from 'fs';

// Read the provider bundle
const providerScript = readFileSync('node_modules/mcp-web3-wallet-tester/dist/provider.js', 'utf-8');

// Inject before page loads
await page.addInitScript(providerScript);

// Navigate to dApp
await page.goto('https://example-dapp.com');

// Click connect wallet - the injected provider handles window.ethereum
await page.click('button:has-text("Connect Wallet")');
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `wallet_getAddress` | Get the wallet address |
| `wallet_getBalance` | Get ETH balance |
| `wallet_getPendingRequests` | List pending requests |
| `wallet_approveRequest` | Approve a pending request |
| `wallet_rejectRequest` | Reject a pending request |
| `wallet_waitForRequest` | Wait for a request to arrive |
| `wallet_setAutoApprove` | Enable/disable auto-approve |
| `wallet_getTransactionReceipt` | Get transaction receipt |
| `wallet_getChainId` | Get chain ID |
| `wallet_getStatus` | Get full wallet status |

## Example LLM Workflow

```
User: "Test the swap feature on Uniswap"

LLM: I'll navigate to Uniswap and test the swap feature.
→ Uses Playwright to navigate to uniswap.org
→ Clicks "Connect Wallet"

LLM: wallet_waitForRequest()
→ Returns: {id: "req_1", method: "eth_requestAccounts", params: []}

LLM: wallet_approveRequest({requestId: "req_1"})
→ Returns wallet address
→ dApp shows "Connected"

LLM: I'll now swap 1 ETH for USDC
→ Fills in swap form, clicks "Swap"

LLM: wallet_waitForRequest()
→ Returns: {id: "req_2", method: "eth_sendTransaction", params: [{...}]}

LLM: wallet_approveRequest({requestId: "req_2"})
→ Transaction sent to Anvil
→ dApp shows "Transaction submitted"
```

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_PORT` | 3001 | HTTP MCP server port |
| `WS_PORT` | 8546 | WebSocket bridge port |
| `ANVIL_RPC_URL` | http://127.0.0.1:8545 | Anvil RPC URL |
| `ACCOUNT_INDEX` | 0 | Anvil account index (0-9) to use |
| `PRIVATE_KEY` | (from ACCOUNT_INDEX) | Wallet private key (overrides ACCOUNT_INDEX if set) |
| `CHAIN_ID` | 31337 | Chain ID to report |

### Using Multiple Accounts

The server supports all 10 of Anvil's default test accounts. Use the `ACCOUNT_INDEX` environment variable to select which account to use (0-9):

```bash
# Use account 0 (default)
npm start

# Use account 1
ACCOUNT_INDEX=1 npm start

# Use account 5
ACCOUNT_INDEX=5 npm start
```

Each account has 10000 ETH on a fresh Anvil instance. You can also provide a custom private key with `PRIVATE_KEY` to override the account selection.

## Development

```bash
# Type check
npm run type-check

# Build
npm run build

# Watch mode
npm run dev
```

## How It Works

1. **Injectable Provider** (`dist/provider.js`): A script injected into the browser that implements the EIP-1193 provider interface on `window.ethereum`. When a dApp calls wallet methods, requests are sent to the WebSocket bridge.

2. **WebSocket Bridge**: Receives requests from the browser provider, adds them to the queue, and waits for approval before responding.

3. **Request Queue**: Manages pending wallet requests. Each request is a Promise that resolves when the LLM approves it (or rejects when denied).

4. **MCP Server**: Exposes tools that let the LLM see pending requests and approve/reject them. Uses HTTP transport for persistence across test sessions.

5. **Viem Wallet**: Handles actual Ethereum operations (signing, sending transactions) against the Anvil local node.

## License

MIT
