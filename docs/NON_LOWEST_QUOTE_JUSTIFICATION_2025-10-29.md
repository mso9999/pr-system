# Non-Lowest Quote Justification Requirement

**Date:** October 29, 2025  
**Feature:** Mandatory notes when selecting non-lowest quote in dual approval scenarios

## Business Rule

**Requirement:** When pushing a PR from IN_QUEUE to PENDING_APPROVAL in a dual approval scenario (PR amount > Rule 3 threshold), if procurement selects a quote that is NOT the lowest quote, they MUST provide notes explaining why.

### Why This Rule Exists

In high-value purchases requiring dual approval (2 approvers), selecting a more expensive quote over the lowest quote requires justification for:
- **Financial accountability:** Approvers need to understand why more money is being spent
- **Audit trail:** Documentation of procurement decision-making process
- **Transparency:** Clear reasoning for vendor selection
- **Compliance:** Meeting organizational purchasing policies

## When Notes Are Required

### Conditions (ALL must be true):
1. **Status Transition:** Moving from IN_QUEUE → PENDING_APPROVAL
2. **Dual Approval:** PR amount ≥ Rule 3 threshold (e.g., 50,000 LSL)
3. **Multiple Quotes:** PR has 2 or more quotes
4. **Non-Lowest Selected:** Preferred quote is NOT the lowest-priced quote

### When Notes Are NOT Required:
- PR amount < Rule 3 threshold (single approver)
- Only one quote exists
- Lowest quote is selected as preferred
- Any other status transition

## Implementation

### 1. Specifications Updated

**File:** `Specifications.md`  
**Section:** "PR Processing in IN_QUEUE Status" → "Preferred Quote Selection"

Added:
```markdown
- **Notes Requirement for Non-Lowest Quote Selection:**
  - **When Required:** In dual approval scenarios (PR amount above Rule 3 threshold requiring 2 approvers), 
    if procurement selects a quote that is NOT the lowest quote
  - **Validation:** Notes field becomes MANDATORY (cannot be empty) when pushing from IN_QUEUE to PENDING_APPROVAL
  - **Purpose:** Requires procurement to provide justification for selecting a more expensive quote
  - **User Experience:** System displays clear validation error if notes are missing when lowest quote not selected
  - **Storage:** Notes are stored in the PR's status history and visible to all approvers
```

### 2. Validation Logic

**File:** `src/components/pr/ProcurementActions.tsx`  
**Lines:** 107-147

**Logic Flow:**
1. After standard PR validation passes
2. Check if Rule 3 and Rule 5 exist
3. Check if PR amount ≥ Rule 3 threshold (dual approval required)
4. If dual approval scenario:
   - Get all quotes
   - Find lowest quote (by amount)
   - Find preferred quote (by `preferredQuoteId`)
   - Compare: Is preferred ≠ lowest?
   - If YES and notes are empty → **BLOCK with error**

**Error Message:**
```
JUSTIFICATION REQUIRED:

You have selected a quote (67,676 LSL) that is NOT the lowest quote (55,000 LSL).

For high-value PRs requiring dual approval, you must provide notes explaining 
why a more expensive quote was selected.
```

### 3. UI Enhancements

**File:** `src/components/pr/ProcurementActions.tsx`  
**Lines:** 54-79, 453-475

#### Dynamic Helper Function
Created `checkIfNotesRequired` that:
- Runs as a React `useMemo` hook
- Checks all conditions in real-time
- Returns `true` if notes are required, `false` otherwise

#### Dialog Text (Dynamic)
**When Notes Optional:**
```
Add optional notes before pushing this PR to the approver.
```

**When Notes Required:**
```
⚠️ NOTES REQUIRED: You have selected a quote that is NOT the lowest. 
For high-value PRs requiring dual approval, you must provide justification 
for selecting a more expensive quote.
```

#### TextField Properties
- `required={... || checkIfNotesRequired}` - Red asterisk shown when needed
- `helperText={checkIfNotesRequired ? 'Required: Explain why a higher quote was selected' : ''}` - Inline guidance

### 4. Console Logging

Added detailed logging for debugging:
```javascript
console.log('Non-lowest quote check:', {
  quotesCount: quotes.length,
  lowestQuoteAmount: lowestQuote.amount,
  lowestQuoteId: lowestQuote.id,
  preferredQuoteId: pr.preferredQuoteId,
  preferredQuoteAmount: preferredQuote?.amount,
  notesProvided: !!notes.trim(),
  isDualApproval: true,
  rule3Threshold: rule3.threshold
});
```

## User Experience Flow

### Scenario 1: Lowest Quote Selected (Notes Optional)
1. Open PR in IN_QUEUE (amount = 67,000 LSL, quotes: 55k, 67k, 75k)
2. Select lowest quote (55k) as preferred
3. Click "Push to Approver"
4. Dialog shows: "Add optional notes..." ✅
5. Notes field is optional
6. Can proceed with or without notes

### Scenario 2: Higher Quote Selected (Notes Required)
1. Open PR in IN_QUEUE (amount = 67,000 LSL, quotes: 55k, 67k, 75k)
2. Select middle quote (67k) as preferred
3. Click "Push to Approver"
4. Dialog shows: "⚠️ NOTES REQUIRED: You have selected a quote that is NOT the lowest..." 🚨
5. Notes field shows red asterisk (*)
6. Helper text: "Required: Explain why a higher quote was selected"
7. **If user clicks Confirm without notes:**
   - Red error alert appears
   - Shows exact amounts: selected vs. lowest
   - Action is blocked ❌
8. **User adds notes:** "Vendor XYZ has faster delivery time needed for urgent project deadline"
9. Clicks Confirm
10. PR moves to PENDING_APPROVAL ✅
11. Notes saved in status history

### Scenario 3: Single Approver PR (Notes Always Optional)
1. PR amount = 5,000 LSL (below Rule 3)
2. Has 3 quotes, selects most expensive
3. Click "Push to Approver"
4. Dialog shows: "Add optional notes..." ✅
5. Notes NOT required (single approver doesn't trigger this rule)

## Testing

### Test Case 1: Dual Approval + Non-Lowest Quote + No Notes
**Steps:**
1. Create PR with amount > 50,000 LSL
2. Add 3 quotes: 50k, 60k, 70k
3. Select 60k as preferred
4. Click "Push to Approver"
5. Leave notes empty
6. Click Confirm

**Expected:**
- ❌ Error displayed
- Message shows both amounts
- Action blocked

### Test Case 2: Dual Approval + Non-Lowest Quote + With Notes
**Steps:**
1. Same as Test Case 1
2. Enter notes: "Better quality materials"
3. Click Confirm

**Expected:**
- ✅ PR moves to PENDING_APPROVAL
- Notes saved to status history
- Approvers can see justification

### Test Case 3: Dual Approval + Lowest Quote
**Steps:**
1. PR amount > 50,000 LSL
2. Add 3 quotes: 50k, 60k, 70k
3. Select 50k (lowest)
4. Click "Push to Approver"
5. Leave notes empty
6. Click Confirm

**Expected:**
- ✅ PR moves to PENDING_APPROVAL
- No validation error
- Notes optional

### Test Case 4: Single Approval + Higher Quote
**Steps:**
1. PR amount = 5,000 LSL (< Rule 3)
2. Add 2 quotes: 4k, 5k
3. Select 5k (higher)
4. Click "Push to Approver"
5. Leave notes empty
6. Click Confirm

**Expected:**
- ✅ PR moves to PENDING_APPROVAL
- Notes optional (rule doesn't apply)

### Test Case 5: Dual Approval + Only One Quote
**Steps:**
1. PR amount > 50,000 LSL
2. Has only 1 quote
3. Click "Push to Approver"
4. Leave notes empty
5. Click Confirm

**Expected:**
- ✅ PR moves to PENDING_APPROVAL
- Notes optional (can't compare)

## Data Flow

### Preferred Quote Selection
1. **UI:** Procurement selects radio button next to quote in `QuotesStep.tsx`
2. **Handler:** `onPreferredQuoteChange` called with quote ID
3. **PRView:** `handlePreferredQuoteChange` updates:
   - `pr.preferredQuoteId = selectedQuoteId`
   - `pr.estimatedAmount = selectedQuote.amount`
4. **Firestore:** Saved immediately via `prService.updatePR`

### Push to Approver Validation
1. **UI:** User clicks "Push to Approver"
2. **Dialog:** Opens with dynamic text based on `checkIfNotesRequired`
3. **User:** Enters notes (if required) and clicks Confirm
4. **Validation Chain:**
   - Standard PR validation (quotes, approvers, etc.)
   - **NEW:** Non-lowest quote check
   - If failed → Error displayed, action blocked
   - If passed → Continue
5. **Status Update:** `prService.updatePRStatus(pr.id, PENDING_APPROVAL, notes, user)`
6. **Firestore:** Status and notes saved
7. **Notification:** Email sent to approvers (with notes)

## Benefits

### For Procurement
- Clear guidance on when justification is needed
- Immediate feedback if notes are missing
- Prevents accidental omission

### For Approvers
- Context for why a more expensive quote was selected
- Better informed decision-making
- Can challenge procurement's reasoning if needed

### For Organization
- Audit trail of procurement decisions
- Compliance with purchasing policies
- Justification for spending variances
- Accountability and transparency

## Edge Cases Handled

1. **No preferred quote selected:** Validation uses `pr.estimatedAmount` (existing logic)
2. **Quotes with same amount:** `===` comparison, will not trigger if truly equal
3. **Rules not configured:** Check `rules.length === 0`, skip validation
4. **PR amount changes after quote selection:** Uses current `pr.estimatedAmount` for threshold check
5. **Whitespace-only notes:** `notes.trim()` ensures notes have actual content

## Related Documentation

- **Specifications.md** - Section "PR Processing in IN_QUEUE Status"
- **PREFERRED_QUOTE_SELECTION_2025-10-29.md** - Preferred quote feature
- **DUAL_APPROVER_FIX_SUMMARY_2025-10-29.md** - Dual approval logic
- **VALIDATION_ERROR_CATEGORIZATION_2025-10-29.md** - Validation framework

## Future Enhancements

Potential improvements:
1. **Pre-fill suggestions:** Common justifications (quality, delivery time, warranty, etc.)
2. **Note templates:** Drop-down with standard reasons
3. **Required note length:** Minimum character count for substantive justification
4. **Approval workflow:** Flag PRs with non-lowest quotes for extra scrutiny
5. **Reporting:** Track frequency of non-lowest quote selections by procurement user


