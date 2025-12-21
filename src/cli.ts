#!/usr/bin/env node
/**
 * CLI for MCP Web3 Wallet Tester
 *
 * Usage:
 *   npx web3-wallet-tester          # Start the wallet server
 *   npx web3-wallet-tester --help   # Show help
 *   npx web3-wallet-tester status   # Check if server is running
 */

import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const VERSION = '1.0.0';

const HELP = `
MCP Web3 Wallet Tester v${VERSION}

A programmable Ethereum wallet for automated Web3 dApp testing.

USAGE:
  web3-wallet-tester [command] [options]

COMMANDS:
  start         Start the wallet server (default)
  status        Check if server and Anvil are running
  help          Show this help message

OPTIONS:
  --port, -p    MCP server port (default: 3000)
  --ws-port     WebSocket bridge port (default: 8546)
  --anvil-url   Anvil RPC URL (default: http://127.0.0.1:8545)
  --account     Anvil account index 0-9 (default: 0)
  --auto        Enable auto-approve mode on startup
  --help, -h    Show this help message
  --version, -v Show version

EXAMPLES:
  # Start with defaults
  web3-wallet-tester

  # Start on custom port
  web3-wallet-tester --port 4000

  # Use account index 5
  web3-wallet-tester --account 5

  # Check if everything is running
  web3-wallet-tester status

QUICK START:
  1. Start Anvil:     anvil
  2. Start server:    web3-wallet-tester
  3. Register MCP:    claude mcp add --transport http wallet-tester http://localhost:3000/mcp

For more information, see: https://github.com/your-repo/mcp-web3-wallet-tester
`;

interface CliOptions {
  command: string;
  port: number;
  wsPort: number;
  anvilUrl: string;
  accountIndex: number;
  autoApprove: boolean;
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    command: 'start',
    port: 3000,
    wsPort: 8546,
    anvilUrl: 'http://127.0.0.1:8545',
    accountIndex: 0,
    autoApprove: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case 'start':
      case 'status':
      case 'help':
        options.command = arg;
        break;
      case '--port':
      case '-p':
        options.port = parseInt(next, 10);
        i++;
        break;
      case '--ws-port':
        options.wsPort = parseInt(next, 10);
        i++;
        break;
      case '--anvil-url':
        options.anvilUrl = next;
        i++;
        break;
      case '--account':
        options.accountIndex = parseInt(next, 10);
        i++;
        break;
      case '--auto':
        options.autoApprove = true;
        break;
      case '--help':
      case '-h':
        options.command = 'help';
        break;
      case '--version':
      case '-v':
        console.log(`v${VERSION}`);
        process.exit(0);
        break;
    }
  }

  return options;
}

async function checkHealth(url: string): Promise<boolean> {
  try {
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
}

async function checkAnvil(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_chainId', id: 1 }),
    });
    const data = await response.json() as { result?: string };
    return !!data.result;
  } catch {
    return false;
  }
}

async function statusCommand(options: CliOptions): Promise<void> {
  console.log('Checking services...\n');

  const anvilRunning = await checkAnvil(options.anvilUrl);
  const serverRunning = await checkHealth(`http://localhost:${options.port}/health`);

  console.log(`Anvil (${options.anvilUrl}):     ${anvilRunning ? '✓ Running' : '✗ Not running'}`);
  console.log(`Wallet Server (:${options.port}):       ${serverRunning ? '✓ Running' : '✗ Not running'}`);

  if (!anvilRunning) {
    console.log('\nTo start Anvil: anvil');
  }
  if (!serverRunning) {
    console.log('\nTo start wallet server: web3-wallet-tester');
  }

  if (anvilRunning && serverRunning) {
    console.log('\n✓ All services running. Ready for testing!');
    console.log(`\nMCP endpoint: http://localhost:${options.port}/mcp`);
    console.log(`Provider script: http://localhost:${options.port}/provider.js`);
  }

  process.exit(anvilRunning && serverRunning ? 0 : 1);
}

async function startCommand(options: CliOptions): Promise<void> {
  // Check if Anvil is running
  const anvilRunning = await checkAnvil(options.anvilUrl);
  if (!anvilRunning) {
    console.log('⚠️  Anvil is not running at', options.anvilUrl);
    console.log('   Start it with: anvil\n');
  }

  // Set environment variables
  process.env.MCP_PORT = String(options.port);
  process.env.WS_PORT = String(options.wsPort);
  process.env.ANVIL_RPC_URL = options.anvilUrl;
  process.env.ACCOUNT_INDEX = String(options.accountIndex);

  // Import and run the main module
  const mainPath = join(__dirname, 'index.js');
  await import(mainPath);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  switch (options.command) {
    case 'help':
      console.log(HELP);
      break;
    case 'status':
      await statusCommand(options);
      break;
    case 'start':
    default:
      await startCommand(options);
      break;
  }
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
