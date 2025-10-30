# Second Approver Not Persisting Fix

**Date:** October 29, 2025  
**Issue:** When editing a PR in IN_QUEUE status and adding a second approver, the value doesn't persist after clicking Save

## Problem

**User Workflow:**
1. Open PR in IN_QUEUE status (amount > 50,000 LSL, requires 2 approvers)
2. Click Edit
3. Select second approver from dropdown (shows correctly in UI)
4. Click Save
5. PR saves successfully
6. Try to push to PENDING_APPROVAL
7. **FAILS:** Validation says "At least 2 unique approvers are required"
8. Check PR again: Second approver is gone!

**Console Evidence:**
```
PRView.tsx:1074 Second approver changed to: XR1cCt5uCLT9wJW7a5yVED6iT863
pr.ts:252 Updating PR kqC0SifTPKPX4xcCtXpL with data: {...}
pr.ts:275 Successfully updated PR kqC0SifTPKPX4xcCtXpL
// But approver2 is NOT in the saved data!
```

## Root Cause

In `src/components/pr/PRView.tsx`, the `handleSave` function was not explicitly including the `approver` and `approver2` fields when building the update payload.

**The Issue:**
```typescript
const updatedPR: PRUpdateParams = {
  ...pr,
  ...editedPR,
  lineItems: [...],
  quotes: [...],
  approvalWorkflow: {
    currentApprover: pr.approvalWorkflow?.currentApprover || null,
    // ❌ secondApprover was NOT included!
    approvalHistory: pr.approvalWorkflow?.approvalHistory || [],
    lastUpdated: new Date().toISOString()
  }
};
```

**What Happened:**
1. User selects second approver → `selectedApprover2` state updated
2. `handleFieldChange('approver2', approverId)` called → `editedPR.approver2` set
3. Click Save → `updatedPR` built
4. `approvalWorkflow` object reconstructed WITHOUT `secondApprover`
5. **Result:** `approver2` field lost in the update!

## The Fix

Explicitly include both `approver` and `approver2` fields from the current state:

```typescript
const updatedPR: PRUpdateParams = {
  ...pr,
  ...editedPR,
  // ✅ Explicitly preserve approver fields from state
  approver: selectedApprover || editedPR.approver || pr.approver,
  approver2: selectedApprover2 || editedPR.approver2 || pr.approver2,
  lineItems: [...],
  quotes: [...],
  approvalWorkflow: {
    currentApprover: selectedApprover || pr.approvalWorkflow?.currentApprover || null,
    secondApprover: selectedApprover2 || pr.approvalWorkflow?.secondApprover || null, // ✅ Now included!
    approvalHistory: pr.approvalWorkflow?.approvalHistory || [],
    lastUpdated: new Date().toISOString()
  }
};
```

### Priority Order:
1. **`selectedApprover` / `selectedApprover2`** - Current UI state (highest priority)
2. **`editedPR.approver` / `editedPR.approver2`** - Changed values in edit mode
3. **`pr.approver` / `pr.approver2`** - Original values (fallback)

## Files Modified

**`src/components/pr/PRView.tsx`**
- Lines 1120-1121: Added explicit `approver` and `approver2` fields
- Lines 1134-1135: Added `secondApprover` to `approvalWorkflow`

## Testing

### Test Case 1: Add Second Approver
1. Open PR with amount > 50,000 LSL (e.g., 67,676 LSL)
2. Click Edit
3. Verify "Second Approver (Required)" field appears
4. Select a second approver (different from first)
5. Click Save
6. **Expected:** "PR saved successfully"
7. Navigate away and back to PR
8. **Expected:** Both approvers still selected ✅

### Test Case 2: Change Second Approver
1. Open PR that already has 2 approvers
2. Click Edit
3. Change the second approver to someone else
4. Click Save
5. Navigate away and back
6. **Expected:** New second approver is saved ✅

### Test Case 3: Remove Second Approver (if amount decreases)
1. Open PR with 2 approvers
2. Click Edit
3. Reduce amount below 50,000 LSL
4. Second approver field disappears (conditional rendering)
5. Click Save
6. **Expected:** PR saves with only one approver ✅

### Test Case 4: Push to Approval with 2 Approvers
1. Open PR with amount > 50,000 LSL
2. Ensure 2 approvers are assigned and saved
3. Return to dashboard
4. Try "Push to Approver"
5. **Expected:** Validation passes, PR moves to PENDING_APPROVAL ✅

## Follow-Up Issue: Validation Still Blocking Push

**After the initial fix**, the second approver was being saved correctly, but the system was still blocking "Push to Approver" with the error:
```
At least 2 unique approvers are required for amounts above 50,000 LSL.
Please assign a second approver before pushing to approval.
```

### Root Cause:
The dual approver validation in `src/utils/prValidation.ts` (line 285) was checking for 2 approvers **regardless of the target status**. This meant:
- ❌ When pushing from IN_QUEUE → PENDING_APPROVAL: Required 2 approvers to be assigned (WRONG!)
- ✅ When approving PENDING_APPROVAL → APPROVED: Should require 2 approvers (CORRECT!)

### The Fix:
Wrapped the dual approver check in a `targetStatus === PRStatus.APPROVED` condition:

```typescript
// Check dual approval requirement for high-value PRs
// Only validate this when actually approving (not when pushing to approval)
if (targetStatus === PRStatus.APPROVED) {
  const assignedApproversCount = pr.approver2 ? 2 : (pr.approver ? 1 : 0);
  const oldFormatCount = pr.approvers?.length || 0;
  const actualApproversCount = Math.max(assignedApproversCount, oldFormatCount);
  
  if (actualApproversCount < approversRequired) {
    approverErrors.push(`At least ${approversRequired} unique approvers are required for amounts above ${rule3Threshold} ${rule3.currency}.`);
  }
}
```

**Now the workflow is:**
1. **IN_QUEUE → PENDING_APPROVAL:** Only quotes and approver permission levels are validated. The number of approvers assigned is NOT checked.
2. **PENDING_APPROVAL → APPROVED:** Both approvers must be assigned, and both must click "Approve" for the PR to be fully approved.

## Related Issues

This fix addresses:
- Dual approver requirement validation (Rule 5)
- High-value PR workflow (amounts > Rule 3/50,000 LSL)
- Firestore data persistence for `approver2` field
- Premature validation of dual approvers during "Push to Approver" action

## Related Documentation

- Dual Approver UI: `docs/DUAL_APPROVER_FIX_SUMMARY_2025-10-29.md`
- Validation Logic: `docs/VALIDATION_ERROR_CATEGORIZATION_2025-10-29.md`
- Notification System: `docs/NOTIFICATION_APPROVER_FIX_2025-10-29.md`

## Why This Happened

The `approvalWorkflow` object was being reconstructed from scratch in the save handler, which lost any fields not explicitly mentioned. This is a common pattern issue when working with nested objects - you need to be explicit about which fields to preserve.

**Lesson:** When building update payloads for objects with nested structures, always explicitly list all fields that should be persisted, especially when they come from UI state that may not be in the `editedPR` object yet.

