# Notification System Fixes - Approver Inclusion

**Date:** October 29, 2025
**Status:** Completed

## Issues Fixed

### 1. Removed "Vendor Not Approved" as Blocking Error
**Issue:** The system was blocking PRs from moving to PENDING_APPROVAL if the preferred vendor wasn't approved, even when all quote requirements were met.

**Root Cause:** Incorrect understanding of business rules - an approved vendor is a BENEFIT (reduces quote requirements), not a REQUIREMENT.

**Fix:** Removed the vendor approval check from blocking validation in `src/utils/prValidation.ts`. The check has been converted to a comment explaining that approved vendors are optional and only reduce quote requirements.

**Business Rule Clarification:**
- Approved vendor = OPTIONAL
- Benefit of approved vendor = Reduces number of quotes required
- If full quote requirements are met, vendor approval status is irrelevant

### 2. Fixed Dual Approver Validation Logic
**Issue:** System was allowing high-value PRs (above Rule 3/50,000 LSL) to be pushed to PENDING_APPROVAL with only 1 approver assigned when 2 were required.

**Root Cause:** 
1. Validation was checking Rule 2 (multiplier) instead of Rule 3 (high-value threshold) to determine if dual approval was needed
2. The dual approver check was only running when `targetStatus === PRStatus.APPROVED`, not when pushing to PENDING_APPROVAL
3. UI did not have a field for selecting a second approver

**Fix:** 
- Updated validation in `src/utils/prValidation.ts` to check for dual approvers BEFORE pushing to PENDING_APPROVAL
- Fixed `src/components/pr/ProcurementActions.tsx` to check Rule 3 (high-value threshold) instead of Rule 2 (multiplier)
- Added second approver selector field in `src/components/pr/PRView.tsx` that appears when amount exceeds Rule 3 threshold

**Business Rule Clarification:**
- Rule 3 = High-value threshold (50,000 LSL)
- Rule 5 = Number of approvers required (2)
- When amount ≥ Rule 3: Both approver AND approver2 must be assigned before pushing to PENDING_APPROVAL

### 3. Added Approvers to Notification Email List
**Issue:** When moving a PR from IN_QUEUE to PENDING_APPROVAL, the assigned approver(s) were not being included in the notification emails.

**Root Cause:** The notification handler was using a TODO/placeholder implementation that only sent to procurement email.

**Fix:** Updated `src/services/notifications/transitions/inQueueToPendingApproval.ts` to:
- Resolve approver user IDs to email addresses
- Add primary approver (pr.approver) to TO list
- Add second approver (pr.approver2) to TO list for dual approval scenarios
- Maintain requestor and procurement in CC list

## Files Modified

### 1. `src/utils/prValidation.ts`
**Changes:**
- Removed vendor approval as a blocking error
- Updated dual approver check to validate BEFORE pushing to PENDING_APPROVAL (not just on APPROVED)
- Checks both `pr.approver2` and `pr.approvers` array for backward compatibility

**After:**
```typescript
// Check dual approval requirement for high-value PRs
// Check both new format (approver + approver2) and old format (approvers array)
const assignedApproversCount = pr.approver2 ? 2 : (pr.approver ? 1 : 0);
const oldFormatCount = pr.approvers?.length || 0;
const actualApproversCount = Math.max(assignedApproversCount, oldFormatCount);

if (actualApproversCount < approversRequired) {
  approverErrors.push(`At least ${approversRequired} unique approvers are required for amounts above ${rule3Threshold} ${rule3.currency}. Please assign a second approver before pushing to approval.`);
}
```

### 2. `src/components/pr/ProcurementActions.tsx`
**Changes:**
- Fixed dual approval detection to check Rule 3 (high-value threshold) instead of Rule 2 (multiplier)
- Validation is now handled by `validatePRForApproval()`, so removed redundant check

**Before:**
```typescript
const rule2 = rules?.find((r: Rule) => r.type === 'RULE_2');
const requiresDualApproval = rule2 && pr.estimatedAmount >= rule2.threshold;
```

**After:**
```typescript
// Rule 3 is the high-value threshold that triggers dual approval requirement (Rule 5)
const rule3 = rules?.find((r: Rule) => (r as any).number === 3 || (r as any).number === '3');
const rule5 = rules?.find((r: Rule) => (r as any).number === 5 || (r as any).number === '5');
const requiresDualApproval = rule3 && rule5 && pr.estimatedAmount >= rule3.threshold;
```

### 3. `src/components/pr/PRView.tsx`
**Changes:**
- Added `selectedApprover2` state variable
- Added `handleApprover2Change()` handler
- Added conditional second approver selector UI that appears when amount >= Rule 3 threshold
- Updated `useEffect` to load both `approver` and `approver2` from PR data
- Second approver dropdown filters out the first approver to prevent duplicate selection

**New UI Field:**
```typescript
{/* Second Approver (for dual approval on high-value PRs) */}
{(() => {
  const rule3 = rules.find(r => r.number === 3 || r.number === '3');
  const requiresDualApproval = rule3 && 
    (pr?.estimatedAmount || editedPR.estimatedAmount || 0) >= rule3.threshold;

  if (!requiresDualApproval) return null;

  return (
    <Grid item xs={6}>
      <FormControl fullWidth>
        <InputLabel>Second Approver (Required)</InputLabel>
        <Select
          value={selectedApprover2 || ''}
          onChange={(e) => handleApprover2Change(e.target.value)}
          label="Second Approver (Required)"
        >
          {/* Options filtered to exclude first approver */}
        </Select>
      </FormControl>
    </Grid>
  );
})()}
```

### 4. `src/services/notifications/transitions/inQueueToPendingApproval.ts`
**Changes:**
- Added `getUserEmail()` helper function to resolve user IDs to email addresses
- Updated `getRecipients()` to include both approvers in TO list
- Resolves IDs for both pr.approver and pr.approver2

**After:**
```typescript
// Resolve primary approver
let approverEmail: string | null = null;
if (pr.approver) {
  approverEmail = await getUserEmail(pr.approver);
  if (approverEmail) {
    recipients.to.push(approverEmail);
  }
}

// Resolve second approver for dual approval scenarios
let approver2Email: string | null = null;
if (pr.approver2) {
  approver2Email = await getUserEmail(pr.approver2);
  if (approver2Email) {
    recipients.to.push(approver2Email);
  }
}
```

## Email Notification Flow (IN_QUEUE → PENDING_APPROVAL)

### Single Approval (Amount < Rule 3)
**TO:** Assigned approver (pr.approver)
**CC:** Requestor, procurement@1pwrafrica.com

### Dual Approval (Amount ≥ Rule 3)
**TO:** Primary approver (pr.approver), Second approver (pr.approver2)
**CC:** Requestor, procurement@1pwrafrica.com

## User ID Resolution

The `getUserEmail()` helper function handles both scenarios:
1. **Already an email:** If the value contains '@', returns it as-is
2. **User ID:** Fetches the user document from Firestore and returns the email field

This ensures compatibility whether approvers are stored as:
- Email addresses directly
- User IDs that need to be resolved

## Testing Recommendations

1. **Single Approval PR:**
   - Create PR below Rule 3 threshold (< 50,000 LSL)
   - Push to PENDING_APPROVAL
   - Verify approver receives email in TO field
   - Verify requestor and procurement in CC

2. **Dual Approval PR:**
   - Create PR above Rule 3 threshold (> 50,000 LSL)
   - Assign both approver and approver2
   - Push to PENDING_APPROVAL
   - Verify BOTH approvers receive email in TO field
   - Verify requestor and procurement in CC

3. **Vendor Not Approved:**
   - Create PR with non-approved vendor
   - Add required quotes (e.g., 3 quotes with attachments)
   - Verify PR can push to PENDING_APPROVAL successfully
   - No blocking error about vendor approval

4. **Dual Approver Validation:**
   - Create PR above Rule 3 threshold (e.g., 67,676 LSL)
   - Assign only 1 approver
   - Try to push to PENDING_APPROVAL
   - Should FAIL with error: "At least 2 unique approvers are required for amounts above 50,000 LSL. Please assign a second approver before pushing to approval."
   - Assign second approver
   - Push to PENDING_APPROVAL
   - Should succeed and both approvers receive notification

## Related Documentation

- Business Rules: See `docs/VALIDATION_ERROR_CATEGORIZATION_2025-10-29.md`
- Notification System: See `src/services/notifications/README.md` (if exists)
- Status Workflow: See `Specifications.md` section "PR/PO Status Workflow"

