# HR Organization Assignment API Spec

**Audience:** the agent that works in the `1PWR HR/hr_portal` Laravel repo.
**Author:** PR-repo agent (this file lives in the PR repo at `docs/HR_ORG_ASSIGNMENT_API_SPEC.md`; copy it into the HR repo's `API/` directory before starting).
**Status:** Ready to implement. PR-side consumer code is shipped and deployed — the PR sync (`hrEmployeeSyncCore.ts`) already reads `primary_organization`, `additional_organizations`, and `secondments` from the HR directory API response and writes them into Firestore as HR-owned fields.

This spec is **self-contained**: every work item lists exact HR-repo file paths, schema changes, controller changes, Blade views, and acceptance criteria.

---

## 1. Context & goal

Ownership direction (confirmed 2026-07-24):

| Catalog                        | Canonical system | Direction      | Status          |
|--------------------------------|------------------|----------------|-----------------|
| Employee metadata              | HR               | HR → PR (done) | Shipped         |
| Department catalog             | HR               | HR → PR (done) | Shipped         |
| Countries                      | PR               | PR → HR (done) | Shipped         |
| Organizations                  | PR               | PR → HR (done) | Shipped         |
| **Primary org assignment**     | **HR**           | **HR → PR**    | **This spec**   |
| **Additional orgs**            | **HR**           | **HR → PR**    | **This spec**   |
| **Secondments**                | **HR**           | **HR → PR**    | **This spec**   |

PR has already migrated its organization fields (`organization`, `additionalOrganizations`, `secondments`) from PR-owned to HR-owned. The PR sync now **always overwrites** these fields from the HR API response. If HR returns `null`/missing for these fields, PR users will lose their organization assignment and see "No organizations available for your account."

**Goal:** Add `primary_organization`, `additional_organizations`, and `secondments` to the HR employee directory API response, plus an admin UI for HR staff to manage them.

**Non-goal:** PR-side changes. PR already consumes the new fields. This spec is HR-repo-only.

---

## 2. Current HR state (as observed in the repo)

### What exists

- `app/Http/Controllers/Api/EmployeeDirectoryController.php` — the `serializeEmployee()` method (line ~229) returns the employee JSON shape consumed by PR, AM, Nexus, etc.
- `app/Models/User.php` — the User model with relationships to `departments` (via `user_departments` pivot), `profile`, `currentPosition`, `toolsetApprovals`.
- `app/Models/Department.php` — has `organization_id` column (e.g. `1pwr_lesotho`).
- `database/migrations/2026_04_27_000002_create_departments_tables.php` — `departments` table with `organization_id` column; `user_departments` pivot with `is_primary`, `is_lead`.
- `database/migrations/2026_07_02_000001_create_pr_catalog_tables.php` — `pr_organizations` table (cached from PR's catalog API) with `id` (e.g. `1pwr_lesotho`), `name`, `country_code`, `active`.
- `app/Models/PrOrganization.php` — Eloquent model for `pr_organizations`.
- `app/Http/Controllers/Admin/EmployeeMembershipController.php` — admin UI for managing 1–3 department memberships per employee.
- `resources/views/employees/memberships.blade.php` — Blade view for the membership editor.
- `config/pr_org_map.php` — static fallback map (replaced by `pr_organizations` table).

### What's missing

- No `primary_organization` field on the `users` table — currently derived from `primaryDepartment.organization_id` in `serializeEmployee()` as `primary_organization_id`.
- No `additional_organizations` concept — an employee can belong to multiple departments, but those departments may span organizations. There's no explicit "this employee also works for org X" concept separate from department memberships.
- No `secondments` table or concept — temporary assignments to other organizations are not tracked.

### Current serializer output (relevant fields)

```php
// EmployeeDirectoryController::serializeEmployee() line ~229
return [
    // ...
    'department'              => $department,        // primary dept name
    'memberships'             => $memberships,       // all dept memberships with org_id
    'primary_organization_id' => $primaryOrg,        // from primaryDepartment.organization_id
    // ...
];
```

PR's sync expects these new fields (snake_case, matching the existing API convention):

```typescript
// From PR's hrDirectoryClient.ts HrEmployee interface
primary_organization?: string | null;       // e.g. "1pwr_lesotho"
additional_organizations?: string[] | null; // e.g. ["1pwr_benin", "1pwr_zambia"]
secondments?: HrSecondment[] | null;        // array of secondment objects

interface HrSecondment {
  organizationId: string;      // e.g. "1pwr_benin" (camelCase — PR normalizes)
  startDate: string | null;    // YYYY-MM-DD
  endDate: string | null;      // YYYY-MM-DD, null = open-ended
  reason: string | null;       // free-text purpose
}
```

**Note on casing:** The existing API uses snake_case (`primary_organization_id`, `employment_start_date`). PR's TypeScript interface uses camelCase (`organizationId`, `startDate`). The PR sync code (`hrEmployeeSyncCore.ts`) reads the snake_case API fields and maps them. The serializer should return snake_case keys: `primary_organization`, `additional_organizations`, `secondments` (with `organization_id`, `start_date`, `end_date`, `reason` inside each secondment object). PR's `HrEmployee` interface already expects `primary_organization` and `additional_organizations` in snake_case. For secondments, PR's interface uses `organizationId` (camelCase) — but the sync code filters with `s.organizationId`, so the API must return `organizationId` in camelCase within each secondment object, OR PR's interface needs updating. **Decision: return `organization_id` in snake_case for consistency with the rest of the API; PR's sync code should be updated to read `organization_id` instead of `organizationId`.** (PR-side fix is a one-line change in `hrEmployeeSyncCore.ts`.)

**Actually, to avoid a breaking change on the PR side:** The PR code is already deployed and reads `s.organizationId` (camelCase). So the HR API should return `organizationId`, `startDate`, `endDate` in camelCase within secondment objects to match what PR expects. This is a minor inconsistency with the rest of the API but avoids a PR redeploy.

**Final decision:** Return secondment fields in camelCase to match PR's deployed interface:

```json
{
  "secondments": [
    {
      "organizationId": "1pwr_benin",
      "startDate": "2026-01-15",
      "endDate": null,
      "reason": "Supporting Benin operations"
    }
  ]
}
```

---

## 3. Work items

### O1. Schema — add organization columns to users table

**Goal:** Add `primary_organization` and `additional_organizations` columns to the `users` table so HR can explicitly set an employee's primary and additional organization assignments, independent of department memberships.

**New migration `database/migrations/<date>_add_organization_assignment_to_users.php`:**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Organization assignment columns on users. These are HR-managed fields
 * that the PR system consumes via the employee directory API as HR-owned
 * data. See API/HR_ORG_ASSIGNMENT_API_SPEC.md.
 *
 * - primary_organization: the org_id string (e.g. "1pwr_lesotho") matching
 *   pr_organizations.id. Nullable for backward compatibility (legacy rows
 *   derive from primaryDepartment.organization_id at serialize time).
 * - additional_organizations: JSON array of org_id strings for employees
 *   who work across multiple organizations (beyond their primary).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('primary_organization', 191)->nullable()->after('country_code');
            $table->json('additional_organizations')->nullable()->after('primary_organization');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['primary_organization', 'additional_organizations']);
        });
    }
};
```

**Acceptance criteria:**
- `php artisan migrate` adds the two columns without error.
- Existing rows have `primary_organization = NULL` and `additional_organizations = NULL`.
- `php artisan migrate:rollback` removes them cleanly.

---

### O2. Schema — create secondments table

**Goal:** Track temporary organization assignments (secondments) with start/end dates and reason.

**New migration `database/migrations/<date>_create_secondments_table.php`:**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Secondments — temporary assignments of an employee to an organization
 * other than their primary. HR manages these via the employee edit UI;
 * PR consumes them via the directory API to grant the employee access to
 * PRs in the seconded organization during the secondment period.
 *
 * See API/HR_ORG_ASSIGNMENT_API_SPEC.md.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('secondments')) {
            return;
        }

        Schema::create('secondments', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->string('organization_id', 191);   // matches pr_organizations.id
            $table->date('start_date')->nullable();
            $table->date('end_date')->nullable();       // null = open-ended
            $table->string('reason')->nullable();
            $table->timestamps();

            $table->foreign('user_id')
                ->references('id')
                ->on('users')
                ->cascadeOnDelete();

            $table->index(['user_id', 'end_date'], 'secondments_user_end_idx');
        });
    }

    public function down(): void
    {
        if (Schema::hasTable('secondments')) {
            Schema::drop('secondments');
        }
    }
};
```

**Acceptance criteria:**
- `php artisan migrate` creates the table without error.
- `php artisan migrate:rollback` drops it cleanly.

---

### O3. Models — User casts + Secondment model + relationships

**Files to change:**

- `app/Models/User.php`:
  - Add to `$casts` array:
    ```php
    'additional_organizations' => 'array',
    ```
  - Add relationship:
    ```php
    /**
     * Secondments — temporary assignments to other organizations.
     * HR manages these; PR consumes them via the directory API.
     */
    public function secondments()
    {
        return $this->hasMany(Secondment::class)->orderByDesc('start_date');
    }
    ```

**Files to create:**

- `app/Models/Secondment.php`:
  ```php
  <?php

  namespace App\Models;

  use Illuminate\Database\Eloquent\Factories\HasFactory;
  use Illuminate\Database\Eloquent\Model;

  class Secondment extends Model
  {
      use HasFactory;

      protected $guarded = [];

      protected $casts = [
          'start_date' => 'date',
          'end_date' => 'date',
      ];

      public function user()
      {
          return $this->belongsTo(User::class);
      }
  }
  ```

**Acceptance criteria:**
- `$user->secondments` returns a Collection of `Secondment` models.
- `$user->additional_organizations` is auto-cast to an array (or null).

---

### O4. API serializer — add org fields to directory response

**File to change:** `app/Http/Controllers/Api/EmployeeDirectoryController.php`

**Changes to `serializeEmployee()` (around line 229):**

Add eager loading of `secondments` in both the `index()` method's `->load(...)` call (line ~77) and the `show()` method's `->load(...)` call (line ~152):

```php
// In index() — update the ->load() chain:
->load(['profile', 'currentPosition.department', 'primaryDepartment', 'departments', 'toolsetApprovals', 'secondments'])

// In show() — update the ->load() chain:
$user->load(['profile', 'currentPosition.department', 'primaryDepartment', 'departments', 'toolsetApprovals', 'secondments']);
```

Add to the return array in `serializeEmployee()`, replacing the existing `primary_organization_id` field:

```php
// Primary organization: explicit column first, fall back to primaryDepartment's org.
$primaryOrg = $u->primary_organization
    ?: optional($u->primaryDepartment->first())->organization_id;

// Additional organizations: explicit column, or empty array.
$additionalOrgs = is_array($u->additional_organizations)
    ? array_values(array_filter($u->additional_organizations))
    : [];

// Secondments — camelCase keys to match PR's deployed TypeScript interface.
$secondments = $u->secondments->map(function ($s) {
    return [
        'organizationId' => $s->organization_id,
        'startDate'       => optional($s->start_date)?->toDateString(),
        'endDate'         => optional($s->end_date)?->toDateString(),
        'reason'          => $s->reason,
    ];
})->values();

return [
    // ... existing fields ...
    'primary_organization'      => $primaryOrg,
    'additional_organizations'  => $additionalOrgs,
    'secondments'               => $secondments,
    // ... keep existing fields ...
];
```

**Important:** Keep `primary_organization_id` in the response for backward compatibility with other consumers (AM, Nexus, UGP) that may read it. The new `primary_organization` field is additive. Both fields will have the same value.

**Acceptance criteria:**
- `GET /api/employees/directory` returns `primary_organization`, `additional_organizations`, and `secondments` on every employee object.
- `GET /api/employees/show/{id}` returns the same three fields.
- An employee with no explicit `primary_organization` column falls back to `primaryDepartment.organization_id`.
- An employee with no secondments returns `"secondments": []` (not null).
- An employee with no additional orgs returns `"additional_organizations": []` (not null).
- Existing consumers (AM, Nexus, UGP) are unaffected — the new fields are additive.

---

### O5. Admin UI — organization assignment on employee edit page

**Goal:** Let HR staff set primary organization, additional organizations, and manage secondments from the employee edit page.

**Files to change:**

- `app/Http/Controllers/EmployeeController.php` (or `EmployeeProfileController.php` — check which handles the edit form):
  - In the `edit()` method, pass the list of active `pr_organizations` to the view:
    ```php
    $organizations = \App\Models\PrOrganization::where('active', true)->orderBy('name')->get();
    ```
  - In the `update()` method, validate and persist:
    ```php
    'primary_organization' => 'nullable|string|max:191',
    'additional_organizations' => 'nullable|array',
    'additional_organizations.*' => 'string|max:191',
    ```
    Then save:
    ```php
    $user->primary_organization = $request->input('primary_organization');
    $user->additional_organizations = $request->input('additional_organizations', []);
    $user->save();
    ```

- `resources/views/employees/edit.blade.php`:
  - Add an "Organization Assignment" section after the department memberships section:
    - **Primary Organization** — a `<select>` populated from `$organizations`, bound to `primary_organization`. Include a "-- Derive from primary department --" option (value empty) for the fallback behavior.
    - **Additional Organizations** — a multi-select (`<select multiple>`) populated from `$organizations`, bound to `additional_organizations[]`. Hint text: "Organizations the employee works across, beyond their primary."
    - **Secondments** — a sub-section with a table of current secondments and an "Add Secondment" form:
      - Columns: Organization (select), Start Date (date picker), End Date (date picker, blank = open-ended), Reason (text input), Actions (delete button).
      - Each row is a form that POSTs to a secondment store/destroy route.
  - Follow the existing Soft UI styling patterns used elsewhere in the HR portal.

**Files to create:**

- `app/Http/Controllers/Admin/SecondmentController.php`:
  ```php
  <?php

  namespace App\Http\Controllers\Admin;

  use App\Http\Controllers\Controller;
  use App\Models\Secondment;
  use App\Models\User;
  use App\Models\UserMutation;
  use Illuminate\Http\Request;
  use Illuminate\Support\Facades\DB;

  class SecondmentController extends Controller
  {
      public function __construct()
      {
          $this->middleware('auth');
      }

      /**
       * POST /admin/employees/{user}/secondments
       */
      public function store(Request $request, User $user)
      {
          $this->authorizeForUser($user);

          $data = $this->validate($request, [
              'organization_id' => 'required|string|max:191',
              'start_date' => 'nullable|date',
              'end_date' => 'nullable|date|after_or_equal:start_date',
              'reason' => 'nullable|string|max:255',
          ]);

          DB::beginTransaction();
          $secondment = Secondment::create(array_merge($data, ['user_id' => $user->id]));

          UserMutation::create([
              'user_id' => $user->id,
              'edited_by' => auth()->id(),
              'reason' => 'Secondment added',
              'before' => [],
              'after' => ['secondment' => $data],
              'created_at' => now(),
          ]);
          DB::commit();

          return redirect()->back()->with('success', 'Secondment added.');
      }

      /**
       * DELETE /admin/employees/{user}/secondments/{secondment}
       */
      public function destroy(User $user, Secondment $secondment)
      {
          $this->authorizeForUser($user);

          if ($secondment->user_id !== $user->id) {
              abort(404);
          }

          DB::beginTransaction();
          $before = $secondment->toArray();
          $secondment->delete();

          UserMutation::create([
              'user_id' => $user->id,
              'edited_by' => auth()->id(),
              'reason' => 'Secondment removed',
              'before' => ['secondment' => $before],
              'after' => [],
              'created_at' => now(),
          ]);
          DB::commit();

          return redirect()->back()->with('success', 'Secondment removed.');
      }

      private function authorizeForUser(User $user): void
      {
          $actor = auth()->user();
          $role = $actor->role ?? null;
          $isLead = (bool) ($actor->is_hr_lead ?? false);
          if (! in_array($role, ['admin', 'hr', 'superadmin'], true) && ! $isLead) {
              abort(403, 'You do not have permission to manage secondments.');
          }
          if ($isLead && $role !== 'superadmin') {
              authorizeHrLeadForCountry((string) $user->country_code);
          }
      }
  }
  ```

**Routes to add** in `routes/web.php` (inside the admin/authed group — check existing patterns):

```php
Route::post('/admin/employees/{user}/secondments', [SecondmentController::class, 'store'])
    ->name('employees.secondments.store');
Route::delete('/admin/employees/{user}/secondments/{secondment}', [SecondmentController::class, 'destroy'])
    ->name('employees.secondments.destroy');
```

**Acceptance criteria:**
- An HR admin can set an employee's primary organization from the edit page.
- An HR admin can add/remove additional organizations via multi-select.
- An HR admin can add a secondment with org, start date, end date, and reason.
- An HR admin can delete a secondment.
- Changes are logged to `user_mutations`.
- An HR Lead (non-admin) can only edit employees in their managed countries.

---

### O6. Backfill — populate primary_organization from department for existing employees

**Goal:** Set `primary_organization` for all active employees based on their current primary department's `organization_id`, so no one loses their org assignment when PR syncs.

**New migration `database/migrations/<date>_backfill_primary_organization.php`:**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Backfill users.primary_organization from the primary department's
 * organization_id for all active employees. This ensures the PR sync
 * receives a non-null primary_organization for every employee after
 * the column is added.
 *
 * See API/HR_ORG_ASSIGNMENT_API_SPEC.md.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement(<<<SQL
            UPDATE users u
            LEFT JOIN user_departments ud ON ud.user_id = u.id AND ud.is_primary = 1
            LEFT JOIN departments d ON d.id = ud.department_id
            SET u.primary_organization = d.organization_id
            WHERE u.primary_organization IS NULL
              AND d.organization_id IS NOT NULL
              AND LOWER(u.status) = 'active'
        SQL);
    }

    public function down(): void
    {
        // No-op: we don't want to null out the column on rollback.
    }
};
```

**Acceptance criteria:**
- After running `php artisan migrate`, every active employee with a primary department has `primary_organization` set to that department's `organization_id`.
- Employees without a primary department have `primary_organization = NULL` (the serializer falls back to `primaryDepartment.organization_id` at runtime, which will also be null — these are edge cases that need manual HR attention).

---

### O7. Update CROSS_REPO_API_CONTRACT.md

**File to change:** `CROSS_REPO_API_CONTRACT.md` (both the copy in `1PWR HR/` and `hr_portal/`)

Update the "Employee item shape" line to include the new fields:

```
Employee item shape: id, employee_id, name, email, role, type, country, department, memberships[], primary_organization, primary_organization_id, additional_organizations[], secondments[], primary_deployment, status, headshot, employment_start_date, current_position_title, phone, last_updated_at, toolset_approvals[] (snake_case; secondment sub-objects use camelCase for PR compatibility).
```

---

### O8. Tests

**Files to create:**

- `tests/Feature/OrganizationAssignmentApiTest.php`:
  - Assert `GET /api/employees/directory` returns `primary_organization`, `additional_organizations`, `secondments` on each employee.
  - Assert an employee with an explicit `primary_organization` column returns that value.
  - Assert an employee with `primary_organization = NULL` falls back to `primaryDepartment.organization_id`.
  - Assert secondments are returned as an array of objects with `organizationId`, `startDate`, `endDate`, `reason`.
  - Assert an employee with no secondments returns `[]`, not `null`.

- `tests/Feature/SecondmentAdminTest.php`:
  - Assert an admin can create a secondment via POST.
  - Assert an admin can delete a secondment via DELETE.
  - Assert an HR Lead can only manage secondments for employees in their countries.
  - Assert a `user_mutation` row is created on each action.

- `tests/Feature/PrimaryOrganizationEditTest.php`:
  - Assert an admin can set `primary_organization` via the employee edit form.
  - Assert an admin can set `additional_organizations` via the edit form.
  - Assert the value persists and appears in the API response.

**Acceptance criteria:**
- `php artisan test --filter='OrganizationAssignment|Secondment|PrimaryOrganization'` is green.

---

## 4. Sequencing & dependencies

```
O1 (users columns) ─► O3 (models) ─► O4 (API serializer) ─► O7 (contract doc)
                                                        │
O2 (secondments table) ─► O3 (models) ─────────────────┘
                                                        │
O6 (backfill) ── after O1 ─────────────────────────────┤
                                                        │
O5 (admin UI) ── after O3 ──────────────────────────────┤
                                                        │
O8 (tests) ── after O4, O5 ────────────────────────────┘
```

Recommended order: **O1 → O2 → O3 → O6 → O4 → O5 → O8 → O7**

- O1 and O2 are independent schema changes; run them together.
- O3 (models) depends on both schema changes.
- O6 (backfill) depends on O1 and should run immediately after so no employee loses their org.
- O4 (API serializer) depends on O3 to have the `secondments` relationship available.
- O5 (admin UI) depends on O3 for the model and O4 for the API to test against.
- O8 (tests) should come after O4 and O5 so they cover the real behavior.
- O7 (docs) is last, just bookkeeping.

**One-time operator step after merge:** run `php artisan migrate` (which includes the backfill). Verify with:

```bash
# Check that active employees have primary_organization set
mysql -e "SELECT COUNT(*) FROM users WHERE primary_organization IS NULL AND LOWER(status)='active';" hr_portal
# Should be close to zero (only employees without a primary department)
```

---

## 5. What PR has already done (for reference — NOT part of this spec)

PR has already:

1. **HR API contract** (`functions/src/hr/hrDirectoryClient.ts`): Added `HrSecondment` interface and `primary_organization`, `additional_organizations`, `secondments` fields to the `HrEmployee` TypeScript interface.

2. **HR sync logic** (`functions/src/hr/hrEmployeeSyncCore.ts`): `organization`, `additionalOrganizations`, and `secondments` are now HR-owned fields. The sync always overwrites them from the HR API response. If HR returns `null`/missing, they are set to `null`/`[]`/`[]` respectively.

3. **User type** (`src/types/user.ts`): Added `Secondment` interface; moved `organization` and `additionalOrganizations` to the HR-owned block; added `secondments` field.

4. **Auth slice** (`src/store/slices/authSlice.ts`): `secondments` added to the Redux `User` interface.

5. **Auth service** (`src/services/auth.ts`): Loads `secondments` from Firestore on login (both normal and View As paths). Removed legacy Codeium→1PWR LESOTHO migration hack.

6. **User Management UI** (`src/components/admin/UserManagement.tsx`): Organization and Additional Organizations selects are read-only/disabled when HR-linked. Secondments display section with org name, date range, and reason. Org fields stripped from save payload for HR-linked users.

7. **Organization Selector** (`src/components/common/OrganizationSelector.tsx`): Active secondment orgs (date-checked) included in org filtering.

8. **Dashboard** (`src/components/dashboard/Dashboard.tsx`): Active secondment orgs included in "All Organizations" PR loading.

9. **PR Service** (`src/services/pr.ts`): Active secondment orgs included in requestor revision org reassignment check.

10. **Specifications.md**: Updated both "Organization Assignment" sections; added "HR Sync Organization Migration" section.

11. **Deployed**: Both Cloud Functions and Hosting are live on `pr-system-4ea55.web.app`.

**The only PR-side obligation going forward:** Keep the `prCatalogApi` (organizations + countries endpoints) up so HR can sync the org catalog. PR does not push org assignments to HR; HR is the source of truth.

---

## 6. Acceptance criteria (definition of done for the HR-repo agent)

Per work item, the bullets under each item in §3.

**Global definition of done:**

- [ ] `php artisan migrate` adds `primary_organization` and `additional_organizations` columns to `users`, creates the `secondments` table, and backfills `primary_organization` from primary department's `organization_id` for all active employees.
- [ ] `GET /api/employees/directory` returns `primary_organization` (string|null), `additional_organizations` (array), and `secondments` (array of `{organizationId, startDate, endDate, reason}`) on every employee object.
- [ ] `GET /api/employees/show/{id}` returns the same three fields.
- [ ] An HR admin can set primary organization, additional organizations, and manage secondments from the employee edit page.
- [ ] Secondment create/delete actions are logged to `user_mutations`.
- [ ] `php artisan test --filter='OrganizationAssignment|Secondment|PrimaryOrganization'` is green.
- [ ] `CROSS_REPO_API_CONTRACT.md` is updated with the new fields.
- [ ] After deploy + migrate, the PR sync (`hrEmployeeSyncFull` Cloud Function) receives non-null `primary_organization` for all active employees with a primary department.

When all of the above are true, HR is the canonical source for employee organization assignment, and PR's organization fields are fully HR-owned.

---

## 7. Smoke test (after deploy)

```bash
# 1. Check the API returns the new fields
curl -s -H "X-API-Key: $HR_API_KEY_PR_PORTAL" \
  "https://hr.1pwrafrica.com/api/employees/directory?country=LS" \
  | jq '.employees[0] | {primary_organization, additional_organizations, secondments}'

# 2. Check a specific employee
curl -s -H "X-API-Key: $HR_API_KEY_PR_PORTAL" \
  "https://hr.1pwrafrica.com/api/employees/show/1PWR0001" \
  | jq '{primary_organization, additional_organizations, secondments}'

# 3. Verify PR sync picks up the new fields
#    (run from PR project directory)
npx firebase functions:shell
> hrEmployeeSyncFull()
# Check Firestore: users/{uid} should have organization, additionalOrganizations, secondments populated
```
