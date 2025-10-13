# 1PWR Procurement System Specifications

> **Last Updated: 2025-01-15**
> **Consolidated from SPECIFICATION.md and Specifications.md**

## Authentication Flow
### Login Screen
- Required Fields:
  - Email Address (text input with email validation)
  - Password (password input)
- Actions:
  - SIGN IN button (primary action)
- Validation:
  - Email format must be valid
  - Both fields must be non-empty

## Dashboard
### Header
- Organization selector (dropdown, supports multiple organizations)
- MY ACTIONS button (filters to PRs/POs requiring user's action)
  - Shows count badge with number of pending actions
  - Not available for Procurement (they see all)
  - Available for: Requestors, Approvers, Finance/Admin, Asset Management
- NEW PR button (top right)
- User profile icon (top right)

### Key Metrics Display
- Total PRs (numeric)
- Urgent PRs (numeric)
- Avg Days Open (decimal)
- Overdue PRs (numeric)
- Quotes Required (numeric)
- Adjudication Required (numeric)
- Customs Required (numeric)
- Completion Rate (percentage)

### Purchase Requests/Orders Table
- Status Filters:
  - SUBMITTED (default)
  - IN_QUEUE
  - PENDING_APPROVAL
  - APPROVED
  - ORDERED
  - COMPLETED
  - REVISION_REQUIRED
  - CANCELED
  - REJECTED

- Display Order (Default):
  - **Primary Sort:** Urgency Level
    - Group 1 (Top): All URGENT flagged PRs/POs (oldest first within group)
    - Group 2 (Bottom): All NORMAL priority PRs/POs (oldest first within group)
  - **Secondary Sort:** Days Open (descending - longest outstanding first)
  - **Visual Grouping:** Urgent items visually separated from normal items

- Columns:
  - PR/PO Number (auto-generated, format: ORG-YYYYMM-XXX)
  - Description
  - Submitted By
  - Created Date
  - Days Open (highlighted if > 2 business days)
  - Urgency (URGENT or NORMAL)
  - Resubmitted Date
  - Actions (view/edit/cancel/resurrect based on permissions)

### Advanced Search and Filtering
- **Search Bar Features:**
  - Free text search (PR/PO number, description, vendor name)
  - Real-time results as user types
  
- **Advanced Filter Panel:**
  - **Organization:** Multi-select dropdown (users with multiple orgs can filter across them)
  - **Requestor:** Dropdown or type-ahead search of all users
  - **Approver:** Dropdown or type-ahead search of approvers (Level 2, 4)
  - **Vendor:** Dropdown or type-ahead search of all vendors (approved and non-approved)
  - **Department:** Dropdown or type-ahead search of all departments
  - **Site:** Dropdown or type-ahead search of all sites
  - **Vehicle:** Dropdown or type-ahead search of all vehicles
  - **Project Category:** Dropdown or type-ahead search of all project categories
  - **Expense Type:** Dropdown or type-ahead search of all expense types
  - **Date Range:** 
    - Created Date (from/to date pickers)
    - Required Date (from/to date pickers)
    - Last Updated (from/to date pickers)
  - **Amount Range:** Min/Max amount inputs
  - **Urgency:** Urgent Only / Normal Only / All (default)
  
- **Filter Combination:**
  - All filters work together (AND logic)
  - Active filters displayed as removable chips/badges
  - Clear All Filters button
  - Save common filter combinations as presets (future enhancement)

- **Search Results Analytics Display:**
  - **Location:** Summary bar displayed above search results table
  - **Metrics Shown:**
    - **Number of Transactions:** Count of PRs/POs matching current filters
    - **Total Transaction Value:** Sum of all matching PR/PO amounts (in base currency)
    - **Average Transaction Value:** Total value divided by number of transactions
  - **Updates:** Real-time as filters are applied/removed
  - **Visual Format:** Card layout with icons, highlighted numbers
  - **Currency Display:** Shows organization's base currency, with note if multiple currencies in results
  
- **Export Capability:**
  - Export filtered results to CSV/Excel
  - Include all columns plus additional metadata
  - Include analytics summary (count, total, average) at top of export
  - Respect user's organization permissions

## Purchase Request Creation
### Step 1: Basic Information
- Required Fields (*):
  - Organization (dropdown, multi-organization support)
  - Requestor (text input, pre-populated with user's name)
  - Email (text input, pre-populated with user's email)
  - Department (dropdown)
  - Project Category (dropdown)
  - Description (text area)
  - Site (dropdown)
  - Expense Type (dropdown)
  - Estimated Amount (number input, must be > 0)
  - Currency (dropdown: LSL, USD, ZAR)
  - Urgency Level (dropdown: Normal, Urgent)
  - Approvers (based on threshold and level rules)

- Optional Fields:
  - Preferred Vendor (dropdown)

- Field Dependencies:
  - When Expense Type is "4 -Vehicle", an additional required Vehicle field (dropdown) appears

### Step 2: Line Items
- Table with columns:
  - Description* (text input)
  - Quantity* (number input)
  - UOM* (Unit of Measure, dropdown)
  - Notes (text input)
  - Attachments (file upload)
  - Actions (save, delete)

- Features:
  - ADD LINE ITEM button
  - File attachment support
  - Multiple line items allowed
  - At least one line item required

### Step 3: Review
- Read-only display sections:
  - Requestor Information
    - Name
    - Email
    - Department
    - Organization

  - Project Details
    - Project Category
    - Site
    - Description

  - Financial Details
    - Estimated Amount with Currency
    - Expense Type

  - Approval Details
    - Required Date
    - Approvers with roles

  - Line Items Table
    - Description
    - Quantity
    - Unit of Measure
    - Notes
    - Attachments

## Data Validation Rules
- Email must be valid format
- Estimated Amount must be > 0
- At least one approver required (based on threshold rules)
- At least one line item required
- All required fields must be filled before proceeding to next step
- File attachments must be valid file types
- Currency must match organization's allowed currencies
- Approvers cannot approve their own PRs

### Urgency Flag Management
- **Initial Setting:** Set by requestor during PR creation (Normal or Urgent)
- **Who Can Change to Urgent:**
  - **SUBMITTED, IN_QUEUE:** Locked at requestor's setting (cannot be changed)
  - **PENDING_APPROVAL onward:** Procurement (Level 3) can change to Urgent
  - **APPROVED onward (PO):** Procurement (Level 3) OR Approvers (Level 2, 4) can change to Urgent
  - **Any Status:** Administrator (Level 1) can change
- **Important:** 2 business days outstanding does NOT automatically promote to urgent
  - 2+ business days only affects reminder frequency (daily → twice daily)
  - Urgency flag is manual only, never automatic
- **Impact:**
  - Display order: Urgent items shown at top of table
  - Notifications: "URGENT:" prefix in subject line
  - Visual: Red/orange highlighting

## Navigation
- Sidebar Menu:
  - Dashboard
  - New PR
  - My PRs
- Header Buttons:
  - MY ACTIONS (personalized action filter - not for Procurement)
  - NEW PR

## Project Directory Structure

This section outlines the main directories and their purpose within the `pr-system` repository.

-   `/` (Root): Contains configuration files (`package.json`, `vite.config.ts`, `tsconfig.json`, etc.), `Specifications.md`, `.windsurfrules`, and top-level project directories.
-   `/e2e-tests`: Contains end-to-end tests for the application.
-   `/functions`: Contains Firebase Cloud Functions used by the application.
    -   `/functions/src`: Source code for the cloud functions (TypeScript).
-   `/prsystem`: (Purpose unclear - possibly a related sub-project or older version? Contains `src` and `node_modules`).
    -   `/prsystem/src`: Source code for the `prsystem` component.
-   `/public`: Static assets served directly by the web server.
-   `/src`: Main source code for the React frontend application.
    -   `/src/assets`: Static assets like images, fonts, etc., bundled with the application.
    -   `/src/components`: Reusable React components.
    -   `/src/config`: Application configuration files (e.g., Firebase config).
    -   `/src/contexts`: React Context providers for global state.
    -   `/src/hooks`: Custom React hooks (as per project rules).
    -   `/src/lib`: Shared library code, potentially utilities or core logic.
    -   `/src/scripts`: Utility scripts related to the frontend application.
    -   `/src/services`: Modules for interacting with backend APIs or external services (e.g., Firebase).
    -   `/src/store`: State management setup (e.g., Redux toolkit).
    -   `/src/styles`: Global styles or styling utilities.
    -   `/src/types`: TypeScript type definitions and interfaces for the frontend.
    -   `/src/utils`: General utility functions for the frontend.
    -   `/src/__tests__`: Unit and integration tests for the frontend code.

*Note: Directories like `node_modules`, `dist`, `archive`, `.git`, `.bak` are omitted as they are typically excluded from source control or contain build artifacts/backups.*

## Organization Configuration

### Organization Email Settings
Each organization requires configuration of notification email addresses in the admin backend:

#### Required Email Fields
- **Procurement Team Email:** Email address for procurement notifications
  - Used for: All PR/PO notifications where procurement is recipient or CC
  - Example: procurement@1pwrafrica.com or procurement-lesotho@1pwrafrica.com
- **Asset Management Email:** Email address for asset management team
  - Used for: Notifications from ORDERED status onward (CC on all)
  - Example: assets@1pwrafrica.com or assets-lesotho@1pwrafrica.com
- **Organization Admin Email:** Primary administrative contact
  - Used for: Status change notifications, escalations
  - Example: admin@1pwrafrica.com

#### Configuration Requirements
- Emails should NOT be hardcoded in the application
- Each organization can have different email addresses
- Admin backend should provide interface to set/update these emails
- Validation: Email format must be valid
- Default: If not set, system should show warning but allow operation

#### Email Address Management
- Stored in organization document in Firestore
- Accessible by Level 1 (Administrator) only
- Can be updated through Admin Dashboard
- Changes logged in audit trail
- Multiple emails can be separated by comma for group notifications

### Organization Data Model Fields
Each organization document should include:
- **Basic Information:**
  - Organization ID (normalized: lowercase, underscores)
  - Organization name
  - Currency (base currency for the organization)
  - Active status
- **Notification Email Addresses:**
  - `procurementEmail`: Email for procurement team
  - `assetManagementEmail`: Email for asset management team
  - `adminEmail`: Email for organization administrator
- **Business Rules Configuration:**
  - Rule 1 threshold amount
  - Rule 2 threshold amount
  - Allowed currencies
- **Vendor Approval Duration Settings (Configurable):**
  - `vendorApproval3QuoteDuration`: Duration in months for auto-approval from 3-quote process (default: 12)
  - `vendorApprovalCompletedDuration`: Duration in months for auto-approval from any completed order (default: 6)
  - `vendorApprovalManualDuration`: Duration in months for manual approval (default: 12)
  - **Purpose:** Configurable timeframes prevent perpetual approval status
  - **System Behavior:** 
    - Expiry dates calculated dynamically from approval date + configured duration
    - Daily automated job checks expiry dates and auto-deactivates expired approvals
    - Justification validation checks use configured durations to determine eligibility
- **High-Value Vendor Approval Rules (Configurable):**
  - `highValueVendorMultiplier` (X): Multiplier of Rule 2 threshold for high-value vendor classification (default: 10)
    - Example: If Rule 2 = $10,000 and X = 10, vendors with cumulative orders ≥ $100,000 are high-value
  - `highValueVendorMaxDuration` (Z): Maximum approval duration for high-value vendors without 3-quote or manual override (default: 24)
  - **Purpose:** High-value vendors require stricter validation and regular competitive evaluation
  - **System Behavior:**
    - System calculates cumulative completed order value per vendor
    - If cumulative value ≥ (Rule 2 threshold × X multiplier):
      - Vendor classified as "High-Value Vendor"
      - Maximum approval duration = Z months (regardless of how it was approved)
      - UNLESS vendor passed 3-quote process within previous `vendorApproval3QuoteDuration` months (reuses existing setting)
      - OR manual override with justification applied
    - High-value status displayed on vendor profile
    - Procurement notified when high-value vendor approval expires
  - **Note:** System reuses `vendorApproval3QuoteDuration` to determine 3-quote recency window - no separate parameter needed
- **Other Settings:**
  - Time zone
  - Business days configuration
  - Holiday calendar

### Special Department: Asset Management
Users assigned to the Asset Management department have special permissions:
- **In ORDERED Status:**
  - Can upload delivery documentation (delivery note, photos)
  - Can set override for delivery documentation (with justification)
  - Can move PO from ORDERED to COMPLETED status
- **Notifications:**
  - Asset Management email is CC'd on all PO notifications from ORDERED status onward
  - Receive daily reminders for POs in ORDERED status awaiting delivery documentation
- **Department Identification:**
  - Department field = "Asset Management" or similar asset tracking/management designation
  - Organization's `assetManagementEmail` used for group notifications

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

#### Vendor Approval Requirements and Automation

##### Minimum Information Requirements (All Approval Types):
- **Cannot approve a vendor without minimum critical information:**
  - **Name:** Required (cannot be empty)
  - **Contact Information:** At least ONE of the following required:
    - Email address (validated format)
    - Phone number
    - Website/Platform URL
  
- **Validation Rules:**
  - System prevents approval if name is missing
  - System prevents approval if all contact fields (email, phone, website) are empty
  - Warning displayed: "Cannot approve vendor: Missing required information (Name/Contact)"
  - Vendor can be saved as "Not Approved" even with incomplete data
  - Vendor must meet requirements before approval can be granted

##### Automated Vendor Approval (Order Completion)
- **Trigger:** When PO moves to COMPLETED status
- **Required Question:** "Order closed without issues?"
  - Asked to Procurement, Finance/Admin, or Asset Management (whoever is closing the order)
  - Response options: YES / NO
  
- **If YES (Satisfactory Completion):**
  - **3-Quote Process Orders:** Vendor automatically approved for **configurable duration**
    - Default: 12 months (set in Organization Configuration)
    - Requires 3 quotes were submitted (above Rule 1, non-approved vendor scenario)
  - **Any Other Completed Orders:** Vendor automatically approved for **configurable duration**
    - Default: 6 months (set in Organization Configuration)
    - Applies to all completed orders regardless of quote count
  - **Approval Audit Trail:** System logs:
    - Approved Date
    - Approved By (user who closed order)
    - Approval Reason: "Satisfactory order completion - PO [number]"
    - Expiry Date (calculated from approval date + configured duration)
    - Associated PO number
  
- **If NO (Issues During Order):**
  - **Note Required:** User must provide details of issues encountered
  - **Override Option:** Procurement or Finance/Admin can still approve vendor if desired
  - **Override Justification Required:** Must explain why approving despite issues
  - **Override Duration:** Uses manual approval duration setting
  - **Audit Trail:** System logs issue note, override decision, and justification
  - **Default:** Vendor remains non-approved if no override selected

##### Manual Vendor Approval and De-Approval
- **Who Can Manually Approve/De-Approve Vendors:** 
  - Level 1 (Administrator)
  - Level 3 (Procurement) 
  - Level 4 (Finance/Admin)
  
- **Who Can Edit Vendor Information:**
  - Level 1 (Administrator)
  - Level 3 (Procurement)
  - Level 4 (Finance/Admin) - Full edit rights

- **Manual Approval - Justification Required If:**
  - Vendor has NOT completed 3-quote process within configured "3-quote approval duration", AND
  - Vendor has NOT completed any order within configured "completed order approval duration"
  - System checks against configured timeframes (not hardcoded)
  
- **Manual Approval - Justification Not Required If:**
  - Vendor has recent successful order history (within timeframes above)
  - System automatically validates eligibility
  
- **Manual De-Approval (Removing Approved Status):**
  - **Justification ALWAYS Required:** User must provide note explaining why vendor is being de-approved
  - Examples: Quality issues, compliance problems, better alternatives available, vendor went out of business
  - De-approval note permanently recorded in vendor audit trail
  - Vendor can be re-approved later with new justification or through successful order completion
  
- **Approval Duration (Manual):**
  - Manual approval: Configurable duration (default: 12 months) from approval date
  - **Exception:** High-value vendors subject to special rules (see below)
  - Can be renewed manually with new justification
  - Duration set in Organization Configuration

##### Vendor Approval Status Tracking
- **Fields Added to Vendor Object:**
  - `isApproved` (boolean)
  - `approvalDate` (timestamp)
  - `approvalExpiryDate` (timestamp)
  - `approvalReason` (string: "auto_3quote", "auto_completed", "manual")
  - `approvedBy` (userId)
  - `approvalNote` (text - justification or override reason)
  - `associatedPONumber` (string - if auto-approved from order)
  - `lastCompletedOrderDate` (timestamp)
  - `last3QuoteProcessDate` (timestamp)
  
- **Automatic Expiry and Renewal:**
  - **Daily Check:** System runs daily automated job checking vendor approval expiry dates
  - **Auto-Deactivation:** Vendors past expiry date automatically set to non-approved (isApproved = false)
  - **Expiry Notification:** Email sent to Procurement team when vendor approval expires
    - Includes vendor name, last approval date, expiry date, last order date
    - Suggests renewal if vendor has recent order history
  - **No Perpetual Approval:** All approvals (manual and automatic) have expiry dates
  - **Renewal Options:**
    - **Automatic Re-approval:** When vendor completes new orders successfully
    - **Manual Re-approval:** Procurement/Finance/Admin can manually renew
      - Justification required if no recent successful orders within configured timeframes
      - New expiry date calculated from renewal date
  - **Renewal Conditions Not Met:** If vendor expires and has no qualifying recent orders, remains non-approved until:
    - New order completed successfully (auto-approves with new expiry), OR
    - Manual approval with justification

##### High-Value Vendor Special Rules
- **Classification Criteria:**
  - Vendor's cumulative completed order value ≥ (Rule 2 threshold × configured multiplier X)
  - Example: Rule 2 = $10,000, X = 10 → High-value if cumulative orders ≥ $100,000
  - System calculates cumulative value from all COMPLETED POs associated with vendor
  
- **Approval Duration Restrictions:**
  - **Maximum Duration:** Z months (configurable, default: 24) without special conditions
  - **Applies To:** All approval types (auto from orders, manual)
  - **Exceptions (Can Extend Beyond Z Months):**
    1. Vendor passed 3-quote process within previous `vendorApproval3QuoteDuration` months (reuses existing setting)
    2. Manual override with justification by Admin/Procurement/Finance
  
- **System Behavior:**
  - **On Order Completion:** System checks if vendor becomes or is high-value
  - **If High-Value:**
    - Approval duration = MIN(normal duration, Z months) unless exception applies
    - "High-Value Vendor" badge displayed on vendor profile
    - Approval expiry calculation considers high-value status
  - **Daily Check:** Automated job verifies high-value vendors meet continuation criteria
    - If Z months passed without 3-quote process within `vendorApproval3QuoteDuration` months and no override → auto-deactivate
    - Notification sent to Procurement with recommendation to either:
      - Run competitive 3-quote process for next order
      - Provide manual override justification for continued approval
  
- **Configuration Parameters (in Organization Settings):**
  - `highValueVendorMultiplier` (X): Multiplier for classification (default: 10)
  - `highValueVendorMaxDuration` (Z): Max approval months for high-value vendors (default: 24)
  - **Reuses existing setting:** `vendorApproval3QuoteDuration` determines how recently vendor must have passed 3-quote process
  
- **Purpose:** Ensures high-spend vendors undergo regular competitive evaluation

#### Vendor Details Page
- **Access:** Click vendor name from any PR/PO or from Admin Dashboard → Vendor Management
- **Vendor Information Section:**
  - Name
  - Contact Information (email, phone, website)
  - Approval Status (toggle - only enabled if requirements met)
  - Approval Expiry Date (if approved)
  - Approval Reason (auto/manual)
  - Product/Service Categories
  - Organization Assignments (if applicable)
  - Date Added, Last Updated
  - Added By (user)
  
- **Vendor Documents Section:**
  - **Bank Letter Upload:**
    - Upload/Replace bank letter document
    - View/Download current bank letter
    - Date uploaded, uploaded by (user)
    - File types: PDF, JPG, PNG
  - **Corporate Documents Upload:**
    - Multiple document upload capability
    - Document types: Articles of Incorporation, Business License, Tax Certificate, etc.
    - Each document shows: filename, upload date, uploaded by
    - View/Download individual documents
    - Delete document capability (Procurement/Admin only)
    - File types: PDF, JPG, PNG, DOCX
  - **Document Access:** View-only for all users; edit/upload for Procurement, Finance/Admin, and Admin
  
- **Associated PRs/POs Section:**
  - **List View:** All PRs/POs that reference this vendor
  - **Columns:**
    - PR/PO Number (clickable to view details)
    - Organization
    - Description
    - Status
    - Amount
    - Created Date
    - Requestor
  - **Search/Filter:**
    - Filter by Organization
    - Filter by Status
    - Filter by Date Range
    - Search by PR/PO number or description
  - **Sort Options:** Date, Amount, Status
  - **Export:** Export vendor's PR/PO history to CSV
  
- **Performance Metrics (future enhancement):**
  - Total PRs/POs
  - Total Value
  - Average Delivery Time
  - Completion Rate

- **Actions:**
  - Edit Vendor (Procurement, Admin)
  - Approve/Unapprove Vendor (Procurement, Admin - if requirements met)
  - Deactivate Vendor (Admin only)
  
#### Global Vendor Access
- Vendors are globally available across all organizations
- Vendor approval status affects quote requirements in procurement workflow
- Vendor approval status is managed by procurement officers and administrators

## PR Processing Rules

### Quote Requirements and Thresholds
1. Rule 1 (Lower Threshold):
   - Below threshold:
     - Requires 1 quote
     - Attachment optional
     - Can be approved by Level 4 or Level 2 approvers
     - **Supplier Data Requirement:**
       - If **approved vendor**: Vendor data referenced from system automatically
       - If **NOT approved vendor**: Procurement must manually input during Stage 3 (IN_QUEUE):
         - Supplier name (required)
         - Contact information: phone OR email OR website (at least one required)
         - This data is NOT collected during PR creation
         - Validation check before moving to PENDING_APPROVAL
         - Data attached to PR object for audit trail
   - Above threshold:
     - Requires 3 quotes with attachments
     - Only Level 2 approvers can approve
     - Exception: If using approved vendor, only 1 quote with attachment required

2. Rule 2 (Higher Threshold):
   - Below threshold: Rule 1 applies
   - Above threshold:
     - Always requires 3 quotes with attachments
     - Requires TWO Level 2 approvers (concurrent approval - both notified simultaneously)
     - No exceptions for approved vendors
     - Both approvers must approve for PR to proceed
     - If either approver rejects or requests revision, process stops

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
  
- Level 4 Approvers:
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
  - Can edit select Admin Dashboard items (excluding Project Categories and Expense Types)
  - Responsible for vendor management and PR processing
  - **Reference Data Management:**
    - Can manage: Departments, Sites, Vehicles, Vendors
    - **Cannot manage:** Project Categories, Expense Types (Finance/Admin only)
  - **User Management (Limited):** Can create, delete, activate, and deactivate users at Level 5 (Requester) only
    - Cannot create users at other permission levels (1, 2, 3, 4)
    - Cannot promote Level 5 users to other levels
    - Purpose: Handle day-to-day user onboarding/offboarding without requiring admin intervention

- Level 4: Finance Admin (FIN_AD)
  - Can process procurement requests
  - Can view (but not edit most) Admin Dashboard items
  - Access to financial aspects of PRs/POs
  - Can review and process financial details
  - **Exclusive Edit Rights in PRs/POs:** Can edit Project Category and Expense Type fields (Procurement cannot edit these)
  - **Exclusive CRUD Rights in Admin:** Can manage Project Categories and Expense Types in Reference Data Management (Procurement cannot manage these)
  - Can approve PRs below Rule 1 threshold
  - Can upload documents (proforma, PoP) in APPROVED status
  - Can set overrides with justification in APPROVED status
  - Can move PO from APPROVED to ORDERED status
  - Can move PO from ORDERED to COMPLETED status (for POs below Rule 1 threshold)
  - Can notify procurement for file uploads

- Level 5: Requester (REQ)
  - Can create and submit PRs
  - Can view their own PR history
  - Basic access level for regular users
  - No administrative access

- ~~Level 6: Junior Approver~~ [DEPRECATED]
  - ~~Can approve PRs below Rule 1 threshold~~
  - ~~Organization assignment determines approval scope~~
  - ~~Cannot approve high-value PRs~~

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

## PR/PO Data Model Structure

### Core PR/PO Fields
- **id**: Unique identifier for the PR/PO
- **prNumber** / **poNumber**: Human-readable number (format: ORG-YYYYMM-XXX) - same number retained through lifecycle
- **objectType**: "PR" (pre-APPROVED) or "PO" (APPROVED onward)
- **organization**: Organization the PR/PO belongs to
- **department**: Department making the request
- **projectCategory**: Project or category the PR falls under
- **description**: Detailed description of what is being requested
- **site**: Site or location where items are needed
- **expenseType**: Type of expense (CAPEX/OPEX)
- **estimatedAmount**: Estimated total cost of the request
- **currency**: Currency for the request
- **preferredVendor**: Preferred vendor if any (from PR creation)
- **selectedVendor**: Final selected vendor (set during APPROVED status)
- **requiredDate**: Date by which items are needed
- **estimatedDeliveryDate** (ETD): Expected delivery date (set before ORDERED status)
- **requestorId**: ID of user making request
- **requestorEmail**: Email of requestor
- **requestor**: Full user object of requestor
- **approver**: Designated approver's user ID - SINGLE SOURCE OF TRUTH
- **approver2**: Second approver's user ID (for dual-approval PRs above Rule 2)

### Document Management Fields (APPROVED and ORDERED Status)
- **proformaInvoice**: Uploaded proforma invoice file
- **proformaOverride**: Boolean flag indicating override is used
- **proformaOverrideJustification**: Justification note if override is set
- **proofOfPayment** (PoP): Uploaded proof of payment file
- **popOverride**: Boolean flag indicating PoP override is used
- **popOverrideJustification**: Justification note if PoP override is set
- **deliveryNote**: Uploaded delivery note file (ORDERED status)
- **deliveryPhotos**: Array of uploaded delivery photo files (ORDERED status)
- **deliveryDocOverride**: Boolean flag indicating delivery doc override is used
- **deliveryDocOverrideJustification**: Justification note if delivery override is set
- **poDocument**: System-generated PO document (created at APPROVED status)

### Supplier Data Fields (for non-approved vendors)
- **supplierName**: Manually entered supplier name (if not using approved vendor)
- **supplierContact**: Contact information object containing:
  - **phone**: Phone number (optional)
  - **email**: Email address (optional)
  - **website**: Website URL (optional)
  - At least one contact method required
- **supplierDataEnteredBy**: User ID who entered the supplier data
- **supplierDataTimestamp**: When supplier data was entered

### Line Items Structure
- Each PR/PO contains an array of line items with:
  - **id**: Unique identifier for the line item
  - **description**: Description of the item
  - **quantity**: Number of items requested
  - **uom**: Unit of measure
  - **unitPrice**: Price per unit (from selected quote)
  - **totalPrice**: Total price for line item (quantity × unitPrice)
  - **notes**: Optional additional information
  - **attachments**: Array of file attachments

### Approval Workflow Structure
- PRs use the `approver` field as the single source of truth for the designated approver:
  ```typescript
  interface PRRequest {
    approver: string;  // Current approver's user ID - SINGLE SOURCE OF TRUTH
    approver2?: string;  // Second approver's user ID (for dual-approval above Rule 2)
    requiresDualApproval: boolean;  // True if above Rule 2 threshold
    // other fields...
  }
  ```
- The `approvalWorkflow` field is used to track the history of approver changes:
  ```typescript
  interface ApprovalWorkflow {
    currentApprover: string;  // Mirror of the PR.approver field
    secondApprover?: string;  // Mirror of the PR.approver2 field (if dual-approval)
    requiresDualApproval: boolean;
    firstApprovalComplete: boolean;  // True when first approver has approved
    firstApproverJustification?: string;  // Justification from first approver (if 3-quote scenario)
    secondApprovalComplete: boolean;  // True when second approver has approved
    secondApproverJustification?: string;  // Justification from second approver (if 3-quote scenario)
    approvalHistory: ApprovalHistoryItem[];
    lastUpdated: string;
  }
  ```
- All code must respect the `pr.approver` and `pr.approver2` fields as the single source of truth:
  - The `pr.approver` and `pr.approver2` fields must never be automatically overridden
  - The `approvalWorkflow.currentApprover` and `approvalWorkflow.secondApprover` should always mirror these fields
  - The `approvalWorkflow.approvalHistory` tracks the complete history of approver changes
  - For dual-approval: Track which approver acted first, justifications from both

- Implementation requirements:
  1. Ensure all PR documents maintain `approver` (and `approver2` if applicable) as single source of truth
  2. Update all code to respect the manually set approver fields
  3. Ensure `approvalWorkflow` mirrors the approver fields
  4. Track all approver changes and both approvals in history
  5. Record approval justifications when 3 quotes are required

### PR/PO Status Workflow
- PRs (Purchase Requests) and POs (Purchase Orders) follow a defined status flow:
  - **SUBMITTED**: Initial state when PR is first created
  - **RESUBMITTED**: PR has been resubmitted after revision
  - **IN_QUEUE**: PR is in procurement queue for processing
  - **PENDING_APPROVAL**: PR awaiting approval from designated approver(s)
  - **APPROVED**: PR has been approved and becomes a PO (Purchase Order); ready for document processing
  - **ORDERED**: PO has been ordered (all required documents uploaded or overridden)
  - **COMPLETED**: PO has been fully processed and closed (all items received and documented)
  - **REVISION_REQUIRED**: Changes requested by procurement or approver
  - **CANCELED**: PR has been canceled by requestor only (can be resurrected to SUBMITTED)
  - **REJECTED**: PR has been rejected by procurement or approver (can be resurrected to highest previous status)

**Note:** From APPROVED status onward, the object is referred to as a PO (Purchase Order), not PR (Purchase Request).

### Standard Status Transitions
1. User creates PR → Validation → SUBMITTED (saved to database)
2. SUBMITTED → Procurement review (status remains SUBMITTED, can edit most fields)
3. SUBMITTED → [IN_QUEUE | REVISION_REQUIRED | REJECTED (by procurement)] (procurement decisions)
4. SUBMITTED → CANCELED (requestor only)
5. IN_QUEUE → PENDING_APPROVAL (procurement pushes to approver after quote validation)
6. IN_QUEUE → CANCELED (requestor only)
7. PENDING_APPROVAL → [APPROVED | REJECTED (by approver) | REVISION_REQUIRED]
8. PENDING_APPROVAL → CANCELED (requestor only - up to and including this stage)
9. APPROVED → Object renamed to PO, PO document generated
10. APPROVED (PO) → ORDERED (procurement or finance/admin - after ETD and documents/overrides)
11. ORDERED (PO) → COMPLETED (procurement or asset management or finance/admin for below Rule 1)
12. REVISION_REQUIRED → RESUBMITTED → SUBMITTED (re-enters workflow)
13. REVISION_REQUIRED → CANCELED (requestor only)
14. REJECTED → Can be resurrected by procurement/admin to highest previous status
15. CANCELED → Can be resurrected by requestor to SUBMITTED status

## PR Workflow Implementation

### PR Processing in SUBMITTED Status
1. **Initial State After Validation:**
   - PR is validated before submission
   - Upon successful validation, PR is created in database with status SUBMITTED
   - Notification is automatically sent to procurement team
   - PR is viewable by all authorized users

2. **Who Can Take Actions in SUBMITTED Status:**
   - **Procurement Officers (Level 3):** Can review, edit, and make procurement decisions
   - **Administrators (Level 1):** Full access as superuser
   - **Other Permission Levels (2, 4, 5):** CANNOT take procurement actions in SUBMITTED stage
   - **Exception:** Requestor can cancel their own PR at any time

3. **Procurement Review and Editing (Level 3 or Level 1 only):**
   - Procurement team reviews PR while status remains SUBMITTED
   - Can edit most PR fields **EXCEPT** canonical fields and restricted financial fields:
     - Created by (requestor)
     - Created date
     - Last updated timestamp
     - Urgency level
     - Required date
     - **Project Category** (Finance/Admin only)
     - **Expense Type** (Finance/Admin only)
   - Can edit: Organization, Department, Description, Site, Estimated amount, Currency, Preferred vendor, Line items, Attachments
   - **Note:** Project Category and Expense Type can only be edited by Finance/Admin (Level 4) or Administrator (Level 1)

4. **Four Possible Actions from SUBMITTED:**
   - **Move to IN_QUEUE** (Procurement only): PR proceeds to quote validation and approver assignment
     - Notifies requestor, CC: Procurement
   - **Request Revision** (Procurement only - changes status to REVISION_REQUIRED):
     - Must provide notes (validated)
     - Notifies requestor, CC: Procurement
   - **Reject PR** (Procurement only - changes status to REJECTED):
     - Must provide notes (validated)
     - Notifies requestor, CC: Procurement
     - PR is not deleted from database
     - Can be resurrected by procurement/admin to SUBMITTED status
   - **Cancel PR** (Requestor only - changes status to CANCELED):
     - Optional notes
     - Notifies procurement
     - PR is not deleted from database
     - Can be resurrected by requestor to SUBMITTED status

### PR Processing in IN_QUEUE Status
1. **Procurement Edit Capabilities (Level 3 or Level 1 only):**
   - **Same edit permissions as SUBMITTED status**
   - Can edit most PR fields **EXCEPT** canonical fields and restricted financial fields:
     - Created by (requestor)
     - Created date
     - Last updated timestamp
     - Urgency level
     - Required date
     - **Project Category** (Finance/Admin only)
     - **Expense Type** (Finance/Admin only)
   - Can edit: Organization, Department, Description, Site, Estimated amount, Currency, Preferred vendor, Line items, Attachments
   - **Note:** Project Category and Expense Type can only be edited by Finance/Admin (Level 4) or Administrator (Level 1)
   - **Purpose:** May need to adjust PR details during quote validation and supplier data collection

2. **Supplier Data Collection (for non-approved vendors):**
   - For approved vendors: Data automatically referenced from system
   - For non-approved vendors: Procurement must manually input during IN_QUEUE:
     - Supplier name (required)
     - Contact information: phone OR email OR website (at least one required)
     - This data is NOT collected during PR creation
     - Validation check before moving to PENDING_APPROVAL
     - Data attached to PR object for audit trail

3. Procurement Users (permissionLevel 3 or 1):
   - Validate quotes and quote requirements
   - Collect supplier data for non-approved vendors
   - Select appropriate approver based on rules
   - Can "Push to Approver" (changes status to PENDING_APPROVAL)
   - Receive notifications about status changes

4. Requestor Users:
   - Can "Cancel PR" (changes status to CANCELED)
   - Optional notes when canceling
   - Receive notifications about status changes

5. Approvers:
   - Receive notification when PR is pushed for approval
   - Notification includes PR details (requestor, category, expense type, site, estimatedAmount, preferredVendor, requiredDate)
   - CC: Procurement (always)

### PR Processing in REVISION_REQUIRED Status
1. **Who Can Take Actions in REVISION_REQUIRED Status:**
   - **Requestor (Level 5):** Can edit their own PR and resubmit or cancel - **EXCLUSIVE ACCESS**
   - **Administrators (Level 1):** Full access as superuser (override capability)
   - **Procurement (Level 3):** CANNOT edit or take actions - must wait for requestor
   - **Finance/Admin (Level 4):** CANNOT edit or take actions - must wait for requestor
   - **Approvers (Level 2):** CANNOT edit or take actions - can only view

2. **Requestor Edit Capabilities in REVISION_REQUIRED:**
   - Can edit: Organization, Department, Description, Site, **Project Category**, **Expense Type**, Estimated Amount, Currency, **Urgency Level**, **Required Date**, Preferred Vendor, Line Items, Attachments
   - Cannot edit: Created by, Created date, History/Audit trail, PR Number
   - **CRITICAL:** In REVISION_REQUIRED status, the requestor has FULL edit access including Project Category and Expense Type
   - **Key Difference:** This is the ONLY status where requestor can edit Project Category and Expense Type
   - **Exclusive Access:** NO other user (except superadmin Level 1) can edit the PR in this status

3. **Two Possible Actions:**
   - **Resubmit:** Returns PR to SUBMITTED status for procurement review
   - **Cancel:** Changes status to CANCELED (requestor no longer wants to proceed)

### PR Resurrection Feature
PRs with REJECTED or CANCELED status can be restored to active workflow:

1. **Resurrection from REJECTED:**
   - **Who Can Resurrect:** Procurement Officers (Level 3) or Administrators (Level 1)
   - **Restore To:** The highest status the PR achieved before rejection
     - If rejected from SUBMITTED → Restore to SUBMITTED
     - If rejected after reaching IN_QUEUE → Restore to IN_QUEUE
     - If rejected from PENDING_APPROVAL → Restore to PENDING_APPROVAL
   - **Use Case:** Rejection was made in error, or circumstances changed
   - **Notifications:** All stakeholders notified of resurrection
   - **History:** Rejection and resurrection both recorded in audit trail

2. **Resurrection from CANCELED:**
   - **Who Can Resurrect:** Original Requestor or Administrators (Level 1)
   - **Restore To:** SUBMITTED status ONLY (regardless of where canceled from)
   - **Use Case:** Requestor changed their mind or canceled by mistake
   - **After Resurrection:** PR returns to procurement review
   - **Notifications:** Procurement team notified of resurrection
   - **History:** Cancellation and resurrection both recorded in audit trail

3. **General Resurrection Rules:**
   - Resurrected PRs retain their original PR number
   - All history (rejection/cancellation reason, who, when) is preserved
   - Admin (Level 1) can resurrect any PR, regardless of who rejected/canceled it
   - Resurrection triggers automatic notifications to relevant stakeholders

### PR Action Components
- The workflow is implemented in the `ProcurementActions` component
- Action buttons are displayed based on user permissions and PR status
- Each action includes:
  - Visual confirmation dialog
  - Notes field (required for certain actions)
  - Automatic notification triggers

### Project Category and Expense Type Edit Permissions Summary

**Status-Based Permission Matrix:**

| Status | Who Can Edit Project Category & Expense Type |
|--------|----------------------------------------------|
| SUBMITTED | Procurement (L3), Finance/Admin (L4), or Admin (L1) |
| IN_QUEUE | Procurement (L3), Finance/Admin (L4), or Admin (L1) |
| **REVISION_REQUIRED** | **Requestor (L5) or Admin (L1) ONLY** |
| PENDING_APPROVAL | Procurement (L3), Finance/Admin (L4), or Admin (L1) |
| APPROVED | Procurement (L3), Finance/Admin (L4), or Admin (L1) |
| ORDERED | Procurement (L3), Finance/Admin (L4), or Admin (L1) |
| COMPLETED | Finance/Admin (L4) or Admin (L1) ONLY |

**Key Rules:**
1. **Procurement (Level 3) CAN edit** Project Category & Expense Type from SUBMITTED through ORDERED statuses
2. **Procurement (Level 3) CANNOT edit** these fields in COMPLETED status (Finance/Admin finalizes)
3. **Requestor (Level 5) can ONLY edit** these fields when their PR is in REVISION_REQUIRED status
4. **Finance/Admin (Level 4) can edit** these fields in all statuses EXCEPT REVISION_REQUIRED
5. **Admin (Level 1) can ALWAYS edit** as superuser override

**Rationale:**
- In SUBMITTED through ORDERED: Procurement actively processes and manages the PR lifecycle
- In REVISION_REQUIRED: Requestor must have full control to fix issues
- In COMPLETED: Only Finance/Admin can make final adjustments for audit/accounting purposes
- This allows Procurement to maintain proper categorization throughout their active workflow

### PR to PO Transition and APPROVED Status Processing

#### Object Rename at APPROVED Status
- When PR is approved, it is renamed to PO (Purchase Order)
- PO retains the same number as the PR (format: ORG-YYYYMM-XXX)
- System automatically generates a downloadable PO document containing:
  - All line items with quantities and prices
  - Reference to selected quotation
  - Vendor details
  - Delivery information
  - Approval details (approver names, dates, justifications if applicable)

#### Who Can Take Actions in APPROVED Status
- **Procurement Officers (Level 3):** Can perform all procurement and document management actions
- **Finance Admins (Level 4):** Can perform all finance and document management actions
- **Administrators (Level 1):** Full access to all actions (superuser)
- **Other Levels:** Cannot take actions in APPROVED status

#### Procurement Actions in APPROVED Status
1. Download PO document
2. Upload Proforma Invoice
3. Upload Proof of Payment (PoP)
4. Initiate Override for Proforma (requires justification)
5. Initiate Override for PoP (requires justification)
6. Notify Finance Team to execute payment (validation: proforma uploaded OR override with note)
7. Move to ORDERED status (validation: proforma AND PoP uploaded OR overrides valid)

#### Finance/Admin Actions in APPROVED Status
1. Upload Proforma Invoice
2. Upload Proof of Payment (PoP)
3. Select Override for Proforma (requires justification)
4. Select Override for PoP (requires justification)
5. Notify Procurement Team to action file uploads (optional note)
6. Advance to ORDERED status (validation: proforma AND PoP uploaded OR overrides valid)

#### Proforma Invoice Requirements
- **Below Rule 1 Threshold:** Optional (no validation)
- **Above Rule 1 Threshold:** Required
  - Must upload proforma invoice
  - OR select override with justification note
  - Override justification examples: Vendor doesn't provide proforma, urgent order, standing agreement, emergency purchase

#### Proof of Payment (PoP) Requirements
- **Below Rule 1 Threshold:** Optional (no validation)
- **Above Rule 1 Threshold:** Required before moving to ORDERED
  - Must upload PoP document
  - OR select override with justification note
  - Validation enforced before status change

#### Estimated Delivery Date (ETD) Requirement
- **Required for ALL POs** before moving to ORDERED status
- Must be entered by Procurement
- Used for:
  - Delivery tracking
  - Automatic delay notifications (if ORDERED > 3 business days after ETD)
  - Performance metrics
- Validation: System blocks ORDERED status change without ETD

#### Validation Checks Before ORDERED Status
Both Procurement and Finance/Admin must ensure:
1. **Estimated Delivery Date (ETD):** REQUIRED for all POs
2. **Proforma Invoice:** IF above Rule 1 - uploaded OR override with justification
3. **Proof of Payment:** IF above Rule 1 - uploaded OR override with justification
4. **Below Rule 1 Threshold:** Only ETD required - can move to ORDERED once ETD is entered
5. **Above Rule 1 Threshold:** ETD, Proforma, AND PoP all required (or overrides with justification)
6. System blocks status change if validation fails

#### Notifications in APPROVED Status
- **Notify Finance for Payment:** Procurement → Finance Team (optional note)
- **Notify Procurement for Uploads:** Finance → Procurement Team (optional note)

#### Status Change Notification: APPROVED → ORDERED
When PO moves to ORDERED status:
- **Primary Recipients:**
  - Requestor
  - Organization Admin Email
  - All Approvers (single or both if dual-approval)
- **CC:** Procurement team (always), Organization Asset Management Email
- **Content:** PO number, status change, vendor details, order date, expected delivery (ETD), proforma/PoP status

**Note:** From ORDERED status onward, organization's Asset Management email is added to CC on all notifications.

### PO Processing in ORDERED Status

#### Who Can Take Actions in ORDERED Status
- **Procurement Officers (Level 3):** Can upload delivery documents, set override, move to COMPLETED
- **Asset Management Department Users:** Can upload delivery documents, set override, move to COMPLETED
  - User must have department = "Asset Management" or similar asset tracking role
- **Finance Admins (Level 4):** Can upload delivery documents, set override, move to COMPLETED for POs below Rule 1 threshold
- **Administrators (Level 1):** Full access (superuser)

#### Delivery Documentation Requirements
Before moving from ORDERED to COMPLETED, must have:
- **Delivery Note** (uploaded) OR
- **Delivery Photos** (uploaded) OR
- **Override with justification note**
  - Example justifications: Vendor didn't provide delivery note, emergency delivery, hand-delivered items, items too large to photograph

#### Actions Available in ORDERED Status
1. Upload Delivery Note (by Procurement or Asset Management)
2. Upload Delivery Photos (by Procurement or Asset Management)
3. Set Override for delivery documentation (requires justification)
4. Move to COMPLETED status (with validation: docs OR override required)

#### Move to COMPLETED Status - Enhanced Workflow
**Required Steps:**
1. **Delivery Documentation Validation:**
   - Delivery Note uploaded OR
   - Delivery Photos uploaded OR
   - Override with justification set
   
2. **Vendor Performance Question (NEW - Required):**
   - **Question Displayed:** "Order closed without issues?"
   - **Options:**
     - **YES** (radio button selected)
     - **NO** (radio button selected, reveals note field)
   - **If NO selected:**
     - **Issue Note Required:** Text field for describing issues
     - **Override Option:** "Approve vendor despite issues?" (checkbox)
     - **If Override checked:** Justification note required
   
3. **System Processing Upon Completion:**
   - **If "YES" selected:**
     - Check if PO had 3 quotes (from IN_QUEUE stage)
     - **If 3-quote process:** Auto-approve vendor for 12 months
     - **If not 3-quote:** Auto-approve vendor for 6 months
     - Update vendor object with approval data
     - Log approval in vendor audit trail
   - **If "NO" selected:**
     - Log issue note to vendor record
     - **If override NOT checked:** Vendor remains non-approved
     - **If override checked:** Manually approve vendor with justification logged
   - Status moves to COMPLETED
   - Send notification to stakeholders

#### Automatic Delay Notification
- **Trigger:** PO remains in ORDERED status for 3 business days AFTER Estimated Delivery Date (ETD)
- **Recipients:** Requestor, Organization Admin Email, All Approvers
- **CC:** Procurement team, Asset Management Email
- **Content:** PO number, ETD, current date, days overdue, vendor details, delivery delay alert
- **Purpose:** Alert stakeholders to follow up with vendor on delayed delivery
- **Frequency:** Sent once when threshold is reached

#### Status Change Notification: ORDERED → COMPLETED
When PO moves to COMPLETED status:
- **Primary Recipients:**
  - Requestor
  - All Approvers
  - Department Head
- **CC:** Procurement team (always), Asset Management Email
- **Content:** PO number, completion date, all items received confirmation, final summary
- **Purpose:** Confirm successful fulfillment of purchase request

### Automated Reminder Notifications

#### Daily Reminder System (8:00 AM)
System checks all PRs/POs with pending actions and sends daily reminders:
- **Procurement Reminders:** For PRs in SUBMITTED or IN_QUEUE status; POs in APPROVED or ORDERED status
- **Approver Reminders:** For PRs in PENDING_APPROVAL status
- **Requestor Reminders:** For PRs in REVISION_REQUIRED status
- **Finance/Admin Reminders:** For POs in APPROVED status
- **Asset Management Reminders:** For POs in ORDERED status
- **Frequency:** Once daily at 8:00 AM
- **CC:** Procurement always copied on all reminders
- **Email Source:** Uses organization's configured `procurementEmail`, `assetManagementEmail` addresses

#### Urgent Reminder System (8:00 AM and 3:00 PM)
For PRs/POs pending action for MORE than 2 business days:
- **Escalated Frequency:** Twice daily (8:00 AM and 3:00 PM)
- **Subject:** Includes "URGENT" prefix
- **Content:** Highlights elapsed time and urgency
- **Recipients:** Same as daily reminders but with escalation notice
- **Calculation:** Business days only (excludes weekends and holidays)
- **Purpose:** Prevents PRs from stalling, ensures timely processing

#### Reminder Content
- List of PRs/POs pending action
- Days open for each PR/PO
- Specific action needed
- Link to view/act on each PR/PO
- Urgency indicator for items over 2 business days

### Approval Process

#### Single vs. Dual Approver Requirements
- **Below Rule 2 Threshold:** ONE approver required
  - Level 2 (if above Rule 1) OR Level 4 or Level 2 (if below Rule 1)
- **Above Rule 2 Threshold:** TWO Level 2 approvers required (concurrent)
  - Both approvers notified simultaneously
  - Approvers can review and act in any order (parallel review)
  - If one approver approves first, other approver is notified (1 of 2 complete)
  - Both must approve for PR to proceed to APPROVED status
  - If either approver rejects or requests revision at any time, process stops immediately
  - Other approver is notified when one approver acts

#### Approver Selection Based On:
- Department hierarchy
- Amount thresholds (Rule 1 and Rule 2)
- Special category rules
- Organization assignment

#### Approval Justification Requirements
Justification is ONLY required for PRs that require 3 quotes:

1. **When Justification is REQUIRED (3-Quote Scenarios):**
   - **Applies to:**
     - Above Rule 1 threshold with non-approved vendor (requires 3 quotes)
     - Above Rule 2 threshold (always requires 3 quotes)
   - **If Lowest Quote is Selected:**
     - Default justification option available: "Value for Money" (radio button)
     - OR approver can write custom justification note
   - **If Lowest Quote is NOT Selected:**
     - Custom justification REQUIRED (cannot use default)
     - Must explain why higher quote was chosen
     - System validates justification is provided
     - Common reasons: Better quality, faster delivery, better warranty, vendor reliability

2. **When Justification is NOT Required (1-Quote Scenarios):**
   - **Applies to:**
     - Below Rule 1 threshold (requires 1 quote)
     - Above Rule 1 threshold with approved vendor (requires 1 quote)
   - Approval process: Simple approval with optional notes
   - No justification validation enforced

3. **For Dual-Approval PRs (Above Rule 2 - Always 3 Quotes):**
   - BOTH approvers must provide justification
   - Both can use default "Value for Money" if lowest quote selected
   - Both must provide custom justification if non-lowest quote selected
   - Each approver's justification recorded independently
   - Both justifications preserved in approval history

#### Approval Workflow Tracking
The `approvalWorkflow` object tracks:
- Current approver information
- For dual-approval PRs: Both approver details
- Complete approval history with timestamps
- Approval justifications from each approver
- Which approver approved first (order captured but not enforced)
- Status: Pending both, One approved (waiting for second), Both approved
- Timestamps of each approval action

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
- Email subjects reflect the specific PR/PO action or status change
- **Procurement is always CC'd on all PR/PO-related notifications**
  - Uses organization's configured `procurementEmail` address
- **Asset Management is CC'd on all PO notifications from ORDERED status onward**
  - Uses organization's configured `assetManagementEmail` address
- The requestor is included on all PR/PO-related notifications (primary recipient or CC)
- Notifications include a link to view the PR/PO details
- Email addresses are configured per organization in Admin Dashboard (not hardcoded)

### Status Change Notifications
1. PR Cancellation (by Requestor only):
   - Subject: "PR #[number] Canceled"
   - Recipients: Procurement team
   - CC: Requestor (who canceled)
   - Available: Up to and including PENDING_APPROVAL status; From APPROVED onward requestor cannot cancel
   - Content includes:
     - Status change (from current status to CANCELED)
     - Notes (if provided by requestor)
     - Link to PR details

2. Other Status Changes:
   - Subject format varies by status:
     - "PR #[number] Pending Approval"
     - "PR #[number] Approved" (becomes PO from this point)
     - "PO #[number] Ordered"
     - "PO #[number] Completed"
     - "PR #[number] Rejected"
     - "PR #[number] Revision Required"
     - Default: "PR/PO #[number] Status Changed to [STATUS]"
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
- Status Change (PR stages):
  - Normal Priority: "[NEW_STATUS]: PR #[PR-NUMBER]"
  - Urgent Priority: "URGENT: [NEW_STATUS]: PR #[PR-NUMBER]"
- Status Change (PO stages - APPROVED onward):
  - Normal Priority: "[NEW_STATUS]: PO #[PO-NUMBER]"
  - Urgent Priority: "URGENT: [NEW_STATUS]: PO #[PO-NUMBER]"
- Automated Reminders:
  - Normal (0-2 days): "Reminder: PRs/POs Pending Your Action"
  - Urgent (3+ days): "URGENT: PRs/POs Overdue - Action Required"

### Email Content Structure
1. Header Section:
   - Priority indicator (if urgent)
   - PR/PO Details heading (use PR for pre-APPROVED, PO for APPROVED onward)
   - View PR/PO button/link

2. Core Information Table:
   - PR/PO Number
   - Description
   - Department
   - Required Date
   - Estimated Amount (with currency) - uses `estimatedAmount` field
   - Preferred Vendor - uses `preferredVendor` field
   - Requestor
   - For PO (APPROVED onward): Also include ETD (Estimated Delivery Date), Vendor selected

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
   - New PR submission (notifies procurement)
   - Status changes:
     - SUBMITTED → IN_QUEUE (notifies requestor)
     - Any status change (notifies relevant stakeholders)
   - Approval requests (notifies approver and requestor)
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
