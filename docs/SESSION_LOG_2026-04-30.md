# Session Log — April 27–30, 2026

## Summary

Two-day operational session: fixed three production bugs reported by users
(Unit Price greyed out for Procurement, "Generate PO" not picking up line
item totals, and "Failed to create user" with no useful error), reconciled
an orphan Firebase Auth account, and stood up a system to detect and
prevent Auth ↔ Firestore profile drift in the future. Also resolved a
Firestore-rejects-`undefined` failure in the PO Amendment path.

---

## Bug 1: Unit Price greyed out for Procurement on a Zambia PR

### Symptom
Eduardo (1PWR Zambia procurement) saw the Unit Price column on the line
items table disabled and could not enter quoted prices. Phoka had typed
the prices into the **Notes** column as a workaround, which made it look
like values had "moved" from Unit Price to Notes.

### Root cause
The Unit Price `disabled` predicate in `PRView.tsx` allowed editing only
when the PR was in `IN_QUEUE`, `PENDING_APPROVAL`, or `APPROVED`. The PR
in question was still in `SUBMITTED` (Procurement hadn't clicked Receive
yet), so the field was locked for everyone — including Procurement and
Admin. There was no field-swap bug; each cell input had its own dedicated
`onChange`. Phoka had simply used Notes as a workaround.

Both Eduardo (`permissionLevel: 3`, primary org `1pwr_zambia`) and Phoka
(`permissionLevel: 3`, Zambia in `additionalOrganizations`) have
identical privileges on Zambia PRs. There was no permission gap to fix
— only the status whitelist on the field.

### Fix
Extended the status whitelist for Procurement/Admin to include
`SUBMITTED`, `RESUBMITTED`, and `REVISION_REQUIRED`, so prices can be
captured before the PR is formally received.

### Files Changed
- `src/components/pr/PRView.tsx` — extended `disabled` predicate on the
  Unit Price `<TextField>`.

Commit `1117208` (deployed Apr 27).

---

## Bug 2: "Generate PO" totals come out as 0

### Symptom
On a 1PWR Zambia PR with 23 line items totalling ~1.3M ZMW, the PO
Review dialog showed Grand Total as 0 and triggered the price-discrepancy
warning ("DISCREPANCY: Final price exists but no line item pricing to
validate").

### Root cause
`POReviewDialog.tsx` summed `item.totalAmount`:

```ts
const subtotal = lineItems.reduce(
  (sum, item) => sum + (item.totalAmount || 0), 0
);
```

That field exists only on `pr.lineItemsWithSKU` (the structured PO
collection). When falling back to `pr.lineItems` (the standard collection
edited in `PRView`), every row's `totalAmount` was `undefined → 0`.
`PODocument.tsx` (the PDF) had the right fallback (`quantity × unitPrice`)
but the dialog math didn't.

### Fix
Added a `lineRowTotal()` helper in `POReviewDialog.tsx` that prefers an
explicit positive `totalAmount` and otherwise computes
`quantity × unitPrice` (with `estimatedUnitPrice` as a final fallback).
Restored correct subtotal/tax/duty/grand-total math and removed the
spurious discrepancy warning.

### Files Changed
- `src/components/pr/POReviewDialog.tsx`

Commit `32095df` (deployed Apr 27).

---

## Bug 3: "Failed to create user" — the orphan Auth account

### Symptom
Motebang (User Administrator, level 8) couldn't create user
`monoane@1pwrafrica.com` (Sello Monoane). The dialog showed only a
generic "Failed to create user" toast.

### Root cause
A Firebase Auth account already existed for `monoane@1pwrafrica.com` —
created Jan 17, 2025 (last sign-in Apr 27, 2026 — Sello had been
authenticating but had no Firestore profile, so the app couldn't load
his role/org/department). When Motebang clicked ADD, the cloud function
called `admin.auth().createUser({ email: ..., ... })` which threw
`auth/email-already-exists`, and the catch block converted **every**
failure into a generic `internal/Failed to create user`.

The orphan itself dated from a Jan-17-2025 bulk import that wrote Auth
accounts but never wrote matching `users/<uid>` documents.

### Fixes shipped
1. **`createUser` cloud function — rollback + better errors**
   (`functions/src/createUser.ts`, commits `7d3d2c0`, `990a5f9`):
   - If the Auth account is created but anything afterwards fails (custom
     claims, Firestore write), the function now deletes the Auth user
     before re-throwing. Logs `CRITICAL: failed to roll back orphan Auth
     user <uid>` if the rollback itself fails.
   - Maps `auth/email-already-exists`, `auth/invalid-email`,
     `auth/invalid-password`, `auth/weak-password` to specific
     `HttpsError`s with actionable messages, so the admin UI surfaces
     "This email is already registered in Firebase Authentication.
     Remove or rename the existing account, or use a different email."
     instead of "Failed to create user."
2. **Client-side error mapping** (`src/services/auth.ts`, this commit):
   `messageFromCallableError()` extracts the message/details/code from
   the `HttpsError` thrown by the callable and surfaces it on the toast,
   so the user sees the message the function actually emits.
3. **Reconcile Sello's profile**
   (`scripts/reconcile-firestore-user.ts`, commit `7d3d2c0`):
   Wrote `users/0xQWUnRSAxOcchfwLRP9eApE9J82` under his existing Auth
   UID with the values from Motebang's form (1PWR LESOTHO, O&M, level 5,
   active). Custom claim `permissionLevel: 5` set on the Auth user.
   Sello kept his password.

---

## Housekeeping: Auth ↔ Firestore drift

### Audit (Apr 29)
Ran `scripts/audit-user-sync.ts` and the new `inspect-auth-orphans.ts`:

| | Count |
|---|---|
| Properly synced (UIDs match) | 114 |
| Auth orphans (no Firestore profile) | 127 |
| Firestore orphans (no Auth) | 0 |
| Email mismatches | 0 |

Of the 127 Auth orphans:
- **113 had no email and empty `providerData`** — anonymous Firebase
  Auth sessions belonging to the **1PWR AM** project that shares this
  Firebase project. Sign-ins on these accounts are recent (some today).
  **Hands off** — deleting would break the AM app.
- **14 had real-looking emails**:
  - 4 corporate `1pwrafrica.com` accounts from a Jan-17-2025 bulk import
    (never signed in)
  - 1 legacy custom-UID account (`legacy_makoanyane_1pwrafrica_com`)
  - 2 `*@example.com` test accounts
  - 7 signed-in real humans (Gmail/dual-domain) that need a human
    decision (see "Outstanding" below)

### Reference safety check
`scripts/check-uid-references.ts` scanned 1,158 PRs + 9,413 archive PRs
+ 5,686 notifications + 12,760 notification logs (29,017 docs) — **zero**
references to any orphan UID. Safe to delete the genuinely stale ones
without breaking referential integrity.

### Cleanup executed
- Reconciled `monoane@1pwrafrica.com` (Sello) under existing Auth UID.
- Deleted **7 unambiguously stale Auth accounts**:
  - `approver@example.com`, `test@example.com` (test)
  - `bohloko@1pwrafrica.com`, `thabang.hatlane@1pwrafrica.com`,
    `tumelo.tshabalala@1pwrafrica.com`, `olivier@1pwrbenin.com`,
    `makoanyane@1pwrafrica.com` (`legacy_…` uid). All never signed in.

Post-cleanup baseline: 115/115 Firestore profiles synced; 0 Firestore
orphans; 7 signed-in Auth orphans remaining for human decision.

### Prevention shipped
Three new cloud functions live in `us-central1` (commit `990a5f9`):

| Function | Purpose |
|---|---|
| **`weeklyUserSyncAudit`** | Pub/Sub schedule, Mondays 06:00 Africa/Maseru. Compares Auth ↔ Firestore (skipping anonymous accounts), writes a snapshot to `auditLogs/userSync_<ts>`, emails active level-1/level-8 admins **only on drift**. |
| **`runUserSyncAudit`** | Callable HTTPS, level-1/level-8 only. On-demand version of the same audit. |
| **`authUserCreated`** | `auth.user().onCreate()` trigger. Write-only forensic logger — every non-anonymous Auth account gets a record at `userCreationAudit/<uid>` with provider, email, displayName, creation time. Forensic trail for accounts created via Firebase Console or other scripts. |

### Operator scripts (under `scripts/`, committed `7d3d2c0` / `990a5f9`)
- `audit-user-sync.ts` (existing) — full Auth ↔ Firestore audit
- `inspect-auth-orphans.ts` — classify orphans by provider / sign-in
- `inspect-noemail-orphans.ts` — diagnose NO-EMAIL accounts
- `check-uid-references.ts` — verify a UID isn't referenced in PRs/notifications before deletion
- `cleanup-auth-orphans.ts` — category-based, dry-run-by-default
- `reconcile-firestore-user.ts` — write `users/<uid>` under an existing Auth UID
- `lookup-user-by-email.ts`, `check-auth-by-email.ts`,
  `lookup-department.ts`, `list-admins.ts`, `run-user-sync-audit-local.ts`

### Outstanding (need a human decision)
Seven signed-in Auth orphans were intentionally **not** touched:

| Email | UID | Last sign-in | Likely action |
|---|---|---|---|
| `thabang@1pwrafrica.com` | `BPbSmSDxKlf9hWuk2JiDtYQOzMT2` | Jul 30 2025 | Probable duplicate of `thabang.hatlane@…` (deleted) — confirm + delete |
| `bokangleqele7@gmail.com` | `oK9qdsdh68MeutGZy0ffcr87A3X2` | Oct 9 2025 | Decide which of 7/9 is real |
| `bokangleqele9@gmail.com` | `Wn2jZT6tfVQiRfQ4P4WeDWDH4Ep2` | Oct 13 2025 | (displayName: "Bokang Leqele (Test)") |
| `thabanghatlane.tdh@gmail.com` | `TtV5R8yKyhYKx0bkXU3ASmGbfFd2` | Oct 13 2025 | Auth displayName says "Arnold Coetzee" — investigate identity |
| `bonzys@gmail.com` | `lTN5klG9RsbGNM7NnAzEO8I99cd2` | Sep 14 2025 | Reconcile (org/dept/level needed) or delete |
| `malefaneedgar@gmail.com` | `FTzIwyU3c9NAwl79LkTeqr6kKq63` | Sep 10 2025 | Same |
| `sosoh@gmail.com` | `IrvBRGj2WMZDlSXIuG24fhpNKXt2` | Sep 10 2025 | Same |

Use `scripts/cleanup-auth-orphans.ts --uids <uid> --yes` to delete or
`scripts/reconcile-firestore-user.ts` to reconcile.

---

## Bug 4: PO Amendment fails with "Unsupported field value: undefined"

### Symptom
Submitting a PO Amendment showed:

> Function updateDoc() called with invalid data. Unsupported field value:
> undefined (found in field pendingAmendment.changes.submittedBy in
> document purchaseRequests/JukIxju5WVzli7Mbk53)

### Root cause
`submitAmendment()` writes the entire PR-shaped `changes` object into
`pendingAmendment.changes`. `changes` comes from `buildUpdatedPR()` in
`PRView.tsx` which spreads `...pr` + `...editedPR`, so every optional
field on the PR (`submittedBy`, `vendor`, `attachments`, …) is carried
into the payload. Any `undefined` value in that copy makes Firestore
reject the entire `updateDoc`.

### Fix
Added `stripUndefinedDeep()` in `src/services/pr.ts` and applied it
everywhere the amendment is persisted:
- `submitAmendment` (initial write)
- `resolveAmendment` (partial dual-approval write)
- `finalizeAmendment` (apply path on approval)

The helper is also a useful primitive for any future code that stores
React-state-derived PR snapshots into Firestore.

### Files Changed
- `src/services/pr.ts`

Commits `ba4a61c`, `2cfc3b4` (the second commit added the missing
`src/utils/prOrgCountryCodes.ts` helper that `pr.ts` imports — it was
in the working tree but never committed; my amendment fix was the first
commit this session that made CI try to resolve that import).

---

## One-shot operational scripts (committed in this session)

- **`functions/addEngineeringDepartment.mjs`** — adds a generic
  "Engineering" department under 1PWR LESOTHO so users tagged with the
  umbrella `Engineering` value resolve on the HR mirror. Idempotent
  upsert by `(organizationId, name)`.
- **`functions/mergeSoftwareEngineering.mjs`** — renames existing
  "Electrical Engineering" department docs to "Electrical & Software
  Engineering" with code `EE/SE` and adds an `aliases` array so
  legacy "Software Engineering" tags resolve to the same bucket.
  Idempotent.
- **`src/scripts/backfill-pr-xx-country-codes.ts`** — fixes PR numbers
  that contain `-XX` (unresolved country segment) by re-deriving the
  country from the static org map, falling back to the
  `referenceData_organizations.country` field. Run with `--apply` to
  write changes; default is dry run. Wired up as `npm run backfill-pr-xx-country`.
- **`src/utils/organization.ts`** — added 4 aliases
  (`inclusive_mionwa`, `inclusive mionwa`, `mionwa_inclusive`,
  `mionwa inclusive`) all normalizing to `mgb`, so user-typed variants
  resolve correctly.

---

## Tooling outputs

- `auditLogs/userSync_<ts>` — written by every run of the cloud-side
  audit (scheduled or callable). Contains totals + the orphan/mismatch
  arrays.
- `userCreationAudit/<uid>` — appended by `authUserCreated` whenever a
  non-anonymous Auth user is created.
- `scripts/uid-reference-report.json` — local dry-run output from
  `check-uid-references.ts`. Now gitignored.

---

## Deployments

| Commit | What | Where |
|---|---|---|
| `1117208` | Unit Price gating | hosting |
| `32095df` | PO dialog totals | hosting |
| `7d3d2c0` | createUser rollback + better errors | functions/createUser |
| `990a5f9` | weekly audit + onCreate logger | functions/weeklyUserSyncAudit, runUserSyncAudit, authUserCreated |
| `ba4a61c` | amendment `undefined` fix | hosting (failed first attempt) |
| `2cfc3b4` | landed missing `prOrgCountryCodes.ts` | hosting (green) |

---

## Known follow-ups (not done in this session)

1. Decide on the 7 remaining signed-in Auth orphans listed above.
2. Optional: a small admin UI page that calls `runUserSyncAudit` and
   renders the result, so admins don't need email to spot-check sync
   status.
3. (Pre-existing) `firebase-functions` SDK is on 4.9.0; warns about
   missing 5.1.0+ features. Node.js 20 runtime deprecation also pending
   (decommission Oct 31, 2026).
