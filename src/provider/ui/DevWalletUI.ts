/**
 * Developer Wallet UI - Main Orchestrator
 *
 * Creates a Shadow DOM container with floating button and drawer
 * for displaying wallet status during development/testing.
 */

import { getAllStyles } from './styles';
import { createFloatingButton, updateFloatingButtonBadge, setFloatingButtonOpen } from './components/FloatingButton';
import { createDrawer, setDrawerOpen } from './components/Drawer';
import { createWalletInfo, attachCopyHandlers } from './components/WalletInfo';
import { createPendingRequests, attachPendingRequestHandlers } from './components/PendingRequests';
import { createAccountSwitcher, attachAccountSwitcherHandlers } from './components/AccountSwitcher';
import type { WalletUIState, UIRequest, UIResponse, SerializedWalletRequest, PendingRequestsResult, ActionResult, UINotification } from './types';
import { isUINotification } from './types';

/**
 * Anvil's default test accounts (addresses only for UI display)
 */
const ANVIL_ACCOUNTS = [
  { index: 0, address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' },
  { index: 1, address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' },
  { index: 2, address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC' },
  { index: 3, address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906' },
  { index: 4, address: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65' },
  { index: 5, address: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc' },
  { index: 6, address: '0x976EA74026E726554dB657fA54763abd0C3a0aa9' },
  { index: 7, address: '0x14dC79964da2C08b23698B3D3cc7Ca32193d9955' },
  { index: 8, address: '0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f' },
  { index: 9, address: '0xa0Ee7A142d267C1f36714E4a8F75612F20a79720' },
];

/**
 * Check if a message is a UI response
 */
function checkIsUIResponse(message: unknown): message is UIResponse {
  return (
    typeof message === 'object' &&
    message !== null &&
    (message as UIResponse).type === 'ui_response'
  );
}

/**
 * Type guard for pending requests result
 */
function isPendingRequestsResult(result: unknown): result is PendingRequestsResult {
  return (
    typeof result === 'object' &&
    result !== null &&
    'requests' in result &&
    Array.isArray((result as PendingRequestsResult).requests)
  );
}

/**
 * Type guard for action result
 */
function isActionResult(result: unknown): result is ActionResult {
  return (
    typeof result === 'object' &&
    result !== null &&
    'success' in result
  );
}

/**
 * Type guard for wallet UI state
 */
function isWalletUIState(result: unknown): result is WalletUIState {
  return (
    typeof result === 'object' &&
    result !== null &&
    'address' in result &&
    'balance' in result
  );
}

export class DevWalletUI {
  private container: HTMLDivElement;
  private shadowRoot: ShadowRoot;
  private button: HTMLButtonElement;
  private drawer: HTMLDivElement;
  private overlay: HTMLDivElement;
  private content: HTMLDivElement;
  private ws: WebSocket | null = null;
  private wsUrl: string;
  private isOpen = false;
  private state: WalletUIState | null = null;
  private walletRequests: SerializedWalletRequest[] = [];
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private requestId = 0;
  private pendingUIRequests: Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void }> = new Map();
  private accountSwitcherCleanup: (() => void) | null = null;

  constructor(wsUrl: string = 'ws://localhost:8546') {
    this.wsUrl = wsUrl;

    // Create container element
    this.container = document.createElement('div');
    this.container.id = 'dev-wallet-ui-root';

    // Attach shadow DOM for style isolation
    this.shadowRoot = this.container.attachShadow({ mode: 'closed' });

    // Inject styles
    const styleEl = document.createElement('style');
    styleEl.textContent = getAllStyles();
    this.shadowRoot.appendChild(styleEl);

    // Create floating button
    this.button = createFloatingButton({
      onClick: () => this.toggle(),
    });
    this.shadowRoot.appendChild(this.button);

    // Create drawer
    const { drawer, overlay, content } = createDrawer({
      onClose: () => this.close(),
    });
    this.drawer = drawer;
    this.overlay = overlay;
    this.content = content;
    this.shadowRoot.appendChild(overlay);
    this.shadowRoot.appendChild(drawer);

    // Append to body
    document.body.appendChild(this.container);

    // Connect WebSocket
    this.connectWebSocket();

    console.log('[DevWallet] UI initialized');
  }

  /**
   * Connect to the WebSocket server
   */
  private connectWebSocket(): void {
    try {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.onopen = () => {
        console.log('[DevWallet] Connected to wallet server');
        // Fetch initial state and pending requests
        this.fetchAndUpdate();
      };

      this.ws.onclose = () => {
        console.log('[DevWallet] Disconnected from wallet server');
        this.ws = null;
        // Try to reconnect after a delay
        setTimeout(() => this.connectWebSocket(), 2000);
      };

      this.ws.onerror = (error) => {
        console.error('[DevWallet] WebSocket error:', error);
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (checkIsUIResponse(message)) {
            this.handleUIResponse(message);
          } else if (isUINotification(message)) {
            this.handleUINotification(message);
          }
        } catch {
          // Ignore non-UI messages
        }
      };
    } catch (error) {
      console.error('[DevWallet] Failed to connect:', error);
    }
  }

  /**
   * Handle UI response from server
   */
  private handleUIResponse(response: UIResponse): void {
    const pending = this.pendingUIRequests.get(response.id);
    if (!pending) return;

    this.pendingUIRequests.delete(response.id);

    if (response.error) {
      pending.reject(new Error(response.error.message));
    } else if (response.result) {
      pending.resolve(response.result);
    }
  }

  /**
   * Handle UI notification from server (push notifications)
   */
  private handleUINotification(notification: UINotification): void {
    if (notification.event === 'newPendingRequest') {
      console.log('[DevWallet] New pending request:', notification.data?.method);
      // Auto-open the drawer when a new request arrives
      if (!this.isOpen) {
        this.open();
      }
      // Refresh the UI to show the new request
      this.fetchAndUpdate();
    } else if (notification.event === 'requestResolved') {
      console.log('[DevWallet] Request resolved:', notification.data?.requestId);
      // Refresh the UI to update the pending count
      this.fetchAndUpdate();
    }
  }

  /**
   * Send a UI request and wait for response
   */
  private sendUIRequest<T>(action: UIRequest['action'], params?: UIRequest['params']): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const id = `ui_${++this.requestId}`;
      const request: UIRequest = {
        type: 'ui_request',
        id,
        action,
        params,
      };

      this.pendingUIRequests.set(id, { resolve: resolve as (value: unknown) => void, reject });
      this.ws.send(JSON.stringify(request));

      // Timeout after 5 seconds
      setTimeout(() => {
        if (this.pendingUIRequests.has(id)) {
          this.pendingUIRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 5000);
    });
  }

  /**
   * Fetch wallet state from server
   */
  private async fetchState(): Promise<void> {
    try {
      const result = await this.sendUIRequest<unknown>('getState');
      if (isWalletUIState(result)) {
        this.state = result;
      }
    } catch (error) {
      console.error('[DevWallet] Failed to fetch state:', error);
    }
  }

  /**
   * Fetch pending wallet requests from server
   */
  private async fetchPendingRequests(): Promise<void> {
    try {
      const result = await this.sendUIRequest<unknown>('getPendingRequests');
      if (isPendingRequestsResult(result)) {
        this.walletRequests = result.requests;
      }
    } catch (error) {
      console.error('[DevWallet] Failed to fetch pending requests:', error);
    }
  }

  /**
   * Fetch all data and update UI
   */
  private async fetchAndUpdate(): Promise<void> {
    await Promise.all([
      this.fetchState(),
      this.fetchPendingRequests(),
    ]);
    this.updateUI();
  }

  /**
   * Approve a pending request
   */
  private async approveRequest(requestId: string): Promise<void> {
    try {
      const result = await this.sendUIRequest<unknown>('approveRequest', { requestId });
      if (isActionResult(result) && result.success) {
        console.log('[DevWallet] Request approved:', requestId);
        // Refresh state after approval
        await this.fetchAndUpdate();
      }
    } catch (error) {
      console.error('[DevWallet] Failed to approve request:', error);
    }
  }

  /**
   * Reject a pending request
   */
  private async rejectRequest(requestId: string): Promise<void> {
    try {
      const result = await this.sendUIRequest<unknown>('rejectRequest', { requestId, reason: 'User rejected via Dev Wallet UI' });
      if (isActionResult(result) && result.success) {
        console.log('[DevWallet] Request rejected:', requestId);
        // Refresh state after rejection
        await this.fetchAndUpdate();
      }
    } catch (error) {
      console.error('[DevWallet] Failed to reject request:', error);
    }
  }

  /**
   * Approve all pending requests
   */
  private async approveAllRequests(): Promise<void> {
    for (const request of this.walletRequests) {
      await this.approveRequest(request.id);
    }
  }

  /**
   * Switch to a different account
   */
  private async switchAccount(accountIndex: number): Promise<void> {
    try {
      const result = await this.sendUIRequest<unknown>('switchAccount', { accountIndex });
      if (isActionResult(result) && result.success) {
        console.log('[DevWallet] Switched to account:', accountIndex, result.address);
        // Refresh state after switching
        await this.fetchAndUpdate();
      }
    } catch (error) {
      console.error('[DevWallet] Failed to switch account:', error);
    }
  }

  /**
   * Update the UI with current state
   */
  private updateUI(): void {
    // Update badge with pending request count
    const pendingCount = this.walletRequests.length;
    updateFloatingButtonBadge(this.button, pendingCount);

    // Clean up previous account switcher handlers
    if (this.accountSwitcherCleanup) {
      this.accountSwitcherCleanup();
      this.accountSwitcherCleanup = null;
    }

    // Build content HTML
    const accountSwitcherHTML = createAccountSwitcher(
      this.state?.accountIndex ?? 0,
      ANVIL_ACCOUNTS
    );

    const walletInfoHTML = createWalletInfo(this.state);

    const pendingRequestsHTML = `
      <div class="wallet-section">
        <div class="wallet-section-title">Pending Requests (${pendingCount})</div>
        ${createPendingRequests(this.walletRequests)}
      </div>
    `;

    // Update content
    this.content.innerHTML = `
      ${accountSwitcherHTML}
      ${walletInfoHTML}
      ${pendingRequestsHTML}
    `;

    // Attach handlers
    attachCopyHandlers(this.content);

    this.accountSwitcherCleanup = attachAccountSwitcherHandlers(
      this.content,
      (index) => this.switchAccount(index)
    );

    attachPendingRequestHandlers(
      this.content,
      (requestId) => this.approveRequest(requestId),
      (requestId) => this.rejectRequest(requestId),
      () => this.approveAllRequests()
    );
  }

  /**
   * Toggle the drawer open/closed
   */
  toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * Open the drawer
   */
  open(): void {
    this.isOpen = true;
    setFloatingButtonOpen(this.button, true);
    setDrawerOpen(this.drawer, this.overlay, true);

    // Apply page push effect
    document.body.style.transition = 'transform 300ms ease-out';
    document.body.style.transform = 'translateX(-320px)';

    // Start polling for state updates
    this.startPolling();

    // Fetch all data immediately
    this.fetchAndUpdate();
  }

  /**
   * Close the drawer
   */
  close(): void {
    this.isOpen = false;
    setFloatingButtonOpen(this.button, false);
    setDrawerOpen(this.drawer, this.overlay, false);

    // Remove page push effect
    document.body.style.transform = '';

    // Stop polling
    this.stopPolling();
  }

  /**
   * Start polling for state updates
   */
  private startPolling(): void {
    if (this.pollInterval) return;
    this.pollInterval = setInterval(() => {
      this.fetchAndUpdate();
    }, 2000);
  }

  /**
   * Stop polling
   */
  private stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  /**
   * Destroy the UI and clean up
   */
  destroy(): void {
    this.stopPolling();

    // Clean up account switcher handlers
    if (this.accountSwitcherCleanup) {
      this.accountSwitcherCleanup();
      this.accountSwitcherCleanup = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    // Reset body transform
    document.body.style.transform = '';
    document.body.style.transition = '';

    // Remove from DOM
    this.container.remove();

    console.log('[DevWallet] UI destroyed');
  }
}
