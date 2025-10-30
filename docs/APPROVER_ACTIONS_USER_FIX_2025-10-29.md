# ApproverActions Missing User Parameter Fix

**Date:** October 29, 2025  
**Issue:** "Return to Queue" action from PENDING_APPROVAL status failed with "Missing required arguments for status update: user"

## Problem

When an approver tried to return a PR to queue from PENDING_APPROVAL status, the action failed with:

```
pr.ts:200 updatePRStatus called with missing arguments: user

ApproverActions.tsx:174 Failed to update PR status: Error: Missing required arguments for status update: user
```

**Console Log:**
```
Updating status for PR kqC0SifTPKPX4xcCtXpL to IN_QUEUE by user System
```

The log showed `user System` which indicates the user parameter was undefined/null.

## Root Cause

**File:** `src/components/pr/ApproverActions.tsx`  
**Line:** 167

The `handleStatusUpdate` function was calling `prService.updatePRStatus()` **without passing the `user` parameter**:

```typescript
// WRONG - Missing user parameter
await prService.updatePRStatus(pr.id, newStatus, notes);
```

Even though `currentUser` was available from props, it wasn't being passed to the service call.

## The Fix

Added `currentUser` parameter to the `updatePRStatus` call:

```typescript
// CORRECT - Includes user parameter
await prService.updatePRStatus(pr.id, newStatus, notes, currentUser);
```

### Before (Line 167):
```typescript
await prService.updatePRStatus(pr.id, newStatus, notes);
```

### After (Line 167):
```typescript
await prService.updatePRStatus(pr.id, newStatus, notes, currentUser);
```

## Function Signature

The `updatePRStatus` function requires 4 parameters:

```typescript
export async function updatePRStatus(
  prId: string, 
  status: PRStatus, 
  notes?: string, 
  user?: UserReference 
): Promise<void>
```

While `user` is marked optional with `?`, the function validates it internally and throws an error if missing:

```typescript
if (!user) {
  console.error('updatePRStatus called with missing arguments: user');
  throw new Error('Missing required arguments for status update: user');
}
```

## Impact

This bug affected **ALL status changes** triggered through `ApproverActions` component, including:
- ✅ Approve (was using direct notification call, not affected)
- ❌ Reject (was affected)
- ❌ Request Revision (was affected)  
- ❌ **Return to Queue** (was affected - this is what user discovered)

## Actions Affected

### Return to Queue (PENDING_APPROVAL → IN_QUEUE)
- **Who:** Approvers, Procurement
- **When:** PR is in PENDING_APPROVAL but needs to go back to queue
- **Fix:** Now correctly passes currentUser

### Reject (PENDING_APPROVAL → REJECTED)
- **Who:** Approvers
- **When:** Approver rejects a PR
- **Fix:** Now correctly passes currentUser

### Request Revision (PENDING_APPROVAL → REVISION_REQUIRED)
- **Who:** Approvers
- **When:** Approver requests changes
- **Fix:** Now correctly passes currentUser

## Testing

To verify the fix works:

1. **Test Return to Queue:**
   - As approver, open a PR in PENDING_APPROVAL status
   - Click "Return to Queue"
   - Should succeed and show "PR status successfully updated to IN_QUEUE"
   - Check statusHistory in Firestore - should show correct user

2. **Test Reject:**
   - As approver, open a PR in PENDING_APPROVAL status
   - Click "Reject"
   - Should succeed with proper user tracking

3. **Test Request Revision:**
   - As approver, open a PR in PENDING_APPROVAL status
   - Click "Request Revision"
   - Should succeed with proper user tracking

## Files Modified

**`src/components/pr/ApproverActions.tsx`**
- Line 167: Added `currentUser` parameter to `updatePRStatus` call
- No other changes needed

## Related Issues

This is similar to issues we might find in other components that call `updatePRStatus`:
- ProcurementActions.tsx - Should be checked
- Other action components - Should be audited

## Audit Recommendation

Search codebase for other calls to `updatePRStatus` without the user parameter:

```bash
grep -r "updatePRStatus.*," src/ | grep -v "notes, currentUser\|notes, user"
```

Any calls missing the 4th parameter should be fixed.


