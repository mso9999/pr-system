# Automatic Vendor Approval on Order Completion

**Date:** November 7, 2025  
**Status:** Enhanced & Configured

## Overview

This document describes the automatic vendor approval system that activates when a Purchase Order (PO) is successfully completed. When an order is closed without issues, the vendor is automatically approved in the reference data system, enabling streamlined procurement in future orders.

## Business Logic

### Approval Scenarios

#### Scenario 1: Successful Order Completion (✅ Auto-Approve)
**Trigger:** Order marked as "completed without issues"

**Result:** Vendor is automatically approved

**Approval Duration:**
- **3-Quote Process:** If the original PR had ≥3 quotes
  - Duration: Configured in organization settings (`vendorApproval3QuoteDuration`, default: 12 months)
  - Reason: `auto_3quote`
  
- **Single Completed Order:** If the PR had <3 quotes
  - Duration: Configured in organization settings (`vendorApprovalCompletedDuration`, default: 6 months)
  - Reason: `auto_completed`

**Data Stored:**
- `isApproved`: `true`
- `approvalDate`: Current date/time
- `approvalExpiryDate`: Current date + approval duration
- `approvalReason`: `auto_3quote` or `auto_completed`
- `approvedBy`: User ID who completed the order
- `approvalNote`: `"Satisfactory order completion - PO {prNumber}"`
- `associatedPONumber`: PR number
- `lastCompletedOrderDate`: Completion date

#### Scenario 2: Order with Issues + Manual Override (⚠️ Manual Approve)
**Trigger:** Order marked as "completed with issues" + user checks "Approve vendor despite issues"

**Requirements:**
- User must provide justification for approving despite issues

**Result:** Vendor is manually approved

**Approval Duration:**
- Duration: Configured in organization settings (`vendorApprovalManualDuration`, default: 12 months)
- Reason: `manual`

**Data Stored:**
- `isApproved`: `true`
- `approvalDate`: Current date/time
- `approvalExpiryDate`: Current date + manual duration
- `approvalReason`: `manual`
- `approvedBy`: User ID who completed the order
- `approvalNote`: `"Manual override despite issues: {justification}"`
- `associatedPONumber`: PR number
- `lastCompletedOrderDate`: Completion date

#### Scenario 3: Order with Issues (❌ No Approval)
**Trigger:** Order marked as "completed with issues" + NO override checkbox

**Result:** Vendor remains non-approved (no action taken)

## Organization Configuration

Approval durations are configurable per organization in Firestore:

```typescript
interface Organization {
  // ... other fields
  
  // Vendor Approval Duration Settings (in months)
  vendorApproval3QuoteDuration: number;      // default: 12
  vendorApprovalCompletedDuration: number;   // default: 6
  vendorApprovalManualDuration: number;      // default: 12
}
```

### Setting Organization Config

Via Firestore Console:
```
organizations/{orgId}
  vendorApproval3QuoteDuration: 12      // months
  vendorApprovalCompletedDuration: 6    // months
  vendorApprovalManualDuration: 12      // months
```

## Technical Implementation

### Component: `OrderedStatusActions.tsx`

#### Key Functions

**`handleMoveToCompleted()`**
- Validates delivery documentation
- Validates vendor performance question is answered
- Fetches organization config for approval durations
- Checks vendor approval criteria
- Updates vendor in reference data
- Updates PR status to COMPLETED
- Sends notifications

#### Code Flow

```typescript
// 1. Fetch organization config
const orgConfig = await organizationService.getOrganization(pr.organization);
const vendor3QuoteDuration = orgConfig?.vendorApproval3QuoteDuration || 12;
const vendorCompletedDuration = orgConfig?.vendorApprovalCompletedDuration || 6;
const vendorManualDuration = orgConfig?.vendorApprovalManualDuration || 12;

// 2. Determine approval scenario
if (orderSatisfactory === 'yes') {
  // Auto-approve
  const was3QuoteProcess = (pr.quotes?.length || 0) >= 3;
  const approvalDuration = was3QuoteProcess ? vendor3QuoteDuration : vendorCompletedDuration;
  
  // Update vendor with approval data
  await referenceDataAdminService.updateItem('vendors', vendorId, {
    isApproved: true,
    approvalDate: new Date().toISOString(),
    approvalExpiryDate: expiryDate.toISOString(),
    approvalReason: was3QuoteProcess ? 'auto_3quote' : 'auto_completed',
    // ... other fields
  });
  
} else if (orderSatisfactory === 'no' && approveVendorDespiteIssues) {
  // Manual approval with justification
  // ... similar update with 'manual' reason
}
```

## User Interface

### Completion Dialog

When moving an order to COMPLETED status, users see:

```
┌─────────────────────────────────────────────────┐
│ Complete Order                                  │
├─────────────────────────────────────────────────┤
│ Order closed without issues?                    │
│  ○ Yes                                          │
│  ○ No                                           │
│                                                 │
│ [If No selected:]                               │
│ Describe the issues:                            │
│ ┌─────────────────────────────────────────────┐ │
│ │                                             │ │
│ │                                             │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ☐ Approve vendor despite issues                │
│                                                 │
│ [If checked:]                                   │
│ Justification for approval:                     │
│ ┌─────────────────────────────────────────────┐ │
│ │                                             │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│         [Cancel]  [Complete Order]              │
└─────────────────────────────────────────────────┘
```

### User Feedback

After successful completion:
- ✅ **"Vendor "{name}" automatically approved for {X} months"** (green notification)
- ℹ️ **"Vendor "{name}" manually approved for {X} months"** (blue notification)

## Vendor Reference Data Display

### In PR/PO Additional Information Section

```
Preferred Vendor
AFRICA TRADING GROUP [Approved]
Approved: 1/15/2025 • Expires: 1/15/2026
```

The approval status chip shows:
- 🟢 **"Approved"** - Vendor is approved and approval is valid
- 🟡 **"Approval Expired"** - Vendor was approved but approval has expired
- 🔴 **"Not Approved"** - Vendor is not approved

## Validation Rules

### Before Completing Order

1. ✅ Delivery documentation must exist (delivery note, photos, or override)
2. ✅ Vendor performance question must be answered ("Yes" or "No")
3. ✅ If "No" selected, issue description is required
4. ✅ If "Approve despite issues" checked, justification is required

### Vendor Approval Criteria

A vendor will be auto-approved if:
1. ✅ Order completed successfully (no issues)
2. ✅ Vendor exists in reference data
3. ✅ User has permission to complete orders

A vendor will be manually approved if:
1. ✅ Order completed with issues
2. ✅ User explicitly approves vendor
3. ✅ Justification provided

## Impact on Future Orders

### For Approved Vendors

- Vendor appears with "Approved" badge in vendor selection dropdowns
- Approval status visible in Additional Information section
- No additional approval workflow needed (standard PR approval applies)
- Approval automatically expires after configured duration

### For Expired Approvals

- Vendor shows "Approval Expired" badge
- Can still be selected but requires new completion/approval
- Previous approval history maintained

### For Non-Approved Vendors

- Vendor shows "Not Approved" badge
- Can still be selected (system doesn't block)
- Requires successful order completion for future approval

## Audit Trail

All vendor approvals are tracked with:
- Approval date and time
- Approval expiry date
- Approval reason (auto_3quote, auto_completed, manual)
- Approver (user who completed the order)
- Associated PO number
- Approval notes/justification
- Last completed order date

This data is stored in the vendor record in Firestore:

```json
{
  "id": "1012",
  "name": "AFRICA TRADING GROUP",
  "isApproved": true,
  "approvalDate": "2025-01-15T10:30:00.000Z",
  "approvalExpiryDate": "2026-01-15T10:30:00.000Z",
  "approvalReason": "auto_3quote",
  "approvedBy": "user123",
  "approvalNote": "Satisfactory order completion - PO 251028-0009-1PL-LS",
  "associatedPONumber": "251028-0009-1PL-LS",
  "lastCompletedOrderDate": "2025-01-15T10:30:00.000Z"
}
```

## Testing Checklist

### Scenario 1: Auto-Approve (3-Quote Process)
- [x] Create PR with ≥3 quotes
- [x] Move through workflow to COMPLETED
- [x] Select "Yes" for order closed without issues
- [x] Verify vendor approved for configured duration (default 12 months)
- [x] Verify approval reason is "auto_3quote"
- [x] Verify notification shows approval message
- [x] Verify vendor shows "Approved" badge in future PRs

### Scenario 2: Auto-Approve (Single Order)
- [x] Create PR with <3 quotes
- [x] Move through workflow to COMPLETED
- [x] Select "Yes" for order closed without issues
- [x] Verify vendor approved for configured duration (default 6 months)
- [x] Verify approval reason is "auto_completed"

### Scenario 3: Manual Approve Despite Issues
- [x] Complete order with issues ("No")
- [x] Check "Approve vendor despite issues"
- [x] Provide justification
- [x] Verify vendor approved for configured duration (default 12 months)
- [x] Verify approval reason is "manual"
- [x] Verify justification stored in approvalNote

### Scenario 4: No Approval (Issues, No Override)
- [x] Complete order with issues ("No")
- [x] Do NOT check "Approve despite issues"
- [x] Verify vendor remains non-approved
- [x] Verify vendor shows "Not Approved" badge

### Organization Config
- [x] Verify default durations (12, 6, 12) work correctly
- [x] Update org config, verify new durations applied
- [x] Verify fallback to defaults if config missing

## Related Files

### Modified
- `src/components/pr/OrderedStatusActions.tsx` - Enhanced with org config usage
- `src/components/pr/PRView.tsx` - Added vendor approval status display

### Configuration
- `src/types/organization.ts` - Vendor approval duration fields
- `src/services/organization.ts` - Organization config service
- `src/services/referenceDataAdmin.ts` - Vendor update service

### Documentation
- `docs/AUTOMATIC_VENDOR_APPROVAL_2025-11-07.md` (this file)

## Future Enhancements

1. **Vendor Performance Dashboard**
   - Show all completed orders for a vendor
   - Display issue rate
   - Show approval history timeline

2. **Multi-Criteria Approval**
   - Require N successful orders before approval
   - Weight approval duration by order value
   - Consider delivery time performance

3. **Approval Renewal Notifications**
   - Email procurement team when vendor approval expires soon
   - Auto-extend approvals based on continued good performance

4. **Vendor Rating System**
   - Rate vendors on multiple criteria (quality, delivery, service)
   - Use ratings to adjust approval duration
   - Block vendors with consistently poor ratings

## Notes

- Vendor approval is independent of PR approval workflow
- Multiple users can approve the same vendor via different completed orders
- Latest approval overwrites previous approval data
- Expired approvals don't prevent vendor selection, just indicate status
- Organization config changes apply to new approvals, not retroactively

## Support

For questions or issues with automatic vendor approval:
1. Check organization config in Firestore
2. Verify vendor exists in reference data
3. Check console logs for approval attempt messages
4. Review vendor record in Firestore for approval fields

