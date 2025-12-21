import { getConfig } from './types.js';
import { Wallet } from './wallet.js';
import { RequestQueue } from './queue.js';
import { WebSocketBridge } from './ws-bridge.js';
import { createMcpServer, createExpressApp } from './mcp-server.js';

/**
 * Fetch the actual chain ID from Anvil
 */
async function getAnvilChainId(rpcUrl: string): Promise<number | null> {
  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_chainId', id: 1 }),
    });
    const data = await response.json() as { result?: string };
    if (data.result) {
      return parseInt(data.result, 16);
    }
  } catch {
    // Anvil not running or unreachable
  }
  return null;
}

async function main() {
  const config = getConfig();

  // Auto-detect chain ID from Anvil if not explicitly set via env
  if (!process.env.CHAIN_ID) {
    const detectedChainId = await getAnvilChainId(config.anvilRpcUrl);
    if (detectedChainId !== null && detectedChainId !== config.chainId) {
      console.log(`Auto-detected Anvil chain ID: ${detectedChainId} (overriding default ${config.chainId})`);
      config.chainId = detectedChainId;
    }
  }

  console.log('Starting MCP Web3 Wallet Tester...');
  console.log(`Configuration:`);
  console.log(`  MCP Port: ${config.mcpPort}`);
  console.log(`  WebSocket Port: ${config.wsPort}`);
  console.log(`  Anvil RPC URL: ${config.anvilRpcUrl}`);
  console.log(`  Chain ID: ${config.chainId}`);
  console.log(`  Account Index: ${config.accountIndex}`);

  // Create wallet
  const wallet = new Wallet(config);
  console.log(`  Wallet Address: ${wallet.getAddress()}`);

  // Create request queue
  const queue = new RequestQueue(wallet);

  // Create WebSocket bridge
  const wsBridge = new WebSocketBridge(queue, config.wsPort);
  await wsBridge.start();

  // Create MCP server and Express app
  const mcpServer = createMcpServer(wallet, queue);
  const app = createExpressApp(mcpServer);

  // Start HTTP server
  const httpServer = app.listen(config.mcpPort, () => {
    console.log('');
    console.log('='.repeat(60));
    console.log('MCP Web3 Wallet Tester is running!');
    console.log('='.repeat(60));
    console.log('');
    console.log(`MCP Server:        http://localhost:${config.mcpPort}/mcp`);
    console.log(`WebSocket Bridge:  ws://localhost:${config.wsPort}`);
    console.log(`Health Check:      http://localhost:${config.mcpPort}/health`);
    console.log('');
    console.log('To add to Claude Code:');
    console.log(`  claude mcp add --transport http wallet-tester http://localhost:${config.mcpPort}/mcp`);
    console.log('');
    console.log('Available MCP Tools:');
    console.log('  - wallet_getAddress       Get wallet address');
    console.log('  - wallet_getBalance       Get ETH balance');
    console.log('  - wallet_getPendingRequests  List pending requests');
    console.log('  - wallet_approveRequest   Approve a request');
    console.log('  - wallet_rejectRequest    Reject a request');
    console.log('  - wallet_waitForRequest   Wait for a request');
    console.log('  - wallet_setAutoApprove   Enable/disable auto-approve');
    console.log('  - wallet_getTransactionReceipt  Get tx receipt');
    console.log('  - wallet_getChainId       Get chain ID');
    console.log('  - wallet_getStatus        Get full status');
    console.log('');
    console.log('Press Ctrl+C to stop');
    console.log('='.repeat(60));
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\nShutting down...');
    httpServer.close();
    await wsBridge.stop();
    queue.clear();
    console.log('Goodbye!');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error('Failed to start:', error);
  process.exit(1);
});
