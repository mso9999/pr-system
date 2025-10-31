# Critical Fix: Approval Status Not Updating to APPROVED

**Date:** October 31, 2025  
**Issue:** PRs stayed in `PENDING_APPROVAL` status even after approvals completed  
**Impact:** HIGH - Broke the entire approval workflow  
**Status:** ✅ FIXED

## Problem Description

When approvers completed their approvals (both single and dual approval scenarios), the PR status remained `PENDING_APPROVAL` instead of transitioning to `APPROVED`. The `objectType` also failed to change from `PR` to `PO`.

### Affected Scenarios

1. **Dual Approval with Matching Quotes**: When both approvers selected the same quote
2. **Single Approval**: When only one approver was required
3. **Quote Conflict Resolution**: When approvers resolved a quote conflict (fixed separately)

### User Impact

- PRs appeared to be stuck in `PENDING_APPROVAL` even though both approvers had approved
- No visual indication that approval was complete
- Object type did not convert from PR to PO
- Status history was not being recorded for approval actions

## Root Cause Analysis

### The Core Issue

The `updatePR()` function in `src/services/pr.ts` has an intentional design feature (lines 277-280):

```typescript
// Remove status if present (should use updatePRStatus for status updates)
if ('status' in updateData) {
  delete (updateData as any).status;
}
```

This is by design - all status changes must go through `updatePRStatus()` to ensure proper status history tracking and consistency.

### The Bug

All approval code paths in `ApproverActions.tsx` were using `updatePR()` with `status` in the payload:

```typescript
await prService.updatePR(pr.id, {
  status: newStatus,  // ← Gets silently stripped out!
  objectType: 'PO',
  approvalWorkflow: updatedWorkflow
});
```

Because the `status` field was being removed, the PR never actually transitioned to `APPROVED`.

### Affected Code Paths

1. **Dual Approval - No Conflict** (lines 538-560)
   ```typescript
   // No conflict - move to APPROVED
   await prService.updatePR(pr.id, {
     status: newStatus,  // ← Stripped out
     objectType: 'PO',
     approvalWorkflow: updatedWorkflow
   });
   ```

2. **Single Approval** (lines 589-631)
   ```typescript
   // Single approval - move directly to APPROVED
   await prService.updatePR(pr.id, {
     status: newStatus,  // ← Stripped out
     objectType: 'PO',
     approvalWorkflow: {...}
   });
   ```

3. **Quote Conflict Resolution** (lines 338-377)
   - Already fixed in commit `d4b71ed`

## Solution

Split each approval path into two separate operations:

### Step 1: Update PR Data
Use `updatePR()` for everything except status:
```typescript
await prService.updatePR(pr.id, {
  objectType: 'PO',
  approvalWorkflow: updatedWorkflow,
  updatedAt: new Date().toISOString()
});
```

### Step 2: Update Status
Use `updatePRStatus()` for the status change:
```typescript
await prService.updatePRStatus(
  pr.id,
  PRStatus.APPROVED,
  approverNotes,
  currentUser
);
```

This ensures:
- ✅ Status is properly updated
- ✅ Object type changes to PO
- ✅ Status history is recorded
- ✅ Audit trail is maintained

## Changes Made

### File: `src/components/pr/ApproverActions.tsx`

**1. Dual Approval - No Conflict (lines 538-567)**
```typescript
// BEFORE
await prService.updatePR(pr.id, {
  status: newStatus,
  objectType: 'PO',
  approvalWorkflow: updatedWorkflow,
  updatedAt: new Date().toISOString()
});

// AFTER
await prService.updatePR(pr.id, {
  objectType: 'PO',
  approvalWorkflow: updatedWorkflow,
  updatedAt: new Date().toISOString()
});

await prService.updatePRStatus(
  pr.id,
  newStatus,
  notes.trim() || 'Both approvers approved',
  currentUser
);
```

**2. Single Approval (lines 589-640)**
```typescript
// BEFORE
await prService.updatePR(pr.id, {
  status: newStatus,
  objectType: 'PO',
  approvalWorkflow: {...},
  updatedAt: new Date().toISOString()
});

// AFTER
await prService.updatePR(pr.id, {
  objectType: 'PO',
  approvalWorkflow: {...},
  updatedAt: new Date().toISOString()
});

await prService.updatePRStatus(
  pr.id,
  newStatus,
  approverNotes,
  currentUser
);
```

**3. Quote Conflict Resolution (lines 338-377)**
- Already fixed in previous commit `d4b71ed`

## Testing

### Test Case 1: Single Approval
**Steps:**
1. Create PR requiring single approval
2. Approver clicks "Approve"
3. Submit

**Expected Result:**
- ✅ PR status changes to `APPROVED`
- ✅ Object type changes to `PO`
- ✅ Status history records the approval
- ✅ User redirected to dashboard

### Test Case 2: Dual Approval - Matching Quotes
**Steps:**
1. Create PR requiring dual approval (amount > Rule 3)
2. First approver approves quote A
3. Second approver approves quote A (same quote)

**Expected Result:**
- ✅ PR status changes to `APPROVED`
- ✅ Object type changes to `PO`
- ✅ Status history records both approvals
- ✅ No conflict detected
- ✅ Success notification shown

### Test Case 3: Quote Conflict Resolution
**Steps:**
1. Both approvers initially select different quotes
2. Conflict detected and red-flagged
3. One approver changes selection to match the other
4. Submit

**Expected Result:**
- ✅ PR status changes to `APPROVED`
- ✅ Object type changes to `PO`
- ✅ `quoteConflict` flag set to false
- ✅ Status history records the resolution

## Related Commits

- **d4b71ed**: fix: status not updating when quote conflict resolved
- **6bd4767**: fix: dual and single approval not transitioning to APPROVED status (this fix)

## Lessons Learned

1. **Respect API Contracts**: The `updatePR()` function has a clear contract - it doesn't handle status updates. This must be respected throughout the codebase.

2. **Comprehensive Testing**: A fix in one code path (conflict resolution) doesn't mean other similar code paths are correct. All approval scenarios must be tested.

3. **Logging is Critical**: The console logs showing "Updating PR with data: {status: 'APPROVED'}" followed by successful update, but no actual status change, was the key clue.

4. **Silent Failures Are Dangerous**: The status field being silently removed without error made this bug hard to detect. Consider adding warnings when attempting to set status via updatePR().

## Recommendations

### Code Improvement
Consider adding a console warning in `updatePR()`:
```typescript
if ('status' in updateData) {
  console.warn('⚠️ Attempted to update status via updatePR(). Use updatePRStatus() instead.');
  delete (updateData as any).status;
}
```

### Testing
Add integration tests for all approval scenarios:
- Single approval
- Dual approval with matching quotes
- Dual approval with conflicting quotes
- Quote conflict resolution

### Documentation
Update the `prService` documentation to clearly state:
- `updatePR()`: For all PR field updates EXCEPT status
- `updatePRStatus()`: For ALL status changes (required for history tracking)

## Resolution

**Status:** ✅ RESOLVED  
**Verification:** Tested all three approval scenarios successfully  
**Deployment:** Committed to main branch

