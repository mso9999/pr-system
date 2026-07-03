/**
 * Golden-value test: the full 37-item Lesotho catalog (from `provisioningSeedData.ts`,
 * a faithful port of `260528 Lesotho_Field_Camp_Provisioning_v3.xlsx`) must reproduce the
 * spreadsheet's exact outputs at the canonical 4 people × 14 days × 5% buffer scenario.
 *
 * Spreadsheet golden values (Inputs & Dashboard + Nutrition Check + Shopping List totals):
 *   - Adjusted person-days:        58.8
 *   - Energy provided:             3605.34 kcal/person-day
 *   - Protein provided:            110.32 g/person-day
 *   - Qualifying fruit & veg:      550 g/person-day
 *   - Total entered food cost:     LSL 2920.47
 *   - Food cost / adj person-day:  LSL 49.67
 *   - Status:                      MEETS PLANNING TARGETS
 */
import { describe, expect, it } from 'vitest';
import { computePlan, computeNutrition } from './provisioningEngine';
import type { ProvisioningInputs } from './provisioningEngine';
import {
  seedRationsToCatalog,
  seedPricesToPriceBook,
  PROVISIONING_DEFAULTS,
  PROVISIONING_CURRENCY,
} from './provisioningSeedData';

const inputs: ProvisioningInputs = {
  numberOfPeople: 4,
  numberOfDays: 14,
  procurementBuffer: PROVISIONING_DEFAULTS.defaultBuffer,
  breadCoverageDays: PROVISIONING_DEFAULTS.breadCoverageDays,
  flourPerLoafKg: PROVISIONING_DEFAULTS.flourPerLoafKg,
  yeastProportion: PROVISIONING_DEFAULTS.yeastProportion,
  personDaysPerToiletRoll: PROVISIONING_DEFAULTS.personDaysPerToiletRoll,
  nutritionTargets: PROVISIONING_DEFAULTS.nutritionTargets,
};

const AS_OF = '2026-06-29';

function plan() {
  return computePlan(seedRationsToCatalog(), inputs, seedPricesToPriceBook() as any, PROVISIONING_CURRENCY, AS_OF);
}

describe('provisioning golden — full 37-item catalog reproduces the spreadsheet', () => {
  it('catalog has all 37 spreadsheet items', () => {
    expect(seedRationsToCatalog().length).toBe(37);
  });

  it('adjusted person-days = 58.8', () => {
    expect(plan().adjustedPersonDays).toBeCloseTo(58.8, 6);
  });

  it('energy = 3605.34 kcal/person-day', () => {
    expect(plan().nutrition.energyKcal).toBeCloseTo(3605.34, 2);
  });

  it('protein = 110.32 g/person-day', () => {
    expect(plan().nutrition.proteinG).toBeCloseTo(110.32, 2);
  });

  it('fruit & veg = 550 g/person-day', () => {
    expect(plan().nutrition.fruitVegG).toBeCloseTo(550, 2);
  });

  it('nutrition status = MEETS PLANNING TARGETS', () => {
    const n = plan().nutrition;
    expect(n.status).toBe('MEETS PLANNING TARGETS');
    expect(n.energyMeets).toBe(true);
    expect(n.proteinMeets).toBe(true);
    expect(n.fruitVegMeets).toBe(true);
  });

  it('total food cost = LSL 2920.47', () => {
    expect(plan().totals.totalFoodCost).toBeCloseTo(2920.47, 2);
  });

  it('food cost / adjusted person-day ≈ LSL 49.67', () => {
    expect(plan().totals.costPerAdjustedPersonDay).toBeCloseTo(49.67, 1);
  });

  it('every spreadsheet pack instruction + cost is reproduced', () => {
    const lines = plan().lines;
    const byId = new Map(lines.map((l) => [l.rationItemId, l]));

    const expected: Array<[string, string, number]> = [
      ['ration_maize_meal', '1 x 10 kg bag + 1 x 5 kg bag + 1 x 2 kg bag', 129.73],
      ['ration_sorghum_meal', '1 x 5 kg bag', 92.99],
      ['ration_rice', '1 x 5 kg bag', 87.97],
      ['ration_bread_purchased', '6 x 700 g loaf', 14.99],
      ['ration_potatoes', '1 x 5 kg bag + 1 x 1 kg bag', 69.99],
      ['ration_sugar_beans', '1 x 5 kg bag', 199.95],
      ['ration_lentils', '1 x 2 kg bag + 1 x 500 g bag', 23.96],
      ['ration_eggs', '1 x 30-egg tray', 69.99],
      ['ration_pilchards', '6 x 400 g can', 179.7],
      ['ration_corned_beef', '3 x 300 g can', 64.02],
      ['ration_peanut_butter', '2 x 1 kg jar', 139.98],
      ['ration_uht_milk', '2 x 6 × 1 L case', 199.98],
      ['ration_cooking_oil', '1 x 2 L bottle + 2 x 1 L bottle', 64.99],
      ['ration_sugar', '2 x 1 kg bag', 84.3],
      ['ration_onions', '4 x 1 kg bag', 99.99],
      ['ration_carrots', '1 x 5 kg bag', 134.95],
      ['ration_cabbage', '5 x 1 kg', 134.95],
      ['ration_butternut', '1 x 5 kg lot + 3 x 1 kg lot', 79.99],
      ['ration_canned_tomatoes', '11 x 410 g can', 171.96],
      ['ration_seasonal_fruit', '1 x 5 kg lot + 1 x 2 kg lot + 2 x 1 kg lot', 170.96],
      ['ration_salt', '1 x 1 kg pack', 5.42],
      ['ration_stock_cubes', '3 x 100 g pack', 29.1],
      ['ration_curry_powder', '2 x 100 g pack', 30.01],
      ['ration_garlic', '2 x 250 g pack', 48.84],
      ['ration_tea', '1 x 160-bag box', 122.21],
      ['ration_ricoffy', '1 x 250 g tin', 51.7],
      ['ration_hot_chocolate', '2 x 500 g pack', 114.99],
      ['ration_dishwashing', '2 x bottle', 81.36],
      ['ration_handwashing_soap', '4 x bar', 80.54],
      ['ration_bin_bags', '1 x roll', 39.99],
      ['ration_matches', '2 x unit', 17.78],
      ['ration_storage_buckets', '5 x bucket', 0],
      ['ration_can_opener', '1 x unit', 34.99],
      ['ration_flour_steamed', '1 x 2.5 kg bag + 1 x 1 kg bag', 36.21],
      ['ration_yeast', '1 x 100 g pack', 11.99],
      ['ration_toilet_paper', '17 x roll', 0],
      ['ration_powdered_soap', '3 x pack', 0],
    ];

    for (const [id, instruction, cost] of expected) {
      const line = byId.get(id);
      expect(line, `ration ${id} should be in the plan`).toBeDefined();
      expect(line!.packInstruction, `instruction for ${id}`).toBe(instruction);
      expect(line!.estCost, `estCost for ${id}`).toBeCloseTo(cost, 2);
    }
  });

  it('nutrition check is stable when inputs do not trigger special formulas (7-day, no buffer)', () => {
    // At days === breadCoverageDays, purchased-bread rate is 0.12 and steamed-flour demand is 0.
    const n = computeNutrition(seedRationsToCatalog(), { ...inputs, numberOfDays: 7, procurementBuffer: 0 });
    // Purchased bread issue qty at 7 days = 0.12 × min(7,7)/7 = 0.12; steamed flour = 0.
    const bread = n.energyKcal; // just ensure it computes without NaN
    expect(Number.isFinite(bread)).toBe(true);
  });
});
