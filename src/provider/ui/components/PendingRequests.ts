/**
 * PendingRequests component for the Developer Wallet UI
 */

import type { SerializedWalletRequest } from '../../../types';

/**
 * Truncate an Ethereum address for display
 */
function truncateAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Format timestamp as relative time
 */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffSeconds = Math.floor(diffMs / 1000);

  if (diffSeconds < 1) return 'just now';
  if (diffSeconds < 60) return `${diffSeconds}s ago`;

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

/**
 * Format wei value to ETH
 */
function formatEthValue(weiHex: string): string {
  try {
    const wei = BigInt(weiHex);
    const eth = Number(wei) / 1e18;
    return `${eth} ETH`;
  } catch {
    return weiHex;
  }
}

/**
 * Decode hex string to UTF-8
 */
function decodeHexString(hex: string): string {
  try {
    const cleaned = hex.startsWith('0x') ? hex.slice(2) : hex;
    const bytes = new Uint8Array(cleaned.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) ?? []);
    return new TextDecoder().decode(bytes);
  } catch {
    return hex;
  }
}

/**
 * Format request parameters based on method type
 */
function formatRequestParams(method: string, params: unknown[]): string {
  if (!params || params.length === 0) {
    return '<div class="pending-request-param">No parameters</div>';
  }

  if (method === 'eth_sendTransaction' && params[0]) {
    const tx = params[0] as Record<string, unknown>;
    return `
      ${tx.to ? `<div class="pending-request-param"><span class="pending-request-param-label">To:</span> ${truncateAddress(tx.to as string)}</div>` : ''}
      ${tx.value ? `<div class="pending-request-param"><span class="pending-request-param-label">Value:</span> ${formatEthValue(tx.value as string)}</div>` : ''}
      ${tx.data && tx.data !== '0x' ? `<div class="pending-request-param"><span class="pending-request-param-label">Data:</span> ${truncateAddress(tx.data as string)}</div>` : ''}
    `;
  }

  if (method === 'personal_sign' && params[0]) {
    const message = decodeHexString(params[0] as string);
    return `<div class="pending-request-param"><span class="pending-request-param-label">Message:</span> ${message}</div>`;
  }

  if (method === 'eth_signTypedData_v4') {
    return `<div class="pending-request-param"><span class="pending-request-param-label">Typed data</span></div>`;
  }

  // Default formatting for other methods
  return `<div class="pending-request-param">${JSON.stringify(params).slice(0, 100)}${JSON.stringify(params).length > 100 ? '...' : ''}</div>`;
}

/**
 * Create the pending requests content
 */
export function createPendingRequests(requests: SerializedWalletRequest[]): string {
  if (requests.length === 0) {
    return `
      <div class="pending-requests-empty">
        <div class="pending-requests-empty-icon">📭</div>
        <div class="pending-requests-empty-text">No pending requests</div>
      </div>
    `;
  }

  const requestCards = requests.map(request => `
    <div class="pending-request-card">
      <div class="pending-request-header">
        <div class="pending-request-method">${request.method}</div>
        <div class="pending-request-time">${formatRelativeTime(request.timestamp)}</div>
      </div>
      <div class="pending-request-params">
        ${formatRequestParams(request.method, request.params)}
      </div>
      <div class="pending-request-actions">
        <button class="pending-request-btn pending-request-btn-reject" data-request-id="${request.id}" data-action="reject">
          Reject
        </button>
        <button class="pending-request-btn pending-request-btn-approve" data-request-id="${request.id}" data-action="approve">
          Approve
        </button>
      </div>
    </div>
  `).join('');

  const approveAllButton = requests.length > 1 ? `
    <div class="pending-requests-approve-all">
      <button class="pending-request-btn pending-request-btn-approve-all" data-action="approve-all">
        Approve All
      </button>
    </div>
  ` : '';

  return `
    ${approveAllButton}
    <div class="pending-requests-list">
      ${requestCards}
    </div>
  `;
}

/**
 * Attach event handlers for pending requests
 */
export function attachPendingRequestHandlers(
  container: HTMLElement,
  onApprove: (_requestId: string) => void,
  onReject: (_requestId: string) => void,
  onApproveAll: () => void
): void {
  // Handle approve/reject buttons
  const buttons = container.querySelectorAll('.pending-request-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const button = e.target as HTMLButtonElement;
      const action = button.getAttribute('data-action');
      const requestId = button.getAttribute('data-request-id');

      if (action === 'approve' && requestId) {
        onApprove(requestId);
      } else if (action === 'reject' && requestId) {
        onReject(requestId);
      } else if (action === 'approve-all') {
        onApproveAll();
      }
    });
  });
}
