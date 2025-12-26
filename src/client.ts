/**
 * Typed HTTP client for MCP Web3 Wallet Tester
 * Provides skill-based access to the wallet server for Claude Code inline scripts
 */

export interface WalletClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
}

export interface WalletStatus {
  address: string;
  accountIndex: number;
  chainId: number;
  pendingRequests: number;
  autoApprove: boolean;
  balance: string;
}

export interface WalletRequest {
  id: string;
  method: string;
  params: unknown;
  timestamp: number;
}

export interface ApprovalResult {
  approved: number;
  errors: Array<{ id: string; error: string }>;
}

/**
 * Fetch options interface (Node.js compatible)
 */
interface FetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
}

export interface WalletClient {
  getStatus(): Promise<WalletStatus>;
  getPendingRequests(): Promise<WalletRequest[]>;
  waitForRequest(opts?: { timeoutMs?: number }): Promise<WalletRequest>;
  approveRequest(requestId: string): Promise<unknown>;
  rejectRequest(requestId: string, reason?: string): Promise<void>;
  setAutoApprove(enabled: boolean): Promise<void>;
  getProviderScript(wsUrl?: string): Promise<string>;
  disconnect(): Promise<void>;

  // High-value orchestration helpers
  approveAllPending(opts?: { delayMsBetween?: number; ignoreUnsupported?: boolean }): Promise<ApprovalResult>;
  approveUntilEmpty(opts?: { maxRounds?: number; roundDelayMs?: number }): Promise<ApprovalResult>;
}

/**
 * Internal implementation of WalletClient
 */
class WalletClientImpl implements WalletClient {
  private baseUrl: string;
  private timeoutMs: number;

  constructor(options: WalletClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? 'http://localhost:3001';
    this.timeoutMs = options.timeoutMs ?? 30000;
  }

  private async fetch<T>(
    path: string,
    options: FetchOptions = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage: string;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error ?? errorText;
        } catch {
          errorMessage = errorText;
        }
        throw new Error(`HTTP ${response.status}: ${errorMessage}`);
      }

      return await response.json() as T;
    } catch (error) {
      clearTimeout(timeout);
      if ((error as Error).name === 'AbortError') {
        throw new Error(`Request timeout after ${this.timeoutMs}ms`);
      }
      throw error;
    }
  }

  async getStatus(): Promise<WalletStatus> {
    return this.fetch<WalletStatus>('/api/status');
  }

  async getPendingRequests(): Promise<WalletRequest[]> {
    return this.fetch<WalletRequest[]>('/api/pending');
  }

  async waitForRequest(opts?: { timeoutMs?: number }): Promise<WalletRequest> {
    return this.fetch<WalletRequest>('/api/wait', {
      method: 'POST',
      body: JSON.stringify({ timeoutMs: opts?.timeoutMs ?? 30000 }),
    });
  }

  async approveRequest(requestId: string): Promise<unknown> {
    const response = await this.fetch<{ success: boolean; result: unknown; error?: string }>('/api/approve', {
      method: 'POST',
      body: JSON.stringify({ requestId }),
    });

    if (!response.success) {
      throw new Error(response.error ?? 'Failed to approve request');
    }

    return response.result;
  }

  async rejectRequest(requestId: string, reason?: string): Promise<void> {
    const response = await this.fetch<{ success: boolean; error?: string }>('/api/reject', {
      method: 'POST',
      body: JSON.stringify({ requestId, reason }),
    });

    if (!response.success) {
      throw new Error(response.error ?? 'Failed to reject request');
    }
  }

  async setAutoApprove(enabled: boolean): Promise<void> {
    const response = await this.fetch<{ success: boolean; error?: string }>('/api/auto-approve', {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    });

    if (!response.success) {
      throw new Error(response.error ?? 'Failed to set auto-approve');
    }
  }

  async getProviderScript(wsUrl?: string): Promise<string> {
    const queryParam = wsUrl ? `?wsUrl=${encodeURIComponent(wsUrl)}` : '';
    const response = await this.fetch<{ script: string }>(`/api/provider${queryParam}`);
    return response.script;
  }

  async disconnect(): Promise<void> {
    // HTTP client doesn't maintain persistent connections
    // This is a no-op but included for API consistency
    return Promise.resolve();
  }

  async approveAllPending(opts?: { delayMsBetween?: number; ignoreUnsupported?: boolean }): Promise<ApprovalResult> {
    const delayMs = opts?.delayMsBetween ?? 100;
    const ignoreUnsupported = opts?.ignoreUnsupported ?? true;

    const pending = await this.getPendingRequests();
    const result: ApprovalResult = {
      approved: 0,
      errors: [],
    };

    for (const request of pending) {
      try {
        await this.approveRequest(request.id);
        result.approved++;
      } catch (error) {
        const errorMessage = (error as Error).message;

        // If ignoreUnsupported is true and the error is about unsupported method, skip it
        if (ignoreUnsupported && errorMessage.includes('Unsupported method')) {
          // Don't count as error, just skip
          continue;
        }

        result.errors.push({
          id: request.id,
          error: errorMessage,
        });
      }

      // Add delay between approvals to avoid overwhelming the server
      if (delayMs > 0 && request !== pending[pending.length - 1]) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    return result;
  }

  async approveUntilEmpty(opts?: { maxRounds?: number; roundDelayMs?: number }): Promise<ApprovalResult> {
    const maxRounds = opts?.maxRounds ?? 10;
    const roundDelayMs = opts?.roundDelayMs ?? 500;

    const totalResult: ApprovalResult = {
      approved: 0,
      errors: [],
    };

    for (let round = 0; round < maxRounds; round++) {
      const pending = await this.getPendingRequests();

      // If no more pending requests, we're done
      if (pending.length === 0) {
        break;
      }

      // Approve all pending requests in this round
      const roundResult = await this.approveAllPending({ delayMsBetween: 100, ignoreUnsupported: true });

      totalResult.approved += roundResult.approved;
      totalResult.errors.push(...roundResult.errors);

      // Wait before checking for more requests
      if (round < maxRounds - 1) {
        await new Promise(resolve => setTimeout(resolve, roundDelayMs));
      }
    }

    return totalResult;
  }
}

/**
 * Connect to the wallet server
 * @param serverUrl - Base URL of the wallet server (default: http://localhost:3001)
 * @returns A connected WalletClient instance
 */
export async function connect(serverUrl?: string): Promise<WalletClient> {
  const client = new WalletClientImpl({
    baseUrl: serverUrl,
  });

  // Verify connection by fetching status
  try {
    await client.getStatus();
  } catch (error) {
    throw new Error(`Failed to connect to wallet server: ${(error as Error).message}`);
  }

  return client;
}
