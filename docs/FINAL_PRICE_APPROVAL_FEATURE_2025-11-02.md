# Final Price Approval Feature Implementation

**Date:** November 2, 2025  
**Feature:** Final price variance approval from proforma invoice  
**Status:** 🔄 IN PROGRESS (65% Complete - Admin Portal Rules 6 & 7 Now Available)

## Overview

When procurement uploads a proforma invoice in APPROVED status, they must enter the **final price**. If the final price variance from the approved amount exceeds configurable thresholds, the original approver(s) must sign off on the price difference before the PO can proceed to ORDERED status.

## Business Requirements

### Key Workflow
1. PR is approved → becomes PO (APPROVED status)
2. Procurement uploads proforma invoice and enters final price
3. System calculates variance: `(finalPrice - lastApprovedAmount) / lastApprovedAmount * 100`
4. **If variance exceeds thresholds:**
   - `finalPriceRequiresApproval` flag set to `true`
   - `finalPriceApproved` flag remains `false`
   - PO **remains in APPROVED status**
   - Original approver(s) notified with variance details
   - Visual indicator shown that final price approval is pending
   - Cannot move to ORDERED until approved
5. **If variance within thresholds:**
   - Final price auto-accepted
   - `finalPriceRequiresApproval` set to `false`
   - `finalPriceApproved` set to `true` (auto-approved)
   - Can proceed to ORDERED (if all other requirements met)

### Configurable Thresholds

Set per organization in Admin Portal:

| Threshold | Default | Purpose |
|-----------|---------|---------|
| `finalPriceUpwardVarianceThreshold` | 5% | Maximum increase allowed without re-approval |
| `finalPriceDownwardVarianceThreshold` | 20% | Maximum decrease allowed without re-approval |

**Examples:**
- Approved: 10,000
- Final Price: 10,600 (+6%) → **Requires approval**
- Final Price: 10,400 (+4%) → **Auto-approved**
- Final Price: 7,900 (-21%) → **Requires approval**
- Final Price: 8,500 (-15%) → **Auto-approved**

## Changes Implemented

### 1. Specifications Updated ✅

**File:** `Specifications.md`

**Sections Added:**
- Lines 1173: Updated procurement actions to include "Enter Final Price from Proforma Invoice"
- Lines 1202-1252: Comprehensive "Final Price from Proforma Invoice" section with:
  - Variance approval requirements
  - Configurable thresholds documentation
  - Workflow when variance exceeds thresholds (PO remains in APPROVED status)
  - Approver actions using flags (finalPriceRequiresApproval, finalPriceApproved)
  - Notifications and audit trail requirements
- Lines 282-286: Added threshold configuration to Organization Data Model
- Lines 1273-1281: Updated validation checks to include final price approval requirement

### 2. Type Definitions Enhanced ✅

#### **File:** `src/types/pr.ts`

**No New Status Required** - PO remains in APPROVED status throughout. Final price approval is tracked via flags.

**New Fields in PRRequest Interface:**
```typescript
// Final Price Fields (APPROVED Status)
/** Final price from proforma invoice (entered by procurement) */
finalPrice?: number;
/** Currency for final price */
finalPriceCurrency?: string;
/** User who entered the final price */
finalPriceEnteredBy?: UserReference;
/** Timestamp when final price was entered */
finalPriceEnteredAt?: string;
/** Whether final price requires approval due to variance */
finalPriceRequiresApproval?: boolean;
/** Variance percentage from approved amount */
finalPriceVariancePercentage?: number;
/** Whether final price has been approved by approver(s) */
finalPriceApproved?: boolean;
/** User who approved the final price */
finalPriceApprovedBy?: UserReference;
/** Timestamp when final price was approved */
finalPriceApprovedAt?: string;
/** Notes/justification for final price variance (from procurement) */
finalPriceVarianceNotes?: string;
```

#### **File:** `src/types/organization.ts`

**New Fields Added:**
```typescript
// Final Price Variance Thresholds (percentages)
finalPriceUpwardVarianceThreshold?: number; // default 5 (%)
finalPriceDownwardVarianceThreshold?: number; // default 20 (%)
```

### 3. Service Functions Added ✅

**File:** `src/services/pr.ts`

#### Function: `checkFinalPriceVariance()`
- Lines 465-522
- Calculates variance percentage between approved amount and final price
- Compares against configurable thresholds
- Returns decision object with:
  - `requiresApproval`: boolean
  - `variancePercentage`: number
  - `reason`: string explanation
  - `withinThresholds`: boolean

**Usage Example:**
```typescript
const result = prService.checkFinalPriceVariance(
  10000,  // approved amount
  10600,  // final price
  5,      // upward threshold %
  20      // downward threshold %
);

// result.requiresApproval = true
// result.variancePercentage = 6
// result.reason = "Final price is 6.00% higher than approved amount..."
```

### 4. UI Component Updates 🔄 IN PROGRESS

**File:** `src/components/pr/ApprovedStatusActions.tsx`

**Completed:**
- Added state management for final price entry
- Added state for final price notes/justification

**Pending:**
- Add UI elements for final price entry
- Add final price save handler with variance checking
- Add logic to update PO status to PENDING_FINAL_PRICE_APPROVAL
- Add approver notification when variance exceeds thresholds
- Add validation before moving to ORDERED

## Detailed Workflow

### For Procurement (APPROVED Status)

1. **Upload Proforma Invoice**
   - Upload document as attachment
   - OR check override with justification

2. **Enter Final Price**
   - Input field for final price amount
   - Currency auto-populated from PR
   - Optional notes/justification field
   - Click "Save Final Price"

3. **System Checks Variance**
   - Calculates: `(finalPrice - lastApprovedAmount) / lastApprovedAmount * 100`
   - Compares against organization thresholds

4. **If Variance Exceeds Thresholds:**
   - PO status → `PENDING_FINAL_PRICE_APPROVAL`
   - Notification sent to original approver(s)
   - Warning message displayed to procurement
   - Cannot move to ORDERED until approved

5. **If Variance Within Thresholds:**
   - Final price saved and auto-approved
   - Success message displayed
   - Can proceed with other APPROVED status actions

### For Approvers (While in APPROVED Status)

1. **Receive Notification**
   - Email alert with PO number
   - Variance percentage and amount details
   - Procurement's justification notes (if provided)
   - Link to view PO (still in APPROVED status)

2. **Review Final Price**
   - PO displayed with indicator showing "Final Price Approval Pending"
   - View original approved amount
   - View final price from proforma
   - View variance percentage
   - View procurement's notes

3. **Take Action:**
   - **Approve Final Price:**
     - Sets `finalPriceApproved` to `true`
     - PO remains in APPROVED status
     - Procurement notified
     - Can now proceed to ORDERED
   - **Reject Final Price:**
     - PO moves to REVISION_REQUIRED
     - Procurement must address issue
     - Requestor notified
   - **Request More Information:**
     - Send message to procurement
     - PO remains in APPROVED status

### Status Flow Diagram

```
APPROVED
    ↓
[Enter Final Price]
    ↓
[Calculate Variance]
    ↓
    ├─→ Within Thresholds → APPROVED (finalPriceApproved = true)
    │                        ↓
    │                       Can move to ORDERED
    ↓
    └─→ Exceeds Thresholds → APPROVED (finalPriceRequiresApproval = true)
                             ↓
                             [Awaiting Approver Action]
                             ↓
                             ├─→ Approved → APPROVED (finalPriceApproved = true)
                             │               ↓
                             │              Can move to ORDERED
                             ↓
                             └─→ Rejected → REVISION_REQUIRED
```

## Implementation Checklist

### ✅ Completed

- [x] Specifications documented (PO remains in APPROVED status)
- [x] PR type fields added (10 new fields for final price tracking)
- [x] Organization type fields added (configurable thresholds)
- [x] Service function for variance checking (`checkFinalPriceVariance`)
- [x] State management in ApprovedStatusActions component
- [x] Admin portal UI for configuring Rule 6 & Rule 7 thresholds (OrganizationConfig.tsx)

### 🔄 In Progress

- [ ] UI elements for final price entry in ApprovedStatusActions
- [ ] Final price save handler with variance checking
- [ ] Set finalPriceRequiresApproval and finalPriceApproved flags
- [ ] Approver notification on variance
- [ ] Visual indicator when final price approval is pending

### ⏳ Pending

- [ ] Approver actions in PRView for approving/rejecting final price (while in APPROVED status)
- [ ] Validation logic in "Move to ORDERED" - check finalPriceApproved flag
- [ ] Notification templates for final price approvals
- [ ] Audit trail logging for final price entries
- [ ] Integration testing
- [ ] User acceptance testing

## Admin Configuration ✅

### Organization Settings Page

**Location:** Admin Portal → Organization Settings Tab (Superadmin only)

**Section:** Business Rules (Approval Thresholds)

**Fields Implemented:**
```
Rule 6: Final Price Upward Variance Threshold (%): [  5  ]
  └─ Max % increase from approved to final price (default: 5%)

Rule 7: Final Price Downward Variance Threshold (%): [  20  ]
  └─ Max % decrease from approved to final price (default: 20%)

[Save Configuration] [Reset]
```

**Input Configuration:**
- Type: Number
- Min: 0, Max: 100
- Step: 0.1 (allows decimal precision like 5.5%)
- Default values: 5% upward, 20% downward

**Validation:**
- Must be positive numbers
- Upward typically 0-10%
- Downward typically 10-50%
- Values are stored per organization
- Applied to all PRs/POs in that organization

**File:** `src/components/admin/OrganizationConfig.tsx`

## Notifications

### When Final Price Requires Approval

**To:** Original Approver(s)
**CC:** Procurement, Requestor
**Subject:** `PO ${poNumber} - Final Price Approval Required`

**Content:**
```
A final price has been entered for PO ${poNumber} that requires your approval.

Original Approved Amount: ${approvedAmount} ${currency}
Final Price from Proforma: ${finalPrice} ${currency}
Variance: ${variancePercentage}% (${varianceAmount} ${currency})

${procurementNotes}

Please review and approve or reject the final price.

[View PO] [Approve] [Reject]
```

### When Final Price is Approved

**To:** Procurement, Requestor
**CC:** Original Approver(s)
**Subject:** `PO ${poNumber} - Final Price Approved`

### When Final Price is Rejected

**To:** Procurement, Requestor
**CC:** Original Approver(s)
**Subject:** `PO ${poNumber} - Final Price Rejected`

## Audit Trail

All final price activities logged in PR history:

- **FINAL_PRICE_ENTERED**: When procurement saves final price
- **FINAL_PRICE_AUTO_APPROVED**: When variance within thresholds
- **FINAL_PRICE_APPROVAL_REQUIRED**: When variance exceeds thresholds
- **FINAL_PRICE_APPROVED**: When approver approves
- **FINAL_PRICE_REJECTED**: When approver rejects

Each entry includes:
- Timestamp
- User who performed action
- Approved amount
- Final price
- Variance percentage
- Notes/justification

## Testing Scenarios

### Test 1: Final Price Within Thresholds (Auto-Approve)
1. Approve PR for 10,000
2. In APPROVED status, enter final price: 10,400 (+4%)
3. **Expected:** Auto-approved, remains in APPROVED status
4. **Expected:** Success message shown
5. **Expected:** Can proceed to ORDERED

### Test 2: Final Price Exceeds Upward Threshold
1. Approve PR for 10,000
2. Enter final price: 10,600 (+6%, default threshold is 5%)
3. **Expected:** PO remains in APPROVED status
4. **Expected:** `finalPriceRequiresApproval` set to `true`, `finalPriceApproved` set to `false`
5. **Expected:** Visual indicator shows "Final Price Approval Pending"
6. **Expected:** Approver notified
7. **Expected:** Cannot move to ORDERED until approved

### Test 3: Final Price Exceeds Downward Threshold
1. Approve PR for 10,000
2. Enter final price: 7,900 (-21%, default threshold is 20%)
3. **Expected:** PO remains in APPROVED status
4. **Expected:** `finalPriceRequiresApproval` set to `true`
5. **Expected:** Approver notified

### Test 4: Approver Approves Final Price
1. PO in APPROVED status with finalPriceRequiresApproval = true
2. Approver logs in and reviews PO
3. Approver clicks "Approve Final Price"
4. **Expected:** `finalPriceApproved` set to `true`
5. **Expected:** PO remains in APPROVED status
6. **Expected:** Procurement notified
7. **Expected:** Can now move to ORDERED (if other requirements met)

### Test 5: Approver Rejects Final Price
1. PO in APPROVED status with finalPriceRequiresApproval = true
2. Approver clicks "Reject Final Price" with reason
3. **Expected:** Status moves to REVISION_REQUIRED
4. **Expected:** Procurement and requestor notified

### Test 6: Dual Approval Scenario
1. High-value PR requiring dual approval
2. Both approvers approved PR
3. Enter final price exceeding threshold
4. **Expected:** BOTH approvers must approve final price
5. **Expected:** PO remains in APPROVED status with finalPriceRequiresApproval = true
6. **Expected:** Cannot move to ORDERED until both original approvers approve the final price

### Test 7: Custom Thresholds
1. Admin sets custom thresholds: +10% up, -30% down
2. Approve PR for 10,000
3. Enter final price: 10,900 (+9%)
4. **Expected:** Auto-approved (within custom threshold)

## Database Migration

No migration required - all new fields are optional and will be populated going forward.

**Backwards Compatibility:**
- Existing PRs without `lastApprovedAmount`: Feature won't apply
- Existing organizations without thresholds: Use defaults (5%, 20%)
- Existing APPROVED POs: Can enter final price when ready

## Future Enhancements

### Phase 1 (Current)
- Basic final price entry and variance checking
- Single manual approval by original approver(s)

### Phase 2 (Future)
- Automatic approval if within tighter "auto-approve" band
- Tiered approval requirements based on variance size
- Historical analysis of price variances
- Vendor performance tracking based on quote accuracy

### Phase 3 (Future)
- AI/ML prediction of likely final prices based on vendor history
- Warnings when entering final prices that seem unusual
- Integration with accounting system for actual payment amounts
- Variance reporting and analytics dashboard

## Conclusion

The Final Price Approval feature is **65% complete** with:
- ✅ Complete specifications (PO remains in APPROVED status)
- ✅ Type definitions and data model (10 new fields, configurable thresholds)
- ✅ Core service functions (`checkFinalPriceVariance`)
- ✅ Simplified workflow using flags instead of new status
- ✅ Admin portal configuration for Rule 6 & Rule 7 thresholds
- 🔄 UI implementation in progress (final price entry and approver actions)

This feature ensures approval integrity by requiring approver sign-off when proforma invoice prices differ significantly from approved amounts, with configurable thresholds per organization. The PO remains in APPROVED status throughout, with the approval requirement tracked via `finalPriceRequiresApproval` and `finalPriceApproved` flags.

