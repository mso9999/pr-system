# HR Organization & Country Sync Spec

**Audience:** the agent that works in the `1PWR HR/hr_portal` Laravel repo.
**Author:** PR-repo agent (this file lives in the PR repo at `docs/HR_ORG_COUNTRY_SYNC_SPEC.md`; copy it into the HR repo's `docs/` before starting).
**Status:** Ready to implement. PR-side catalog API is shipped and live — `GET /api/countries` and `GET /api/organizations` on the `prCatalogApi` Cloud Function, authed by `X-API-Key: HR_API_KEY_PR_PORTAL`.

This spec is **self-contained**: every work item lists exact HR-repo file paths, schema changes, console commands, controller changes, and acceptance criteria.

---

## 1. Context & goal

Ownership direction (confirmed 2026-07-01):

| Catalog              | Canonical system | Direction        |
|----------------------|------------------|------------------|
| Employee metadata    | HR               | HR → PR (done)   |
| Department catalog   | HR               | HR → PR (done)   |
| **Countries**        | **PR**           | **PR → HR**      |
| **Organizations**    | **PR**           | **PR → HR**      |

Countries are the **parent**; organizations are **children** that carry a `countryCode` (ISO-2) linking to their parent country. PR owns CRUD for both. HR currently keeps a static hand-maintained map at `config/pr_org_map.php` (7 entries, "add an entry, redeploy, run the sync" onboarding). HR should instead **pull** the country + organization lists from PR's new catalog API and cache them locally, so onboarding a new org/country is just a CRUD action in PR + a sync.

**Non-goal:** PR-side changes. PR already exposes the API and owns the CRUD. This spec is HR-repo-only.

---

## 2. Current HR state (as observed in the repo)

- `config/pr_org_map.php` — static `organization_id => country_code` map (LS, ZM, BJ × 7 orgs). Used by:
  - `app/Console/Commands/SyncDepartmentsFromPr.php:31` — walks orgs, stamps `departments.country_code`.
  - `app/Http/Controllers/DepartmentController.php:221` — `orgChoices()` builds the create-form (country, org) dropdowns from this map; `store()` validates `organization_id` is in the map and that the org's country matches.
  - `app/Http/Controllers/BulkDepartmentAssignmentController.php:52` — bulk-assignment page filters.
- `app/Helpers/Global.php:345` — `currentUserManagedCountryCodes(): array|null` already returns the admin/HR's managed countries from `admin_countries` (with superadmin = all).
- `app/Models/Department.php` — `country_code`, `organization_id` columns.
- Conventions: routes under `admin` middleware; Blade + Soft UI; console commands in `app/Console/Commands/`; tests in `tests/Feature/`.

PR's API (already live, smoke-tested):

```
GET https://us-central1-pr-system-4ea55.cloudfunctions.net/prCatalogApi/api/countries
  → { count, countries: [{ code, name, active }] }

GET https://us-central1-pr-system-4ea55.cloudfunctions.net/prCatalogApi/api/organizations?country=LS
  → { count, organizations: [{ id, name, countryCode, country, currency, timezoneOffset, active }] }
```

Auth: `X-API-Key: <HR_API_KEY_PR_PORTAL>` (the same key HR already issues for its own API — reused in both directions by explicit decision). `Cache-Control: no-store`.

---

## 3. Work items

### C1. PR catalog HTTP client

**Files to create:**

- `app/Support/PrCatalogClient.php` — a small Guzzle/curl wrapper around PR's `prCatalogApi`:
  - `countries(): array` → `GET /api/countries`, returns `[{ code, name, active }]`.
  - `organizations(?string $countryCode = null): array` → `GET /api/organizations[?country=]`, returns `[{ id, name, countryCode, country, currency, timezoneOffset, active }]`.
  - Reads base URL from `config('pr_catalog.base_url')` (default `https://us-central1-pr-system-4ea55.cloudfunctions.net/prCatalogApi`) and the key from `config('pr_catalog.api_key')` (env `PR_CATALOG_API_KEY` — set this to the same value as `HR_API_KEY_PR_PORTAL` in HR's `.env`).
  - Throws a typed `PrCatalogException` on non-2xx, with the status + body for diagnostics. 5-second connect timeout, 10-second total.
- `config/pr_catalog.php` — return `['base_url' => env('PR_CATALOG_BASE_URL', 'https://us-central1-pr-system-4ea55.cloudfunctions.net/prCatalogApi'), 'api_key' => env('PR_CATALOG_API_KEY')]`.
- `.env` / `.env.example` — add `PR_CATALOG_API_KEY=` (same value as HR's existing HR-facing key) and optionally `PR_CATALOG_BASE_URL=`.

**Acceptance criteria:**
- `app(PrCatalogClient::class)->countries()` returns the 3 countries (BJ, LS, ZM) from PR.
- `app(PrCatalogClient::class)->organizations('LS')` returns the 5 LS orgs.
- A missing/empty key throws `PrCatalogException` (not a generic 500).

---

### C2. Cache table + sync command

**Goal:** replace the static `pr_org_map.php` with a cached PR-sourced table that `orgChoices()` and `SyncDepartmentsFromPr` read.

**Schema — new migration `database/migrations/<date>_create_pr_catalog_tables.php`:**

```php
Schema::create('pr_countries', function (Blueprint $table) {
    $table->string('code', 2)->primary();      // ISO-2, e.g. LS
    $table->string('name', 191);
    $table->boolean('active')->default(true);
    $table->timestamp('synced_at')->nullable();
    $table->timestamps();
});

Schema::create('pr_organizations', function (Blueprint $table) {
    $table->string('id', 191)->primary();      // PR org doc id, e.g. 1pwr_lesotho
    $table->string('name', 191);
    $table->string('country_code', 2);         // FK -> pr_countries.code
    $table->string('country_name', 191)->nullable(); // denormalized display name
    $table->string('currency', 8)->nullable();
    $table->integer('timezone_offset')->nullable();
    $table->boolean('active')->default(true);
    $table->timestamp('synced_at')->nullable();
    $table->timestamps();
    $table->index('country_code');
    $table->foreign('country_code')->references('code')->on('pr_countries')->cascadeOnUpdate();
});
```

**Files to create:**

- `app/Models/PrCountry.php`, `app/Models/PrOrganization.php` — Eloquent models.
- `app/Console/Commands/SyncPrCatalog.php` — Laravel console command `pr_catalog:sync`:
  - Calls `PrCatalogClient::countries()` → upserts `pr_countries` (delete-or-deactivate rows absent from PR; mirror PR's `active` flag).
  - Calls `PrCatalogClient::organizations()` → upserts `pr_organizations`. Rows absent from PR are deactivated (`active=false`) but **not** hard-deleted, to preserve historical `departments.organization_id` references. The `country_code` FK is set from each org's `countryCode`.
  - Stamps `synced_at` on every touched row.
  - Prints a one-line summary: `Synced N countries, M organizations (created X, updated Y, deactivated Z).`
  - `--dry-run` flag prints the diff without writing.
  - Schedule it in `app/Console/Kernel.php` — `->dailyAt('00:30')` (before the 01:00 department catalog sync, so HR's department sync and `orgChoices()` see fresh org/country data).
- Optional: a `pr_catalog:show` command for operators to print the cached list.

**Acceptance criteria:**
- `php artisan pr_catalog:sync` populates `pr_countries` (3 rows) and `pr_organizations` (8 rows) from PR.
- Re-running it is idempotent (no spurious created/updated counts).
- `--dry-run` writes nothing.
- A PR-side change (rename an org, add a country) is reflected after the next sync.

---

### C3. Replace `pr_org_map.php` consumers

**Files to change:**

- `app/Http/Controllers/DepartmentController.php`:
  - `orgChoices()` (line ~219) — replace `config('pr_org_map', [])` with a query over `PrOrganization::where('active', true)->orderBy('id')->get()` keyed by `id => country_code`. Keep the same return shape (`organization_id => country_code`) so `store()` validation (lines 94–101) keeps working unchanged.
  - The "country dropdown" on the create form should now source from `PrCountry::where('active', true)->orderBy('code')->pluck('name', 'code')`.
- `app/Console/Commands/SyncDepartmentsFromPr.php:31` — replace `config('pr_org_map', [])` with `PrOrganization::where('active', true)->pluck('country_code', 'id')`. Keep the same "only walk orgs in the map" opt-in behavior.
- `app/Http/Controllers/BulkDepartmentAssignmentController.php:52` — replace `config('pr_org_map', [])` with the `PrOrganization` query; the country/org filter dropdowns read from `pr_countries` / `pr_organizations`.
- `config/pr_org_map.php` — keep the file as a **fallback/seed only** for the first run before `pr_catalog:sync` has executed, OR delete it once C2 is confirmed working. Recommendation: keep it as a documented fallback for disaster recovery, and have `orgChoices()` fall back to it only if `pr_organizations` is empty.

**Acceptance criteria:**
- After `pr_catalog:sync`, the Departments create form's (country, organization) dropdowns reflect PR's live data.
- Adding an org in PR + `pr_catalog:sync` makes it appear in HR's dropdowns without a redeploy.
- `SyncDepartmentsFromPr` walks exactly the orgs in `pr_organizations` (active).
- `orgChoices()` returns the empty array only when both `pr_organizations` and `pr_org_map.php` are empty (disaster case).

---

### C4. Operator tooling

- Add an admin page or a sidebar link on the catalog page (`resources/views/departments/index.blade.php`) showing "Last PR catalog sync: <synced_at>" and a "Sync now" button that dispatches `pr_catalog:sync` (or hits a thin controller that runs it inline for small catalogs — they're tiny).
- Log every sync to Laravel's log channel with the summary line.

**Acceptance criteria:**
- An admin can trigger a sync from the UI and see the last-sync timestamp.

---

### C5. Tests

**Files to create/extend:**

- `tests/Feature/PrCatalogSyncTest.php` — mock `PrCatalogClient`, run `pr_catalog:sync`, assert `pr_countries` + `pr_organizations` populated, idempotent on re-run, deactivated rows when PR drops one, `--dry-run` writes nothing.
- `tests/Feature/DepartmentCatalogAdminTest.php` — extend: `orgChoices()` reads from `pr_organizations` (not `pr_org_map`); a new org appears in the create form after sync.
- `tests/Feature/SyncDepartmentsFromPrTest.php` (extend or create) — the command walks exactly the active `pr_organizations`.

**Acceptance criteria:**
- `php artisan test --filter='PrCatalog|DepartmentCatalog|SyncDepartments'` is green.

---

## 4. Sequencing & dependencies

```
C1 (client) ─► C2 (cache table + sync) ─► C3 (replace pr_org_map consumers) ─► C4 (UI) 
                                                              │
                                                              └─► C5 (tests)
```

Recommended order: **C1 → C2 → C3 → C5 → C4** (tests after the wiring so they cover the real reads; UI last as polish).

**One-time operator step after merge:** run `php artisan pr_catalog:sync` once to populate `pr_countries` / `pr_organizations` before flipping `orgChoices()` to read from them (or land C2 and C3 together with the fallback in C3 so there's no gap).

---

## 5. What PR will do once HR is consuming the API (follow-up, NOT part of this spec)

Nothing further on the PR side. PR already:

- Owns `referenceData_countries` (ISO-2 + name + active) with admin CRUD.
- Owns `referenceData_organizations` with a `countryCode` (ISO-2) link to its parent country, set via the org form's country selector.
- Exposes `GET /api/countries` and `GET /api/organizations` via the `prCatalogApi` Cloud Function (authed by `X-API_KEY_PR_PORTAL`).

The only ongoing PR-side obligation is: admins keep the country + organization CRUD current in PR, and PR's catalog API stays up. There is no PR → HR push; HR pulls on its schedule (daily 00:30 + on-demand).

---

## 6. Acceptance criteria (definition of done for the HR-repo agent)

Per work item, the bullets under each item in §3.

**Global definition of done:**

- [ ] `php artisan test` is green (existing + new tests).
- [ ] `php artisan pr_catalog:sync` populates `pr_countries` (3) and `pr_organizations` (8) from PR's live `prCatalogApi`, and is idempotent.
- [ ] The Departments create form's (country, organization) dropdowns reflect PR's data after a sync — no `pr_org_map.php` edit or redeploy needed to onboard a new org.
- [ ] `SyncDepartmentsFromPr` walks exactly the active `pr_organizations`.
- [ ] A scheduled daily sync (00:30) keeps HR's cached catalog fresh before the 01:00 department catalog sync.
- [ ] `config/pr_org_map.php` is either removed or kept as a documented disaster-recovery fallback that's only read when `pr_organizations` is empty.
- [ ] `PR_CATALOG_API_KEY` in HR's `.env` is set to the same value as `HR_API_KEY_PR_PORTAL` (the shared key, reused in both directions).

When all of the above are true, the static `pr_org_map.php` is no longer the source of truth for the (country, organization) list — PR is.
