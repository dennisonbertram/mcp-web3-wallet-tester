# WebSocket Bridge UI Actions Enhancement Plan

## Overview
Extend the WebSocket bridge at `/Users/dennisonbertram/conductor/workspaces/mcp-web3-wallet-tester/bucharest-v4/src/ws-bridge.ts` to handle additional UI actions for the Developer Wallet UI beyond the currently supported `getState` action.

## Current State Analysis

### Files to Modify
1. `/Users/dennisonbertram/conductor/workspaces/mcp-web3-wallet-tester/bucharest-v4/src/types.ts` - Type definitions
2. `/Users/dennisonbertram/conductor/workspaces/mcp-web3-wallet-tester/bucharest-v4/src/ws-bridge.ts` - WebSocket bridge implementation

### Current Implementation
- **ws-bridge.ts**:
  - Contains `handleUIRequest()` method (lines 169-217)
  - Currently only handles `action === 'getState'`
  - Returns wallet state including address, balance, nonce, etc.
  - Uses `queue.getWallet()` to access wallet instance
  - Has access to both `queue: RequestQueue` and wallet via queue

- **types.ts**:
  - `UIRequest` interface (lines 64-68) currently only supports `action: 'getState'`
  - No params field defined
  - `UIResponse` interface (lines 73-81) returns `WalletUIState` for successful getState

- **queue.ts** (dependencies):
  - `approveRequest(id: string): Promise<unknown>` - line 72
  - `rejectRequest(id: string, reason?: string): void` - line 93
  - `getPendingRequests(): SerializedWalletRequest[]` - line 58
  - `getWallet(): Wallet` - line 157

- **wallet.ts** (dependencies):
  - `switchAccount(accountIndex: number): void` - line 54
  - Validates accountIndex is 0-9
  - Returns void, updates internal state
  - `getAddress()` method returns new address after switch

## Proposed Changes

### 1. Update UIRequest Type Definition
**File**: `/Users/dennisonbertram/conductor/workspaces/mcp-web3-wallet-tester/bucharest-v4/src/types.ts`

**Current** (lines 64-68):
```typescript
export interface UIRequest {
  type: 'ui_request';
  id: string;
  action: 'getState';
}
```

**Updated**:
```typescript
export interface UIRequest {
  type: 'ui_request';
  id: string;
  action: 'getState' | 'approveRequest' | 'rejectRequest' | 'switchAccount' | 'getPendingRequests';
  params?: {
    requestId?: string;
    reason?: string;
    accountIndex?: number;
  };
}
```

**Changes**:
- Extend `action` union type with 4 new actions
- Add optional `params` object with fields for each action

### 2. Update UIResponse Result Type
**File**: `/Users/dennisonbertram/conductor/workspaces/mcp-web3-wallet-tester/bucharest-v4/src/types.ts`

**Current** (lines 73-81):
```typescript
export interface UIResponse {
  type: 'ui_response';
  id: string;
  result?: WalletUIState;
  error?: {
    code: number;
    message: string;
  };
}
```

**Updated**:
```typescript
export interface UIResponse {
  type: 'ui_response';
  id: string;
  result?: WalletUIState | {
    success: boolean;
    result?: unknown;
    address?: string;
    requests?: SerializedWalletRequest[];
  };
  error?: {
    code: number;
    message: string;
  };
}
```

**Changes**:
- Expand `result` type to accommodate different response shapes
- Keep backward compatible with `WalletUIState` for getState
- Add generic success response shape for approve/reject/switch actions
- Add requests array for getPendingRequests

### 3. Extend handleUIRequest Method
**File**: `/Users/dennisonbertram/conductor/workspaces/mcp-web3-wallet-tester/bucharest-v4/src/ws-bridge.ts`

**Current Structure** (lines 169-217):
- Only handles `action === 'getState'`
- Throws error for unknown actions

**New Structure**:
Add handling for 4 new actions inside the try block:

#### Action: approveRequest
```typescript
else if (action === 'approveRequest') {
  const { requestId } = request.params ?? {};
  if (!requestId) {
    throw new Error('requestId is required for approveRequest');
  }

  const result = await this.queue.approveRequest(requestId);
  const response: UIResponse = {
    type: 'ui_response',
    id,
    result: { success: true, result },
  };
  ws.send(JSON.stringify(response));
}
```

**Logic**:
- Extract `requestId` from params
- Validate requestId exists
- Call `queue.approveRequest(requestId)` - returns Promise
- Await result from approval
- Return success response with result

**Error Handling**:
- If requestId missing: throw error (caught by outer try/catch)
- If request not found: queue.approveRequest throws (caught by outer try/catch)
- If processing fails: queue.approveRequest throws (caught by outer try/catch)

#### Action: rejectRequest
```typescript
else if (action === 'rejectRequest') {
  const { requestId, reason } = request.params ?? {};
  if (!requestId) {
    throw new Error('requestId is required for rejectRequest');
  }

  this.queue.rejectRequest(requestId, reason);
  const response: UIResponse = {
    type: 'ui_response',
    id,
    result: { success: true },
  };
  ws.send(JSON.stringify(response));
}
```

**Logic**:
- Extract `requestId` and optional `reason` from params
- Validate requestId exists
- Call `queue.rejectRequest(requestId, reason)` - returns void
- Return success response

**Error Handling**:
- If requestId missing: throw error (caught by outer try/catch)
- If request not found: queue.rejectRequest throws (caught by outer try/catch)

#### Action: switchAccount
```typescript
else if (action === 'switchAccount') {
  const { accountIndex } = request.params ?? {};
  if (accountIndex === undefined) {
    throw new Error('accountIndex is required for switchAccount');
  }

  const wallet = this.queue.getWallet();
  wallet.switchAccount(accountIndex);
  const newAddress = wallet.getAddress();

  const response: UIResponse = {
    type: 'ui_response',
    id,
    result: { success: true, address: newAddress },
  };
  ws.send(JSON.stringify(response));
}
```

**Logic**:
- Extract `accountIndex` from params
- Validate accountIndex exists (use `=== undefined` to allow 0)
- Get wallet from queue
- Call `wallet.switchAccount(accountIndex)` - returns void
- Get new address with `wallet.getAddress()`
- Return success response with new address

**Error Handling**:
- If accountIndex missing: throw error (caught by outer try/catch)
- If accountIndex out of range (not 0-9): wallet.switchAccount throws (caught by outer try/catch)

#### Action: getPendingRequests
```typescript
else if (action === 'getPendingRequests') {
  const requests = this.queue.getPendingRequests();
  const response: UIResponse = {
    type: 'ui_response',
    id,
    result: { requests },
  };
  ws.send(JSON.stringify(response));
}
```

**Logic**:
- No params needed
- Call `queue.getPendingRequests()` - returns `SerializedWalletRequest[]`
- Return success response with requests array

**Error Handling**:
- Method shouldn't fail under normal circumstances
- Any errors caught by outer try/catch

### 4. Preserve Existing Error Handling
The existing try/catch block (lines 172-216) already handles:
- Catching all errors
- Creating UIResponse with error object
- Sending error response via WebSocket

This error handling will automatically cover all new actions.

## Implementation Steps

1. **Edit types.ts**:
   - Modify UIRequest interface to add new actions to union type
   - Add params field with optional properties
   - Update UIResponse result type to be a union

2. **Edit ws-bridge.ts**:
   - Add approveRequest action handler after getState block
   - Add rejectRequest action handler
   - Add switchAccount action handler
   - Add getPendingRequests action handler
   - Keep existing error handling (no changes needed)

## Testing Considerations

### Test Cases to Verify
1. **approveRequest**:
   - Valid requestId → returns success with result
   - Missing requestId → returns error
   - Invalid requestId → returns error
   - Request processing fails → returns error

2. **rejectRequest**:
   - Valid requestId without reason → returns success
   - Valid requestId with reason → returns success
   - Missing requestId → returns error
   - Invalid requestId → returns error

3. **switchAccount**:
   - Valid accountIndex (0-9) → returns success with new address
   - accountIndex = 0 → returns success (edge case for undefined check)
   - Missing accountIndex → returns error
   - Invalid accountIndex (<0 or >9) → returns error

4. **getPendingRequests**:
   - Empty queue → returns empty array
   - Queue with requests → returns array of SerializedWalletRequest

5. **Backward Compatibility**:
   - getState still works as before
   - Unknown action still throws error

## Risk Assessment

### Low Risk
- All changes are additive (no breaking changes)
- Existing getState handler unchanged
- Error handling pattern already established
- Type safety enforced by TypeScript

### Validation Required
- Ensure accountIndex validation works for 0 (falsy value)
- Verify approveRequest properly awaits async result
- Confirm rejectRequest doesn't need to await (returns void)

## Dependencies

### Internal
- `RequestQueue.approveRequest()` - async, may throw
- `RequestQueue.rejectRequest()` - sync, may throw
- `RequestQueue.getPendingRequests()` - sync, safe
- `Wallet.switchAccount()` - sync, may throw
- `Wallet.getAddress()` - sync, safe

### External
- WebSocket message sending (already established)
- JSON serialization (already established)

## Success Criteria

1. All 4 new actions properly handled
2. Type definitions accurately reflect new capabilities
3. Error handling consistent with existing pattern
4. No breaking changes to existing getState functionality
5. TypeScript compilation succeeds with no errors
6. Response shapes match specifications from requirements
