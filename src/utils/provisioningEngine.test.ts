import { describe, expect, it } from 'vitest';
import {
  computeAdjustedPersonDays,
  computeIssueQty,
  computeRequiredQty,
  planSimplePack,
  planBulkPacks,
  computeNutrition,
  resolveCurrentPrices,
  generateShoppingList,
  computePlan,
} from './provisioningEngine';
import type { RationItem, RationPriceEntry } from '../types/provisioning';
import type { ProvisioningInputs } from './provisioningEngine';

// ── Spreadsheet golden inputs: 4 people × 14 days × 5% buffer ──────────────────────
const inputs: ProvisioningInputs = {
  numberOfPeople: 4,
  numberOfDays: 14,
  procurementBuffer: 0.05,
  breadCoverageDays: 7,
  flourPerLoafKg: 0.7,
  yeastProportion: 0.015,
  personDaysPerToiletRoll: 40,
  nutritionTargets: { kcal: 3000, proteinG: 80, fruitVegG: 400 },
};

const APD = 4 * 14 * 1.05; // 58.8

describe('provisioningEngine — adjusted person-days', () => {
  it('matches the spreadsheet: 4 × 14 × 1.05 = 58.8', () => {
    expect(computeAdjustedPersonDays(inputs)).toBeCloseTo(58.8, 6);
  });
});

describe('provisioningEngine — special formulas', () => {
  it('purchased bread: 0.12 × MIN(14, 7) / 14 = 0.06', () => {
    const bread: RationItem = {
      id: 'bread', name: 'Purchased Bread', category: 'Staples', class: 'Food',
      issueQtyPerPersonDay: 0, issueUnit: 'kg',
      nutritionPerUnit: { kcal: 2650, proteinG: 90, fruitVegG: 0 },
      specialFormula: 'purchasedBread',
      packPlanning: { mode: 'simple', packSize: 1, packName: 'loaf (700 g)' },
    };
    expect(computeIssueQty(bread, inputs)).toBeCloseTo(0.06, 6);
    expect(computeRequiredQty(bread, inputs, APD)).toBeCloseTo(3.528, 6);
  });

  it('steamed flour: (0.12/0.7) × 0.7 × MAX(14−7,0) / 14 = 0.06', () => {
    const flour: RationItem = {
      id: 'flour', name: 'Wheat Flour (steamed)', category: 'Staples', class: 'Food',
      issueQtyPerPersonDay: 0, issueUnit: 'kg',
      nutritionPerUnit: { kcal: 3640, proteinG: 103, fruitVegG: 0 },
      specialFormula: 'steamedFlour',
      packPlanning: { mode: 'bulk', tiers: [
        { tier: 'large', packName: '10 kg bag', size: 10, unit: 'kg' },
        { tier: 'medium', packName: '5 kg bag', size: 5, unit: 'kg' },
        { tier: 'small', packName: '1 kg bag', size: 1, unit: 'kg' },
      ] },
    };
    expect(computeIssueQty(flour, inputs)).toBeCloseTo(0.06, 6);
    expect(computeRequiredQty(flour, inputs, APD)).toBeCloseTo(3.528, 6);
  });

  it('yeast: 0.06 × 0.015 = 0.0009', () => {
    const yeast: RationItem = {
      id: 'yeast', name: 'Instant Yeast', category: 'Cooking Inputs', class: 'Food',
      issueQtyPerPersonDay: 0, issueUnit: 'kg',
      nutritionPerUnit: { kcal: 0, proteinG: 0, fruitVegG: 0 },
      specialFormula: 'yeast',
      packPlanning: { mode: 'simple', packSize: 0.01, packName: '10 g sachet' },
    };
    expect(computeIssueQty(yeast, inputs)).toBeCloseTo(0.0009, 6);
  });

  it('toilet paper: 1 / 40 = 0.025 rolls/person-day', () => {
    const tp: RationItem = {
      id: 'tp', name: 'Toilet Paper', category: 'Kitchen & Hygiene', class: 'Provision',
      issueQtyPerPersonDay: 0, issueUnit: 'roll',
      nutritionPerUnit: { kcal: 0, proteinG: 0, fruitVegG: 0 },
      specialFormula: 'toiletPaper',
      packPlanning: { mode: 'simple', packSize: 1, packName: 'roll' },
    };
    expect(computeIssueQty(tp, inputs)).toBeCloseTo(0.025, 6);
  });
});

describe('provisioningEngine — simple pack planning', () => {
  it('rounds up to the next pack', () => {
    const r = planSimplePack(29.4, 30, '30-egg tray');
    expect(r.units).toBe(1);
    expect(r.buyQty).toBe(30);
    expect(r.excessQty).toBeCloseTo(0.6, 6);
    expect(r.instruction).toBe('1 x 30-egg tray');
  });

  it('returns "None required" when demand is zero', () => {
    expect(planSimplePack(0, 30, '30-egg tray').instruction).toBe('None required');
  });
});

describe('provisioningEngine — bulk pack planning', () => {
  it('maize meal: 16.464 kg → 1×10 + 1×5 + 1×2', () => {
    const r = planBulkPacks(16.464, {
      large: { size: 10, packName: '10 kg bag' },
      medium: { size: 5, packName: '5 kg bag' },
      small: { size: 2, packName: '2 kg bag' },
    });
    expect(r.largeN).toBe(1);
    expect(r.mediumN).toBe(1);
    expect(r.smallN).toBe(1);
    expect(r.buyQty).toBe(17);
    expect(r.excessQty).toBeCloseTo(0.536, 6);
    expect(r.instruction).toBe('1 x 10 kg bag + 1 x 5 kg bag + 1 x 2 kg bag');
  });

  it('sorghum: 4.704 kg → 0×10 + 1×5 + 0×1 (skips large when a 5 kg fits better)', () => {
    const r = planBulkPacks(4.704, {
      large: { size: 10, packName: '10 kg bag' },
      medium: { size: 5, packName: '5 kg bag' },
      small: { size: 1, packName: '1 kg bag' },
    });
    expect(r.largeN).toBe(0);
    expect(r.mediumN).toBe(1);
    expect(r.smallN).toBe(0);
    expect(r.buyQty).toBe(5);
    expect(r.excessQty).toBeCloseTo(0.296, 6);
    expect(r.instruction).toBe('1 x 5 kg bag');
  });

  it('cooking oil: 3.234 L → 0×5 + 1×2 + 2×1', () => {
    const r = planBulkPacks(3.234, {
      large: { size: 5, packName: '5 L bottle' },
      medium: { size: 2, packName: '2 L bottle' },
      small: { size: 1, packName: '1 L bottle' },
    });
    expect(r.largeN).toBe(0);
    expect(r.mediumN).toBe(1);
    expect(r.smallN).toBe(2);
    expect(r.buyQty).toBe(4);
    expect(r.instruction).toBe('1 x 2 L bottle + 2 x 1 L bottle');
  });

  it('eggs (only-large tier): 29.4 → 1 x 30-egg tray', () => {
    const r = planBulkPacks(29.4, { large: { size: 30, packName: '30-egg tray' } });
    expect(r.largeN).toBe(1);
    expect(r.buyQty).toBe(30);
  });

  it('steamed flour zero demand → "None required" when allowNone', () => {
    const r = planBulkPacks(0, {
      large: { size: 10, packName: '10 kg bag' },
      medium: { size: 5, packName: '5 kg bag' },
      small: { size: 1, packName: '1 kg bag' },
    }, true);
    expect(r.instruction).toBe('None required');
  });
});

// ── Mini catalog reproducing the spreadsheet's nutrition check ─────────────────────
function miniCatalog(): RationItem[] {
  return [
    { id: 'maize', name: 'Maize Meal', category: 'Staples', class: 'Food', issueQtyPerPersonDay: 0.28, issueUnit: 'kg',
      nutritionPerUnit: { kcal: 3600, proteinG: 90, fruitVegG: 0 },
      packPlanning: { mode: 'bulk', tiers: [
        { tier: 'large', packName: '10 kg bag', size: 10, unit: 'kg' },
        { tier: 'medium', packName: '5 kg bag', size: 5, unit: 'kg' },
        { tier: 'small', packName: '2 kg bag', size: 2, unit: 'kg' },
      ] } },
    { id: 'rice', name: 'Rice', category: 'Staples', class: 'Food', issueQtyPerPersonDay: 0.15, issueUnit: 'kg',
      nutritionPerUnit: { kcal: 3500, proteinG: 70, fruitVegG: 0 },
      packPlanning: { mode: 'bulk', tiers: [
        { tier: 'large', packName: '10 kg bag', size: 10, unit: 'kg' },
        { tier: 'medium', packName: '5 kg bag', size: 5, unit: 'kg' },
        { tier: 'small', packName: '1 kg bag', size: 1, unit: 'kg' },
      ] } },
    { id: 'bread', name: 'Purchased Bread', category: 'Staples', class: 'Food', issueQtyPerPersonDay: 0, issueUnit: 'kg',
      nutritionPerUnit: { kcal: 2650, proteinG: 90, fruitVegG: 0 }, specialFormula: 'purchasedBread',
      packPlanning: { mode: 'simple', packSize: 0.7, packName: 'loaf (700 g)' } },
    { id: 'flour', name: 'Wheat Flour (steamed)', category: 'Staples', class: 'Food', issueQtyPerPersonDay: 0, issueUnit: 'kg',
      nutritionPerUnit: { kcal: 3640, proteinG: 103, fruitVegG: 0 }, specialFormula: 'steamedFlour',
      packPlanning: { mode: 'bulk', tiers: [
        { tier: 'large', packName: '10 kg bag', size: 10, unit: 'kg' },
        { tier: 'medium', packName: '5 kg bag', size: 5, unit: 'kg' },
        { tier: 'small', packName: '1 kg bag', size: 1, unit: 'kg' },
      ] } },
  ];
}

describe('provisioningEngine — nutrition check', () => {
  it('maize contributes 0.28 × 3600 = 1008 kcal', () => {
    const cat = miniCatalog();
    const n = computeNutrition([cat[0]], inputs);
    expect(n.energyKcal).toBeCloseTo(1008, 2);
  });

  it('reports MEETS PLANNING TARGETS when targets are met', () => {
    const n = computeNutrition(miniCatalog(), { ...inputs, nutritionTargets: { kcal: 1000, proteinG: 40, fruitVegG: 0 } });
    expect(n.status).toBe('MEETS PLANNING TARGETS');
    expect(n.energyMeets).toBe(true);
    expect(n.proteinMeets).toBe(true);
  });

  it('reports REVIEW RATION when a target is missed', () => {
    const n = computeNutrition(miniCatalog(), { ...inputs, nutritionTargets: { kcal: 5000, proteinG: 50, fruitVegG: 0 } });
    expect(n.status).toBe('REVIEW RATION');
    expect(n.energyMeets).toBe(false);
  });
});

describe('provisioningEngine — price resolution & cost', () => {
  const asOf = '2026-06-29';

  const priceBook: RationPriceEntry[] = [
    { id: 'p_maize_l', rationItemId: 'maize', tier: 'large', packName: '10 kg bag', currency: 'LSL', price: 180, effectiveFrom: '2026-01-01', effectiveTo: null },
    { id: 'p_maize_m', rationItemId: 'maize', tier: 'medium', packName: '5 kg bag', currency: 'LSL', price: 95, effectiveFrom: '2026-01-01', effectiveTo: null },
    { id: 'p_maize_s', rationItemId: 'maize', tier: 'small', packName: '2 kg bag', currency: 'LSL', price: 40, effectiveFrom: '2026-01-01', effectiveTo: null },
    { id: 'p_bread', rationItemId: 'bread', tier: null, packName: 'loaf (700 g)', currency: 'LSL', price: 12, effectiveFrom: '2026-01-01', effectiveTo: null },
    // expired price should be ignored
    { id: 'p_maize_l_old', rationItemId: 'maize', tier: 'large', packName: '10 kg bag', currency: 'LSL', price: 150, effectiveFrom: '2025-01-01', effectiveTo: '2025-12-31' },
    // wrong currency ignored
    { id: 'p_maize_l_usd', rationItemId: 'maize', tier: 'large', packName: '10 kg bag', currency: 'USD', price: 9, effectiveFrom: '2026-01-01', effectiveTo: null },
  ];

  it('picks the current entry and ignores expired / wrong-currency entries', () => {
    const map = resolveCurrentPrices(priceBook, 'LSL', asOf);
    expect(map.get('maize|large')?.price).toBe(180);
    expect(map.get('maize|large')?.entryId).toBe('p_maize_l');
    expect(map.get('bread|unit')?.price).toBe(12);
    expect(map.has('maize|large_usd')).toBe(false);
  });

  it('maize line cost = 1×180 + 1×95 + 1×40 = 315', () => {
    const map = resolveCurrentPrices(priceBook, 'LSL', asOf);
    const lines = generateShoppingList(miniCatalog(), inputs, map);
    const maize = lines.find((l) => l.rationItemId === 'maize')!;
    expect(maize.estCost).toBe(315);
    expect(maize.priceSource).toBe('priceBook');
    expect(maize.tierPricesUsed).toEqual({ large: 180, medium: 95, small: 40 });
  });

  it('bread line cost = ceil(3.528/0.7) × 12 = 6 × 12 = 72', () => {
    const map = resolveCurrentPrices(priceBook, 'LSL', asOf);
    const lines = generateShoppingList(miniCatalog(), inputs, map);
    const bread = lines.find((l) => l.rationItemId === 'bread')!;
    expect(bread.buyQty).toBeCloseTo(4.2, 6);
    expect(bread.estCost).toBe(72);
  });

  it('lines without a price resolve to estCost 0 / priceSource none', () => {
    const lines = generateShoppingList(miniCatalog(), inputs, undefined);
    const maize = lines.find((l) => l.rationItemId === 'maize')!;
    expect(maize.estCost).toBe(0);
    expect(maize.priceSource).toBe('none');
  });

  it('computePlan ties everything together', () => {
    const plan = computePlan(miniCatalog(), inputs, priceBook, 'LSL', asOf);
    expect(plan.adjustedPersonDays).toBeCloseTo(58.8, 6);
    expect(plan.lines.length).toBe(4);
    expect(plan.nutrition.energyKcal).toBeGreaterThan(1000);
    const maize = plan.lines.find((l) => l.rationItemId === 'maize')!;
    expect(maize.estCost).toBe(315);
    expect(plan.totals.totalFoodCost).toBeGreaterThan(0);
  });
});
