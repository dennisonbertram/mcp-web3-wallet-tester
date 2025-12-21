import { randomUUID } from 'crypto';
import type { WalletRequest, SerializedWalletRequest, TransactionParams } from './types.js';
import { EIP1193_ERRORS } from './types.js';
import type { Wallet } from './wallet.js';

/**
 * Subscription types supported by eth_subscribe
 */
type SubscriptionType = 'newHeads' | 'logs' | 'newPendingTransactions';

/**
 * Subscription info
 */
interface Subscription {
  id: string;
  type: SubscriptionType;
  params?: unknown;
  intervalId?: ReturnType<typeof setInterval>;
}

/**
 * Callback for subscription notifications
 */
type SubscriptionCallback = (subscriptionId: string, result: unknown) => void;

/**
 * Manages pending wallet requests waiting for LLM approval
 */
export class RequestQueue {
  private requests: Map<string, WalletRequest> = new Map();
  private wallet: Wallet;
  private autoApprove: boolean = false;
  private waiters: Array<(request: SerializedWalletRequest) => void> = [];
  private subscriptions: Map<string, Subscription> = new Map();
  private subscriptionCallback: SubscriptionCallback | null = null;
  private lastBlockNumber: bigint | null = null;

  constructor(wallet: Wallet) {
    this.wallet = wallet;
  }

  /**
   * Set the callback for subscription notifications
   */
  setSubscriptionCallback(callback: SubscriptionCallback): void {
    this.subscriptionCallback = callback;
  }

  /**
   * Add a new request to the queue
   * Returns a Promise that resolves when the request is approved/rejected
   */
  addRequest(method: string, params: unknown[]): Promise<unknown> {
    const id = `req_${randomUUID().slice(0, 8)}`;

    return new Promise((resolve, reject) => {
      const request: WalletRequest = {
        id,
        method,
        params,
        timestamp: Date.now(),
        resolve,
        reject,
      };

      // If auto-approve is enabled, immediately process the request
      if (this.autoApprove) {
        this.processRequest(request)
          .then(resolve)
          .catch(reject);
        return;
      }

      this.requests.set(id, request);

      // Notify any waiters that a new request arrived
      const serialized = this.serializeRequest(request);
      for (const waiter of this.waiters) {
        waiter(serialized);
      }
      this.waiters = [];
    });
  }

  /**
   * Get all pending requests (serialized for MCP response)
   */
  getPendingRequests(): SerializedWalletRequest[] {
    return Array.from(this.requests.values()).map(this.serializeRequest);
  }

  /**
   * Get a specific request by ID
   */
  getRequest(id: string): WalletRequest | undefined {
    return this.requests.get(id);
  }

  /**
   * Approve a request - processes it and resolves the Promise
   */
  async approveRequest(id: string): Promise<unknown> {
    const request = this.requests.get(id);
    if (!request) {
      throw new Error(`Request ${id} not found`);
    }

    this.requests.delete(id);

    try {
      const result = await this.processRequest(request);
      request.resolve(result);
      return result;
    } catch (error) {
      request.reject(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Reject a request - rejects the Promise with an error
   */
  rejectRequest(id: string, reason?: string): void {
    const request = this.requests.get(id);
    if (!request) {
      throw new Error(`Request ${id} not found`);
    }

    this.requests.delete(id);

    const error = new Error(reason ?? EIP1193_ERRORS.USER_REJECTED.message);
    (error as unknown as Record<string, unknown>).code = EIP1193_ERRORS.USER_REJECTED.code;
    request.reject(error);
  }

  /**
   * Wait for a request to arrive
   * Returns when a request is added to the queue or timeout is reached
   */
  waitForRequest(timeoutMs: number = 30000): Promise<SerializedWalletRequest> {
    // If there's already a pending request, return it immediately
    const existing = this.getPendingRequests();
    if (existing.length > 0) {
      return Promise.resolve(existing[0]);
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waiters.indexOf(resolve);
        if (index !== -1) {
          this.waiters.splice(index, 1);
        }
        reject(new Error(`Timeout waiting for request after ${timeoutMs}ms`));
      }, timeoutMs);

      this.waiters.push((request) => {
        clearTimeout(timeout);
        resolve(request);
      });
    });
  }

  /**
   * Enable or disable auto-approve mode
   */
  setAutoApprove(enabled: boolean): void {
    this.autoApprove = enabled;
  }

  /**
   * Check if auto-approve is enabled
   */
  isAutoApproveEnabled(): boolean {
    return this.autoApprove;
  }

  /**
   * Get the count of pending requests
   */
  getPendingCount(): number {
    return this.requests.size;
  }

  /**
   * Get the wallet instance (for UI state)
   */
  getWallet(): Wallet {
    return this.wallet;
  }

  /**
   * Clear all pending requests (rejects them all)
   */
  clear(): void {
    for (const request of this.requests.values()) {
      const error = new Error('Queue cleared');
      (error as unknown as Record<string, unknown>).code = EIP1193_ERRORS.DISCONNECTED.code;
      request.reject(error);
    }
    this.requests.clear();
  }

  /**
   * Process a request based on its method
   */
  private async processRequest(request: WalletRequest): Promise<unknown> {
    const { method, params } = request;

    switch (method) {
      case 'eth_requestAccounts':
      case 'eth_accounts':
        return [this.wallet.getAddress()];

      case 'eth_chainId':
        return `0x${this.wallet.getChainId().toString(16)}`;

      case 'net_version':
        return String(this.wallet.getChainId());

      case 'eth_sendTransaction': {
        const txParams = params[0] as TransactionParams;
        const hash = await this.wallet.sendTransaction(txParams);
        return hash;
      }

      case 'personal_sign': {
        // personal_sign has params as [message, address]
        const message = params[0] as string;
        const signature = await this.wallet.signMessage(message);
        return signature;
      }

      case 'eth_sign': {
        // eth_sign has params as [address, message]
        const message = params[1] as string;
        const signature = await this.wallet.signMessage(message);
        return signature;
      }

      case 'eth_signTypedData':
      case 'eth_signTypedData_v4': {
        // params are [address, typedData]
        const typedDataString = params[1] as string;
        const typedData = typeof typedDataString === 'string'
          ? JSON.parse(typedDataString)
          : typedDataString;
        const signature = await this.wallet.signTypedData(typedData);
        return signature;
      }

      case 'eth_getBalance': {
        const address = params[0] as `0x${string}`;
        const balance = await this.wallet.getBalance(address);
        // Return as hex wei
        return `0x${BigInt(Math.floor(parseFloat(balance) * 1e18)).toString(16)}`;
      }

      case 'eth_blockNumber': {
        const blockNumber = await this.wallet.getBlockNumber();
        return `0x${blockNumber.toString(16)}`;
      }

      case 'eth_gasPrice': {
        const gasPrice = await this.wallet.getGasPrice();
        return `0x${gasPrice.toString(16)}`;
      }

      case 'eth_estimateGas': {
        const txParams = params[0] as TransactionParams;
        const gas = await this.wallet.estimateGas(txParams);
        return `0x${gas.toString(16)}`;
      }

      case 'eth_getTransactionCount': {
        const address = params[0] as `0x${string}`;
        const count = await this.wallet.getTransactionCount(address);
        return `0x${count.toString(16)}`;
      }

      case 'eth_getTransactionReceipt': {
        const hash = params[0] as `0x${string}`;
        const receipt = await this.wallet.getTransactionReceipt(hash);
        if (!receipt) return null;
        // Convert BigInt values to hex strings for JSON serialization
        return {
          ...receipt,
          blockNumber: `0x${receipt.blockNumber.toString(16)}`,
          cumulativeGasUsed: `0x${receipt.cumulativeGasUsed.toString(16)}`,
          effectiveGasPrice: `0x${receipt.effectiveGasPrice.toString(16)}`,
          gasUsed: `0x${receipt.gasUsed.toString(16)}`,
          transactionIndex: receipt.transactionIndex,
          type: receipt.type,
          status: receipt.status,
        };
      }

      case 'wallet_switchEthereumChain':
        // For Anvil testing, we just accept any chain switch request
        return null;

      case 'wallet_addEthereumChain':
        // For Anvil testing, we just accept any chain add request
        return null;

      case 'eth_subscribe': {
        const subscriptionType = params[0] as SubscriptionType;
        const subscriptionParams = params[1];
        return this.createSubscription(subscriptionType, subscriptionParams);
      }

      case 'eth_unsubscribe': {
        const subscriptionId = params[0] as string;
        return this.removeSubscription(subscriptionId);
      }

      default:
        throw new Error(`Unsupported method: ${method}`);
    }
  }

  /**
   * Serialize a request for external consumption (remove callbacks)
   */
  private serializeRequest(request: WalletRequest): SerializedWalletRequest {
    return {
      id: request.id,
      method: request.method,
      params: request.params,
      timestamp: request.timestamp,
    };
  }

  /**
   * Create a new subscription
   */
  private createSubscription(type: SubscriptionType, params?: unknown): string {
    const id = `0x${randomUUID().replace(/-/g, '').slice(0, 32)}`;

    const subscription: Subscription = {
      id,
      type,
      params,
    };

    // Set up polling based on subscription type
    switch (type) {
      case 'newHeads':
        subscription.intervalId = setInterval(async () => {
          try {
            const blockNumber = await this.wallet.getBlockNumber();
            if (this.lastBlockNumber !== null && blockNumber > this.lastBlockNumber) {
              // New block detected - in a real implementation we'd fetch block details
              // For testing purposes, we emit a simplified block header
              const result = {
                number: `0x${blockNumber.toString(16)}`,
                hash: `0x${'0'.repeat(64)}`, // Placeholder
                parentHash: `0x${'0'.repeat(64)}`,
                timestamp: `0x${Math.floor(Date.now() / 1000).toString(16)}`,
              };
              this.notifySubscription(id, result);
            }
            this.lastBlockNumber = blockNumber;
          } catch (error) {
            console.error('[RequestQueue] Error polling for new blocks:', error);
          }
        }, 1000); // Poll every second
        break;

      case 'newPendingTransactions':
        // For Anvil/testing, pending transactions are immediately mined
        // We'll emit a notification but in practice this would need mempool access
        subscription.intervalId = setInterval(() => {
          // No-op for testing - Anvil doesn't have a real mempool
        }, 2000);
        break;

      case 'logs':
        // Log subscriptions would filter events based on params
        // For testing, we just set up the subscription without active polling
        // A real implementation would watch for matching logs
        break;

      default:
        throw new Error(`Unsupported subscription type: ${type}`);
    }

    this.subscriptions.set(id, subscription);
    return id;
  }

  /**
   * Remove a subscription
   */
  private removeSubscription(subscriptionId: string): boolean {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      return false;
    }

    // Clear any polling interval
    if (subscription.intervalId) {
      clearInterval(subscription.intervalId);
    }

    this.subscriptions.delete(subscriptionId);
    return true;
  }

  /**
   * Notify subscribers of new data
   */
  private notifySubscription(subscriptionId: string, result: unknown): void {
    if (this.subscriptionCallback) {
      this.subscriptionCallback(subscriptionId, result);
    }
  }

  /**
   * Clear all subscriptions (e.g., on disconnect)
   */
  clearSubscriptions(): void {
    for (const subscription of this.subscriptions.values()) {
      if (subscription.intervalId) {
        clearInterval(subscription.intervalId);
      }
    }
    this.subscriptions.clear();
  }

  /**
   * Get count of active subscriptions
   */
  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }
}
