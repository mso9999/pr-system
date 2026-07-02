# Field Camp Provisioning (in-app)

Replaces the offline spreadsheet `docs/260528 Lesotho_Field_Camp_Provisioning_v3.xlsx`
with an in-app, logged, mission-linked provisioning planner that is
**country / currency / menu / price aware**.

The feature spans two repos:

- **PR system (this repo)** — the planner UI, the calculation engine, the ration/menu/
  defaults/price reference data, the logged `provisioningPlans` collection, and the
  "Generate PR" bridge.
- **Fleet Hub (`1PWR FLEET/fleet-hub`)** — the canonical mission source. Track 1 added a
  numeric `crew_size` + optional `personnel_manifest` to missions so the planner has a
  reliable crew count (the old free-text `passengers` field is retained as notes only).

## Where things live

| Concern | Location |
| --- | --- |
| Calculation engine (pure TS port of the spreadsheet) | `src/utils/provisioningEngine.ts` |
| Engine golden-value tests | `src/utils/provisioningEngine.test.ts` |
| Type model (rations, menus, defaults, prices, plan) | `src/types/provisioning.ts` |
| Country-context resolver (org → catalog + prices) | `src/utils/provisioningContext.ts` |
| Provisioning plan Firestore service | `src/services/provisioningPlans.ts` |
| Fleet mission client (Cloud Functions) | `functions/src/fleet/fleetMissionClient.ts`, `functions/src/fleet/fleetMissions.ts` |
| Fleet mission frontend service | `src/services/fleetMissions.ts` |
| Wizard UI | `src/components/provisioning/ProvisioningWizard.tsx` (route `/provisioning`) |
| Generate-PR bridge | `createPRFromProvisioningPlan` in `src/services/pr.ts` |
| Admin reference-data forms | `src/components/admin/ReferenceDataManagement.tsx` (types: rations, provisioningMenus, provisioningDefaults, rationPrices) |
| Seed script (Lesotho catalog) | `scripts/seed-rations.ts` |
| Firestore rules | `firestore.rules` (provisioningPlans + referenceData_ration* blocks) |

## Data model

Four org-scoped reference-data collections (one org = one country = one catalog):

- `referenceData_rations` — issue items with category, class (`Food` / `Provision` /
  `Fixed`), issue qty per person-day, issue unit, nutrition per unit, optional
  `specialFormula` (`purchasedBread`, `steamedFlour`, `yeast`, `toiletPaper`), and pack
  planning (`simple` single pack or `bulk` large/medium/small tiers).
- `referenceData_provisioningMenus` — N-day meal cycle per org (default 7-day).
- `referenceData_provisioningDefaults` — planning defaults (nutrition targets, buffer,
  bread coverage days, flour/yeast ratios, toilet-roll person-days, currencies).
- `referenceData_rationPrices` — dated, org-scoped price book. One entry per
  (ration item × tier × currency) with `effectiveFrom` / `effectiveTo`. The engine
  resolves the "current" price as of the plan date.

`provisioningPlans` stores each saved plan: the Step-1 inputs (people, days, buffer,
defaults), the selected ration ids, per-line manual price overrides, the computed
shopping list, nutrition check, totals, a snapshot of the catalog + prices used, and
the linked Fleet mission. Plans get a sequential number
`PP-YYMMDD-NNNN-ORG-CC` via a Firestore counter.

## Engine formulas (ported from the spreadsheet)

- Adjusted person-days = `people × days × (1 + buffer)`.
- Required qty = `issueQty × adjustedPersonDays` (Food/Provision); `Fixed` items use
  their per-deployment qty unscaled.
- Special formulas:
  - `purchasedBread`: `0.12 × MIN(days, breadCoverageDays) / days`
  - `steamedFlour`: `(0.12/0.7) × flourPerLoafKg × MAX(days − breadCoverageDays, 0) / days`
  - `yeast`: `steamedFlourIssueQty × yeastProportion`
  - `toiletPaper`: `1 / personDaysPerToiletRoll`
- Bulk pack planning minimises excess while preferring larger packs (large/medium/small
  tier counts via the spreadsheet's `ROUNDUP`/`INT` logic). See
  `planBulkPacks` and the golden-value tests for the exact behaviour.
- Nutrition check sums `issueQty × nutritionPerUnit` across items vs. the org's targets.

## Mission prepopulation + override

When a Fleet mission is linked, the wizard prepopulates:

- **Number of people** ← mission `crew_size` (numeric, reliable as of Track 1).
- **Number of days** ← whole days between `departure_date` and `return_date`.

Procurement can override either (e.g. a 6-week mission provisioned for the first week
only). Overrides are flagged `inputsOverridden: true` on the saved plan.

## Setup & deployment

### 1. Fleet Hub (Track 1)

The Fleet Hub schema migration adds `crew_size` and `personnel_manifest` columns
idempotently on app boot (`migrateMissionsPersonnelManifest`). No manual migration
step is required; existing missions get `crew_size` backfilled from the `passengers`
text where a number is parseable, else 1. The mission planner UI now requires a
numeric crew size. Deploy Fleet Hub as usual (`npm run build` + hosting).

### 2. PR Cloud Functions

Add to `functions/.env`:

```
FLEET_API_BASE_URL=https://fm.1pwrafrica.com
FLEET_INTEGRATION_API_KEY=<key matching Fleet Hub's FLEET_INTEGRATION_API_KEY>
```

Then:

```
cd functions && npm run build
firebase deploy --only functions
```

This deploys `listFleetMissions`, `getFleetMission`, and `fleetSmokeTest` callables.

### 3. Seed the Lesotho ration catalog

```
cp scripts/_slowbuffer-polyfill.cjs /tmp/_slowbuffer-polyfill.cjs
NODE_OPTIONS="--require /tmp/_slowbuffer-polyfill.cjs" npm run seed-rations -- --dry-run
# review, then:
NODE_OPTIONS="--require /tmp/_slowbuffer-polyfill.cjs" npm run seed-rations
```

This seeds `referenceData_rations` (22 items), `provisioningDefaults`,
`provisioningMenus`, and indicative `rationPrices` for `1pwr_lesotho`.
**Replace the indicative prices with real procurement data via the admin UI.**

### 4. Firestore rules

`firestore.rules` adds explicit blocks for `provisioningPlans` and the four
`referenceData_ration*` / `provisioning*` collections. The existing catch-all still
grants authenticated access; the explicit blocks document the intended access shape.

```
firebase deploy --only firestore:rules
```

### 5. Frontend

```
npm run build
```

The wizard is reachable at `/provisioning` (nav: "Field Camp Provisioning").

## Testing

```
npx vitest run src/utils/provisioningEngine.test.ts
```

20 golden-value tests reproduce the spreadsheet's 4-people × 14-days × 5%-buffer
scenario (adjustedPersonDays 58.8; maize-meal pack plan; nutrition check; price
resolution ignoring expired / wrong-currency entries; cost totals).

## Generating a PR from a plan

In Step 3 of the wizard, "Save plan" then "Generate PR" opens a dialog collecting the
PR-classification fields the provisioning workflow doesn't own (department, project
category, site, expense type, required date). `createPRFromProvisioningPlan` builds
one PR line item per selected shopping-list line, sets the PR's estimated amount to
the plan's total food cost in the plan currency, and links the plan
(`status: pr_generated`, `generatedPrId`). The user is navigated to the new PR.

## Notes / follow-ups

- Nested ration fields (`packPlanning` bulk tiers, menu `days`) are seeded by
  `seed-rations.ts`; the admin form exposes the scalar fields plus selects. A richer
  repeatable-row editor for tiers/days can be added later.
- Indicative seeded prices must be replaced with real procurement data.
- The Fleet Hub `better-sqlite3` native binding does not build on Node 26 in some
  local environments; the Fleet schema test therefore runs in CI/deploy. TypeScript
  compilation (`npx tsc --noEmit`) is the local verification gate.
