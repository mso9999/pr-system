# Approver Validation Fix - October 28, 2025

## Issue Summary

**Problem:** Users with procurement permissions could change the approver on a PR from a Level 1/2 approver to a Level 6 (Finance Approver) or Level 4 (Finance Admin), even when the PR amount exceeded the Rule 1 threshold. The system was not validating the approver-amount combination when the approver field was changed.

**Example:**
- PR with LSL 635,636 amount
- Originally assigned to Level 1 approver (can approve any amount)
- Procurement user changed approver to "Admin User" (Level 6)
- System ALLOWED the change without validation ❌
- Result: Invalid approver-amount combination persisted

## Root Cause

The validation logic existed but had two critical gaps:

1. **Missing Auto-Validation**: Validation was only triggered manually when specific fields were changed, but not automatically when the combination of approver + amount changed
2. **Silent Failure**: If approval rules hadn't loaded yet, validation would silently pass (return `null`) without warning

## Solution

### 1. Enhanced Validation Logic (`PRView.tsx`)

**Added Auto-Validation Effect:**
```typescript
// Auto-validate whenever approver or amount changes
useEffect(() => {
  // Only validate when rules are loaded and we're in edit mode
  if (rules.length > 0 && (selectedApprover || editedPR.estimatedAmount)) {
    const error = validateApproverAmount();
    setApproverAmountError(error);
    
    if (error) {
      console.log('Approver-amount validation error detected:', error);
    }
  }
}, [selectedApprover, editedPR.estimatedAmount, rules.length]);
```

**Improved Validation Function:**
- Added logging when rules aren't loaded yet
- Added detailed validation logging with amount, approver ID, and rule count
- Better console warnings for debugging

**Prominent Error Display:**
- Added Alert component at top of form (impossible to miss)
- Error shown on both Approver and Estimated Amount fields
- Save button blocked when validation fails

### 2. Same Fix Applied to New PR Creation (`BasicInformationStep.tsx`)

The same auto-validation effect was added to ensure validation works during PR creation as well:

```typescript
// Auto-validate whenever approver or amount changes
React.useEffect(() => {
  // Only validate when rules are loaded and we have approvers or amount
  if (rules.length > 0 && (formState.approvers.length > 0 || formState.estimatedAmount)) {
    const error = validateApproverAmount();
    setApproverAmountError(error);
    
    if (error) {
      console.log('Approver-amount validation error detected:', error);
    }
  }
}, [formState.approvers, formState.estimatedAmount, rules.length]);
```

## Validation Rules Enforced

### Permission Levels:
- **Level 1** (Global Approver): Can approve ANY amount ✅
- **Level 2** (Senior Approver): Can approve ANY amount ✅
- **Level 3** (Procurement Officer): CANNOT be assigned as approver ❌
- **Level 4** (Finance Admin): Can ONLY approve up to Rule 1 threshold
- **Level 5** (Requester): CANNOT be assigned as approver ❌
- **Level 6** (Finance Approver): Can ONLY approve up to Rule 1 threshold

### Example Rule 1:
- **Threshold:** LSL 50,000
- **Currency:** LSL

**Valid Combinations:**
- ✅ LSL 635,636 with Level 1 approver
- ✅ LSL 635,636 with Level 2 approver
- ✅ LSL 30,000 with Level 6 approver
- ✅ LSL 45,000 with Level 4 approver

**Invalid Combinations:**
- ❌ LSL 635,636 with Level 6 approver (exceeds Rule 1 threshold)
- ❌ LSL 100,000 with Level 4 approver (exceeds Rule 1 threshold)
- ❌ Any amount with Level 3 approver (procurement can't approve)
- ❌ Any amount with Level 5 approver (requesters can't approve)

## User Experience Changes

### Before Fix:
1. User changes approver to Level 6
2. Amount is LSL 635,636 (way above threshold)
3. System allows the change
4. Invalid combination saved to database

### After Fix:
1. User changes approver to Level 6
2. **Validation runs automatically**
3. **Red Alert appears at top of form:**
   > ⚠️ **Invalid Approver-Amount Combination:** Selected approver (Admin User) cannot approve amounts above 50000 LSL. Only Level 1 or 2 approvers can approve this amount.
4. **Error shown on Approver field**
5. **Error shown on Amount field**
6. **Save button blocked**
7. User must change to valid approver or reduce amount

## Files Modified

1. **`src/components/pr/PRView.tsx`**
   - Added auto-validation useEffect
   - Enhanced validateApproverAmount with logging
   - Added Alert component import
   - Added prominent error Alert at top of form
   - Enhanced logging in handleApproverChange

2. **`src/components/pr/steps/BasicInformationStep.tsx`**
   - Added auto-validation useEffect for new PR creation

## Testing Instructions

### Test Case 1: Editing Existing PR
1. Login as procurement user (e.g., Phoka)
2. Open a PR with high amount (e.g., LSL 635,636)
3. Click "Edit"
4. Try to change approver from Level 1 to Level 6
5. **Expected:** Red alert appears immediately, save is blocked

### Test Case 2: Creating New PR
1. Login as requester
2. Start creating new PR
3. Enter high amount (e.g., LSL 100,000)
4. Try to select Level 6 approver
5. **Expected:** Error message appears, can't proceed

### Test Case 3: Valid Combination
1. Login as procurement user
2. Open a PR with amount LSL 30,000 (below threshold)
3. Click "Edit"
4. Change approver to Level 6
5. **Expected:** No error, save allowed

### Test Case 4: Changing Amount After Approver
1. Login as procurement user
2. Open PR with Level 6 approver and amount LSL 30,000
3. Click "Edit"
4. Change amount to LSL 100,000
5. **Expected:** Error appears immediately

## Technical Details

### Validation Trigger Points:
1. ✅ When approver field changes
2. ✅ When amount field changes
3. ✅ Automatically via useEffect when either changes
4. ✅ Before save operation
5. ✅ On initial load (if editing existing PR)

### Validation Dependencies:
- `selectedApprover` or `formState.approvers`
- `editedPR.estimatedAmount` or `formState.estimatedAmount`
- `rules.length` (ensures rules are loaded)

### Performance Considerations:
- Validation runs locally (no API calls)
- Only runs when rules are loaded
- Uses setTimeout(100ms) for debouncing in manual triggers
- useEffect runs immediately for real-time feedback

## Deployment Notes

- **No database migrations required**
- **No environment variable changes**
- **Frontend-only changes**
- **Backward compatible** (only adds validation, doesn't change data structure)

## Related Files

- [`src/components/pr/PRView.tsx`](../src/components/pr/PRView.tsx)
- [`src/components/pr/steps/BasicInformationStep.tsx`](../src/components/pr/steps/BasicInformationStep.tsx)
- [`src/config/permissions.ts`](../src/config/permissions.ts)

## Prevention

To prevent similar issues in the future:

1. ✅ Always add auto-validation useEffect when creating form validation
2. ✅ Validate on ALL related field changes, not just one field
3. ✅ Never silently pass validation - always log when validation is skipped
4. ✅ Display errors prominently (Alert component at top of form)
5. ✅ Block save operations when validation fails

## Version History

- **v1.0** (2025-10-28): Initial fix for approver validation issue
