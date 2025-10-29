# Approval Rules Template Guide

## Overview

This document provides the approval rules template for all organizations in the PR system. Each organization should have 5 rules configured to control the approval workflow.

## Rule 5 Addition (NEW)

Rule 5 has been added to specify the number of unique approvers required for high-value expenditures (above Rule 3 threshold).

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

5. **Rule 5**: Number of approvers required for high value expenditures (NEW)
   - **Type**: Count (NA - no currency)
   - **Purpose**: Specifies how many unique approvers are required for amounts above Rule 3 threshold
   - **Example**: 2 for 1PWR LESOTHO

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

| Number | Description | Threshold | Currency | Active |
|--------|-------------|-----------|----------|--------|
| 1 | Finance admin approvers can approve low value PRs | 1500 | LSL | Y |
| 2 | Low Threshold Multiplier | 4 | NA | Y |
| 3 | High value threshold | 50000 | LSL | Y |
| 4 | Number of Quotes required | 3 | LSL | Y |
| 5 | Number of approvers required for high value expenditures | 2 | NA | Y |

**Calculated Values for 1PWR LESOTHO:**
- Rule 1 × Rule 2 = 1500 × 4 = **6000 LSL** (low threshold boundary)

---

### SMP (To Be Configured)

| Number | Description | Threshold | Currency | Active |
|--------|-------------|-----------|----------|--------|
| 1 | Finance admin approvers can approve low value PRs | *[TO FILL]* | *[TO FILL]* | Y |
| 2 | Low Threshold Multiplier | *[TO FILL]* | NA | Y |
| 3 | High value threshold | *[TO FILL]* | *[TO FILL]* | Y |
| 4 | Number of Quotes required | *[TO FILL]* | *[TO FILL]* | Y |
| 5 | Number of approvers required for high value expenditures | *[TO FILL]* | NA | Y |

---

### PUECO LESOTHO (To Be Configured)

| Number | Description | Threshold | Currency | Active |
|--------|-------------|-----------|----------|--------|
| 1 | Finance admin approvers can approve low value PRs | *[TO FILL]* | *[TO FILL]* | Y |
| 2 | Low Threshold Multiplier | *[TO FILL]* | NA | Y |
| 3 | High value threshold | *[TO FILL]* | *[TO FILL]* | Y |
| 4 | Number of Quotes required | *[TO FILL]* | *[TO FILL]* | Y |
| 5 | Number of approvers required for high value expenditures | *[TO FILL]* | NA | Y |

---

### NEO1 (To Be Configured)

| Number | Description | Threshold | Currency | Active |
|--------|-------------|-----------|----------|--------|
| 1 | Finance admin approvers can approve low value PRs | *[TO FILL]* | *[TO FILL]* | Y |
| 2 | Low Threshold Multiplier | *[TO FILL]* | NA | Y |
| 3 | High value threshold | *[TO FILL]* | *[TO FILL]* | Y |
| 4 | Number of Quotes required | *[TO FILL]* | *[TO FILL]* | Y |
| 5 | Number of approvers required for high value expenditures | *[TO FILL]* | NA | Y |

---

### 1PWR BENIN (To Be Configured)

| Number | Description | Threshold | Currency | Active |
|--------|-------------|-----------|----------|--------|
| 1 | Finance admin approvers can approve low value PRs | *[TO FILL]* | *[TO FILL]* | Y |
| 2 | Low Threshold Multiplier | *[TO FILL]* | NA | Y |
| 3 | High value threshold | *[TO FILL]* | *[TO FILL]* | Y |
| 4 | Number of Quotes required | *[TO FILL]* | *[TO FILL]* | Y |
| 5 | Number of approvers required for high value expenditures | *[TO FILL]* | NA | Y |

---

### 1PWR ZAMBIA (To Be Configured - Organization Inactive)

| Number | Description | Threshold | Currency | Active |
|--------|-------------|-----------|----------|--------|
| 1 | Finance admin approvers can approve low value PRs | *[TO FILL]* | *[TO FILL]* | Y |
| 2 | Low Threshold Multiplier | *[TO FILL]* | NA | Y |
| 3 | High value threshold | *[TO FILL]* | *[TO FILL]* | Y |
| 4 | Number of Quotes required | *[TO FILL]* | *[TO FILL]* | Y |
| 5 | Number of approvers required for high value expenditures | *[TO FILL]* | NA | Y |

---

### PUECO BENIN (To Be Configured - Organization Inactive)

| Number | Description | Threshold | Currency | Active |
|--------|-------------|-----------|----------|--------|
| 1 | Finance admin approvers can approve low value PRs | *[TO FILL]* | *[TO FILL]* | Y |
| 2 | Low Threshold Multiplier | *[TO FILL]* | NA | Y |
| 3 | High value threshold | *[TO FILL]* | *[TO FILL]* | Y |
| 4 | Number of Quotes required | *[TO FILL]* | *[TO FILL]* | Y |
| 5 | Number of approvers required for high value expenditures | *[TO FILL]* | NA | Y |

---

## Currency Options

Common currencies used in the system:
- **LSL** - Lesotho Loti
- **ZAR** - South African Rand
- **XOF** - West African CFA Franc (Benin)
- **ZMW** - Zambian Kwacha
- **USD** - US Dollar
- **NA** - Not Applicable (for multipliers and counts)

## Import Instructions

1. **Review the CSV file**: `Rules_Template_All_Organizations.csv`
2. **Fill in the Threshold and Currency columns** for each organization
3. **Import using the Rules Admin interface** in the PR system
4. **Verify rules are applied correctly** by testing a PR submission

## Notes

- Rule 2 is a **multiplier**, not a threshold - it should always have currency "NA"
- Rule 4 typically uses "LSL" as currency in the database, but it's actually a count
- Rule 5 should have currency "NA" as it's a count
- All rules should be marked as Active (Y) unless you want to disable them
- Inactive organizations still need rules configured for when they are reactivated

## Related Documentation

- `docs/APPROVER_VALIDATION_COMPLETE_FIX_2025-10-29.md` - Validation logic for Rule 1 and Rule 2
- `Specifications.md` - Complete system specifications

