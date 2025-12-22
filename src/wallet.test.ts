import { describe, it, expect, beforeEach } from 'vitest';
import { Wallet } from './wallet.js';
import type { WalletServerConfig } from './types.js';
import { ANVIL_ACCOUNTS } from './types.js';

describe('Wallet', () => {
  const defaultConfig: WalletServerConfig = {
    mcpPort: 3001,
    wsPort: 8546,
    anvilRpcUrl: 'http://127.0.0.1:8545',
    privateKey: ANVIL_ACCOUNTS[0].privateKey,
    chainId: 31337,
    accountIndex: 0,
  };

  describe('setChainId', () => {
    let wallet: Wallet;

    beforeEach(() => {
      wallet = new Wallet(defaultConfig);
    });

    it('should update the chain ID', () => {
      // Initial chain ID should be from config
      expect(wallet.getChainId()).toBe(31337);

      // Set new chain ID
      wallet.setChainId(1);

      // Chain ID should be updated
      expect(wallet.getChainId()).toBe(1);
    });

    it('should update the chain ID to mainnet (1)', () => {
      wallet.setChainId(1);
      expect(wallet.getChainId()).toBe(1);
    });

    it('should update the chain ID to sepolia (11155111)', () => {
      wallet.setChainId(11155111);
      expect(wallet.getChainId()).toBe(11155111);
    });

    it('should update the chain ID back to anvil default', () => {
      wallet.setChainId(1);
      expect(wallet.getChainId()).toBe(1);

      wallet.setChainId(31337);
      expect(wallet.getChainId()).toBe(31337);
    });

    it('should preserve the wallet address after chain ID change', () => {
      const addressBefore = wallet.getAddress();
      wallet.setChainId(1);
      const addressAfter = wallet.getAddress();

      expect(addressAfter).toBe(addressBefore);
    });

    it('should throw error for invalid chain ID (0)', () => {
      expect(() => wallet.setChainId(0)).toThrow('Chain ID must be a positive integer');
    });

    it('should throw error for negative chain ID', () => {
      expect(() => wallet.setChainId(-1)).toThrow('Chain ID must be a positive integer');
    });

    it('should throw error for non-integer chain ID', () => {
      expect(() => wallet.setChainId(1.5)).toThrow('Chain ID must be a positive integer');
    });
  });
});
