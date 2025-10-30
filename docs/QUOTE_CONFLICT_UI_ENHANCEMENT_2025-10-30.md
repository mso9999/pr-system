# Quote Conflict Resolution UI Enhancement
**Date:** October 30, 2025  
**Status:** ✅ Completed

## Overview
Enhanced the user interface for quote conflict resolution to provide clear visibility and easy mechanisms for approvers to change their quote selection when conflicts occur.

## Business Requirement
When two approvers select different quotes for a dual-approval PR:
1. The system should clearly show which quote each approver previously selected
2. Approvers must be able to easily change their selection to match the other approver
3. The UI should provide clear context about the conflict status
4. The dialog should pre-select the current approver's previous choice

## Problem Statement
When a quote conflict was detected, approvers saw a red-flagged warning on the main PR view, but when they clicked "Approve" to change their selection:
- Their previous quote selection was not pre-selected
- They couldn't easily see which quote they had previously chosen
- They couldn't see which quote the other approver had chosen
- The dialog didn't provide context that they were resolving a conflict

This made conflict resolution confusing and error-prone.

## Implementation Details

### 1. Pre-select Previous Quote Choice
**File:** `src/components/pr/ApproverActions.tsx` (lines 210-232)

Modified `handleActionClick` to detect conflict scenarios and pre-select the current approver's previous quote choice:

```typescript
const handleActionClick = (action: 'approve' | 'reject' | 'revise' | 'queue') => {
  setSelectedAction(action);
  setIsDialogOpen(true);
  setNotes('');
  setError(null);
  
  // For approval action, initialize selected quote
  if (action === 'approve' && hasMultipleQuotes) {
    // In conflict scenario, pre-select the current approver's previous choice
    if (pr.status === PRStatus.PENDING_APPROVAL && pr.approvalWorkflow?.quoteConflict) {
      const myPreviousQuoteId = isFirstApprover 
        ? pr.approvalWorkflow.firstApproverSelectedQuoteId 
        : pr.approvalWorkflow.secondApproverSelectedQuoteId;
      setSelectedQuoteId(myPreviousQuoteId || pr.preferredQuoteId || lowestQuote?.id || pr.quotes?.[0]?.id || null);
    } else {
      // Normal approval: default to procurement's preferred quote if available, otherwise lowest quote
      const defaultQuoteId = pr.preferredQuoteId || lowestQuote?.id || pr.quotes?.[0]?.id;
      setSelectedQuoteId(defaultQuoteId || null);
    }
  } else {
    setSelectedQuoteId(null);
  }
};
```

**Behavior:**
- In conflict mode: Pre-selects the approver's **previous** choice
- In normal mode: Pre-selects procurement's preferred quote or lowest quote
- Fallback hierarchy: Previous → Preferred → Lowest → First

### 2. Enhanced Quote Selection UI
**File:** `src/components/pr/ApproverActions.tsx` (lines 797-877)

Added visual indicators to show:
- **"Your Previous Selection"** (warning chip) - The quote this approver previously selected
- **"Other Approver's Selection"** (error chip) - The quote the other approver selected
- **"✓ Current Selection"** (primary chip) - The quote currently selected in the dialog

```typescript
// Check if this quote was selected by approvers in conflict scenario
const inConflictMode = pr.status === PRStatus.PENDING_APPROVAL && pr.approvalWorkflow?.quoteConflict;
const isMyPreviousSelection = inConflictMode && (
  (isFirstApprover && quote.id === pr.approvalWorkflow?.firstApproverSelectedQuoteId) ||
  (isSecondApprover && quote.id === pr.approvalWorkflow?.secondApproverSelectedQuoteId)
);
const isOtherApproverSelection = inConflictMode && (
  (isFirstApprover && quote.id === pr.approvalWorkflow?.secondApproverSelectedQuoteId) ||
  (isSecondApprover && quote.id === pr.approvalWorkflow?.firstApproverSelectedQuoteId)
);
```

**Visual Hierarchy:**
```
Quote Box (clickable)
├── Vendor Name
├── Amount (primary color)
└── Chips:
    ├── "Procurement Preferred" (info/blue)
    ├── "Lowest Quote" (success/green)
    ├── "Your Previous Selection" (warning/orange) *NEW*
    ├── "Other Approver's Selection" (error/red) *NEW*
    └── "✓ Current Selection" (primary/blue) - Right side
```

### 3. Conflict Resolution Context Alert
**File:** `src/components/pr/ApproverActions.tsx` (lines 800-810)

Added a warning alert at the top of the quote selection UI when in conflict mode:

```typescript
{pr.status === PRStatus.PENDING_APPROVAL && pr.approvalWorkflow?.quoteConflict && (
  <Alert severity="warning" sx={{ mb: 2 }}>
    <Typography variant="subtitle2" gutterBottom>
      You are resolving a quote conflict
    </Typography>
    <Typography variant="body2">
      You and the other approver selected different quotes. Review the selections below and change your choice if needed to match.
    </Typography>
  </Alert>
)}
```

**Purpose:**
- Provides immediate context that this is a conflict resolution action
- Explains what the approver needs to do
- Appears above the quote list for visibility

### 4. Dialog Title Update
**File:** `src/components/pr/ApproverActions.tsx` (lines 638-656)

The dialog title already had logic (implemented in previous iteration) to change when in conflict mode:

```typescript
const getDialogTitle = () => {
  // Special title for quote conflict resolution
  if (pr.status === PRStatus.PENDING_APPROVAL && pr.approvalWorkflow?.quoteConflict && selectedAction === 'approve') {
    return 'Resolve Quote Conflict - Change Your Selection';
  }
  // ... other titles
};
```

## User Experience Flow

### Before Conflict (Normal Approval)
1. Approver clicks "Approve"
2. Dialog opens with title "Approve PR"
3. Procurement's preferred quote (or lowest) is pre-selected
4. Chips show: "Procurement Preferred", "Lowest Quote", "✓ Current Selection"

### After Conflict Detected
1. **On PR View:** Red-flagged alert shows both approvers' selections
2. Approver clicks "Approve" to resolve conflict
3. Dialog opens with title "**Resolve Quote Conflict - Change Your Selection**"
4. **Warning alert** appears: "You are resolving a quote conflict..."
5. **Approver's previous choice** is pre-selected
6. Each quote shows chips:
   - Their previous: "**Your Previous Selection**" (orange)
   - Other's choice: "**Other Approver's Selection**" (red)
   - Current: "**✓ Current Selection**" (blue)
7. Approver can click any quote to change selection
8. Submit updates their choice and checks for resolution

### Resolution Scenarios

#### Scenario A: Approver Changes to Match
- Approver 1 selected Quote A, Approver 2 selected Quote B
- Approver 2 changes to Quote A
- System detects match → PR moves to `APPROVED` → Status becomes `PO`

#### Scenario B: Approver Reconfirms Different Choice
- Approver 1 selected Quote A, Approver 2 selected Quote B
- Approver 2 reviews and reconfirms Quote B
- Conflict persists → PR stays in `PENDING_APPROVAL` with `quoteConflict: true`
- Daily reminder notifications continue

## Visual Design

### Color Coding
- **Orange (Warning):** Your previous selection - indicating what you chose before
- **Red (Error):** Other approver's selection - indicating the conflicting choice
- **Blue (Primary):** Current selection - indicating what you're about to submit
- **Green (Success):** Lowest quote - indicating price optimization
- **Blue (Info):** Procurement preferred - indicating procurement's recommendation

### Layout
```
┌─────────────────────────────────────────────────────┐
│ ⚠️ Warning Alert: You are resolving a conflict     │
└─────────────────────────────────────────────────────┘

Select Quote to Approve:

┌─────────────────────────────────────────────────────┐
│ Vendor ABC                    ┌──────────────────┐ │
│ 50,000.00 LSL                 │✓ Current Selection│ │
│ [Lowest Quote] [Your Previous Selection]           │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ Vendor XYZ                                          │
│ 55,000.00 LSL                                       │
│ [Procurement Preferred] [Other Approver's Selection]│
└─────────────────────────────────────────────────────┘
```

## Testing Scenarios

✅ **Scenario 1: Initial Dual Approval**
- Both approvers approve same quote → PR moves to APPROVED ✓

✅ **Scenario 2: Conflict Creation**
- Approver 1 approves Quote A → Waits for Approver 2
- Approver 2 approves Quote B → Conflict detected, stays PENDING_APPROVAL ✓

✅ **Scenario 3: Conflict Resolution by Change**
- Conflict exists (A vs B)
- Approver 1 opens dialog → Sees Quote A pre-selected with "Your Previous"
- Approver 1 clicks Quote B → Sees orange chip move to B
- Approver 1 submits → Conflict resolved, PR moves to APPROVED ✓

✅ **Scenario 4: Conflict Persistence**
- Conflict exists (A vs B)
- Approver 2 opens dialog → Sees Quote B pre-selected
- Approver 2 reviews notes, confirms Quote B is better
- Approver 2 resubmits Quote B → Conflict persists ✓

✅ **Scenario 5: Multiple Quote Selection Visibility**
- 3 quotes: A (lowest), B (preferred), C (premium)
- Approver 1 selected B, Approver 2 selected A
- Both can see all chips clearly distinguishing each quote ✓

## Benefits

1. **Reduced Confusion:** Approvers immediately see their previous choice
2. **Clear Visibility:** Both selections are visible simultaneously
3. **Informed Decisions:** Approvers can compare their choice with the other's
4. **Easier Resolution:** One-click to change to match other approver
5. **Context Awareness:** Dialog and alerts make it clear this is conflict resolution
6. **Error Prevention:** Pre-selection prevents accidental re-selection of same quote

## Related Files
- `src/components/pr/ApproverActions.tsx` - Quote conflict resolution logic and UI
- `src/types/pr.ts` - ApprovalWorkflow interface with quote tracking fields
- `docs/APPROVER_QUOTE_SELECTION_REVISED_2025-10-30.md` - Overall quote selection system
- `docs/UNIFIED_NOTES_FIELD_2025-10-30.md` - Unified notes field implementation

## Future Enhancements
- Add tooltips explaining why each approver selected their quote
- Show quote comparison side-by-side in conflict scenario
- Add chat/comment feature for approvers to discuss quote selection
- Track number of times an approver changes their selection
- Show quote selection reasoning from procurement in the dialog

