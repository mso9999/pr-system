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
- **Authentication**: Emergency fallback only — Nexus (`nexus.1pwrafrica.com`) is the primary Identity Provider via SSO. See "Nexus Integration" below.
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
   - PR-owned profile extension (organization, dept memberships, HR-lead scope)
   - Role assignments (legacy fallback when no nexus_users doc exists)

3. `nexus_users` (owned by Nexus, mirrored by PR)
   - Canonical identity store: `systemAccess.pr.{enabled, permissionLevel, role}`
   - PR reads identity + permissions from here (Phase 2)
   - HR sync writes identity fields via merge (does not clobber other systems' fields)

4. `organizations`
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
- Canonical rules live in `nexus-portal/firestore.rules` (not this repo)
- Document-level security
- Role-based access control
- Organization-level isolation

### Authentication Flow
1. Unauthenticated user hits `PrivateRoute.tsx` → redirected to `https://nexus.1pwrafrica.com/sso/authorize?tool=pr&redirect_uri=<current URL>`
2. Nexus authenticates user, mints Firebase custom token, redirects back with `?sso_token=&from=nexus`
3. `NexusSSOHandler.tsx` consumes token via `signInWithCustomToken`
4. `onAuthStateChanged` fires → `getUserDetails()` reads `nexus_users/{uid}` (canonical identity) + `users/{uid}` (PR profile extension)
5. Role permissions applied, session established
6. **Emergency fallback:** `/login?fallback=1` provides Firebase email/password sign-in (Nexus outage only)

## Nexus Integration

The PR system is a federated tool embedded in the Nexus platform (`nexus.1pwrafrica.com`). Key integration points:

### SSO (Centralized Auth)
- **IdP:** Nexus is the Identity Provider; PR delegates auth to Nexus
- **Flow:** `PrivateRoute.tsx` → Nexus SSO → `NexusSSOHandler.tsx` → Firebase `signInWithCustomToken`
- **Fallback:** Local Firebase email/password at `/login?fallback=1`
- **Files:** `src/components/common/PrivateRoute.tsx`, `src/components/common/NexusSSOHandler.tsx`, `src/components/auth/LoginPage.tsx`

### Identity (Phase 2)
- **Canonical:** `nexus_users/{uid}.systemAccess.pr` — identity + permissions owned by Nexus
- **Extension:** `users/{uid}` — PR-owned profile fields (organization, dept memberships, HR-lead scope)
- **Fallback:** If no `nexus_users` doc exists, falls back to `users/{uid}` legacy path
- **Flag:** `READ_NEXUS_IDENTITY` in `src/services/auth.ts` (set to `true`; flip to `false` to roll back)
- **HR Sync:** `functions/src/hr/hrEmployeeSyncCore.ts` mirrors identity into `nexus_users` with merge writes

### Firestore Rules
- Canonical rules live in `nexus-portal/firestore.rules` (not this repo)
- PR CI deploys **hosting only** — never deploy `firestore:rules` from this repo

### Catalog APIs (consumed by Nexus)
- PR exposes countries, organizations, sites, vendors via `prCatalogApi` Cloud Function
- Nexus and AM consume these endpoints
- Changes to item shapes must be additive only (consumers cache fields)
- See `CROSS_REPO_API_CONTRACT.md` for full API contract

### Cross-Repo References
- `nexus-portal/docs/PR_NEXUS_COEXISTENCE_PLAN.md` — coexistence plan
- `nexus-portal/docs/NEXUS_AUTH_RUNBOOK.md` — auth flow + outage procedure
- `nexus-portal/docs/CANONICAL_DATA_OWNERSHIP.md` — master ownership map
- `CROSS_REPO_API_CONTRACT.md` — API contracts between PR, Nexus, AM, HR, FM

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
