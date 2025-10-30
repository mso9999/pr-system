# Dual Approver Validation Fix - Summary

**Date:** October 29, 2025  
**Issue:** High-value PRs (above Rule 3 threshold) were being allowed to push to PENDING_APPROVAL with only 1 approver when 2 were required.

## The Problem

Your PR with amount 67,676 LSL was able to push to PENDING_APPROVAL with only Matt Orosz assigned as approver, even though:
- Amount is above Rule 3 (50,000 LSL)
- Rule 5 requires 2 approvers for amounts above Rule 3
- Only 1 approver was selected

## Root Causes

1. **Wrong Rule Check:** ProcurementActions was checking Rule 2 (multiplier = 4) instead of Rule 3 (high-value threshold = 50,000) to determine if dual approval was needed

2. **Validation Timing:** The dual approver check was only running when `targetStatus === PRStatus.APPROVED`, not when pushing to `PENDING_APPROVAL`

3. **Missing UI:** There was no UI field to select a second approver - only one approver dropdown existed

## The Fix

### 1. Validation Logic (`src/utils/prValidation.ts`)
✅ **Now checks for dual approvers BEFORE pushing to PENDING_APPROVAL**
- Counts approvers from both `pr.approver2` and `pr.approvers` array
- Compares count against Rule 5 requirement
- Blocks progression if insufficient approvers for high-value PRs

```typescript
// Check dual approval requirement for high-value PRs
const assignedApproversCount = pr.approver2 ? 2 : (pr.approver ? 1 : 0);
const actualApproversCount = Math.max(assignedApproversCount, oldFormatCount);

if (actualApproversCount < approversRequired) {
  approverErrors.push(`At least ${approversRequired} unique approvers are required...`);
}
```

### 2. Procurement Actions (`src/components/pr/ProcurementActions.tsx`)
✅ **Now checks Rule 3 (high-value threshold) instead of Rule 2 (multiplier)**

```typescript
// Before: Wrong rule
const rule2 = rules?.find((r: Rule) => r.type === 'RULE_2');
const requiresDualApproval = rule2 && pr.estimatedAmount >= rule2.threshold;

// After: Correct rule
const rule3 = rules?.find((r: Rule) => (r as any).number === 3);
const requiresDualApproval = rule3 && pr.estimatedAmount >= rule3.threshold;
```

### 3. PR View UI (`src/components/pr/PRView.tsx`)
✅ **Added second approver selector field**
- Field only appears when amount >= Rule 3 threshold
- Shows "Second Approver (Required)" label
- Filters out first approver to prevent duplicate selection
- Helper text shows threshold requirement

**Visual Example:**
```
Amount: 67,676 LSL

[Approver Dropdown ▼] Matt Orosz (Global Approver)
[Second Approver (Required) ▼] (Select second approver)
Helper: Required for amounts above 50,000 LSL
```

### 4. Notification System (`src/services/notifications/transitions/inQueueToPendingApproval.ts`)
✅ **Both approvers now receive notification emails**
- Resolves user IDs to email addresses
- Adds both `pr.approver` and `pr.approver2` to TO list
- Maintains requestor and procurement in CC

## Expected Behavior Now

### For High-Value PRs (≥ 50,000 LSL):

1. **Before Push:**
   - Procurement must assign BOTH approvers in PRView
   - Second approver field will appear automatically
   - Cannot select same person twice

2. **During Push:**
   - Validation checks for 2 approvers
   - If only 1 assigned: **BLOCKS** with clear error message
   - If 2 assigned: **ALLOWS** push to PENDING_APPROVAL

3. **After Push:**
   - Both approvers receive email notification (TO list)
   - Requestor and procurement in CC
   - PR status changes to PENDING_APPROVAL

### Error Message If Only 1 Approver:
```
APPROVER REQUIREMENTS:
• At least 2 unique approvers are required for amounts above 50,000 LSL. 
  Please assign a second approver before pushing to approval.
```

## Test Your PR Again

1. Open your PR with 67,676 LSL
2. Click Edit
3. You should now see a "Second Approver (Required)" field
4. Select a second approver (different from Matt Orosz)
5. Save changes
6. Try to push to PENDING_APPROVAL
7. Should now succeed ✅

## Business Rules Summary

| Amount Range | Quotes Required | Approvers Required |
|-------------|-----------------|-------------------|
| < 1,500 LSL | 0 | 1 (any level) |
| 1,500 - 6,000 LSL | 1 (0 if approved vendor) | 1 (Level 1 or 2) |
| 6,000 - 50,000 LSL | 3 (1 if approved vendor) | 1 (Level 1 or 2) |
| ≥ 50,000 LSL | 3 (2 if approved vendor) | **2 (Level 1 or 2)** |

**Your PR:** 67,676 LSL = Last row = **2 approvers required**

## Related Fixes in This Session

1. ✅ Removed "vendor not approved" as blocking error
2. ✅ Fixed dual approver validation logic
3. ✅ Added second approver UI field
4. ✅ Added approvers to email notifications

All fixes are documented in: `docs/NOTIFICATION_APPROVER_FIX_2025-10-29.md`


