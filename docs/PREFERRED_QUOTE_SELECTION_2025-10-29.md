# Preferred Quote Selection Feature

**Date:** October 29, 2025
**Status:** Completed

## Overview

Implemented a feature that allows procurement users to select a preferred quote when a PR has multiple quotes during the IN_QUEUE status. When a preferred quote is selected, the PR's estimated amount is automatically updated to match the selected quote's amount.

## Business Requirements

### Who Can Use
- **Procurement Users (Level 3)** or **Administrators (Level 1)**

### When Available
- **Status:** IN_QUEUE only
- **Condition:** PR must have 2 or more quotes

### Functionality
1. Procurement sees a radio button next to each quote
2. Selecting a radio button marks that quote as preferred
3. The PR's `estimatedAmount` is automatically updated to match the selected quote's amount
4. The PR's `preferredQuoteId` is set to the selected quote's ID
5. Changes are saved immediately to Firebase
6. Success notification shows the new amount

## Implementation Details

### 1. Database Schema (`src/types/pr.ts`)
Added new field to `PRRequest` interface:
```typescript
/** ID of the preferred quote selected by procurement (for multi-quote situations) */
preferredQuoteId?: string;
```

### 2. UI Component (`src/components/pr/steps/QuotesStep.tsx`)

**New Props:**
- `isProcurement`: Boolean to identify procurement users
- `onPreferredQuoteChange`: Callback when preferred quote is selected
- `formState.preferredQuoteId`: Tracks the currently selected preferred quote
- `formState.status`: Used to determine if PR is in IN_QUEUE status

**Visual Enhancements:**
- Added "Preferred" column header (only visible when applicable)
- Radio button for each quote (green color for success theme)
- Selected row highlighted with green background (`rgba(76, 175, 80, 0.08)`)
- Tooltip on hover explains the selection
- Help text above table when multi-quote selection is available

**Conditional Display:**
```typescript
const canSelectPreferred = isProcurement && isInQueue && quotes.length > 1;
```

### 3. Business Logic (`src/components/pr/PRView.tsx`)

**New Handler:**
```typescript
const handlePreferredQuoteChange = async (quoteId: string) => {
  // 1. Find the selected quote
  // 2. Update preferredQuoteId and estimatedAmount
  // 3. Save to Firebase
  // 4. Update local state
  // 5. Show success notification
};
```

**Integration:**
- Passes `isProcurement` prop to QuotesStep
- Passes `onPreferredQuoteChange` handler
- Updates happen in real-time
- Optimistic UI update (local state updated immediately)

### 4. Documentation (`Specifications.md`)

Added comprehensive documentation in the "PR Processing in IN_QUEUE Status" section:
- Who can select preferred quotes
- When the feature is available
- UI mechanism (radio button/checkbox)
- Automatic updates performed
- Purpose and audit trail considerations
- Validation requirements

## User Experience Flow

1. **Procurement views PR in IN_QUEUE status with multiple quotes**
   - Sees help text: "Select the preferred quote to use for approval. The PR amount will be updated automatically."
   - Sees "Preferred" column with radio buttons

2. **Procurement selects a quote**
   - Clicks radio button next to desired quote
   - Row highlights with green background
   - Checkmark icon appears (via Radio component)

3. **System automatically updates**
   - PR's `estimatedAmount` updates to match selected quote amount
   - PR's `preferredQuoteId` set to the quote's ID
   - Changes saved to Firebase immediately
   - Success notification: "Preferred quote selected. PR amount updated to [amount] [currency]"

4. **Visual confirmation**
   - Selected row remains highlighted
   - Other users viewing the PR see the selection
   - Amount field in Basic Information reflects new value

## Technical Highlights

### Automatic Amount Synchronization
When a preferred quote is selected:
```typescript
const updates = {
  preferredQuoteId: quoteId,
  estimatedAmount: selectedQuote.amount,  // Automatic sync
  updatedAt: new Date().toISOString()
};
```

### Validation Support
The `preferredQuoteId` can be used in validation logic before pushing to PENDING_APPROVAL:
- Verify a preferred quote was selected (if required by business rules)
- Ensure the amount matches the selected quote
- Audit trail of which quote was chosen

### UI State Management
- Radio button group ensures only one quote can be selected
- Green color (`color="success"`) indicates positive action
- Row highlighting provides clear visual feedback
- Tooltip provides contextual help

## Files Modified

| File | Changes |
|------|---------|
| `Specifications.md` | Added documentation for preferred quote selection feature |
| `src/types/pr.ts` | Added `preferredQuoteId?: string` field to PRRequest interface |
| `src/components/pr/steps/QuotesStep.tsx` | Added radio button column, preferred quote selection logic |
| `src/components/pr/PRView.tsx` | Added `handlePreferredQuoteChange` handler, integrated with QuotesStep |

## Testing Recommendations

1. **Basic Flow**
   - Create PR with 3 quotes in IN_QUEUE status
   - Verify radio buttons appear for procurement user
   - Select a quote and verify amount updates
   - Refresh page and verify selection persists

2. **Permissions**
   - Verify only procurement (Level 3) or admin (Level 1) see radio buttons
   - Verify feature not available in other statuses
   - Verify feature not shown when PR has only 1 quote

3. **Edge Cases**
   - Test with quotes in different currencies
   - Verify validation errors if quote amount is invalid
   - Test changing preferred quote selection
   - Verify amount updates correctly when switching between quotes

4. **UI/UX**
   - Verify row highlighting works correctly
   - Verify tooltips display properly
   - Verify success notification shows correct amount
   - Verify table layout responsive with new column

## Future Enhancements

Potential improvements for future iterations:
1. **Bulk Quote Comparison:** Side-by-side comparison view for all quotes
2. **Justification Notes:** Require procurement to add notes explaining why a particular quote was selected
3. **Quote Rankings:** Automatically suggest preferred quote based on criteria (lowest price, best terms, etc.)
4. **History Tracking:** Show history of preferred quote changes
5. **Approval Impact:** Show which approvers are needed based on selected quote amount
6. **Currency Normalization:** Show all quotes in a common currency for easier comparison


