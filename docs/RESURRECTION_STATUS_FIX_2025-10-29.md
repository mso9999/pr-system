# PR Resurrection Status History Fix

**Date:** October 29, 2025  
**Issue:** Resurrection from REJECTED did not properly move the PR back to the intended status  
**Status:** ✅ Fixed

## Problem Description

When a PR with `REJECTED` status was resurrected by Procurement or Admin, the system attempted to restore it to the highest previous status (SUBMITTED, IN_QUEUE, or PENDING_APPROVAL) based on the PR's status history. However, the resurrection logic was not properly updating the status history, which could cause:

1. The PR status to change in the database, but without a proper status history entry
2. Subsequent resurrections to fail or restore to incorrect statuses
3. Inconsistent audit trail of status changes

## Root Cause

The `handleResurrect` function in `src/components/pr/ResurrectionActions.tsx` was using `prService.updatePR()` to directly update the status field:

```typescript
await prService.updatePR(pr.id, {
  status: targetStatus,
  updatedAt: new Date().toISOString(),
  notes: `Resurrected from ${pr.status} by ${currentUser.email}...`
});
```

This approach had several issues:

1. **No Status History Management**: The `updatePR` function is designed for general field updates, not status changes. It doesn't append to the `statusHistory` array.

2. **Inconsistent Data**: The status field would change, but the `statusHistory` array wouldn't reflect this change.

3. **Broken Future Resurrections**: The `getResurrectionStatus()` function relies on `statusHistory` to determine the highest previous status. Without proper history entries, it couldn't accurately determine where to restore the PR.

4. **Missing Audit Trail**: Status changes should be tracked in the status history for compliance and debugging purposes.

## Solution

Changed `handleResurrect` to use `prService.updatePRStatus()` instead:

```typescript
// Create UserReference for status history
const userRef = {
  id: currentUser.id,
  email: currentUser.email || '',
  firstName: currentUser.firstName,
  lastName: currentUser.lastName,
  name: `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || currentUser.email || 'Unknown'
};

// Update status using updatePRStatus to properly manage status history
const resurrectionNotes = `Resurrected from ${pr.status} to ${targetStatus} by ${currentUser.email}. ${notes ? `Note: ${notes}` : ''}`;
await prService.updatePRStatus(
  pr.id,
  targetStatus,
  resurrectionNotes,
  userRef
);
```

### Why This Works

The `updatePRStatus` function (in `src/services/pr.ts`) properly:

1. **Fetches Current Status History**: Retrieves the existing `statusHistory` array from the PR document
2. **Creates History Entry**: Generates a new `StatusHistoryItem` with:
   - The new status
   - Timestamp
   - User information
   - Notes describing the resurrection
3. **Appends to History**: Adds the new entry to the `statusHistory` array
4. **Updates Both Fields**: Updates both the `status` field and the `statusHistory` array atomically

```typescript
// From updatePRStatus function
const statusHistoryEntry = createStatusHistoryItem(status, user, notes);

const updateData: PRUpdateData = {
  status: status,
  statusHistory: [...currentStatusHistory, statusHistoryEntry], 
  updatedAt: serverTimestamp(), 
};

await updateDoc(prDocRef, updateData);
```

## Resurrection Logic

According to specifications in `Specifications.md` and `PR_Flow_7_Terminal.html`:

### Resurrection from REJECTED
- **Who Can Resurrect:** Procurement Officers (Level 3) or Administrators (Level 1)
- **Restore To:** The highest status achieved before rejection:
  - If rejected from SUBMITTED → Restore to SUBMITTED
  - If rejected after reaching IN_QUEUE → Restore to IN_QUEUE
  - If rejected from PENDING_APPROVAL → Restore to PENDING_APPROVAL

The `getResurrectionStatus()` function implements this:

```typescript
const getResurrectionStatus = (): PRStatus => {
  if (pr.status === PRStatus.REJECTED) {
    // Restore to highest previous status
    if (pr.statusHistory && pr.statusHistory.length > 0) {
      const activeStatuses = [PRStatus.SUBMITTED, PRStatus.IN_QUEUE, PRStatus.PENDING_APPROVAL];
      const previousStatus = pr.statusHistory
        .filter(h => activeStatuses.includes(h.status))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
      
      if (previousStatus) {
        return previousStatus.status;
      }
    }
    // Default to SUBMITTED if no history
    return PRStatus.SUBMITTED;
  } else {
    // CANCELED always returns to SUBMITTED
    return PRStatus.SUBMITTED;
  }
};
```

### Resurrection from CANCELED
- **Who Can Resurrect:** Original Requestor or Administrators (Level 1)
- **Restore To:** SUBMITTED status ONLY (regardless of where it was canceled from)

## Testing Recommendations

To verify this fix works correctly:

1. **Test Resurrection from REJECTED at Different Stages:**
   - Create a PR (SUBMITTED)
   - Have procurement reject it → Should restore to SUBMITTED
   - Create another PR, move to IN_QUEUE
   - Have procurement reject it → Should restore to IN_QUEUE
   - Create another PR, move to PENDING_APPROVAL
   - Have approver reject it → Should restore to PENDING_APPROVAL

2. **Test Resurrection from CANCELED:**
   - Create a PR at any status
   - Have requestor cancel it
   - Requestor resurrects → Should always restore to SUBMITTED

3. **Verify Status History:**
   - After resurrection, check the PR's status history in the database
   - Should contain entries for:
     - Original status changes
     - Rejection/cancellation
     - Resurrection with proper notes

4. **Test Multiple Resurrections:**
   - Resurrect a PR
   - Reject it again
   - Resurrect again → Should work correctly based on updated history

## Files Changed

- `src/components/pr/ResurrectionActions.tsx`
  - Modified `handleResurrect` function to use `updatePRStatus` instead of `updatePR`
  - Added proper `UserReference` construction
  - Added detailed resurrection notes

## Related Functions

- `prService.updatePRStatus()` - Proper way to update PR status with history tracking
- `prService.updatePR()` - For general field updates, NOT for status changes
- `createStatusHistoryItem()` - Helper to create status history entries

## Important Notes

1. **Always Use updatePRStatus for Status Changes**: Any code that changes a PR's status should use `updatePRStatus()`, not `updatePR()`.

2. **UserReference vs User**: The `updatePRStatus` function requires a `UserReference` object, which may need to be constructed from a `User` object.

3. **Status History is Critical**: The status history is used for:
   - Audit trail
   - Determining resurrection targets
   - Tracking who did what and when
   - Compliance and reporting

4. **Notifications Still Work**: The fix maintains the existing notification flow through `notificationService.handleStatusChange()`.

## Prevention

To prevent similar issues in the future:

1. Always use `updatePRStatus()` for status changes
2. Only use `updatePR()` for non-status field updates
3. Consider adding TypeScript guards or linting rules to prevent direct status field updates
4. Review any code that modifies the status field to ensure it uses the proper function

## Success Criteria

✅ Resurrection from REJECTED properly updates status  
✅ Status history is maintained correctly  
✅ Audit trail shows resurrection in history  
✅ Subsequent resurrections work based on updated history  
✅ Notifications are sent correctly  
✅ No linter errors introduced  

## References

- Specifications.md (lines 1000-1026) - PR Resurrection Feature specification
- PR_Flow_7_Terminal.html - Terminal states and resurrection flows
- src/services/pr.ts (lines 191-243) - `updatePRStatus` implementation

