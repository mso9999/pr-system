# Cross-Repo API Contract — PR System

**Owner:** 1PWR PR (`pr-system-4ea55.web.app`, Firebase Hosting + Functions, repo `mso9999/pr-system`)
**Canonical data owned:** Countries, organizations, sites, vendors, item categories, purchase requests, provisioning.
**Source of truth for:** procurement reference data + PR documents.

Master ownership map: `nexus-portal/docs/CANONICAL_DATA_OWNERSHIP.md`.

## Authentication

Catalog API endpoints require `X-API-Key: <PR_CATALOG_API_KEY>`. Keys are
validated in `functions/src/prCatalogApi.ts`. The HR↔PR key (`HR_API_KEY_PR_PORTAL`)
is reused bidirectionally.

## Exposed APIs

| Method | Path | Purpose | Envelope | Consumers |
|--------|------|---------|----------|-----------|
| GET | `prCatalogApi/api/countries` | Country list | `{count, countries[]}` | AM, Nexus |
| GET | `prCatalogApi/api/organizations` | Organizations (`?country=LS`) | `{count, organizations[]}` | AM, Nexus, HR |
| GET | `prCatalogApi/api/sites` | Sites (`?country=&org=`) | `{count, sites[]}` | AM, Nexus |
| GET | `prCatalogApi/api/vendors` | Vendors | `{count, vendors[]}` | AM, Nexus |

Cloud Function base: `https://us-central1-pr-system-4ea55.cloudfunctions.net/prCatalogApi`.
All items camelCase. `Cache-Control: no-store`.

### Push (fanout) — sites

PR's `fanoutSiteChanges` Cloud Function pushes site changes to AM's
`POST /api/sync/site-ingest.php` (`X-API-Key: SITE_SYNC_FANOUT_API_KEY`), keeping
AM's `am_reference_sites` cache fresh in real time.

## Item shapes

- Country: `code` (ISO-2), `name`, `active`
- Organization: `id, name, countryCode, country, currency, timezoneOffset, active`
- Site: `id, name, countryCode, organizationId, active`
- Vendor: `id, name, email, phone, active`

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
