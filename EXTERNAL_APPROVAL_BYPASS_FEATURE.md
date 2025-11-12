# External Approval Bypass Feature - Implementation Summary

## Overview
Added functionality for Finance/Admin and Superusers to bypass the normal approval process when approval has been obtained externally (e.g., bulk budget approval, board meeting approval).

## Use Cases
- PR was approved in a bulk budget meeting
- Board or executive directive approved the purchase
- Annual budget pre-approval
- Emergency procurement approved by management

## Changes Made

### 1. PR Type Updates (`src/types/pr.ts`)
Added new fields to track external approvals:
- `externalApprovalBypass?: boolean` - Flag indicating external approval was used
- `externalApprovalJustification?: string` - Required explanation of where approval was obtained
- `externalApprovalBy?: string` - User ID who processed the bypass
- `externalApprovalDate?: string` - Timestamp of external approval

### 2. New Component (`src/components/pr/ExternalApprovalBypass.tsx`)
Created dedicated component with:
- **Permission Check**: Only visible to Finance Admin (level 4) and Superuser (level 1)
- **Status Check**: Only appears in PENDING_APPROVAL status
- **Checkbox**: Must be explicitly enabled
- **Justification Field**: Required, minimum 20 characters
- **Confirmation Dialog**: Shows PR details and confirms action
- **Visual Design**: Warning-colored border and background when enabled

#### Features:
- Real-time validation of justification length
- Comprehensive confirmation dialog
- Updates approval workflow to mark as approved
- Sends status change notifications
- Records bypass action in PR history

### 3. PRView Integration (`src/components/pr/PRView.tsx`)
- Imported `ExternalApprovalBypass` component
- Added component above regular `ApproverActions`
- Passes PR, currentUser, and onStatusChange callback

### 4. Other Fixes Included
- **Firestore Query Fix** (`src/services/pr.ts`): Fixed composite filter issue causing PR submission errors
- **Admin Notifications** (`src/services/notification.ts`): Added admin@1pwrafrica.com to notifications from APPROVED status onwards
- **Payment Type Feature** (see `PAYMENT_TYPE_FEATURE.md`)

## Workflow

### Before External Bypass:
1. PR created → SUBMITTED
2. Procurement → IN_QUEUE
3. Assigned to Approver → PENDING_APPROVAL
4. **Approver must approve** → APPROVED

### With External Bypass:
1. PR created → SUBMITTED
2. Procurement → IN_QUEUE
3. Assigned to Approver → PENDING_APPROVAL
4. **Finance/Admin uses External Bypass** → APPROVED ✨

## User Interface

### When Disabled:
```
┌─────────────────────────────────────────┐
│ ⚠ External Approval Bypass              │
├─────────────────────────────────────────┤
│ ℹ Use this feature when: Approval has   │
│   already been obtained externally...    │
│                                          │
│ ☐ Enable External Approval Bypass       │
│                                          │
│ ✓ Available to Finance Admin and        │
│   Superusers only                        │
└─────────────────────────────────────────┘
```

### When Enabled:
```
┌─────────────────────────────────────────┐
│ ⚠ External Approval Bypass    [WARNING] │
├─────────────────────────────────────────┤
│ ℹ Use this feature when: Approval has   │
│   already been obtained externally...    │
│                                          │
│ ☑ Enable External Approval Bypass       │
│                                          │
│ ┌───────────────────────────────────┐   │
│ │ Justification (Required)          │   │
│ │                                   │   │
│ │ Explain where and how the         │   │
│ │ approval was obtained...          │   │
│ └───────────────────────────────────┘   │
│                                          │
│ [✓ Approve via External Bypass] [Cancel]│
└─────────────────────────────────────────┘
```

### Confirmation Dialog:
```
┌─────────────────────────────────────────┐
│ ⚠ Confirm External Approval Bypass      │
├─────────────────────────────────────────┤
│ ⚠ WARNING: This action will:            │
│  • Skip the normal approver endorsement │
│  • Mark the PR as APPROVED immediately  │
│  • Record your justification in history │
│  • Send notifications to stakeholders   │
│                                          │
│ PR Number: 251112-0013-1PL-LS           │
│ Description: New office equipment       │
│ Amount: LSL 15,000                      │
│                                          │
│ Justification:                          │
│ ┌─────────────────────────────────────┐ │
│ │ Approved in FY2025 Budget Board     │ │
│ │ Meeting on 2025-01-15, minute #7.3  │ │
│ └─────────────────────────────────────┘ │
│                                          │
│             [Cancel] [Confirm Bypass]    │
└─────────────────────────────────────────┘
```

## Database Updates

### PR Document Changes:
```javascript
{
  // ... existing fields ...
  status: "APPROVED",  // Changed from PENDING_APPROVAL
  
  // New fields
  externalApprovalBypass: true,
  externalApprovalJustification: "Approved in FY2025 Budget...",
  externalApprovalBy: "user123",
  externalApprovalDate: "2025-11-12T14:30:00.000Z",
  
  // Updated approval workflow
  approvalWorkflow: {
    firstApprovalComplete: true,
    secondApprovalComplete: true,  // If dual approval required
    firstApproverJustification: "External Approval Bypass: Approved in FY2025 Budget...",
    approvalHistory: [
      {
        approverId: "user123",
        timestamp: "2025-11-12T14:30:00.000Z",
        approved: true,
        notes: "External Approval Bypass by John Doe: Approved in FY2025 Budget..."
      }
    ]
  }
}
```

## Permission Levels

### Who Can Use This Feature:
- **Level 1 - Superuser/Administrator**: Full access
- **Level 4 - Finance Admin**: Full access

### Who Cannot Use This Feature:
- Level 2 - Senior Approver
- Level 3 - Procurement Officer
- Level 5 - Requester
- Level 6 - Finance Approver

## Validation Rules

1. **Checkbox must be enabled**: User must explicitly check the box
2. **Justification required**: Cannot be empty
3. **Minimum length**: At least 20 characters
4. **Confirmation required**: User must confirm action in dialog
5. **Permission check**: Only Level 1 or Level 4 users
6. **Status check**: Only works in PENDING_APPROVAL status

## Notifications

When external bypass is used:
- **Status Change Notification** sent to:
  - Procurement team
  - Requestor
  - admin@1pwrafrica.com (as of APPROVED status)
- **Notification includes**: External bypass justification in notes

## Audit Trail

The system records:
1. **Who**: User ID and name
2. **When**: Timestamp
3. **Why**: Full justification text
4. **What**: Status change from PENDING_APPROVAL to APPROVED
5. **How**: "External Approval Bypass" flag set to true

All information is stored in:
- PR document fields
- Approval workflow history
- Approval history array

## Testing Checklist

- [ ] Feature only visible to Finance Admin (level 4)
- [ ] Feature only visible to Superuser (level 1)
- [ ] Feature NOT visible to other permission levels
- [ ] Feature only appears in PENDING_APPROVAL status
- [ ] Checkbox must be checked to proceed
- [ ] Justification field validation works (20 char minimum)
- [ ] Confirmation dialog shows correct PR details
- [ ] PR status changes to APPROVED after bypass
- [ ] Approval workflow is correctly updated
- [ ] Notifications are sent to appropriate parties
- [ ] External bypass fields are saved correctly
- [ ] Approval history records the bypass action
- [ ] admin@1pwrafrica.com receives notification

## Future Enhancements (Optional)

1. Add reporting for all external bypasses
2. Require second-level approval for bypasses over certain amounts
3. Add ability to attach supporting documents (meeting minutes, etc.)
4. Create dashboard widget showing recent bypasses
5. Email digest of all bypasses to management
6. Add bulk bypass feature for multiple PRs from same approval event

## Example Justifications

### Good Examples:
- ✅ "Approved in FY2025 Annual Budget Board Meeting on 2025-01-15, Agenda Item 7.3, Minute #127"
- ✅ "Executive Committee Pre-approval for Q4 2024 Capital Expenditure, Meeting Date 2024-12-10"
- ✅ "Emergency procurement authorized by CEO via email on 2025-01-20 (Ref: CEO-2025-023)"
- ✅ "Included in FY2025 Approved Budget, Department: Engineering, Line Item: Equipment #45"

### Bad Examples:
- ❌ "Already approved" (too vague)
- ❌ "Board meeting" (no date or reference)
- ❌ "Budget" (insufficient detail)
- ❌ "OK" (not acceptable)

## Security Considerations

1. **Permission-based access**: Only high-level users can bypass
2. **Audit trail**: All bypasses are fully logged
3. **Justification requirement**: Prevents casual/accidental use
4. **Confirmation dialog**: Prevents mis-clicks
5. **Notification system**: Keeps stakeholders informed
6. **Irreversible**: Cannot be undone (must use resurrection if needed)

## Error Handling

The component handles:
- Network errors during PR update
- Notification sending failures
- Invalid justification input
- Permission check failures
- Missing PR data

All errors display user-friendly messages via snackbar notifications.

