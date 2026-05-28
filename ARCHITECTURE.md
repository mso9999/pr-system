# PR System Architecture

## System Overview
The PR System is a web-based purchase request management application built on React and Firebase. It enables organizations to create, track, and manage purchase requests through a defined workflow.

## Core Components

### Frontend Architecture
- **React + TypeScript**: Core UI framework
- **Material-UI**: Component library for consistent design
- **Redux Toolkit**: State management
- **React Router**: Navigation and routing

### Backend Services (Firebase)
- **Authentication**: User management and role-based access
- **Firestore**: NoSQL database for PR data
- **Cloud Functions**: Backend business logic
- **Cloud Storage**: Document and attachment storage

## Data Model

### Collections
1. `purchaseRequests`
   - Core PR data
   - Status tracking
   - Approval chains
   - Timestamps and metadata

2. `users`
   - User profiles
   - Role assignments
   - Organization affiliations

3. `organizations`
   - Organization settings
   - PR number sequences
   - Approval workflows

## Key Workflows

### Purchase Request Lifecycle
1. Creation
   - PR number generation
   - Initial data validation
   - Attachment processing

2. Approval Process
   - Multi-level approvals
   - Status transitions
   - Notification triggers

3. Completion
   - Final processing
   - Document archival
   - Metrics calculation

## Directory Structure

```
src/
├── components/     # React components
│   ├── auth/      # Authentication components
│   ├── pr/        # PR-related components
│   └── common/    # Shared components
├── config/        # Configuration files
├── hooks/         # Custom React hooks
├── services/      # Firebase service interfaces
├── store/         # Redux store configuration
├── types/         # TypeScript type definitions
└── utils/         # Utility functions
```

## Security Model

### Firebase Security Rules
- Document-level security
- Role-based access control
- Organization-level isolation

### Authentication Flow
1. User signs in
2. Profile data fetched
3. Role permissions applied
4. Session management

## Integration Points

### External Services
- Email notifications via Firebase Functions
- File storage in Cloud Storage
- Optional spreadsheet export

### API Endpoints
All API endpoints are implemented as Firebase Functions:
- `sendPRNotification`: Notification dispatch
- `generatePRNumber`: Sequence generation
- `exportToSpreadsheet`: Data export

## Performance Considerations

### Optimization Strategies
- Firestore query optimization
- React component memoization
- Lazy loading of routes
- Attachment size limits

## Business Rules

### Processing Rules (src/services/pr.ts)
- **Quote Requirements**: Threshold-based quote validation (Rules 1-2)
- **Dual Approval**: PRs above Rule 2 threshold require two independent approvers
- **Approved PO Cap**: Organizations are limited to 25 approved but un-actioned POs. Attempting to push a PR to `PENDING_APPROVAL` while the organization has ≥25 `APPROVED` POs triggers a blocking warning dialog. Resolution requires moving approved POs to `ORDERED`, `COMPLETED`, `REJECTED`, or `CANCELED`.

### Validation (src/utils/prValidation.ts)
- Pre-status-change validation for quote counts, payment type, approver assignment
- Amount rescinding checks (>5% upward, >20% downward triggers re-approval)

## Error Handling

### Strategy
1. Client-side validation
2. Network error recovery
3. Optimistic updates
4. Fallback UI states

## Monitoring and Logging

### Tools
- Firebase Analytics
- Error tracking
- Performance monitoring
- Usage analytics
