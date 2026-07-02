# HR Department Toolset Migration Spec

**Audience:** the agent that works in the `1PWR HR/hr_portal` Laravel repo.
**Author:** PR-repo agent (this file lives in the PR repo at `docs/HR_DEPARTMENT_TOOLSET_MIGRATION_SPEC.md`; copy it into the HR repo's `docs/` before starting, or work from this path).
**Status:** Ready to implement. PR-side catalog mirror (Deliverable A of the parent plan) is already shipped and deployed — PR now pulls `/api/departments` from HR and treats HR as canonical for the catalog.

This spec is **self-contained**: every work item lists exact HR-repo file paths, schema changes, controller methods, Blade views, validation rules, authorization, and acceptance criteria. PR files are cited with line ranges as the behavioral blueprint — reproduce the semantics exactly without guessing.

---

## 1. Context & goal

HR (`hr.1pwrafrica.com`, Laravel/Blade/MySQL) is the **canonical source of truth** for:

1. The **department catalog** — `departments` rows keyed by `(country_code, organization_id, name)`. PR mirrors this via `GET /api/departments` (already shipped on the HR side and consumed by PR).
2. **Employee → department memberships**, including **multi-department** (an employee in 2–3 departments) and **Lead** flags — currently owned by PR and not yet exposed by HR's API.

The HR-repo agent's job is to bring HR's admin tooling up to parity with PR's evolved membership model **and** expose the membership data via the existing read-only API so PR can stop owning it and consume it from HR instead.

**Non-goal:** PR-side changes. PR will do a *follow-up* switch to consume `memberships[]` from HR once B1+B2+B6 ship (see §5). That follow-up is **not** part of this spec.

---

## 2. Current HR state (as observed in the repo)

Catalog CRUD already exists and is country/org-scoped:

- `app/Http/Controllers/DepartmentController.php` — `index`, `store`, `rename`, `toggle`, `destroy`. Authorize gate `authorizeCatalog()` (`app/Http/Controllers/DepartmentController.php:203`) currently allows `admin`/`hr`/`superadmin` globally — **not** country-scoped. New rows are stamped `source_system='hr'`, `source_doc_id='hr_<slug>_<random>'`.
- `app/Http/Controllers/BulkDepartmentAssignmentController.php` — interactive + CSV bulk **primary** assignment. Already writes `UserMutation` audit rows and uses a transaction that demotes existing primary then upserts the new one.
- `resources/views/departments/index.blade.php` — list grouped by country/org, member counts, create form (country + org dropdowns sourced from `config/pr_org_map.php`).
- `resources/views/employees/show.blade.php:75` — currently shows "<small>Source: PR system. Edit in the PR System admin to change.</small>" for department. **Stale copy** — must be replaced once B1 lands (B7).

Pivot already supports the multi-dept shape:

- `database/migrations/2026_04_27_000002_create_departments_tables.php:46` — `user_departments` table with `is_primary` (line 50) and `is_lead` (line 51), unique on `(user_id, department_id)`, index on `(user_id, is_primary)`.
- `app/Models/User.php:165` — `departments()` belongsToMany through `user_departments`; `primaryDepartment()` at line 181 filters `is_primary`.
- `app/Models/Department.php:17` — `'aliases' => 'array'` (JSON cast); `memberships()` at line 20; `users()` at line 27.

API surface (read-only, `api.key` middleware):

- `app/Http/Controllers/Api/DepartmentDirectoryController.php:106` — `serializeDepartment()` exposes `id, name, country, organization_id, active, source_system, source_doc_id, source_synced_at, created_at, updated_at`. **`aliases` is omitted** (B3 adds it).
- `app/Http/Controllers/Api/EmployeeDirectoryController.php:192` — `serializeEmployee()` exposes a single scalar `department` (primary name). **No `memberships[]`** (B6 adds it).

Authorization helper:

- `app/Helpers/Global.php:345` — `currentUserManagedCountryCodes(): array|null` returns `null` for `superadmin` (all countries), the `admin_countries` rows for `admin`/`hr`, with a fallback to the user's own `country_code` when no rows exist.

Routing convention:

- `routes/web.php:283` — `Route::middleware('admin')->prefix('admin/departments')` group; bulk routes at lines 291–294.

Conventions to follow: routes under `admin` middleware; Blade + Soft UI; inline `$request->validate([...])`; audit via `UserMutation` (mirror `BulkDepartmentAssignmentController`'s use); tests in `tests/Feature/` mirroring `DepartmentCatalogAdminTest.php` and `BulkDepartmentAssignmentTest.php`.

---

## 3. Work items

### B1. Multi-department memberships admin UI

**Goal:** per-employee page where an authorized admin/HR can add/remove 2–3 `user_departments` rows for one employee, set **exactly one** `is_primary`, and toggle `is_lead` per membership.

**Files to create:**

- `app/Http/Controllers/Admin/EmployeeMembershipController.php` with:
  - `index(User $user)` — render the memberships partial with the user's current `user_departments` rows + the eligible department list (filtered to the user's country/org set).
  - `store(Request $request, User $user)` — create a membership. Body: `department_id`, `is_primary` (bool), `is_lead` (bool).
  - `update(Request $request, User $user, UserDepartment $membership)` — toggle `is_primary` / `is_lead`. When promoting to primary, demote the user's other `is_primary` rows in the same transaction (mirror `BulkDepartmentAssignmentController::applyPrimary`).
  - `destroy(User $user, UserDepartment $membership)` — remove a membership. Refuse if it would leave the user with zero memberships OR if it's the primary and another primary isn't being set in the same flow (see validation).
- `resources/views/employees/_memberships.blade.php` — partial rendered on `employees/show`. Tag-style UI: list current memberships with primary badge + Lead toggle + remove button; an "Add department" select filtered to eligible depts; "Save" submits the full slot set.

**Validation (port PR's `validateDepartmentSlots` exactly — `src/utils/userDepartmentAccess.ts:32`):**

```php
// 2–3 unique departments, exactly one primary, all within the user's country/org set.
$validated = $request->validate([
    'slots' => ['required', 'array', 'min:2', 'max:3'],
    'slots.*.department_id' => ['required', 'integer', 'exists:departments,id'],
    'slots.*.is_lead' => ['boolean'],
]);
$filled = collect($validated['slots'])->filter(fn ($s) => !empty($s['department_id']))->values();
if ($filled->count() < 2 || $filled->count() > 3) { /* fail */ }
if ($filled->pluck('department_id')->unique()->count() !== $filled->count()) { /* duplicates */ }
$primaryCount = $filled->where('is_primary', true)->count();
if ($primaryCount !== 1) { /* exactly one primary */ }
// Country/org check: every department's (country_code, organization_id) must be in the user's managed set.
```

PR's exact slot rules (the behavioral blueprint):

```33:43:src/utils/userDepartmentAccess.ts
export function validateDepartmentSlots(
  slots: Array<{ departmentId: string; isLead: boolean }>
): DepartmentMembership[] | null {
  const filled = slots.filter((s) => s.departmentId && s.departmentId.trim());
  if (filled.length < 2 || filled.length > 3) return null;
  const ids = filled.map((s) => s.departmentId.trim());
  if (new Set(ids).size !== ids.length) return null;
  return filled.map((s) => ({
    departmentId: s.departmentId.trim(),
    isLead: !!s.isLead,
  }));
}
```

The `DepartmentMembership` shape PR uses (`src/types/user.ts:24`):

```24:28:src/types/user.ts
export interface DepartmentMembership {
  departmentId: string;
  /** True if this employee is a lead for this department */
  isLead: boolean;
}
```

**Routes to add (in `routes/web.php` under the `admin` middleware group):**

```php
Route::middleware('admin')->prefix('admin/employees/{user}/memberships')->group(function () {
    Route::get('/', [EmployeeMembershipController::class, 'index'])->name('employees.memberships.index');
    Route::post('/', [EmployeeMembershipController::class, 'store'])->name('employees.memberships.store');
    Route::patch('/{membership}', [EmployeeMembershipController::class, 'update'])->name('employees.memberships.update');
    Route::delete('/{membership}', [EmployeeMembershipController::class, 'destroy'])->name('employees.memberships.destroy');
});
```

**Authorization:** use the new `authorizeHrLeadForCountry($countryCode)` helper from B2. The caller must be `superadmin` **or** an `hr_lead` whose managed countries include the employee's `country_code`.

**Audit:** write a `UserMutation` row per change (mirror `BulkDepartmentAssignmentController`'s pattern), with `action='memberships_updated'`, `before` = old slots JSON, `after` = new slots JSON.

**Acceptance criteria:**
- An HR Lead for LS can add a 2nd/3rd department to an LS employee, set one primary, toggle Lead, and remove a slot.
- Submitting 1 slot, 4 slots, duplicate departments, or zero/two primaries is rejected with a validation error.
- A department from a country the caller doesn't manage is rejected.
- Every change appears in the profile's "Profile Change History" panel.

---

### B2. `hr_lead` country-scoped role

**Goal:** introduce an `hr_lead` role (or extend `admin_countries` semantics) so an HR Lead can manage employees + toggle multi-department **only for their assigned countries**. `superadmin` assigns the role and its country scope.

**Files to change/create:**

- `app/Helpers/Global.php` — add `authorizeHrLeadForCountry(string $countryCode): void` that aborts 403 unless `auth()->user()->role === 'superadmin'` **or** `in_array(strtoupper($countryCode), currentUserManagedCountryCodes() ?? [], true)`. Reuse the existing `currentUserManagedCountryCodes()` at `app/Helpers/Global.php:345` — extend it to also return the `hr_lead` role's countries (currently it only handles `admin`/`hr`; add `hr_lead` to the `in_array` check at line ~352).
- `app/Http/Controllers/DepartmentController.php:203` — replace `authorizeCatalog()` with a country-scoped version. For `store`/`rename`/`toggle`/`destroy`, after the existing role gate, call `authorizeHrLeadForCountry($department->country_code)` (or the form's `country_code` for `store`). A superadmin can touch any country; an `hr_lead` only their own.
- `app/Http/Controllers/Admin/EmployeeMembershipController.php` (from B1) — call `authorizeHrLeadForCountry($user->country_code)` in every method.
- Role assignment UI: extend the existing user-edit surface (or add a small admin page) where a `superadmin` can set `role='hr_lead'` and pick `admin_countries` rows. Only `superadmin` may assign `hr_lead` and its country scope.

**Mirror PR's exact authorization rules:**

```14:24:src/utils/userDepartmentAccess.ts
export function canToggleMultiDepartmentAssignment(
  caller: Pick<User, 'permissionLevel' | 'isHrLead' | 'hrLeadCountryCodes'> | null | undefined,
  targetOrgCountry: string | undefined
): boolean {
  if (!caller) return false;
  if (caller.permissionLevel === 1) return true;
  if (!caller.isHrLead || !caller.hrLeadCountryCodes?.length) return false;
  const target = normalizeCountryCode(targetOrgCountry);
  if (!target) return false;
  return caller.hrLeadCountryCodes.map(normalizeCountryCode).includes(target);
}
```

```27:29:src/utils/userDepartmentAccess.ts
/** Only superadmin may assign HR Lead role and country scope to other users. */
export function canManageHrLeadMeta(caller: Pick<User, 'permissionLevel'> | null | undefined): boolean {
  return caller?.permissionLevel === 1;
}
```

PR's user-type fields that encode this (`src/types/user.ts:72`):

```72:75:src/types/user.ts
  /** HR Lead: may enable multi-department appointments for employees in countries listed in hrLeadCountryCodes. Set by admin only. */
  isHrLead?: boolean;
  /** ISO-2 country codes this HR Lead may manage. Set by admin only. */
  hrLeadCountryCodes?: string[];
```

**Semantics to reproduce:** `superadmin` ≡ PR permission level 1 (all countries). `hr_lead` ≡ PR `isHrLead` with `hrLeadCountryCodes`. Only `superadmin` may grant `hr_lead` and set its countries (PR `canManageHrLeadMeta`). Country comparison is case-insensitive ISO-2 (PR `normalizeCountryCode` uppercases + trims).

**Acceptance criteria:**
- An `hr_lead` for `LS` can manage LS employees' memberships and LS catalog rows, but gets 403 on `BJ` rows.
- A `superadmin` can manage any country.
- Only `superadmin` can grant the `hr_lead` role and edit someone's `admin_countries`.
- `admin`/`hr` roles keep behaving as today (they are not granted multi-dept toggle unless also `hr_lead`).

---

### B3. Alias editing

**Goal:** the `aliases` JSON column already exists on `departments` (`app/Models/Department.php:17`). Add UI to edit aliases and expose them in the API.

**Files to change:**

- `app/Http/Controllers/DepartmentController.php` — add `aliases(Request $request, Department $department)` (route `POST /admin/departments/{department}/aliases`) that validates `aliases` is an array of unique non-empty strings (no duplicates within the same `organization_id`), casts to JSON, saves, and writes a `department_mutations` row (B5) with `action='alias_changed'`.
- `resources/views/departments/index.blade.php` — add a tag-input on each row (or in an edit modal) for aliases. Reuse the existing Soft UI tag styling.
- `app/Http/Controllers/Api/DepartmentDirectoryController.php:106` — add `'aliases' => $d->aliases ?? []` to `serializeDepartment()`. Today it's omitted:

```106:120:app/Http/Controllers/Api/DepartmentDirectoryController.php
    private function serializeDepartment(Department $d): array
    {
        return [
            'id'                => $d->id,
            'name'              => $d->name,
            'country'           => $d->country_code,
            'organization_id'   => $d->organization_id,
            'active'            => (bool) $d->active,
            'source_system'     => $d->source_system,
            'source_doc_id'     => $d->source_doc_id,
            'source_synced_at'  => optional($d->source_synced_at)->toIso8601String(),
            'created_at'        => optional($d->created_at)->toIso8601String(),
            'updated_at'        => optional($d->updated_at)->toIso8601String(),
        ];
    }
```

PR already indexes aliases in its resolver (`functions/src/hr/departmentResolver.ts`), so once HR exposes them, PR's nightly catalog sync will pick them up automatically and the employee resolver will match against them — no PR change needed.

**Acceptance criteria:**
- An admin can add/remove aliases on a department via the catalog page.
- Duplicate aliases within the same org are rejected.
- `GET /api/departments` and `GET /api/departments/{id}` include `aliases: string[]`.
- A `department_mutations` row is written with `action='alias_changed'`.

---

### B4. Catalog list filters + pagination

**Goal:** add country, organization, and active filters to the catalog list; keep grouping by country/org.

**Files to change:**

- `app/Http/Controllers/DepartmentController.php` `index()` — accept `?country=&organization=&active=&q=` query params, filter the query before grouping. Keep the grouped-by-(country,org) response shape so the Blade view stays structural.
- `resources/views/departments/index.blade.php` — add a filter bar (country select from `pr_org_map` values, org select, active tri-state, name search). Reuse the jQuery DataTables already present in the codebase for the flat table inside each group; keep pagination server-side if the catalog grows beyond ~500 rows (today it's ~114, so client-side is fine).

**Acceptance criteria:**
- Filtering by country=LS shows only LS rows; filtering active=true hides tombstoned rows.
- Name search matches name OR any alias.
- The grouped layout is preserved.

---

### B5. Catalog audit trail

**Goal:** a read-only history of catalog mutations, mirroring `policy_mutations` / `UserMutation`.

**Schema — new migration `database/migrations/<date>_create_department_mutations_table.php`:**

```php
Schema::create('department_mutations', function (Blueprint $table) {
    $table->bigIncrements('id');
    $table->foreignId('department_id')->constrained()->cascadeOnDelete();
    $table->string('action', 32); // created|renamed|deactivated|activated|deleted|alias_changed
    $table->json('before')->nullable();
    $table->json('after')->nullable();
    $table->foreignId('user_id')->nullable(); // the admin who made the change
    $table->timestamps();
    $table->index(['department_id', 'created_at']);
});
```

**Files to change:**

- `app/Models/DepartmentMutation.php` — Eloquent model with `'before' => 'array', 'after' => 'array'` casts.
- `app/Http/Controllers/DepartmentController.php` — write a `DepartmentMutation` row from `store` (`created`), `rename` (`renamed`, before/after name), `toggle` (`activated`/`deactivated`), `destroy` (`deleted`), and the new `aliases` action (`alias_changed`). Wrap each in the existing mutation's transaction.
- `resources/views/departments/index.blade.php` — add a "History" tab/panel per department (or a global `/admin/departments/mutations` page) listing mutations newest-first with actor + before/after diff.

**Acceptance criteria:**
- Every create/rename/toggle/delete/alias change writes exactly one `department_mutations` row with the actor's `user_id`.
- The History panel renders the diff read-only.
- Deleting a department cascades its mutation rows (per the FK `cascadeOnDelete`).

---

### B6. API extensions for PR consumption

**Goal:** extend the employee directory API so each record includes its **full memberships[]** and **primary_organization_id**. This is the unblock for PR to stop owning multi-dept + Lead and consume them from HR. Keep backward compatibility: the scalar `department` field stays (primary name) so existing consumers (Fleet Hub, CC Portal) don't break.

**Files to change:**

- `app/Http/Controllers/Api/EmployeeDirectoryController.php:192` — in `serializeEmployee()`, eager-load `$u->departments` (the belongsToMany at `app/Models/User.php:165`) and emit:

```php
'memberships' => $u->departments->map(fn (Department $d) => [
    'department_id'         => $d->id,
    'department_name'       => $d->name,
    'organization_id'       => $d->organization_id,
    'country'               => $d->country_code,
    'is_primary'            => (bool) optional($u->userDepartments->where('department_id', $d->id)->first())->is_primary,
    'is_lead'               => (bool) optional($u->userDepartments->where('department_id', $d->id)->first())->is_lead,
])->values(),
'primary_organization_id' => optional($u->primaryDepartment->first())->organization_id,
```

- Eager-load `userDepartments` in the `index()` query (`->load(['profile', 'currentPosition.department', 'primaryDepartment', 'departments.pivot'])` at `app/Http/Controllers/Api/EmployeeDirectoryController.php:77`) to avoid N+1.
- Apply the same change to `show()` (`->load([...])` at line 152).
- **Keep** the existing scalar `department` field at line 208 unchanged for backward compat.

PR's `DepartmentMembership` shape that this must populate (`src/types/user.ts:24`) is `{ departmentId, isLead }`; PR's follow-up sync will map `memberships[].department_id` → `departmentId` and `memberships[].is_lead` → `isLead`, and use `is_primary` to set `departmentMemberships` + `multiDepartmentAppointmentsEnabled` (`src/types/user.ts:68`):

```68:71:src/types/user.ts
  /** When true, user has 2–3 department assignments (see departmentMemberships). Default false. */
  multiDepartmentAppointmentsEnabled?: boolean;
  /** Used when multiDepartmentAppointmentsEnabled is true: 2–3 departments, each with optional Lead. */
  departmentMemberships?: DepartmentMembership[];
```

**Acceptance criteria:**
- `GET /api/employees/directory` and `GET /api/employees/show/{id}` include `memberships: [{ department_id, department_name, organization_id, country, is_primary, is_lead }]` and `primary_organization_id`.
- The scalar `department` field is unchanged (Fleet Hub / CC Portal regression test stays green).
- A user with 3 departments and one primary + one Lead serializes correctly.
- No N+1 queries (verify with `DB::enableQueryLog()` in a test).

---

### B7. Stale-copy cleanup

**Goal:** remove the "Edit in the PR System admin to change" copy once B1 lands.

**File to change:**

- `resources/views/employees/show.blade.php:75` — replace

```75:75:resources/views/employees/show.blade.php
                                <small class="text-xs text-muted d-block mt-1">Source: PR system. Edit in the PR System admin to change.</small>
```

with HR-native copy + a link to the new memberships route, e.g. `<a href="{{ route('employees.memberships.index', $user) }}">Manage department memberships</a>`.

**Acceptance criteria:**
- The PR-edit copy is gone; the link points at the B1 memberships page.
- Only authorized callers see the link (hide for viewers).

---

### B8. Tests

**Files to extend/create:**

- `tests/Feature/DepartmentCatalogAdminTest.php` — extend with: alias editing (B3), country filter (B4), audit row per mutation (B5), `hr_lead` country scoping on catalog mutations (B2).
- `tests/Feature/BulkDepartmentAssignmentTest.php` — extend with `hr_lead` country scoping on bulk primary.
- `tests/Feature/EmployeeMembershipControllerTest.php` (new) — multi-dept CRUD (2–3 slots), Lead toggle, primary uniqueness (reject 0/2 primaries, reject duplicates, reject 1/4 slots), `hr_lead` can edit their country only, `superadmin` can edit any, `admin`/`hr` without `hr_lead` cannot toggle multi-dept, audit row written.
- `tests/Feature/DepartmentDirectoryApiMembershipsTest.php` (new) — `/api/departments` includes `aliases`; `/api/employees/directory` and `/api/employees/show/{id}` include `memberships[]` + `primary_organization_id`; scalar `department` unchanged; no N+1.

**Acceptance criteria:**
- `php artisan test --filter='Department|Membership'` is green.
- A coverage report shows the new controllers + API serializer methods exercised.

---

## 4. Sequencing & dependencies

```
B2 (hr_lead role) ─┐
B1 (memberships UI)─┼─► B7 (stale-copy cleanup)
B6 (API memberships)┘
B3 (aliases) ── independent
B4 (filters) ── independent
B5 (audit) ──── independent (but B3/B1 should write audit rows, so land B5 first or together)
B8 (tests) ──── follows each work item
```

**Critical path:** B1 + B2 + B6. They unblock PR consuming multi-dept + Lead from HR. B3/B4/B5 are independent polish. B7 depends on B1.

Recommended order: **B5 → B2 → B1 → B6 → B3 → B4 → B7 → B8** (with tests written alongside each, then a final B8 sweep).

---

## 5. What PR will do once HR ships B1+B2+B6 (follow-up, NOT part of this spec)

Once HR's `/api/employees/directory` exposes `memberships[]`, PR will make a **separate follow-up change** (in the PR repo):

- Extend `functions/src/hr/hrDirectoryClient.ts` `HrEmployee` with `memberships: { department_id, department_name, organization_id, is_primary, is_lead }[]` and `primary_organization_id`.
- In `functions/src/hr/hrEmployeeSyncCore.ts` `hrOwnedPatch`, when `emp.memberships` is present, write `multiDepartmentAppointmentsEnabled = memberships.length >= 2` and `departmentMemberships = memberships.map(m => ({ departmentId: resolver.resolveByHrId(m.department_id), isLead: m.is_lead }))`. The resolver gains a by-`hrId` lookup (HR's numeric `id` is already mirrored onto PR docs as `hrId` by the catalog sync).
- PR's `users` Firestore docs stop owning multi-dept memberships; the `canToggleMultiDepartmentAssignment` / `canManageHrLeadMeta` gates in `src/utils/userDepartmentAccess.ts` stay (they're used by PR's own admin UI for the *transition period* and can be retired once HR is fully trusted).
- PR's department admin UI stays read-only (already done in Deliverable A).

This is a future PR-side plan, tracked here for visibility — **do not implement it in the HR repo.**

---

## 6. Acceptance criteria (definition of done for the HR-repo agent)

Per work item, the bullets under each item in §3.

**Global definition of done:**

- [ ] `php artisan test` is green (existing + new tests).
- [ ] An HR Lead in LS can manage LS employees' memberships and LS catalog rows; they get 403 on BJ. A superadmin can manage any country.
- [ ] Multi-dept validation rejects 1/4 slots, duplicate departments, and 0/2 primaries; accepts exactly 2–3 unique departments with exactly one primary.
- [ ] `GET /api/departments` and `/api/departments/{id}` include `aliases`.
- [ ] `GET /api/employees/directory` and `/api/employees/show/{id}` include `memberships[]` + `primary_organization_id`; the scalar `department` field is unchanged (Fleet Hub / CC Portal regression tests green).
- [ ] Every catalog create/rename/toggle/delete/alias change and every membership change writes an audit row (`DepartmentMutation` / `UserMutation`).
- [ ] The "Edit in the PR System admin to change" copy on `employees/show.blade.php:75` is replaced with an HR-native memberships link.
- [ ] PR can pull `/api/departments` and `/api/employees/directory` (with memberships) using the existing `HR_API_KEY_PR_PORTAL` and confirm the response shapes match this spec.

When all of the above are true, notify the PR-repo owner so they can schedule the PR-side follow-up described in §5.
