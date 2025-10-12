# Integration Testing Checklist - PR System Alignment

## Test Environment Setup
- [ ] Database migration script executed successfully
- [ ] All new type definitions compile without errors
- [ ] Firebase Functions deployed
- [ ] Organization configurations set up with email addresses

## Phase 1-5: Dashboard & Filtering Tests

### MY ACTIONS Button (Phase 4)
- [ ] Button appears for Requestors, Approvers, Finance/Admin, Asset Management
- [ ] Button does NOT appear for Procurement (Level 3)
- [ ] Count badge shows correct number of pending actions
- [ ] Filter toggles correctly
- [ ] Shows correct PRs for each user role:
  - [ ] Requestors: Own PRs in REVISION_REQUIRED
  - [ ] Approvers: PRs in PENDING_APPROVAL assigned to them
  - [ ] Finance/Admin: POs in APPROVED
  - [ ] Asset Management: POs in ORDERED

### Advanced Search & Filtering (Phase 5)
- [ ] Advanced filter panel opens/closes
- [ ] All filter fields work independently
- [ ] Combined filters work with AND logic
- [ ] Search text filters PR number, description, vendor
- [ ] Date range filters work correctly
- [ ] Amount range filters work correctly
- [ ] Active filters display as chips
- [ ] Clear All Filters button works
- [ ] Search results analytics display correctly:
  - [ ] Number of transactions
  - [ ] Total transaction value
  - [ ] Average transaction value
- [ ] Export to CSV generates valid file with:
  - [ ] Analytics summary at top
  - [ ] All filtered results
  - [ ] Proper CSV escaping

## Phase 6-7: Approval Workflow Tests

### Dual Approval (Phase 6)
- [ ] PRs above Rule 2 threshold set `requiresDualApproval: true`
- [ ] System assigns both `approver` and `approver2` fields
- [ ] Both approvers notified simultaneously
- [ ] Dual approval status displays correctly
- [ ] First approver can approve (status shows "1 of 2")
- [ ] Second approver notified of first approval
- [ ] Second approver can approve
- [ ] Both approvals required to move to APPROVED
- [ ] Either approver can reject (stops process)
- [ ] Approval history tracks both approvals

### Approval Justification (Phase 7)
- [ ] Justification UI appears for 3-quote scenarios only
- [ ] "Value for Money" button works for lowest quote
- [ ] Custom justification field works
- [ ] Validation prevents approval without justification
- [ ] Both approvers must provide justification in dual-approval
- [ ] Justifications stored in `firstApproverJustification`, `secondApproverJustification`
- [ ] 1-quote scenarios don't require justification

## Phase 8-9: Document Management Tests

### APPROVED Status Processing (Phase 8)
- [ ] ApprovedStatusActions component displays for Level 1, 3, 4
- [ ] Proforma invoice upload works
- [ ] Proforma override with justification works
- [ ] Proof of Payment upload works
- [ ] PoP override with justification works
- [ ] ETD (Estimated Delivery Date) required field enforced
- [ ] Validation prevents ORDERED without required docs:
  - [ ] ETD required for ALL POs
  - [ ] Proforma required if above Rule 1 (or override)
  - [ ] PoP required if above Rule 1 (or override)
- [ ] Notify Finance button works
- [ ] Notify Procurement button works
- [ ] Move to ORDERED validates all requirements
- [ ] PR becomes PO (objectType changes to 'PO')

### ORDERED Status Processing (Phase 9)
- [ ] OrderedStatusActions component displays for Procurement, Asset Management, Finance (below Rule 1)
- [ ] Delivery note upload works
- [ ] Delivery photos upload works (multiple)
- [ ] Delivery override with justification works
- [ ] Move to COMPLETED workflow:
  - [ ] Validates delivery docs OR override
  - [ ] "Order closed without issues?" question displays
  - [ ] YES option auto-approves vendor:
    - [ ] 12 months if 3-quote process
    - [ ] 6 months if other
  - [ ] NO option requires issue note
  - [ ] NO with override checkbox requires justification
  - [ ] NO without override leaves vendor non-approved
  - [ ] Vendor approval fields updated correctly
  - [ ] Vendor expiry date calculated correctly

## Phase 10-11: Vendor & Notifications Tests

### Vendor Management (Phase 10)
- [ ] Vendor details page displays all information
- [ ] Approval status shows correctly
- [ ] Approval expiry date displays
- [ ] High-value vendor badge displays when applicable
- [ ] Manual approve requires justification (if no recent orders)
- [ ] De-approve always requires justification
- [ ] Daily vendor expiry Cloud Function:
  - [ ] Checks approved vendors daily
  - [ ] Auto-deactivates expired vendors
  - [ ] Sends expiry notifications
  - [ ] Handles high-value vendor rules

### Automated Notifications (Phase 11)
- [ ] Daily reminders (8:00 AM):
  - [ ] Procurement reminders sent
  - [ ] Approver reminders sent
  - [ ] Requestor reminders sent
  - [ ] Finance reminders sent
  - [ ] Asset Management reminders sent
- [ ] Urgent reminders (3:00 PM):
  - [ ] Only sent for items > 2 business days
  - [ ] "URGENT" prefix in subject
  - [ ] Business days calculated correctly
- [ ] Delivery delay notifications:
  - [ ] Triggered 3 days after ETD
  - [ ] Sent to correct stakeholders
  - [ ] Only sent once per PO

## Phase 12-14: Additional Features Tests

### PR Resurrection (Phase 12)
- [ ] Resurrection button shows for REJECTED PRs (Procurement/Admin)
- [ ] Resurrection button shows for CANCELED PRs (Requestor/Admin)
- [ ] REJECTED PRs restore to highest previous status
- [ ] CANCELED PRs restore to SUBMITTED
- [ ] Resurrection logged in history
- [ ] Notifications sent to stakeholders

### Urgency Management (Phase 13)
- [ ] SUBMITTED/IN_QUEUE: Urgency locked (cannot change)
- [ ] PENDING_APPROVAL onward: Procurement can change
- [ ] APPROVED onward: Procurement and Approvers can change
- [ ] Administrator can always change
- [ ] UI shows appropriate controls based on permissions
- [ ] Changes saved and reflected immediately

### Procurement User Management (Phase 14)
- [ ] Procurement (Level 3) can create Level 5 users
- [ ] Procurement can edit Level 5 users
- [ ] Procurement can delete Level 5 users
- [ ] Procurement can activate/deactivate Level 5 users
- [ ] Procurement CANNOT modify Level 1-4 users
- [ ] Permission level dropdown filtered for Procurement
- [ ] Error messages show when attempting unauthorized actions

### Dashboard UX (Phase 15)
- [ ] Urgency column displays in table
- [ ] Urgent items have visual highlighting
- [ ] Resubmitted Date column shows when filter = RESUBMITTED
- [ ] All metrics display correctly
- [ ] Metrics calculate properly

## Critical Integration Tests

### End-to-End PR Lifecycle
1. [ ] **Create PR**:
   - [ ] Basic info validation
   - [ ] Line items required
   - [ ] Vehicle field shows when expense type = Vehicle
   - [ ] PR number generated correctly
   - [ ] Status = SUBMITTED
   - [ ] Notification sent to Procurement

2. [ ] **SUBMITTED → IN_QUEUE**:
   - [ ] Procurement can edit fields (except canonical)
   - [ ] Can move to IN_QUEUE
   - [ ] Can request revision
   - [ ] Can reject

3. [ ] **IN_QUEUE → PENDING_APPROVAL**:
   - [ ] Quote validation works
   - [ ] Dual approval detected for Rule 2
   - [ ] Approver(s) assigned correctly
   - [ ] Push to Approver works
   - [ ] Both approvers notified (if dual)

4. [ ] **PENDING_APPROVAL → APPROVED**:
   - [ ] Single approval works
   - [ ] Dual approval requires both
   - [ ] Justification required for 3-quote
   - [ ] Object type becomes 'PO'
   - [ ] Status = APPROVED

5. [ ] **APPROVED → ORDERED**:
   - [ ] Document uploads work
   - [ ] Overrides with justification work
   - [ ] ETD validation enforced
   - [ ] Status = ORDERED

6. [ ] **ORDERED → COMPLETED**:
   - [ ] Delivery docs upload
   - [ ] Vendor performance question works
   - [ ] Vendor auto-approval works
   - [ ] Status = COMPLETED
   - [ ] Completion notification sent

### Edge Cases
- [ ] Requestor can cancel up to PENDING_APPROVAL
- [ ] Requestor cannot cancel from APPROVED onward
- [ ] Dual approval: rejection by either stops process
- [ ] High-value vendor rules enforced
- [ ] Vendor approval expiry works
- [ ] Organization email configurations used correctly

## Performance Tests
- [ ] Dashboard loads within 3 seconds
- [ ] Advanced filters respond in real-time
- [ ] Large PR lists (100+) perform well
- [ ] File uploads complete successfully
- [ ] CSV export handles large datasets

## Security Tests
- [ ] Role-based access control enforced
- [ ] Users cannot edit PRs they don't have permission for
- [ ] Users cannot approve their own PRs
- [ ] Organization isolation works correctly
- [ ] File upload security validations work

## Browser Compatibility
- [ ] Chrome/Edge
- [ ] Firefox
- [ ] Safari
- [ ] Mobile responsive design

## Known Issues to Fix
1. Pre-existing TypeScript errors in test files
2. Organization selector type compatibility
3. User type mismatches in some components
4. Missing imports or module references

---

**Testing Status**: Ready for execution
**Date**: October 2025
**Tester**: Development Team

