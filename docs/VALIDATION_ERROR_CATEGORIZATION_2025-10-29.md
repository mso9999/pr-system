# Validation Error Message Categorization and Business Rules Correction

**Date:** October 29, 2025
**Status:** Completed

## Problem

The validation error messages displayed when blocking PR submission had two major issues:

### 1. Confusing Message Presentation
Errors were presented as a jumbled list without clear categorization:

```
At least three quotes with attachments are required for amounts above 4 NA
Only Level 1, 2, or 6 approvers can approve PRs above 4 NA. Finance Approvers (Level 6) can only approve within rule thresholds.
Preferred vendor is not approved
```

This made it difficult for users to understand:
- What type of issue each error represents
- The priority or relationship between errors
- Which errors need to be addressed first

### 2. Incorrect Business Logic Implementation
The validation logic was incorrectly interpreting the 5-rule system. The code was treating Rule 2 as a threshold when it's actually a multiplier, leading to nonsensical error messages like "amounts above 4 NA".

## Solution

### Part 1: Correct Business Rules Implementation

The system uses a 5-rule configuration per organization:

| Rule | Description | Example (1PWR Lesotho) |
|------|-------------|------------------------|
| Rule 1 | Finance threshold | 1,500 LSL |
| Rule 2 | Multiplier for mid-range | 4 |
| Rule 3 | High-value threshold | 50,000 LSL |
| Rule 4 | Number of quotes required | 3 |
| Rule 5 | Number of approvers for high-value | 2 |

#### Quote Requirements by Amount Range:

1. **Below Rule 1 (< 1,500 LSL)**
   - **Quotes Required:** 0
   - **Approver Levels:** Any (1, 2, 4, or 6)

2. **Rule 1 to Rule 1 × Rule 2 (1,500 - 6,000 LSL)**
   - **Quotes Required:** 1 (with attachment)
   - **If Approved Vendor:** 0 quotes
   - **Approver Levels:** Level 1, 2, 4, or 6

3. **Rule 1 × Rule 2 to Rule 3 (6,000 - 50,000 LSL)**
   - **Quotes Required:** [Rule 4] = 3 (with attachments)
   - **If Approved Vendor:** 1 quote (with attachment)
   - **Approver Levels:** Level 1 (Admin) or Level 2 (Senior Approver) only

4. **Above Rule 3 (> 50,000 LSL)**
   - **Quotes Required:** [Rule 4] = 3 (with attachments)
   - **If Approved Vendor:** [Rule 4] - 1 = 2 (with attachments)
   - **Approver Levels:** Level 1 or Level 2 only
   - **Number of Approvers:** [Rule 5] = 2 unique approvers
   - **Additional:** Adjudication notes required

#### Approver Permission Levels:
- **Level 1 (Admin):** Can approve any amount
- **Level 2 (Senior Approver):** Can approve any amount
- **Level 4 (Finance Admin):** Can only approve up to Rule 1 threshold
- **Level 6 (Finance Approver):** Can only approve up to Rule 1 threshold

### Part 2: Categorized Error Message System

Implemented a system that organizes validation failures into clear sections:

### 1. Error Categorization (`src/utils/prValidation.ts`)

Created separate error arrays for different validation categories:
- **Quote Requirements:** Issues with the number of quotes or attachments required
- **Approver Requirements:** Issues with approver permission levels
- **Vendor Status:** Issues with vendor approval status
- **Permissions:** Issues with user permissions to perform actions
- **Other:** Configuration issues, adjudication requirements, etc.

### 2. Improved Error Messages

**Quote Errors:**
- Clarified thresholds with context (e.g., "4x Rule 1 threshold")
- Explained alternatives (e.g., "unless using an approved vendor")
- Made requirements explicit about attachments

**Approver Errors:**
- Specified which permission levels are required (Level 1 = Admin, Level 2 = Senior Approver)
- Clearly stated Finance Approver (Level 6) limitations with exact threshold amounts
- Removed confusing double-negative language

**Vendor Errors:**
- Identified the specific vendor that's not approved
- Provided alternative solutions (select approved vendor OR add 3 quotes)

### 3. Formatted Output

Errors are now presented with:
- **Section headers** in uppercase (e.g., "QUOTE REQUIREMENTS:")
- **Bullet points** (•) for each error within a category
- **Blank lines** between sections for visual separation
- **Pre-line formatting** in the UI to preserve line breaks and indentation

### Example Output

**Example 1:** PR with amount of 654,754 LSL (between Rule 1 × Rule 2 and Rule 3), no quotes, unapproved vendor:

```
QUOTE REQUIREMENTS:
• At least 3 quotes with attachments are required for amounts between 6000 and 50000 LSL. (Use an approved vendor to reduce to 1 quote.)

APPROVER REQUIREMENTS:
• Amounts above 1500 LSL require a Level 1 (Admin) or Level 2 (Senior Approver) for approval. Finance Approvers (Level 6) and Finance Admins (Level 4) can only approve amounts up to 1500 LSL.

VENDOR STATUS:
• The preferred vendor (1031) is not approved. Using an approved vendor reduces quote requirements.
```

**Example 2:** PR with amount of 55,000 LSL (above Rule 3), with only 1 assigned approver:

```
QUOTE REQUIREMENTS:
• At least 3 quotes with attachments are required for amounts above 50000 LSL. (Use an approved vendor to reduce to 2 quotes.)

APPROVER REQUIREMENTS:
• At least 2 unique approvers are required for amounts above 50000 LSL.
• Amounts above 1500 LSL require a Level 1 (Admin) or Level 2 (Senior Approver) for approval. Finance Approvers (Level 6) and Finance Admins (Level 4) can only approve amounts up to 1500 LSL.
```

## Files Modified

### 1. `src/utils/prValidation.ts`
**Major Changes:**
- **Corrected Rule Interpretation:** Now properly fetches and uses all 5 rules (Rule 1-5)
  - Rule 1: Finance threshold
  - Rule 2: Multiplier (not a threshold!)
  - Rule 3: High-value threshold
  - Rule 4: Number of quotes required
  - Rule 5: Number of approvers for high-value
- **Fixed Threshold Calculations:** Properly calculates Rule 1 × Rule 2 for mid-range threshold
- **Implemented Correct Quote Requirements:**
  - Below Rule 1: No quotes required
  - Rule 1 to Rule 1 × Rule 2: 1 quote (0 if approved vendor)
  - Rule 1 × Rule 2 to Rule 3: [Rule 4] quotes (1 if approved vendor)
  - Above Rule 3: [Rule 4] quotes ([Rule 4] - 1 if approved vendor)
- **Corrected Approver Level Validation:**
  - Below Rule 1: Any approver level (1, 2, 4, 6)
  - Above Rule 1: Only Level 1 or Level 2
  - Level 4 & 6 limited to Rule 1 threshold
- **Added Error Categorization:** Separate arrays for quote, approver, vendor, permission, and other errors
- **Improved Error Messages:** Context-aware messages with specific thresholds and alternatives
- **Formatted Output:** Section headers and bullet points for clarity

### 2. `src/components/pr/ProcurementActions.tsx`
- Added `whiteSpace: 'pre-line'` style to Alert components
- Ensures multi-line formatted errors display properly with line breaks

### 3. `src/components/pr/ApproverActions.tsx`
- Added `whiteSpace: 'pre-line'` style to Alert component
- Maintains consistent error display across components

## Benefits

1. **Clarity:** Users can immediately understand the type and nature of each validation failure
2. **Actionability:** Organized errors help users prioritize which issues to address
3. **Context:** Improved messages provide specific thresholds, permission levels, and alternatives
4. **Professional:** Clean formatting makes the system appear more polished and user-friendly
5. **Maintainability:** Categorized errors make it easier to add new validation rules in the future

## Testing Recommendations

Test the following scenarios to verify proper validation (using 1PWR Lesotho as reference: Rule 1 = 1500, Rule 2 = 4, Rule 3 = 50000, Rule 4 = 3, Rule 5 = 2):

### Quote Requirements
1. **Below Rule 1 (< 1500):** Should require 0 quotes
2. **Between Rule 1 and Rule 1 × Rule 2 (1500-6000):**
   - Without approved vendor: Should require 1 quote
   - With approved vendor: Should require 0 quotes
3. **Between Rule 1 × Rule 2 and Rule 3 (6000-50000):**
   - Without approved vendor: Should require 3 quotes
   - With approved vendor: Should require 1 quote
4. **Above Rule 3 (> 50000):**
   - Without approved vendor: Should require 3 quotes + 2 approvers
   - With approved vendor: Should require 2 quotes + 2 approvers
   - Should require adjudication notes

### Approver Level Requirements
5. **Below Rule 1:** Any approver level (1, 2, 4, 6) should be accepted
6. **Above Rule 1:** Only Level 1 or Level 2 should be accepted
7. **Level 4 or 6 above Rule 1:** Should show error about needing Level 1 or 2

### Error Categorization
8. **Multiple Categories:** PR with quote, approver, and vendor errors should show all categories clearly separated
9. **Threshold Boundaries:** Test PRs at exactly 1500, 6000, and 50000 LSL
10. **Permission Errors:** Non-procurement user trying to push PR to approver

## Future Enhancements

Consider these improvements:
1. Add icons or color coding to different error categories
2. Implement error severity levels (blocking vs. warning)
3. Add "Learn More" links to help documentation for complex rules
4. Provide inline suggestions for fixing errors
5. Show which errors are resolved as user makes changes

