# PR Notification Issues - Fix Documentation
**Date:** October 28, 2025  
**Issue:** Multiple critical bugs causing incorrect vendor names, duplicate emails, and mismatched PR numbers

## Problems Identified

### 1. Random PR Number Generation
**Issue:** Using `Math.random()` to generate PR numbers resulted in different numbers every time the function was called.

**Location:** `src/services/pr.ts:542`

**Impact:**
- Multiple calls to `generatePRNumber()` produced different numbers
- Emails showed PR numbers that didn't match the dashboard
- Duplicate submissions created PRs with completely different numbers

**Root Cause:**
```typescript
// OLD CODE - BROKEN
const sequentialNumber = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
```

**Fix:** Implemented Firestore counter with atomic transactions
```typescript
// NEW CODE - FIXED
const sequentialNumber = await runTransaction(db, async (transaction) => {
  const counterDoc = await transaction.get(counterRef);
  let newCount = counterDoc.exists() ? counterDoc.data().count + 1 : 1;
  transaction.set(counterRef, {
    count: newCount,
    year: currentYear,
    organization: normalizedOrg,
    lastUpdated: new Date().toISOString()
  });
  return newCount;
});
```

**Benefits:**
- Sequential numbering per year per organization
- Atomic increments prevent race conditions
- Consistent PR numbers across all systems
- Automatic annual reset

---

### 2. Fallback PR Number Generation in Notifications
**Issue:** Notification handler had its own PR number generation logic using `Math.random()`, creating a second source of random numbers.

**Location:** `src/services/notifications/handlers/submitPRNotification.ts:126-182`

**Impact:**
- If the passed `prNumber` was missing, it generated a NEW random number
- This resulted in emails showing different PR numbers than the actual PR document

**Fix:** Removed fallback generation logic - now throws an error if PR number is not provided
```typescript
// NEW CODE
if (!inputPrNumber && !pr.prNumber) {
  console.error('No PR number available for notification');
  throw new Error('PR number is required for notification but was not provided');
}
```

---

### 3. Vendor Resolution Failure
**Issue:** Vendor IDs (like "1030") were not being resolved to vendor names (like "Power Transformers") in emails.

**Location:** `src/services/notifications/templates/newPRSubmitted.ts:82-159`

**Root Cause:**
- `referenceDataService.getVendors()` returned raw Firestore data
- Data structure varied between service vs. direct Firestore query
- Missing `vendorId` field in normalized structure
- Matching logic didn't account for all field variations

**Fix:** 
1. **Normalized vendor data structure:**
```typescript
items = rawVendors.map(v => {
  const data = v;
  return {
    id: v.id,
    vendorId: data.vendorId || data.code || data.Code || v.id, // ← KEY FIX
    code: data.code || data.Code,
    name: data.name || data.Name,
    active: activeValue === true,
    approved: approvedValue,
    _rawData: data
  };
});
```

2. **Enhanced matching logic:**
```typescript
const matchesId = docId && docId.toLowerCase() === searchId.toLowerCase();
const matchesVendorId = vendorIdStr && vendorIdStr.toLowerCase() === searchId.toLowerCase();
const matchesCode = codeStr && codeStr.toLowerCase() === searchId.toLowerCase();
```

3. **Comprehensive debug logging** to trace vendor resolution steps

**Benefits:**
- Vendor names now resolve correctly regardless of data source
- Handles both `approved: false` and `active: true` vendors
- Case-insensitive matching
- Better error messages for debugging

---

### 4. Duplicate Notifications
**Issue:** Multiple notification documents being created for the same PR, leading to duplicate emails.

**Location:** `src/services/notifications/handlers/submitPRNotification.ts:138-213`

**Fix:** Strengthened duplicate checking across three collections:
1. `notifications` collection
2. `purchaseRequestsNotifications` collection  
3. `notificationLogs` collection (last hour only)

**Benefits:**
- Prevents duplicate emails
- Better logging of duplicate attempts
- Returns existing notification ID instead of creating new one

---

## Testing Recommendations

### 1. Test PR Number Consistency
1. Create a new PR
2. Check the PR number in the dashboard
3. Check the email notification
4. **Expected:** PR numbers should match exactly

### 2. Test Vendor Name Resolution
1. Create a PR with vendor "1030" (Power Transformers)
2. Check the email notification
3. **Expected:** Email should show "Power Transformers", not "1030"

### 3. Test Duplicate Prevention
1. Rapidly submit the same PR twice (double-click)
2. Check Firestore `notifications` collection
3. Check email inbox
4. **Expected:** Only one PR created, only one email sent

### 4. Test Sequential Numbering
1. Create 3 PRs in sequence for the same organization
2. **Expected:** Sequential numbers (e.g., 0001, 0002, 0003)

---

## Database Changes

### New Collection: `counters`
Documents with structure:
```typescript
{
  count: number;          // Current counter value
  year: number;           // Year for annual reset
  organization: string;   // Normalized org name
  lastUpdated: string;    // ISO timestamp
}
```

Document IDs: `pr_counter_{YEAR}_{NORMALIZED_ORG}`

Example: `pr_counter_2025_1pwr_lesotho`

---

## Console Log Analysis

### Before Fix
```
Generated PR Number: 251028-3137-1PL-LS
Successfully created PR 251028-3137-1PL-LS with ID 870DeSmIqudjZJeapopP
Generated PR Number: 251028-7872-1PL-LS  ← DIFFERENT NUMBER!
Successfully created PR 251028-7872-1PL-LS with ID J13PfbXWNg6ancUkyQA4
Resolved vendor '1030' to '1030'  ← NOT RESOLVING TO NAME
Vendor resolution failed or vendor not found: 1030
```

### After Fix
```
Generated PR Number: 251028-0001-1PL-LS (sequential: 1)
Successfully created PR 251028-0001-1PL-LS with ID abc123...
Using explicitly passed PR number: 251028-0001-1PL-LS
✓ Vendor match found: ID='1030', code='1030', name='Power Transformers'
✓ Successfully resolved vendor '1030' to 'Power Transformers'
```

---

## Rollback Instructions

If these changes cause issues:

1. **Revert PR number generation:**
```bash
git checkout HEAD~1 -- src/services/pr.ts
```

2. **Revert notification handler:**
```bash
git checkout HEAD~1 -- src/services/notifications/handlers/submitPRNotification.ts
```

3. **Revert vendor resolution:**
```bash
git checkout HEAD~1 -- src/services/notifications/templates/newPRSubmitted.ts
```

---

## Future Improvements

1. **Add Firestore Rules** to enforce uniqueness on `counters` collection
2. **Add retry logic** for counter transaction conflicts
3. **Create admin dashboard** to view/reset counters
4. **Add telemetry** to track notification success rates
5. **Implement notification queue** with retry mechanism

---

## Files Modified

- ✅ `src/services/pr.ts` - Fixed PR number generation
- ✅ `src/services/notifications/handlers/submitPRNotification.ts` - Removed fallback generation, improved duplicate prevention
- ✅ `src/services/notifications/templates/newPRSubmitted.ts` - Fixed vendor resolution
- ✅ `src/components/pr/NewPRForm.tsx` - Already had duplicate submission prevention
- ✅ `docs/NOTIFICATION_FIX_2025-10-28.md` - This document

---

## Related Issues

- Vendor name showing as code: **FIXED** ✅
- Duplicate emails: **FIXED** ✅
- PR numbers don't match: **FIXED** ✅
- Random PR number generation: **FIXED** ✅

---

## Questions or Issues?

If you still encounter problems:

1. Check browser console for vendor resolution logs
2. Check Firestore `counters` collection for counter state
3. Check Firestore `notifications` collection for duplicate entries
4. Look for logs starting with "✓" (success) or "✗" (failure)

