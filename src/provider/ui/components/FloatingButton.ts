/**
 * Floating button component for the Developer Wallet UI
 */

export interface FloatingButtonOptions {
  onClick: () => void;
  pendingCount?: number;
}

/**
 * Wallet icon SVG
 */
const walletIconSvg = `
<svg class="wallet-floating-button-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M21 7H3C2.45 7 2 7.45 2 8V19C2 19.55 2.45 20 3 20H21C21.55 20 22 19.55 22 19V8C22 7.45 21.55 7 21 7Z" fill="currentColor"/>
  <path d="M20 4H4C3.45 4 3 4.45 3 5V7H21V5C21 4.45 20.55 4 20 4Z" fill="currentColor" opacity="0.5"/>
  <circle cx="17" cy="13.5" r="1.5" fill="white"/>
</svg>
`;

/**
 * Create the floating button element
 */
export function createFloatingButton(options: FloatingButtonOptions): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = 'wallet-floating-button';
  button.setAttribute('aria-label', 'Open Developer Wallet');
  button.title = 'Developer Wallet';

  button.innerHTML = `
    ${walletIconSvg}
    <span class="wallet-badge ${options.pendingCount ? '' : 'hidden'}">${options.pendingCount || 0}</span>
  `;

  button.addEventListener('click', options.onClick);

  return button;
}

/**
 * Update the pending count badge
 */
export function updateFloatingButtonBadge(button: HTMLButtonElement, count: number): void {
  const badge = button.querySelector('.wallet-badge');
  if (badge) {
    badge.textContent = String(count);
    badge.classList.toggle('hidden', count === 0);
  }
}

/**
 * Set the open state of the button
 */
export function setFloatingButtonOpen(button: HTMLButtonElement, isOpen: boolean): void {
  button.classList.toggle('open', isOpen);
}
