import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAccountSwitcher, attachAccountSwitcherHandlers } from './AccountSwitcher';

describe('createAccountSwitcher', () => {
  const testAccounts = [
    { index: 0, address: '0x1234567890123456789012345678901234567890' },
    { index: 1, address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' },
    { index: 2, address: '0x9876543210987654321098765432109876543210' },
  ];

  it('returns a string', () => {
    const result = createAccountSwitcher(0, testAccounts);
    expect(typeof result).toBe('string');
  });

  it('contains current account display element', () => {
    const result = createAccountSwitcher(0, testAccounts);
    expect(result).toContain('account-switcher-current');
  });

  it('contains dropdown container', () => {
    const result = createAccountSwitcher(0, testAccounts);
    expect(result).toContain('account-switcher-dropdown');
  });

  it('shows current account index', () => {
    const result = createAccountSwitcher(1, testAccounts);
    expect(result).toContain('Account 1');
  });

  it('shows truncated current address', () => {
    const result = createAccountSwitcher(0, testAccounts);
    expect(result).toContain('0x1234...7890');
  });

  it('dropdown contains all accounts', () => {
    const result = createAccountSwitcher(0, testAccounts);
    expect(result).toContain('Account 0');
    expect(result).toContain('Account 1');
    expect(result).toContain('Account 2');
  });

  it('each option has data-index attribute', () => {
    const result = createAccountSwitcher(0, testAccounts);
    expect(result).toContain('data-index="0"');
    expect(result).toContain('data-index="1"');
    expect(result).toContain('data-index="2"');
  });

  it('current account option has selected class', () => {
    const result = createAccountSwitcher(1, testAccounts);
    const parser = new DOMParser();
    const doc = parser.parseFromString(result, 'text/html');
    const options = doc.querySelectorAll('[data-index]');
    const selectedOption = Array.from(options).find(
      (opt) => opt.getAttribute('data-index') === '1'
    );
    expect(selectedOption?.classList.contains('selected')).toBe(true);
  });

  it('handles empty accounts array', () => {
    const result = createAccountSwitcher(0, []);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('handles invalid currentIndex < 0', () => {
    const result = createAccountSwitcher(-1, testAccounts);
    expect(result).toContain('Account 0');
  });

  it('handles invalid currentIndex >= length', () => {
    const result = createAccountSwitcher(10, testAccounts);
    expect(result).toContain('Account 0');
  });
});

describe('attachAccountSwitcherHandlers', () => {
  let container: HTMLElement;
  const testAccounts = [
    { index: 0, address: '0x1234567890123456789012345678901234567890' },
    { index: 1, address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' },
    { index: 2, address: '0x9876543210987654321098765432109876543210' },
  ];

  beforeEach(() => {
    container = document.createElement('div');
    const html = createAccountSwitcher(0, testAccounts);
    container.innerHTML = html;
  });

  it('clicking current account opens dropdown', () => {
    const onSwitch = vi.fn();
    attachAccountSwitcherHandlers(container, onSwitch);

    const current = container.querySelector('.account-switcher-current') as HTMLElement;
    const dropdown = container.querySelector('.account-switcher-dropdown') as HTMLElement;

    current.click();
    expect(dropdown.classList.contains('open')).toBe(true);
  });

  it('clicking current account again closes dropdown', () => {
    const onSwitch = vi.fn();
    attachAccountSwitcherHandlers(container, onSwitch);

    const current = container.querySelector('.account-switcher-current') as HTMLElement;
    const dropdown = container.querySelector('.account-switcher-dropdown') as HTMLElement;

    current.click();
    expect(dropdown.classList.contains('open')).toBe(true);

    current.click();
    expect(dropdown.classList.contains('open')).toBe(false);
  });

  it('clicking account option calls onSwitch callback', () => {
    const onSwitch = vi.fn();
    attachAccountSwitcherHandlers(container, onSwitch);

    const option = container.querySelector('[data-index="1"]') as HTMLElement;
    option.click();

    expect(onSwitch).toHaveBeenCalledWith(1);
  });

  it('clicking account option closes dropdown', () => {
    const onSwitch = vi.fn();
    attachAccountSwitcherHandlers(container, onSwitch);

    const current = container.querySelector('.account-switcher-current') as HTMLElement;
    const dropdown = container.querySelector('.account-switcher-dropdown') as HTMLElement;
    const option = container.querySelector('[data-index="1"]') as HTMLElement;

    current.click();
    expect(dropdown.classList.contains('open')).toBe(true);

    option.click();
    expect(dropdown.classList.contains('open')).toBe(false);
  });

  it('clicking outside closes dropdown', () => {
    const onSwitch = vi.fn();
    attachAccountSwitcherHandlers(container, onSwitch);

    const current = container.querySelector('.account-switcher-current') as HTMLElement;
    const dropdown = container.querySelector('.account-switcher-dropdown') as HTMLElement;

    current.click();
    expect(dropdown.classList.contains('open')).toBe(true);

    // Click outside
    document.body.click();
    expect(dropdown.classList.contains('open')).toBe(false);
  });

  it('clicking inside dropdown does not close it', () => {
    const onSwitch = vi.fn();
    attachAccountSwitcherHandlers(container, onSwitch);

    const current = container.querySelector('.account-switcher-current') as HTMLElement;
    const dropdown = container.querySelector('.account-switcher-dropdown') as HTMLElement;

    current.click();
    expect(dropdown.classList.contains('open')).toBe(true);

    dropdown.click();
    expect(dropdown.classList.contains('open')).toBe(true);
  });

  it('returns cleanup function that removes listeners', () => {
    const onSwitch = vi.fn();
    const cleanup = attachAccountSwitcherHandlers(container, onSwitch);

    expect(typeof cleanup).toBe('function');

    const current = container.querySelector('.account-switcher-current') as HTMLElement;
    cleanup();

    // After cleanup, clicking should not toggle
    current.click();
    const dropdown = container.querySelector('.account-switcher-dropdown') as HTMLElement;
    expect(dropdown.classList.contains('open')).toBe(false);
  });
});
