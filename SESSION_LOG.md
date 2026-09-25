# PR System Session Log — BOM Cost Integration

## 2026-09-25 — Cursor — Deployment budget wizard on main
- Cash deployment budget at `/deployment-budget`. Lesotho: LSL, category codes, fuel safety factor 2. Benin: XOF, no codes, fuel safety factor 1. Food is the provisioning wizard or a cash lump. Lodging repeats. PPE, blankets, and tools are annual wear.
- Pushed to `main` so hosting CI deploys it. No functions deploy.
- Side effects: production hosting after the GitHub Action finishes.


## 2026-04-01 — Planning Session (Cowork)

**What happened:**
- Deep exploration of PR system: Firestore schema, PR fields, quote structure, archive data, vendor reference data
- Deep exploration of UGP repo: BOM generator, parts catalog, tech stack
- Created master integration plan at `/AI Projects/BOM_COST_INTEGRATION_PLAN.md`
- Created CONTEXT.md in both repos with cross-references

**Key findings:**
- PRs use free-text descriptions, no part numbers — AI mapping required
- Quotes have vendorId, amount, currencyId, notes — but no incoterms
- Archive PRs from old system have `legacyResponses[]` and `originalData` snapshot
- Vendor master has ~10 entries, all local (Herholdts, LEC, etc.) — no offshore classification
- 30 expense types, relevant ones: "Materials and supplies", "Equipment", "Parts for assets"
- Organization→country mapping is clean and reliable

**Next steps (Phase 0):**
1. Add `incoterm` optional field to PR/quote schema
2. Add vendor origin classification (local/regional/offshore_china/offshore_other)
3. Create `costMappings` Firestore collection schema
4. Extract unique PR descriptions for AI mapping bootstrap

**Decisions made:**
- Incoterm field is optional, inferred from vendor classification for historical records
- Vendor origin stored in reference data, not on individual PRs
- Cloud Function will handle batch export of mapped cost data

## 2026-09-07 — Cursor — Brief 02 procurement read API
- What: Extended `prCatalogApi` with read-only purchase-request, commitment and lead-time endpoints for ugridPREDICT (forecast programme brief 02). Multi-key auth (`HR_API_KEY_PR_PORTAL` / `PR_CATALOG_API_KEY` / `UGRIDPREDICT_API_KEY`), per-consumer 60 req/min burst guard, structured call logs. `/api/vendors` now includes `country`, `origin`, `defaultCurrency`, `incotermDefault`. Added `/api/categories` and `/api/expense-types`.
- Why: Forecast service is a consumer, not a store of record. PR is the only system that knows committed-but-undelivered spend and real vendor lead times. SMP cash model currently has no procurement schedule behind it.
- Schema answers (do not escalate): `orderedAt` / `completedAt` / `estimatedDeliveryDate` / `statusHistory[]` exist on live PRs; no separate PO entity; `archivePRs` excluded from lead times. No AM movements join required.
- Not in this change: AI part-mapping miner (nullable `ugpPartIds[]` / `mappingConfidence` / `mappingSource` exposed only; never overwrite human with AI). No UI or workflow writes.
- Side effects: none yet — functions not deployed. Dedicated `UGRIDPREDICT_API_KEY` still to be written into `functions/.env` at deploy time (existing HR key will work immediately).
- Key files: `functions/src/prCatalogApi.ts`, `functions/src/catalog/*`, `CROSS_REPO_API_CONTRACT.md`, `docs/BRIEF_02_PR_PROCUREMENT_READ_API.md`
- Follow-ups: safe functions deploy (`npm run deploy:functions`); verify `mintSSOToken` survived; provision `UGRIDPREDICT_API_KEY`; commit nexus-portal `CANONICAL_DATA_OWNERSHIP.md` update; AI description→UGP part miner.

## 2026-09-07 — Cursor — Brief 02 functions deploy
- What: Deployed commit `5d36de9` (`cursor/brief-02-procurement-read-api`) via `npm run deploy:functions` (Node 18; 44/44 PR functions updated; no delete list). `prCatalogApi` now 512MB / 60s. Provisioned `UGRIDPREDICT_API_KEY` in `functions/.env` (not committed).
- When / target: 2026-09-07 ~15:02 UTC, Firebase `pr-system-4ea55`, function `prCatalogApi` `https://us-central1-pr-system-4ea55.cloudfunctions.net/prCatalogApi`
- Running state: catalog surface gained `/api/v1/purchase-requests`, `/api/v1/commitments`, `/api/v1/lead-times`, `/api/categories`, `/api/expense-types`; `/api/vendors` additive fields. Existing HR key still accepted.
- Verify:
  - Nexus still live: `mintSSOToken`, `verifyPin`, `nexusAssistant` present; 151 functions listed.
  - 403 without key / junk key; 200 with HR and ugridpredict keys.
  - Live: 1864 PRs, 237 commitment buckets (582 PRs), 391 lead-time groups (top n=222).
  - SMP 2026-08 reconcile PASS: LSL 23444 n=12, USD 11789 n=1, ZAR 14919.66 n=2.
- Side effects: Cloud Functions update only. Hosting unchanged. `.env` key added locally.
- Follow-ups: merge PR #6; give ugridPREDICT the consumer key; commit nexus-portal ownership-map update on a clean branch; AI part miner.

## 2026-09-07 — Cursor — Brief 02 wrap-up (merge + consumers)
- Merged [PR #6](https://github.com/mso9999/pr-system/pull/6) to `main` (`feab63f`, 2026-09-07 15:19 UTC).
- Copied `UGRIDPREDICT_API_KEY` into gitignored `uGridPREDICT/.env`; consumer contract at `uGridPREDICT/docs/PR_CATALOG.md`.
- Nexus ownership map updated on clean branch `docs/brief-02-pr-catalog-ownership` (worktree; AM WIP left untouched).
- Side effects: GitHub merge only. Production functions already live from the earlier deploy. No further Firebase changes.
- Follow-ups: merge the nexus ownership PR; D2 can consume live PR commitments/lead-times; AI part miner still open.

## 2026-09-17 — Cursor — 1PWR Zambia New PR dropdowns empty
- Eduardo (JvqIsDmO3UcXWTAJdUx28Vs9TMG3) could not submit a New PR for **1PWR Zambia**: Project Category / Sites / Expense Type required but blank. Console: departments 18, approvers 3, **rules 0**.
- Cause: 2026-08-28 Zambia split left the Zambia catalog on `kuwala` (10 categories, 31 expense types, 7 rules, 1 site: HQ). `1pwr_zambia` has HR departments only. `getItemsByType` queried `organizationId == 1pwr_zambia` and returned nothing.
- Fix: `catalogOrganizationIds('1pwr_zambia')` also reads `kuwala`. Code-only; no catalog clone. Screenshot garble was browser translate, not the app.
- Side effects: hosting deploy of this client change (no functions).
- Follow-ups: seed a first-class `1pwr_zambia` catalog (sites beyond HQ; vehicles still 0 for both ZM orgs).

## 2026-09-17 — Cursor — 30-day pending-approval warning + auto-reject
- What: Daily job `pendingApprovalTimeout` (08:30 Africa/Maseru). After 30 calendar days in PENDING_APPROVAL, email requestor + assigned approver(s) that the PR will be auto-rejected in 7 days. Seven days after that warning, set status REJECTED as PR System with a statusHistory note. Existing stale PRs get a warning first — never a silent reject.
- Clock: latest `statusHistory` PENDING_APPROVAL stamp (resets if the PR leaves and re-enters). Tutorial sandbox PRs skipped.
- UI: warning banner on PR view after the notice is sent. Admin callable `runPendingApprovalTimeoutNow` (level 1/9).
- Side effects: deployed 2026-09-17 ~13:38 UTC to `pr-system-4ea55`: created `pendingApprovalTimeout` (scheduled 08:30 Africa/Maseru) and `runPendingApprovalTimeoutNow`; hosting banner live. Nexus `mintSSOToken` survived. First automatic warnings go out tomorrow 08:30 unless an admin runs the callable (35 of 39 current PENDING_APPROVAL PRs would warn).
- Key files: `functions/src/pendingApprovalTimeout/logic.ts`, `functions/src/scheduled/pendingApprovalTimeout.ts`, `src/components/pr/PRView.tsx`
