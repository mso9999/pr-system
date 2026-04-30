# PR System - Project Context

## Overview

Multi-organization Purchase Request (PR) / Purchase Order (PO) management system for 1PWR Africa and related entities. React frontend deployed to Firebase Hosting, backed by Firestore, Firebase Auth, Firebase Storage, and Cloud Functions.

**Production URL**: https://pr-system-4ea55.web.app
**Firebase Project**: `pr-system-4ea55`
**Hosting URL**: https://pr-system-4ea55.firebaseapp.com

## Tech Stack

- **Frontend**: React 18 + TypeScript, Vite, Material UI, Redux (state), i18n
- **Backend**: Firebase Firestore (database), Firebase Auth, Firebase Storage, Cloud Functions (Node.js)
- **Email**: SendGrid (notifications on status changes)
- **Deployment**: Firebase Hosting, GitHub Actions CI/CD
- **Node**: Build requires system Node; scripts using `firebase-admin` require Node 18 (via nvm) due to `buffer-equal-constant-time` incompatibility with Node 25

## Organizations

The system serves multiple organizations, each with their own rules, departments, currencies, and approvers:
- 1PWR Lesotho (LSL currency)
- 1PWR Zambia (ZMW currency)
- 1PWR Benin (XOF currency)
- Neo1, PUECO Lesotho, PUECO Benin, SMP, MGB (Mionwa Generation)

Organization IDs are normalized (e.g., `1pwr_zambia`) with an alias map handling variants.

## PR Status Workflow

```
DRAFT → SUBMITTED → IN_QUEUE → PENDING_APPROVAL → APPROVED → ORDERED → COMPLETED
                                      ↓                          
                              REVISION_REQUIRED → RESUBMITTED → (re-enters at SUBMITTED)
                                      ↓
                                   REJECTED / CANCELED
```

**Key transitions**:
- **SUBMITTED → IN_QUEUE**: Procurement receives the PR
- **IN_QUEUE → PENDING_APPROVAL**: Procurement assigns PO number, validates quotes, sets approvers. Dual approval is computed here (Rule 3 threshold check with currency conversion)
- **PENDING_APPROVAL → APPROVED**: Approver(s) approve. Single or dual approval depending on amount vs Rule 3 threshold
- **APPROVED → ORDERED**: Procurement manages PO documents, proforma, proof of payment
- **ORDERED → COMPLETED**: Delivery confirmed with photos/documents

## Dual Approval System

PRs exceeding the Rule 3 threshold (organization-specific, in base currency) require two approvers:
- `approver` (first approver) and `approver2` (second approver) are set on the PR
- `requiresDualApproval` (top-level boolean) is the authoritative flag
- `approvalWorkflow` object tracks: `firstApprovalComplete`, `secondApprovalComplete`, `requiresDualApproval`, selected quotes per approver, justifications, and conflict resolution
- Either approver can approve first; order doesn't matter
- If both select different quotes → quote conflict (red-flagged, must resolve)
- Both must approve before status moves to APPROVED

## Organization Reassignment (Superadmin Only)

Superadmins (permissionLevel 1) can reassign a PR/PO to a different organization from the PR view:
- **UI**: Swap icon next to the organization field in the "Additional Information" section. Opens a dialog with org selector + required reason field.
- **Service**: `reassignOrganization()` in `src/services/pr.ts` handles:
  - Rewriting PR number org/country segments (e.g., `1PL-LS` becomes `SMP-LS`) using shared `getOrgCodes()` helper
  - Validating approvers against the new org's approver list via `approverService.getApprovers()`
  - If approvers are invalid: clears both, resets approval workflow, reverts status to `IN_QUEUE`
  - Recording the full change in `statusHistory` (old/new org, old/new PR number, reason, approver/status changes)
- **Org code maps**: `ORG_CODE_MAP` and `COUNTRY_CODE_MAP` are module-level constants in `pr.ts`, shared by both `generatePRNumber()` and `getOrgCodes()`

## Key Architecture Decisions

### Status Updates
- `updatePRStatus()` handles status field + statusHistory (append-only audit log). Used for all status transitions.
- `updatePR()` handles all other field updates. Strips `status` if present (must use `updatePRStatus` for status changes).
- `getPR()` maps Firestore document fields to `PRRequest` type. Any new Firestore field must be added to this mapping or it will be `undefined` at runtime.

### Currency Conversion
- Live exchange rates fetched at threshold-check time via `convertAmountWithMetadata()`
- Exchange rate audit trail saved on PR for accountability
- Organization's `baseCurrency` is the canonical threshold comparison currency

### Firebase Shared Project Warning
The Firebase project `pr-system-4ea55` is shared with the `1PWR AM` (Asset Management) project. **Never deploy Firestore security rules from one project without coordinating** — restrictive rules from AM have broken PR system permissions in the past.

## File Structure (Key Paths)

```
src/
├── components/
│   ├── pr/                    # PR lifecycle components
│   │   ├── PRView.tsx         # Main PR view (massive, handles all statuses)
│   │   ├── ApproverActions.tsx # Approve/reject/revise actions + dual approval
│   │   ├── ProcurementActions.tsx # IN_QUEUE → PENDING_APPROVAL transition
│   │   ├── ApprovedStatusActions.tsx # Post-approval PO management
│   │   ├── OrderedStatusActions.tsx  # Delivery tracking
│   │   ├── NewPRForm.tsx      # PR creation form
│   │   ├── ExternalApprovalBypass.tsx # Budget doc bypass for approval
│   │   └── steps/             # Form wizard steps
│   ├── dashboard/
│   │   └── Dashboard.tsx      # Main dashboard with status filtering
│   ├── admin/                 # Admin panels (users, reference data, orgs)
│   └── common/                # Shared components (ErrorBoundary, FileUpload, etc.)
├── services/
│   ├── pr.ts                  # Core PR CRUD (getPR, updatePR, updatePRStatus, reassignOrganization)
│   ├── auth.ts                # Firebase Auth
│   ├── referenceData.ts       # Rules, departments, vendors, payment types
│   ├── organizationService.ts # Organization config and base currency
│   ├── notification.ts        # Email notifications via Cloud Functions
│   └── approver.ts            # Approver assignment logic
├── types/
│   └── pr.ts                  # All PR-related types and enums
├── utils/
│   ├── prValidation.ts        # PR validation for approval (threshold checks)
│   └── currencyConverter.ts   # Live exchange rate fetching
├── config/
│   └── firebase.ts            # Firebase init with multi-tab persistence
└── scripts/                   # Admin/maintenance scripts (run with tsx + Node 18)
```

## Permission Levels

| Level | Role | Can Approve | Can Process (Procurement) |
|-------|------|-------------|--------------------------|
| 1 | Admin | Yes (any amount) | Yes |
| 2 | Senior Approver | Yes (any amount) | No |
| 3 | Procurement | No | Yes |
| 4 | Finance Admin | Yes | No |
| 5 | Standard User | No | No |
| 6 | Finance Approver | Yes | No |

## Deployment

```bash
npm run build                    # Vite build to dist/
firebase deploy --only hosting   # Deploy (requires Node 18 for firebase-tools)
```

For admin scripts:
```bash
source "$HOME/.nvm/nvm.sh" && nvm use 18
npx tsx src/scripts/<script>.ts
```

Service account key: `pr-system-4ea55-firebase-adminsdk-f3uff-2cec628657.json` (project root, gitignored)

## Known Patterns & Pitfalls

1. **getPR() field mapping**: Every Firestore field must be explicitly mapped in `getPR()` (src/services/pr.ts lines 152-315). Missing mappings cause `undefined` at runtime — this was the root cause of the dual approval bypass bug.
2. **Double status writes**: `ApproverActions.handleSubmit()` had a bug where the approve case handled its own `updatePRStatus` internally, then the generic code after the switch called `handleStatusUpdate()` again. Fixed by skipping `handleStatusUpdate` for approve actions.
3. **getDocFromServer failures**: Network hiccups cause `getDocFromServer` to throw. `getPR()` now falls back to `getDoc()` (cached) when server fetch fails.
4. **Firestore rules conflicts**: The shared Firebase project means rules deployed from `1PWR AM` can break `PR System` access. Always coordinate.
5. **Node version**: `firebase-admin` SDK and `firebase-tools` CLI require Node 18. System Node (v25) breaks `buffer-equal-constant-time`.
6. **Org code maps**: `ORG_CODE_MAP` and `COUNTRY_CODE_MAP` in `pr.ts` must be updated when new organizations are added. These drive PR number generation and org reassignment.
7. **Temp storage bloat**: `StorageService.uploadToTempStorage()` puts all files in `temp/`. `moveToPermanentStorage()` exists but is never called in the PR attachment workflow. As of April 2026, 96.6% of Storage (390 MB / 1,199 files) is orphaned temp files. A cleanup script and/or lifecycle policy is needed.
8. **Notification log growth**: `notificationLogs` (10k+) and `notifications` (4.5k+) grow indefinitely with no TTL or archival. Consider periodic cleanup or Firestore TTL policies.
9. **Firestore rejects `undefined`**: `updateDoc` will fail the entire write if any field value is `undefined` (e.g. *"Unsupported field value: undefined (found in field pendingAmendment.changes.submittedBy …)"*). When persisting PR-shaped objects from React state, run them through `stripUndefinedDeep()` (defined in `src/services/pr.ts`) first. The amendment path already does this; new code paths that store partial PR snapshots must do the same.
10. **Auth ↔ Firestore user drift**: Auth accounts are created independently of `users/<uid>` profiles. The `createUser` cloud function now rolls back the Auth account on Firestore failure, but accounts created via Firebase Console or older bulk-import scripts won't go through it. The shared Firebase project also produces ~110+ legitimate **anonymous** Auth accounts (no email, no provider data) belonging to the `1PWR AM` app — never delete them. Use `scripts/run-user-sync-audit-local.ts` for ad-hoc audits; the deployed `weeklyUserSyncAudit` runs every Monday 06:00 SAST and emails active level-1/level-8 admins on drift.
11. **`pendingAmendment.changes` is a full PR snapshot**: `submitAmendment()` stores a complete `Partial<PRRequest>` (everything in `buildUpdatedPR()`) under `pendingAmendment.changes`, not just the diff. The diff is computed lazily by `computeAmendmentDiff()` when the amendment is finalized. Callers should not assume `pendingAmendment.changes` only contains modified fields.
