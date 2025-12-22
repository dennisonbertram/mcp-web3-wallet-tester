/**
 * Types for the Developer Wallet UI
 */

/**
 * Wallet state exposed to the UI
 */
export interface WalletUIState {
  address: string;
  accountIndex: number;
  balance: string;
  nonce: number;
  chainId: number;
  blockNumber: number;
  gasPrice: string;
  pendingCount: number;
  connected: boolean;
}

/**
 * Serialized wallet request for UI display
 */
export interface SerializedWalletRequest {
  id: string;
  method: string;
  params: unknown[];
  timestamp: number;
}

/**
 * UI request sent from browser to server
 */
export interface UIRequest {
  type: 'ui_request';
  id: string;
  action: 'getState' | 'approveRequest' | 'rejectRequest' | 'switchAccount' | 'getPendingRequests' | 'setChainId';
  params?: {
    requestId?: string;
    reason?: string;
    accountIndex?: number;
    chainId?: number;
  };
}

/**
 * UI response sent from server to browser
 */
export interface UIResponse {
  type: 'ui_response';
  id: string;
  result?: WalletUIState | ActionResult | PendingRequestsResult;
  error?: {
    code: number;
    message: string;
  };
}

/**
 * Result from approve/reject/switch actions
 */
export interface ActionResult {
  success: boolean;
  result?: unknown;
  address?: string;
}

/**
 * Result from getPendingRequests action
 */
export interface PendingRequestsResult {
  requests: SerializedWalletRequest[];
}

/**
 * Type guard for UI requests
 */
export function isUIRequest(message: unknown): message is UIRequest {
  return (
    typeof message === 'object' &&
    message !== null &&
    (message as UIRequest).type === 'ui_request'
  );
}

/**
 * Type guard for UI responses
 */
export function isUIResponse(message: unknown): message is UIResponse {
  return (
    typeof message === 'object' &&
    message !== null &&
    (message as UIResponse).type === 'ui_response'
  );
}

/**
 * UI notification sent from server to browser (push notifications)
 */
export interface UINotification {
  type: 'ui_notification';
  event: 'newPendingRequest' | 'requestResolved';
  data?: {
    requestId?: string;
    method?: string;
    pendingCount?: number;
  };
}

/**
 * Type guard for UI notifications
 */
export function isUINotification(message: unknown): message is UINotification {
  return (
    typeof message === 'object' &&
    message !== null &&
    (message as UINotification).type === 'ui_notification'
  );
}
