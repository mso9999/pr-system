# REVISION_REQUIRED Status Workflow Fix

**Date:** October 29, 2025  
**Issue:** Illogical action buttons for procurement when PR is in REVISION_REQUIRED status

## Problem Statement

When a PR was in REVISION_REQUIRED (R&R) status, procurement had the following action buttons:
1. **"Revise & Resubmit"** - Makes no sense since it's already in that status
2. **"Push to Approver"** - Shouldn't be allowed directly from R&R

This created a confusing workflow where procurement could bypass the revision process.

## Correct Business Logic

When a PR is in REVISION_REQUIRED status:

### What Should Happen:
- **Either:** The PR legitimately needs changes from the requestor → Wait for requestor to resubmit
- **Or:** The revision request was incorrect → Procurement can revert to previous status
- **Or:** The PR should not proceed → Procurement can reject it

### What Should NOT Happen:
- Push directly to approver (bypasses the revision process)
- Request another revision (already in revision status)

## The Fix

### 1. Updated UI (`src/components/pr/ProcurementActions.tsx`)

**Before:**
```typescript
// REVISION_REQUIRED status showed:
- "Push to Approver" button
- "Revise & Resubmit" button
```

**After:**
```typescript
// REVISION_REQUIRED status now shows:
- "Revert to Previous Status" button
- "Reject PR" button
```

### 2. New "Revert" Action Logic

The system now:
1. Examines the PR's `statusHistory` array
2. Sorts it chronologically (most recent first)
3. Retrieves the status from index 1 (previous status before REVISION_REQUIRED)
4. Validates it's a legitimate status (not REVISION_REQUIRED itself)
5. Moves the PR back to that status

**Valid Previous Statuses:**
- SUBMITTED
- RESUBMITTED
- IN_QUEUE
- PENDING_APPROVAL

**Code Implementation:**
```typescript
case 'revert':
  // Get the previous status from statusHistory
  if (!pr.statusHistory || pr.statusHistory.length < 2) {
    setError('Cannot determine previous status. Status history is insufficient.');
    return;
  }
  
  const sortedHistory = [...pr.statusHistory].sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  
  const previousStatus = sortedHistory[1]?.status;
  
  if (!previousStatus || previousStatus === PRStatus.REVISION_REQUIRED) {
    setError('Cannot revert: No valid previous status found.');
    return;
  }
  
  console.log('Reverting from REVISION_REQUIRED to:', previousStatus);
  newStatus = previousStatus;
  
  await notificationService.handleStatusChange(
    pr.id || prId,
    pr.status,
    newStatus,
    currentUser,
    notes || `PR reverted to ${previousStatus} from revision required`
  );
  break;
```

### 3. Updated Specifications.md

Added comprehensive documentation of procurement actions in REVISION_REQUIRED status:

**Procurement Actions from REVISION_REQUIRED:**
- ✅ **Revert to Previous Status:** Moves PR back to its status before REVISION_REQUIRED was set
  - Requires notes explaining why revision is no longer needed
  - Retrieves previous status from statusHistory
  - Valid previous statuses: SUBMITTED, RESUBMITTED, IN_QUEUE, PENDING_APPROVAL
  - Notifies requestor, CC: Procurement
  - Use case: Procurement determines the revision request was incorrect or unnecessary

- ✅ **Reject PR:** Changes status to REJECTED
  - Must provide notes (validated)
  - Notifies requestor, CC: Procurement
  - Use case: Procurement determines the PR should not proceed

- ❌ **CANNOT:**
  - Edit the PR (exclusive to requestor in this status)
  - Push to approver (must wait for requestor to resubmit, or revert/reject)
  - Request additional revision (already in revision status)

## Workflow Examples

### Example 1: Incorrect Revision Request
1. PR is in IN_QUEUE status
2. Procurement accidentally requests revision
3. PR moves to REVISION_REQUIRED
4. Procurement realizes the mistake
5. **Action:** Click "Revert to Previous Status"
6. PR returns to IN_QUEUE
7. Requestor gets notification with explanation

### Example 2: PR Should Be Rejected
1. PR is in REVISION_REQUIRED status
2. Requestor hasn't responded for weeks
3. Requirements have changed
4. **Action:** Procurement clicks "Reject PR"
5. PR moves to REJECTED status
6. Can be resurrected later if needed

### Example 3: Legitimate Revision (Normal Flow)
1. PR is in REVISION_REQUIRED status
2. Requestor makes changes
3. Requestor clicks "Resubmit"
4. PR moves to SUBMITTED status
5. Procurement reviews again

## Status Transition Updates

Added new transitions to workflow documentation:

```
12. REVISION_REQUIRED → RESUBMITTED → SUBMITTED (requestor re-enters workflow)
13. REVISION_REQUIRED → [Previous Status] (procurement reverts)
14. REVISION_REQUIRED → REJECTED (procurement rejects)
15. REVISION_REQUIRED → CANCELED (requestor cancels)
```

## Files Modified

1. **`src/components/pr/ProcurementActions.tsx`**
   - Replaced action buttons for REVISION_REQUIRED status
   - Added 'revert' action case in handleSubmit
   - Implements statusHistory lookup logic
   - Updated TypeScript types to include 'revert' action

2. **`Specifications.md`**
   - Section: "PR Processing in REVISION_REQUIRED Status"
   - Added detailed procurement actions documentation
   - Updated status transition workflow list
   - Clarified use cases for revert vs reject

## User Experience

### Before (Confusing):
```
[In REVISION_REQUIRED Status]
Actions available to Procurement:
[ Push to Approver ]  [ Revise & Resubmit ]
```

### After (Logical):
```
[In REVISION_REQUIRED Status]
Actions available to Procurement:
[ Revert to Previous Status ]  [ Reject PR ]

Notes Required: Explain why revision is no longer needed, or why PR should be rejected
```

## Testing Recommendations

1. **Test Revert from Each Previous Status:**
   - SUBMITTED → REVISION_REQUIRED → Revert → Should return to SUBMITTED
   - IN_QUEUE → REVISION_REQUIRED → Revert → Should return to IN_QUEUE
   - PENDING_APPROVAL → REVISION_REQUIRED → Revert → Should return to PENDING_APPROVAL

2. **Test Error Handling:**
   - PR with insufficient statusHistory → Should show error message
   - Notes field empty on revert → Should require notes

3. **Test Notifications:**
   - Revert action → Requestor should receive notification with notes
   - Reject action → Requestor should receive notification with reason

4. **Test Workflow Integrity:**
   - Verify "Push to Approver" button no longer appears
   - Verify "Revise & Resubmit" button no longer appears
   - Verify requestor can still resubmit normally
   - Verify requestor can still cancel

## Benefits

1. **Logical Workflow:** Actions make sense in context of the status
2. **Error Recovery:** Procurement can undo incorrect revision requests
3. **Clear Options:** Only two clear choices - revert or reject
4. **No Bypass:** Cannot skip revision process by pushing to approver
5. **Audit Trail:** statusHistory preserves complete workflow history
6. **Required Notes:** All procurement actions require explanation

## Related Documentation

- Main Specifications: `Specifications.md` (lines 996-1033)
- Status Workflow: `Specifications.md` (lines 862-895)
- PR Type Definition: `src/types/pr.ts` (StatusHistoryItem interface)


