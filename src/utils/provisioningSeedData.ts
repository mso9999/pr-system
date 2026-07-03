/**
 * Pure data port of `docs/260528 Lesotho_Field_Camp_Provisioning_v3.xlsx`.
 *
 * No Firebase, no side effects — imported by both `scripts/seed-rations.ts` (to write the
 * catalog to Firestore) and `src/utils/provisioningEngine.golden.test.ts` (to verify the
 * engine reproduces the spreadsheet's golden outputs: energy 3605.34 kcal/pd, protein
 * 110.32 g/pd, fruit/veg 550 g/pd, total food cost LSL 2920.47 at 4 people × 14 days × 5%).
 */
import type { RationItem, RationPackPlanning, RationPriceTier, NutritionTargets } from '../types/provisioning';

export const PROVISIONING_ORG_ID = '1pwr_lesotho';
export const PROVISIONING_ORG_NAME = '1PWR Lesotho';
export const PROVISIONING_CURRENCY = 'LSL';

const simple = (packSize: number, packName: string): RationPackPlanning => ({ mode: 'simple', packSize, packName });
const bulk = (tiers: Array<{ tier: 'large' | 'medium' | 'small'; size: number; packName: string; unit: string }>): RationPackPlanning => ({ mode: 'bulk', tiers });

export interface SeedRation {
  id: string;
  name: string;
  category: RationItem['category'];
  class: RationItem['class'];
  issueQtyPerPersonDay: number;
  issueUnit: string;
  nutrition: { kcal: number; proteinG: number; fruitVegG: number };
  specialFormula?: RationItem['specialFormula'];
  pack: RationPackPlanning;
  procurementNote?: string;
}

/** All 37 Shopping List rows (5–41), faithfully ported. */
export const RATIONS: SeedRation[] = [
  // ── Staples ────────────────────────────────────────────────────────────────────
  { id: 'ration_maize_meal', name: 'Maize meal / papa meal', category: 'Staples', class: 'Food',
    issueQtyPerPersonDay: 0.28, issueUnit: 'kg', nutrition: { kcal: 3600, proteinG: 80, fruitVegG: 0 },
    pack: bulk([{ tier: 'large', size: 10, packName: '10 kg bag', unit: 'kg' }, { tier: 'medium', size: 5, packName: '5 kg bag', unit: 'kg' }, { tier: 'small', size: 2, packName: '2 kg bag', unit: 'kg' }]),
    procurementNote: 'Buy in listed bulk package sizes; enter pack prices on Bulk Pack Planning.' },
  { id: 'ration_sorghum_meal', name: 'Sorghum meal', category: 'Staples', class: 'Food',
    issueQtyPerPersonDay: 0.08, issueUnit: 'kg', nutrition: { kcal: 3300, proteinG: 110, fruitVegG: 0 },
    pack: bulk([{ tier: 'large', size: 10, packName: '10 kg bag', unit: 'kg' }, { tier: 'medium', size: 5, packName: '5 kg bag', unit: 'kg' }, { tier: 'small', size: 1, packName: '1 kg bag', unit: 'kg' }]),
    procurementNote: 'Buy in listed bulk package sizes; enter pack prices on Bulk Pack Planning.' },
  { id: 'ration_rice', name: 'Rice', category: 'Staples', class: 'Food',
    issueQtyPerPersonDay: 0.08, issueUnit: 'kg', nutrition: { kcal: 3600, proteinG: 70, fruitVegG: 0 },
    pack: bulk([{ tier: 'large', size: 10, packName: '10 kg bag', unit: 'kg' }, { tier: 'medium', size: 5, packName: '5 kg bag', unit: 'kg' }, { tier: 'small', size: 1, packName: '1 kg bag', unit: 'kg' }]),
    procurementNote: 'Buy in listed bulk package sizes; enter pack prices on Bulk Pack Planning.' },
  { id: 'ration_bread_purchased', name: 'Purchased bread — first deployment days only', category: 'Staples', class: 'Food',
    issueQtyPerPersonDay: 0.12, issueUnit: 'kg', nutrition: { kcal: 2650, proteinG: 90, fruitVegG: 0 },
    specialFormula: 'purchasedBread', pack: simple(0.7, '700 g loaf'),
    procurementNote: 'Purchase only for initial days shown in Inputs; replace thereafter with camp-made steamed bread.' },
  { id: 'ration_potatoes', name: 'Potatoes', category: 'Staples', class: 'Food',
    issueQtyPerPersonDay: 0.1, issueUnit: 'kg', nutrition: { kcal: 770, proteinG: 20, fruitVegG: 0 },
    pack: bulk([{ tier: 'large', size: 10, packName: '10 kg bag', unit: 'kg' }, { tier: 'medium', size: 5, packName: '5 kg bag', unit: 'kg' }, { tier: 'small', size: 1, packName: '1 kg bag', unit: 'kg' }]),
    procurementNote: 'Buy in listed bulk package sizes; enter pack prices on Bulk Pack Planning.' },

  // ── Protein ────────────────────────────────────────────────────────────────────
  { id: 'ration_sugar_beans', name: 'Dry sugar beans', category: 'Protein', class: 'Food',
    issueQtyPerPersonDay: 0.08, issueUnit: 'kg', nutrition: { kcal: 3400, proteinG: 210, fruitVegG: 0 },
    pack: bulk([{ tier: 'large', size: 10, packName: '10 kg bag', unit: 'kg' }, { tier: 'medium', size: 5, packName: '5 kg bag', unit: 'kg' }, { tier: 'small', size: 1, packName: '1 kg bag', unit: 'kg' }]),
    procurementNote: 'Buy in listed bulk package sizes; enter pack prices on Bulk Pack Planning.' },
  { id: 'ration_lentils', name: 'Lentils / split peas', category: 'Protein', class: 'Food',
    issueQtyPerPersonDay: 0.05, issueUnit: 'kg', nutrition: { kcal: 3520, proteinG: 250, fruitVegG: 0 },
    pack: bulk([{ tier: 'large', size: 5, packName: '5 kg bag', unit: 'kg' }, { tier: 'medium', size: 2, packName: '2 kg bag', unit: 'kg' }, { tier: 'small', size: 1, packName: '500 g bag', unit: 'kg' }]),
    procurementNote: 'Buy in listed bulk package sizes; enter pack prices on Bulk Pack Planning.' },
  { id: 'ration_eggs', name: 'Eggs', category: 'Protein', class: 'Food',
    issueQtyPerPersonDay: 0.5, issueUnit: 'egg', nutrition: { kcal: 72, proteinG: 6.3, fruitVegG: 0 },
    pack: bulk([{ tier: 'large', size: 30, packName: '30-egg tray', unit: 'egg' }]),
    procurementNote: 'Buy in listed bulk package sizes; enter pack prices on Bulk Pack Planning.' },
  { id: 'ration_pilchards', name: 'Pilchards in tomato sauce', category: 'Protein', class: 'Food',
    issueQtyPerPersonDay: 0.035, issueUnit: 'kg', nutrition: { kcal: 2000, proteinG: 200, fruitVegG: 0 },
    pack: simple(0.4, '400 g can'), procurementNote: 'Shelf-stable animal protein' },
  { id: 'ration_corned_beef', name: 'Corned beef', category: 'Protein', class: 'Food',
    issueQtyPerPersonDay: 0.015, issueUnit: 'kg', nutrition: { kcal: 2500, proteinG: 200, fruitVegG: 0 },
    pack: simple(0.3, '300 g can'), procurementNote: 'Limited convenience/variation item' },
  { id: 'ration_peanut_butter', name: 'Peanut butter', category: 'Protein', class: 'Food',
    issueQtyPerPersonDay: 0.03, issueUnit: 'kg', nutrition: { kcal: 5880, proteinG: 250, fruitVegG: 0 },
    pack: simple(1, '1 kg jar'), procurementNote: 'Bread/porridge energy and protein' },

  // ── Dairy ──────────────────────────────────────────────────────────────────────
  { id: 'ration_uht_milk', name: 'UHT full-cream milk', category: 'Dairy', class: 'Food',
    issueQtyPerPersonDay: 0.2, issueUnit: 'L', nutrition: { kcal: 620, proteinG: 33, fruitVegG: 0 },
    pack: bulk([{ tier: 'large', size: 6, packName: '6 × 1 L case', unit: 'L' }]),
    procurementNote: 'Buy in listed bulk package sizes; enter pack prices on Bulk Pack Planning.' },

  // ── Cooking Inputs ─────────────────────────────────────────────────────────────
  { id: 'ration_cooking_oil', name: 'Cooking oil', category: 'Cooking Inputs', class: 'Food',
    issueQtyPerPersonDay: 0.055, issueUnit: 'L', nutrition: { kcal: 8100, proteinG: 0, fruitVegG: 0 },
    pack: bulk([{ tier: 'large', size: 5, packName: '5 L bottle', unit: 'L' }, { tier: 'medium', size: 2, packName: '2 L bottle', unit: 'L' }, { tier: 'small', size: 1, packName: '1 L bottle', unit: 'L' }]),
    procurementNote: 'Buy in listed bulk package sizes; enter pack prices on Bulk Pack Planning.' },
  { id: 'ration_sugar', name: 'Sugar', category: 'Cooking Inputs', class: 'Food',
    issueQtyPerPersonDay: 0.025, issueUnit: 'kg', nutrition: { kcal: 4000, proteinG: 0, fruitVegG: 0 },
    pack: bulk([{ tier: 'large', size: 10, packName: '10 kg bag', unit: 'kg' }, { tier: 'medium', size: 5, packName: '5 kg bag', unit: 'kg' }, { tier: 'small', size: 1, packName: '1 kg bag', unit: 'kg' }]),
    procurementNote: 'Buy in listed bulk package sizes; enter pack prices on Bulk Pack Planning.' },

  // ── Vegetables & Fruit (fruitVegG = 1000 g/kg → 1:1 issue basis) ────────────────
  { id: 'ration_onions', name: 'Onions', category: 'Vegetables & Fruit', class: 'Food',
    issueQtyPerPersonDay: 0.06, issueUnit: 'kg', nutrition: { kcal: 400, proteinG: 11, fruitVegG: 1000 },
    pack: bulk([{ tier: 'large', size: 10, packName: '10 kg bag', unit: 'kg' }, { tier: 'medium', size: 5, packName: '5 kg bag', unit: 'kg' }, { tier: 'small', size: 1, packName: '1 kg bag', unit: 'kg' }]),
    procurementNote: 'Buy in listed bulk package sizes; enter pack prices on Bulk Pack Planning.' },
  { id: 'ration_carrots', name: 'Carrots', category: 'Vegetables & Fruit', class: 'Food',
    issueQtyPerPersonDay: 0.07, issueUnit: 'kg', nutrition: { kcal: 410, proteinG: 9, fruitVegG: 1000 },
    pack: bulk([{ tier: 'large', size: 5, packName: '5 kg bag', unit: 'kg' }, { tier: 'medium', size: 2, packName: '2 kg bag', unit: 'kg' }, { tier: 'small', size: 1, packName: '1 kg bag', unit: 'kg' }]),
    procurementNote: 'Buy in listed bulk package sizes; enter pack prices on Bulk Pack Planning.' },
  { id: 'ration_cabbage', name: 'Cabbage', category: 'Vegetables & Fruit', class: 'Food',
    issueQtyPerPersonDay: 0.08, issueUnit: 'kg', nutrition: { kcal: 250, proteinG: 13, fruitVegG: 1000 },
    pack: simple(1, '1 kg'), procurementNote: 'Buy as whole heads; approximate kg basis' },
  { id: 'ration_butternut', name: 'Butternut / pumpkin', category: 'Vegetables & Fruit', class: 'Food',
    issueQtyPerPersonDay: 0.12, issueUnit: 'kg', nutrition: { kcal: 400, proteinG: 10, fruitVegG: 1000 },
    pack: bulk([{ tier: 'large', size: 10, packName: '10 kg lot', unit: 'kg' }, { tier: 'medium', size: 5, packName: '5 kg lot', unit: 'kg' }, { tier: 'small', size: 1, packName: '1 kg lot', unit: 'kg' }]),
    procurementNote: 'Buy in listed bulk package sizes; enter pack prices on Bulk Pack Planning.' },
  { id: 'ration_canned_tomatoes', name: 'Canned chopped tomatoes', category: 'Vegetables & Fruit', class: 'Food',
    issueQtyPerPersonDay: 0.07, issueUnit: 'kg', nutrition: { kcal: 200, proteinG: 10, fruitVegG: 1000 },
    pack: simple(0.41, '410 g can'), procurementNote: 'Shelf-stable stew base' },
  { id: 'ration_seasonal_fruit', name: 'Seasonal durable fruit', category: 'Vegetables & Fruit', class: 'Food',
    issueQtyPerPersonDay: 0.15, issueUnit: 'kg', nutrition: { kcal: 500, proteinG: 5, fruitVegG: 1000 },
    pack: bulk([{ tier: 'large', size: 5, packName: '5 kg lot', unit: 'kg' }, { tier: 'medium', size: 2, packName: '2 kg lot', unit: 'kg' }, { tier: 'small', size: 1, packName: '1 kg lot', unit: 'kg' }]),
    procurementNote: 'Buy in listed bulk package sizes; enter pack prices on Bulk Pack Planning.' },

  // ── Seasoning ──────────────────────────────────────────────────────────────────
  { id: 'ration_salt', name: 'Iodised salt', category: 'Seasoning', class: 'Provision',
    issueQtyPerPersonDay: 0.003, issueUnit: 'kg', nutrition: { kcal: 0, proteinG: 0, fruitVegG: 0 },
    pack: simple(1, '1 kg pack'), procurementNote: 'Use iodised salt' },
  { id: 'ration_stock_cubes', name: 'Stock cubes / soup powder', category: 'Seasoning', class: 'Provision',
    issueQtyPerPersonDay: 0.005, issueUnit: 'kg', nutrition: { kcal: 0, proteinG: 0, fruitVegG: 0 },
    pack: simple(0.1, '100 g pack'), procurementNote: 'Flavouring' },
  { id: 'ration_curry_powder', name: 'Curry powder / spice mix', category: 'Seasoning', class: 'Provision',
    issueQtyPerPersonDay: 0.003, issueUnit: 'kg', nutrition: { kcal: 0, proteinG: 0, fruitVegG: 0 },
    pack: simple(0.1, '100 g pack'), procurementNote: 'Flavouring' },
  { id: 'ration_garlic', name: 'Garlic', category: 'Seasoning', class: 'Provision',
    issueQtyPerPersonDay: 0.005, issueUnit: 'kg', nutrition: { kcal: 0, proteinG: 0, fruitVegG: 0 },
    pack: simple(0.25, '250 g pack'), procurementNote: 'Flavouring' },

  // ── Issued Beverages ───────────────────────────────────────────────────────────
  { id: 'ration_tea', name: 'Tea bags', category: 'Issued Beverages', class: 'Provision',
    issueQtyPerPersonDay: 2, issueUnit: 'bag', nutrition: { kcal: 0, proteinG: 0, fruitVegG: 0 },
    pack: simple(160, '160-bag box'), procurementNote: 'Basic hot beverage' },
  { id: 'ration_ricoffy', name: 'Ricoffy / instant chicory coffee', category: 'Issued Beverages', class: 'Provision',
    issueQtyPerPersonDay: 0.004, issueUnit: 'kg', nutrition: { kcal: 0, proteinG: 0, fruitVegG: 0 },
    pack: simple(0.25, '250 g tin'), procurementNote: 'Basic hot beverage' },
  { id: 'ration_hot_chocolate', name: 'Hot chocolate drink powder', category: 'Issued Beverages', class: 'Provision',
    issueQtyPerPersonDay: 0.01, issueUnit: 'kg', nutrition: { kcal: 0, proteinG: 0, fruitVegG: 0 },
    pack: simple(0.5, '500 g pack'), procurementNote: 'Cold morning beverage' },

  // ── Kitchen & Hygiene (Fixed = per-deployment, not scaled by person-days) ───────
  { id: 'ration_dishwashing', name: 'Dishwashing liquid', category: 'Kitchen & Hygiene', class: 'Fixed',
    issueQtyPerPersonDay: 2, issueUnit: 'bottle', nutrition: { kcal: 0, proteinG: 0, fruitVegG: 0 },
    pack: simple(1, 'bottle'), procurementNote: 'Fixed per deployment' },
  { id: 'ration_handwashing_soap', name: 'Handwashing soap', category: 'Kitchen & Hygiene', class: 'Fixed',
    issueQtyPerPersonDay: 4, issueUnit: 'bar', nutrition: { kcal: 0, proteinG: 0, fruitVegG: 0 },
    pack: simple(1, 'bar'), procurementNote: 'Fixed per deployment' },
  { id: 'ration_bin_bags', name: 'Heavy-duty bin bags', category: 'Kitchen & Hygiene', class: 'Fixed',
    issueQtyPerPersonDay: 1, issueUnit: 'roll', nutrition: { kcal: 0, proteinG: 0, fruitVegG: 0 },
    pack: simple(1, 'roll'), procurementNote: 'Fixed per deployment' },
  { id: 'ration_matches', name: 'Matches / lighters', category: 'Kitchen & Hygiene', class: 'Fixed',
    issueQtyPerPersonDay: 2, issueUnit: 'unit', nutrition: { kcal: 0, proteinG: 0, fruitVegG: 0 },
    pack: simple(1, 'unit'), procurementNote: 'Fixed per deployment' },
  { id: 'ration_storage_buckets', name: 'Airtight storage buckets', category: 'Kitchen & Hygiene', class: 'Fixed',
    issueQtyPerPersonDay: 5, issueUnit: 'bucket', nutrition: { kcal: 0, proteinG: 0, fruitVegG: 0 },
    pack: simple(1, 'bucket'), procurementNote: 'Only if not already at camp' },
  { id: 'ration_can_opener', name: 'Robust can opener', category: 'Kitchen & Hygiene', class: 'Fixed',
    issueQtyPerPersonDay: 1, issueUnit: 'unit', nutrition: { kcal: 0, proteinG: 0, fruitVegG: 0 },
    pack: simple(1, 'unit'), procurementNote: 'Only if not already at camp' },

  // ── Steamed-bread inputs (formula-driven; issueQtyPerPersonDay is a fallback) ───
  { id: 'ration_flour_steamed', name: 'Wheat flour for steamed bread', category: 'Staples', class: 'Food',
    issueQtyPerPersonDay: 0.12, issueUnit: 'kg', nutrition: { kcal: 3640, proteinG: 103, fruitVegG: 0 },
    specialFormula: 'steamedFlour',
    pack: bulk([{ tier: 'large', size: 5, packName: '5 kg bag', unit: 'kg' }, { tier: 'medium', size: 2, packName: '2.5 kg bag', unit: 'kg' }, { tier: 'small', size: 1, packName: '1 kg bag', unit: 'kg' }]),
    procurementNote: 'Buy in listed bulk package sizes; enter pack prices on Bulk Pack Planning.' },
  { id: 'ration_yeast', name: 'Instant dry yeast for steamed bread', category: 'Cooking Inputs', class: 'Food',
    issueQtyPerPersonDay: 0, issueUnit: 'kg', nutrition: { kcal: 0, proteinG: 0, fruitVegG: 0 },
    specialFormula: 'yeast', pack: simple(0.1, '100 g pack'),
    procurementNote: 'For bread after purchased-bread coverage period' },
  { id: 'ration_toilet_paper', name: 'Toilet paper', category: 'Kitchen & Hygiene', class: 'Provision',
    issueQtyPerPersonDay: 0, issueUnit: 'roll', nutrition: { kcal: 0, proteinG: 0, fruitVegG: 0 },
    specialFormula: 'toiletPaper', pack: simple(1, 'roll'),
    procurementNote: 'Scaled to person-days; enter unit price per roll.' },
  { id: 'ration_powdered_soap', name: 'Powdered soap (laundry/cleaning)', category: 'Kitchen & Hygiene', class: 'Fixed',
    issueQtyPerPersonDay: 3, issueUnit: 'pack', nutrition: { kcal: 0, proteinG: 0, fruitVegG: 0 },
    pack: simple(1, 'pack'), procurementNote: 'Fixed per deployment; enter unit price per pack.' },
];

/** Inputs & Dashboard!B5:B15 — exact spreadsheet planning defaults. */
export const PROVISIONING_DEFAULTS = {
  nutritionTargets: { kcal: 3600, proteinG: 100, fruitVegG: 400 } as NutritionTargets,
  defaultBuffer: 0.05,
  breadCoverageDays: 7,
  flourPerLoafKg: 0.52,
  yeastProportion: 0.02,
  personDaysPerToiletRoll: 3.5,
  defaultCurrency: 'LSL',
  reportingCurrency: 'ZAR',
};

/** 7-Day Menu sheet — the actual camp menu cycle. */
export const PROVISIONING_MENU = {
  id: 'provisioning_menu_1pwr_lesotho',
  name: '7-Day Basic Camp Menu Cycle',
  cycleLength: 7,
  days: [
    { day: 1, breakfast: 'Sorghum porridge with UHT milk; tea/Ricoffy', midday: 'Bean-and-vegetable stew with bread', evening: 'Papa, pilchards, cabbage and carrot' },
    { day: 2, breakfast: 'Eggs and bread; tea/Ricoffy', midday: 'Lentil stew with rice', evening: 'Papa, bean stew, pumpkin and tomato' },
    { day: 3, breakfast: 'Sorghum porridge with peanut butter; hot chocolate/tea', midday: 'Leftover legume dish with bread', evening: 'Rice, small corned-beef potato stew, cabbage' },
    { day: 4, breakfast: 'Eggs and bread; tea/Ricoffy', midday: 'Peanut butter bread and fruit', evening: 'Papa, lentil curry, pumpkin and carrot' },
    { day: 5, breakfast: 'Sorghum porridge with UHT milk; tea/Ricoffy', midday: 'Bean-and-vegetable dish with rice', evening: 'Papa, pilchards, cabbage and tomato' },
    { day: 6, breakfast: 'Eggs and bread; hot chocolate/tea', midday: 'Lentil stew with bread and fruit', evening: 'Rice, bean and pumpkin stew' },
    { day: 7, breakfast: 'Sorghum porridge with peanut butter; tea/Ricoffy', midday: 'Egg-and-potato meal with cabbage', evening: 'Papa, mixed legume stew and vegetables' },
  ],
};

export interface SeedPrice { id: string; rationId: string; tier: RationPriceTier; packName: string; price: number }

/** Spreadsheet pack prices (LSL). Bulk tiers from Bulk Pack Planning!G/K/O; simple-item unit
 *  prices back-derived from Shopping List static Est. Cost (O ÷ roundup qty at 4×14×5%) so the
 *  engine reproduces the LSL 2920.47 total. Items the spreadsheet leaves unpriced have no entry. */
export const PROVISIONING_PRICES: SeedPrice[] = [
  { id: 'price_maize_l', rationId: 'ration_maize_meal', tier: 'large', packName: '10 kg bag', price: 77.99 },
  { id: 'price_maize_m', rationId: 'ration_maize_meal', tier: 'medium', packName: '5 kg bag', price: 32.99 },
  { id: 'price_maize_s', rationId: 'ration_maize_meal', tier: 'small', packName: '2 kg bag', price: 18.75 },
  { id: 'price_sorghum_m', rationId: 'ration_sorghum_meal', tier: 'medium', packName: '5 kg bag', price: 92.99 },
  { id: 'price_sorghum_s', rationId: 'ration_sorghum_meal', tier: 'small', packName: '1 kg bag', price: 9.91 },
  { id: 'price_rice_m', rationId: 'ration_rice', tier: 'medium', packName: '5 kg bag', price: 87.97 },
  { id: 'price_potatoes_l', rationId: 'ration_potatoes', tier: 'large', packName: '10 kg bag', price: 119.99 },
  { id: 'price_potatoes_m', rationId: 'ration_potatoes', tier: 'medium', packName: '5 kg bag', price: 69.99 },
  { id: 'price_beans_m', rationId: 'ration_sugar_beans', tier: 'medium', packName: '5 kg bag', price: 199.95 },
  { id: 'price_beans_s', rationId: 'ration_sugar_beans', tier: 'small', packName: '1 kg bag', price: 39.99 },
  { id: 'price_lentils_s', rationId: 'ration_lentils', tier: 'small', packName: '500 g bag', price: 23.96 },
  { id: 'price_eggs_l', rationId: 'ration_eggs', tier: 'large', packName: '30-egg tray', price: 69.99 },
  { id: 'price_uht_milk_l', rationId: 'ration_uht_milk', tier: 'large', packName: '6 × 1 L case', price: 99.99 },
  { id: 'price_oil_l', rationId: 'ration_cooking_oil', tier: 'large', packName: '5 L bottle', price: 119.99 },
  { id: 'price_oil_m', rationId: 'ration_cooking_oil', tier: 'medium', packName: '2 L bottle', price: 64.99 },
  { id: 'price_sugar_l', rationId: 'ration_sugar', tier: 'large', packName: '10 kg bag', price: 119.99 },
  { id: 'price_sugar_m', rationId: 'ration_sugar', tier: 'medium', packName: '5 kg bag', price: 59.99 },
  { id: 'price_sugar_s', rationId: 'ration_sugar', tier: 'small', packName: '1 kg bag', price: 42.15 },
  { id: 'price_onions_l', rationId: 'ration_onions', tier: 'large', packName: '10 kg bag', price: 269.98 },
  { id: 'price_onions_m', rationId: 'ration_onions', tier: 'medium', packName: '5 kg bag', price: 49.99 },
  { id: 'price_onions_s', rationId: 'ration_onions', tier: 'small', packName: '1 kg bag', price: 24.9975 },
  { id: 'price_carrots_l', rationId: 'ration_carrots', tier: 'large', packName: '5 kg bag', price: 134.95 },
  { id: 'price_carrots_m', rationId: 'ration_carrots', tier: 'medium', packName: '2 kg bag', price: 69.99 },
  { id: 'price_carrots_s', rationId: 'ration_carrots', tier: 'small', packName: '1 kg bag', price: 26.99 },
  { id: 'price_butternut_l', rationId: 'ration_butternut', tier: 'large', packName: '10 kg lot', price: 99.99 },
  { id: 'price_butternut_m', rationId: 'ration_butternut', tier: 'medium', packName: '5 kg lot', price: 79.99 },
  { id: 'price_fruit_l', rationId: 'ration_seasonal_fruit', tier: 'large', packName: '5 kg lot', price: 44.99 },
  { id: 'price_fruit_m', rationId: 'ration_seasonal_fruit', tier: 'medium', packName: '2 kg lot', price: 49.99 },
  { id: 'price_fruit_s', rationId: 'ration_seasonal_fruit', tier: 'small', packName: '1 kg lot', price: 37.99 },
  { id: 'price_flour_l', rationId: 'ration_flour_steamed', tier: 'large', packName: '5 kg bag', price: 61.99 },
  { id: 'price_flour_m', rationId: 'ration_flour_steamed', tier: 'medium', packName: '2.5 kg bag', price: 25.04 },
  { id: 'price_flour_s', rationId: 'ration_flour_steamed', tier: 'small', packName: '1 kg bag', price: 11.17 },

  { id: 'price_bread', rationId: 'ration_bread_purchased', tier: null, packName: '700 g loaf', price: 2.498333 },
  { id: 'price_pilchards', rationId: 'ration_pilchards', tier: null, packName: '400 g can', price: 29.95 },
  { id: 'price_corned_beef', rationId: 'ration_corned_beef', tier: null, packName: '300 g can', price: 21.34 },
  { id: 'price_peanut_butter', rationId: 'ration_peanut_butter', tier: null, packName: '1 kg jar', price: 69.99 },
  { id: 'price_cabbage', rationId: 'ration_cabbage', tier: null, packName: '1 kg', price: 26.99 },
  { id: 'price_canned_tomatoes', rationId: 'ration_canned_tomatoes', tier: null, packName: '410 g can', price: 15.632727 },
  { id: 'price_salt', rationId: 'ration_salt', tier: null, packName: '1 kg pack', price: 5.42 },
  { id: 'price_stock_cubes', rationId: 'ration_stock_cubes', tier: null, packName: '100 g pack', price: 9.7 },
  { id: 'price_curry_powder', rationId: 'ration_curry_powder', tier: null, packName: '100 g pack', price: 15.005 },
  { id: 'price_garlic', rationId: 'ration_garlic', tier: null, packName: '250 g pack', price: 24.42 },
  { id: 'price_tea', rationId: 'ration_tea', tier: null, packName: '160-bag box', price: 122.21 },
  { id: 'price_ricoffy', rationId: 'ration_ricoffy', tier: null, packName: '250 g tin', price: 51.7 },
  { id: 'price_hot_chocolate', rationId: 'ration_hot_chocolate', tier: null, packName: '500 g pack', price: 57.495 },
  { id: 'price_dishwashing', rationId: 'ration_dishwashing', tier: null, packName: 'bottle', price: 40.68 },
  { id: 'price_handwashing_soap', rationId: 'ration_handwashing_soap', tier: null, packName: 'bar', price: 20.135 },
  { id: 'price_bin_bags', rationId: 'ration_bin_bags', tier: null, packName: 'roll', price: 39.99 },
  { id: 'price_matches', rationId: 'ration_matches', tier: null, packName: 'unit', price: 8.89 },
  { id: 'price_can_opener', rationId: 'ration_can_opener', tier: null, packName: 'unit', price: 34.99 },
  { id: 'price_yeast', rationId: 'ration_yeast', tier: null, packName: '100 g pack', price: 11.99 },
];

/** Convert the seed ration list to the engine's `RationItem[]` shape. */
export function seedRationsToCatalog(): RationItem[] {
  return RATIONS.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    class: r.class,
    issueQtyPerPersonDay: r.issueQtyPerPersonDay,
    issueUnit: r.issueUnit,
    nutritionPerUnit: r.nutrition,
    specialFormula: r.specialFormula,
    packPlanning: r.pack,
    procurementNote: r.procurementNote,
  }));
}

/** Convert the seed price list to the engine's `RationPriceEntry[]` shape. */
export function seedPricesToPriceBook() {
  return PROVISIONING_PRICES.map((p) => ({
    id: p.id,
    rationItemId: p.rationId,
    tier: p.tier,
    packName: p.packName,
    currency: PROVISIONING_CURRENCY,
    price: p.price,
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
  }));
}

/** Assumptions & Sources sheet — static reference rows surfaced in the planner UI. */
export const PROVISIONING_ASSUMPTIONS: Array<{ topic: string; assumption: string; source: string; url?: string }> = [
  { topic: 'Energy planning basis', assumption: '3,600 kcal/person-day active field-deployment planning basis.', source: 'NATO AMedP-1.11', url: 'https://www.coemed.org/files/stanags/03_AMEDP/AMedP-1.11_EDB_V1_E_2937.pdf' },
  { topic: 'Fruit & vegetable minimum', assumption: 'At least 400 g/person-day; this ration exceeds the minimum on an issue basis.', source: 'World Health Organization — Healthy diet', url: 'https://www.who.int/news-room/fact-sheets/detail/healthy-diet' },
  { topic: 'Protein threshold', assumption: '100 g/person-day is an internal provisioning threshold for the high-energy field ration.', source: 'Company planning assumption', url: undefined },
  { topic: 'Food composition', assumption: 'Energy and protein inputs are approximate generic values. Validate against selected product labels where material.', source: 'Planning assumption', url: undefined },
  { topic: 'Bulk purchase logic', assumption: 'High-volume items are shown in practical large-package combinations. Use closest available bulk size meeting requirement.', source: 'Procurement rule', url: undefined },
  { topic: 'Scope', assumption: 'Premium snacks and personal preference items are excluded from company core provisioning. Individual supplementation through per diem.', source: 'Provisioning policy', url: undefined },
  { topic: 'Purchased bread duration', assumption: 'Purchased bread is limited to the initial number of days specified on Inputs (default 7 days). Adjust where field resupply is reliable.', source: 'Operational provisioning assumption', url: undefined },
  { topic: 'Steamed bread conversion', assumption: 'After purchased bread coverage ends, 0.52 kg wheat flour is issued per ~700 g purchased-loaf equivalent, with dry yeast at 2% of flour.', source: 'Operational recipe assumption', url: undefined },
];
