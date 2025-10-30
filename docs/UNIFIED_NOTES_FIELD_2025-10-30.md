# Unified Notes Field for Approver Actions

**Date:** October 30, 2025  
**Status:** ✅ Implemented

## Problem Statement

Previously, the approver approval dialog had **two separate text fields**:
1. **Justification** - Required when selecting non-lowest quote
2. **Notes** - For general approval notes

This created **overlap and redundancy** when both conditions applied:
- Dual approval (over threshold) → Needs adjudication notes
- Non-lowest quote selected → Needs justification

Approvers would need to provide similar information in both fields, or be confused about which field to use.

---

## Solution

**Consolidated into ONE unified notes field** with **dynamic guidance** that changes based on the situation.

### Dynamic Field Behavior:

| Scenario | Field Label | Placeholder Text | Required? |
|----------|-------------|------------------|-----------|
| **Dual approval + Non-lowest quote** | "Adjudication & Justification Notes" | "Provide adjudication notes for this high-value PR and explain why this quote was selected..." | ✅ Yes |
| **Dual approval only** | "Adjudication Notes" | "Provide adjudication notes for this high-value PR approval..." | ✅ Yes |
| **Non-lowest quote only** | "Justification for Non-Lowest Quote" | "Explain why this quote was selected over the lowest quote..." | ✅ Yes |
| **Normal approval** | "Notes (Optional)" | "Optional notes for approval..." | ❌ No |
| **Reject/Revise** | "Notes" | "Provide notes for this action..." | ✅ Yes |

---

## Implementation Details

### Logic for Determining Requirements:

```typescript
// Check if this requires adjudication (dual approval scenario - over threshold)
const requiresAdjudication = isDualApproval;

// Check if non-lowest quote selected
const isNonLowestQuote = hasMultipleQuotes && !isSelectedQuoteLowest;

// Determine notes requirements
const notesRequired = isNonLowestQuote || requiresAdjudication;
```

### Dynamic Guidance Function:

```typescript
const getNotesGuidance = () => {
  if (selectedAction !== 'approve') {
    // For reject/revise actions
    return {
      label: 'Notes',
      placeholder: 'Provide notes for this action...',
      helperText: 'Notes are required',
      required: true
    };
  }

  // For approval actions
  if (requiresAdjudication && isNonLowestQuote) {
    // Both: Over threshold AND non-lowest quote
    return {
      label: 'Adjudication & Justification Notes',
      placeholder: 'Provide adjudication notes for this high-value PR and explain why this quote was selected over the lowest quote...',
      helperText: 'Required: Adjudication notes and justification for non-lowest quote selection',
      required: true
    };
  } else if (requiresAdjudication) {
    // Only adjudication needed (over threshold)
    return {
      label: 'Adjudication Notes',
      placeholder: 'Provide adjudication notes for this high-value PR approval...',
      helperText: 'Required: Adjudication notes for dual-approval PR',
      required: true
    };
  } else if (isNonLowestQuote) {
    // Only justification needed (non-lowest quote)
    return {
      label: 'Justification for Non-Lowest Quote',
      placeholder: 'Explain why this quote was selected over the lowest quote...',
      helperText: 'Required: Justification for non-lowest quote selection',
      required: true
    };
  } else {
    // Optional notes
    return {
      label: 'Notes (Optional)',
      placeholder: 'Optional notes for approval...',
      helperText: 'Optional notes for approval',
      required: false
    };
  }
};
```

---

## User Experience

### Before (Awkward):
```
┌────────────────────────────────────────┐
│ Justification for Non-Lowest Quote    │
│ [Required text field]                  │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ Notes                                   │
│ [Also required text field]             │
└────────────────────────────────────────┘

❌ User confusion: "Do I put the same thing in both fields?"
❌ Redundancy: Similar info in two places
```

### After (Clean):
```
ℹ️ Adjudication & Justification Required
This is a high-value PR requiring dual approval. 
Additionally, you have selected a quote that is NOT 
the lowest. Please provide comprehensive notes covering 
both adjudication reasoning and justification for the 
non-lowest quote selection.

Lowest quote: Vendor A - 50,000.00 LSL

┌────────────────────────────────────────┐
│ Adjudication & Justification Notes     │
│ [Single text field with clear guidance]│
│                                        │
│                                        │
└────────────────────────────────────────┘

✅ Clear guidance
✅ One field to complete
✅ No redundancy
```

---

## Validation

### Updated Validation Logic:

```typescript
// Validate notes based on requirements
if (selectedAction === 'approve' && notesRequired && !notes.trim()) {
  if (requiresAdjudication && isNonLowestQuote) {
    setError('Adjudication notes and justification for non-lowest quote selection are required.');
  } else if (requiresAdjudication) {
    setError('Adjudication notes are required for dual-approval PRs.');
  } else if (isNonLowestQuote) {
    setError('Justification is required when approving a quote that is not the lowest.');
  }
  return;
}
```

**Context-aware error messages** that match the specific scenario.

---

## Alert Guidance

An **info alert** appears above the notes field to provide context:

### Scenario 1: Both Adjudication + Non-Lowest Quote
```
ℹ️ Adjudication & Justification Required

This is a high-value PR requiring dual approval. Additionally, 
you have selected a quote that is NOT the lowest. Please provide 
comprehensive notes covering both adjudication reasoning and 
justification for the non-lowest quote selection.

Lowest quote: Vendor A - 50,000.00 LSL
```

### Scenario 2: Adjudication Only
```
ℹ️ Adjudication Notes Required

This is a high-value PR requiring dual approval. Please provide 
adjudication notes explaining your approval decision.
```

### Scenario 3: Non-Lowest Quote Only
```
ℹ️ Justification Required

You have selected a quote that is NOT the lowest. Please provide 
justification for selecting this quote.

Lowest quote: Vendor A - 50,000.00 LSL
```

---

## Data Storage

The unified notes are stored in the same field as before:

```typescript
approvalWorkflow: {
  firstApproverJustification: approverNotes,  // From unified notes field
  secondApproverJustification: approverNotes, // From unified notes field
  approvalHistory: [{
    approverId: currentUser.id,
    notes: approverNotes  // From unified notes field
  }]
}
```

**No breaking changes** to data structure - just consolidated input method.

---

## Benefits

### 1. **User-Friendly**
- Single field to complete
- Clear instructions for each scenario
- No confusion about which field to use

### 2. **No Redundancy**
- Eliminates duplicate information
- More efficient approval process
- Cleaner UI

### 3. **Flexible**
- Adapts to the specific approval scenario
- Appropriate guidance for each situation
- Still captures all necessary information

### 4. **Maintainable**
- Centralized logic for notes requirements
- Easy to update guidance text
- Consistent validation

---

## Testing Scenarios

✅ **To Verify:**

1. **Single approval, lowest quote selected:**
   - Label: "Notes (Optional)"
   - Not required
   - Can approve without notes

2. **Single approval, non-lowest quote selected:**
   - Label: "Justification for Non-Lowest Quote"
   - Required
   - Alert shows lowest quote info
   - Cannot approve without justification

3. **Dual approval, lowest quote selected:**
   - Label: "Adjudication Notes"
   - Required
   - Alert explains dual approval requirement
   - Cannot approve without adjudication notes

4. **Dual approval, non-lowest quote selected:**
   - Label: "Adjudication & Justification Notes"
   - Required
   - Alert explains both requirements
   - Shows lowest quote info
   - Cannot approve without comprehensive notes

5. **Reject/Revise actions:**
   - Label: "Notes"
   - Required
   - Standard notes requirement

---

## Files Modified

**Single File Change:**
- `src/components/pr/ApproverActions.tsx`
  - Removed separate `justification` and `useDefaultJustification` state
  - Added `getNotesGuidance()` function
  - Consolidated validation logic
  - Updated UI to single notes field
  - Added dynamic alert guidance

---

## Summary

This change **significantly improves the user experience** by eliminating redundant fields and providing clear, context-aware guidance. Approvers now have a **single, intuitive place** to provide whatever notes are required for their specific approval scenario.

**Result:** Cleaner UI, better UX, same data integrity. ✅

