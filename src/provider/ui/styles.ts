/**
 * CSS styles for the Developer Wallet UI
 * All styles are template literals to be injected into Shadow DOM
 */

export const baseStyles = `
  :host {
    --wallet-primary: #8b5cf6;
    --wallet-primary-hover: #7c3aed;
    --wallet-bg: #1a1a2e;
    --wallet-bg-secondary: #16162a;
    --wallet-text: #ffffff;
    --wallet-text-secondary: #9ca3af;
    --wallet-border: #2d2d44;
    --wallet-success: #22c55e;
    --wallet-error: #ef4444;
    --wallet-warning: #f59e0b;
    --wallet-drawer-width: 320px;
    --wallet-button-size: 48px;
    --wallet-transition: 300ms ease-out;

    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
    font-size: 14px;
    line-height: 1.5;
    color: var(--wallet-text);
  }

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
`;

export const floatingButtonStyles = `
  .wallet-floating-button {
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: var(--wallet-button-size);
    height: var(--wallet-button-size);
    border-radius: 50%;
    background: var(--wallet-primary);
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    z-index: 2147483647;
  }

  .wallet-floating-button:hover {
    transform: scale(1.05);
    box-shadow: 0 6px 16px rgba(139, 92, 246, 0.5);
  }

  .wallet-floating-button:active {
    transform: scale(0.95);
  }

  .wallet-floating-button-icon {
    width: 24px;
    height: 24px;
    fill: white;
  }

  .wallet-floating-button.open {
    background: var(--wallet-primary-hover);
  }

  .wallet-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 9px;
    background: var(--wallet-error);
    color: white;
    font-size: 11px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .wallet-badge.hidden {
    display: none;
  }
`;

export const drawerStyles = `
  .wallet-drawer-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.3);
    opacity: 0;
    visibility: hidden;
    transition: opacity var(--wallet-transition), visibility var(--wallet-transition);
    z-index: 2147483646;
  }

  .wallet-drawer-overlay.open {
    opacity: 1;
    visibility: visible;
  }

  .wallet-drawer {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: var(--wallet-drawer-width);
    background: var(--wallet-bg);
    border-left: 1px solid var(--wallet-border);
    transform: translateX(100%);
    transition: transform var(--wallet-transition);
    z-index: 2147483647;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .wallet-drawer.open {
    transform: translateX(0);
  }

  .wallet-drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    border-bottom: 1px solid var(--wallet-border);
    background: var(--wallet-bg-secondary);
  }

  .wallet-drawer-title {
    font-size: 16px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .wallet-drawer-title-icon {
    width: 20px;
    height: 20px;
  }

  .wallet-drawer-close {
    width: 32px;
    height: 32px;
    border-radius: 6px;
    border: none;
    background: transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--wallet-text-secondary);
    transition: background 0.15s ease, color 0.15s ease;
  }

  .wallet-drawer-close:hover {
    background: var(--wallet-border);
    color: var(--wallet-text);
  }

  .wallet-drawer-content {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
  }
`;

export const walletInfoStyles = `
  .wallet-status {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 16px;
    padding: 8px 12px;
    background: var(--wallet-bg-secondary);
    border-radius: 8px;
    font-size: 12px;
  }

  .wallet-status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--wallet-error);
  }

  .wallet-status-dot.connected {
    background: var(--wallet-success);
  }

  .wallet-card {
    background: var(--wallet-bg-secondary);
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 12px;
  }

  .wallet-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .wallet-card-label {
    font-size: 11px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--wallet-text-secondary);
  }

  .wallet-card-value {
    font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
    font-size: 14px;
    word-break: break-all;
  }

  .wallet-card-value.large {
    font-size: 20px;
    font-weight: 600;
  }

  .wallet-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .wallet-grid .wallet-card {
    margin-bottom: 0;
  }

  .wallet-address {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .wallet-copy-btn {
    padding: 4px 8px;
    border-radius: 4px;
    border: 1px solid var(--wallet-border);
    background: transparent;
    color: var(--wallet-text-secondary);
    font-size: 11px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .wallet-copy-btn:hover {
    background: var(--wallet-border);
    color: var(--wallet-text);
  }

  .wallet-account-badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: 4px;
    background: var(--wallet-primary);
    font-size: 11px;
    font-weight: 500;
  }

  .wallet-section-title {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--wallet-text-secondary);
    margin-bottom: 12px;
    margin-top: 20px;
  }

  .wallet-section-title:first-child {
    margin-top: 0;
  }
`;

export const accountSwitcherStyles = `
  .account-switcher-container {
    position: relative;
    margin-bottom: 16px;
  }

  .account-switcher-current {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    background: var(--wallet-bg-secondary);
    border: 1px solid var(--wallet-border);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .account-switcher-current:hover {
    background: var(--wallet-border);
    border-color: var(--wallet-primary);
  }

  .account-switcher-current-label {
    flex: 1;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--wallet-text-secondary);
  }

  .account-switcher-current-address {
    font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
    font-size: 14px;
    color: var(--wallet-text);
  }

  .account-switcher-chevron {
    color: var(--wallet-text-secondary);
    transition: transform 0.15s ease;
  }

  .account-switcher-dropdown.open + .account-switcher-current .account-switcher-chevron,
  .account-switcher-current:has(+ .account-switcher-dropdown.open) .account-switcher-chevron {
    transform: rotate(180deg);
  }

  .account-switcher-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    background: var(--wallet-bg-secondary);
    border: 1px solid var(--wallet-border);
    border-radius: 8px;
    overflow: hidden;
    max-height: 0;
    opacity: 0;
    visibility: hidden;
    transition: max-height 0.2s ease, opacity 0.15s ease, visibility 0.15s ease;
    z-index: 10;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .account-switcher-dropdown.open {
    max-height: 300px;
    opacity: 1;
    visibility: visible;
    overflow-y: auto;
  }

  .account-switcher-option {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    cursor: pointer;
    transition: background 0.15s ease;
    border-bottom: 1px solid var(--wallet-border);
  }

  .account-switcher-option:last-child {
    border-bottom: none;
  }

  .account-switcher-option:hover {
    background: var(--wallet-border);
  }

  .account-switcher-option.selected {
    background: var(--wallet-primary);
  }

  .account-switcher-option.selected:hover {
    background: var(--wallet-primary-hover);
  }

  .account-switcher-option-label {
    flex: 1;
    font-size: 12px;
    font-weight: 500;
    color: var(--wallet-text-secondary);
  }

  .account-switcher-option.selected .account-switcher-option-label {
    color: var(--wallet-text);
    font-weight: 600;
  }

  .account-switcher-option-address {
    font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
    font-size: 13px;
    color: var(--wallet-text);
  }
`;

export const pendingRequestStyles = `
  .pending-requests-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    text-align: center;
  }

  .pending-requests-empty-icon {
    font-size: 48px;
    margin-bottom: 12px;
    opacity: 0.5;
  }

  .pending-requests-empty-text {
    font-size: 14px;
    color: var(--wallet-text-secondary);
  }

  .pending-requests-approve-all {
    margin-bottom: 16px;
  }

  .pending-requests-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .pending-request-card {
    background: var(--wallet-bg-secondary);
    border-radius: 8px;
    padding: 12px;
    border: 1px solid var(--wallet-border);
  }

  .pending-request-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .pending-request-method {
    font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
    font-size: 13px;
    font-weight: 600;
    color: var(--wallet-primary);
  }

  .pending-request-time {
    font-size: 11px;
    color: var(--wallet-text-secondary);
  }

  .pending-request-params {
    margin-bottom: 12px;
    padding: 8px;
    background: var(--wallet-bg);
    border-radius: 4px;
  }

  .pending-request-param {
    font-size: 12px;
    color: var(--wallet-text-secondary);
    margin-bottom: 4px;
    word-break: break-all;
  }

  .pending-request-param:last-child {
    margin-bottom: 0;
  }

  .pending-request-param-label {
    font-weight: 600;
    color: var(--wallet-text);
    margin-right: 4px;
  }

  .pending-request-actions {
    display: flex;
    gap: 8px;
  }

  .pending-request-btn {
    flex: 1;
    padding: 8px 12px;
    border-radius: 6px;
    border: none;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .pending-request-btn-approve {
    background: var(--wallet-success);
    color: white;
  }

  .pending-request-btn-approve:hover {
    background: #16a34a;
  }

  .pending-request-btn-reject {
    background: transparent;
    border: 1px solid var(--wallet-border);
    color: var(--wallet-text-secondary);
  }

  .pending-request-btn-reject:hover {
    background: var(--wallet-error);
    color: white;
    border-color: var(--wallet-error);
  }

  .pending-request-btn-approve-all {
    width: 100%;
    padding: 10px 16px;
    background: var(--wallet-primary);
    color: white;
  }

  .pending-request-btn-approve-all:hover {
    background: var(--wallet-primary-hover);
  }
`;

/**
 * Get all styles combined
 */
export function getAllStyles(): string {
  return `
    ${baseStyles}
    ${floatingButtonStyles}
    ${drawerStyles}
    ${walletInfoStyles}
    ${accountSwitcherStyles}
    ${pendingRequestStyles}
  `;
}
