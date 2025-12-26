import type { SerializedWalletRequest, TransactionParams } from './types.js';

/**
 * Request category classification
 */
export type RequestCategory = 'connect' | 'read' | 'sign' | 'transaction' | 'chain' | 'unknown';

/**
 * Risk flags for wallet requests
 */
export type RiskFlag = 'high_value' | 'unknown_contract' | 'data_present';

/**
 * Enhanced request with semantic information
 */
export interface EnhancedRequest extends SerializedWalletRequest {
  category: RequestCategory;
  summary: string;
  risk: RiskFlag[];
  decoded?: {
    to?: string;
    valueEth?: string;
    functionName?: string;
  };
}

/**
 * Common function selectors (4-byte signatures)
 */
const KNOWN_SELECTORS: Record<string, string> = {
  '0xa9059cbb': 'transfer',
  '0x23b872dd': 'transferFrom',
  '0x095ea7b3': 'approve',
  '0x40c10f19': 'mint',
  '0x42966c68': 'burn',
  '0x70a08231': 'balanceOf',
  '0x18160ddd': 'totalSupply',
  '0xdd62ed3e': 'allowance',
  '0x313ce567': 'decimals',
  '0x06fdde03': 'name',
  '0x95d89b41': 'symbol',
  '0x3593564c': 'execute', // Uniswap Universal Router
  '0x5ae401dc': 'multicall', // Uniswap
  '0xac9650d8': 'multicall', // Generic multicall
  '0x38ed1739': 'swapExactTokensForTokens',
  '0x7ff36ab5': 'swapExactETHForTokens',
  '0x18cbafe5': 'swapExactTokensForETH',
  '0xfb3bdb41': 'swapETHForExactTokens',
  '0x4a25d94a': 'swapTokensForExactETH',
  '0x8803dbee': 'swapTokensForExactTokens',
};

/**
 * Categorize a wallet request method
 */
export function categorizeMethod(method: string): RequestCategory {
  // Connect methods
  if (['eth_requestAccounts', 'eth_accounts', 'wallet_requestPermissions'].includes(method)) {
    return 'connect';
  }

  // Read-only methods
  if ([
    'eth_chainId',
    'net_version',
    'eth_blockNumber',
    'eth_gasPrice',
    'eth_getBalance',
    'eth_getTransactionCount',
    'eth_getTransactionReceipt',
    'eth_call',
    'eth_estimateGas',
    'eth_getBlockByNumber',
    'eth_getBlockByHash',
    'eth_getLogs',
  ].includes(method)) {
    return 'read';
  }

  // Signing methods
  if (['personal_sign', 'eth_sign', 'eth_signTypedData', 'eth_signTypedData_v4'].includes(method)) {
    return 'sign';
  }

  // Transaction methods
  if (['eth_sendTransaction', 'eth_sendRawTransaction'].includes(method)) {
    return 'transaction';
  }

  // Chain methods
  if (['wallet_switchEthereumChain', 'wallet_addEthereumChain'].includes(method)) {
    return 'chain';
  }

  return 'unknown';
}

/**
 * Decode a function selector from transaction data
 */
export function decodeSelector(data?: string): string | undefined {
  if (!data || data.length < 10) return undefined;
  const selector = data.slice(0, 10).toLowerCase();
  return KNOWN_SELECTORS[selector];
}

/**
 * Parse ETH value from hex string to human-readable
 */
export function parseEthValue(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const wei = BigInt(value);
    const eth = Number(wei) / 1e18;
    return eth.toFixed(6);
  } catch {
    return undefined;
  }
}

/**
 * Analyze a request for risk flags
 */
export function analyzeRisks(
  request: SerializedWalletRequest,
  options?: { maxValueEth?: number; knownContracts?: string[]; expectedChainId?: number }
): RiskFlag[] {
  const risks: RiskFlag[] = [];
  const category = categorizeMethod(request.method);

  if (category === 'transaction' && request.params[0]) {
    const txParams = request.params[0] as TransactionParams;

    // Check value
    const ethValue = parseEthValue(txParams.value);
    if (ethValue && parseFloat(ethValue) > (options?.maxValueEth ?? 0.1)) {
      risks.push('high_value');
    }

    // Check unknown contract
    if (txParams.to && options?.knownContracts && !options.knownContracts.includes(txParams.to.toLowerCase())) {
      risks.push('unknown_contract');
    }

    // Check for data (contract call)
    if (txParams.data && txParams.data !== '0x') {
      risks.push('data_present');
    }
  }

  return risks;
}

/**
 * Generate a human-readable summary of a request
 */
export function summarizeRequest(request: SerializedWalletRequest): string {
  const category = categorizeMethod(request.method);

  switch (category) {
    case 'connect':
      return 'Request to connect wallet and access accounts';
    case 'read':
      return `Read-only request: ${request.method}`;
    case 'sign': {
      if (request.method === 'personal_sign') {
        const message = request.params[0] as string;
        const preview = message.length > 50 ? message.slice(0, 50) + '...' : message;
        return `Sign message: "${preview}"`;
      }
      if (request.method.includes('TypedData')) {
        return 'Sign typed data (EIP-712)';
      }
      return 'Sign message request';
    }
    case 'transaction': {
      const txParams = request.params[0] as TransactionParams | undefined;
      if (!txParams) return 'Send transaction (no params)';

      const parts: string[] = [];

      if (txParams.to) {
        parts.push(`to ${txParams.to.slice(0, 10)}...`);
      }

      const ethValue = parseEthValue(txParams.value);
      if (ethValue && parseFloat(ethValue) > 0) {
        parts.push(`${ethValue} ETH`);
      }

      const functionName = decodeSelector(txParams.data);
      if (functionName) {
        parts.push(`calling ${functionName}()`);
      } else if (txParams.data && txParams.data !== '0x') {
        parts.push('with data');
      }

      return `Transaction: ${parts.join(', ') || 'empty tx'}`;
    }
    case 'chain':
      if (request.method === 'wallet_switchEthereumChain') {
        const chainParam = request.params[0] as { chainId: string } | undefined;
        const chainId = chainParam?.chainId ? parseInt(chainParam.chainId, 16) : 'unknown';
        return `Switch to chain ${chainId}`;
      }
      return 'Chain management request';
    default:
      return `Unknown method: ${request.method}`;
  }
}

/**
 * Enhance a request with semantic information
 */
export function enhanceRequest(
  request: SerializedWalletRequest,
  options?: { maxValueEth?: number; knownContracts?: string[]; expectedChainId?: number }
): EnhancedRequest {
  const category = categorizeMethod(request.method);
  const summary = summarizeRequest(request);
  const risks = analyzeRisks(request, options);

  const enhanced: EnhancedRequest = {
    ...request,
    category,
    summary,
    risk: risks,
  };

  // Add decoded info for transactions
  if (category === 'transaction' && request.params[0]) {
    const txParams = request.params[0] as TransactionParams;
    enhanced.decoded = {
      to: txParams.to,
      valueEth: parseEthValue(txParams.value),
      functionName: decodeSelector(txParams.data),
    };
  }

  return enhanced;
}
