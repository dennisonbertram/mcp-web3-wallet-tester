/**
 * Represents a pending wallet request waiting for LLM approval
 */
export interface WalletRequest {
  id: string;
  method: string;
  params: unknown[];
  timestamp: number;
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
}

/**
 * Serializable version of WalletRequest for MCP tool responses
 */
export interface SerializedWalletRequest {
  id: string;
  method: string;
  params: unknown[];
  timestamp: number;
}

/**
 * WebSocket message from browser provider to server
 */
export interface ProviderRequest {
  type: 'request';
  id: string;
  method: string;
  params: unknown[];
}

/**
 * WebSocket message from server to browser provider
 */
export interface ProviderResponse {
  type: 'response';
  id: string;
  result?: unknown;
  error?: {
    code: number;
    message: string;
  };
}

/**
 * UI state exposed to the Developer Wallet UI
 */
export interface WalletUIState {
  address: string;
  accountIndex: number;
  balance: string;
  nonce: number;
  chainId: number;
  blockNumber: number;
  gasPrice: string;
  pendingCount: number;
  connected: boolean;
}

/**
 * UI request from browser to server (for Developer Wallet UI)
 */
export interface UIRequest {
  type: 'ui_request';
  id: string;
  action: 'getState' | 'approveRequest' | 'rejectRequest' | 'switchAccount' | 'getPendingRequests' | 'setChainId';
  params?: {
    requestId?: string;
    reason?: string;
    accountIndex?: number;
    chainId?: number;
  };
}

/**
 * UI response from server to browser
 */
export interface UIResponse {
  type: 'ui_response';
  id: string;
  result?: WalletUIState | { success: boolean; result?: unknown; address?: string } | { requests: SerializedWalletRequest[] };
  error?: {
    code: number;
    message: string;
  };
}

/**
 * UI notification sent from server to browser (push notifications)
 */
export interface UINotification {
  type: 'ui_notification';
  event: 'newPendingRequest' | 'requestResolved';
  data?: {
    requestId?: string;
    method?: string;
    pendingCount?: number;
  };
}

/**
 * Type guard for UI requests
 */
export function isUIRequest(message: unknown): message is UIRequest {
  return (
    typeof message === 'object' &&
    message !== null &&
    (message as UIRequest).type === 'ui_request'
  );
}

/**
 * EIP-1193 error codes
 */
export const EIP1193_ERRORS = {
  USER_REJECTED: { code: 4001, message: 'User rejected the request' },
  UNAUTHORIZED: { code: 4100, message: 'Unauthorized' },
  UNSUPPORTED_METHOD: { code: 4200, message: 'Unsupported method' },
  DISCONNECTED: { code: 4900, message: 'Disconnected' },
  CHAIN_DISCONNECTED: { code: 4901, message: 'Chain disconnected' },
} as const;

/**
 * EIP-1193 ProviderRpcError class
 * Errors returned by the provider should be instances of this class
 */
export class ProviderRpcError extends Error {
  readonly code: number;
  readonly data?: unknown;

  constructor(code: number, message: string, data?: unknown) {
    super(message);
    this.name = 'ProviderRpcError';
    this.code = code;
    this.data = data;
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ProviderRpcError);
    }
  }
}

/**
 * EIP-1193 ProviderMessage interface for the 'message' event
 */
export interface ProviderMessage {
  readonly type: string;
  readonly data: unknown;
}

/**
 * EIP-1193 EthSubscription message for subscription results
 */
export interface EthSubscription extends ProviderMessage {
  readonly type: 'eth_subscription';
  readonly data: {
    readonly subscription: string;
    readonly result: unknown;
  };
}

/**
 * EIP-1193 ProviderConnectInfo for the 'connect' event
 */
export interface ProviderConnectInfo {
  readonly chainId: string;
}

/**
 * Transaction parameters as received from dApp
 */
export interface TransactionParams {
  from?: `0x${string}`;
  to?: `0x${string}`;
  value?: string;
  data?: `0x${string}`;
  gas?: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  nonce?: string;
}

/**
 * Sign message parameters
 */
export interface SignMessageParams {
  message: string;
  address: `0x${string}`;
}

/**
 * Anvil's default test accounts (10000 ETH each)
 */
export const ANVIL_ACCOUNTS = [
  {
    address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
  },
  {
    address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    privateKey: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
  },
  {
    address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    privateKey: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
  },
  {
    address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    privateKey: '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6',
  },
  {
    address: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
    privateKey: '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a',
  },
  {
    address: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc',
    privateKey: '0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba',
  },
  {
    address: '0x976EA74026E726554dB657fA54763abd0C3a0aa9',
    privateKey: '0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e',
  },
  {
    address: '0x14dC79964da2C08b23698B3D3cc7Ca32193d9955',
    privateKey: '0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356',
  },
  {
    address: '0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f',
    privateKey: '0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97',
  },
  {
    address: '0xa0Ee7A142d267C1f36714E4a8F75612F20a79720',
    privateKey: '0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6',
  },
] as const;

/**
 * Configuration for the wallet server
 */
export interface WalletServerConfig {
  mcpPort: number;
  wsPort: number;
  anvilRpcUrl: string;
  privateKey: `0x${string}`;
  chainId: number;
  accountIndex: number;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: WalletServerConfig = {
  mcpPort: 3001,
  wsPort: 8546,
  anvilRpcUrl: 'http://127.0.0.1:8545',
  // Anvil's first default account private key
  privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
  chainId: 31337,
  accountIndex: 0,
};

/**
 * Request category for semantic grouping
 */
export type RequestCategory = 'connect' | 'read' | 'sign' | 'transaction' | 'chain' | 'unknown';

/**
 * Risk flags for request analysis
 */
export type RiskFlag = 'high_value' | 'unknown_contract' | 'chain_mismatch' | 'data_present' | 'first_interaction';

/**
 * Enhanced request with semantic information
 */
export interface EnhancedRequest extends SerializedWalletRequest {
  category: RequestCategory;
  summary: string;
  decoded?: {
    to?: string;
    valueEth?: string;
    functionName?: string;
    args?: Record<string, unknown>;
  };
  risk: RiskFlag[];
}

/**
 * Wallet approval policy configuration
 * Controls which requests are auto-approved vs require manual approval
 */
export interface WalletPolicy {
  /** Policy mode: 'manual' requires approval for all, 'auto' uses rules below */
  mode: 'manual' | 'auto';
  /** Methods to auto-approve (e.g., ['eth_chainId', 'eth_requestAccounts']) */
  allowMethods?: string[];
  /** Methods to always reject */
  denyMethods?: string[];
  /** Maximum ETH value to auto-approve (transactions above this require manual approval) */
  maxValueEth?: number;
  /** Contract addresses to auto-approve */
  allowTo?: `0x${string}`[];
  /** Contract addresses to always reject */
  denyTo?: `0x${string}`[];
  /** Expected chain ID (reject mismatches) */
  chainId?: number;
}

/**
 * Default policy - safe defaults for LLM agents
 * Auto-approves reads and connects, requires manual approval for value transfers
 */
export const DEFAULT_POLICY: WalletPolicy = {
  mode: 'auto',
  allowMethods: [
    'eth_chainId',
    'eth_accounts',
    'eth_requestAccounts',
    'eth_blockNumber',
    'eth_gasPrice',
    'eth_getBalance',
    'eth_getTransactionCount',
    'eth_estimateGas',
    'net_version',
    'wallet_switchEthereumChain',
    'wallet_addEthereumChain',
  ],
  denyMethods: [],
  maxValueEth: 0.1,
};

/**
 * Result of draining the request queue
 */
export interface DrainResult {
  status: 'idle' | 'timeout' | 'maxDepth';
  approved: Array<{
    id: string;
    method: string;
    category: RequestCategory;
    txHash?: string;
    result?: unknown;
  }>;
  rejected: Array<{
    id: string;
    method: string;
    category: RequestCategory;
    reason: string;
  }>;
  finalState: WalletContext;
}

/**
 * Options for draining requests
 */
export interface DrainOptions {
  /** Policy to apply (defaults to current policy) */
  policy?: WalletPolicy;
  /** Timeout in ms (default: 15000) */
  timeoutMs?: number;
  /** Time with no new requests to consider idle (default: 300) */
  settleMs?: number;
  /** Maximum requests to process (default: 50) */
  maxDepth?: number;
}

/**
 * Unified wallet context - all state in one call
 */
export interface WalletContext {
  active: {
    address: `0x${string}`;
    accountIndex: number;
  };
  chain: {
    chainId: number;
    name: string;
  };
  balances: {
    eth: string;
  };
  policy: WalletPolicy;
  pendingCount: number;
  pendingSummary: EnhancedRequest[];
}

/**
 * Get configuration from environment variables with defaults
 */
export function getConfig(): WalletServerConfig {
  const accountIndex = parseInt(process.env.ACCOUNT_INDEX ?? String(DEFAULT_CONFIG.accountIndex), 10);

  // Validate account index is in range 0-9
  if (accountIndex < 0 || accountIndex > 9) {
    throw new Error(`ACCOUNT_INDEX must be between 0 and 9, got ${accountIndex}`);
  }

  // If PRIVATE_KEY is explicitly provided, use it; otherwise use the account index
  const privateKey = process.env.PRIVATE_KEY
    ? (process.env.PRIVATE_KEY as `0x${string}`)
    : ANVIL_ACCOUNTS[accountIndex].privateKey;

  return {
    mcpPort: parseInt(process.env.MCP_PORT ?? String(DEFAULT_CONFIG.mcpPort), 10),
    wsPort: parseInt(process.env.WS_PORT ?? String(DEFAULT_CONFIG.wsPort), 10),
    anvilRpcUrl: process.env.ANVIL_RPC_URL ?? DEFAULT_CONFIG.anvilRpcUrl,
    privateKey,
    chainId: parseInt(process.env.CHAIN_ID ?? String(DEFAULT_CONFIG.chainId), 10),
    accountIndex,
  };
}
