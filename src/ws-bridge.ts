import { WebSocketServer, WebSocket } from 'ws';
import type { ProviderRequest, ProviderResponse, UIRequest, UIResponse, WalletUIState, UINotification } from './types.js';
import { isUIRequest } from './types.js';
import type { RequestQueue } from './queue.js';

/**
 * WebSocket bridge that connects browser provider to the request queue
 */
export class WebSocketBridge {
  private wss: WebSocketServer | null = null;
  private queue: RequestQueue;
  private port: number;
  private clients: Set<WebSocket> = new Set();

  constructor(queue: RequestQueue, port: number) {
    this.queue = queue;
    this.port = port;
  }

  /**
   * Start the WebSocket server
   */
  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.wss = new WebSocketServer({ port: this.port });

      // Set up subscription callback to broadcast notifications
      this.queue.setSubscriptionCallback((subscriptionId, result) => {
        this.broadcastSubscription(subscriptionId, result);
      });

      this.wss.on('listening', () => {
        console.log(`WebSocket bridge listening on ws://localhost:${this.port}`);
        resolve();
      });

      this.wss.on('error', (error) => {
        console.error('WebSocket server error:', error);
        reject(error);
      });

      this.wss.on('connection', (ws) => {
        this.handleConnection(ws);
      });
    });
  }

  /**
   * Stop the WebSocket server
   */
  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.wss) {
        // Close all client connections
        for (const client of this.clients) {
          client.close();
        }
        this.clients.clear();

        this.wss.close(() => {
          console.log('WebSocket bridge stopped');
          this.wss = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Get the number of connected clients
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Handle a new WebSocket connection
   */
  private handleConnection(ws: WebSocket): void {
    console.log('Browser provider connected');
    this.clients.add(ws);

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());

        // Check if this is a UI request
        if (isUIRequest(message)) {
          await this.handleUIRequest(ws, message);
          return;
        }

        // Otherwise handle as provider request
        await this.handleRequest(ws, message as ProviderRequest);
      } catch (error) {
        console.error('Error handling message:', error);
        const errorResponse: ProviderResponse = {
          type: 'response',
          id: 'unknown',
          error: {
            code: -32600,
            message: 'Invalid request',
          },
        };
        ws.send(JSON.stringify(errorResponse));
      }
    });

    ws.on('close', () => {
      console.log('Browser provider disconnected');
      this.clients.delete(ws);
    });

    ws.on('error', (error) => {
      console.error('WebSocket client error:', error);
      this.clients.delete(ws);
    });
  }

  /**
   * Handle a request from the browser provider
   */
  private async handleRequest(ws: WebSocket, request: ProviderRequest): Promise<void> {
    const { id, method, params } = request;

    // Some methods don't need approval (read-only)
    const noApprovalMethods = [
      'eth_chainId',
      'net_version',
      'eth_blockNumber',
      'eth_gasPrice',
      'eth_getBalance',
      'eth_getTransactionCount',
      'eth_getTransactionReceipt',
      'eth_estimateGas',
    ];

    try {
      let result: unknown;

      if (noApprovalMethods.includes(method)) {
        // Process immediately without queueing
        result = await this.queue.addRequest(method, params);
      } else {
        // Queue the request and wait for approval
        console.log(`Queueing request: ${method}`);

        // Send notification to UI that a new request needs approval
        const notification: UINotification = {
          type: 'ui_notification',
          event: 'newPendingRequest',
          data: {
            method,
            pendingCount: this.queue.getPendingCount() + 1, // +1 since we're about to add it
          },
        };
        this.broadcast(notification);

        result = await this.queue.addRequest(method, params);
      }

      const response: ProviderResponse = {
        type: 'response',
        id,
        result,
      };
      ws.send(JSON.stringify(response));
    } catch (error) {
      const errorResponse: ProviderResponse = {
        type: 'response',
        id,
        error: {
          code: (error as { code?: number }).code ?? -32603,
          message: error instanceof Error ? error.message : 'Internal error',
        },
      };
      ws.send(JSON.stringify(errorResponse));
    }
  }

  /**
   * Handle a UI request from the Developer Wallet UI
   */
  private async handleUIRequest(ws: WebSocket, request: UIRequest): Promise<void> {
    const { id, action, params } = request;

    try {
      if (action === 'getState') {
        const wallet = this.queue.getWallet();
        const address = wallet.getAddress();

        // Gather wallet state
        const [balance, blockNumber, gasPrice, nonce] = await Promise.all([
          wallet.getBalance(address),
          wallet.getBlockNumber(),
          wallet.getGasPrice(),
          wallet.getTransactionCount(address),
        ]);

        const state: WalletUIState = {
          address,
          accountIndex: wallet.getAccountIndex(),
          balance,
          nonce,
          chainId: wallet.getChainId(),
          blockNumber: Number(blockNumber),
          gasPrice: gasPrice.toString(),
          pendingCount: this.queue.getPendingCount(),
          connected: true,
        };

        const response: UIResponse = {
          type: 'ui_response',
          id,
          result: state,
        };
        ws.send(JSON.stringify(response));
      } else if (action === 'approveRequest') {
        if (!params?.requestId) {
          throw new Error('requestId is required for approveRequest');
        }
        const result = await this.queue.approveRequest(params.requestId);
        const response: UIResponse = {
          type: 'ui_response',
          id,
          result: { success: true, result },
        };
        ws.send(JSON.stringify(response));

        // Notify all clients that a request was resolved
        const notification: UINotification = {
          type: 'ui_notification',
          event: 'requestResolved',
          data: {
            requestId: params.requestId,
            pendingCount: this.queue.getPendingCount(),
          },
        };
        this.broadcast(notification);
      } else if (action === 'rejectRequest') {
        if (!params?.requestId) {
          throw new Error('requestId is required for rejectRequest');
        }
        this.queue.rejectRequest(params.requestId, params.reason);
        const response: UIResponse = {
          type: 'ui_response',
          id,
          result: { success: true },
        };
        ws.send(JSON.stringify(response));

        // Notify all clients that a request was resolved
        const notification: UINotification = {
          type: 'ui_notification',
          event: 'requestResolved',
          data: {
            requestId: params.requestId,
            pendingCount: this.queue.getPendingCount(),
          },
        };
        this.broadcast(notification);
      } else if (action === 'switchAccount') {
        if (params?.accountIndex === undefined) {
          throw new Error('accountIndex is required for switchAccount');
        }
        const wallet = this.queue.getWallet();
        wallet.switchAccount(params.accountIndex);
        const address = wallet.getAddress();
        const response: UIResponse = {
          type: 'ui_response',
          id,
          result: { success: true, address },
        };
        ws.send(JSON.stringify(response));
      } else if (action === 'getPendingRequests') {
        const requests = this.queue.getPendingRequests();
        const response: UIResponse = {
          type: 'ui_response',
          id,
          result: { requests },
        };
        ws.send(JSON.stringify(response));
      } else {
        throw new Error(`Unknown UI action: ${action}`);
      }
    } catch (error) {
      const errorResponse: UIResponse = {
        type: 'ui_response',
        id,
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Internal error',
        },
      };
      ws.send(JSON.stringify(errorResponse));
    }
  }

  /**
   * Broadcast a message to all connected clients
   */
  broadcast(message: Record<string, unknown> | UINotification): void {
    const data = JSON.stringify(message);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  /**
   * Broadcast a subscription notification to all connected clients
   */
  private broadcastSubscription(subscriptionId: string, result: unknown): void {
    const notification = {
      type: 'subscription',
      subscriptionId,
      result,
    };
    this.broadcast(notification);
  }
}
