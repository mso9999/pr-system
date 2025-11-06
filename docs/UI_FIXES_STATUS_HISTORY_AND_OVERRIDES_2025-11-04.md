# UI Fixes: Status History & Overrides Display

**Date:** November 4, 2025, 13:25 UTC  
**Issues Fixed:**
1. Status history showing "System" user with email in notes
2. Override justifications not accessible in UI

**Status:** ✅ FIXED

---

## Issue #1: "System" User in Status History

### The Problem

Status history was displaying:
- **User:** "System"
- **Notes:** "By: phoka@1pwrafrica.com"

Instead of:
- **User:** "phoka@1pwrafrica.com"
- **Notes:** "PO moved to ORDERED status"

### Root Cause

**Function parameters were in the wrong order!**

The `updatePRStatus` function signature is:
```typescript
updatePRStatus(prId, status, notes?, user?)
```

But we were calling it as:
```typescript
updatePRStatus(prId, status, userObject, 'notes')  // WRONG ORDER!
```

This caused:
- The `user` object was passed as the `notes` parameter
- The `notes` string was passed as the `user` parameter
- Since `notes` is a string (not a UserReference), it defaulted to "System"
- The user object ended up in the notes field, triggering the fallback rendering logic we added earlier

### The Fix

**File:** `src/components/pr/ApprovedStatusActions.tsx` (lines 443-452)

**BEFORE (WRONG):**
```typescript
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
```

**AFTER (CORRECT):**
```typescript
await prService.updatePRStatus(
  pr.id, 
  PRStatus.ORDERED, 
  'PO moved to ORDERED status', // notes parameter (3rd)
  {  // user parameter (4th)
    id: currentUser.id,
    email: currentUser.email,
    name: currentUser.name || currentUser.email
  }
);
```

### Expected Result

Now the status history will display:
- **User:** "Phoka Raphoka" or "phoka@1pwrafrica.com"
- **Notes:** "PO moved to ORDERED status"

---

## Issue #2: Override Justifications Not Accessible

### The Problem

The user asked: *"Where are the override justifications accessible?"*

Override justifications were being saved correctly:
- `proformaOverrideJustification`
- `popOverrideJustification`
- `poDocumentOverrideJustification`
- `finalPriceVarianceOverrideJustification`

But there was **no UI section** to view them after they were set.

### The Fix

Added a new **"Overrides & Exceptions"** section in `PRView.tsx` (lines 2365-2445).

**Location:** Displayed right after the Status History table, before the stepper.

**Visibility:** Only shown when at least one override is active.

**Features:**
- ⚠️ Yellow warning background to highlight exceptions
- 📄 Proforma Invoice Override card
- 💰 Proof of Payment Override card
- 📋 PO Document Override card
- 💲 Final Price Variance Override card (with variance % and amounts)
- Each card shows the full justification text
- Final price variance shows:
  - Variance percentage (e.g., +54.39%)
  - Approved amount vs Final price comparison
  - Management review flag status

### UI Example

When viewing a PO with overrides, you'll now see:

```
⚠️ Overrides & Exceptions

[Yellow warning box with cards:]

📄 Proforma Invoice Override
Justification: reasons

💰 Proof of Payment Override  
Justification: reasons

💲 Final Price Variance Override
Variance: +54.39% (Approved: LSL 575,755.00 → Final: LSL 888,888.00)
Justification: raisons
⚠️ This override has been flagged for management review (finalPriceRequiresApproval: Yes)
```

---

## Testing

### Test Status History Fix:
1. Navigate to an ORDERED PO
2. Check Status History table
3. Verify the latest entry shows:
   - User: Your name/email (not "System")
   - Notes: "PO moved to ORDERED status" (not "By: email")

### Test Overrides Display:
1. Navigate to any PO with overrides (APPROVED or ORDERED status)
2. Scroll to the "Overrides & Exceptions" section
3. Verify all active overrides are displayed
4. Verify justifications are fully visible
5. For final price variance, verify:
   - Percentage is calculated correctly
   - Amounts are formatted with currency
   - Management review flag is shown

---

## Files Modified

1. **`src/components/pr/ApprovedStatusActions.tsx`**
   - Lines 443-452: Fixed parameter order in `updatePRStatus` call

2. **`src/components/pr/PRView.tsx`**
   - Lines 2365-2445: Added "Overrides & Exceptions" display section

---

## Benefits

### For Users:
- ✅ Clear visibility of all exceptions/overrides in one place
- ✅ Full justification text is accessible for audit purposes
- ✅ Visual warning (yellow background) highlights non-standard workflows
- ✅ Final price variance details are easy to understand

### For Auditors:
- ✅ All override justifications are documented and visible
- ✅ Management review requirements are clearly flagged
- ✅ Variance calculations are transparent

### For Management:
- ✅ Easy to identify POs that bypassed standard procedures
- ✅ Justifications are required and visible for review
- ✅ Can quickly assess risk (e.g., high variance overrides)

---

## Related Documentation

- `docs/STATUS_UPDATE_FINALLY_WORKS_2025-11-04.md` - Status update implementation
- `docs/FINAL_PRICE_VARIANCE_OVERRIDE_2025-11-03.md` - Variance override feature
- `Specifications.md` - Section on overrides and exceptions

---

## Next Test

After refreshing the page:
1. The status history should show the correct user
2. The overrides section should be visible with all justifications

This completes the UI improvements for transparency and auditability! 🎉





