# Preferred Quote ID Not Fetched from Firestore - October 29, 2025

## Problem
The validation for non-lowest quote selection was not working because the `preferredQuoteId` field was **not being read** from Firestore when fetching a PR, even though it was being successfully **saved**.

### Symptoms
- User selected a non-lowest quote (575,755 LSL instead of 67,676 LSL)
- The selection was saved to Firestore successfully
- When clicking "Push to Approver", the validation showed `preferredQuoteId: undefined`
- The PR was allowed to push to PENDING_APPROVAL **without required notes**
- Validation logic could not detect that a non-lowest quote was selected

### Console Log Evidence
```javascript
ProcurementActions.tsx:107 Non-lowest quote check: {
  quotesCount: 3, 
  lowestQuoteAmount: 67676, 
  lowestQuoteId: '75ee0339-ab6f-4565-8159-5cb991d05ace', 
  preferredQuoteId: undefined,  // <-- SHOULD NOT BE UNDEFINED!
  preferredQuoteAmount: undefined,
  ...
}
```

## Root Cause
The `getPR` function in `src/services/pr.ts` was **not mapping** the `preferredQuoteId` field from the Firestore document data to the returned `PRRequest` object.

### Missing Code
Line 153 mapped `quotes` but there was no line for `preferredQuoteId`:

```typescript
lineItems: (data.lineItems || []).map((item: any): LineItem => ({ ...item })),
quotes: data.quotes || [],
// preferredQuoteId missing here!
attachments: data.attachments || [],
```

## Solution
Added the `preferredQuoteId` field mapping in the `getPR` function at line 154:

```typescript
lineItems: (data.lineItems || []).map((item: any): LineItem => ({ ...item })),
quotes: data.quotes || [],
preferredQuoteId: data.preferredQuoteId, // ID of the preferred quote selected by procurement
attachments: data.attachments || [],
```

Also updated the debug logging to show the `preferredQuoteId` value when a PR is fetched:

```typescript
console.log(`Successfully fetched PR with ID: ${prId}`, {
  prNumber: pr.prNumber,
  approver: pr.approver || '(not set)',
  approver2: pr.approver2 || '(not set)',
  // ... other fields
  quotesCount: pr.quotes?.length || 0,
  preferredQuoteId: pr.preferredQuoteId || '(not set)', // Added
  rawQuotes: data.quotes || '(no quotes in raw data)'
});
```

## Impact

### Before Fix
✗ Procurement could push high-value PRs to approval without notes even when selecting a more expensive quote  
✗ The non-lowest quote validation never triggered  
✗ No accountability for selecting more expensive vendors  

### After Fix
✓ System correctly identifies when a non-lowest quote is selected  
✓ Validation enforces notes requirement in dual-approval scenarios  
✓ Procurement must justify selecting more expensive quotes  
✓ Full audit trail for quote selection decisions  

## Testing Instructions

1. Create or open a PR in IN_QUEUE status with multiple quotes
2. Ensure the PR amount is above Rule 3 threshold (requires 2 approvers)
3. Select a quote that is **NOT** the lowest quote
4. Click "Push to Approver"
5. **Expected Result:**
   - System should show error: "JUSTIFICATION REQUIRED"
   - Must provide notes explaining why the more expensive quote was selected
   - Cannot push to approval without notes

6. Add notes and click "Push to Approver" again
7. **Expected Result:**
   - PR successfully moves to PENDING_APPROVAL
   - Notes are stored in status history

## Files Modified
- `src/services/pr.ts` - Added `preferredQuoteId` mapping in `getPR` function (line 154)
- `src/services/pr.ts` - Added `preferredQuoteId` to debug logging (line 188)

## Related Features
- Preferred Quote Selection (see `docs/PREFERRED_QUOTE_SELECTION_2025-10-29.md`)
- Non-Lowest Quote Justification (see `docs/NON_LOWEST_QUOTE_JUSTIFICATION_2025-10-29.md`)
- Notification Order Fix (see `docs/NOTIFICATION_ORDER_FIX_2025-10-29.md`)

## Status
✅ **Fixed** - `preferredQuoteId` now correctly fetched from Firestore and validation works as intended


