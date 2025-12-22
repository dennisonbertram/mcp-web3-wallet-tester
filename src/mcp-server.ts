import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express, { type Express, type Request, type Response } from 'express';
import { z } from 'zod';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { RequestQueue } from './queue.js';
import { Wallet } from './wallet.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Creates and configures the MCP server with wallet tools and documentation resources
 */
export function createMcpServer(wallet: Wallet, queue: RequestQueue): McpServer {
  const server = new McpServer({
    name: 'web3-wallet-tester',
    version: '1.0.0',
  });

  // Tool: Get wallet address
  server.registerTool(
    'wallet_getAddress',
    {
      description: 'Get the wallet address',
      inputSchema: {},
    },
    async () => {
      const address = wallet.getAddress();
      return {
        content: [{ type: 'text', text: address }],
      };
    }
  );

  // Tool: Get wallet balance
  server.registerTool(
    'wallet_getBalance',
    {
      description: 'Get the ETH balance of the wallet',
      inputSchema: {},
    },
    async () => {
      const balance = await wallet.getBalance();
      return {
        content: [{ type: 'text', text: `${balance} ETH` }],
      };
    }
  );

  // Tool: Get pending requests
  server.registerTool(
    'wallet_getPendingRequests',
    {
      description: 'Get all pending wallet requests waiting for approval',
      inputSchema: {},
    },
    async () => {
      const requests = queue.getPendingRequests();
      return {
        content: [{ type: 'text', text: JSON.stringify(requests, null, 2) }],
      };
    }
  );

  // Tool: Approve a request
  server.registerTool(
    'wallet_approveRequest',
    {
      description: 'Approve a pending wallet request and execute it',
      inputSchema: {
        requestId: z.string().describe('The ID of the request to approve'),
      },
    },
    async ({ requestId }) => {
      try {
        const result = await queue.approveRequest(requestId);
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true, result }, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: (error as Error).message }) }],
          isError: true,
        };
      }
    }
  );

  // Tool: Reject a request
  server.registerTool(
    'wallet_rejectRequest',
    {
      description: 'Reject a pending wallet request',
      inputSchema: {
        requestId: z.string().describe('The ID of the request to reject'),
        reason: z.string().optional().describe('Optional reason for rejection'),
      },
    },
    async ({ requestId, reason }) => {
      try {
        queue.rejectRequest(requestId, reason);
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true, message: 'Request rejected' }) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: (error as Error).message }) }],
          isError: true,
        };
      }
    }
  );

  // Tool: Wait for a request
  server.registerTool(
    'wallet_waitForRequest',
    {
      description: 'Wait for a wallet request to arrive. Returns when a request is pending or timeout is reached.',
      inputSchema: {
        timeoutMs: z.number().optional().describe('Timeout in milliseconds (default: 30000)'),
      },
    },
    async ({ timeoutMs }) => {
      try {
        const request = await queue.waitForRequest(timeoutMs ?? 30000);
        return {
          content: [{ type: 'text', text: JSON.stringify(request, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: (error as Error).message }) }],
          isError: true,
        };
      }
    }
  );

  // Tool: Set auto-approve mode
  server.registerTool(
    'wallet_setAutoApprove',
    {
      description: 'Enable or disable auto-approve mode. When enabled, all requests are automatically approved.',
      inputSchema: {
        enabled: z.boolean().describe('Whether to enable auto-approve'),
      },
    },
    async ({ enabled }) => {
      queue.setAutoApprove(enabled);
      return {
        content: [{ type: 'text', text: JSON.stringify({ autoApprove: enabled }) }],
      };
    }
  );

  // Tool: Get transaction receipt
  server.registerTool(
    'wallet_getTransactionReceipt',
    {
      description: 'Get the receipt for a transaction',
      inputSchema: {
        hash: z.string().describe('The transaction hash'),
      },
    },
    async ({ hash }) => {
      const receipt = await wallet.getTransactionReceipt(hash as `0x${string}`);
      if (receipt) {
        return {
          content: [{ type: 'text', text: JSON.stringify(receipt, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2) }],
        };
      }
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: 'Transaction not found' }) }],
        isError: true,
      };
    }
  );

  // Tool: Get chain ID
  server.registerTool(
    'wallet_getChainId',
    {
      description: 'Get the current chain ID',
      inputSchema: {},
    },
    async () => {
      const chainId = wallet.getChainId();
      return {
        content: [{ type: 'text', text: String(chainId) }],
      };
    }
  );

  // Tool: Set chain ID
  server.registerTool(
    'wallet_setChainId',
    {
      description: 'Set the chain ID used when signing transactions. Use this when working with mainnet forks (chainId: 1) or other networks.',
      inputSchema: {
        chainId: z.number().int().positive().describe('The chain ID to use (e.g., 1 for mainnet, 31337 for Anvil)'),
      },
    },
    async ({ chainId }) => {
      try {
        wallet.setChainId(chainId);
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true, chainId }) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: (error as Error).message }) }],
          isError: true,
        };
      }
    }
  );

  // Tool: Get status
  server.registerTool(
    'wallet_getStatus',
    {
      description: 'Get the current wallet server status including address, chain, pending requests count, and auto-approve mode',
      inputSchema: {},
    },
    async () => {
      const status = {
        address: wallet.getAddress(),
        accountIndex: wallet.getAccountIndex(),
        chainId: wallet.getChainId(),
        pendingRequests: queue.getPendingCount(),
        autoApprove: queue.isAutoApproveEnabled(),
        balance: await wallet.getBalance(),
      };
      return {
        content: [{ type: 'text', text: JSON.stringify(status, null, 2) }],
      };
    }
  );

  // Tool: List available Anvil accounts
  server.registerTool(
    'wallet_listAccounts',
    {
      description: 'List all available Anvil test accounts (indices 0-9)',
      inputSchema: {},
    },
    async () => {
      const accounts = Wallet.listAnvilAccounts();
      return {
        content: [{ type: 'text', text: JSON.stringify(accounts, null, 2) }],
      };
    }
  );

  // Tool: Switch to Anvil account by index
  server.registerTool(
    'wallet_switchAccount',
    {
      description: 'Switch to a different Anvil test account by index (0-9). Each account has 10000 ETH.',
      inputSchema: {
        accountIndex: z.number().min(0).max(9).describe('Account index (0-9)'),
      },
    },
    async ({ accountIndex }) => {
      try {
        wallet.switchAccount(accountIndex);
        const newAddress = wallet.getAddress();
        const balance = await wallet.getBalance();
        return {
          content: [{ type: 'text', text: JSON.stringify({
            success: true,
            accountIndex,
            address: newAddress,
            balance: `${balance} ETH`
          }, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: (error as Error).message }) }],
          isError: true,
        };
      }
    }
  );

  // Tool: Switch to custom private key
  server.registerTool(
    'wallet_setPrivateKey',
    {
      description: 'Switch to a custom private key. Use this for non-Anvil accounts or custom test accounts.',
      inputSchema: {
        privateKey: z.string().regex(/^0x[a-fA-F0-9]{64}$/).describe('Private key in hex format (0x...)'),
      },
    },
    async ({ privateKey }) => {
      try {
        wallet.switchToPrivateKey(privateKey as `0x${string}`);
        const newAddress = wallet.getAddress();
        const balance = await wallet.getBalance();
        return {
          content: [{ type: 'text', text: JSON.stringify({
            success: true,
            address: newAddress,
            balance: `${balance} ETH`
          }, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: (error as Error).message }) }],
          isError: true,
        };
      }
    }
  );

  // Tool: Get provider injection script
  server.registerTool(
    'wallet_getProviderScript',
    {
      description: 'Get the provider injection script for use with Playwright addInitScript. Returns JavaScript code that should be injected before page load to enable wallet functionality.',
      inputSchema: {
        wsUrl: z.string().optional().describe('WebSocket URL (default: ws://localhost:8546)'),
      },
    },
    async ({ wsUrl }) => {
      try {
        const providerPath = join(__dirname, '..', 'dist', 'provider.js');
        let script = readFileSync(providerPath, 'utf-8');

        // If a custom WebSocket URL is provided, inject it before the script
        if (wsUrl) {
          script = `window.__WEB3_TEST_WALLET_WS_URL__ = "${wsUrl}";\n${script}`;
        }

        return {
          content: [{ type: 'text', text: script }],
        };
      } catch {
        return {
          content: [{ type: 'text', text: `Error: Provider script not found. Run npm run build:provider first.` }],
          isError: true,
        };
      }
    }
  );

  // Register documentation resources

  // Resource: Quick Start - Bundled guide that doesn't depend on external files
  // This is the PRIMARY resource LLMs should read to understand how to use the wallet
  server.registerResource(
    'quick-start',
    'wallet://docs/quick-start',
    {
      title: 'Quick Start Guide',
      description: 'Essential guide for using the MCP Web3 Wallet Tester - READ THIS FIRST',
      mimeType: 'text/markdown',
    },
    async (uri) => {
      // This content is bundled directly into the code so it's always available
      const quickStart = `# MCP Web3 Wallet Tester - Quick Start

## What This Does

This MCP server lets you control an Ethereum wallet programmatically for testing Web3 dApps.
When a dApp requests a transaction, you approve/reject it via MCP tools.

## Prerequisites

1. **Anvil must be running**: \`anvil\`
2. **Wallet server must be running**: \`npm start\` or \`web3-wallet-tester\`

## Essential Workflow

### Step 1: Inject the Provider (Playwright)

\`\`\`javascript
// Fetch provider from wallet server
const providerScript = await fetch('http://localhost:3000/provider.js').then(r => r.text());

// CRITICAL: Inject BEFORE navigating to the dApp
await page.addInitScript(providerScript);

// Now navigate
await page.goto('https://app.uniswap.org');
\`\`\`

### Step 2: Trigger an Action

Click a button in the dApp (e.g., "Connect Wallet", "Swap", "Send").

\`\`\`javascript
await page.click('button:has-text("Connect Wallet")');
await new Promise(r => setTimeout(r, 500)); // Wait for requests to queue
\`\`\`

### Step 3: Approve Requests

\`\`\`javascript
// Get pending requests
const pending = await wallet_getPendingRequests();

// Approve each one
for (const req of pending) {
  await wallet_approveRequest({ requestId: req.id });
  await new Promise(r => setTimeout(r, 100));
}
\`\`\`

### Step 4: Check for More Requests

Many operations trigger multiple requests. Always check again:

\`\`\`javascript
await new Promise(r => setTimeout(r, 500));
const more = await wallet_getPendingRequests();
// Approve if needed...
\`\`\`

## Key MCP Tools

| Tool | When to Use |
|------|-------------|
| \`wallet_getStatus\` | Check if server is running, see current state |
| \`wallet_getPendingRequests\` | See what needs approval |
| \`wallet_approveRequest\` | Approve a transaction/signature |
| \`wallet_rejectRequest\` | Deny a request |
| \`wallet_waitForRequest\` | Block until a request arrives |
| \`wallet_setAutoApprove\` | Auto-approve all requests (for automated tests) |
| \`wallet_getTransactionReceipt\` | Verify a transaction succeeded |
| \`wallet_getProviderScript\` | Get the provider.js content directly |

## Auto-Approve Mode

For fully automated testing where you trust all requests:

\`\`\`javascript
await wallet_setAutoApprove({ enabled: true });
// Now all requests are automatically approved
\`\`\`

## Common Pitfalls

1. **Inject provider BEFORE page load** - Not after!
2. **Wait for requests to queue** - Add 500ms delay after clicking
3. **Check for additional requests** - Most operations trigger 2-3 requests
4. **Some methods may fail** - \`wallet_requestPermissions\` often fails, that's OK

## Verifying Server Status

\`\`\`javascript
const status = await wallet_getStatus();
// Returns: { address, chainId, balance, pendingRequests, autoApprove }
\`\`\`

## Example: Complete Connection + Transaction

\`\`\`javascript
// 1. Setup
const script = await fetch('http://localhost:3000/provider.js').then(r => r.text());
await page.addInitScript(script);
await page.goto('https://example-dapp.com');

// 2. Connect
await page.click('button:has-text("Connect")');
await new Promise(r => setTimeout(r, 500));

// 3. Approve connection
let pending = await wallet_getPendingRequests();
for (const req of pending) {
  await wallet_approveRequest({ requestId: req.id });
}

// 4. Check for more
await new Promise(r => setTimeout(r, 500));
pending = await wallet_getPendingRequests();
for (const req of pending) {
  await wallet_approveRequest({ requestId: req.id });
}

// 5. Verify connected
const status = await wallet_getStatus();
console.log('Connected as:', status.address);
\`\`\`

## Need More Help?

- Read \`wallet://docs/instructions\` for detailed workflow
- Read \`wallet://docs/tools\` for complete tool reference
- Read \`wallet://docs/testing-guide\` for troubleshooting
`;

      return {
        contents: [
          {
            uri: uri.href,
            text: quickStart,
            mimeType: 'text/markdown',
          },
        ],
      };
    }
  );

  // Resource: LLM Instructions - Concise usage guide for AI agents
  server.registerResource(
    'llm-instructions',
    'wallet://docs/instructions',
    {
      title: 'LLM Usage Instructions',
      description: 'Concise guide for AI agents on how to use the MCP Web3 Wallet Tester',
      mimeType: 'text/markdown',
    },
    async (uri) => {
      try {
        const docsPath = join(__dirname, '..', 'docs', 'LLM_INSTRUCTIONS.md');
        const content = readFileSync(docsPath, 'utf-8');
        return {
          contents: [
            {
              uri: uri.href,
              text: content,
              mimeType: 'text/markdown',
            },
          ],
        };
      } catch (error) {
        return {
          contents: [
            {
              uri: uri.href,
              text: `Error reading LLM instructions: ${(error as Error).message}`,
              mimeType: 'text/plain',
            },
          ],
        };
      }
    }
  );

  // Resource: Testing Guide - Complete testing documentation
  server.registerResource(
    'testing-guide',
    'wallet://docs/testing-guide',
    {
      title: 'Complete Testing Guide',
      description: 'Detailed guide for testing Web3 dApps with Playwright and the wallet server',
      mimeType: 'text/markdown',
    },
    async (uri) => {
      try {
        const docsPath = join(__dirname, '..', 'docs', 'TESTING_GUIDE.md');
        const content = readFileSync(docsPath, 'utf-8');
        return {
          contents: [
            {
              uri: uri.href,
              text: content,
              mimeType: 'text/markdown',
            },
          ],
        };
      } catch (error) {
        return {
          contents: [
            {
              uri: uri.href,
              text: `Error reading testing guide: ${(error as Error).message}`,
              mimeType: 'text/plain',
            },
          ],
        };
      }
    }
  );

  // Resource: Tools List - Available MCP tools with descriptions
  server.registerResource(
    'tools-list',
    'wallet://docs/tools',
    {
      title: 'Available Tools',
      description: 'List of all available MCP tools with descriptions and usage',
      mimeType: 'text/markdown',
    },
    async (uri) => {
      const toolsList = `# MCP Web3 Wallet Tester - Available Tools

## Wallet Information

| Tool | Description | Parameters | Returns |
|------|-------------|------------|---------|
| \`wallet_getStatus\` | Get full wallet status | None | Status object with address, chainId, balance, pending requests count, auto-approve mode |
| \`wallet_getAddress\` | Get current wallet address | None | Ethereum address (0x...) |
| \`wallet_getBalance\` | Get ETH balance | None | Balance in ETH |
| \`wallet_getChainId\` | Get current chain ID | None | Chain ID (e.g., 31337 for Anvil) |
| \`wallet_setChainId\` | Set the chain ID for signing | \`chainId\` (number) | Success status and new chainId |

## Request Management

| Tool | Description | Parameters | Returns |
|------|-------------|------------|---------|
| \`wallet_getPendingRequests\` | List all pending requests | None | Array of pending requests with id, method, params |
| \`wallet_approveRequest\` | Approve a pending request | \`requestId\` (string) | Success status and result |
| \`wallet_rejectRequest\` | Reject a pending request | \`requestId\` (string), \`reason\` (optional string) | Success status |
| \`wallet_waitForRequest\` | Wait for a request to arrive | \`timeoutMs\` (optional number, default 30000) | First pending request or timeout error |
| \`wallet_setAutoApprove\` | Enable/disable auto-approve mode | \`enabled\` (boolean) | Current auto-approve status |

## Transaction Management

| Tool | Description | Parameters | Returns |
|------|-------------|------------|---------|
| \`wallet_getTransactionReceipt\` | Get transaction receipt | \`hash\` (string) | Transaction receipt with status, gasUsed, logs, etc. |

## Account Management

| Tool | Description | Parameters | Returns |
|------|-------------|------------|---------|
| \`wallet_listAccounts\` | List all available Anvil accounts | None | Array of 10 accounts with index, address, and initial balance |
| \`wallet_switchAccount\` | Switch to different Anvil account | \`accountIndex\` (number 0-9) | Success status, new address, and balance |
| \`wallet_setPrivateKey\` | Switch to custom private key | \`privateKey\` (string, 0x...) | Success status, address, and balance |

## Common Request Types

The wallet server handles these Web3 request methods:

- \`eth_requestAccounts\` - Connect wallet and get accounts
- \`eth_accounts\` - Get current accounts
- \`eth_chainId\` - Get chain ID
- \`eth_sendTransaction\` - Send a transaction
- \`personal_sign\` - Sign a message
- \`eth_signTypedData_v4\` - Sign typed data (EIP-712)
- \`wallet_requestPermissions\` - Request permissions (may not be supported)

## Usage Pattern

1. **Check status**: Use \`wallet_getStatus\` to verify connection
2. **Trigger action**: Interact with dApp (click button, submit form)
3. **Wait**: Allow time for requests to queue (500ms-1s)
4. **Check pending**: Use \`wallet_getPendingRequests\` to see what needs approval
5. **Approve**: Use \`wallet_approveRequest\` for each request
6. **Verify**: Check transaction receipts or dApp state

## Auto-Approve Mode

For fully automated testing:

\`\`\`javascript
await wallet_setAutoApprove({ enabled: true });
// All requests now auto-approved
await wallet_setAutoApprove({ enabled: false });
\`\`\`

**Warning**: Only use auto-approve in trusted test environments.

## Example: Approve All Pending

\`\`\`javascript
const pending = await wallet_getPendingRequests();
const requests = JSON.parse(pending.content[0].text);

for (const req of requests) {
  await wallet_approveRequest({ requestId: req.id });
  await new Promise(r => setTimeout(r, 100));
}
\`\`\`

## Example: Working with Mainnet Forks

When using Anvil with \`--chain-id 1\` (mainnet fork), set the wallet chain ID to match:

\`\`\`javascript
// Set chain ID to mainnet for mainnet fork testing
await wallet_setChainId({ chainId: 1 });

// Verify the change
const status = await wallet_getStatus();
console.log('Chain ID:', JSON.parse(status.content[0].text).chainId); // 1

// Reset to Anvil default when done
await wallet_setChainId({ chainId: 31337 });
\`\`\`
`;

      return {
        contents: [
          {
            uri: uri.href,
            text: toolsList,
            mimeType: 'text/markdown',
          },
        ],
      };
    }
  );

  return server;
}

/**
 * Creates the Express app with MCP HTTP endpoint
 */
export function createExpressApp(server: McpServer): Express {
  const app = express();
  app.use(express.json());

  // MCP endpoint
  app.post('/mcp', async (req: Request, res: Response) => {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    res.on('close', () => {
      transport.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  // Health check endpoint
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  // Serve provider.js for injection
  app.get('/provider.js', (_req: Request, res: Response) => {
    try {
      const providerPath = join(__dirname, '..', 'dist', 'provider.js');
      const providerScript = readFileSync(providerPath, 'utf-8');
      res.setHeader('Content-Type', 'application/javascript');
      res.setHeader('Cache-Control', 'no-cache');
      res.send(providerScript);
    } catch {
      res.status(500).json({ error: 'Provider script not found. Run npm run build:provider first.' });
    }
  });

  return app;
}
