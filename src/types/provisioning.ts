import type { ReferenceDataItem } from './referenceData';

/**
 * Field Camp Provisioning types — country/currency/menu/price aware.
 *
 * Four org-scoped reference-data collections under the `referenceData_*` pattern:
 *   - rations               : the catalog of issue items (per-country pack sizes + nutrition)
 *   - provisioningMenus     : editable N-day meal cycle per country
 *   - provisioningDefaults  : per-country planning defaults (targets, bread, hygiene, currencies)
 *   - rationPrices          : dated price book (per item / tier / currency / supplier)
 *
 * All are keyed off the org's `countryCode` + `baseCurrency` from `referenceData_organizations`.
 * Ported from `docs/260528 Lesotho_Field_Camp_Provisioning_v3.xlsx`.
 */

export type RationClass = 'Food' | 'Provision' | 'Fixed';

export type RationCategory =
  | 'Staples'
  | 'Protein'
  | 'Dairy'
  | 'Cooking Inputs'
  | 'Vegetables & Fruit'
  | 'Seasoning'
  | 'Issued Beverages'
  | 'Kitchen & Hygiene';

/**
 * Discriminator for items whose issue-qty/person-day is derived from mission inputs
 * rather than a flat constant. Mirrors the spreadsheet's special formulas.
 *   - purchasedBread : 0.12 × MIN(days, breadCoverageDays) / days   (kg/person-day)
 *   - steamedFlour   : (0.12/0.7) × flourPerLoafKg × MAX(days − breadCoverageDays, 0) / days
 *   - yeast          : steamedFlourIssueQty × yeastProportion
 *   - toiletPaper    : 1 / personDaysPerToiletRoll
 */
export type RationSpecialFormula =
  | 'purchasedBread'
  | 'steamedFlour'
  | 'yeast'
  | 'toiletPaper';

export interface RationPackTier {
  tier: 'large' | 'medium' | 'small';
  /** Display name e.g. "10 kg bag", "6 × 1 L case". */
  packName: string;
  /** Numeric size in the issue unit (e.g. 10 for a 10 kg bag when issueUnit is kg). */
  size: number;
  /** Unit of the pack size (usually equals issueUnit). */
  unit: string;
}

export type RationPackPlanning =
  | { mode: 'simple'; packSize: number; packName: string }
  | { mode: 'bulk'; tiers: RationPackTier[] };

export interface RationNutritionPerUnit {
  kcal: number;
  proteinG: number;
  fruitVegG: number;
}

/**
 * A single issue item in a country's ration catalog.
 * Stored in `referenceData_rations` (org-scoped).
 */
export interface RationItem extends ReferenceDataItem {
  category: RationCategory;
  class: RationClass;
  /** Issue quantity per person-day in `issueUnit`. For Fixed-class items this is the per-deployment quantity. */
  issueQtyPerPersonDay: number;
  issueUnit: string;
  nutritionPerUnit: RationNutritionPerUnit;
  procurementNote?: string;
  /** When set, `issueQtyPerPersonDay` is the fallback and the formula drives the effective qty. */
  specialFormula?: RationSpecialFormula;
  packPlanning: RationPackPlanning;
}

export interface ProvisioningMenuDay {
  day: number;
  breakfast: string;
  midday: string;
  evening: string;
}

/**
 * An N-day meal cycle for a country. Stored in `referenceData_provisioningMenus` (org-scoped).
 * Default is a 7-day cycle; N-day supported. Meals are free-text labels that may reference ration item names.
 */
export interface ProvisioningMenu extends ReferenceDataItem {
  /** Number of days in the cycle (default 7). */
  cycleLength: number;
  days: ProvisioningMenuDay[];
}

export interface NutritionTargets {
  kcal: number;
  proteinG: number;
  fruitVegG: number;
}

/**
 * Per-country planning defaults. Stored in `referenceData_provisioningDefaults` (org-scoped, one doc per org).
 * Preloads the planner's Step 1 inputs when a country is selected.
 */
export interface ProvisioningDefaults extends ReferenceDataItem {
  nutritionTargets: NutritionTargets;
  /** Default procurement buffer (fraction, e.g. 0.05 = 5%). */
  defaultBuffer: number;
  /** Max days purchased bread is supplied before switching to camp-made steamed bread. */
  breadCoverageDays: number;
  /** Kg wheat flour per ~700 g purchased-loaf equivalent. */
  flourPerLoafKg: number;
  /** Dry yeast as a proportion of flour weight. */
  yeastProportion: number;
  /** Person-days covered per toilet roll. */
  personDaysPerToiletRoll: number;
  /** Plan currency (mirrors org baseCurrency). */
  defaultCurrency: string;
  /** Optional reporting currency for indicative conversion (e.g. USD, ZAR). */
  reportingCurrency?: string;
}

export type RationPriceTier = 'large' | 'medium' | 'small' | null;

/**
 * A dated price-book entry for a ration item / pack tier / currency. Stored in
 * `referenceData_rationPrices` (org-scoped). The latest entry with `effectiveTo === null`
 * (or the most recent `effectiveFrom <= asOf`) is the "current" price.
 */
export interface RationPriceEntry extends ReferenceDataItem {
  /** RationItem doc id this price applies to. */
  rationItemId: string;
  /** Pack tier for bulk items; null for simple-pack unit price. */
  tier: RationPriceTier;
  packName?: string;
  currency: string;
  price: number;
  /** Optional vendor (referenceData_vendors doc id). */
  supplierId?: string;
  /** ISO date from which this price is effective. */
  effectiveFrom: string;
  /** ISO date until which this price is effective; null means "current/open". */
  effectiveTo?: string | null;
  source?: string;
  note?: string;
}

// ── Provisioning plan (logged, historical) ────────────────────────────────────────

export type ProvisioningPlanStatus = 'draft' | 'confirmed' | 'pr_generated' | 'archived';

export interface ProvisioningPlanSnapshot {
  rations: Array<{
    id: string;
    name: string;
    category: string;
    class: RationClass;
    issueQtyPerPersonDay: number;
    issueUnit: string;
  }>;
  prices: Array<{
    rationItemId: string;
    tier: RationPriceTier;
    price: number;
    currency: string;
    priceEntryId?: string;
  }>;
}

export interface ProvisioningPlan {
  id: string;
  /** Human-readable plan number, e.g. PP-260702-0001-1PWR_LSO-LS. */
  planNumber: string;
  organizationId: string;
  organizationName: string;
  countryCode: string;
  currency: string;
  reportingCurrency?: string;

  /** Linked Fleet mission (optional) — prepopulates people/days. */
  fleetMissionId?: string;
  fleetMissionTitle?: string;
  fleetMissionUrl?: string;

  /** Step 1 inputs (mission + overrides). */
  numberOfPeople: number;
  numberOfDays: number;
  procurementBuffer: number;
  breadCoverageDays: number;
  flourPerLoafKg: number;
  yeastProportion: number;
  personDaysPerToiletRoll: number;
  nutritionTargets: NutritionTargets;
  /** True when numberOfPeople/days were overridden by procurement (vs mission defaults). */
  inputsOverridden?: boolean;

  /** Step 2 — selected ration item ids (subset of the org catalog). */
  selectedRationIds: string[];
  /** Per-line manual price overrides: key = `${rationItemId}|${tier ?? 'unit'}` → price. */
  manualPriceOverrides?: Record<string, number>;

  /** Step 3 — computed shopping list (snapshot at save time). */
  adjustedPersonDays: number;
  lines: import('../utils/provisioningEngine').ProvisioningLine[];
  nutrition: import('../utils/provisioningEngine').ProvisioningNutritionResult;
  totals: import('../utils/provisioningEngine').ProvisioningTotals;

  /** Audit / lifecycle. */
  status: ProvisioningPlanStatus;
  generatedPrId?: string;
  createdByUid: string;
  createdByName: string;
  createdByEmail?: string;
  createdAt: string;
  updatedAt: string;
  notes?: string;
  snapshot: ProvisioningPlanSnapshot;
}

