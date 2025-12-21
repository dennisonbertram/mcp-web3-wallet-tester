/**
 * Account switcher component for the Developer Wallet UI
 */

interface Account {
  index: number;
  address: string;
}

/**
 * Truncate an Ethereum address for display
 */
function truncateAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Create an account option HTML
 */
function createAccountOption(account: Account, isSelected: boolean): string {
  const selectedClass = isSelected ? ' selected' : '';
  return `
    <div class="account-switcher-option${selectedClass}" data-index="${account.index}">
      <span class="account-switcher-option-label">Account ${account.index}</span>
      <span class="account-switcher-option-address">${truncateAddress(account.address)}</span>
    </div>
  `;
}

/**
 * Create the account switcher HTML
 */
export function createAccountSwitcher(
  currentIndex: number,
  accounts: Account[]
): string {
  // Validate and clamp currentIndex
  const validIndex = accounts.length > 0
    ? Math.max(0, Math.min(currentIndex, accounts.length - 1))
    : 0;

  // Get current account
  const currentAccount = accounts[validIndex] || { index: 0, address: '0x0000000000000000000000000000000000000000' };

  // Generate dropdown options
  const options = accounts.map((account) =>
    createAccountOption(account, account.index === validIndex)
  ).join('');

  return `
    <div class="account-switcher-container">
      <div class="account-switcher-current">
        <div class="account-switcher-current-label">Account ${currentAccount.index}</div>
        <div class="account-switcher-current-address">${truncateAddress(currentAccount.address)}</div>
        <svg class="account-switcher-chevron" width="12" height="12" viewBox="0 0 12 12">
          <path d="M2 4l4 4 4-4" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </div>
      <div class="account-switcher-dropdown">
        ${options}
      </div>
    </div>
  `;
}

/**
 * Attach account switcher event handlers
 */
export function attachAccountSwitcherHandlers(
  container: HTMLElement,
  onSwitch: (index: number) => void
): () => void {
  const current = container.querySelector('.account-switcher-current') as HTMLElement;
  const dropdown = container.querySelector('.account-switcher-dropdown') as HTMLElement;

  if (!current || !dropdown) {
    return () => {};
  }

  // Toggle dropdown when clicking current account
  const toggleDropdown = (e: Event): void => {
    e.stopPropagation();
    dropdown.classList.toggle('open');
  };

  // Handle account option clicks
  const handleOptionClick = (e: Event): void => {
    const target = e.target as HTMLElement;
    const option = target.closest('[data-index]') as HTMLElement;

    if (option) {
      const index = parseInt(option.getAttribute('data-index') || '0', 10);
      onSwitch(index);
      dropdown.classList.remove('open');
    }
  };

  // Close dropdown when clicking outside
  const handleOutsideClick = (e: Event): void => {
    if (!container.contains(e.target as Node)) {
      dropdown.classList.remove('open');
    }
  };

  // Prevent dropdown from closing when clicking inside it
  const preventClose = (e: Event): void => {
    e.stopPropagation();
  };

  // Attach event listeners
  current.addEventListener('click', toggleDropdown);
  dropdown.addEventListener('click', handleOptionClick);
  dropdown.addEventListener('click', preventClose);
  document.addEventListener('click', handleOutsideClick);

  // Return cleanup function
  return () => {
    current.removeEventListener('click', toggleDropdown);
    dropdown.removeEventListener('click', handleOptionClick);
    dropdown.removeEventListener('click', preventClose);
    document.removeEventListener('click', handleOutsideClick);
  };
}
