/**
 * Injectable EIP-1193 Provider for Web3 Wallet Testing
 *
 * This script is bundled and injected into web pages via Playwright's addInitScript.
 * It creates a mock Ethereum provider on window.ethereum that communicates with
 * the MCP wallet server via WebSocket.
 */

interface ProviderRequest {
  type: 'request';
  id: string;
  method: string;
  params: unknown[];
}

interface ProviderResponse {
  type: 'response';
  id: string;
  result?: unknown;
  error?: {
    code: number;
    message: string;
  };
}

interface EIP1193Provider {
  isMetaMask: boolean;
  isConnected: () => boolean;
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on: (event: string, callback: (...args: unknown[]) => void) => void;
  removeListener: (event: string, callback: (...args: unknown[]) => void) => void;
  selectedAddress: string | null;
  chainId: string | null;
}

class Web3TestWalletProvider implements EIP1193Provider {
  isMetaMask = true; // Pretend to be MetaMask for dApp compatibility
  selectedAddress: string | null = null;
  chainId: string | null = null;

  private ws: WebSocket | null = null;
  private wsUrl: string;
  private connected = false;
  private pendingRequests: Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void }> = new Map();
  private eventListeners: Map<string, Set<(...args: unknown[]) => void>> = new Map();
  private requestId = 0;
  private connectionPromise: Promise<void> | null = null;

  constructor(wsUrl: string = 'ws://localhost:8546') {
    this.wsUrl = wsUrl;
    this.connect();
  }

  private connect(): Promise<void> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.wsUrl);

        this.ws.onopen = () => {
          console.log('[Web3TestWallet] Connected to wallet server');
          this.connected = true;
          this.emit('connect', { chainId: this.chainId });
          resolve();
        };

        this.ws.onclose = () => {
          console.log('[Web3TestWallet] Disconnected from wallet server');
          this.connected = false;
          this.connectionPromise = null;
          this.emit('disconnect', { code: 4900, message: 'Disconnected' });

          // Reject all pending requests
          for (const [, { reject }] of this.pendingRequests) {
            reject(new Error('WebSocket disconnected'));
          }
          this.pendingRequests.clear();

          // Try to reconnect after a delay
          setTimeout(() => this.connect(), 1000);
        };

        this.ws.onerror = (error) => {
          console.error('[Web3TestWallet] WebSocket error:', error);
          if (!this.connected) {
            reject(new Error('Failed to connect to wallet server'));
          }
        };

        this.ws.onmessage = (event) => {
          try {
            const response = JSON.parse(event.data) as ProviderResponse;
            this.handleResponse(response);
          } catch (error) {
            console.error('[Web3TestWallet] Error parsing message:', error);
          }
        };
      } catch (error) {
        reject(error);
      }
    });

    return this.connectionPromise;
  }

  private handleResponse(response: ProviderResponse): void {
    const pending = this.pendingRequests.get(response.id);
    if (!pending) {
      console.warn('[Web3TestWallet] Received response for unknown request:', response.id);
      return;
    }

    this.pendingRequests.delete(response.id);

    if (response.error) {
      const error = new Error(response.error.message) as Error & { code: number };
      error.code = response.error.code;
      pending.reject(error);
    } else {
      pending.resolve(response.result);
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  async request(args: { method: string; params?: unknown[] }): Promise<unknown> {
    const { method, params = [] } = args;

    // Ensure we're connected
    await this.connect();

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected to wallet server');
    }

    const id = `${++this.requestId}`;

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });

      const request: ProviderRequest = {
        type: 'request',
        id,
        method,
        params,
      };

      this.ws!.send(JSON.stringify(request));

      // Handle the response and update internal state
      const originalResolve = resolve;
      this.pendingRequests.get(id)!.resolve = (result: unknown) => {
        // Update internal state based on method
        if (method === 'eth_requestAccounts' || method === 'eth_accounts') {
          const accounts = result as string[];
          if (accounts.length > 0) {
            const oldAddress = this.selectedAddress;
            this.selectedAddress = accounts[0];
            if (oldAddress !== this.selectedAddress) {
              this.emit('accountsChanged', accounts);
            }
          }
        } else if (method === 'eth_chainId') {
          const oldChainId = this.chainId;
          this.chainId = result as string;
          if (oldChainId !== this.chainId) {
            this.emit('chainChanged', this.chainId);
          }
        } else if (method === 'wallet_switchEthereumChain') {
          // Chain switch successful, update chainId
          const chainIdParam = (params[0] as { chainId: string })?.chainId;
          if (chainIdParam && this.chainId !== chainIdParam) {
            this.chainId = chainIdParam;
            this.emit('chainChanged', this.chainId);
          }
        }
        originalResolve(result);
      };
    });
  }

  on(event: string, callback: (...args: unknown[]) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  removeListener(event: string, callback: (...args: unknown[]) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  private emit(event: string, ...args: unknown[]): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      for (const callback of listeners) {
        try {
          callback(...args);
        } catch (error) {
          console.error(`[Web3TestWallet] Error in ${event} listener:`, error);
        }
      }
    }
  }

  // Legacy methods for compatibility
  enable(): Promise<string[]> {
    return this.request({ method: 'eth_requestAccounts' }) as Promise<string[]>;
  }

  send(method: string, params?: unknown[]): Promise<unknown> {
    return this.request({ method, params });
  }

  sendAsync(
    payload: { method: string; params?: unknown[] },
    callback: (error: Error | null, result?: { result: unknown }) => void
  ): void {
    this.request(payload)
      .then((result) => callback(null, { result }))
      .catch((error) => callback(error));
  }
}

// Create and inject the provider
(function injectProvider() {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    return;
  }

  // Get WebSocket URL from config or use default
  const wsUrl = (window as unknown as { __WEB3_TEST_WALLET_WS_URL__?: string }).__WEB3_TEST_WALLET_WS_URL__ || 'ws://localhost:8546';

  // Create the provider instance
  const provider = new Web3TestWalletProvider(wsUrl);

  // Inject as window.ethereum
  Object.defineProperty(window, 'ethereum', {
    value: provider,
    writable: false,
    configurable: false,
  });

  // Also set up EIP-6963 provider announcement for modern dApps
  const announceProvider = () => {
    const info = {
      uuid: 'web3-test-wallet-' + Math.random().toString(36).slice(2),
      name: 'Web3 Test Wallet',
      icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><text y="18" font-size="18">🔧</text></svg>',
      rdns: 'com.test.web3wallet',
    };

    window.dispatchEvent(
      new CustomEvent('eip6963:announceProvider', {
        detail: Object.freeze({ info, provider }),
      })
    );
  };

  // Announce on load and when requested
  window.addEventListener('eip6963:requestProvider', announceProvider);
  announceProvider();

  console.log('[Web3TestWallet] Provider injected on window.ethereum');
})();
