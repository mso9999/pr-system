# Approver Validation Save Fix

**Date:** October 28, 2025  
**Component:** PR Editing System  
**Files Modified:** `src/components/pr/PRView.tsx`

## Problem

When editing a PR (especially in Revision Required status), users could change the approver to an invalid combination (e.g., selecting a Level 6 Finance Approver for an amount above the Rule 1 threshold) and the system would:
1. Allow the save to proceed despite the validation error
2. Redirect to the PR view page instead of the dashboard after save

### Specific Issues:
1. **Validation not preventing save**: The validation was running and displaying an error, but the Save button remained enabled, allowing users to submit invalid data
2. **Wrong redirect after save**: After successfully saving a PR, users were redirected to `/pr/${pr.id}` instead of `/dashboard`
3. **Poor UX**: No visual indication of why save might fail before clicking the button

## Root Cause

The Save button (line 2094) was only disabled by the `loading` state, not by the presence of validation errors:

```typescript
// BEFORE - Only disabled during loading
<Button onClick={handleSave} disabled={loading}>
  {loading ? <CircularProgress size={24} /> : 'Save'}
</Button>
```

While the `handleSave` function (lines 1013-1020) did check for validation errors and prevent the save, this happened **after** the user clicked the button. The button itself didn't provide any visual feedback that there was a problem.

Additionally, line 1056 redirected to the PR view page after save:
```typescript
// BEFORE - Redirected to PR view
navigate(`/pr/${pr.id}`);
```

## Solution

### 1. Disable Save Button on Validation Error

Modified the Save button to be disabled when either `loading` is true OR `approverAmountError` is present:

```typescript
<Button 
  onClick={handleSave} 
  disabled={loading || !!approverAmountError}
  variant="contained"
  color="primary"
>
  {loading ? <CircularProgress size={24} /> : 'Save'}
</Button>
```

### 2. Add Tooltip for User Feedback

Wrapped the Save button in a Tooltip that displays the validation error message when hovering:

```typescript
<Tooltip 
  title={approverAmountError || ''} 
  arrow
  placement="top"
>
  <span>
    <Button 
      onClick={handleSave} 
      disabled={loading || !!approverAmountError}
      variant="contained"
      color="primary"
    >
      {loading ? <CircularProgress size={24} /> : 'Save'}
    </Button>
  </span>
</Tooltip>
```

**Note:** The `<span>` wrapper is necessary because Material-UI Tooltip components require a child that can receive a ref, and disabled buttons can't receive refs.

### 3. Redirect to Dashboard After Save

Changed the post-save navigation to redirect to the dashboard:

```typescript
// AFTER - Redirects to dashboard
navigate('/dashboard');
```

## Validation Logic

The existing validation logic (already implemented in previous fix) runs automatically via `useEffect`:

```typescript
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

The `validateApproverAmount` function checks:
- Level 1 and 2 can approve any amount ✅
- Level 4 (Finance Admin) and Level 6 (Finance Approvers) can only approve up to Rule 1 threshold ✅
- Level 3 (Procurement Officer) and Level 5 (Requester) cannot be approvers at all ✅

## User Flow After Fix

### Scenario: Procurement user edits PR with invalid approver-amount combo

1. **User edits PR**: Procurement user (Level 3) moves PR to Revision Required
2. **Requester edits**: Original requester (Level 5) logs in and edits the PR
3. **Invalid approver selected**: Changes approver to Level 6 Finance Approver
4. **Validation triggers**: System detects amount is above Rule 1 threshold
5. **Visual feedback**: 
   - Alert appears at top of form showing the error
   - Save button becomes disabled and grayed out
   - Hovering over Save button shows tooltip with error message
6. **User corrects**: Changes approver to Level 1 or 2
7. **Validation passes**: Alert disappears, Save button becomes enabled
8. **Save succeeds**: PR is saved and user is redirected to dashboard

## Testing Checklist

- [x] Save button disabled when validation error exists
- [x] Save button tooltip shows validation error message
- [x] Alert at top of form shows validation error
- [x] Validation runs automatically when approver or amount changes
- [x] User redirected to dashboard after successful save
- [x] No linting errors

## Related Files

- `src/components/pr/PRView.tsx` - Main edit view component
- `docs/APPROVER_VALIDATION_FIX_2025-10-28.md` - Initial validation fix documentation
- `src/components/pr/steps/BasicInformationStep.tsx` - Validation during PR creation

## Technical Details

### State Management
- `approverAmountError`: String state holding validation error message (or null if no error)
- `loading`: Boolean state for async save operation
- `selectedApprover`: Current approver selection
- `editedPR.estimatedAmount`: Current PR amount

### Validation Trigger
The validation runs automatically via `useEffect` whenever:
- `selectedApprover` changes
- `editedPR.estimatedAmount` changes
- `rules.length` changes (rules loaded)

### Button Disable Logic
```typescript
disabled={loading || !!approverAmountError}
```
- `loading`: Prevents double-submission during save
- `!!approverAmountError`: Converts error string to boolean (true if error exists)

## Benefits

1. **Prevents invalid data**: Users cannot save invalid approver-amount combinations
2. **Better UX**: Visual feedback (disabled button + tooltip) before clicking
3. **Clearer workflow**: After save, user returns to dashboard to see updated PR
4. **Consistent validation**: Works in both create and edit modes
5. **Error visibility**: Multiple ways to see the error (Alert, tooltip, console logs)

## Edge Cases Handled

1. **Rules not loaded yet**: Validation skipped if `rules.length === 0`
2. **No approver selected**: Validation skipped gracefully
3. **No amount entered**: Validation skipped gracefully
4. **Disabled button with tooltip**: Wrapped in `<span>` to support disabled tooltip
5. **Multiple validation triggers**: useEffect dependencies ensure validation runs at right time

