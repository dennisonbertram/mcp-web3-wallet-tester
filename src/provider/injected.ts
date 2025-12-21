/**
 * Injectable EIP-1193 Provider for Web3 Wallet Testing
 *
 * This script is bundled and injected into web pages via Playwright's addInitScript.
 * It creates a mock Ethereum provider on window.ethereum that communicates with
 * the MCP wallet server via WebSocket.
 */

// Declare the build-time constant for TypeScript
declare const __DEV_UI_ENABLED__: boolean;

/**
 * EIP-1193 ProviderRpcError class
 */
class ProviderRpcError extends Error {
  readonly code: number;
  readonly data?: unknown;

  constructor(code: number, message: string, data?: unknown) {
    super(message);
    this.name = 'ProviderRpcError';
    this.code = code;
    this.data = data;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ProviderRpcError);
    }
  }
}

/**
 * EIP-1193 ProviderMessage interface
 */
interface ProviderMessage {
  readonly type: string;
  readonly data: unknown;
}

/**
 * EIP-1193 ProviderConnectInfo interface
 */
interface ProviderConnectInfo {
  readonly chainId: string;
}

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
    data?: unknown;
  };
}

/**
 * Subscription notification from server
 */
interface SubscriptionNotification {
  type: 'subscription';
  subscriptionId: string;
  result: unknown;
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
  // Unique identifier for our test wallet
  readonly isWeb3TestWallet = true;
  // Also pretend to be MetaMask for legacy dApp compatibility
  readonly isMetaMask = true;

  selectedAddress: string | null = null;
  chainId: string | null = null;

  private ws: WebSocket | null = null;
  private wsUrl: string;
  private connected = false;
  private pendingRequests: Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void }> = new Map();
  private eventListeners: Map<string, Set<(...args: unknown[]) => void>> = new Map();
  private subscriptions: Map<string, string> = new Map(); // subscriptionId -> subscription type
  private requestId = 0;
  private connectionPromise: Promise<void> | null = null;
  private connectionReady: Promise<void>;
  private resolveConnectionReady!: () => void;

  constructor(wsUrl: string = 'ws://localhost:8546') {
    this.wsUrl = wsUrl;
    // Create a promise that resolves when we're fully ready
    this.connectionReady = new Promise((resolve) => {
      this.resolveConnectionReady = resolve;
    });
    this.connect();
  }

  private connect(): Promise<void> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.wsUrl);

        this.ws.onopen = async () => {
          console.log('[Web3TestWallet] Connected to wallet server');
          this.connected = true;

          // Fetch chainId immediately on connect for proper EIP-1193 compliance
          try {
            const chainId = await this.request({ method: 'eth_chainId' }) as string;
            this.chainId = chainId;
            const connectInfo: ProviderConnectInfo = { chainId };
            this.emit('connect', connectInfo);
          } catch (err) {
            // Fallback if we can't get chainId
            console.warn('[Web3TestWallet] Could not fetch chainId on connect:', err);
            this.emit('connect', { chainId: '0x1' }); // Default to mainnet
          }

          // Signal that we're fully ready
          this.resolveConnectionReady();
          resolve();
        };

        this.ws.onclose = () => {
          console.log('[Web3TestWallet] Disconnected from wallet server');
          this.connected = false;
          this.connectionPromise = null;

          // Clear subscriptions on disconnect
          this.subscriptions.clear();

          // Emit EIP-1193 compliant disconnect error
          const disconnectError = new ProviderRpcError(4900, 'Disconnected from all chains');
          this.emit('disconnect', disconnectError);

          // Reject all pending requests with ProviderRpcError
          for (const [, { reject }] of this.pendingRequests) {
            reject(new ProviderRpcError(4900, 'Provider disconnected'));
          }
          this.pendingRequests.clear();

          // Try to reconnect after a delay
          setTimeout(() => this.connect(), 1000);
        };

        this.ws.onerror = (error) => {
          console.error('[Web3TestWallet] WebSocket error:', error);
          if (!this.connected) {
            reject(new ProviderRpcError(4900, 'Failed to connect to wallet server'));
          }
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);

            // Handle subscription notifications
            if (message.type === 'subscription') {
              this.handleSubscriptionNotification(message as SubscriptionNotification);
              return;
            }

            // Handle regular responses
            this.handleResponse(message as ProviderResponse);
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

  /**
   * Handle subscription notifications from the server
   */
  private handleSubscriptionNotification(notification: SubscriptionNotification): void {
    const subscriptionType = this.subscriptions.get(notification.subscriptionId);
    if (!subscriptionType) {
      console.warn('[Web3TestWallet] Received notification for unknown subscription:', notification.subscriptionId);
      return;
    }

    // Emit EIP-1193 'message' event for subscription data
    const message: ProviderMessage = {
      type: 'eth_subscription',
      data: {
        subscription: notification.subscriptionId,
        result: notification.result,
      },
    };
    this.emit('message', message);
  }

  private handleResponse(response: ProviderResponse): void {
    const pending = this.pendingRequests.get(response.id);
    if (!pending) {
      console.warn('[Web3TestWallet] Received response for unknown request:', response.id);
      return;
    }

    this.pendingRequests.delete(response.id);

    if (response.error) {
      // Use proper EIP-1193 ProviderRpcError
      const error = new ProviderRpcError(
        response.error.code,
        response.error.message,
        response.error.data
      );
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

    console.log('[Web3TestWallet] Request:', method, params);

    // Ensure we're connected
    await this.connect();

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new ProviderRpcError(4900, 'Not connected to wallet server');
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
        console.log('[Web3TestWallet] Response:', method, result);

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
        } else if (method === 'eth_subscribe') {
          // Track subscription for message events
          const subscriptionId = result as string;
          const subscriptionType = params[0] as string;
          this.subscriptions.set(subscriptionId, subscriptionType);
        } else if (method === 'eth_unsubscribe') {
          // Remove subscription tracking
          const subscriptionId = params[0] as string;
          this.subscriptions.delete(subscriptionId);
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
    console.log('[Web3TestWallet] Emit:', event, args);
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

  console.log('[Web3TestWallet] Initializing...');

  // Get WebSocket URL from config or use default
  const wsUrl = (window as unknown as { __WEB3_TEST_WALLET_WS_URL__?: string }).__WEB3_TEST_WALLET_WS_URL__ || 'ws://localhost:8546';

  // Create the provider instance - this is the ONLY provider we use
  const provider = new Web3TestWalletProvider(wsUrl);

  // Expose for direct access (always works, regardless of window.ethereum state)
  (window as unknown as Record<string, unknown>).__web3TestWallet__ = provider;

  // EIP-6963 Provider Announcement - Do this FIRST before any window.ethereum manipulation
  // This is the PREFERRED method for modern dApps and should always work
  //
  // Per EIP-6963 spec: https://eips.ethereum.org/EIPS/eip-6963
  // - uuid: MUST be UUIDv4 compliant
  // - name: human-readable name
  // - icon: URI pointing to square image (96x96px minimum)
  // - rdns: reverse domain name notation

  // Base64-encoded SVG icon (96x96, purple background with "W3" text)
  const iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="12" fill="#7C3AED"/><text x="48" y="58" text-anchor="middle" fill="white" font-size="32" font-weight="bold" font-family="Arial,sans-serif">W3</text></svg>';
  const iconDataUri = 'data:image/svg+xml;base64,' + btoa(iconSvg);

  const providerInfo: {
    uuid: string;
    name: string;
    icon: string;
    rdns: string;
  } = Object.freeze({
    uuid: 'f7c8b3a1-9d2e-4f5a-8b1c-3d4e5f6a7b8c', // Valid UUIDv4
    name: 'Web3 Test Wallet',
    icon: iconDataUri,
    rdns: 'com.test.web3wallet',
  });

  // Create the announcement event detail per EIP-6963 spec
  const announceDetail: {
    info: typeof providerInfo;
    provider: Web3TestWalletProvider;
  } = Object.freeze({
    info: providerInfo,
    provider: provider,
  });

  const announceProvider = () => {
    console.log('[Web3TestWallet] Announcing via EIP-6963:', providerInfo.name);
    const event = new CustomEvent('eip6963:announceProvider', {
      detail: announceDetail,
    });
    window.dispatchEvent(event);
  };

  // Listen for dApp requests and announce
  window.addEventListener('eip6963:requestProvider', () => {
    console.log('[Web3TestWallet] Received EIP-6963 request, announcing...');
    announceProvider();
  });

  // Announce immediately and repeatedly to ensure visibility
  // Many dApps have different discovery windows, so we announce multiple times
  announceProvider();
  setTimeout(announceProvider, 0);
  setTimeout(announceProvider, 50);
  setTimeout(announceProvider, 100);
  setTimeout(announceProvider, 250);
  setTimeout(announceProvider, 500);
  setTimeout(announceProvider, 1000);
  setTimeout(announceProvider, 2000);
  setTimeout(announceProvider, 3000);
  setTimeout(announceProvider, 5000);

  // Also dispatch our own requestProvider to trigger any late-binding listeners
  // Some dApps re-check for providers when modals open
  setTimeout(() => {
    window.dispatchEvent(new Event('eip6963:requestProvider'));
  }, 100);

  console.log('[Web3TestWallet] EIP-6963 announcement set up');

  // Patch into any existing wallet detection by re-announcing when connect modals open
  // This is a heuristic - look for wallet modal containers being added
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLElement) {
          // Check for common wallet modal patterns
          const hasWalletKeywords = ['wallet', 'connect', 'modal', 'dialog']
            .some(kw => node.className?.toLowerCase?.()?.includes(kw) ||
                        node.id?.toLowerCase?.()?.includes(kw));
          if (hasWalletKeywords) {
            console.log('[Web3TestWallet] Wallet modal detected, re-announcing...');
            announceProvider();
            // Announce a few more times with delays
            setTimeout(announceProvider, 50);
            setTimeout(announceProvider, 200);
          }
        }
      }
    }
  });

  observer.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true,
  });

  // Now try to handle window.ethereum (less critical, but nice to have)
  try {
    const existingProvider = (window as unknown as { ethereum?: EIP1193Provider }).ethereum;

    if (existingProvider) {
      console.log('[Web3TestWallet] Existing provider detected:',
        (existingProvider as { isMetaMask?: boolean }).isMetaMask ? 'MetaMask' : 'Unknown wallet');
    }

    let windowEthereumSet = false;

    // Strategy 1: Direct assignment (works if no other wallet)
    if (!existingProvider) {
      try {
        (window as unknown as Record<string, unknown>).ethereum = provider;
        windowEthereumSet = true;
        console.log('[Web3TestWallet] Set window.ethereum directly');
      } catch (e) {
        console.warn('[Web3TestWallet] Could not set window.ethereum:', e);
      }
    }

    // Strategy 2: Try to override with defineProperty
    if (!windowEthereumSet) {
      try {
        delete (window as unknown as Record<string, unknown>).ethereum;
      } catch {
        // Ignore
      }

      try {
        Object.defineProperty(window, 'ethereum', {
          value: provider,
          writable: true,
          configurable: true,
          enumerable: true,
        });
        windowEthereumSet = true;
        console.log('[Web3TestWallet] Replaced window.ethereum via defineProperty');
      } catch {
        // Property is locked by another wallet
      }
    }

    // Strategy 3: Use a getter
    if (!windowEthereumSet) {
      try {
        Object.defineProperty(window, 'ethereum', {
          get() {
            return provider;
          },
          set() {
            // Ignore attempts to replace
          },
          configurable: true,
          enumerable: true,
        });
        windowEthereumSet = true;
        console.log('[Web3TestWallet] Installed window.ethereum getter');
      } catch (e) {
        console.warn('[Web3TestWallet] Could not install ethereum getter:', e);
      }
    }

    console.log('[Web3TestWallet] window.ethereum:', windowEthereumSet ? 'SET' : 'NOT SET (using EIP-6963 only)');
  } catch (e) {
    console.warn('[Web3TestWallet] Error during window.ethereum setup:', e);
    console.log('[Web3TestWallet] Continuing with EIP-6963 only');
  }

  console.log('[Web3TestWallet] Provider initialized successfully');
  console.log('[Web3TestWallet] - Direct access: window.__web3TestWallet__');
  console.log('[Web3TestWallet] - EIP-6963: ACTIVE');

  // Initialize Developer Wallet UI in dev mode
  if (typeof __DEV_UI_ENABLED__ !== 'undefined' && __DEV_UI_ENABLED__) {
    import('./ui/DevWalletUI').then(({ DevWalletUI }) => {
      const ui = new DevWalletUI(wsUrl);
      (window as unknown as Record<string, unknown>).__WEB3_TEST_WALLET_UI__ = ui;
      console.log('[Web3TestWallet] Developer UI enabled');
    }).catch((error) => {
      console.error('[Web3TestWallet] Failed to load Developer UI:', error);
    });
  }
})();
