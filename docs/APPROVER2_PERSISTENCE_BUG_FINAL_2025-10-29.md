# Second Approver Not Persisting - Final Root Cause

**Date:** October 29, 2025  
**Issue:** When editing a PR in IN_QUEUE status and adding a second approver, the value doesn't persist after clicking Save

## The Journey to Finding the Bug

### Initial Symptom
User workflow:
1. Open PR in IN_QUEUE status (amount > 50,000 LSL, requires 2 approvers)
2. Click Edit
3. Select second approver from dropdown
4. Click Save → Success!
5. Navigate back, try "Push to Approver"
6. **FAILS:** "At least 2 unique approvers are required"
7. Check PR: Second approver is GONE!

### First Diagnosis (WRONG)
**Initial Theory:** `PRView.tsx` not including `approver2` in save payload.

**Fix Attempted:** Added explicit approver fields to `handleSave`:
```typescript
approver: selectedApprover || editedPR.approver || pr.approver,
approver2: selectedApprover2 || editedPR.approver2 || pr.approver2,
```

**Result:** Still didn't work! 🤔

### Second Diagnosis (ALSO WRONG)
**Theory:** Validation was checking for 2 approvers when pushing to PENDING_APPROVAL (should only check when approving).

**Fix Attempted:** Wrapped dual approver check in `targetStatus === PRStatus.APPROVED` condition.

**Result:** User correctly pointed out this was wrong - system SHOULD check for 2 approvers when pushing to PENDING_APPROVAL.

### The Smoking Gun 🔍

**Console Logs Revealed:**
```
PRView.tsx:1151 PRView handleSave - Computed approver fields: {
  approver2: 'XwviAkyIPcQB2ryFSWd2y2GLbPA3'  ✅ Present in save payload
}

pr.ts:252 Updating PR kqC0SifTPKPX4xcCtXpL with data: {...}
pr.ts:275 Successfully updated PR  ✅ Save successful

// But then when validation runs...
prValidation.ts:285 Dual approver check: {
  approver2: undefined  ❌ MISSING!
}
```

**The Data Was Being Saved But Not Retrieved!**

## The ACTUAL Root Cause

### Bug Location: `src/services/pr.ts` - `getPR()` function

**Line 145:**
```typescript
approver: data.approver,
// ❌ NO LINE FOR approver2!
requiredDate: data.requiredDate || '',
```

### What Was Happening:
1. **Save Operation (`updatePR`):**
   - ✅ `approver2` included in payload
   - ✅ Sent to Firestore
   - ✅ Successfully stored in database

2. **Fetch Operation (`getPR`):**
   - ✅ Data retrieved from Firestore (including `approver2`)
   - ❌ **BUT** `approver2` not mapped to the `PRRequest` object
   - ❌ Result: `pr.approver2 = undefined` even though it exists in Firestore!

### The Fix

**File:** `src/services/pr.ts`  
**Line:** 146 (new line added)

```typescript
approver: data.approver,
approver2: data.approver2, // ✅ Second approver for dual approval
requiredDate: data.requiredDate || '',
```

### Why This is THE Fix:
- Every PR fetch goes through `getPR()` function
- If `approver2` isn't mapped here, it will ALWAYS be `undefined` in the application
- Doesn't matter if it's saved correctly - if it's not read back, it's lost!

## Verification

After adding the mapping, the flow now works:

1. **Save:**
   ```
   PRView → handleSave() → prService.updatePR() 
   → Firestore: { approver: 'ID1', approver2: 'ID2' } ✅
   ```

2. **Fetch:**
   ```
   prService.getPR() → data from Firestore 
   → PR object: { approver: 'ID1', approver2: 'ID2' } ✅
   ```

3. **Validate:**
   ```
   prValidation.ts → checks pr.approver2 
   → Found! Validation passes ✅
   ```

## Files Modified

**`src/services/pr.ts`**
- **Line 146:** Added `approver2: data.approver2,` mapping
- **Lines 274-283:** Added debug logging for approver fields in `updatePR`
- **Lines 175-184:** Added debug logging for approver fields in `getPR`

**`src/components/pr/PRView.tsx`** (from earlier attempt, still needed)
- **Lines 1120-1121:** Explicit approver fields in save payload
- **Lines 1134-1135:** `secondApprover` in `approvalWorkflow`

**`src/utils/prValidation.ts`** (REVERTED the wrong fix)
- **Line 281-292:** Dual approver check runs for BOTH push and approval actions

## Lessons Learned

### 1. Trust the Logs
The console logs showed:
- ✅ Data going IN
- ❌ Data coming back OUT  
→ Problem is in the FETCH, not the SAVE

### 2. Symmetric Operations
When you add a field to the data model:
- Add it to the `interface` (type definition)
- Add it to the **SAVE** operation
- Add it to the **FETCH** operation ← WE FORGOT THIS!
- Add validation/business logic

### 3. Debug Logging is Critical
Adding detailed logs at save/fetch boundaries immediately revealed the issue.

## Testing

### Test Case: Full Round-Trip
1. Edit PR, select 2 approvers, Save
2. **Verify in console:** `Firestore update payload` shows both approvers
3. Navigate away
4. Come back to PR
5. **Verify in console:** `Successfully fetched PR` shows both approvers
6. Try "Push to Approver"
7. **Expected:** Validation passes ✅

## Related Issues

- **APPROVER2_PERSISTENCE_FIX_2025-10-29.md** - Documents the first (incomplete) fix
- **DUAL_APPROVER_FIX_SUMMARY_2025-10-29.md** - UI for second approver selection
- **NOTIFICATION_APPROVER_FIX_2025-10-29.md** - Including both approvers in emails

## Why This Was Hard to Find

1. **Misleading Success:** Save operations succeeded, giving the impression the data was persisted
2. **Async Nature:** By the time validation ran, it was fetching fresh data from Firestore
3. **Silent Failure:** No errors thrown - `undefined` is a valid JavaScript value
4. **Multiple Touch Points:** The field needed to be added in 3+ places (type, save, fetch)

## The Silver Lining

This bug helped us implement comprehensive debug logging for approver fields, which will make future issues much easier to diagnose!


