# Final Price Variance Override Feature

**Date:** November 3, 2025, 18:00 UTC  
**Feature:** Override Warning Dialog for Final Price Variance  
**Status:** ✅ IMPLEMENTED

---

## Overview

When moving a PO from APPROVED to ORDERED status, if the final price exceeds Rule 6 (+5%) or Rule 7 (-20%) thresholds, the system now shows a **warning dialog** requiring justification instead of blocking the move completely.

This provides **flexibility with accountability** - procurement can override the variance but must document why.

---

## User Flow

### Scenario: Final Price Exceeds Threshold

**Example:**
- Approved Amount: 575,755 LSL
- Final Price Entered: 888,888 LSL
- Variance: **+54.3%** (exceeds 5% threshold)

**What Happens:**

1. **User clicks "Move to ORDERED Status"**
   - System performs standard validations (ETD, Proforma, PoP)
   - All pass ✅

2. **System detects price variance**
   - Calculates: `(888,888 - 575,755) / 575,755 = 54.3%`
   - Compares to Rule 6 threshold: 5%
   - **Exceeds threshold!**

3. **Warning Dialog Appears**
   - ⚠️ Orange/yellow header: "Final Price Variance Exceeds Threshold"
   - Shows comparison:
     ```
     • Approved Amount: LSL 575,755.00
     • Final Price: LSL 888,888.00
     • Variance: +54.36%
     ```
   - Message: "This exceeds the upward threshold of 5% (Rule 6)"
   - **Required:** Multi-line text field for justification (max 500 chars)
   - Character counter: "0/500 characters"

4. **User Has Two Options:**

   **Option A: Cancel**
   - Closes dialog
   - Returns to APPROVED status
   - No changes made
   - User can:
     - Adjust final price to be within threshold
     - Get additional approvals
     - Review with finance team

   **Option B: Proceed with Override**
   - User types justification (e.g., "Supplier increased price due to currency fluctuation. Finance team approved via email 2025-11-03.")
   - Button "Proceed with Override" becomes enabled
   - Click button
   - System saves:
       - `finalPriceVarianceOverride: true`
       - `finalPriceVarianceOverrideJustification: "[user's text]"`
       - `finalPriceRequiresApproval: true`
   - Info notification: "Final price variance override recorded"
   - PO moves to ORDERED status
   - Success notification: "PO moved to ORDERED status successfully"
   - Navigates to dashboard after 500ms

---

## Dialog UI Design

### Header
```
⚠️ Final Price Variance Exceeds Threshold
(Orange/yellow background)
```

### Warning Alert Box (Yellow)
```
Price Variance Detected

The final price differs significantly from the approved amount:

• Approved Amount: LSL 575,755.00
• Final Price: LSL 888,888.00
• Variance: +54.36%  (shown in red if positive, orange if negative)

This exceeds the upward threshold of 5% (Rule 6).
```

### Instructions
```
To proceed with moving this PO to ORDERED status despite the price variance, 
you must provide a justification. This will be recorded in the audit trail 
and may require additional review.
```

### Justification Input
```
[Multi-line text field, 4 rows]
Label: "Justification for Price Variance Override"
Placeholder: "Explain why the final price differs significantly from the 
approved amount (e.g., currency fluctuation, additional requirements, 
supplier price changes, etc.)"
Character counter: "245/500 characters"
```

### Action Buttons
```
[Cancel]  [Proceed with Override]
           (disabled until text entered)
           (warning color - orange)
```

---

## Technical Implementation

### Files Modified

**1. `src/types/pr.ts`** (lines 193-196)
```typescript
/** Flag indicating final price variance override is used */
finalPriceVarianceOverride?: boolean;
/** Justification note if final price variance override is set */
finalPriceVarianceOverrideJustification?: string;
```

**2. `src/services/pr.ts`** (lines 203-204)
- Added fields to `getPR()` mapping for retrieval from database

**3. `src/components/pr/ApprovedStatusActions.tsx`**

**Added State (lines 69-77):**
```typescript
const [finalPriceVarianceDialog, setFinalPriceVarianceDialog] = useState(false);
const [finalPriceVarianceJustification, setFinalPriceVarianceJustification] = useState('');
const [finalPriceVarianceData, setFinalPriceVarianceData] = useState<{
  approvedAmount: number;
  finalPrice: number;
  variancePercentage: number;
  exceedsUpward: boolean;
  exceedsDownward: boolean;
} | null>(null);
```

**Modified `handleMoveToOrdered()` (lines 364-434):**
- Performs validations (ETD, Proforma, PoP)
- Checks final price variance
- If exceeds threshold:
  - Sets variance data
  - Shows override dialog
  - Returns (waits for user decision)
- If within threshold or override approved:
  - Calls `performMoveToOrdered()`

**Added `performMoveToOrdered()` (lines 436-481):**
- Extracted actual move logic
- Called after validations/overrides complete
- Updates status to ORDERED
- Sends notifications
- Navigates to dashboard

**Added `handleFinalPriceVarianceOverride()` (lines 483-514):**
- Validates justification is entered
- Saves override flags to database
- Shows confirmation
- Refreshes PR data
- Proceeds with move to ORDERED

**Added Dialog UI (lines 977-1060):**
- Warning styled dialog
- Shows variance details
- Justification text input
- Cancel and Proceed buttons

---

## Validation Logic

### When Variance Check Triggers:
```typescript
if (pr.finalPrice && pr.lastApprovedAmount) {
  const variancePercentage = ((finalPrice - approved) / approved) * 100;
  
  const exceedsUpward = variancePercentage > 5;      // Rule 6
  const exceedsDownward = variancePercentage < -20;  // Rule 7
  
  if (exceedsUpward || exceedsDownward) {
    // Show override dialog
  }
}
```

### Scenarios:

**1. No Final Price Entered:**
```
pr.finalPrice = undefined
→ No variance check
→ Proceeds to ORDERED normally
```

**2. Within Thresholds:**
```
Approved: 100,000
Final:    104,000 (+4%)
→ No dialog
→ Proceeds to ORDERED normally
```

**3. Upward Variance Exceeds:**
```
Approved: 100,000
Final:    106,000 (+6%)
→ Shows override dialog (exceeds +5%)
→ Requires justification
```

**4. Downward Variance Exceeds:**
```
Approved: 100,000
Final:     75,000 (-25%)
→ Shows override dialog (exceeds -20%)
→ Requires justification
```

**5. Exactly at Threshold:**
```
Approved: 100,000
Final:    105,000 (+5.0%)
→ No dialog (not > 5%, equality allowed)
```

---

## Database Fields Saved

When user proceeds with override:

```javascript
{
  finalPriceVarianceOverride: true,
  finalPriceVarianceOverrideJustification: "Supplier increased price due to currency fluctuation...",
  finalPriceRequiresApproval: true,
  updatedAt: "2025-11-03T18:00:00.000Z"
}
```

These fields are permanently stored with the PO for audit purposes.

---

## Console Logging

### When Variance Detected:
```
Final price variance check: {
  approvedAmount: 575755,
  finalPrice: 888888,
  variancePercentage: 54.36,
  upwardThreshold: 5,
  downwardThreshold: 20,
  exceedsUpward: true,
  exceedsDownward: false,
  requiresApproval: false,
  isApproved: false
}

Final price variance exceeds threshold - showing override dialog
```

### When Override Applied:
```
Applying final price variance override with justification

pr.ts: Updating PR [id] with data: {
  finalPriceVarianceOverride: true,
  finalPriceVarianceOverrideJustification: "...",
  finalPriceRequiresApproval: true,
  updatedAt: "..."
}

pr.ts: Successfully updated PR [id]

Moving PO to ORDERED status: {prId: '...', prNumber: '...'}
```

---

## Testing Instructions

### Test 1: Small Variance (No Dialog)

1. Create PO with approved amount: 100,000 LSL
2. Enter final price: 104,000 LSL (+4%)
3. Set ETD, Proforma override, PoP override
4. Click "Move to ORDERED Status"
5. ✅ **Expected:** Moves directly to ORDERED, no dialog

### Test 2: Large Upward Variance (Dialog)

1. Create PO with approved amount: 100,000 LSL
2. Enter final price: 110,000 LSL (+10%)
3. Set ETD, Proforma override, PoP override
4. Click "Move to ORDERED Status"
5. ✅ **Expected:** Warning dialog appears
6. Click "Cancel"
7. ✅ **Expected:** Returns to APPROVED status, no changes
8. Click "Move to ORDERED Status" again
9. Dialog appears again
10. Enter justification: "Supplier raised price, approved by CFO"
11. Click "Proceed with Override"
12. ✅ **Expected:** 
    - Info notification: "Final price variance override recorded"
    - Success notification: "PO moved to ORDERED status successfully"
    - Navigates to dashboard
    - PO appears under ORDERED tab

### Test 3: Large Downward Variance (Dialog)

1. Create PO with approved amount: 100,000 LSL
2. Enter final price: 75,000 LSL (-25%)
3. Set ETD, Proforma override, PoP override
4. Click "Move to ORDERED Status"
5. ✅ **Expected:** Warning dialog appears showing:
   - Variance: -25.00%
   - "This exceeds the downward threshold of -20% (Rule 7)"
6. Enter justification: "Supplier offered discount for bulk order"
7. Click "Proceed with Override"
8. ✅ **Expected:** PO moves to ORDERED

### Test 4: No Final Price (No Dialog)

1. Create PO with approved amount: 100,000 LSL
2. DO NOT enter final price
3. Set ETD, Proforma override, PoP override
4. Click "Move to ORDERED Status"
5. ✅ **Expected:** Moves directly to ORDERED, no dialog

### Test 5: Justification Required

1. Trigger variance dialog (final price +10%)
2. Click "Proceed with Override" without typing anything
3. ✅ **Expected:** Button is disabled (grayed out)
4. Type 1 character
5. ✅ **Expected:** Button becomes enabled
6. Clear text
7. ✅ **Expected:** Button becomes disabled again

### Test 6: Character Limit

1. Trigger variance dialog
2. Start typing long justification
3. ✅ **Expected:** Counter updates: "50/500 characters"
4. Try to type beyond 500 characters
5. ✅ **Expected:** Text stops at 500 chars, can't type more

---

## Audit Trail

### What Gets Recorded:

1. **Override Flag:** `finalPriceVarianceOverride: true`
2. **Justification:** Full text entered by user
3. **Approval Flag:** `finalPriceRequiresApproval: true` (for future review)
4. **Timestamp:** `updatedAt` records when override was applied
5. **User:** Tracked via session (procurement officer who applied override)

### Future Enhancements:

- Add `finalPriceVarianceOverrideBy` field (user reference)
- Add `finalPriceVarianceOverrideAt` field (timestamp)
- Add to history/audit log
- Email notifications to finance team when variance override is used
- Dashboard report showing all variance overrides

---

## Business Rules

### Rule 6: Upward Variance Threshold
- **Default:** 5%
- **Applies to:** Final price > Approved amount
- **Example:** Approved 100K, Final 106K (+6%) → Triggers override

### Rule 7: Downward Variance Threshold
- **Default:** 20%
- **Applies to:** Final price < Approved amount
- **Example:** Approved 100K, Final 75K (-25%) → Triggers override

### Both Rules:
- Stored in organization settings
- Can be customized per organization
- Currently hardcoded as 5% and 20% (TODO: fetch from org settings)

---

## Security & Compliance

### Who Can Override:
- ✅ Procurement Officers (permission level 3)
- ✅ Finance Admins (permission level 4)
- ✅ System Admins (permission level 1)

### Justification Requirements:
- **Minimum:** 1 character (button enables)
- **Maximum:** 500 characters
- **Required:** Cannot proceed without text
- **Stored:** Permanently in database
- **Auditable:** Available for review and reporting

### Recommended Justifications:
- Currency fluctuation details
- Supplier price changes (with reference)
- Additional requirements added
- Bulk discount received
- Market price changes
- Emergency procurement circumstances
- Management approval (with name/date)

---

## Known Limitations

### 1. Thresholds Hardcoded
Currently uses default 5% / 20%. Future enhancement will fetch from organization settings.

### 2. No Email Notifications
Override is recorded but doesn't trigger email to finance team. Future enhancement.

### 3. No Approval Workflow
Override allows immediate move to ORDERED. Future phase may require finance admin approval for large variances.

### 4. Single Override
Can only override once per PO. If variance changes again, would need manual intervention.

---

## Comparison: Before vs After

### Before This Feature:
```
Variance > 5%
→ ❌ BLOCKED
→ Error message
→ No way to proceed
→ User stuck
```

### After This Feature:
```
Variance > 5%
→ ⚠️ WARNING DIALOG
→ Requires justification
→ User can proceed with documentation
→ Audit trail maintained
→ Flexibility with accountability ✅
```

---

## Success Criteria

✅ **Dialog appears when variance exceeds thresholds**  
✅ **Shows clear variance calculation**  
✅ **Requires justification to proceed**  
✅ **Saves override to database**  
✅ **Allows cancel to go back**  
✅ **Moves to ORDERED after override**  
✅ **No linter errors**  
✅ **Console logging comprehensive**  
✅ **User-friendly messaging**  
✅ **Character limit enforced**  

**Status:** FEATURE COMPLETE AND READY FOR TESTING! 🎉

---

## Related Documentation

- `docs/TWO_CRITICAL_FIXES_2025-11-03.md` - Initial blocking implementation
- `docs/FINAL_PRICE_APPROVAL_FEATURE_2025-11-02.md` - Overall final price feature spec
- `Specifications.md` (lines 1202-1252) - Final price variance requirements
- `docs/RULES_TEMPLATE_GUIDE.md` - Rule 6 & 7 definitions





