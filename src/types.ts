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
 * Configuration for the wallet server
 */
export interface WalletServerConfig {
  mcpPort: number;
  wsPort: number;
  anvilRpcUrl: string;
  privateKey: `0x${string}`;
  chainId: number;
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
};

/**
 * Get configuration from environment variables with defaults
 */
export function getConfig(): WalletServerConfig {
  return {
    mcpPort: parseInt(process.env.MCP_PORT ?? String(DEFAULT_CONFIG.mcpPort), 10),
    wsPort: parseInt(process.env.WS_PORT ?? String(DEFAULT_CONFIG.wsPort), 10),
    anvilRpcUrl: process.env.ANVIL_RPC_URL ?? DEFAULT_CONFIG.anvilRpcUrl,
    privateKey: (process.env.PRIVATE_KEY as `0x${string}`) ?? DEFAULT_CONFIG.privateKey,
    chainId: parseInt(process.env.CHAIN_ID ?? String(DEFAULT_CONFIG.chainId), 10),
  };
}
