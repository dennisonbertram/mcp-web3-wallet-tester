/**
 * Tests for PendingRequests component
 */

import { describe, it, expect } from 'vitest';
import { createPendingRequests } from './PendingRequests';
import type { SerializedWalletRequest } from '../../../types';

describe('PendingRequests', () => {
  describe('Empty state', () => {
    it('should show empty state when no pending requests', () => {
      const html = createPendingRequests([]);
      expect(html).toContain('No pending requests');
    });
  });

  describe('Single request', () => {
    it('should display a single pending request with method name', () => {
      const requests: SerializedWalletRequest[] = [
        {
          id: '1',
          method: 'eth_sendTransaction',
          params: [{ to: '0x123', value: '0x1' }],
          timestamp: Date.now(),
        },
      ];
      const html = createPendingRequests(requests);
      expect(html).toContain('eth_sendTransaction');
    });

    it('should display request timestamp as relative time', () => {
      const requests: SerializedWalletRequest[] = [
        {
          id: '1',
          method: 'personal_sign',
          params: ['0x123', '0xabc'],
          timestamp: Date.now() - 5000, // 5 seconds ago
        },
      ];
      const html = createPendingRequests(requests);
      expect(html).toContain('5s ago');
    });

    it('should display approve and reject buttons', () => {
      const requests: SerializedWalletRequest[] = [
        {
          id: '1',
          method: 'eth_sendTransaction',
          params: [],
          timestamp: Date.now(),
        },
      ];
      const html = createPendingRequests(requests);
      expect(html).toContain('Approve');
      expect(html).toContain('Reject');
      expect(html).toContain('data-request-id="1"');
    });

    it('should display formatted transaction parameters for eth_sendTransaction', () => {
      const requests: SerializedWalletRequest[] = [
        {
          id: '1',
          method: 'eth_sendTransaction',
          params: [
            {
              to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1',
              value: '0x1bc16d674ec80000', // 2 ETH
              data: '0xa9059cbb',
            },
          ],
          timestamp: Date.now(),
        },
      ];
      const html = createPendingRequests(requests);
      expect(html).toContain('0x742d...bEb1');
      expect(html).toContain('2 ETH');
    });

    it('should display formatted message for personal_sign', () => {
      const requests: SerializedWalletRequest[] = [
        {
          id: '1',
          method: 'personal_sign',
          params: ['0x48656c6c6f20576f726c64', '0xabc'],
          timestamp: Date.now(),
        },
      ];
      const html = createPendingRequests(requests);
      expect(html).toContain('Hello World');
    });
  });

  describe('Multiple requests', () => {
    it('should display all pending requests', () => {
      const requests: SerializedWalletRequest[] = [
        {
          id: '1',
          method: 'eth_sendTransaction',
          params: [],
          timestamp: Date.now(),
        },
        {
          id: '2',
          method: 'personal_sign',
          params: ['0x123', '0xabc'],
          timestamp: Date.now() - 3000,
        },
      ];
      const html = createPendingRequests(requests);
      expect(html).toContain('eth_sendTransaction');
      expect(html).toContain('personal_sign');
      expect(html).toContain('data-request-id="1"');
      expect(html).toContain('data-request-id="2"');
    });

    it('should show approve all button when multiple requests', () => {
      const requests: SerializedWalletRequest[] = [
        {
          id: '1',
          method: 'eth_sendTransaction',
          params: [],
          timestamp: Date.now(),
        },
        {
          id: '2',
          method: 'personal_sign',
          params: ['0x123', '0xabc'],
          timestamp: Date.now(),
        },
      ];
      const html = createPendingRequests(requests);
      expect(html).toContain('Approve All');
    });

    it('should not show approve all button when single request', () => {
      const requests: SerializedWalletRequest[] = [
        {
          id: '1',
          method: 'eth_sendTransaction',
          params: [],
          timestamp: Date.now(),
        },
      ];
      const html = createPendingRequests(requests);
      expect(html).not.toContain('Approve All');
    });
  });

  describe('Timestamp formatting', () => {
    it('should format seconds correctly', () => {
      const requests: SerializedWalletRequest[] = [
        {
          id: '1',
          method: 'personal_sign',
          params: [],
          timestamp: Date.now() - 30000, // 30 seconds ago
        },
      ];
      const html = createPendingRequests(requests);
      expect(html).toContain('30s ago');
    });

    it('should format minutes correctly', () => {
      const requests: SerializedWalletRequest[] = [
        {
          id: '1',
          method: 'personal_sign',
          params: [],
          timestamp: Date.now() - 120000, // 2 minutes ago
        },
      ];
      const html = createPendingRequests(requests);
      expect(html).toContain('2m ago');
    });

    it('should format hours correctly', () => {
      const requests: SerializedWalletRequest[] = [
        {
          id: '1',
          method: 'personal_sign',
          params: [],
          timestamp: Date.now() - 7200000, // 2 hours ago
        },
      ];
      const html = createPendingRequests(requests);
      expect(html).toContain('2h ago');
    });

    it('should format days correctly', () => {
      const requests: SerializedWalletRequest[] = [
        {
          id: '1',
          method: 'personal_sign',
          params: [],
          timestamp: Date.now() - 172800000, // 2 days ago
        },
      ];
      const html = createPendingRequests(requests);
      expect(html).toContain('2d ago');
    });

    it('should show "just now" for very recent requests', () => {
      const requests: SerializedWalletRequest[] = [
        {
          id: '1',
          method: 'personal_sign',
          params: [],
          timestamp: Date.now() - 500, // 0.5 seconds ago
        },
      ];
      const html = createPendingRequests(requests);
      expect(html).toContain('just now');
    });
  });

  describe('Request type formatting', () => {
    it('should handle eth_signTypedData_v4', () => {
      const requests: SerializedWalletRequest[] = [
        {
          id: '1',
          method: 'eth_signTypedData_v4',
          params: ['0xabc', '{"types":{}}'],
          timestamp: Date.now(),
        },
      ];
      const html = createPendingRequests(requests);
      expect(html).toContain('eth_signTypedData_v4');
      expect(html).toContain('Typed data');
    });

    it('should handle unknown request methods gracefully', () => {
      const requests: SerializedWalletRequest[] = [
        {
          id: '1',
          method: 'wallet_addEthereumChain',
          params: [{ chainId: '0x1' }],
          timestamp: Date.now(),
        },
      ];
      const html = createPendingRequests(requests);
      expect(html).toContain('wallet_addEthereumChain');
    });
  });
});
