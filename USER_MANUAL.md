# PR System User Manual

**Version 1.0** | **Last Updated: November 2025**

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [User Roles Overview](#user-roles-overview)
3. [Requestor Guide](#requestor-guide)
4. [Approver Guide](#approver-guide)
5. [Procurement Guide](#procurement-guide)
6. [Finance/Admin Guide](#financeadmin-guide)
7. [Superadmin Guide](#superadmin-guide)
8. [Common Features](#common-features)
9. [Troubleshooting](#troubleshooting)
10. [FAQs](#faqs)

---

## Getting Started

### Logging In

1. Navigate to the PR System URL
2. Click **"Sign in with Google"**
3. Select your organization email address
4. You'll be redirected to the Dashboard

### First Time Setup

After your first login:
- Your account will be created automatically
- An administrator will assign your permission level
- You'll receive an email confirmation
- Contact your administrator if you don't see the correct permissions

### Dashboard Overview

The Dashboard is your home base and shows:
- **Key Metrics**: Total PRs, Urgent PRs, Average Days Open, Overdue PRs
- **My PRs Toggle**: Filter to see only PRs relevant to you
- **PR/PO Table**: List of all purchase requests/orders
- **Status Filters**: Quick filters by PR status
- **Search & Filters**: Advanced search capabilities

---

## User Roles Overview

### Permission Levels

| Level | Role | Primary Responsibilities |
|-------|------|--------------------------|
| **5** | **Requestor** | Create PRs, respond to revision requests |
| **2** | **Approver** | Review and approve/reject PRs |
| **3** | **Procurement** | Process PRs, manage quotes, handle vendors |
| **4** | **Finance/Admin** | Handle payments, review financial aspects |
| **1** | **Superadmin** | System administration, user management |

### Role Capabilities Matrix

| Action | Requestor | Approver | Procurement | Finance/Admin | Superadmin |
|--------|-----------|----------|-------------|---------------|------------|
| Create PR | ✅ | ✅ | ✅ | ✅ | ✅ |
| View PRs | Own | Assigned | All | All | All |
| Approve PR | ❌ | ✅ | ❌ | Limited | ✅ |
| Add Quotes | ❌ | ❌ | ✅ | ❌ | ✅ |
| Process Orders | ❌ | ❌ | ✅ | ✅ | ✅ |
| Manage Users | ❌ | ❌ | ❌ | ❌ | ✅ |
| Manage Vendors | ❌ | View | ✅ | ✅ | ✅ |

---

## Requestor Guide

### Your Role
As a Requestor, you create Purchase Requests (PRs) when your department needs to buy goods or services.

### Creating a New Purchase Request

#### Step 1: Start a New PR
1. Click **"NEW PR"** button (top right)
2. You'll see a multi-step form

#### Step 2: Basic Information
Fill in these required fields:
- **Organization**: Select your organization (if you belong to multiple)
- **Requestor**: Pre-filled with your name
- **Email**: Pre-filled with your email
- **Department**: Select your department
- **Project Category**: Choose the project type
- **Description**: Describe what you're purchasing and why
- **Site**: Select the delivery location
- **Expense Type**: CAPEX or OPEX
- **Estimated Amount**: Enter the total estimated cost
- **Currency**: Select the currency (LSL, USD, ZAR, etc.)
- **Required Date**: When you need the items
- **Preferred Vendor** (optional): If you have a preferred supplier
- **Mark as Urgent** (checkbox): Check if this is urgent

#### Step 3: Add Line Items
Add each item you're purchasing:
1. Click **"Add Line Item"**
2. Fill in:
   - Description (what is it?)
   - Quantity (how many?)
   - Unit of Measure (pieces, kg, liters, etc.)
   - Estimated Unit Price
   - Notes (optional)
3. Add more items as needed
4. The total amount calculates automatically

#### Step 4: Upload Supporting Documents
- Click **"Upload Documents"** or drag & drop files
- Accepted formats: PDF, images, Word docs, Excel
- Examples: specifications, drawings, quotes, approvals

#### Step 5: Review and Submit
1. Review all information
2. Click **"Submit PR"**
3. You'll receive a PR number (format: ORG-YYYYMM-XXX)
4. Email notifications sent to procurement and approvers

### Tracking Your PRs

#### View Your PRs
1. Enable **"My PRs"** toggle in sidebar
2. PRs you created will be highlighted
3. Check the **Status** column to see where your PR is

#### PR Status Meanings
- **SUBMITTED**: PR created, waiting for procurement review
- **IN_QUEUE**: Procurement is working on it (adding quotes)
- **PENDING_APPROVAL**: Waiting for approver decision
- **APPROVED**: Approved! Order will be placed
- **ORDERED**: Order placed with vendor
- **COMPLETED**: Items received and order closed
- **REVISION_REQUIRED**: Approver needs changes (action needed!)
- **REJECTED**: PR was rejected
- **CANCELED**: PR was canceled

### Responding to Revision Requests

When status is **REVISION_REQUIRED**:
1. Click on your PR to open it
2. Read the **Revision Notes** (in red/yellow alert box)
3. Click **"Edit"** button
4. Make the requested changes
5. Add a note explaining what you changed
6. Click **"Resubmit"**
7. PR goes back to previous step in workflow

### Viewing PR Details

Click any PR number to see:
- All basic information
- Line items with quantities and prices
- Quotes (added by procurement)
- Approval history (who approved, when, notes)
- Status history (complete audit trail)
- All uploaded documents

### Tips for Requestors

✅ **DO:**
- Provide detailed descriptions
- Upload supporting documents
- Respond quickly to revision requests
- Mark genuinely urgent items as urgent
- Include technical specifications

❌ **DON'T:**
- Mark everything as urgent
- Submit incomplete information
- Split one purchase into multiple PRs to avoid approval thresholds
- Forget to check your email for notifications

---

## Approver Guide

### Your Role
As an Approver, you review PRs to ensure they're necessary, properly justified, and follow company policies.

### Finding PRs to Approve

#### Using "My PRs" Toggle
1. Enable **"My PRs"** toggle (sidebar)
2. Shows PRs where you're the assigned approver
3. Look for status: **PENDING_APPROVAL**

#### Using Filters
1. Click **Status** dropdown
2. Select **"PENDING_APPROVAL"**
3. See all PRs waiting for approval

### Reviewing a PR

#### Open the PR
1. Click the PR number
2. You'll see the full PR details

#### What to Check
- **Description**: Is it clear what's being purchased and why?
- **Amount**: Is it reasonable for what's being requested?
- **Line Items**: Do quantities make sense?
- **Quotes**: Are there enough quotes? Are prices competitive?
- **Budget**: Is this within budget expectations?
- **Urgency**: Is the urgency justified?
- **Vendor**: Is the selected vendor appropriate?

#### Quote Requirements
The system enforces quote rules based on amount:
- **Below Rule 1 threshold**: 1 quote required
- **Above Rule 1, below Rule 2**: 3 quotes required (unless approved vendor)
- **Above Rule 2**: 3 quotes + second approver required

*Note: Thresholds are organization-specific. Check with your admin.*

### Approving a PR

1. Review all information thoroughly
2. Scroll to **"Approver Actions"** section
3. Click **"Approve"** button
4. Add notes (optional but recommended)
   - "Approved - within budget"
   - "Approved - urgent need verified"
5. Click **"Confirm Approval"**
6. PR moves to next stage
7. Email sent to requestor and stakeholders

### Requesting Revisions

If something needs to be fixed:
1. Scroll to **"Approver Actions"** section
2. Click **"Request Revision"** button
3. Enter detailed notes explaining what needs to change:
   - "Please provide a more detailed description"
   - "Estimated amount seems high, please verify"
   - "Need additional quotes from other vendors"
4. Click **"Confirm"**
5. PR goes back to requestor with status: **REVISION_REQUIRED**
6. Requestor receives email with your notes

### Rejecting a PR

For PRs that shouldn't be approved:
1. Scroll to **"Approver Actions"** section
2. Click **"Reject"** button
3. **Must provide justification**:
   - "Outside approved budget"
   - "Not aligned with departmental priorities"
   - "Duplicate of existing order"
4. Click **"Confirm Rejection"**
5. PR status becomes **REJECTED**
6. Requestor and stakeholders notified

### Dual Approval Scenarios

For high-value PRs (above Rule 2 threshold):
- **Two approvers** are assigned simultaneously
- **Both must approve** for PR to proceed
- You'll see the second approver's name
- If either approver rejects, PR is rejected
- Check **Approval History** to see second approver's decision

### 3-Quote Override

If a PR has only 1 quote but requires 3:
1. Look for **"Quote Requirement Override"** section
2. Read procurement's justification
3. Decide if you accept the justification
4. Options:
   - **Approve**: Accept the override and approve PR
   - **Request Revision**: Ask for more quotes or better justification
   - **Reject**: Deny the PR

### Approver Justifications

For 3-quote scenarios, you can add notes explaining:
- Why you selected a particular vendor
- Why you didn't choose the lowest quote
- Special considerations (quality, reliability, urgency)

These notes are permanently recorded in the audit trail.

### Tips for Approvers

✅ **DO:**
- Review thoroughly before approving
- Add meaningful notes to your decisions
- Respond to approval requests promptly
- Check quote validity and competitiveness
- Verify urgency claims
- Consider total cost of ownership, not just price

❌ **DON'T:**
- Approve without reviewing
- Ignore insufficient quotes
- Skip adding justification for rejections
- Approve outside your authority level
- Let approval requests sit for days

---

## Procurement Guide

### Your Role
As Procurement, you're the hub of the PR process. You manage quotes, handle vendor relationships, and ensure PRs move smoothly through the workflow.

### Your Dashboard View

With "My PRs" toggle OFF, you see **ALL PRs** across the organization.

### PR Workflow from Your Perspective

```
SUBMITTED → IN_QUEUE → PENDING_APPROVAL → APPROVED → ORDERED → COMPLETED
     ↓           ↓            ↓              ↓          ↓          ↓
   You review  Add quotes  Monitor    Place order  Track    Close order
```

### Processing New PRs (SUBMITTED Status)

#### Review New Submissions
1. Filter by status: **SUBMITTED**
2. Click on PR to open
3. Review for completeness:
   - All required fields filled?
   - Description clear?
   - Documents attached?
   - Estimated amount reasonable?

#### Move to IN_QUEUE
1. Click **"Move to In Queue"** button
2. Add notes (optional):
   - "Working on obtaining quotes"
   - "Contacting vendors"
3. Status changes to **IN_QUEUE**
4. Email sent to requestor

### Adding Quotes (IN_QUEUE Status)

#### How Many Quotes Do You Need?
The system tells you based on the amount:
- Check the **"Quote Requirements"** section
- It shows: "X quotes required"
- It shows: "Must attach quote documents" (if required)

#### Add a Quote
1. Scroll to **"Quotes"** section
2. Click **"Add Quote"**
3. Fill in quote details:
   - **Vendor**: Select from dropdown or type name
   - **Amount**: Quote total
   - **Currency**: Quote currency
   - **Valid Until**: Quote expiration date
   - **Lead Time**: How long to deliver
   - **Notes**: Any special terms or conditions
4. **Upload quote document** (required for most quotes)
5. Click **"Save Quote"**
6. Repeat for additional vendors

#### 3-Quote Override
If you can't get 3 quotes (vendor monopoly, time constraints):
1. Add the quotes you have (at least 1)
2. Check **"Override Quote Requirement"** checkbox
3. **Must provide detailed justification**:
   - "Single supplier for this specialized equipment"
   - "Urgent need, insufficient time for 3 quotes"
   - "Only 2 vendors in the country can supply"
4. Approver will review your justification

#### Selecting Preferred Quote
1. Review all quotes
2. Consider: price, quality, delivery time, vendor reliability
3. Click **"Mark as Preferred"** on the best quote
4. Optional: Add notes explaining your selection

### Moving to Approval

When quotes are ready:
1. Verify all required quotes added
2. Verify quote documents attached (if required)
3. Verify preferred quote selected (if applicable)
4. Click **"Submit for Approval"**
5. Status changes to **PENDING_APPROVAL**
6. System automatically assigns approver(s)
7. Email sent to approver(s)

### Handling Approved PRs (APPROVED Status)

#### Prepare the Order
1. Filter by status: **APPROVED**
2. Open the PR
3. Review approved quote and vendor details

#### Enter Vendor Data (if not approved vendor)
For non-approved vendors, you must enter:
- Supplier name
- Contact information (phone OR email OR website)
- This is saved to the PR for audit trail

#### Place the Order
1. Create PO with selected vendor
2. Negotiate final details
3. Confirm order placement

#### Move to ORDERED
1. Click **"Move to Ordered"** button
2. Enter required information:
   - **Selected Vendor**: Confirm or update
   - **Final Amount**: Actual order amount (may differ from quote)
   - **PO Number**: Your purchase order number
   - **Estimated Delivery Date**: When you expect delivery
3. Upload proforma invoice (required)
4. Add notes (optional)
5. Click **"Confirm"**
6. Status changes to **ORDERED**
7. Email sent to requestor and stakeholders

### Managing Vendors

#### Access Vendor Management
1. Go to **Admin** section (top menu)
2. Click **"Reference Data"** tab
3. Select **"Vendors"** from dropdown

#### Add New Vendor
1. Click **"Add Item"**
2. Fill in vendor details:
   - Name (required)
   - Code (optional)
   - Contact email
   - Contact phone
   - Website
   - Address, City, Country
   - Products/Services
   - Notes
3. Click **"Save"**

#### View Vendor Details
1. Click on any vendor row
2. See vendor information
3. See approval status
4. View all associated PRs/POs
5. See document history
6. Upload vendor documents

#### Upload Vendor Documents
1. Open vendor details
2. Scroll to **"Company Documents"** section
3. Select document category:
   - Incorporation Documents
   - Tax Certificate
   - Bank Letter
   - Insurance
   - License/Permit
   - Other
4. Upload document(s)
5. Documents are permanently stored

#### Vendor Approval Status
Vendors can be automatically approved when:
- They pass a 3-quote process
- An order with them is successfully completed

You can also manually approve/de-approve vendors as needed.

### Searching by Vendor

In PR List view:
1. Use **"Search by Vendor"** field
2. Finds PRs where vendor:
   - Was preferred vendor
   - Was selected vendor
   - Submitted a quote (even if not selected)
3. Use **"Vendor Relationship"** filter to distinguish:
   - **All Relationships**: All PRs involving vendor
   - **Transacted**: PRs where vendor was selected
   - **Quoted Only**: PRs where vendor quoted but wasn't selected

### Tips for Procurement

✅ **DO:**
- Process PRs promptly (within 2 business days)
- Get competitive quotes
- Verify vendor credentials
- Document everything (quotes, communications)
- Keep requestors updated on progress
- Verify delivery dates are realistic
- Build relationships with reliable vendors

❌ **DON'T:**
- Accept verbal quotes without documentation
- Rush approvals without proper quotes
- Ignore quote requirements
- Skip vendor verification
- Lose track of pending PRs
- Forget to upload required documents

---

## Finance/Admin Guide

### Your Role
Finance/Admin handles the payment side of approved orders and monitors financial compliance.

### Your Responsibilities

1. **Review Approved PRs**: Verify financial information
2. **Process Payments**: Arrange payments after delivery
3. **Close Completed Orders**: Mark orders as complete
4. **Financial Reporting**: Monitor spending and budgets
5. **Vendor Management**: Update vendor financial information

### Processing APPROVED PRs

#### What to Check
1. Filter by status: **APPROVED**
2. Open each PR
3. Verify:
   - Budget allocation correct
   - Amount within approved limits
   - Vendor payment terms acceptable
   - Tax implications understood
4. Add notes if financial concerns

### Handling ORDERED PRs

#### Monitor Orders
1. Filter by status: **ORDERED**
2. Track:
   - Estimated delivery dates
   - Outstanding amounts
   - Vendor performance

#### When Items are Delivered
Work with Asset Management or Procurement to:
1. Verify delivery notes received
2. Verify items match order
3. Process for payment

### Moving to COMPLETED Status

#### Closing an Order
1. Filter by status: **ORDERED**
2. Open the PR
3. Scroll to **"Move to Completed"** section
4. Verify:
   - Delivery documentation uploaded OR
   - Delivery photos uploaded OR
   - Override approved (with justification)
5. **REQUIRED QUESTION**: "Order closed without issues?"
   - **YES**: Normal completion
   - **NO**: Issues need to be documented

#### If NO Issues (Satisfactory Completion)
1. Select **"YES"**
2. System automatically approves the vendor (if applicable):
   - 3-quote process: 12-month approval
   - Single order: 6-month approval
3. Click **"Move to Completed"**
4. Status changes to **COMPLETED**
5. Email sent to all stakeholders

#### If Issues Occurred
1. Select **"NO"**
2. **Must enter issue notes**:
   - "Items damaged in transit"
   - "Partial delivery, missing components"
   - "Significant delay"
3. Optional: Check **"Approve vendor despite issues"**
   - Requires justification
   - Manually approves vendor for 12 months
4. Issue is logged to vendor record
5. Click **"Move to Completed"**

### Financial Reporting

#### View Metrics
Dashboard shows:
- Total transaction value
- Average transaction value
- PRs by status
- Overdue payments

#### Export Data
1. Apply filters for time period/organization
2. Click **"Export to CSV"** (future feature)
3. Analyze in Excel

### Vendor Financial Management

1. Navigate to vendor details
2. Update payment terms
3. Upload bank letters
4. Upload tax certificates
5. Track vendor spending history

### Tips for Finance/Admin

✅ **DO:**
- Review approved amounts daily
- Verify budget compliance
- Keep financial documents organized
- Process payments promptly
- Track vendor spending patterns
- Flag unusual spending

❌ **DON'T:**
- Approve payments without delivery confirmation
- Skip document verification
- Ignore budget overruns
- Delay payment processing
- Overlook tax implications

---

## Superadmin Guide

### Your Role
As Superadmin, you have full system access and are responsible for system configuration, user management, and overall system health.

### User Management

#### Access User Management
1. Go to **Admin** section
2. Click **"User Management"** tab

#### Add New User
1. Click **"Add User"**
2. Fill in user details:
   - Name
   - Email (must match Google account)
   - Organization
   - Department
   - Permission Level (1-5)
3. Click **"Save"**
4. User receives welcome email
5. User can login on next visit

#### Edit User Permissions
1. Click **"Edit"** on user row
2. Change permission level
3. Update organization/department
4. Click **"Save"**
5. Changes take effect immediately

#### Deactivate User
1. Click **"Edit"** on user row
2. Uncheck **"Active"** checkbox
3. Click **"Save"**
4. User can no longer login

### Organization Configuration

#### Access Organization Settings
1. Go to **Admin** section
2. Click **"Organization Settings"** tab

#### Configure Approval Rules
For each organization, set:
- **Rule 1 Threshold**: Amount requiring 3 quotes
- **Rule 2 Threshold**: Amount requiring 2 approvers
- **Currency**: Base currency for thresholds
- **Quote Requirements**: Number of quotes needed

#### Vendor Approval Settings
- **3-Quote Process Duration**: Months vendor stays approved after passing 3-quote
- **Completed Order Duration**: Months vendor stays approved after successful order
- **Manual Approval Duration**: Months for manual approvals
- **High-Value Threshold**: Amount that flags vendors as "high-value"
- **High-Value Duration**: Max approval months for high-value vendors

### Reference Data Management

#### Manage Departments
1. Go to **Admin** → **Reference Data**
2. Select **"Departments"**
3. Add/Edit/Delete departments
4. Set active/inactive status

#### Manage Categories, Sites, etc.
Similar process for:
- Project Categories
- Sites
- Expense Types
- Vehicles
- Currencies
- Units of Measure

#### Manage Vendors
1. Go to **Admin** → **Reference Data**
2. Select **"Vendors"**
3. Click any vendor to view details
4. Full access to:
   - Edit vendor information
   - Upload documents
   - Approve/de-approve vendors
   - View all associated PRs
   - View quotes submitted

### System Monitoring

#### Monitor PR Activity
- Dashboard shows all PRs across all organizations
- Track PR volumes by status
- Identify bottlenecks
- Monitor approval times

#### User Activity
- Track who's creating PRs
- Monitor approval response times
- Identify inactive users

### Database Cleanup

⚠️ **Use with Extreme Caution**

#### Access Database Cleanup
1. Go to **Admin** section
2. Click **"Database Cleanup"** tab

#### Delete Old PRs
- Filter by date range
- Select PRs to delete
- Confirm deletion (irreversible)
- Use only for test data or very old completed PRs

### Troubleshooting User Issues

#### User Can't Login
1. Verify user exists in User Management
2. Check "Active" status
3. Verify email matches their Google account
4. Check organization assignment

#### User Missing Permissions
1. Find user in User Management
2. Check permission level
3. Update if necessary
4. User may need to logout/login

#### PR Stuck in Workflow
1. Open the PR
2. Check status history
3. Identify where it's stuck
4. As superadmin, you can manually move PR to any status
5. Add notes explaining manual intervention

### Tips for Superadmins

✅ **DO:**
- Regularly review user permissions
- Monitor system usage patterns
- Keep reference data up to date
- Document configuration changes
- Backup important data
- Train users on system changes
- Respond to support requests promptly

❌ **DON'T:**
- Delete users unless absolutely necessary
- Change approval rules mid-cycle
- Manually intervene in PRs unless critical
- Give superadmin access to too many people
- Forget to communicate system changes
- Skip testing configuration changes

---

## Common Features

### Dashboard Features

#### My PRs Toggle
- Located in sidebar navigation
- When ON: Shows only PRs relevant to you
  - PRs you created (requestors)
  - PRs you need to approve (approvers)
  - All PRs (procurement/finance)
- When OFF: Shows all PRs (based on permissions)

#### Status Filters
Quick filter buttons:
- SUBMITTED
- IN_QUEUE
- PENDING_APPROVAL
- APPROVED
- ORDERED
- COMPLETED
- REVISION_REQUIRED
- CANCELED
- REJECTED

Click any status to filter the PR table.

#### Search & Filter

**General Search** (top of table):
- Search by PR number
- Search by department
- Search by category
- Real-time results as you type

**Advanced Filters**:
- **Status**: Filter by status
- **Time Period**: Last 7/30/90 days or all time
- **Vendor Search**: Find PRs by vendor (includes quotes)
- **Vendor Relationship**: Transacted vs Quoted

**Results Count**:
- Shows "Showing X of Y PR/POs" when filters active
- Helps track how many match your criteria

### Viewing PR Details

#### Open a PR
Click on any PR number or row in the table.

#### Information Sections

**Basic Information**:
- Organization, Department, Category
- Description, Site, Expense Type
- Amounts, Currency, Dates
- Requestor information
- Urgency level

**Line Items**:
- Table showing all items requested
- Description, Quantity, UOM, Unit Price
- Total amount per line item

**Quotes** (if added):
- All vendor quotes received
- Quote amounts, currencies, dates
- Preferred quote highlighted
- Quote documents (click to view)

**Approval History**:
- Who approved/rejected
- When they made the decision
- Notes they added
- Complete audit trail

**Status History & Notes**:
- Every status change
- Who made the change
- When it happened
- Notes added at each step
- Complete chronological history

**Documents**:
- All uploaded documents
- Organized by type
- Click to view/download

### Uploading Documents

#### How to Upload
1. Click **"Upload Documents"** or drag & drop
2. Select file(s) from your computer
3. File uploads automatically
4. File appears in documents list

#### Accepted File Types
- Images: JPG, PNG, GIF
- Documents: PDF, DOC, DOCX
- Spreadsheets: XLS, XLSX
- Maximum file size: 10MB per file

#### Document Types
- Supporting documents (specs, drawings)
- Quotes (vendor quotes)
- Proforma invoices
- Delivery notes
- Photos of delivered items

### Notifications

#### Email Notifications
You'll receive emails when:
- A PR you created changes status
- A PR is assigned to you for approval
- A revision is requested on your PR
- Your approval/action is needed
- A PR is completed

#### Email Contains
- PR number and description
- Current status
- Action required (if any)
- Direct link to PR
- Key details

### Mobile Usage

#### Responsive Design
The system works on:
- Desktop computers
- Tablets
- Smartphones

#### Mobile Features
- View PRs
- Approve/reject (approvers)
- Add comments
- View documents
- Limited editing (use desktop for complex tasks)

### Language Support

Currently supported:
- English
- French

To change language:
1. Click user profile icon (top right)
2. Select language preference
3. Page reloads in selected language

---

## Troubleshooting

### Login Issues

**Problem**: Can't login
- **Solution**: Verify you're using your organization Google account
- **Solution**: Check with admin that your account exists in the system
- **Solution**: Try incognito/private browsing mode
- **Solution**: Clear browser cache and cookies

**Problem**: Login but see error
- **Solution**: Your account may need activation by admin
- **Solution**: Check that you've been assigned an organization

### PR Creation Issues

**Problem**: Can't create new PR
- **Solution**: Verify you have at least Requestor (Level 5) permissions
- **Solution**: Check that all required fields are filled with asterisk (*)
- **Solution**: Verify amount is greater than 0

**Problem**: Can't upload documents
- **Solution**: Check file size (max 10MB)
- **Solution**: Verify file type is supported
- **Solution**: Try a different browser
- **Solution**: Check your internet connection

### Approval Issues

**Problem**: Don't see PRs to approve
- **Solution**: Turn on "My PRs" toggle
- **Solution**: Filter by status: PENDING_APPROVAL
- **Solution**: Verify you're assigned as approver on the PR
- **Solution**: Check with Superadmin about your permission level

**Problem**: Can't approve PR
- **Solution**: Verify PR status is PENDING_APPROVAL
- **Solution**: Check that you're the assigned approver
- **Solution**: Verify PR has required quotes attached

### System Issues

**Problem**: Page not loading
- **Solution**: Refresh your browser
- **Solution**: Check your internet connection
- **Solution**: Try a different browser
- **Solution**: Clear browser cache

**Problem**: Changes not saving
- **Solution**: Check for error messages (usually in red)
- **Solution**: Verify all required fields are filled
- **Solution**: Check your internet connection
- **Solution**: Try again after a few minutes

**Problem**: Documents not displaying
- **Solution**: Click the file name to download
- **Solution**: Check that you have appropriate software to view file type
- **Solution**: Try a different browser

### Getting Help

**Contact Support**:
- Email: [Your IT support email]
- Phone: [Your support phone]
- Hours: [Your support hours]

**Before Contacting Support, Have Ready**:
- Your name and email
- PR number (if applicable)
- Description of the problem
- Screenshots (if possible)
- What you were trying to do
- Any error messages

---

## FAQs

### General Questions

**Q: Who can create a PR?**
A: Any user with Requestor level (5) or higher permissions.

**Q: How long does approval take?**
A: Typically 1-3 business days depending on the complexity and amount.

**Q: Can I edit a PR after submitting?**
A: No. If changes are needed, the approver will request revision, or you'll need to cancel and create a new PR.

**Q: What happens if I make a mistake?**
A: Contact Procurement immediately. They can request revision from the approver or help you cancel and create a corrected PR.

**Q: Can I delete a PR?**
A: Only Superadmins can delete PRs. You can cancel a PR if it hasn't been approved yet.

**Q: How do I check PR status?**
A: Log in, enable "My PRs" toggle, and check the Status column. Click the PR for full history.

### Requestor Questions

**Q: When should I mark a PR as urgent?**
A: Only when there's a genuine urgent need (equipment breakdown, deadline, safety issue). Don't mark everything urgent.

**Q: How many quotes do I need?**
A: You don't add quotes - Procurement does. The number depends on the amount (typically 1 or 3).

**Q: What if my preferred vendor is more expensive?**
A: Add notes explaining why (quality, reliability, warranty, local support). Approver will decide.

**Q: Can I have multiple PRs?**
A: Yes, you can create as many as needed. Each is tracked separately.

**Q: What if I need to rush a PR?**
A: Mark it urgent and add explanation in description. Contact Procurement directly to expedite.

### Approver Questions

**Q: What if I'm not sure whether to approve?**
A: Request revision and ask for more information. Better to ask questions than approve incorrectly.

**Q: Can I approve over the phone?**
A: No. All approvals must be done in the system for audit trail.

**Q: What if both quotes are the same price?**
A: Consider other factors: delivery time, quality, vendor reliability, payment terms.

**Q: What if I'm on vacation?**
A: Contact Superadmin to temporarily assign approvals to another approver.

**Q: Do I need to approve every little purchase?**
A: Only PRs assigned to you. Small amounts may be auto-approved or assigned to Level 4 approvers.

### Procurement Questions

**Q: How do I handle single-source vendors?**
A: Use the 3-quote override feature and provide detailed justification.

**Q: What if a vendor won't provide a written quote?**
A: Get verbal quote, create written summary, and note in PR. Not ideal but workable.

**Q: Can I split a large PR into smaller ones?**
A: No. This violates approval threshold controls. Keep PRs together.

**Q: What if quotes expire before approval?**
A: Contact vendors to extend validity. Update expiration dates in system.

**Q: How do I handle vendor performance issues?**
A: Document issues when closing completed orders. This affects vendor approval status.

### Finance Questions

**Q: When should I process payment?**
A: After delivery confirmation and when PR status is COMPLETED.

**Q: What if the final amount differs from approval?**
A: Small variances (typically <10%) may be acceptable. Large changes may need re-approval.

**Q: How do I handle partial deliveries?**
A: Keep status as ORDERED until complete. Document partial delivery in notes.

**Q: What about tax implications?**
A: Consult your tax/accounting team. Add tax notes to PR.

### Technical Questions

**Q: What browsers are supported?**
A: Chrome, Firefox, Safari, Edge (latest versions).

**Q: Is there a mobile app?**
A: No app, but the system works on mobile browsers.

**Q: How is my data protected?**
A: Data is stored in Google Firebase with bank-level security. Access is controlled by permissions.

**Q: Can I export data?**
A: Currently limited. Full export features coming soon. Contact Superadmin for data requests.

**Q: Is there an API?**
A: Not currently available. Contact technical team if integration is needed.

---

## Appendix A: Status Flow Diagram

```
NEW PR CREATED
     ↓
[SUBMITTED] ← Requestor submits
     ↓
[IN_QUEUE] ← Procurement adds quotes
     ↓
[PENDING_APPROVAL] ← Waiting for approver
     ↓                          ↓
[APPROVED] ← Approved      [REVISION_REQUIRED] ← Changes needed
     ↓                          ↓
[ORDERED] ← Order placed    Back to Requestor
     ↓                          ↓
[COMPLETED] ← Delivered     Resubmit → [IN_QUEUE]

Side paths:
[REJECTED] ← Approver rejects (terminal)
[CANCELED] ← Requestor/Admin cancels (terminal)
```

---

## Appendix B: Quick Reference Tables

### Permission Level Quick Reference

| Level | Role | Can Create PR | Can Approve | Can Add Quotes | Can Process Orders |
|-------|------|--------------|-------------|----------------|-------------------|
| 1 | Superadmin | ✅ | ✅ | ✅ | ✅ |
| 2 | Approver | ✅ | ✅ | ❌ | ❌ |
| 3 | Procurement | ✅ | ❌ | ✅ | ✅ |
| 4 | Finance/Admin | ✅ | Limited | ❌ | ✅ |
| 5 | Requestor | ✅ | ❌ | ❌ | ❌ |

### Status Actions Quick Reference

| Status | Who Acts | What They Do | Next Status |
|--------|----------|--------------|-------------|
| SUBMITTED | Procurement | Review and move to queue | IN_QUEUE |
| IN_QUEUE | Procurement | Add quotes, submit for approval | PENDING_APPROVAL |
| PENDING_APPROVAL | Approver | Approve, reject, or request revision | APPROVED, REJECTED, REVISION_REQUIRED |
| REVISION_REQUIRED | Requestor | Make changes and resubmit | IN_QUEUE |
| APPROVED | Procurement | Place order | ORDERED |
| ORDERED | Procurement/Finance | Confirm delivery | COMPLETED |

### Document Types Quick Reference

| Stage | Document Type | Required? | Who Uploads |
|-------|--------------|-----------|-------------|
| Creation | Supporting docs | Optional | Requestor |
| IN_QUEUE | Quote documents | Usually yes | Procurement |
| APPROVED | Proforma invoice | Yes | Procurement |
| ORDERED | Delivery note or photos | Yes or override | Procurement/Finance |

---

## Document Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | Nov 2025 | Initial release | System Team |

---

## Need More Help?

**Training Sessions**: Contact your administrator to schedule training
**System Updates**: Check email for notifications about new features
**Feedback**: Send suggestions to [feedback email]

---

*This manual is a living document and will be updated as the system evolves.*

