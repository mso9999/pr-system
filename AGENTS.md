# Agent Notes — PR System repo

## Deploying Cloud Functions — READ BEFORE ANY DEPLOY

This repo shares Firebase project `pr-system-4ea55` with
`1PWR Nexus/nexus-portal`. A bare `firebase deploy --only functions`
(or `--force`) **deletes the other repo's production functions**
(2026-08-12 incident: Nexus SSO functions wiped by a PR deploy).

- Deploy functions ONLY via: `npm run deploy:functions`
  (runs `scripts/deploy-functions.sh`, which deploys with explicit
  per-function selectors and cannot delete unlisted functions).
- Never run bare `firebase deploy` / `firebase deploy --only functions`,
  and never pass `--force` to a functions deploy.
- Firestore rules/indexes are canonical in `nexus-portal` — do not deploy
  `firestore:*` from this repo.
- `npm run deploy` is safe: it composes `deploy:hosting` +
  `deploy:functions`.

## Canonical site lifecycle (PR → uGP → CC)

Sites are **born in PR** (Admin → Reference Data → Sites; pre-survey spend
references them). Codes are exactly 3 uppercase letters — the same code is
used by uGP project codes and CC gateway/account identities.

Creation contract (2026-08-19):
- **Who**: `manage_pr_sites` action — superadmin, Procurement, Engineering,
  IS&T and Management department members (Nexus department `prActions`),
  plus explicit legacy levels 1/2/3/9. Firestore rules gate writes via
  `isPrSiteEditor()`; the UI gates via `canEditReferenceDataType('sites')`.
- **Code uniqueness**: per country via doc id (`{org}_{code}` ≡ silent
  country prefix, e.g. `1pwr_lesotho_mak` ≡ LS_MAK) AND globally across
  `1pwr_*` operating orgs, because CC gateway names bind to the bare code
  account-wide. `assertSiteCodeAvailable` in `referenceDataAdmin.ts`
  rejects collisions with the incumbent site's name.
- **GPS required**: latitude/longitude validated on every create/update;
  the form's map picker (SimpleMapPicker) sets them.
- **Provenance**: `createdBy`/`createdByUid`/`createdAt` are stamped on
  the site object (mutation logs capture it too).
- **uGP gensite moves the coordinate**: `updateSiteCoordinates` (HTTPS,
  `SITE_SYNC_UGP_API_KEY`) lets uGP set site coordinate = gensite
  coordinate when a gensite is placed in the canonical design; the fanout
  propagates the move. `coordinatesUpdatedBy/At` record provenance.

- `linkUgpProject` (HTTPS, `SITE_SYNC_UGP_API_KEY`): uGP registers THE
  canonical design for a site. PR is authoritative for **one canonical
  design per site** (409 names the incumbent; 404 = create the site in PR
  first). Sets `canonicalUgpProjectId` + appends `ugpProjects`.
- `fanoutSiteChanges` (Firestore trigger on `referenceData_sites`) POSTs
  every write to AM/FM (`SITE_SYNC_AM/FM_ENDPOINT`) and to every CC lane
  (`SITE_SYNC_CC_ENDPOINTS`, comma-separated; lanes self-filter by
  country). Payload carries `district` + `canonicalUgpProjectId` +
  `createdBy`/`createdAt`.
- `prCatalogApi` `GET /sites` rows expose `code` + `canonicalUgpProjectId`
  for the uGP creation picker (key: `HR_API_KEY_PR_PORTAL`).
- `src/scripts/backfillSitesToCc.ts` replays existing sites to CC lanes
  (legacy rows without coordinates are skipped by design).
