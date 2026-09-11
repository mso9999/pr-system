# Cross-Repo API Contract — PR System

**Owner:** 1PWR PR (`pr-system-4ea55.web.app`, Firebase Hosting + Functions, repo `mso9999/pr-system`)
**Canonical data owned:** Countries, organizations, sites, vendors, item categories, purchase requests, provisioning.
**Source of truth for:** procurement reference data + PR documents.

Master ownership map: `nexus-portal/docs/CANONICAL_DATA_OWNERSHIP.md`.

## Authentication

Catalog API endpoints require `X-API-Key` matching any of `HR_API_KEY_PR_PORTAL`,
`PR_CATALOG_API_KEY`, or `UGRIDPREDICT_API_KEY` (see `functions/src/catalog/auth.ts`).
The HR↔PR key is reused bidirectionally. 60 req/min per consumer (per-instance).

## Exposed APIs

| Method | Path | Purpose | Envelope | Consumers |
|--------|------|---------|----------|-----------|
| GET | `prCatalogApi/api/countries` | Country list | `{count, countries[]}` | AM, Nexus |
| GET | `prCatalogApi/api/organizations` | Organizations (`?country=LS`) | `{count, organizations[]}` | AM, Nexus, HR |
| GET | `prCatalogApi/api/sites` | Sites (`?country=&org=`) | `{count, sites[]}` | AM, Nexus |
| GET | `prCatalogApi/api/vendors` | Vendors (+ country, origin, defaultCurrency, incotermDefault) | `{count, vendors[]}` | AM, Nexus, ugridpredict |
| GET | `prCatalogApi/api/categories` | Project categories | `{count, items[]}` | ugridpredict |
| GET | `prCatalogApi/api/expense-types` | Expense types | `{count, items[]}` | ugridpredict |
| GET | `prCatalogApi/api/v1/purchase-requests` | Live PRs (`status`, `organization`, `site`, `created_since`, `expected_before`, `cursor`, `limit`) | `{count, items[], nextCursor}` | ugridpredict |
| GET | `prCatalogApi/api/v1/commitments` | Approved/ordered, not delivered — by month × org × site × category × currency | `{count, items[]}` | ugridpredict |
| GET | `prCatalogApi/api/v1/lead-times` | p50/p80/p95 from live PR history. `archivePRs` excluded. `lowConfidence` when n<5 | `{count, items[], notes}` | ugridpredict |

Cloud Function base: `https://us-central1-pr-system-4ea55.cloudfunctions.net/prCatalogApi`.
All items camelCase. `Cache-Control: no-store`.

### Push (fanout) — sites

PR's `fanoutSiteChanges` Cloud Function pushes site changes to AM's
`POST /api/sync/site-ingest.php` (`X-API-Key: SITE_SYNC_FANOUT_API_KEY`), keeping
AM's `am_reference_sites` cache fresh in real time.

## Item shapes

- Country: `code` (ISO-2), `name`, `active`
- Organization: `id, name, countryCode, country, currency, timezoneOffset, active`
- Site: `id, code, name, countryCode, organizationId, active, canonicalUgpProjectId`
- Vendor: `id, name, email, phone, country, active, defaultCurrency, origin, incotermDefault`
  (`origin` is `local` / `regional` / `import`, derived from `country` when unset)
- Purchase request: `id` (Firestore), `prId` (prNumber), `status, organization, organizationId, site, sites, department, description, category, expenseType, estimatedAmount, currency, vendorId, quotes, createdAt, approvedAt, orderedAt, expectedDelivery, deliveredAt, ugpPartIds, mappingConfidence, mappingSource, incoterm`
- Commitment: `month, organization, organizationId, site, category, committedAmount, currency, prCount, earliestExpected, latestExpected`. Cash month = `expectedDelivery || orderedAt || createdAt`. APPROVED/ORDERED only; delivered excluded.
- Lead time: `vendorId, category, origin, n, daysOrderToDelivery{p50,p80,p95,mean}, daysRequestToOrder{...}, window, lowConfidence`

## Purchasing detail extension — 9 Sep 2026 (local, awaiting deployment)

Existing `GET /api/v1/purchase-requests` and `/api/v1/purchaseRequests` retain authentication, filters, order and pagination. The additions below are additive. Existing fields, including the legacy `deliveredAt` fallback to COMPLETED history, retain their previous behavior; that field is **not AM receipt evidence**.

Each live request now exposes:

- `sourceCollection: "purchaseRequests"`.
- `lineItems[]`: the stored request `lineItems`, with `quantityBasis.lineItems: "requested"`.
- `poLineItems[]`: stored `lineItemsWithSKU`, with `quantityBasis.poLineItems: "recorded_po_lines"`. No fallback, merge or summation between these arrays. A recorded PO line may be a draft/amendment and does not certify approval or delivery.
- `lineItemsStatus` and `poLineItemsStatus`: `available`, `empty`, `missing`, or `invalid`. Available means the array exists, not that each line is valid; inspect line issues.
- `receiptEvidenceStatus: "not_connected"`. Received/outstanding quantities cannot yet be established from this API; do not subtract guessed receipts from requested quantities.

Each line contains `id` (nullable source ID), `sourceIndex` (zero-based position, **not a stable line ID**), `lineNumber` (nullable), `itemNumber` (nullable SKU), `description`, `notes`, `quantity`, `uom`, `attachmentCount`, `hasFileLink`, and `issues[]`.

Finite nonnegative quantities preserve decimal precision and measured zero. Simple decimal numeric strings are accepted; booleans, blanks, negative/nonfinite values and non-decimal text become null with `quantity_unknown_or_invalid`. Units are preserved, not guessed or converted. Missing/duplicate IDs, missing descriptions/units and malformed rows are explicit issues; malformed rows are not silently discarded. No synthetic source IDs are generated. PO lines without IDs retain their recorded line number and SKU.

Attachment counts/file-link presence support follow-up, but signed URLs, upload identities and arbitrary nested data are excluded. This extension does not retrieve documents or mine prices, mappings or stock.

Example: `/api/v1/purchase-requests?organization=smp&site=mashai_smp&limit=100`.
The existing `count` is the **total matching request count**, not page length. `items.length` is page length; pass `nextCursor` back as `cursor`. Sites and organization filters retain their existing exact-reference behavior: do not assume bare MAS automatically resolves every inherited organization record.

### Explicit historical read

`GET /api/v1/archived-purchase-requests?limit=100&cursor=...` reads `archivePRs` only, using the same GET-only, API-key, rate-limit and no-store controls. It is a separate endpoint so archives never enter live commitments or lead-time calculations.

- `limit`: integer 1–500, default 100. Only `limit` and `cursor` are accepted; unsupported filters or malformed/cross-source cursors return 400 rather than silently ignoring them.
- Ordered by Firestore document ID, with a bounded read of at most limit+1 documents. No custom Firestore index required. Cursor resumes after the last returned ID even if that record is later removed.
- Envelope `{count, items, nextCursor}`: **archive count is returned page length**, not collection total. Stop only when `nextCursor` is null. This endpoint does not implement organization/site/date/search filtering; consumers may filter captured pages. Record the full traversal period; this is not a frozen database transaction.
- Fields: `id`, `sourceCollection: "archivePRs"`, `submittedDate`, `importedAt`, `organization`, `site`, `description`, `reason`, `category`, `vendorName`, `vendorCode`, `status`, `lineItems`, `lineItemsStatus`, `quantityBasis: "legacy_record_only"`, `receiptEvidenceStatus: "not_connected"`, `attachmentCount`.
- Original date strings and organization/site labels are preserved. No canonical IDs, completion status, quantities, delivery dates or receipt evidence are inferred. Missing fields stay null/missing. Historical `lineItems` are projected only if actually stored; descriptions are not parsed into invented lines.
- Requestor identities, originalData, raw legacy responses, attachment URLs and import-user metadata are excluded. No archive source files are exposed.

### Verification and release

Run `./node_modules/.bin/vitest run --config functions/vitest.config.ts` (35 tests) and `./functions/node_modules/.bin/tsc -p functions/tsconfig.json --noEmit`. Tests use a dedicated local Firestore double; no production data or credentials are needed.

Build tracked functions output before release. Deploy only through the repository's safe explicit-selector script per AGENTS.md; never the unsafe functions-package deploy command or bare Firebase functions deploy. This task has not deployed, changed authentication, altered source records, or implemented the PR–AM receipt-closeout workflow.

## Identity (Phase 2)

PR reads identity + permissions from `nexus_users/{uid}.systemAccess.pr`
(canonical) and PR-profile fields from `users/{uid}` (extension). See
`nexus-portal/docs/PR_NEXUS_COEXISTENCE_PLAN.md`. PR CI deploys **hosting only**;
Firestore rules are canonical in `nexus-portal/firestore.rules`.

## Consumed from other repos

| From | API | Purpose |
|------|-----|---------|
| HR | `/api/employees/directory` (X-API-Key) | HR sync into `users/` + `nexus_users/` |
| FM | `GET /api/integrations/v1/vehicles` (X-Fleet-Integration-Key) | Vehicle mirror into `referenceData_vehicles` |

## Change management

- Additive field changes only to catalog item shapes; consumers (AM) cache fields
  and a removal would silently drop data.
- New catalog endpoints: register here + in the master ownership map.

## Nexus SSO (centralized auth)

Nexus (`nexus.1pwrafrica.com`) is the IdP. Unauthenticated users are redirected
by `PrivateRoute.tsx` to `/sso/authorize?tool=pr&redirect_uri=<current URL>`;
the return token (`?sso_token=&from=nexus`) is consumed by
`NexusSSOHandler.tsx` via `signInWithCustomToken` (same `pr-system-4ea55`
project). **Emergency fallback:** the local login stays reachable at
`/login?fallback=1` (Firebase email/password). Full flow + outage procedure:
`nexus-portal/docs/NEXUS_AUTH_RUNBOOK.md`.


## Prospective AM receipt pilot — local implementation, 10 September 2026

New signed-Nexus callables: `enrollPrReceiptPilot` (PR administrator),
`recordAmOrderReceipt` / `reverseAmOrderReceipt` / `confirmAmUgpMapping` (AM approver),
and `completeReceiptControlledPr` (PR procurement/admin). See
[the pilot contract and release boundaries](docs/PR_AM_PILOT_IMPLEMENTATION_20260910.md).
These are not deployed API guarantees yet. Existing purchase reads do not establish AM receipts.
