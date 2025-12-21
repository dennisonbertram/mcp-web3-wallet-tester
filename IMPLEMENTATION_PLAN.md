# PendingRequests Component Implementation Plan

## Overview
Implement a PendingRequests component for the Developer Wallet UI following strict TDD principles (Red-Green-Refactor).

## Context Analysis

### Existing Architecture
- **Testing Framework**: Vitest (configured in package.json)
- **No existing tests**: No test files found in `src/` directory
- **Type System**: TypeScript with `SerializedWalletRequest` already defined in `src/types.ts`
- **UI Structure**: Shadow DOM components in `src/provider/ui/components/`
- **Styling**: CSS-in-JS using template literals with CSS variables
- **Pattern**: HTML string generation + event handler attachment (see `WalletInfo.ts`)

### Key Types Already Defined
```typescript
// From src/types.ts
interface SerializedWalletRequest {
  id: string;
  method: string;
  params: unknown[];
  timestamp: number;
}
```

### Request Methods to Support (from queue.ts)
- `eth_sendTransaction` - Send transaction
- `personal_sign` - Sign message
- `eth_sign` - Sign message (alternative)
- `eth_signTypedData_v4` - Sign typed data
- `eth_requestAccounts` - Request accounts
- Other methods (less common for UI approval)

## Implementation Plan

### Phase 1: Setup Test Infrastructure
**File**: Create `src/provider/ui/components/PendingRequests.test.ts`

**Actions**:
1. Create basic test file structure
2. Set up test utilities (DOM mocking if needed)
3. Verify test framework works

### Phase 2: TDD Implementation (Red-Green-Refactor)

#### Iteration 1: Type Definitions
**🔴 RED**: Test that `PendingRequestsState` type exists
**🟢 GREEN**: Add type to `src/provider/ui/types.ts`
**🔵 REFACTOR**: N/A (simple type addition)

#### Iteration 2: Empty State Rendering
**🔴 RED**: Test `createPendingRequestsContent([])` returns empty state message
**🟢 GREEN**: Implement function returning basic HTML
**🔵 REFACTOR**: Extract constants, clean up HTML structure

#### Iteration 3: Single Request Rendering
**🔴 RED**: Test rendering a single `eth_sendTransaction` request
- Should show method name
- Should show timestamp (relative format)
- Should show "Approve" and "Reject" buttons
- Should show transaction details (to, value, data)
**🟢 GREEN**: Implement basic request card rendering
**🔵 REFACTOR**: Extract helper functions (formatTimestamp, formatParams, etc.)

#### Iteration 4: Multiple Requests Rendering
**🔴 RED**: Test rendering multiple requests shows all cards
**🟢 GREEN**: Map over requests array
**🔵 REFACTOR**: DRY up card generation

#### Iteration 5: Approve All Button
**🔴 RED**: Test that "Approve All" button appears when multiple requests
**🟢 GREEN**: Conditional rendering for approve all button
**🔵 REFACTOR**: Extract button rendering logic

#### Iteration 6: Request Type Formatting
**🔴 RED**: Test different request types format correctly:
- `eth_sendTransaction`: to, value (ETH), data (truncated)
- `personal_sign`: message (truncated)
- `eth_signTypedData_v4`: "Typed Data" label
**🟢 GREEN**: Implement type-specific formatters
**🔵 REFACTOR**: Extract formatters to separate functions

#### Iteration 7: Timestamp Formatting
**🔴 RED**: Test timestamp shows relative time ("2s ago", "5m ago", "2h ago")
**🟢 GREEN**: Implement `formatRelativeTime` function
**🔵 REFACTOR**: Edge cases (just now, days ago)

#### Iteration 8: Event Handler Attachment
**🔴 RED**: Test `attachPendingRequestHandlers` attaches click handlers
- Test approve button calls `onApprove` with correct ID
- Test reject button calls `onReject` with correct ID
- Test approve all calls `onApproveAll`
**🟢 GREEN**: Implement event delegation
**🔵 REFACTOR**: Clean up event handler logic

#### Iteration 9: Styles
**🔴 RED**: Test styles export exists and contains required classes
**🟢 GREEN**: Add `pendingRequestStyles` to `src/provider/ui/styles.ts`
**🔵 REFACTOR**: Ensure consistent with existing style patterns

### Phase 3: Integration
1. Export functions from `PendingRequests.ts`
2. Update `styles.ts` to include new styles in `getAllStyles()`
3. Verify all tests pass

### Phase 4: Quality Gate
**Before marking complete:**
```bash
npm run lint        # Must pass
npm run type-check  # Must pass
npm run build       # Must pass
npm run test        # Must pass
```

## Files to Create/Modify

### New Files
- `src/provider/ui/components/PendingRequests.ts` - Component implementation
- `src/provider/ui/components/PendingRequests.test.ts` - Tests (created first!)

### Modified Files
- `src/provider/ui/types.ts` - Add `PendingRequestsState` interface
- `src/provider/ui/styles.ts` - Add `pendingRequestStyles` export

## Component API

### Exports from PendingRequests.ts
```typescript
// Create HTML content
export function createPendingRequestsContent(
  requests: SerializedWalletRequest[]
): string;

// Attach event handlers
export function attachPendingRequestHandlers(
  container: HTMLElement,
  onApprove: (id: string) => void,
  onReject: (id: string) => void,
  onApproveAll: () => void
): void;

// Helper functions (for testing and reuse)
export function formatRelativeTime(timestamp: number): string;
export function formatRequestParams(
  method: string,
  params: unknown[]
): string;
```

## TDD Workflow

For each iteration:
1. **Write test first** - Specify expected behavior
2. **Run test** - Confirm it fails (RED)
3. **Write minimal code** - Make test pass (GREEN)
4. **Run test** - Confirm it passes
5. **Refactor** - Improve code quality
6. **Run test** - Ensure refactor didn't break anything
7. **Commit** - Clean checkpoint

## Style Requirements

### CSS Classes to Add
```css
.wallet-requests-empty       /* Empty state container */
.wallet-request-card         /* Individual request card */
.wallet-request-header       /* Request header with method/time */
.wallet-request-method       /* Method name badge */
.wallet-request-time         /* Relative timestamp */
.wallet-request-params       /* Parameters display */
.wallet-request-actions      /* Button container */
.wallet-request-btn          /* Base button style */
.wallet-request-btn-approve  /* Approve button */
.wallet-request-btn-reject   /* Reject button */
.wallet-request-btn-all      /* Approve all button */
```

### CSS Variables (already available)
- `--wallet-primary` - Primary color
- `--wallet-bg-secondary` - Card background
- `--wallet-text` - Text color
- `--wallet-text-secondary` - Secondary text
- `--wallet-success` - Success/approve color
- `--wallet-error` - Error/reject color
- `--wallet-border` - Border color

## Parameter Formatting Examples

### eth_sendTransaction
```
To: 0xABC...DEF
Value: 1.5 ETH
Data: 0xa9059cbb... (truncate to ~20 chars)
```

### personal_sign
```
Message: "Sign this message..." (truncate to ~50 chars)
```

### eth_signTypedData_v4
```
Type: Typed Data Signature
```

## Success Criteria

- [ ] All tests pass
- [ ] Component renders empty state correctly
- [ ] Component renders single request correctly
- [ ] Component renders multiple requests correctly
- [ ] Approve All button appears only with multiple requests
- [ ] Request parameters formatted correctly by type
- [ ] Timestamps show relative time
- [ ] Event handlers call correct callbacks with correct IDs
- [ ] Styles follow existing patterns
- [ ] TypeScript strict mode passes
- [ ] Linter passes
- [ ] Build succeeds

## Next Steps After Completion

1. Integrate into `DevWalletUI.ts`
2. Connect to actual request queue
3. Manual testing with browser UI
4. Document usage in README

---

## TDD Reminders

**NEVER write production code without a failing test first!**

Each feature follows: 🔴 RED → 🟢 GREEN → 🔵 REFACTOR

Test names should describe behavior:
- ✅ "should show empty message when no requests"
- ❌ "testEmptyState"
