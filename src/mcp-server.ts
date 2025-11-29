import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express, { type Express, type Request, type Response } from 'express';
import { z } from 'zod';
import type { RequestQueue } from './queue.js';
import type { Wallet } from './wallet.js';

/**
 * Creates and configures the MCP server with wallet tools
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

  return app;
}
