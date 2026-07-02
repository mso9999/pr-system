/**
 * Field Camp Provisioning engine — a pure-TypeScript port of
 * `docs/260528 Lesotho_Field_Camp_Provisioning_v3.xlsx`.
 *
 * No Firestore, no React, no side effects. All functions are deterministic and
 * unit-tested against the spreadsheet's golden values (4 people × 14 days × 5% buffer
 * → adjustedPersonDays 58.8; maize-meal required 16.464 kg → "1 x 10 kg bag + 1 x 5 kg bag
 * + 1 x 2 kg bag"; energy 3605.34 kcal/person-day; total food cost LSL 2920.47).
 *
 * Currency-agnostic: the engine multiplies `buyQty × unitPrice` per line. Currency
 * tagging and FX conversion happen at the plan/UI layer.
 */
import type {
  RationItem,
  RationPriceEntry,
  RationPriceTier,
  NutritionTargets,
} from '../types/provisioning';

export interface ProvisioningInputs {
  numberOfPeople: number;
  numberOfDays: number;
  /** Procurement buffer as a fraction (e.g. 0.05 = 5%). */
  procurementBuffer: number;
  /** Max days purchased bread is supplied before switching to camp-made steamed bread. */
  breadCoverageDays: number;
  /** Kg wheat flour per ~700 g purchased-loaf equivalent. */
  flourPerLoafKg: number;
  /** Dry yeast as a proportion of flour weight. */
  yeastProportion: number;
  /** Person-days covered per toilet roll. */
  personDaysPerToiletRoll: number;
  nutritionTargets: NutritionTargets;
}

export interface ProvisioningLine {
  rationItemId: string;
  name: string;
  category: string;
  class: 'Food' | 'Provision' | 'Fixed';
  issueUnit: string;
  /** Effective issue quantity per person-day (after special-formula resolution). */
  issueQtyPerPersonDay: number;
  requiredQty: number;
  /** 'simple' = single pack size; 'bulk' = tiered large/medium/small; 'none' = nothing to buy. */
  packMode: 'simple' | 'bulk' | 'none';
  /** Human-readable purchase instruction, e.g. "1 x 10 kg bag + 1 x 5 kg bag". */
  packInstruction: string;
  /** Total bought quantity in the issue unit (sum of pack sizes × counts). */
  buyQty: number;
  excessQty: number;
  /** For bulk: which tier prices were used. null for simple-pack unit price. */
  tierPricesUsed?: { large?: number; medium?: number; small?: number } | null;
  /** Plan-time unit price (per simple pack, or weighted bulk price not used — see estCost). */
  unitPrice?: number;
  /** Price source: 'priceBook' (resolved) or 'manual' (procurement override). */
  priceSource: 'priceBook' | 'manual' | 'none';
  /** Resolved price-book entry ids per tier (for audit). */
  priceEntryIds?: { large?: string; medium?: string; small?: string; unit?: string } | null;
  estCost: number;
  selected: boolean;
}

export interface ProvisioningNutritionResult {
  energyKcal: number;
  proteinG: number;
  fruitVegG: number;
  targets: NutritionTargets;
  energyMeets: boolean;
  proteinMeets: boolean;
  fruitVegMeets: boolean;
  status: 'MEETS PLANNING TARGETS' | 'REVIEW RATION';
}

export interface ProvisioningTotals {
  totalFoodCost: number;
  costPerAdjustedPersonDay: number;
  lineCount: number;
  selectedLineCount: number;
}

/** Round half away from zero to `dp` decimals — matches Excel ROUND semantics for positive values. */
function round(value: number, dp = 0): number {
  const f = Math.pow(10, dp);
  return Math.round((value + Number.EPSILON) * f) / f;
}

export function computeAdjustedPersonDays(inputs: ProvisioningInputs): number {
  const { numberOfPeople, numberOfDays, procurementBuffer } = inputs;
  return numberOfPeople * numberOfDays * (1 + procurementBuffer);
}

/**
 * Effective issue quantity per person-day for a ration item. For most items this is
 * `item.issueQtyPerPersonDay`; items with `specialFormula` derive it from mission inputs
 * (purchased bread, steamed-bread flour, yeast, toilet paper).
 */
export function computeIssueQty(item: RationItem, inputs: ProvisioningInputs): number {
  const { numberOfDays, breadCoverageDays, flourPerLoafKg, yeastProportion, personDaysPerToiletRoll } = inputs;
  switch (item.specialFormula) {
    case 'purchasedBread':
      if (numberOfDays <= 0) return 0;
      return (0.12 * Math.min(numberOfDays, breadCoverageDays)) / numberOfDays;
    case 'steamedFlour':
      if (numberOfDays <= 0) return 0;
      return ((0.12 / 0.7) * flourPerLoafKg * Math.max(numberOfDays - breadCoverageDays, 0)) / numberOfDays;
    case 'yeast': {
      // Yeast qty is the steamed-flour issue qty × yeast proportion.
      const flourIssue = numberOfDays <= 0
        ? 0
        : ((0.12 / 0.7) * flourPerLoafKg * Math.max(numberOfDays - breadCoverageDays, 0)) / numberOfDays;
      return flourIssue * yeastProportion;
    }
    case 'toiletPaper':
      if (personDaysPerToiletRoll <= 0) return 0;
      return 1 / personDaysPerToiletRoll;
    default:
      return item.issueQtyPerPersonDay;
  }
}

/** Required quantity for a ration item given adjusted person-days. */
export function computeRequiredQty(item: RationItem, inputs: ProvisioningInputs, apd: number): number {
  const issueQty = computeIssueQty(item, inputs);
  if (item.class === 'Fixed') return item.issueQtyPerPersonDay; // per-deployment, not scaled
  return issueQty * apd;
}

export interface SimplePackResult {
  units: number;
  buyQty: number;
  excessQty: number;
  instruction: string;
}

/** Simple single-pack roundup: "N x packName". */
export function planSimplePack(requiredQty: number, packSize: number, packName: string): SimplePackResult {
  if (requiredQty <= 0 || packSize <= 0) {
    return { units: 0, buyQty: 0, excessQty: 0, instruction: 'None required' };
  }
  const units = Math.ceil(requiredQty / packSize);
  const buyQty = units * packSize;
  return {
    units,
    buyQty,
    excessQty: round(buyQty - requiredQty, 6),
    instruction: `${units} x ${packName}`,
  };
}

export interface BulkPackResult {
  largeN: number;
  mediumN: number;
  smallN: number;
  buyQty: number;
  excessQty: number;
  instruction: string;
}

/**
 * Tiered bulk-pack plan (large/medium/small) that minimises excess while preferring
 * larger packs. Faithful port of the spreadsheet's `Bulk Pack Planning` formulas.
 *
 * @param allowNone  when true (steamed flour), returns "None required" for zero demand
 *                   instead of an empty instruction.
 */
export function planBulkPacks(
  requiredQty: number,
  tiers: { large?: { size: number; packName: string }; medium?: { size: number; packName: string }; small?: { size: number; packName: string } },
  allowNone = false,
): BulkPackResult {
  const E = tiers.large?.size ?? 0;
  const I = tiers.medium?.size ?? 0;
  const M = tiers.small?.size ?? 0;
  const none: BulkPackResult = { largeN: 0, mediumN: 0, smallN: 0, buyQty: 0, excessQty: 0, instruction: allowNone ? 'None required' : '' };

  if (requiredQty <= 0) return none;
  if (E <= 0 && I <= 0 && M <= 0) return none;

  // F — number of large packs
  let F: number;
  if (I === 0 && M === 0) {
    F = Math.ceil(requiredQty / E);
  } else if (requiredQty <= E) {
    if (I === 0) {
      F = 0;
    } else if (M > 0 && E <= Math.ceil(requiredQty / M) * M) {
      F = 1;
    } else {
      F = 0;
    }
  } else {
    F = Math.floor(requiredQty / E);
  }

  // J — number of medium packs
  let J = 0;
  if (I > 0) {
    const rem1 = requiredQty - F * E;
    if (rem1 > 0) {
      if (rem1 <= I) {
        if (M === 0) {
          J = 1;
        } else if (I <= Math.ceil(rem1 / M) * M) {
          J = 1;
        } else {
          J = 0;
        }
      } else {
        J = Math.floor(rem1 / I);
      }
    }
  }

  // N — number of small packs
  let N = 0;
  if (M > 0) {
    const rem2 = requiredQty - F * E - J * I;
    if (rem2 > 0) {
      N = Math.ceil(rem2 / M);
    }
  }

  const buyQty = F * E + J * I + N * M;
  const parts: string[] = [];
  if (F > 0 && tiers.large) parts.push(`${F} x ${tiers.large.packName}`);
  if (J > 0 && tiers.medium) parts.push(`${J} x ${tiers.medium.packName}`);
  if (N > 0 && tiers.small) parts.push(`${N} x ${tiers.small.packName}`);
  return {
    largeN: F,
    mediumN: J,
    smallN: N,
    buyQty,
    excessQty: round(buyQty - requiredQty, 6),
    instruction: parts.length > 0 ? parts.join(' + ') : (allowNone ? 'None required' : ''),
  };
}

/**
 * Daily nutrition per person from a ration catalog. Sums `issueQty × nutritionPerUnit`
 * across all items (zero-nutrition items contribute 0). Matches the spreadsheet's
 * `Nutrition Check` sheet.
 */
export function computeNutrition(catalog: RationItem[], inputs: ProvisioningInputs): ProvisioningNutritionResult {
  let energyKcal = 0;
  let proteinG = 0;
  let fruitVegG = 0;
  for (const item of catalog) {
    const issueQty = computeIssueQty(item, inputs);
    energyKcal += issueQty * item.nutritionPerUnit.kcal;
    proteinG += issueQty * item.nutritionPerUnit.proteinG;
    fruitVegG += issueQty * item.nutritionPerUnit.fruitVegG;
  }
  const t = inputs.nutritionTargets;
  const energyMeets = energyKcal >= t.kcal;
  const proteinMeets = proteinG >= t.proteinG;
  const fruitVegMeets = fruitVegG >= t.fruitVegG;
  return {
    energyKcal: round(energyKcal, 2),
    proteinG: round(proteinG, 2),
    fruitVegG: round(fruitVegG, 2),
    targets: t,
    energyMeets,
    proteinMeets,
    fruitVegMeets,
    status: energyMeets && proteinMeets && fruitVegMeets ? 'MEETS PLANNING TARGETS' : 'REVIEW RATION',
  };
}

export interface ResolvedPrice {
  price: number;
  entryId: string;
  effectiveFrom: string;
}

/**
 * Resolve the current price-book entries for a given currency as of `asOf`.
 * Returns a map keyed `${rationItemId}|${tier ?? 'unit'}` → { price, entryId, effectiveFrom }.
 * The "current" entry is the one with the latest `effectiveFrom` that is ≤ asOf
 * and (effectiveTo is null/undefined OR effectiveTo ≥ asOf).
 */
export function resolveCurrentPrices(
  priceBook: RationPriceEntry[],
  currency: string,
  asOf: string,
): Map<string, ResolvedPrice> {
  const map = new Map<string, ResolvedPrice>();
  for (const entry of priceBook) {
    if (entry.currency !== currency) continue;
    const from = entry.effectiveFrom;
    const to = entry.effectiveTo ?? null;
    if (from > asOf) continue; // not yet effective
    if (to !== null && to < asOf) continue; // already expired
    const tierKey = entry.tier ?? 'unit';
    const key = `${entry.rationItemId}|${tierKey}`;
    const existing = map.get(key);
    if (!existing || entry.effectiveFrom > existing.effectiveFrom) {
      map.set(key, { price: entry.price, entryId: entry.id, effectiveFrom: entry.effectiveFrom });
    }
  }
  return map;
}

/**
 * Generate the full shopping list for a ration catalog given inputs and a resolved
 * price map. Prices are optional — lines without a resolved price get estCost 0 and
 * priceSource 'none'.
 */
export function generateShoppingList(
  catalog: RationItem[],
  inputs: ProvisioningInputs,
  priceMap?: Map<string, ResolvedPrice>,
): ProvisioningLine[] {
  const apd = computeAdjustedPersonDays(inputs);
  const lines: ProvisioningLine[] = [];

  for (const item of catalog) {
    const requiredQty = computeRequiredQty(item, inputs, apd);
    const issueQty = computeIssueQty(item, inputs);

    let packMode: ProvisioningLine['packMode'] = 'simple';
    let packInstruction = '';
    let buyQty = 0;
    let excessQty = 0;
    let tierPricesUsed: ProvisioningLine['tierPricesUsed'] = null;
    let priceEntryIds: ProvisioningLine['priceEntryIds'] = null;
    let estCost = 0;
    let priceSource: ProvisioningLine['priceSource'] = 'none';

    if (item.packPlanning.mode === 'bulk') {
      const tiers = item.packPlanning.tiers;
      const byTier = (t: 'large' | 'medium' | 'small') => tiers.find((x) => x.tier === t);
      const allowNone = item.specialFormula === 'steamedFlour';
      const result = planBulkPacks(
        requiredQty,
        {
          large: byTier('large') ? { size: byTier('large')!.size, packName: byTier('large')!.packName } : undefined,
          medium: byTier('medium') ? { size: byTier('medium')!.size, packName: byTier('medium')!.packName } : undefined,
          small: byTier('small') ? { size: byTier('small')!.size, packName: byTier('small')!.packName } : undefined,
        },
        allowNone,
      );
      packMode = result.instruction === 'None required' || requiredQty <= 0 ? 'none' : 'bulk';
      packInstruction = result.instruction;
      buyQty = result.buyQty;
      excessQty = result.excessQty;

      if (priceMap && packMode === 'bulk') {
        const tierCost: { large?: number; medium?: number; small?: number } = {};
        const ids: { large?: string; medium?: string; small?: string } = {};
        let cost = 0;
        let resolvedAny = false;
        if (result.largeN > 0) {
          const p = priceMap.get(`${item.id}|large`);
          if (p) { tierCost.large = p.price; ids.large = p.entryId; cost += result.largeN * p.price; resolvedAny = true; }
        }
        if (result.mediumN > 0) {
          const p = priceMap.get(`${item.id}|medium`);
          if (p) { tierCost.medium = p.price; ids.medium = p.entryId; cost += result.mediumN * p.price; resolvedAny = true; }
        }
        if (result.smallN > 0) {
          const p = priceMap.get(`${item.id}|small`);
          if (p) { tierCost.small = p.price; ids.small = p.entryId; cost += result.smallN * p.price; resolvedAny = true; }
        }
        tierPricesUsed = tierCost;
        priceEntryIds = ids;
        estCost = round(cost, 2);
        priceSource = resolvedAny ? 'priceBook' : 'none';
      }
    } else {
      const { packSize, packName } = item.packPlanning;
      const result = planSimplePack(requiredQty, packSize, packName);
      packMode = result.units === 0 ? 'none' : 'simple';
      packInstruction = result.instruction;
      buyQty = result.buyQty;
      excessQty = result.excessQty;
      if (priceMap && packMode === 'simple') {
        const p = priceMap.get(`${item.id}|unit`);
        if (p) {
          estCost = round(result.units * p.price, 2);
          priceSource = 'priceBook';
          priceEntryIds = { unit: p.entryId };
          tierPricesUsed = null;
        }
      }
    }

    lines.push({
      rationItemId: item.id,
      name: item.name,
      category: item.category,
      class: item.class,
      issueUnit: item.issueUnit,
      issueQtyPerPersonDay: round(issueQty, 6),
      requiredQty: round(requiredQty, 6),
      packMode,
      packInstruction,
      buyQty: round(buyQty, 6),
      excessQty,
      tierPricesUsed,
      unitPrice: undefined,
      priceSource,
      priceEntryIds,
      estCost,
      selected: true,
    });
  }

  return lines;
}

export function computeTotals(lines: ProvisioningLine[], apd: number): ProvisioningTotals {
  const selected = lines.filter((l) => l.selected);
  const totalFoodCost = selected.reduce((sum, l) => sum + l.estCost, 0);
  return {
    totalFoodCost: round(totalFoodCost, 2),
    costPerAdjustedPersonDay: apd > 0 ? round(totalFoodCost / apd, 2) : 0,
    lineCount: lines.length,
    selectedLineCount: selected.length,
  };
}

/** Convenience: full plan computation in one call. */
export function computePlan(
  catalog: RationItem[],
  inputs: ProvisioningInputs,
  priceBook: RationPriceEntry[],
  currency: string,
  asOf: string,
): {
  adjustedPersonDays: number;
  lines: ProvisioningLine[];
  nutrition: ProvisioningNutritionResult;
  totals: ProvisioningTotals;
} {
  const apd = computeAdjustedPersonDays(inputs);
  const priceMap = resolveCurrentPrices(priceBook, currency, asOf);
  const lines = generateShoppingList(catalog, inputs, priceMap);
  const nutrition = computeNutrition(catalog, inputs);
  const totals = computeTotals(lines, apd);
  return { adjustedPersonDays: round(apd, 6), lines, nutrition, totals };
}

export type RationTierKey = RationPriceTier;
