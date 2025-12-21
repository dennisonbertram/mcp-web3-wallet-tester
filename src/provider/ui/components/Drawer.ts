/**
 * Drawer component for the Developer Wallet UI
 */

export interface DrawerOptions {
  onClose: () => void;
}

/**
 * Close icon SVG
 */
const closeIconSvg = `
<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
</svg>
`;

/**
 * Wallet title icon SVG
 */
const titleIconSvg = `
<svg class="wallet-drawer-title-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M19 7H5C3.9 7 3 7.9 3 9V18C3 19.1 3.9 20 5 20H19C20.1 20 21 19.1 21 18V9C21 7.9 20.1 7 19 7Z" fill="#8b5cf6"/>
  <path d="M18 4H6C5.45 4 5 4.45 5 5V7H19V5C19 4.45 18.55 4 18 4Z" fill="#8b5cf6" opacity="0.5"/>
  <circle cx="16" cy="13" r="1.5" fill="white"/>
</svg>
`;

/**
 * Create the drawer element
 */
export function createDrawer(options: DrawerOptions): { drawer: HTMLDivElement; overlay: HTMLDivElement; content: HTMLDivElement } {
  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'wallet-drawer-overlay';
  overlay.addEventListener('click', options.onClose);

  // Create drawer container
  const drawer = document.createElement('div');
  drawer.className = 'wallet-drawer';

  // Create header
  const header = document.createElement('div');
  header.className = 'wallet-drawer-header';
  header.innerHTML = `
    <div class="wallet-drawer-title">
      ${titleIconSvg}
      <span>Dev Wallet</span>
    </div>
  `;

  // Create close button
  const closeBtn = document.createElement('button');
  closeBtn.className = 'wallet-drawer-close';
  closeBtn.setAttribute('aria-label', 'Close drawer');
  closeBtn.innerHTML = closeIconSvg;
  closeBtn.addEventListener('click', options.onClose);
  header.appendChild(closeBtn);

  // Create content container
  const content = document.createElement('div');
  content.className = 'wallet-drawer-content';

  drawer.appendChild(header);
  drawer.appendChild(content);

  return { drawer, overlay, content };
}

/**
 * Set the open state of the drawer
 */
export function setDrawerOpen(drawer: HTMLDivElement, overlay: HTMLDivElement, isOpen: boolean): void {
  drawer.classList.toggle('open', isOpen);
  overlay.classList.toggle('open', isOpen);
}
