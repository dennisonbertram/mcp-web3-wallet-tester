/**
 * Wallet info component for the Developer Wallet UI
 */

import type { WalletUIState } from '../types';

/**
 * Truncate an Ethereum address for display
 */
function truncateAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Format balance to reasonable decimal places
 */
function formatBalance(balance: string): string {
  const num = parseFloat(balance);
  if (isNaN(num)) return balance;
  if (num === 0) return '0';
  if (num < 0.0001) return '< 0.0001';
  if (num >= 1000) return num.toFixed(2);
  return num.toFixed(4);
}

/**
 * Format gas price from wei to gwei
 */
function formatGasPrice(gasPrice: string): string {
  const gwei = parseFloat(gasPrice) / 1e9;
  if (isNaN(gwei)) return gasPrice;
  return `${gwei.toFixed(2)} gwei`;
}

/**
 * Create the wallet info content
 */
export function createWalletInfo(state: WalletUIState | null): string {
  if (!state) {
    return `
      <div class="wallet-status">
        <span class="wallet-status-dot"></span>
        <span>Connecting...</span>
      </div>
    `;
  }

  return `
    <div class="wallet-status">
      <span class="wallet-status-dot ${state.connected ? 'connected' : ''}"></span>
      <span>${state.connected ? 'Connected' : 'Disconnected'}</span>
    </div>

    <div class="wallet-section-title">Account</div>

    <div class="wallet-card">
      <div class="wallet-card-header">
        <span class="wallet-card-label">Address</span>
        <span class="wallet-account-badge">Account ${state.accountIndex}</span>
      </div>
      <div class="wallet-address">
        <span class="wallet-card-value">${truncateAddress(state.address)}</span>
        <button class="wallet-copy-btn" data-copy="${state.address}">Copy</button>
      </div>
    </div>

    <div class="wallet-card">
      <div class="wallet-card-label">Balance</div>
      <div class="wallet-card-value large">${formatBalance(state.balance)} ETH</div>
    </div>

    <div class="wallet-section-title">Technical Info</div>

    <div class="wallet-grid">
      <div class="wallet-card">
        <div class="wallet-card-label">Nonce</div>
        <div class="wallet-card-value">${state.nonce}</div>
      </div>
      <div class="wallet-card">
        <div class="wallet-card-label">Chain ID</div>
        <div class="wallet-card-value">${state.chainId}</div>
      </div>
      <div class="wallet-card">
        <div class="wallet-card-label">Block</div>
        <div class="wallet-card-value">${state.blockNumber.toLocaleString()}</div>
      </div>
      <div class="wallet-card">
        <div class="wallet-card-label">Gas Price</div>
        <div class="wallet-card-value">${formatGasPrice(state.gasPrice)}</div>
      </div>
    </div>

    ${state.pendingCount > 0 ? `
      <div class="wallet-section-title">Pending Requests</div>
      <div class="wallet-card">
        <div class="wallet-card-value">${state.pendingCount} request${state.pendingCount === 1 ? '' : 's'} waiting for approval</div>
      </div>
    ` : ''}
  `;
}

/**
 * Attach copy button handlers
 */
export function attachCopyHandlers(container: HTMLElement): void {
  const copyButtons = container.querySelectorAll('.wallet-copy-btn');
  copyButtons.forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const button = e.target as HTMLButtonElement;
      const text = button.getAttribute('data-copy');
      if (text) {
        try {
          await navigator.clipboard.writeText(text);
          const originalText = button.textContent;
          button.textContent = 'Copied!';
          setTimeout(() => {
            button.textContent = originalText;
          }, 1000);
        } catch {
          console.error('[DevWallet] Failed to copy to clipboard');
        }
      }
    });
  });
}
