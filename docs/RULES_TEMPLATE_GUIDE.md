# Approval Rules Template Guide

## Overview

This document provides the approval rules template for all organizations in the PR system. Each organization should have **7 rules** configured to control the approval workflow and final price approval.

## Recent Rule Additions

### Rule 5 Addition
Rule 5 has been added to specify the number of unique approvers required for high-value expenditures (above Rule 3 threshold).

### Rule 6 & Rule 7 Addition (NEW - November 2, 2025)
Rules 6 and 7 have been added to control final price variance approval from proforma invoices:
- **Rule 6**: Maximum upward variance percentage (default: 5%)
- **Rule 7**: Maximum downward variance percentage (default: 20%)

## Template Rules

### Rule Definitions

1. **Rule 1**: Finance admin approvers can approve low value PRs
   - **Type**: Threshold (LSL or other currency)
   - **Purpose**: Sets the maximum amount that Level 4 (Finance Admin) and Level 6 (Finance Approvers) can approve
   - **Example**: 1500 LSL for 1PWR LESOTHO

2. **Rule 2**: Low Threshold Multiplier
   - **Type**: Multiplier (NA - no currency)
   - **Purpose**: Multiplies Rule 1 to determine the boundary between requiring 1 quote vs [Rule 4] quotes
   - **Calculation**: Rule 1 × Rule 2 = Low threshold boundary
   - **Vendor Impact**: If vendor is approved, can revert to zero quotes below this threshold, or floor above
   - **Example**: 4 for 1PWR LESOTHO (1500 × 4 = 6000 LSL boundary)

3. **Rule 3**: High value threshold
   - **Type**: Threshold (LSL or other currency)
   - **Purpose**: Sets the threshold for requiring [Rule 5] unique approvers and adjudication notes
   - **Quote Requirements**:
     - Below Rule 3 (and above Rule 1 × Rule 2): Require [Rule 4] quotes unless vendor is approved
     - Above Rule 3: Always require [Rule 4] quotes, [Rule 5] unique approvers, and adjudication notes
   - **Example**: 50000 LSL for 1PWR LESOTHO

4. **Rule 4**: Number of quotes required
   - **Type**: Count (no currency, but stored as LSL)
   - **Purpose**: Specifies how many quotes are required above the minimum floor of 1 quote
   - **Example**: 3 for 1PWR LESOTHO

5. **Rule 5**: Number of approvers required for high value expenditures
   - **Type**: Count (NA - no currency)
   - **Purpose**: Specifies how many unique approvers are required for amounts above Rule 3 threshold
   - **Example**: 2 for 1PWR LESOTHO

6. **Rule 6**: Final Price Upward Variance Threshold (NEW - Nov 2, 2025)
   - **Type**: Percentage (%)
   - **Purpose**: Maximum percentage increase allowed from approved amount to final price without requiring re-approval
   - **Application**: When procurement enters final price from proforma invoice, if the price increase exceeds this percentage, original approvers must sign off on the variance
   - **Example**: 5% for all organizations

7. **Rule 7**: Final Price Downward Variance Threshold (NEW - Nov 2, 2025)
   - **Type**: Percentage (%)
   - **Purpose**: Maximum percentage decrease allowed from approved amount to final price without requiring re-approval
   - **Application**: When procurement enters final price from proforma invoice, if the price decrease exceeds this percentage, original approvers must sign off on the variance
   - **Example**: 20% for all organizations

## Approval Logic Summary

```
Amount Range                           | Quotes Required                | Approvers Required | Notes Required
---------------------------------------|--------------------------------|-------------------|----------------
0 - Rule 1                            | 0 (if approved vendor) or 1    | 1                 | No
Rule 1 - (Rule 1 × Rule 2)            | 0 (if approved vendor) or 1    | 1                 | No
(Rule 1 × Rule 2) - Rule 3            | Rule 4 or 0 (if approved)      | 1                 | No
Above Rule 3                          | Rule 4 (always)                | Rule 5            | Yes (adjudication)
```

## Organizations and Rule Templates

### 1PWR LESOTHO (REFERENCE - Already Configured)

| Number | Description | Threshold | UOM | Active |
|--------|-------------|-----------|-----|--------|
| 1 | Finance admin approvers can approve low value PRs | 1500 | LSL | Y |
| 2 | Low Threshold Multiplier | 4 | NA | Y |
| 3 | High value threshold | 50000 | LSL | Y |
| 4 | Number of Quotes required | 3 | LSL | Y |
| 5 | Number of approvers required for high value expenditures | 2 | NA | Y |
| 6 | Final Price Upward Variance Threshold | 5 | % | Y |
| 7 | Final Price Downward Variance Threshold | 20 | % | Y |

**Calculated Values for 1PWR LESOTHO:**
- Rule 1 × Rule 2 = 1500 × 4 = **6000 LSL** (low threshold boundary)

---

### SMP (To Be Configured)

| Number | Description | Threshold | UOM | Active |
|--------|-------------|-----------|-----|--------|
| 1 | Finance admin approvers can approve low value PRs | *[TO FILL]* | *[TO FILL]* | Y |
| 2 | Low Threshold Multiplier | *[TO FILL]* | NA | Y |
| 3 | High value threshold | *[TO FILL]* | *[TO FILL]* | Y |
| 4 | Number of Quotes required | *[TO FILL]* | *[TO FILL]* | Y |
| 5 | Number of approvers required for high value expenditures | *[TO FILL]* | NA | Y |
| 6 | Final Price Upward Variance Threshold | 5 | % | Y |
| 7 | Final Price Downward Variance Threshold | 20 | % | Y |

---

### PUECO LESOTHO (To Be Configured)

| Number | Description | Threshold | UOM | Active |
|--------|-------------|-----------|-----|--------|
| 1 | Finance admin approvers can approve low value PRs | *[TO FILL]* | *[TO FILL]* | Y |
| 2 | Low Threshold Multiplier | *[TO FILL]* | NA | Y |
| 3 | High value threshold | *[TO FILL]* | *[TO FILL]* | Y |
| 4 | Number of Quotes required | *[TO FILL]* | *[TO FILL]* | Y |
| 5 | Number of approvers required for high value expenditures | *[TO FILL]* | NA | Y |
| 6 | Final Price Upward Variance Threshold | 5 | % | Y |
| 7 | Final Price Downward Variance Threshold | 20 | % | Y |

---

### NEO1 (To Be Configured)

| Number | Description | Threshold | UOM | Active |
|--------|-------------|-----------|-----|--------|
| 1 | Finance admin approvers can approve low value PRs | *[TO FILL]* | *[TO FILL]* | Y |
| 2 | Low Threshold Multiplier | *[TO FILL]* | NA | Y |
| 3 | High value threshold | *[TO FILL]* | *[TO FILL]* | Y |
| 4 | Number of Quotes required | *[TO FILL]* | *[TO FILL]* | Y |
| 5 | Number of approvers required for high value expenditures | *[TO FILL]* | NA | Y |
| 6 | Final Price Upward Variance Threshold | 5 | % | Y |
| 7 | Final Price Downward Variance Threshold | 20 | % | Y |

---

### 1PWR BENIN (To Be Configured)

| Number | Description | Threshold | UOM | Active |
|--------|-------------|-----------|-----|--------|
| 1 | Finance admin approvers can approve low value PRs | *[TO FILL]* | *[TO FILL]* | Y |
| 2 | Low Threshold Multiplier | *[TO FILL]* | NA | Y |
| 3 | High value threshold | *[TO FILL]* | *[TO FILL]* | Y |
| 4 | Number of Quotes required | *[TO FILL]* | *[TO FILL]* | Y |
| 5 | Number of approvers required for high value expenditures | *[TO FILL]* | NA | Y |
| 6 | Final Price Upward Variance Threshold | 5 | % | Y |
| 7 | Final Price Downward Variance Threshold | 20 | % | Y |

---

### 1PWR ZAMBIA (To Be Configured - Organization Inactive)

| Number | Description | Threshold | UOM | Active |
|--------|-------------|-----------|-----|--------|
| 1 | Finance admin approvers can approve low value PRs | *[TO FILL]* | *[TO FILL]* | Y |
| 2 | Low Threshold Multiplier | *[TO FILL]* | NA | Y |
| 3 | High value threshold | *[TO FILL]* | *[TO FILL]* | Y |
| 4 | Number of Quotes required | *[TO FILL]* | *[TO FILL]* | Y |
| 5 | Number of approvers required for high value expenditures | *[TO FILL]* | NA | Y |
| 6 | Final Price Upward Variance Threshold | 5 | % | Y |
| 7 | Final Price Downward Variance Threshold | 20 | % | Y |

---

### PUECO BENIN (To Be Configured - Organization Inactive)

| Number | Description | Threshold | UOM | Active |
|--------|-------------|-----------|-----|--------|
| 1 | Finance admin approvers can approve low value PRs | *[TO FILL]* | *[TO FILL]* | Y |
| 2 | Low Threshold Multiplier | *[TO FILL]* | NA | Y |
| 3 | High value threshold | *[TO FILL]* | *[TO FILL]* | Y |
| 4 | Number of Quotes required | *[TO FILL]* | *[TO FILL]* | Y |
| 5 | Number of approvers required for high value expenditures | *[TO FILL]* | NA | Y |
| 6 | Final Price Upward Variance Threshold | 5 | % | Y |
| 7 | Final Price Downward Variance Threshold | 20 | % | Y |

---

## UOM (Unit of Measure) Options

The UOM field can contain currencies, units, or special values:

### Currencies
- **LSL** - Lesotho Loti
- **ZAR** - South African Rand
- **XOF** - West African CFA Franc (Benin)
- **ZMW** - Zambian Kwacha
- **USD** - US Dollar

### Special Units
- **NA** - Not Applicable (for multipliers and counts)
- **%** - Percentage (for variance thresholds)

## Import Instructions

1. **Review the CSV file**: `Rules_Template_All_Organizations.csv`
2. **Fill in the Threshold and UOM columns** for each organization
3. **Import using the Rules Admin interface** in the PR system
4. **Verify rules are applied correctly** by testing a PR submission

## Notes

- Rule 2 is a **multiplier**, not a threshold - it should always have UOM "NA"
- Rule 4 typically uses the organization's currency (LSL, XOF, etc.) as UOM in the database, but it's actually a count
- Rule 5 should have UOM "NA" as it's a count
- **Rule 6 and Rule 7 are percentages** - they should have UOM "%" and represent variance thresholds for final price approval
- All rules should be marked as Active (Y) unless you want to disable them
- Inactive organizations still need rules configured for when they are reactivated
- Rules 6 and 7 are applied when procurement enters the final price from a proforma invoice in APPROVED status
- **UOM field replaced Currency field** - The UOM (Unit of Measure) field can now contain currencies (LSL, USD, etc.), units (%), or "NA" for non-applicable rules

## Related Documentation

- `docs/APPROVER_VALIDATION_COMPLETE_FIX_2025-10-29.md` - Validation logic for Rule 1 and Rule 2
- `docs/FINAL_PRICE_APPROVAL_FEATURE_2025-11-02.md` - Final price approval feature (Rule 6 & 7)
- `Specifications.md` - Complete system specifications

