import { describe, it, expect, beforeEach, vi } from 'vitest';
import { connect, type WalletClient } from './client.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe('WalletClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('connect', () => {
    it('should successfully connect when server is reachable', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
          accountIndex: 0,
          chainId: 31337,
          pendingRequests: 0,
          autoApprove: false,
          balance: '10000.0',
        }),
      });

      const client = await connect('http://localhost:3001');
      expect(client).toBeDefined();
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/status',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should throw error when server is unreachable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(connect('http://localhost:3001')).rejects.toThrow('Failed to connect to wallet server');
    });

    it('should use default URL when not specified', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
          accountIndex: 0,
          chainId: 31337,
          pendingRequests: 0,
          autoApprove: false,
          balance: '10000.0',
        }),
      });

      await connect();
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/status',
        expect.any(Object)
      );
    });
  });

  describe('getStatus', () => {
    let client: WalletClient;

    beforeEach(async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
          accountIndex: 0,
          chainId: 31337,
          pendingRequests: 0,
          autoApprove: false,
          balance: '10000.0',
        }),
      });
      client = await connect('http://localhost:3001');
      vi.clearAllMocks();
    });

    it('should fetch wallet status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
          accountIndex: 0,
          chainId: 31337,
          pendingRequests: 2,
          autoApprove: false,
          balance: '9999.5',
        }),
      });

      const status = await client.getStatus();
      expect(status.address).toBe('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
      expect(status.chainId).toBe(31337);
      expect(status.pendingRequests).toBe(2);
      expect(status.autoApprove).toBe(false);
    });
  });

  describe('getPendingRequests', () => {
    let client: WalletClient;

    beforeEach(async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
          accountIndex: 0,
          chainId: 31337,
          pendingRequests: 0,
          autoApprove: false,
          balance: '10000.0',
        }),
      });
      client = await connect('http://localhost:3001');
      vi.clearAllMocks();
    });

    it('should fetch pending requests', async () => {
      const mockRequests = [
        { id: 'req_1', method: 'eth_requestAccounts', params: [], timestamp: Date.now() },
        { id: 'req_2', method: 'eth_sendTransaction', params: [{ to: '0x...', value: '0x1' }], timestamp: Date.now() },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockRequests,
      });

      const requests = await client.getPendingRequests();
      expect(requests).toHaveLength(2);
      expect(requests[0].id).toBe('req_1');
      expect(requests[1].method).toBe('eth_sendTransaction');
    });

    it('should return empty array when no pending requests', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const requests = await client.getPendingRequests();
      expect(requests).toHaveLength(0);
    });
  });

  describe('waitForRequest', () => {
    let client: WalletClient;

    beforeEach(async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
          accountIndex: 0,
          chainId: 31337,
          pendingRequests: 0,
          autoApprove: false,
          balance: '10000.0',
        }),
      });
      client = await connect('http://localhost:3001');
      vi.clearAllMocks();
    });

    it('should wait for a request with default timeout', async () => {
      const mockRequest = { id: 'req_1', method: 'eth_requestAccounts', params: [], timestamp: Date.now() };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockRequest,
      });

      const request = await client.waitForRequest();
      expect(request.id).toBe('req_1');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/wait',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ timeoutMs: 30000 }),
        })
      );
    });

    it('should wait for a request with custom timeout', async () => {
      const mockRequest = { id: 'req_1', method: 'eth_requestAccounts', params: [], timestamp: Date.now() };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockRequest,
      });

      await client.waitForRequest({ timeoutMs: 5000 });
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/wait',
        expect.objectContaining({
          body: JSON.stringify({ timeoutMs: 5000 }),
        })
      );
    });
  });

  describe('approveRequest', () => {
    let client: WalletClient;

    beforeEach(async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
          accountIndex: 0,
          chainId: 31337,
          pendingRequests: 0,
          autoApprove: false,
          balance: '10000.0',
        }),
      });
      client = await connect('http://localhost:3001');
      vi.clearAllMocks();
    });

    it('should approve a request successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          result: ['0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'],
        }),
      });

      const result = await client.approveRequest('req_1');
      expect(result).toEqual(['0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266']);
    });

    it('should throw error when approval fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: false,
          error: 'Request not found',
        }),
      });

      await expect(client.approveRequest('req_999')).rejects.toThrow('Request not found');
    });
  });

  describe('rejectRequest', () => {
    let client: WalletClient;

    beforeEach(async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
          accountIndex: 0,
          chainId: 31337,
          pendingRequests: 0,
          autoApprove: false,
          balance: '10000.0',
        }),
      });
      client = await connect('http://localhost:3001');
      vi.clearAllMocks();
    });

    it('should reject a request successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
        }),
      });

      await expect(client.rejectRequest('req_1')).resolves.not.toThrow();
    });

    it('should reject with custom reason', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
        }),
      });

      await client.rejectRequest('req_1', 'Suspicious transaction');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/reject',
        expect.objectContaining({
          body: JSON.stringify({ requestId: 'req_1', reason: 'Suspicious transaction' }),
        })
      );
    });
  });

  describe('setAutoApprove', () => {
    let client: WalletClient;

    beforeEach(async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
          accountIndex: 0,
          chainId: 31337,
          pendingRequests: 0,
          autoApprove: false,
          balance: '10000.0',
        }),
      });
      client = await connect('http://localhost:3001');
      vi.clearAllMocks();
    });

    it('should enable auto-approve', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          autoApprove: true,
        }),
      });

      await expect(client.setAutoApprove(true)).resolves.not.toThrow();
    });

    it('should disable auto-approve', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          autoApprove: false,
        }),
      });

      await expect(client.setAutoApprove(false)).resolves.not.toThrow();
    });
  });

  describe('getProviderScript', () => {
    let client: WalletClient;

    beforeEach(async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
          accountIndex: 0,
          chainId: 31337,
          pendingRequests: 0,
          autoApprove: false,
          balance: '10000.0',
        }),
      });
      client = await connect('http://localhost:3001');
      vi.clearAllMocks();
    });

    it('should fetch provider script', async () => {
      const mockScript = '(function() { /* provider code */ })();';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ script: mockScript }),
      });

      const script = await client.getProviderScript();
      expect(script).toBe(mockScript);
    });

    it('should fetch provider script with custom wsUrl', async () => {
      const mockScript = '(function() { /* provider code */ })();';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ script: mockScript }),
      });

      await client.getProviderScript('ws://localhost:9999');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/provider?wsUrl=ws%3A%2F%2Flocalhost%3A9999',
        expect.any(Object)
      );
    });
  });

  describe('approveAllPending', () => {
    let client: WalletClient;

    beforeEach(async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
          accountIndex: 0,
          chainId: 31337,
          pendingRequests: 0,
          autoApprove: false,
          balance: '10000.0',
        }),
      });
      client = await connect('http://localhost:3001');
      vi.clearAllMocks();
    });

    it('should approve all pending requests', async () => {
      // Mock getPendingRequests
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { id: 'req_1', method: 'eth_requestAccounts', params: [], timestamp: Date.now() },
          { id: 'req_2', method: 'eth_sendTransaction', params: [{}], timestamp: Date.now() },
        ],
      });

      // Mock approveRequest calls
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, result: ['0x...'] }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, result: '0x123...' }),
      });

      const result = await client.approveAllPending();
      expect(result.approved).toBe(2);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle errors in approval', async () => {
      // Mock getPendingRequests
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { id: 'req_1', method: 'eth_requestAccounts', params: [], timestamp: Date.now() },
          { id: 'req_2', method: 'eth_sendTransaction', params: [{}], timestamp: Date.now() },
        ],
      });

      // First approval succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, result: ['0x...'] }),
      });

      // Second approval fails
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: false, error: 'Insufficient funds' }),
      });

      const result = await client.approveAllPending();
      expect(result.approved).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toContain('Insufficient funds');
    });

    it('should ignore unsupported methods when ignoreUnsupported is true', async () => {
      // Mock getPendingRequests
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { id: 'req_1', method: 'eth_requestAccounts', params: [], timestamp: Date.now() },
          { id: 'req_2', method: 'wallet_requestPermissions', params: [{}], timestamp: Date.now() },
        ],
      });

      // First approval succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, result: ['0x...'] }),
      });

      // Second approval fails with unsupported method
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: false, error: 'Unsupported method: wallet_requestPermissions' }),
      });

      const result = await client.approveAllPending({ ignoreUnsupported: true });
      expect(result.approved).toBe(1);
      expect(result.errors).toHaveLength(0); // Unsupported method ignored
    });
  });

  describe('approveUntilEmpty', () => {
    let client: WalletClient;

    beforeEach(async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
          accountIndex: 0,
          chainId: 31337,
          pendingRequests: 0,
          autoApprove: false,
          balance: '10000.0',
        }),
      });
      client = await connect('http://localhost:3001');
      vi.clearAllMocks();
    });

    it('should approve all requests in multiple rounds', async () => {
      // Round 1: getPendingRequests check
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { id: 'req_1', method: 'eth_requestAccounts', params: [], timestamp: Date.now() },
          { id: 'req_2', method: 'eth_sendTransaction', params: [{}], timestamp: Date.now() },
        ],
      });

      // Round 1: approveAllPending calls getPendingRequests internally
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { id: 'req_1', method: 'eth_requestAccounts', params: [], timestamp: Date.now() },
          { id: 'req_2', method: 'eth_sendTransaction', params: [{}], timestamp: Date.now() },
        ],
      });

      // Approve req_1
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, result: ['0x...'] }),
      });

      // Approve req_2
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, result: '0x123...' }),
      });

      // Round 2: getPendingRequests check
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { id: 'req_3', method: 'personal_sign', params: ['0x...', '0x...'], timestamp: Date.now() },
        ],
      });

      // Round 2: approveAllPending calls getPendingRequests internally
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { id: 'req_3', method: 'personal_sign', params: ['0x...', '0x...'], timestamp: Date.now() },
        ],
      });

      // Approve req_3
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, result: '0xabc...' }),
      });

      // Round 3: No more requests
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const result = await client.approveUntilEmpty({ maxRounds: 5, roundDelayMs: 10 });
      expect(result.approved).toBe(3);
      expect(result.errors).toHaveLength(0);
    });

    it('should stop at max rounds', async () => {
      // Each round returns one request
      for (let i = 0; i < 3; i++) {
        // getPendingRequests check
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => [
            { id: `req_${i}`, method: 'eth_requestAccounts', params: [], timestamp: Date.now() },
          ],
        });

        // approveAllPending calls getPendingRequests internally
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => [
            { id: `req_${i}`, method: 'eth_requestAccounts', params: [], timestamp: Date.now() },
          ],
        });

        // Approve the request
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, result: ['0x...'] }),
        });
      }

      const result = await client.approveUntilEmpty({ maxRounds: 3, roundDelayMs: 10 });
      expect(result.approved).toBe(3);
    });
  });

  describe('disconnect', () => {
    let client: WalletClient;

    beforeEach(async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
          accountIndex: 0,
          chainId: 31337,
          pendingRequests: 0,
          autoApprove: false,
          balance: '10000.0',
        }),
      });
      client = await connect('http://localhost:3001');
      vi.clearAllMocks();
    });

    it('should disconnect without error', async () => {
      await expect(client.disconnect()).resolves.not.toThrow();
    });
  });
});
