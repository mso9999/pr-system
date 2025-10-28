# 1PWR Procurement Requisition System

A comprehensive procurement requisition system built for 1PWR to manage purchase requests and orders.

## Features

### Core Features
- User authentication with role-based access control
- Purchase request creation and management
- Purchase order tracking with complete lifecycle management
- Multi-organization support with configurable settings
- Comprehensive document management (proforma, PoP, delivery docs)
- Advanced approval workflow with dual-approval support
- Automated vendor approval system
- PR resurrection capability for REJECTED and CANCELED items

### Dashboard Features
- **MY ACTIONS Button**: Personalized filter showing items requiring your action
  - Role-based filtering (Requestors, Approvers, Finance/Admin, Asset Management)
  - Count badge showing pending actions
  - Not available for Procurement (they see all)
- **Advanced Search & Filtering**:
  - Multi-field search (PR/PO number, description, vendor)
  - Filter by: Organization, Requestor, Approver, Vendor, Department, Site, Vehicle, Project Category, Expense Type
  - Date range filters (Created, Required, Last Updated)
  - Amount range filters
  - Urgency filters
  - Active filter chips with clear all option
- **Search Results Analytics**:
  - Transaction count
  - Total transaction value
  - Average transaction value
  - Real-time updates
- **Export to CSV**: Export filtered results with analytics summary
- **Complete Metrics Display**:
  - Total PRs, Urgent PRs, Avg Days Open, Overdue PRs
  - Quotes Required, Adjudication Required, Customs Required
  - Completion Rate percentage
- **Enhanced Table View**:
  - Urgency column with visual indicators
  - Resubmitted date column
  - Visual separation of urgent items
  - Days open highlighting

### Approval Workflow Features
- **Dual Approval Workflow**: Above Rule 2 threshold requires TWO Level 2 approvers
  - Concurrent approval (both notified simultaneously)
  - Can act in any order
  - Status tracking (1 of 2, 2 of 2)
  - Either can reject to stop process
- **Approval Justification**: Required for 3-quote scenarios
  - "Value for Money" default option for lowest quote
  - Custom justification required for non-lowest quote
  - Both approvers must justify in dual-approval
  - Justifications permanently stored

### Document Management (APPROVED & ORDERED Status)
- **APPROVED Status (PO)**:
  - Proforma invoice upload or override with justification
  - Proof of Payment upload or override with justification
  - Estimated Delivery Date (ETD) - required for all POs
  - Validation before moving to ORDERED
  - Inter-team notifications (Finance ↔ Procurement)
  - Automatic PO document generation
- **ORDERED Status**:
  - Delivery note upload
  - Delivery photos upload (multiple)
  - Override options with justification
  - Automated vendor approval on satisfactory completion
  - Delivery delay notifications (3 days after ETD)

### Vendor Management Features
- **Automated Vendor Approval**:
  - Auto-approve on satisfactory order completion
  - 12 months for 3-quote process orders
  - 6 months for other completed orders
  - Manual override option for issues
  - Approval expiry tracking
- **Vendor Approval Expiry System**:
  - Daily automated check for expired approvals
  - Auto-deactivation of expired vendors
  - Email notifications to Procurement
  - No perpetual approvals
- **High-Value Vendor Rules**:
  - Classification based on cumulative order value
  - Stricter approval duration limits
  - Requires 3-quote process or manual override
  - Special handling in expiry system
- **Vendor Details Page**:
  - Complete vendor information
  - Approval status and expiry date
  - High-value vendor badge
  - Associated PRs/POs list
  - Manual approve/de-approve with justification
  - Document uploads (bank letter, corporate docs)

### Automated Notifications
- **Daily Reminders** (8:00 AM):
  - Procurement: PRs in SUBMITTED/IN_QUEUE, POs in APPROVED/ORDERED
  - Approvers: PRs in PENDING_APPROVAL
  - Requestors: PRs in REVISION_REQUIRED
  - Finance/Admin: POs in APPROVED
  - Asset Management: POs in ORDERED
- **Urgent Reminders** (3:00 PM):
  - For items pending > 2 business days
  - "URGENT" prefix in subject line
  - Escalated frequency
- **Delay Notifications**:
  - Automatic alert when ORDERED > 3 days after ETD
  - Sent to all stakeholders

### Additional Features
- **PR Resurrection**:
  - REJECTED PRs: Procurement/Admin can restore to highest previous status
  - CANCELED PRs: Requestor/Admin can restore to SUBMITTED
  - Full history tracking
  - Automatic notifications
- **Urgency Management**:
  - Role-based change restrictions
  - SUBMITTED/IN_QUEUE: Locked at requestor's setting
  - PENDING_APPROVAL onward: Procurement can change
  - APPROVED onward: Procurement and Approvers can change
  - Administrator: Can always change
- **Procurement User Management**:
  - Level 3 can create/edit/delete/activate/deactivate Level 5 users only
  - Cannot modify Level 1-4 users
  - Purpose: Day-to-day user onboarding/offboarding

### Admin Features
- **User Management**: Complete user lifecycle management with role-based restrictions
- **Organization Configuration**:
  - Email addresses (Procurement, Asset Management, Admin)
  - Business rules (Rule 1 & 2 thresholds)
  - Vendor approval durations (3-quote, completed, manual)
  - High-value vendor rules (multiplier, max duration)
  - Currency settings
  - Time zone configuration
- **Reference Data Management**:
  - Departments, Sites, Vehicles, Project Categories, Expense Types
  - Currencies, UOM, Vendors
  - CRUD operations with validation
  - Organization-specific filtering
  - Active/Inactive status tracking

### Reference Data Management
- CRUD operations for all reference data types (directly in Firestore)
- Code-based ID generation for currencies and UOM
- Duplicate prevention for codes
- Active/Inactive status tracking
- **Note**: CSV files in project root are archival only. Firestore is the source of truth.
- Organization-specific data filtering
- Vendor approval tracking and expiry management

## Technical Stack

### Frontend
- React with TypeScript
- Tailwind CSS for styling
- Shadcn UI components
- Redux for state management
- React Router for navigation

### Backend
- Firebase
  - Authentication
  - Firestore Database
  - Storage
  - Functions
- Express.js for API endpoints

### Development Tools
- Vite for development and building
- ESLint for code linting
- PostCSS for CSS processing

## Project Structure
```
src/
├── components/     # React components
│   ├── admin/     # Admin-specific components
│   ├── common/    # Shared components
│   ├── pr/        # PR-specific components
│   └── ui/        # UI components
├── config/        # Configuration files
├── hooks/         # Custom React hooks
├── lib/          # Utility libraries
├── scripts/      # Database scripts
├── services/     # API services
├── store/        # Redux store
├── styles/       # Global styles
└── types/        # TypeScript types
```

## Recent Updates (October 2025)

### Major Feature Release - Specifications Alignment
This release aligns the codebase with the comprehensive specifications document, adding extensive new features:

**Dashboard Enhancements**:
- MY ACTIONS personalized filtering button
- Advanced search panel with 15+ filter criteria
- Search results analytics and CSV export
- Complete metrics dashboard with 8 key indicators

**Approval Workflow**:
- Dual approver concurrent approval for high-value PRs
- Approval justification system for 3-quote scenarios
- Enhanced approval history tracking

**Document Management**:
- APPROVED status: Proforma, PoP, ETD management with overrides
- ORDERED status: Delivery documentation and vendor performance tracking
- Automated PO document generation

**Vendor Management**:
- Automated vendor approval on satisfactory order completion
- Vendor approval expiry system with daily checks
- High-value vendor classification and rules
- Enhanced vendor details page

**Automated Systems**:
- Daily reminder notifications (8 AM & 3 PM for urgent)
- Delivery delay detection and alerts
- Vendor expiry checks and notifications

**Additional Features**:
- PR resurrection for REJECTED and CANCELED items
- Role-based urgency management
- Procurement limited user management
- Organization configuration UI

See `Specifications.md` and `PR_WORKFLOW_FLOWCHART.md` for complete feature documentation.

## Getting Started

### Prerequisites
- Node.js >= 16
- npm >= 8
- Firebase project

### Installation
1. Clone the repository
```bash
git clone https://github.com/yourusername/pr-system.git
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
```bash
cp .env.example .env
```
Edit `.env` with your Firebase configuration.

4. Start the development server
```bash
npm run dev
```

## Deployment

### Database Migration
Before deploying new features, run the data migration:

```bash
# IMPORTANT: Create backup first!
# In Firebase Console: Firestore > Import/Export > Export

# Run migration script
cd scripts
npx ts-node migrate-data-model-v2.ts
```

See `scripts/MIGRATION_README.md` for detailed migration instructions.

### Firebase Functions Deployment
Deploy the new scheduled functions for automated notifications and vendor expiry:

```bash
cd functions
npm install
firebase deploy --only functions
```

**New Cloud Functions**:
- `dailyVendorExpiryCheck`: Daily at 1:00 AM - checks vendor approval expiry
- `dailyReminders`: Daily at 8:00 AM - sends reminders to users with pending actions
- `urgentReminders`: Daily at 3:00 PM - sends urgent reminders for overdue items
- `deliveryDelayCheck`: Daily at 9:00 AM - checks for delayed deliveries

### Environment Configuration

1. **Organization Settings**: Configure each organization in Admin Dashboard > Organization Settings:
   - Procurement email address
   - Asset Management email address
   - Admin email address
   - Vendor approval durations
   - High-value vendor rules

2. **SendGrid Configuration** (for email notifications):
   ```bash
   firebase functions:config:set sendgrid.api_key="YOUR_SENDGRID_API_KEY"
   ```

3. **Firebase Security Rules**: Ensure Firestore rules are deployed:
   ```bash
   firebase deploy --only firestore:rules
   ```

### Post-Deployment Checklist
- [ ] Database migration completed successfully
- [ ] All Firebase Functions deployed
- [ ] Organization settings configured
- [ ] SendGrid API key set
- [ ] Test MY ACTIONS button for different user roles
- [ ] Test dual approval workflow
- [ ] Test document uploads
- [ ] Verify scheduled functions running (check Firebase Console > Functions > Logs)

## Recent Changes

### October 12, 2025 - Email Notifications & PR Number Country Codes
**Critical Bug Fixes:**
- ✅ **Email Notifications**: Now show human-readable names instead of database IDs
  - Department: "C Level" instead of "TMEl8lYYpw370XGQLW7J"
  - Site: "1PWR Headquarters" instead of "1pwr_headquarters"
  - Vendor: Actual vendor name instead of numeric ID like "1010"
- ✅ **PR Number Format**: Now includes proper country codes
  - Lesotho: `-LS` (e.g., 251012-5338-1PL-LS)
  - Benin: `-BN` (e.g., 251012-5338-1PB-BN) - using BN instead of BJ
  - Zambia: `-ZM` (e.g., 251012-5338-1PZ-ZM)

**Impact:** Email notifications are now professional and readable. PR numbers clearly identify country/location.

**Documentation:** See [docs/EMAIL_NOTIFICATION_FIX_2025-10-12.md](docs/EMAIL_NOTIFICATION_FIX_2025-10-12.md)

---

### October 12, 2025 - Data Retrieval & Performance Fix
**Critical Bug Fixes:**
- ✅ **Performance Improvement**: Removed excessive console.log statements causing slowdowns
- ✅ **Preferred Vendor Field**: Fixed missing field in PR retrieval - now displays correctly
- ✅ **Vehicle Field**: Fixed missing field in PR retrieval - now displays correctly
- ✅ **Required Date**: Fixed date string handling - now displays correctly
- ✅ **UOM Display**: Verified proper labels (e.g., "Pieces" instead of "PCS")

**Impact:** All fields are now being saved AND retrieved correctly. Existing PRs will display properly after browser refresh.

**Documentation:** See [docs/PR_DATA_RETRIEVAL_FIX_2025-10-12.md](docs/PR_DATA_RETRIEVAL_FIX_2025-10-12.md)

---

## Testing
See `TESTING_CHECKLIST.md` for comprehensive testing guidelines covering all features.

## Contributing
1. Create a feature branch
2. Make your changes
3. Submit a pull request

## License
Proprietary - All rights reserved
