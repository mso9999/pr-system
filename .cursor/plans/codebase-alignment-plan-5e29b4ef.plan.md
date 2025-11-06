<!-- 5e29b4ef-58a8-4495-b8ba-4cff20eba4f2 ab49f5a5-81ad-4d92-98c0-0378f2c021b6 -->
# PR System - Specifications Alignment Plan

## Gap Analysis Summary

### Critical Gaps Identified

After reviewing Specifications.md, workflow documentation (HTML files), and the current codebase, the following major gaps exist between specifications and implementation:

#### 1. Dashboard & User Interface (HIGH PRIORITY)

- **MY ACTIONS button** not implemented (Spec: lines 20-23)
  - Should filter PRs/POs requiring specific user action
  - Not available for Procurement (they see all)
  - Shows count badge
- **Advanced Search & Filtering** not implemented (Spec: lines 66-109)
  - Multi-field search panel missing
  - Filter by: Requestor, Approver, Vendor, Department, Site, Vehicle, Project Category, Expense Type
  - Date range filters, Amount range
  - Active filter chips/badges
  - Clear All Filters button
- **Search Results Analytics** not implemented (Spec: lines 94-102)
  - Number of Transactions count
  - Total Transaction Value
  - Average Transaction Value
- **Export Capability** not implemented (Spec: lines 104-108)
  - Export to CSV/Excel
- **Missing Dashboard Columns** (Spec: lines 56-64)
  - Urgency column not displayed in table
  - Resubmitted Date column missing
- **Some Metrics** not fully implemented in MetricsPanel
  - Quotes Required, Adjudication Required, Customs Required, Completion Rate

#### 2. Data Model Enhancements (CRITICAL)

- **Dual Approver Support** (Spec: lines 767, 809-839)
  - Missing `approver2` field for second approver
  - Missing `requiresDualApproval`, `firstApprovalComplete`, `secondApprovalComplete` flags
  - Missing `firstApproverJustification`, `secondApproverJustification` fields
- **Document Management Fields** (Spec: lines 769-780)
  - `proformaInvoice`, `proformaOverride`, `proformaOverrideJustification`
  - `proofOfPayment`, `popOverride`, `popOverrideJustification`
  - `deliveryNote`, `deliveryPhotos`, `deliveryDocOverride`, `deliveryDocOverrideJustification`
  - `poDocument` (system-generated PO document)
  - `estimatedDeliveryDate` (ETD)
  - `selectedVendor` (final selected vendor in APPROVED status)
- **Supplier Data Fields** for non-approved vendors (Spec: lines 782-790)
  - `supplierName`, `supplierContact` (phone/email/website)
  - `supplierDataEnteredBy`, `supplierDataTimestamp`
- **Object Type Field** (Spec: lines 748-750)
  - `objectType`: "PR" (pre-APPROVED) or "PO" (APPROVED onward)
  - PR number becomes PO number at APPROVED status

#### 3. Organization Configuration (CRITICAL)

File: `src/types/organization.ts` is minimal - needs extensive enhancement

- **Email Configuration Fields** (Spec: lines 268-277)
  - `procurementEmail`, `assetManagementEmail`, `adminEmail`
- **Business Rules Configuration**
  - `rule1ThresholdAmount`, `rule2ThresholdAmount`, `allowedCurrencies`
- **Vendor Approval Duration Settings** (Spec: lines 282-295)
  - `vendorApproval3QuoteDuration` (default: 12 months)
  - `vendorApprovalCompletedDuration` (default: 6 months)
  - `vendorApprovalManualDuration` (default: 12 months)
- **High-Value Vendor Rules** (Spec: lines 291-305)
  - `highValueVendorMultiplier` (default: 10x Rule 2 threshold)
  - `highValueVendorMaxDuration` (default: 24 months)
- **Other Settings**
  - `timeZone`, `businessDaysConfiguration`, `holidayCalendar`

#### 4. Approval Workflow (HIGH PRIORITY)

- **Dual Approval** not fully implemented (Spec: lines 1187-1196, 595-601)
  - Above Rule 2 threshold requires TWO Level 2 approvers
  - Concurrent approval (both notified simultaneously)
  - Can act in any order
  - Both must approve for PR to proceed
  - If either rejects, process stops immediately
- **Approval Justification** not fully implemented (Spec: lines 1204-1232)
  - Required ONLY for 3-quote scenarios
  - Default "Value for Money" option if lowest quote selected
  - Custom justification required if non-lowest quote selected
  - Both approvers must provide justification in dual-approval

#### 5. APPROVED Status Processing (NOT IMPLEMENTED)

Spec: lines 1003-1083

- **Document Upload Actions**
  - Upload Proforma Invoice
  - Upload Proof of Payment (PoP)
  - Set overrides with justification for both
- **Validation Before ORDERED**
  - ETD required for ALL POs
  - Proforma required if above Rule 1 (or override)
  - PoP required if above Rule 1 (or override)
- **Inter-team Notifications**
  - Notify Finance for payment
  - Notify Procurement for uploads
- **PO Document Generation**
  - System-generated downloadable PO document

#### 6. ORDERED Status Processing (NOT IMPLEMENTED)

Spec: lines 1085-1155

- **Delivery Documentation Actions**
  - Upload Delivery Note
  - Upload Delivery Photos
  - Set override with justification
- **Move to COMPLETED Workflow**
  - Validation: docs OR override required
  - **NEW: Vendor Performance Question** "Order closed without issues?"
    - YES: Auto-approve vendor (12 months if 3-quote, 6 months otherwise)
    - NO: Log issue, optional override to approve despite issues
- **Automatic Delay Notification**
  - Trigger: 3 business days after ETD in ORDERED status
  - Alert stakeholders about delivery delay

#### 7. Vendor Management (PARTIALLY IMPLEMENTED)

- **Automated Vendor Approval** not implemented (Spec: lines 392-418, 1107-1136)
  - Auto-approve on satisfactory COMPLETED orders
  - Approval expiry dates and tracking
  - Daily job to check expiry and auto-deactivate
- **Vendor Approval Expiry System** not implemented (Spec: lines 464-478)
  - Daily automated job checking expiry dates
  - Email notifications on expiry
  - No perpetual approval
- **High-Value Vendor Rules** not implemented (Spec: lines 480-510)
  - Classification based on cumulative order value
  - Stricter approval duration limits
  - Requires 3-quote process or manual override
- **Vendor Details Page** not fully implemented (Spec: lines 512-562)
  - Bank letter upload
  - Corporate documents upload
  - Associated PRs/POs section
  - Performance metrics

#### 8. Automated Notifications (PARTIALLY IMPLEMENTED)

- **Daily Reminder System** not implemented (Spec: lines 1157-1166)
  - 8:00 AM daily reminders for pending actions
  - Procurement, Approver, Requestor, Finance/Admin, Asset Management
- **Urgent Reminder System** not implemented (Spec: lines 1169-1176)
  - Twice daily (8:00 AM and 3:00 PM) for items > 2 business days
  - "URGENT" prefix in subject line
- **Delay Notifications** not implemented (Spec: lines 1138-1144)
  - Automatic alert when ORDERED > 3 days after ETD

#### 9. PR Resurrection (NOT IMPLEMENTED)

Spec: lines 968-993

- REJECTED PRs can be resurrected by Procurement/Admin to highest previous status
- CANCELED PRs can be resurrected by Requestor/Admin to SUBMITTED status
- Resurrect actions and UI components missing

#### 10. Urgency Management (PARTIALLY IMPLEMENTED)

Spec: lines 185-198

- **Urgency Change Restrictions**
  - SUBMITTED, IN_QUEUE: Locked at requestor's setting
  - PENDING_APPROVAL onward: Procurement can change to Urgent
  - APPROVED onward (PO): Procurement OR Approvers can change to Urgent
  - Administrator can always change
- Current implementation may not enforce these restrictions

#### 11. User Management (PARTIALLY IMPLEMENTED)

Spec: lines 671-673

- **Procurement Limited User Management**
  - Level 3 can create, delete, activate, deactivate Level 5 (Requester) only
  - Cannot create or modify other permission levels
  - Purpose: Day-to-day user onboarding/offboarding

---

## Incremental Implementation Plan

### Phase 0: Preparation & Git Commit (BEFORE ANY CODE CHANGES)

**Objective:** Commit current state and push documentation

**Actions:**

1. **Stage and commit** all uncommitted changes:

   - `Specifications.md` (modified)
   - All new HTML documentation files
   - `PR_WORKFLOW_FLOWCHART.md`

2. **Push to remote** repository
3. **Create feature branch** for implementation work

**Testing Checkpoint:**

- Verify all changes pushed successfully
- Verify branch created
- Document current commit hash for rollback reference

---

### Phase 1: Data Model & Type Definitions (FOUNDATION)

**Priority:** CRITICAL

**Estimated Effort:** 3-4 hours

**Files to Modify:**

- `src/types/pr.ts`
- `src/types/organization.ts`
- `src/types/referenceData.ts` (vendor enhancements)

**Changes:**

#### 1.1 PR Type Enhancements

```typescript
// Add to PRRequest interface
objectType: 'PR' | 'PO'; // PR before APPROVED, PO from APPROVED onward
approver2?: string; // Second approver for dual-approval
requiresDualApproval: boolean;

// Document Management Fields
proformaInvoice?: Attachment;
proformaOverride?: boolean;
proformaOverrideJustification?: string;
proofOfPayment?: Attachment;
popOverride?: boolean;
popOverrideJustification?: string;
deliveryNote?: Attachment;
deliveryPhotos?: Attachment[];
deliveryDocOverride?: boolean;
deliveryDocOverrideJustification?: string;
poDocument?: Attachment;
selectedVendor?: string; // Final vendor selected in APPROVED
estimatedDeliveryDate?: string; // ETD

// Supplier Data for non-approved vendors
supplierName?: string;
supplierContact?: {
  phone?: string;
  email?: string;
  website?: string;
};
supplierDataEnteredBy?: string;
supplierDataTimestamp?: string;
```

#### 1.2 Approval Workflow Enhancement

```typescript
// Enhance ApprovalWorkflow interface
interface ApprovalWorkflow {
  currentApprover: string | null;
  secondApprover?: string | null; // For dual-approval
  requiresDualApproval: boolean;
  firstApprovalComplete: boolean;
  firstApproverJustification?: string;
  secondApprovalComplete: boolean;
  secondApproverJustification?: string;
  approvalHistory: ApprovalHistoryItem[];
  lastUpdated: string;
}
```

#### 1.3 Organization Type Enhancements

```typescript
interface Organization {
  id: string;
  name: string;
  code?: string;
  active: boolean;
  
  // Email Configuration
  procurementEmail?: string;
  assetManagementEmail?: string;
  adminEmail?: string;
  
  // Business Rules
  baseCurrency: string;
  allowedCurrencies: string[];
  rule1ThresholdAmount?: number;
  rule2ThresholdAmount?: number;
  
  // Vendor Approval Duration Settings
  vendorApproval3QuoteDuration: number; // months, default 12
  vendorApprovalCompletedDuration: number; // months, default 6
  vendorApprovalManualDuration: number; // months, default 12
  
  // High-Value Vendor Rules
  highValueVendorMultiplier: number; // default 10
  highValueVendorMaxDuration: number; // months, default 24
  
  // Other Settings
  timeZone?: string;
  businessDaysConfiguration?: any;
  holidayCalendar?: any;
}
```

#### 1.4 Vendor Type Enhancements

```typescript
// Add to Vendor interface in referenceData.ts
interface Vendor {
  id: string;
  name: string;
  code?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  active: boolean;
  
  // Approval Status Tracking
  isApproved: boolean;
  approvalDate?: string;
  approvalExpiryDate?: string;
  approvalReason?: 'auto_3quote' | 'auto_completed' | 'manual';
  approvedBy?: string;
  approvalNote?: string; // Justification or override reason
  associatedPONumber?: string; // If auto-approved
  lastCompletedOrderDate?: string;
  last3QuoteProcessDate?: string;
  
  // High-Value Classification
  isHighValue?: boolean;
  cumulativeOrderValue?: number;
  
  // Documents
  bankLetter?: Attachment;
  corporateDocuments?: Attachment[];
}
```

**Testing Checkpoint Phase 1:**

- TypeScript compilation passes
- No type errors in existing code
- Run `npm run type-check` successfully
- **Git commit:** "Phase 1: Enhanced type definitions for PR data model, organization config, and vendor management"

---

### Phase 2: Database Migration Script

**Priority:** CRITICAL

**Estimated Effort:** 2-3 hours

**New Files:**

- `scripts/migrate-data-model-v2.ts`

**Actions:**

1. Create migration script to add new fields to existing PRs
2. Initialize default values for existing organizations
3. Initialize vendor approval fields for existing vendors
4. Run migration on development environment
5. Test data integrity

**Testing Checkpoint Phase 2:**

- Migration script runs without errors
- Existing PRs retain all data + new fields initialized
- No data loss
- Sample PR queries work correctly
- **Git commit:** "Phase 2: Data migration script for enhanced data model"

---

### Phase 3: Organization Service Enhancement

**Priority:** HIGH

**Estimated Effort:** 2-3 hours

**Files to Modify:**

- `src/services/organizationService.ts` (or create if missing)
- `src/components/admin/AdminDashboard.tsx`

**Changes:**

1. Add organization configuration form in Admin Dashboard
2. Email address configuration fields
3. Vendor approval duration settings
4. High-value vendor rules configuration
5. Validation for email formats
6. Save/update organization settings

**Testing Checkpoint Phase 3:**

- Admin can view organization settings
- Admin can update organization settings
- Settings persist correctly
- Email validation works
- **Git commit:** "Phase 3: Organization configuration management"

---

### Phase 4: Dashboard MY ACTIONS Button

**Priority:** HIGH

**Estimated Effort:** 3-4 hours

**Files to Modify:**

- `src/components/dashboard/Dashboard.tsx`
- `src/services/pr.ts` (add filtering logic)
- `src/store/slices/prSlice.ts`

**Changes:**

1. Add `myActionsFilter` state to PR slice
2. Implement MY ACTIONS filter logic:

   - Requestors: Own PRs in REVISION_REQUIRED
   - Approvers: PRs in PENDING_APPROVAL assigned to them
   - Finance/Admin: POs in APPROVED needing documents
   - Asset Management: POs in ORDERED needing delivery docs

3. Add MY ACTIONS button to Dashboard header (NOT for Procurement Level 3)
4. Show count badge
5. Toggle filter on/off

**Testing Checkpoint Phase 4:**

- MY ACTIONS button appears for correct user levels
- Filter shows correct PRs/POs for each role
- Count badge displays correctly
- Toggle works properly
- Procurement users don't see the button
- **Git commit:** "Phase 4: Implement MY ACTIONS personalized filter button"

---

### Phase 5: Advanced Search & Filtering

**Priority:** HIGH

**Estimated Effort:** 6-8 hours

**Files to Modify:**

- `src/components/dashboard/Dashboard.tsx`
- `src/components/dashboard/AdvancedFilterPanel.tsx` (new)
- `src/services/pr.ts` (enhance query logic)

**Changes:**

1. Create `AdvancedFilterPanel` component
2. Implement filter fields:

   - Organization (multi-select)
   - Requestor, Approver, Vendor, Department, Site, Vehicle, Project Category, Expense Type
   - Date ranges (Created, Required, Last Updated)
   - Amount range (Min/Max)
   - Urgency filter

3. Active filter chips/badges display
4. Clear All Filters button
5. Real-time filtering
6. Search results analytics (count, total value, average value)
7. Export to CSV functionality

**Testing Checkpoint Phase 5:**

- Advanced filter panel opens/closes correctly
- Each filter field works independently
- Combined filters work with AND logic
- Active filters display as chips
- Clear All Filters works
- Search results analytics calculate correctly
- Export generates valid CSV file
- **Git commit:** "Phase 5: Advanced search and filtering with analytics"

---

### Phase 6: Dual Approval Workflow

**Priority:** CRITICAL

**Estimated Effort:** 6-8 hours

**Files to Modify:**

- `src/components/pr/ProcurementActions.tsx`
- `src/components/pr/ApproverActions.tsx`
- `src/services/pr.ts`
- `src/utils/prValidation.ts`

**Changes:**

1. Detect when PR requires dual approval (above Rule 2 threshold)
2. Set `requiresDualApproval`, `approver`, `approver2` fields
3. Notify both approvers simultaneously
4. Track first/second approval independently
5. Show approval status: "Waiting for both", "1 of 2 approved (waiting for second)"
6. If either rejects or requests revision, stop process immediately
7. Require both approvals before moving to APPROVED

**Testing Checkpoint Phase 6:**

- PRs above Rule 2 correctly set `requiresDualApproval: true`
- Both approvers are notified simultaneously
- First approval updates status correctly
- Second approver can see first approval status
- Both approvals required to proceed
- Rejection by either approver stops process
- Approval history tracks both approvals
- **Git commit:** "Phase 6: Dual approver concurrent approval workflow"

---

### Phase 7: Approval Justification

**Priority:** HIGH

**Estimated Effort:** 4-5 hours

**Files to Modify:**

- `src/components/pr/ApproverActions.tsx`
- `src/services/pr.ts`

**Changes:**

1. Detect when justification is required (3-quote scenarios)
2. Show justification UI:

   - If lowest quote selected: "Value for Money" radio option OR custom note
   - If non-lowest quote: Custom justification required

3. For dual approval: Both approvers must provide justification
4. Validate justification before allowing approval
5. Store justifications in `firstApproverJustification`, `secondApproverJustification`

**Testing Checkpoint Phase 7:**

- Justification UI only appears for 3-quote scenarios
- "Value for Money" option works for lowest quote
- Custom justification required for non-lowest quote
- Validation prevents approval without justification
- Both approvers must provide justification in dual-approval
- Justifications stored correctly
- **Git commit:** "Phase 7: Approval justification for 3-quote scenarios"

---

### Phase 8: APPROVED Status Processing

**Priority:** CRITICAL

**Estimated Effort:** 8-10 hours

**Files to Create:**

- `src/components/pr/ApprovedStatusActions.tsx` (new)

**Files to Modify:**

- `src/components/pr/PRView.tsx`
- `src/services/pr.ts`
- `src/services/storage.ts`

**Changes:**

1. PR → PO rename at APPROVED status
2. Generate PO document automatically
3. Document upload UI:

   - Proforma Invoice upload
   - Proof of Payment upload
   - Override checkboxes with justification fields

4. ETD (Estimated Delivery Date) input field
5. Validation before ORDERED:

   - ETD required for ALL
   - Proforma required if above Rule 1 (or override)
   - PoP required if above Rule 1 (or override)

6. Inter-team notifications (Notify Finance, Notify Procurement)
7. Move to ORDERED button with validation

**Testing Checkpoint Phase 8:**

- PR becomes PO at APPROVED status
- PO document generated and downloadable
- Documents upload successfully
- Override checkboxes work with justification
- ETD validation works
- Cannot move to ORDERED without required docs/overrides
- Notifications sent correctly
- **Git commit:** "Phase 8: APPROVED status processing and document management"

---

### Phase 9: ORDERED Status Processing

**Priority:** CRITICAL

**Estimated Effort:** 8-10 hours

**Files to Create:**

- `src/components/pr/OrderedStatusActions.tsx` (new)
- `src/components/pr/VendorPerformanceDialog.tsx` (new)

**Files to Modify:**

- `src/components/pr/PRView.tsx`
- `src/services/pr.ts`
- `src/services/vendorService.ts` (create if missing)

**Changes:**

1. Delivery documentation UI:

   - Upload Delivery Note
   - Upload Delivery Photos (multiple)
   - Override checkbox with justification

2. Move to COMPLETED workflow:

   - Validate delivery docs OR override
   - **NEW:** Show "Order closed without issues?" dialog
     - YES option: Auto-approve vendor (12mo if 3-quote, 6mo otherwise)
     - NO option: Require issue note, show override checkbox
   - Update vendor approval status
   - Log to vendor audit trail

3. Automatic delay notification (3 days after ETD)
4. Asset Management department user permissions

**Testing Checkpoint Phase 9:**

- Delivery docs upload successfully
- Override works with justification
- "Order closed without issues?" dialog appears
- YES auto-approves vendor with correct duration
- NO logs issue and optionally overrides
- Vendor approval expiry calculated correctly
- Delay notification sent correctly
- Asset Management users have correct permissions
- **Git commit:** "Phase 9: ORDERED status processing and automated vendor approval"

---

### Phase 10: Vendor Management Enhancements

**Priority:** HIGH

**Estimated Effort:** 6-8 hours

**Files to Create:**

- `src/components/admin/VendorDetailsPage.tsx` (new)
- `scripts/daily-vendor-expiry-check.ts` (new Cloud Function)

**Files to Modify:**

- `src/components/admin/ReferenceDataManagement.tsx`
- `src/services/referenceDataAdmin.ts`

**Changes:**

1. Vendor Details Page:

   - Vendor information section
   - Bank letter upload
   - Corporate documents upload (multiple)
   - Associated PRs/POs section with filtering
   - Performance metrics

2. Manual vendor approval/de-approval with justification requirements
3. Vendor approval expiry display
4. High-value vendor badge
5. Daily automated job (Cloud Function):

   - Check vendor approval expiry dates
   - Auto-deactivate expired vendors
   - Send expiry notifications to Procurement

**Testing Checkpoint Phase 10:**

- Vendor details page displays all information
- Documents upload successfully
- Associated PRs/POs list correctly
- Manual approval requires justification when needed
- De-approval always requires justification
- High-value vendor classification works
- Daily job checks and deactivates correctly
- Expiry notifications sent
- **Git commit:** "Phase 10: Enhanced vendor management and expiry system"

---

### Phase 11: Automated Notifications

**Priority:** HIGH

**Estimated Effort:** 6-8 hours

**Files to Create:**

- `functions/src/scheduledNotifications.ts` (new Cloud Function)

**Files to Modify:**

- `functions/src/index.ts`
- `src/services/notification.ts`

**Changes:**

1. Daily Reminder Cloud Function (8:00 AM):

   - Query PRs/POs pending action
   - Send reminders to: Procurement, Approvers, Requestors, Finance/Admin, Asset Management
   - Include days open and action needed

2. Urgent Reminder Logic (twice daily for >2 business days):

   - Calculate business days
   - Send at 8:00 AM and 3:00 PM
   - Add "URGENT" prefix to subject

3. Delay Notification Logic:

   - Check ORDERED POs > 3 days after ETD
   - Send delay alert to stakeholders

**Testing Checkpoint Phase 11:**

- Daily reminder function runs on schedule
- Reminders sent to correct users
- Urgent reminders sent twice daily for overdue items
- Business days calculated correctly
- Delay notifications sent at correct time
- All emails use organization's configured email addresses
- **Git commit:** "Phase 11: Automated reminder and delay notification system"

---

### Phase 12: PR Resurrection Feature

**Priority:** MEDIUM

**Estimated Effort:** 3-4 hours

**Files to Modify:**

- `src/components/pr/PRView.tsx`
- `src/components/dashboard/Dashboard.tsx`
- `src/services/pr.ts`

**Changes:**

1. Add "Resurrect" button for REJECTED/CANCELED PRs
2. Permission checks:

   - REJECTED: Procurement/Admin can resurrect to highest previous status
   - CANCELED: Requestor/Admin can resurrect to SUBMITTED

3. Resurrection action updates status
4. Log resurrection in history
5. Send notifications to stakeholders

**Testing Checkpoint Phase 12:**

- Resurrect button appears for correct statuses
- Permission checks work correctly
- REJECTED PRs restored to correct status
- CANCELED PRs restored to SUBMITTED
- History logged correctly
- Notifications sent
- **Git commit:** "Phase 12: PR resurrection feature for REJECTED and CANCELED PRs"

---

### Phase 13: Urgency Management Restrictions

**Priority:** MEDIUM

**Estimated Effort:** 2-3 hours

**Files to Modify:**

- `src/components/pr/PRView.tsx`
- `src/components/pr/ProcurementActions.tsx`
- `src/services/pr.ts`

**Changes:**

1. Implement urgency change restrictions:

   - SUBMITTED, IN_QUEUE: Cannot be changed (locked at requestor's setting)
   - PENDING_APPROVAL onward: Procurement (Level 3) can change
   - APPROVED onward: Procurement OR Approvers (Level 2, 4) can change
   - Administrator can always change

2. Add urgency toggle UI where appropriate
3. Validate permissions before allowing change

**Testing Checkpoint Phase 13:**

- Urgency locked in SUBMITTED/IN_QUEUE
- Procurement can change from PENDING_APPROVAL
- Procurement and Approvers can change from APPROVED
- Administrator can always change
- Unauthorized users cannot change urgency
- **Git commit:** "Phase 13: Urgency management with role-based restrictions"

---

### Phase 14: User Management by Procurement

**Priority:** LOW

**Estimated Effort:** 2-3 hours

**Files to Modify:**

- `src/components/admin/UserManagement.tsx`

**Changes:**

1. Allow Level 3 (Procurement) to create/delete/activate/deactivate Level 5 (Requester) users
2. Restrict Procurement from modifying other permission levels
3. Add permission checks in UI and service layer

**Testing Checkpoint Phase 14:**

- Procurement users can manage Level 5 users
- Procurement cannot modify Level 1-4 users
- Create, delete, activate, deactivate work correctly
- Admin can still manage all users
- **Git commit:** "Phase 14: Limited user management for Procurement"

---

### Phase 15: Dashboard UX Improvements

**Priority:** MEDIUM

**Estimated Effort:** 2-3 hours

**Files to Modify:**

- `src/components/dashboard/Dashboard.tsx`
- `src/components/dashboard/MetricsPanel.tsx`

**Changes:**

1. Add missing columns to PR table:

   - Urgency column (URGENT badge or icon)
   - Resubmitted Date column

2. Add missing metrics:

   - Quotes Required count
   - Adjudication Required count
   - Customs Required count
   - Completion Rate percentage

3. Enhance visual grouping of urgent vs normal items

**Testing Checkpoint Phase 15:**

- All specified columns display correctly
- All metrics calculate correctly
- Urgent items visually separated
- Table sorting works with urgency priority
- **Git commit:** "Phase 15: Dashboard UX improvements with complete metrics"

---

### Phase 16: Integration Testing & Bug Fixes

**Priority:** CRITICAL

**Estimated Effort:** 4-6 hours

**Actions:**

1. End-to-end testing of complete PR lifecycle:

   - Create PR → SUBMITTED → IN_QUEUE → PENDING_APPROVAL → APPROVED → ORDERED → COMPLETED
   - Test dual approval workflow
   - Test document uploads at each stage
   - Test vendor auto-approval

2. Test edge cases:

   - Rejection and resurrection
   - Urgency changes at different stages
   - Override scenarios
   - Expired vendor approvals

3. Test notifications:

   - Status change notifications
   - Automated reminders
   - Delay notifications

4. Test filtering and search
5. Test export functionality
6. Fix any discovered bugs

**Testing Checkpoint Phase 16:**

- Complete PR lifecycle works end-to-end
- All workflows function correctly
- Notifications sent at correct times
- No critical bugs
- Performance acceptable
- **Git commit:** "Phase 16: Integration testing and bug fixes"

---

### Phase 17: Documentation Updates

**Priority:** MEDIUM

**Estimated Effort:** 2-3 hours

**Actions:**

1. Update README.md with new features
2. Create/update API documentation
3. Update deployment guide
4. Create user guide for new features
5. Document configuration requirements

**Testing Checkpoint Phase 17:**

- Documentation accurate and complete
- Installation instructions work
- Configuration examples valid
- **Git commit:** "Phase 17: Updated documentation for all new features"

---

### Phase 18: Final Review & Deployment Preparation

**Priority:** CRITICAL

**Estimated Effort:** 2-3 hours

**Actions:**

1. Code review and cleanup
2. Remove debug logging
3. Optimize performance
4. Final testing on staging environment
5. Create deployment checklist
6. Prepare rollback plan

**Testing Checkpoint Phase 18:**

- Code passes all linter checks
- No TypeScript errors
- All tests pass
- Staging deployment successful
- Rollback plan documented
- **Git commit:** "Phase 18: Final review and deployment preparation"

---

## Total Estimated Effort

- **Development Time:** 70-90 hours (approximately 2-3 weeks for one developer)
- **Testing Time:** Included in each phase
- **Total Phases:** 18 (Phase 0 + Phases 1-17 + Phase 18)

## Risk Mitigation

- Git commits after each phase for easy rollback
- Testing checkpoints prevent cascading failures
- Incremental deployment allows for staged rollout
- Phase 0 ensures documentation preserved before changes

## Success Criteria

- All gaps identified in analysis are addressed
- All testing checkpoints pass
- No regressions in existing functionality
- Code aligns with specifications
- System ready for production deployment

### Phase 6.5: Automatic Approval Rescinding (COMPLETED - Oct 31, 2025)

**Priority:** HIGH

**Estimated Effort:** 3-4 hours

**Status:** ✅ COMPLETED

**Files Modified:**

- `Specifications.md` - Added comprehensive documentation
- `src/types/pr.ts` - Added `lastApprovedAmount` field
- `src/services/pr.ts` - Added `rescindApprovals()` and `shouldRescindApprovalsForAmountChange()` functions
- `src/components/pr/ApproverActions.tsx` - Added `lastApprovedAmount` capture on approval
- `src/components/pr/PRView.tsx` - Added amount change detection and rescission logic

**Changes:**

1. Automatic rescinding of approvals when PO reverts to PR status (APPROVED/ORDERED/COMPLETED → IN_QUEUE or earlier)
2. Automatic rescinding when amount changes exceed thresholds:

   - >5% upward change
   - >20% downward change

3. New `lastApprovedAmount` field to track amount when approved
4. Complete audit trail in approval history
5. User notifications for rescission events

**Testing Checkpoint Phase 6.5:**

- ✅ Status reversion from PO to PR rescinded approvals correctly
- ✅ Amount increase >5% rescinded approvals with notification
- ✅ Amount decrease >20% rescinded approvals with notification
- ✅ Amount changes within thresholds do NOT rescind approvals
- ✅ Dual approvals both rescinded when triggered
- ✅ Audit trail entries created correctly
- ✅ No linter errors in modified files
- ✅ Documentation created: `docs/APPROVAL_RESCINDING_IMPLEMENTATION_2025-10-31.md`

---

### Phase 6.6: Final Price Approval from Proforma Invoice (IN PROGRESS - Nov 2, 2025)

**Priority:** HIGH

**Estimated Effort:** 6-8 hours

**Status:** 🔄 65% COMPLETE (Specifications, Core Implementation & Admin Portal Complete, Final Price Entry UI Pending)

**Files Modified:**

- `Specifications.md` - Added comprehensive final price approval documentation
- `src/types/pr.ts` - Added 10 new fields for final price tracking (NO new status required)
- `src/types/organization.ts` - Added configurable variance thresholds
- `src/services/pr.ts` - Added `checkFinalPriceVariance()` function
- `src/components/pr/ApprovedStatusActions.tsx` - Added state management for final price entry
- `src/components/admin/OrganizationConfig.tsx` - Added Rule 6 & Rule 7 threshold configuration UI
- `docs/FINAL_PRICE_APPROVAL_FEATURE_2025-11-02.md` - Complete feature documentation

**Changes:**

1. **NO new status required** - PO remains in APPROVED status throughout
2. Uses flags for tracking: `finalPriceRequiresApproval` and `finalPriceApproved`
3. Configurable variance thresholds per organization:

   - `finalPriceUpwardVarianceThreshold` (default 5%)
   - `finalPriceDownwardVarianceThreshold` (default 20%)

4. Final price entry by procurement in APPROVED status
5. Automatic variance checking against approved amount
6. Approver sign-off required if variance exceeds thresholds (PO stays in APPROVED)
7. Added as 4th validation requirement before moving to ORDERED
8. Complete final price tracking with audit trail

**Completed:**

- ✅ Specifications documented (PO remains in APPROVED status)
- ✅ Type definitions updated (10 PR fields, organization thresholds)
- ✅ Service function for variance checking (`checkFinalPriceVariance`)
- ✅ State management in ApprovedStatusActions component
- ✅ Validation logic updated in specifications
- ✅ **Admin portal UI for configuring Rule 6 & Rule 7 variance thresholds** (OrganizationConfig.tsx)
- ✅ No linter errors
- ✅ Documentation created and updated: `docs/FINAL_PRICE_APPROVAL_FEATURE_2025-11-02.md`

**Pending:**

- ⏳ Complete UI implementation in ApprovedStatusActions (final price entry form)
- ⏳ Approver actions in PRView for approving/rejecting final price (while in APPROVED status)
- ⏳ Validation logic in "Move to ORDERED" - check finalPriceApproved flag
- ⏳ Visual indicator when final price approval is pending
- ⏳ Notification system integration
- ⏳ Integration testing
- ⏳ User acceptance testing

**Testing Checkpoint Phase 6.6 (Partial):**

- ✅ Variance calculation function works correctly
- ✅ Thresholds properly configurable in organization type
- ✅ **Admin can configure Rule 6 & Rule 7 thresholds per organization**
- ⏳ Final price entry UI in APPROVED status
- ⏳ Flags set correctly when variance exceeds thresholds
- ⏳ PO remains in APPROVED status (no status change)
- ⏳ Approver notification on variance
- ⏳ Approver can approve/reject final price
- ⏳ Validation blocks ORDERED if finalPriceApproved is false

---

### Phase 6.7: PO Document Generation (SPECIFIED - Nov 2, 2025)

**Priority:** HIGH

**Estimated Effort:** 12-16 hours

**Status:** 📋 FULLY SPECIFIED (Ready for Implementation)

**Files Modified:**

- `Specifications.md` - Comprehensive PO document generation section (lines 1159-1453)
- `src/types/pr.ts` - Added 50+ PO document fields
- `src/types/organization.ts` - Added company details for PO documents (20+ fields)
- `docs/PO_DOCUMENT_GENERATION_FEATURE_2025-11-02.md` - Complete feature documentation

**Changes:**

1. **Terminology Clarification:** PR becomes PO from APPROVED status onward
2. **REQUIRED for High-Value PRs:** PO document generation mandatory above Rule 3 threshold - can be overridden with justification
3. **Optional for Lower-Value PRs:** PO generation optional below Rule 3 threshold
4. **Comprehensive PO Fields:**

   - Header info (PO#, issue date, currency)
   - Buyer/company details (from organization settings)
   - Supplier/vendor information
   - Delivery and billing addresses (with checkboxes for "same as company")
   - Contact persons (buyer and supplier representatives)
   - Order details with line items table
   - Mode of delivery dropdown
   - Packing/labeling instructions
   - Payment information (method, terms, banking details)
   - Tax and duty information
   - References (quotation, contract, tender numbers)
   - Internal codes (project, expense, cost center)
   - Special instructions and remarks

5. **Supplier Onboarding:** Option to add first-time suppliers to vendor database from PO
6. **Editable and Regenerable:** PO can be generated multiple times with updates
7. **Override Mechanism:** High-value PRs can skip PO generation with justification (similar to Proforma/PoP)

**Type Definitions Added:**

**Organization Type (20+ fields):**

- Company details: legal name, address, registration#, tax ID, phone, website
- Company banking: bank name, account details, SWIFT, IBAN
- Default buyer representative: name, title, phone, email

**PR Type (50+ fields for PO):**

- PO issue date
- Delivery address (with "different from company" checkbox)
- Billing address (with "different from company" checkbox)
- Supplier and buyer contact persons
- Mode of delivery (Air, Sea, Courier, Pickup, Road, Rail, Other)
- Packing instructions
- Payment method and terms
- Supplier banking details
- Tax and duty information
- Reference numbers (quotation, contract, tender)
- Internal codes (project, expense, cost center)
- Special instructions and remarks
- Line items with SKU/item numbers

**Completed:**

- ✅ Comprehensive specifications (200+ lines)
- ✅ Type definitions (70+ new fields total)
- ✅ Organization data model updated
- ✅ PO document sections detailed
- ✅ PDF template layout specified
- ✅ Supplier onboarding workflow defined
- ✅ Admin portal requirements documented
- ✅ No linter errors
- ✅ Complete documentation: `docs/PO_DOCUMENT_GENERATION_FEATURE_2025-11-02.md`

**Pending Implementation:**

- ⏳ Admin UI for organization company details
- ⏳ PO document preparation UI in ApprovedStatusActions
- ⏳ PDF template creation (HTML/CSS)
- ⏳ PDF generation service function
- ⏳ Download PO functionality
- ⏳ Supplier onboarding prompt and workflow
- ⏳ PO regeneration logic
- ⏳ Audit trail for PO generations
- ⏳ Integration testing
- ⏳ User acceptance testing

**Key Features:**

- **Optional:** Doesn't block workflow progression
- **Flexible:** Delivery/billing can be same as or different from company address
- **Professional:** Comprehensive PDF with all business details
- **Reusable:** Supplier onboarding creates vendor records for future use
- **Trackable:** Internal codes for project/expense tracking
- **Editable:** Can regenerate with updates any time

---

### To-dos

- [ ] Phase 0: Git commit and push all uncommitted changes and documentation
- [ ] Phase 1: Enhance type definitions for PR, Organization, and Vendor
- [ ] Phase 2: Create and run data migration script
- [ ] Phase 3: Organization configuration management in Admin
- [ ] Phase 4: Implement MY ACTIONS button and filtering
- [ ] Phase 5: Advanced search, filtering, analytics, and export
- [ ] Phase 6: Dual approver concurrent approval workflow
- [x] **Phase 6.5: Automatic Approval Rescinding** ✅ COMPLETED
- [x] **Phase 6.7: PO Document Generation** 📋 FULLY SPECIFIED
- [ ] Phase 7: Approval justification for 3-quote scenarios
- [ ] Phase 8: APPROVED status processing and document management
- [ ] Phase 9: ORDERED status processing and automated vendor approval
- [ ] Phase 10: Enhanced vendor management and expiry system
- [ ] Phase 11: Automated reminder and delay notification system
- [ ] Phase 12: PR resurrection feature
- [ ] Phase 13: Urgency management with role-based restrictions
- [ ] Phase 14: Limited user management for Procurement
- [ ] Phase 15: Dashboard UX improvements with complete metrics
- [ ] Phase 16: Integration testing and bug fixes
- [ ] Phase 17: Update documentation for all new features
- [ ] Phase 18: Final review and deployment preparation