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
