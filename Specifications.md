# 1PWR Procurement System Specifications

## Reference Data Management

### Collection Structure
- All reference data is stored in collections with prefix "referenceData_"
- Example: departments are stored in "referenceData_departments"

### ID Generation and Standardization
- Reference data items of type currencies, UOM, and organizations use their code as their ID
  - For these types, the code is converted to lowercase and any non-alphanumeric characters are replaced with underscores
  - Example: A currency with code "USD" would have ID "usd"
- Organization IDs follow the same standardization rules:
  - Converted to lowercase
  - Spaces and special characters replaced with underscores
  - Example: "1PWR LESOTHO" becomes "1pwr_lesotho"
- Other reference data types use auto-generated IDs for better performance and uniqueness

### Organization References
- Most reference data items are associated with a specific organization, except:
  - Vendors (globally available across organizations)
  - Currencies (standard across system)
  - UOM (standard units of measure)
  - Organizations (represent the organizations themselves)
  - Permissions (system-wide settings)
- Organization association is implemented through a single `organizationId` field
  - The `organizationId` must reference a valid ID in the organizations collection
  - Organization details (name, currency, etc.) should be fetched from the organizations collection
  - Example: A vehicle with `organizationId: "1pwr_lesotho"` references the organization document with ID "1pwr_lesotho"

### Collection References
- Collections should maintain clean references to related documents
- Best practices for references:
  - Use standardized IDs for consistency
  - Store only the reference ID, not the entire referenced document
  - Fetch related document details when needed
  - Example: Vehicles store only organizationId, fetching organization details from the organizations collection when needed

### Data Normalization
- Avoid storing redundant data across collections
- Each piece of information should have a single source of truth
  - Organization details stored only in the organizations collection
  - Reference data items should only store IDs of related documents
- Updates to referenced data (e.g., organization name) only need to be made in one place

### Active Status
- All reference data items have an active status (boolean)
- Only active items are returned by the reference data service
- Inactive items are still stored but not available for selection
- This allows "soft deletion" of items that may be referenced by historical records

### Vendor Management
- Vendors are globally available across all organizations
- Vendors can be marked as "approved" which affects quote requirements
- Vendor approval status is managed by procurement officers
- Vendor details include:
  - Contact information
  - Approval status
  - Product/service categories
  - Historical performance

## PR Processing Rules

### Quote Requirements and Thresholds
1. Rule 1 (Lower Threshold):
   - Below threshold:
     - Requires 1 quote
     - Can be approved by Level 6 or Level 2 approvers
     - If using approved vendor, quote attachment optional
     - If using non-approved vendor, quote must have attachment
   - Above threshold:
     - Requires 3 quotes with attachments
     - Only Level 2 approvers can approve
     - Exception: If using approved vendor, only 1 quote with attachment required

2. Rule 2 (Higher Threshold):
   - Below threshold: Rule 1 applies
   - Above threshold:
     - Always requires 3 quotes with attachments
     - Only Level 2 approvers can approve
     - No exceptions for approved vendors

### Quote Validation
- Quote amount used for threshold comparison is the lowest valid quote amount
- Each quote must include:
  - Valid amount
  - Currency
  - Vendor details
  - Attachment (except for approved vendors below Rule 1 threshold)
- Invalid quotes are not counted towards quote requirements

### Currency Handling
- Each organization's rules specify the base currency
- All quote amounts are converted to the rule's currency for comparison
- Currency conversion uses current exchange rates
- Threshold comparisons are made after currency conversion

### Attachment Requirements
- Quote attachments must be present for:
  - All quotes above Rule 2 threshold
  - All quotes above Rule 1 threshold (except approved vendors)
  - All quotes below Rule 1 threshold from non-approved vendors
- Attachments must be valid files with:
  - Readable format
  - Clear quote details
  - Vendor information

### Approver Levels
- Level 2 Approvers:
  - Can approve PRs of any value
  - Required for PRs above Rule 1 threshold
  - Required for all PRs above Rule 2 threshold
  
- Level 6 Approvers:
  - Can only approve PRs below Rule 1 threshold
  - Cannot approve PRs above Rule 1 threshold
  - Must follow standard quote requirements

## User Management

### User Status and Activation
- Users have an `isActive` field (boolean) to control their system access
- Only active users can:
  - Log into the system
  - Be selected as approvers
  - Perform actions within their permission level
- User activation status can be toggled by administrators in the User Management interface
- When a user is deactivated:
  - They cannot log in
  - They are removed from approver selection dropdowns
  - Their existing approvals remain valid for historical records

### Permission Levels
- Level 1: Administrator (ADMIN)
  - Full system access
  - Can manage all aspects of the system
  - Access to all organizations and features
  - Can edit Admin Dashboard

- Level 2: Senior Approver
  - Can approve PRs of any value
  - Required for high-value approvals
  - Organization assignment determines approval scope
- Level 3: Procurement Officer (PROC)
  - Can manage the procurement process
  - Can view Admin Dashboard
  - Can edit select Admin Dashboard items
  - Responsible for vendor management and PR processing

- Level 4: Finance Admin (FIN_AD)
  - Can process procurement requests
  - Can view (but not edit) Admin Dashboard
  - Access to financial aspects of PRs
  - Can review and process financial details

- Level 5: Requester (REQ)
  - Can create and submit PRs
  - Can view their own PR history
  - Basic access level for regular users
  - No administrative access

- Level 6: Junior Approver
  - Can approve PRs below Rule 1 threshold
  - Organization assignment determines approval scope
  - Cannot approve high-value PRs

### Organization Assignment
- Users can be assigned to one primary organization
- Additional organization access can be granted through the `additionalOrganizations` field
- Organization IDs are normalized for consistency:
  - Converted to lowercase
  - Special characters replaced with underscores
  - Example: "1PWR LESOTHO" becomes "1pwr_lesotho"
- Organization matching uses normalized IDs for comparison

## Approver System

### Approver Selection
- Approvers are filtered based on:
  - Active status (`isActive` must be true)
  - Permission level (APPROVER role)
  - Organization match (must be associated with the PR's organization)
- Organization matching includes:
  - Primary organization assignment
  - Additional organization assignments
- Organization matching uses normalized IDs to ensure consistent comparison
  - Example: "1PWR LESOTHO" and "1pwr_lesotho" are treated as the same organization

### Approver Display
- Approvers are shown in dropdowns with their full name
- The approver list is filtered to show only relevant approvers based on:
  - The PR's organization
  - The approver's organization assignments (primary and additional)
  - The approver's active status
- Inactive approvers are automatically excluded from selection

### Historical Records
- Approved PRs maintain their approver information even if:
  - The approver is later deactivated
  - The approver's organization assignments change
  - The approver's permission level changes
- This ensures audit trail integrity while preventing new selections of invalid approvers

### Organization Assignment
- Users can be assigned to one primary organization
- Additional organization access can be granted through the `additionalOrganizations` field
- Organization IDs are normalized for consistency:
  - Converted to lowercase
  - Special characters replaced with underscores
  - Example: "1PWR LESOTHO" becomes "1pwr_lesotho"
- Organization matching uses normalized IDs for comparison

## PR Data Model Structure

### Core PR Fields
- **id**: Unique identifier for the PR
- **prNumber**: Human-readable PR number (format: ORG-YYYYMM-XXX)
- **organization**: Organization the PR belongs to
- **department**: Department making the request
- **projectCategory**: Project or category the PR falls under
- **description**: Detailed description of what is being requested
- **site**: Site or location where items are needed
- **expenseType**: Type of expense (CAPEX/OPEX)
- **estimatedAmount**: Estimated total cost of the request
- **currency**: Currency for the request
- **preferredVendor**: Preferred vendor if any
- **requiredDate**: Date by which items are needed
- **requestorId**: ID of user making request
- **requestorEmail**: Email of requestor
- **requestor**: Full user object of requestor

### Line Items Structure
- Each PR contains an array of line items with:
  - **id**: Unique identifier for the line item
  - **description**: Description of the item
  - **quantity**: Number of items requested
  - **uom**: Unit of measure
  - **notes**: Optional additional information
  - **attachments**: Array of file attachments

### Approval Workflow Structure
- PRs use the `approvalWorkflow` field as the single source of truth for approval information:
  ```typescript
  interface ApprovalWorkflow {
    currentApprover: string;  // Current approver's user ID
    approvalHistory: ApprovalHistoryItem[];
    lastUpdated: string;
  }
  ```
- Legacy fields should be deprecated:
  - `pr.approver` - Deprecated, use `approvalWorkflow.currentApprover`
  - `pr.approvers` - Deprecated, approval history is in `approvalWorkflow.approvalHistory`

- All code should be updated to use `approvalWorkflow.currentApprover` as the single source of truth.

- Migration plan:
  1. Update all PR documents to use `approvalWorkflow`
  2. Update all code to read from `approvalWorkflow.currentApprover`
  3. Add validation to ensure `approvalWorkflow` is always present
  4. Remove legacy fields after migration

### PR Status Workflow
- PRs follow a defined status flow:
  - **SUBMITTED**: Initial state when PR is first created
  - **RESUBMITTED**: PR has been resubmitted after revision
  - **IN_QUEUE**: PR is in procurement queue for processing
  - **PENDING_APPROVAL**: Awaiting approval from designated approvers
  - **APPROVED**: PR has been approved and is ready for processing
  - **ORDERED**: Purchase order has been placed
  - **PARTIALLY_RECEIVED**: Some items have been received
  - **COMPLETED**: PR has been fully processed and closed
  - **REVISION_REQUIRED**: Changes requested by approver
  - **CANCELED**: PR has been canceled by requestor or admin
  - **REJECTED**: PR has been rejected by approver

### Standard Status Transitions
1. SUBMITTED → PENDING_APPROVAL → [APPROVED | REJECTED]
2. APPROVED → IN_QUEUE → [ORDERED | REVISION_REQUIRED]
3. REVISION_REQUIRED → RESUBMITTED → PENDING_APPROVAL
4. ORDERED → [PARTIALLY_RECEIVED | RECEIVED] → COMPLETED
5. Any Status → CANCELED (if initiated by requestor or admin)

## PR Workflow Implementation

### PR Processing in IN_QUEUE Status
1. Procurement Users (permissionLevel 2 or 3):
   - Can "Push to Approver" (changes status to PENDING_APPROVAL)
   - Can "Reject" (changes status to REJECTED)
   - Can "Revise & Resubmit" (changes status to REVISION_REQUIRED)
   - Must provide notes when rejecting or requesting revision
   - Receive notifications about status changes

2. Requestor Users:
   - Can "Cancel PR" (changes status to CANCELED)
   - Optional notes when canceling
   - Receive notifications about status changes

3. Approvers:
   - Receive notification when PR is pushed for approval
   - Notification includes PR details (requestor, category, expense type, site, estimatedAmount, preferredVendor, requiredDate)

### PR Action Components
- The workflow is implemented in the `ProcurementActions` component
- Action buttons are displayed based on user permissions and PR status
- Each action includes:
  - Visual confirmation dialog
  - Notes field (required for certain actions)
  - Automatic notification triggers

### Approval Process
- Approvers are determined based on:
  - Department hierarchy
  - Amount thresholds
  - Special category rules
- The `approvalWorkflow` object tracks:
  - Current approver information
  - Complete approval history
  - Timestamps of approval actions

## PR Notifications System

### Cloud Function Integration
- PR notifications utilize Firebase Cloud Functions for email delivery
- The client-side `sendPRNotification` handler prepares notification data and calls the `sendPRNotification` cloud function
- The notification payload structure:
  ```typescript
  {
    notification: {
      prId: string;
      prNumber: string;
      oldStatus: string;
      newStatus: string;
      user: {
        email: string;
        name: string;
      };
      notes: string;
      metadata: {
        isUrgent?: boolean;
        description: string;
        amount: number;
        currency: string;
        department: string;
        requiredDate: string;
      };
    };
    recipients: string[];
    cc?: string[];
    emailBody: {
      subject?: string;
      text: string;
      html: string;
    };
  }
  ```

### Email Template Data Fields
- Templates must use the PR data model field names:
  - **estimatedAmount**: For the total cost (NOT "amount")
  - **preferredVendor**: For the vendor information (NOT "vendor")
  - **requiredDate**: For the date by which items are needed
  - **requestor**: Object containing requestor information

## Email Notifications

### General Rules
- All system notifications are sent from noreply@1pwrafrica.com
- Email subjects reflect the specific PR action or status change
- The requestor is always CC'd on all PR-related notifications
- Notifications include a link to view the PR details

### Status Change Notifications
1. PR Cancellation:
   - Subject: "PR #[number] Canceled"
   - Recipients: Procurement team
   - CC: PR requestor
   - Content includes:
     - Status change (from SUBMITTED to CANCELED)
     - Notes (if provided)
     - Link to PR details

2. Other Status Changes:
   - Subject format varies by status:
     - "PR #[number] Pending Approval"
     - "PR #[number] Approved"
     - "PR #[number] Rejected"
     - "PR #[number] Revision Required"
     - Default: "PR #[number] Status Changed to [STATUS]"
   - Recipients determined by status change type
   - CC: PR requestor
   - Content includes:
     - Old and new status
     - User who made the change
     - Notes (if provided)
     - PR metadata (amount, currency, department, etc.)
     - Link to PR details

### Notification Logging
- All notifications are logged in the 'notificationLogs' collection
- Log entries include:
  - Type (e.g., 'STATUS_CHANGE')
  - Status ('sent' or 'failed')
  - Timestamp
  - Notification details
  - Recipients and CC list
  - Error details (if failed)

## Email Notifications

### Subject Line Format
- New PR Submission:
  - Normal Priority: "New Purchase Request: PR #[PR-NUMBER]"
  - Urgent Priority: "URGENT: New Purchase Request: PR #[PR-NUMBER]"
- Status Change:
  - Normal Priority: "[NEW_STATUS]: PR #[PR-NUMBER]"
  - Urgent Priority: "URGENT: [NEW_STATUS]: PR #[PR-NUMBER]"

### Email Content Structure
1. Header Section:
   - Priority indicator (if urgent)
   - PR Details heading
   - View PR button/link

2. Core Information Table:
   - PR Number
   - Description
   - Department
   - Required Date
   - Estimated Amount (with currency) - uses `estimatedAmount` field
   - Preferred Vendor - uses `preferredVendor` field
   - Requestor

3. Line Items Section:
   - Item-by-item breakdown
   - Each item includes:
     - Description
     - Quantity
     - Unit of Measure (UOM)
     - Notes (if any)

### Notification Recipients
1. Primary Recipients:
   - Procurement team
   - Current approver (if in approval stage)
   - Department head

2. CC List:
   - PR requestor
   - Previous approvers in the chain
   - Additional stakeholders based on PR type

### Email Styling
1. Priority Styling:
   - Urgent: Red background (#ff4444) with white text
   - Normal: Green background (#00C851) with black text

2. Table Styling:
   - Bordered cells (1px solid #ddd)
   - Consistent padding (8px)
   - Column width optimization
   - Alternating row colors for readability

3. Action Button Styling:
   - Green background (#4CAF50)
   - White text
   - Rounded corners (4px)
   - Hover effect for better UX

### Notification Triggers
1. Automatic Notifications:
   - New PR submission
   - Status changes
   - Approval requests
   - Quote additions/updates
   - Approaching deadlines

2. Manual Notifications:
   - Comments/notes added
   - Document attachments
   - Special instructions
   - Urgent updates

### Email Template Maintenance
- Templates stored in version-controlled repository
- Consistent branding across all notifications
- Mobile-responsive design
- Accessibility considerations
- Regular template review and updates
