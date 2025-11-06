# CRITICAL BUG FIX: updatePR() Was Stripping Status Field

**Date:** November 4, 2025, 13:10 UTC  
**Issue:** PO status not updating from APPROVED to ORDERED  
**Root Cause:** `updatePR()` function explicitly removes `status` field  
**Status:** ✅ FIXED

---

## The Problem

The PO was **not moving from APPROVED to ORDERED** despite all overrides being in place and the update appearing to succeed.

### Console Evidence

```javascript
// ApprovedStatusActions.tsx line 453
await prService.updatePR(pr.id, {
  status: 'ORDERED',           // ❌ This was being DELETED!
  updatedAt: '...',
  orderedAt: '...'
});

// pr.ts:366 debug log showed:
Firestore update payload: {allKeys: Array(2)}  // Only 2 keys, not 3!

// pr.ts:377
Successfully updated PR ✅ (but status wasn't updated!)

// pr.ts:218 (after forceServerFetch)
Successfully fetched PR {status: 'APPROVED'} ❌
```

---

## Root Cause

In `src/services/pr.ts` (lines 339-341), the `updatePR()` function has this code:

```typescript
// Remove status if present (should use updatePRStatus for status updates)
if ('status' in updateData) {
  delete (updateData as any).status;
}
```

**This intentionally strips the `status` field before updating!**

The function's design philosophy is:
- `updatePR()` - for general field updates (status is NOT allowed)
- `updatePRStatus()` - specifically for status changes (includes status history)

---

## Why This Wasn't Caught Earlier

1. **Silent Failure:** No error was thrown - the update "succeeded" with only 2 fields
2. **Misleading Logs:** Console said "Successfully updated PR" but status wasn't actually changed
3. **Caching Red Herring:** We focused on Firestore caching issues, which masked the real bug
4. **Security Rules Red Herring:** We fixed security rules (which were also broken), but that wasn't the main issue

---

## The Fix

Updated `src/components/pr/ApprovedStatusActions.tsx` (lines 437-492):

```typescript
const performMoveToOrdered = async () => {
  try {
    // FIRST: Update status using updatePRStatus (doesn't strip status field)
    await prService.updatePRStatus(
      pr.id, 
      PRStatus.ORDERED, 
      {
        id: currentUser.id,
        email: currentUser.email,
        name: currentUser.name || currentUser.email
      },
      'PO moved to ORDERED status'
    );

    // SECOND: Update additional fields like orderedAt and ETD
    const additionalUpdates: any = {
      orderedAt: new Date().toISOString()
    };

    if (etd && etd !== pr.estimatedDeliveryDate) {
      additionalUpdates.estimatedDeliveryDate = etd;
    }

    await prService.updatePR(pr.id, additionalUpdates);
    
    // ... rest of the function (notifications, navigation)
  } catch (error) {
    console.error('Error moving to ORDERED:', error);
    enqueueSnackbar('Failed to move PO to ORDERED status', { variant: 'error' });
  }
};
```

---

## Benefits of This Approach

1. **Status History:** `updatePRStatus()` automatically creates status history entries
2. **Approval Rescinding:** `updatePRStatus()` checks if status is reverting from PO→PR and rescind approvals if needed
3. **Cleaner Code:** Uses the correct service function for each purpose
4. **Better Audit Trail:** Status changes are properly logged in `statusHistory`

---

## Testing

After this fix, the status update should:
1. ✅ Change status from APPROVED to ORDERED in database
2. ✅ Add status history entry with timestamp and user
3. ✅ Set `orderedAt` timestamp
4. ✅ Update ETD if changed
5. ✅ Display PO in ORDERED tab on dashboard

---

## Lessons Learned

1. **Read Service Function Comments:** The comment on line 324 said "except status, which should use updatePRStatus" - we should have caught this!
2. **Check Debug Logs Carefully:** The `allKeys: Array(2)` should have been a red flag (3 fields sent, only 2 in payload)
3. **Use Correct Service Functions:** Don't bypass the service layer's design - use `updatePRStatus` for status changes
4. **Multiple Bugs Can Compound:** We had BOTH security rules issues AND this bug - fixing security rules alone wasn't enough

---

## Related Fixes

This issue surfaced after we fixed:
1. Firestore caching issues (added `forceServerFetch`)
2. Security rules (allowed procurement users to update PRs)

But the REAL issue was using the wrong service function all along!





