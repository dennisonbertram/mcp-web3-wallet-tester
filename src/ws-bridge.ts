import { WebSocketServer, WebSocket } from 'ws';
import type { ProviderRequest, ProviderResponse } from './types.js';
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
        const message = JSON.parse(data.toString()) as ProviderRequest;
        await this.handleRequest(ws, message);
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
   * Broadcast a message to all connected clients
   */
  broadcast(message: Record<string, unknown>): void {
    const data = JSON.stringify(message);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }
}
