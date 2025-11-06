# ETD Display Issue - Debugging Guide

## What to Look for in Browser Console

After clicking "Save ETD", you should see this sequence of console logs:

### 1. Save Initiated
```
ApprovedStatusActions: Saving ETD {etd: '2025-11-07', prId: 'kqC0SifTPKPX4xcCtXpL'}
```

### 2. Database Update
```
pr.ts:284 Updating PR kqC0SifTPKPX4xcCtXpL with data: {estimatedDeliveryDate: '2025-11-07', updatedAt: '2025-11-03T14:18:25.019Z'}
pr.ts:331 Successfully updated PR kqC0SifTPKPX4xcCtXpL
```

### 3. Refresh Called
```
ApprovedStatusActions: ETD saved, calling onStatusChange to refresh
```

### 4. PR Refetched
```
pr.ts:112 Fetching PR with ID: kqC0SifTPKPX4xcCtXpL
pr.ts:178 Successfully fetched PR with ID: kqC0SifTPKPX4xcCtXpL {prNumber: '251028-0008-1PL-LS', ..., estimatedDeliveryDate: '2025-11-07', ...}
```

### 5. State Synced
```
ApprovedStatusActions: Syncing state with PR prop {
  prId: 'kqC0SifTPKPX4xcCtXpL',
  estimatedDeliveryDate: '2025-11-07',
  proformaOverride: true,
  proformaOverrideJustification: 'reasons',
  popOverride: true,
  popOverrideJustification: 'reasons',
  finalPrice: undefined
}
```

### 6. ETD Formatted
```
ApprovedStatusActions: Setting ETD {
  original: '2025-11-07',
  formatted: '2025-11-07'
}
```

### 7. Refresh Complete
```
ApprovedStatusActions: onStatusChange completed
```

---

## What You Should See in UI

After the save completes:

1. **Green Success Notification** (top-right):
   ```
   Estimated delivery date saved successfully
   ```

2. **Green Success Alert Box** (in ETD section):
   ```
   ✓ ETD Set: Thu, Nov 7, 2025
   ```

3. **Date Input Field**:
   - Should show: `2025-11-07` (or `11/07/2025` depending on browser locale)
   - Button should change to: "Update ETD" (instead of "Save ETD")
   - Button should be disabled (since date hasn't changed)

---

## If ETD Still Not Showing

### Check Console for These Issues:

#### Issue A: PR Prop Not Updating
If you don't see "Syncing state with PR prop" after the save:
- The parent component (`PRView`) isn't passing the updated PR object
- Solution: Check `PRView.tsx` `refreshPR()` function

#### Issue B: estimatedDeliveryDate is undefined in fetched PR
```
estimatedDeliveryDate: undefined  // BAD
```
- The database update failed or didn't include the field
- Solution: Check Firestore rules, check that field is being saved

#### Issue C: Date Format Error
```
ApprovedStatusActions: Setting ETD { original: '2025-11-07T00:00:00.000Z', formatted: 'NaN-NaN-NaN' }
```
- Date parsing failed
- Solution: Check date format being saved to database

#### Issue D: useEffect Not Firing
If you don't see "Syncing state with PR prop" at all:
- The `useEffect` dependency isn't triggering
- Solution: Check that `pr` object reference is actually changing

---

## Manual Test Steps

1. **Open Browser DevTools** (F12)
2. **Go to Console Tab**
3. **Clear Console** (trash icon or Ctrl+L)
4. **Click "Save ETD"**
5. **Watch for the 7 log messages above**
6. **If any are missing**, that's where the issue is

---

## Quick Fixes to Try

### Fix 1: Hard Refresh
- Press `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
- This clears cached JavaScript

### Fix 2: Clear State
- Log out
- Clear browser cache
- Log back in
- Navigate to the PO

### Fix 3: Check Firestore Data Directly
1. Go to Firebase Console
2. Open Firestore Database
3. Find the PR document: `prs/kqC0SifTPKPX4xcCtXpL`
4. Check if `estimatedDeliveryDate` field exists and has the right value

---

## Expected Firestore Document Structure

After save, the PR document should have:
```javascript
{
  id: "kqC0SifTPKPX4xcCtXpL",
  prNumber: "251028-0008-1PL-LS",
  estimatedDeliveryDate: "2025-11-07",  // This should exist
  proformaOverride: true,
  proformaOverrideJustification: "reasons",
  popOverride: true,
  popOverrideJustification: "reasons",
  updatedAt: "2025-11-03T14:18:25.019Z",
  // ... other fields
}
```

---

## Known Working Flow

Based on your console logs, these ARE working:
- ✅ ETD save to database
- ✅ PR refetch from database
- ✅ Success notifications

The issue is likely in the UI state sync or date formatting.

---

## Next Steps if Still Broken

1. **Copy all console logs** from "Save ETD" click to 5 seconds after
2. **Take screenshot** of the ETD section UI
3. **Check Firestore** document directly to confirm `estimatedDeliveryDate` field exists
4. **Report findings** with:
   - Console logs
   - Screenshot
   - Firestore field value
   - Browser and version





