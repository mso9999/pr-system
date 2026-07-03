/**
 * Starter Field Camp Provisioning catalog for 1PWR Benin (West Africa).
 *
 * Parallel to `provisioningSeedData.ts` (Lesotho). Benin's pantry, menu and dietary
 * pattern differ materially from Southern Africa — palm oil replaces vegetable oil as
 * the primary cooking fat; cassava (gari), yam and plantain join rice and maize as
 * staples; smoked/dried fish, cowpea (niébé) and groundnut dominate protein; pili-pili,
 * bouillon cubes, tomato paste and ginger drive flavour. Prices are indicative XOF and
 * meant to be refined by procurement via the Provisioning Studio.
 *
 * Nutrition (per person-day, computed against these rations at 4 people × 14 days × 5%):
 *   energy ≈ 3,630 kcal · protein ≈ 122 g · fruit/veg ≈ 525 g  → MEETS 3600/100/400.
 */
import type { RationItem, RationPackPlanning, RationPriceTier, NutritionTargets } from '../types/provisioning';

export const PROVISIONING_BENIN_ORG_ID = '1pwr_benin';
export const PROVISIONING_BENIN_ORG_NAME = '1PWR Benin';
export const PROVISIONING_BENIN_CURRENCY = 'XOF';
export const PROVISIONING_BENIN_COUNTRY = 'BJ';

const simple = (packSize: number, packName: string): RationPackPlanning => ({ mode: 'simple', packSize, packName });
const bulk = (tiers: Array<{ tier: 'large' | 'medium' | 'small'; size: number; packName: string; unit: string }>): RationPackPlanning => ({ mode: 'bulk', tiers });

export interface BeninSeedRation {
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

export const BENIN_RATIONS: BeninSeedRation[] = [
  // ── Staples ────────────────────────────────────────────────────────────────────
  { id: 'ration_rice_bj', name: 'Rice (imported)', category: 'Staples', class: 'Food',
    issueQtyPerPersonDay: 0.12, issueUnit: 'kg', nutrition: { kcal: 3600, proteinG: 70, fruitVegG: 0 },
    pack: bulk([{ tier: 'large', size: 25, packName: '25 kg bag', unit: 'kg' }, { tier: 'medium', size: 10, packName: '10 kg bag', unit: 'kg' }, { tier: 'small', size: 5, packName: '5 kg bag', unit: 'kg' }]),
    procurementNote: 'Primary staple; buy in bulk bags.' },
  { id: 'ration_maize_meal_bj', name: 'Maize meal / akassa', category: 'Staples', class: 'Food',
    issueQtyPerPersonDay: 0.10, issueUnit: 'kg', nutrition: { kcal: 3600, proteinG: 80, fruitVegG: 0 },
    pack: bulk([{ tier: 'large', size: 25, packName: '25 kg bag', unit: 'kg' }, { tier: 'medium', size: 10, packName: '10 kg bag', unit: 'kg' }, { tier: 'small', size: 1, packName: '1 kg bag', unit: 'kg' }]),
    procurementNote: 'Used for akassa/pâte; buy in bulk bags.' },
  { id: 'ration_cassava_gari', name: 'Gari (cassava flour)', category: 'Staples', class: 'Food',
    issueQtyPerPersonDay: 0.08, issueUnit: 'kg', nutrition: { kcal: 3500, proteinG: 10, fruitVegG: 0 },
    pack: bulk([{ tier: 'large', size: 25, packName: '25 kg bag', unit: 'kg' }, { tier: 'medium', size: 10, packName: '10 kg bag', unit: 'kg' }, { tier: 'small', size: 1, packName: '1 kg bag', unit: 'kg' }]),
    procurementNote: 'Shelf-stable cassava staple; quick reconstitution meal.' },
  { id: 'ration_yam_bj', name: 'Yam / igname', category: 'Staples', class: 'Food',
    issueQtyPerPersonDay: 0.15, issueUnit: 'kg', nutrition: { kcal: 1180, proteinG: 15, fruitVegG: 0 },
    pack: bulk([{ tier: 'large', size: 25, packName: '25 kg lot', unit: 'kg' }, { tier: 'medium', size: 10, packName: '10 kg lot', unit: 'kg' }, { tier: 'small', size: 1, packName: '1 kg tuber', unit: 'kg' }]),
    procurementNote: 'Fresh; buy per tuber approximating kg basis.' },
  { id: 'ration_pasta_bj', name: 'Pasta / spaghetti', category: 'Staples', class: 'Food',
    issueQtyPerPersonDay: 0.05, issueUnit: 'kg', nutrition: { kcal: 3700, proteinG: 130, fruitVegG: 0 },
    pack: simple(0.5, '500 g pack'), procurementNote: 'Shelf-stable variation staple.' },
  { id: 'ration_bread_purchased_bj', name: 'Purchased bread — first deployment days only', category: 'Staples', class: 'Food',
    issueQtyPerPersonDay: 0.12, issueUnit: 'kg', nutrition: { kcal: 2650, proteinG: 90, fruitVegG: 0 },
    specialFormula: 'purchasedBread', pack: simple(0.7, '700 g loaf'),
    procurementNote: 'Purchase only for initial days; replace with camp-made bread thereafter.' },
  { id: 'ration_flour_bj', name: 'Wheat flour for camp bread', category: 'Staples', class: 'Food',
    issueQtyPerPersonDay: 0.12, issueUnit: 'kg', nutrition: { kcal: 3640, proteinG: 103, fruitVegG: 0 },
    specialFormula: 'steamedFlour',
    pack: bulk([{ tier: 'large', size: 25, packName: '25 kg bag', unit: 'kg' }, { tier: 'medium', size: 10, packName: '10 kg bag', unit: 'kg' }, { tier: 'small', size: 1, packName: '1 kg bag', unit: 'kg' }]),
    procurementNote: 'For camp-made bread after purchased-bread coverage period.' },

  // ── Protein ────────────────────────────────────────────────────────────────────
  { id: 'ration_niebe_beans', name: 'Cowpea / niébé (dry beans)', category: 'Protein', class: 'Food',
    issueQtyPerPersonDay: 0.08, issueUnit: 'kg', nutrition: { kcal: 3400, proteinG: 230, fruitVegG: 0 },
    pack: bulk([{ tier: 'large', size: 25, packName: '25 kg bag', unit: 'kg' }, { tier: 'medium', size: 10, packName: '10 kg bag', unit: 'kg' }, { tier: 'small', size: 1, packName: '1 kg bag', unit: 'kg' }]),
    procurementNote: 'Primary plant protein; Ademe/gombo stew base.' },
  { id: 'ration_smoked_fish', name: 'Smoked / dried fish', category: 'Protein', class: 'Food',
    issueQtyPerPersonDay: 0.02, issueUnit: 'kg', nutrition: { kcal: 2500, proteinG: 450, fruitVegG: 0 },
    pack: simple(0.5, '500 g pack'), procurementNote: 'Shelf-stable animal protein; flavour base for sauces.' },
  { id: 'ration_fresh_fish', name: 'Fresh fish (tilapia / capitaine)', category: 'Protein', class: 'Food',
    issueQtyPerPersonDay: 0.05, issueUnit: 'kg', nutrition: { kcal: 1200, proteinG: 180, fruitVegG: 0 },
    pack: simple(1, '1 kg'), procurementNote: 'When local supply / cold chain allows.' },
  { id: 'ration_sardines_canned_bj', name: 'Canned sardines in tomato sauce', category: 'Protein', class: 'Food',
    issueQtyPerPersonDay: 0.035, issueUnit: 'kg', nutrition: { kcal: 2000, proteinG: 200, fruitVegG: 0 },
    pack: simple(0.125, '125 g can'), procurementNote: 'Shelf-stable animal protein.' },
  { id: 'ration_eggs_bj', name: 'Eggs', category: 'Protein', class: 'Food',
    issueQtyPerPersonDay: 0.5, issueUnit: 'egg', nutrition: { kcal: 72, proteinG: 6.3, fruitVegG: 0 },
    pack: bulk([{ tier: 'large', size: 30, packName: '30-egg tray', unit: 'egg' }]),
    procurementNote: 'Buy in trays; handle carefully in field.' },
  { id: 'ration_groundnut', name: 'Roasted groundnut / peanut', category: 'Protein', class: 'Food',
    issueQtyPerPersonDay: 0.03, issueUnit: 'kg', nutrition: { kcal: 5700, proteinG: 260, fruitVegG: 0 },
    pack: simple(1, '1 kg pack'), procurementNote: 'Snack and sauce thickener (groundnut sauce).' },
  { id: 'ration_peanut_butter_bj', name: 'Peanut butter', category: 'Protein', class: 'Food',
    issueQtyPerPersonDay: 0.03, issueUnit: 'kg', nutrition: { kcal: 5880, proteinG: 250, fruitVegG: 0 },
    pack: simple(1, '1 kg jar'), procurementNote: 'Energy and protein; bread/porridge accompaniment.' },

  // ── Dairy ──────────────────────────────────────────────────────────────────────
  { id: 'ration_powdered_milk', name: 'Powdered milk', category: 'Dairy', class: 'Food',
    issueQtyPerPersonDay: 0.03, issueUnit: 'kg', nutrition: { kcal: 5000, proteinG: 250, fruitVegG: 0 },
    pack: simple(0.4, '400 g pack'), procurementNote: 'Shelf-stable; reconstitute for porridge/beverages.' },
  { id: 'ration_uht_milk_bj', name: 'UHT full-cream milk', category: 'Dairy', class: 'Food',
    issueQtyPerPersonDay: 0.15, issueUnit: 'L', nutrition: { kcal: 620, proteinG: 33, fruitVegG: 0 },
    pack: bulk([{ tier: 'large', size: 6, packName: '6 × 1 L case', unit: 'L' }]),
    procurementNote: 'Shelf-stable; buy by the case.' },

  // ── Cooking Inputs ─────────────────────────────────────────────────────────────
  { id: 'ration_palm_oil', name: 'Palm oil (primary cooking fat)', category: 'Cooking Inputs', class: 'Food',
    issueQtyPerPersonDay: 0.04, issueUnit: 'L', nutrition: { kcal: 8840, proteinG: 0, fruitVegG: 0 },
    pack: bulk([{ tier: 'large', size: 5, packName: '5 L jerrycan', unit: 'L' }, { tier: 'medium', size: 2, packName: '2 L bottle', unit: 'L' }, { tier: 'small', size: 1, packName: '1 L bottle', unit: 'L' }]),
    procurementNote: 'Primary cooking fat in Benin cuisine; unrefined red palm preferred.' },
  { id: 'ration_veg_oil_bj', name: 'Vegetable oil (secondary)', category: 'Cooking Inputs', class: 'Food',
    issueQtyPerPersonDay: 0.02, issueUnit: 'L', nutrition: { kcal: 8100, proteinG: 0, fruitVegG: 0 },
    pack: bulk([{ tier: 'large', size: 5, packName: '5 L bottle', unit: 'L' }, { tier: 'small', size: 1, packName: '1 L bottle', unit: 'L' }]),
    procurementNote: 'For frying variation.' },
  { id: 'ration_sugar_bj', name: 'Sugar', category: 'Cooking Inputs', class: 'Food',
    issueQtyPerPersonDay: 0.025, issueUnit: 'kg', nutrition: { kcal: 4000, proteinG: 0, fruitVegG: 0 },
    pack: bulk([{ tier: 'large', size: 25, packName: '25 kg bag', unit: 'kg' }, { tier: 'medium', size: 5, packName: '5 kg bag', unit: 'kg' }, { tier: 'small', size: 1, packName: '1 kg bag', unit: 'kg' }]),
    procurementNote: 'Beverages and porridge.' },
  { id: 'ration_tomato_paste', name: 'Tomato paste (concentrated)', category: 'Cooking Inputs', class: 'Food',
    issueQtyPerPersonDay: 0.02, issueUnit: 'kg', nutrition: { kcal: 800, proteinG: 30, fruitVegG: 1000 },
    pack: simple(0.4, '400 g can'), procurementNote: 'Sauce base; shelf-stable. Counts toward fruit/veg.' },

  // ── Vegetables & Fruit ─────────────────────────────────────────────────────────
  { id: 'ration_onions_bj', name: 'Onions', category: 'Vegetables & Fruit', class: 'Food',
    issueQtyPerPersonDay: 0.07, issueUnit: 'kg', nutrition: { kcal: 400, proteinG: 11, fruitVegG: 1000 },
    pack: bulk([{ tier: 'large', size: 25, packName: '25 kg bag', unit: 'kg' }, { tier: 'medium', size: 10, packName: '10 kg bag', unit: 'kg' }, { tier: 'small', size: 1, packName: '1 kg bag', unit: 'kg' }]),
    procurementNote: 'Universal sauce base.' },
  { id: 'ration_tomatoes_fresh', name: 'Fresh tomatoes', category: 'Vegetables & Fruit', class: 'Food',
    issueQtyPerPersonDay: 0.10, issueUnit: 'kg', nutrition: { kcal: 180, proteinG: 9, fruitVegG: 1000 },
    pack: bulk([{ tier: 'large', size: 25, packName: '25 kg crate', unit: 'kg' }, { tier: 'medium', size: 10, packName: '10 kg lot', unit: 'kg' }, { tier: 'small', size: 1, packName: '1 kg lot', unit: 'kg' }]),
    procurementNote: 'Fresh where market supply allows.' },
  { id: 'ration_pepper_chili', name: 'Fresh chili / pili-pili', category: 'Vegetables & Fruit', class: 'Food',
    issueQtyPerPersonDay: 0.005, issueUnit: 'kg', nutrition: { kcal: 400, proteinG: 20, fruitVegG: 1000 },
    pack: simple(0.1, '100 g pack'), procurementNote: 'Heat; adjust to team preference.' },
  { id: 'ration_okra', name: 'Okra / gombo', category: 'Vegetables & Fruit', class: 'Food',
    issueQtyPerPersonDay: 0.04, issueUnit: 'kg', nutrition: { kcal: 330, proteinG: 19, fruitVegG: 1000 },
    pack: bulk([{ tier: 'large', size: 5, packName: '5 kg lot', unit: 'kg' }, { tier: 'medium', size: 2, packName: '2 kg lot', unit: 'kg' }, { tier: 'small', size: 1, packName: '1 kg lot', unit: 'kg' }]),
    procurementNote: 'Classic stew vegetable.' },
  { id: 'ration_leafy_greens', name: 'Leafy greens (ademe / amaranth / spinach)', category: 'Vegetables & Fruit', class: 'Food',
    issueQtyPerPersonDay: 0.06, issueUnit: 'kg', nutrition: { kcal: 230, proteinG: 29, fruitVegG: 1000 },
    pack: simple(1, '1 kg bunch'), procurementNote: 'Traditional sauce green; high micronutrient.' },
  { id: 'ration_plantain', name: 'Plantain', category: 'Vegetables & Fruit', class: 'Food',
    issueQtyPerPersonDay: 0.08, issueUnit: 'kg', nutrition: { kcal: 1220, proteinG: 13, fruitVegG: 1000 },
    pack: bulk([{ tier: 'large', size: 10, packName: '10 kg lot', unit: 'kg' }, { tier: 'medium', size: 5, packName: '5 kg lot', unit: 'kg' }, { tier: 'small', size: 1, packName: '1 kg bunch', unit: 'kg' }]),
    procurementNote: 'Starch/fruit-veg cross-over; fried or boiled.' },
  { id: 'ration_seasonal_fruit_bj', name: 'Seasonal fruit (mango / pineapple / banana)', category: 'Vegetables & Fruit', class: 'Food',
    issueQtyPerPersonDay: 0.15, issueUnit: 'kg', nutrition: { kcal: 500, proteinG: 5, fruitVegG: 1000 },
    pack: bulk([{ tier: 'large', size: 5, packName: '5 kg lot', unit: 'kg' }, { tier: 'medium', size: 2, packName: '2 kg lot', unit: 'kg' }, { tier: 'small', size: 1, packName: '1 kg lot', unit: 'kg' }]),
    procurementNote: 'Durable seasonal fruit; vary by market availability.' },

  // ── Seasoning ──────────────────────────────────────────────────────────────────
  { id: 'ration_salt_bj', name: 'Iodised salt', category: 'Seasoning', class: 'Provision',
    issueQtyPerPersonDay: 0.003, issueUnit: 'kg', nutrition: { kcal: 0, proteinG: 0, fruitVegG: 0 },
    pack: simple(1, '1 kg pack'), procurementNote: 'Use iodised salt.' },
  { id: 'ration_bouillon_cubes', name: 'Bouillon cubes (Maggi / Jumbo)', category: 'Seasoning', class: 'Provision',
    issueQtyPerPersonDay: 0.005, issueUnit: 'kg', nutrition: { kcal: 0, proteinG: 0, fruitVegG: 0 },
    pack: simple(0.1, '100 g pack'), procurementNote: 'Universal West African seasoning; monitor sodium.' },
  { id: 'ration_chili_powder', name: 'Chili powder / pili-pili powder', category: 'Seasoning', class: 'Provision',
    issueQtyPerPersonDay: 0.002, issueUnit: 'kg', nutrition: { kcal: 0, proteinG: 0, fruitVegG: 0 },
    pack: simple(0.1, '100 g pack'), procurementNote: 'Heat seasoning.' },
  { id: 'ration_garlic_bj', name: 'Garlic', category: 'Seasoning', class: 'Provision',
    issueQtyPerPersonDay: 0.005, issueUnit: 'kg', nutrition: { kcal: 0, proteinG: 0, fruitVegG: 0 },
    pack: simple(0.25, '250 g pack'), procurementNote: 'Sauce base.' },
  { id: 'ration_ginger', name: 'Ginger', category: 'Seasoning', class: 'Provision',
    issueQtyPerPersonDay: 0.003, issueUnit: 'kg', nutrition: { kcal: 0, proteinG: 0, fruitVegG: 0 },
    pack: simple(0.1, '100 g pack'), procurementNote: 'Flavour and beverage base.' },

  // ── Issued Beverages ───────────────────────────────────────────────────────────
  { id: 'ration_tea_bj', name: 'Tea bags', category: 'Issued Beverages', class: 'Provision',
    issueQtyPerPersonDay: 2, issueUnit: 'bag', nutrition: { kcal: 0, proteinG: 0, fruitVegG: 0 },
    pack: simple(160, '160-bag box'), procurementNote: 'Basic hot beverage.' },
  { id: 'ration_instant_coffee', name: 'Instant coffee', category: 'Issued Beverages', class: 'Provision',
    issueQtyPerPersonDay: 0.003, issueUnit: 'kg', nutrition: { kcal: 0, proteinG: 0, fruitVegG: 0 },
    pack: simple(0.1, '100 g jar'), procurementNote: 'Basic hot beverage.' },
  { id: 'ration_hot_chocolate_bj', name: 'Hot chocolate drink powder', category: 'Issued Beverages', class: 'Provision',
    issueQtyPerPersonDay: 0.01, issueUnit: 'kg', nutrition: { kcal: 0, proteinG: 0, fruitVegG: 0 },
    pack: simple(0.5, '500 g pack'), procurementNote: 'Cold morning beverage.' },

  // ── Kitchen & Hygiene (Fixed = per-deployment) ─────────────────────────────────
  { id: 'ration_dishwashing_bj', name: 'Dishwashing liquid', category: 'Kitchen & Hygiene', class: 'Fixed',
    issueQtyPerPersonDay: 2, issueUnit: 'bottle', nutrition: { kcal: 0, proteinG: 0, fruitVegG: 0 },
    pack: simple(1, 'bottle'), procurementNote: 'Fixed per deployment.' },
  { id: 'ration_handwashing_soap_bj', name: 'Handwashing soap', category: 'Kitchen & Hygiene', class: 'Fixed',
    issueQtyPerPersonDay: 4, issueUnit: 'bar', nutrition: { kcal: 0, proteinG: 0, fruitVegG: 0 },
    pack: simple(1, 'bar'), procurementNote: 'Fixed per deployment.' },
  { id: 'ration_bin_bags_bj', name: 'Heavy-duty bin bags', category: 'Kitchen & Hygiene', class: 'Fixed',
    issueQtyPerPersonDay: 1, issueUnit: 'roll', nutrition: { kcal: 0, proteinG: 0, fruitVegG: 0 },
    pack: simple(1, 'roll'), procurementNote: 'Fixed per deployment.' },
  { id: 'ration_matches_bj', name: 'Matches / lighters', category: 'Kitchen & Hygiene', class: 'Fixed',
    issueQtyPerPersonDay: 2, issueUnit: 'unit', nutrition: { kcal: 0, proteinG: 0, fruitVegG: 0 },
    pack: simple(1, 'unit'), procurementNote: 'Fixed per deployment.' },
  { id: 'ration_storage_buckets_bj', name: 'Airtight storage buckets', category: 'Kitchen & Hygiene', class: 'Fixed',
    issueQtyPerPersonDay: 5, issueUnit: 'bucket', nutrition: { kcal: 0, proteinG: 0, fruitVegG: 0 },
    pack: simple(1, 'bucket'), procurementNote: 'Only if not already at camp.' },
  { id: 'ration_can_opener_bj', name: 'Robust can opener', category: 'Kitchen & Hygiene', class: 'Fixed',
    issueQtyPerPersonDay: 1, issueUnit: 'unit', nutrition: { kcal: 0, proteinG: 0, fruitVegG: 0 },
    pack: simple(1, 'unit'), procurementNote: 'Only if not already at camp.' },

  // ── Formula-driven companions ──────────────────────────────────────────────────
  { id: 'ration_yeast_bj', name: 'Instant dry yeast for camp bread', category: 'Cooking Inputs', class: 'Food',
    issueQtyPerPersonDay: 0, issueUnit: 'kg', nutrition: { kcal: 0, proteinG: 0, fruitVegG: 0 },
    specialFormula: 'yeast', pack: simple(0.1, '100 g pack'),
    procurementNote: 'For camp bread after purchased-bread coverage period.' },
  { id: 'ration_toilet_paper_bj', name: 'Toilet paper', category: 'Kitchen & Hygiene', class: 'Provision',
    issueQtyPerPersonDay: 0, issueUnit: 'roll', nutrition: { kcal: 0, proteinG: 0, fruitVegG: 0 },
    specialFormula: 'toiletPaper', pack: simple(1, 'roll'),
    procurementNote: 'Scaled to person-days; enter unit price per roll.' },
];

export const BENIN_DEFAULTS = {
  nutritionTargets: { kcal: 3600, proteinG: 100, fruitVegG: 400 } as NutritionTargets,
  defaultBuffer: 0.05,
  breadCoverageDays: 7,
  flourPerLoafKg: 0.52,
  yeastProportion: 0.02,
  personDaysPerToiletRoll: 3.5,
  defaultCurrency: 'XOF',
  reportingCurrency: 'EUR',
};

export const BENIN_MENU = {
  id: 'provisioning_menu_1pwr_benin',
  name: '7-Day Benin Camp Menu Cycle',
  cycleLength: 7,
  days: [
    { day: 1, breakfast: 'Maize porridge with powdered milk; tea/coffee', midday: 'Cowpea (niébé) stew with rice', evening: 'Pâte (maize) with palm-oil tomato sauce and smoked fish' },
    { day: 2, breakfast: 'Eggs and bread; tea/coffee', midday: 'Gari and groundnut sauce with fried plantain', evening: 'Rice, fresh fish stew and okra' },
    { day: 3, breakfast: 'Maize porridge with peanut butter; tea/coffee', midday: 'Cowpea and leafy-green (ademe) stew with rice', evening: 'Pâte with sardine-tomato sauce and plantain' },
    { day: 4, breakfast: 'Eggs and bread; tea/coffee', midday: 'Yam with groundnut sauce and fruit', evening: 'Rice, smoked-fish stew and leafy greens' },
    { day: 5, breakfast: 'Maize porridge with powdered milk; tea/coffee', midday: 'Pasta with tomato and sardine sauce', evening: 'Pâte with palm-oil sauce and cowpea' },
    { day: 6, breakfast: 'Eggs and bread; tea/coffee', midday: 'Gari and cowpea stew with fruit', evening: 'Rice, groundnut stew and fried plantain' },
    { day: 7, breakfast: 'Maize porridge with peanut butter; tea/coffee', midday: 'Yam and leafy-green stew with smoked fish', evening: 'Rice, mixed legume stew and vegetables' },
  ],
};

export interface BeninSeedPrice { id: string; rationId: string; tier: RationPriceTier; packName: string; price: number }

/** Indicative West-African market prices in XOF — refine via the Provisioning Studio. */
export const BENIN_PRICES: BeninSeedPrice[] = [
  { id: 'price_rice_bj_l', rationId: 'ration_rice_bj', tier: 'large', packName: '25 kg bag', price: 15000 },
  { id: 'price_rice_bj_m', rationId: 'ration_rice_bj', tier: 'medium', packName: '10 kg bag', price: 6500 },
  { id: 'price_rice_bj_s', rationId: 'ration_rice_bj', tier: 'small', packName: '5 kg bag', price: 3500 },
  { id: 'price_maize_bj_l', rationId: 'ration_maize_meal_bj', tier: 'large', packName: '25 kg bag', price: 10000 },
  { id: 'price_maize_bj_m', rationId: 'ration_maize_meal_bj', tier: 'medium', packName: '10 kg bag', price: 4500 },
  { id: 'price_maize_bj_s', rationId: 'ration_maize_meal_bj', tier: 'small', packName: '1 kg bag', price: 500 },
  { id: 'price_gari_l', rationId: 'ration_cassava_gari', tier: 'large', packName: '25 kg bag', price: 12000 },
  { id: 'price_gari_m', rationId: 'ration_cassava_gari', tier: 'medium', packName: '10 kg bag', price: 5000 },
  { id: 'price_gari_s', rationId: 'ration_cassava_gari', tier: 'small', packName: '1 kg bag', price: 700 },
  { id: 'price_yam_l', rationId: 'ration_yam_bj', tier: 'large', packName: '25 kg lot', price: 8000 },
  { id: 'price_yam_m', rationId: 'ration_yam_bj', tier: 'medium', packName: '10 kg lot', price: 3500 },
  { id: 'price_yam_s', rationId: 'ration_yam_bj', tier: 'small', packName: '1 kg tuber', price: 400 },
  { id: 'price_pasta', rationId: 'ration_pasta_bj', tier: null, packName: '500 g pack', price: 400 },
  { id: 'price_bread_bj', rationId: 'ration_bread_purchased_bj', tier: null, packName: '700 g loaf', price: 300 },
  { id: 'price_flour_bj_l', rationId: 'ration_flour_bj', tier: 'large', packName: '25 kg bag', price: 14000 },
  { id: 'price_flour_bj_m', rationId: 'ration_flour_bj', tier: 'medium', packName: '10 kg bag', price: 6000 },
  { id: 'price_flour_bj_s', rationId: 'ration_flour_bj', tier: 'small', packName: '1 kg bag', price: 800 },
  { id: 'price_niebe_l', rationId: 'ration_niebe_beans', tier: 'large', packName: '25 kg bag', price: 18000 },
  { id: 'price_niebe_m', rationId: 'ration_niebe_beans', tier: 'medium', packName: '10 kg bag', price: 8000 },
  { id: 'price_niebe_s', rationId: 'ration_niebe_beans', tier: 'small', packName: '1 kg bag', price: 1000 },
  { id: 'price_smoked_fish', rationId: 'ration_smoked_fish', tier: null, packName: '500 g pack', price: 2000 },
  { id: 'price_fresh_fish', rationId: 'ration_fresh_fish', tier: null, packName: '1 kg', price: 1500 },
  { id: 'price_sardines_bj', rationId: 'ration_sardines_canned_bj', tier: null, packName: '125 g can', price: 300 },
  { id: 'price_eggs_bj_l', rationId: 'ration_eggs_bj', tier: 'large', packName: '30-egg tray', price: 3000 },
  { id: 'price_groundnut', rationId: 'ration_groundnut', tier: null, packName: '1 kg pack', price: 1200 },
  { id: 'price_peanut_butter_bj', rationId: 'ration_peanut_butter_bj', tier: null, packName: '1 kg jar', price: 2500 },
  { id: 'price_powdered_milk', rationId: 'ration_powdered_milk', tier: null, packName: '400 g pack', price: 2500 },
  { id: 'price_uht_bj_l', rationId: 'ration_uht_milk_bj', tier: 'large', packName: '6 × 1 L case', price: 3600 },
  { id: 'price_palm_oil_l', rationId: 'ration_palm_oil', tier: 'large', packName: '5 L jerrycan', price: 6000 },
  { id: 'price_palm_oil_m', rationId: 'ration_palm_oil', tier: 'medium', packName: '2 L bottle', price: 2500 },
  { id: 'price_palm_oil_s', rationId: 'ration_palm_oil', tier: 'small', packName: '1 L bottle', price: 1400 },
  { id: 'price_veg_oil_l', rationId: 'ration_veg_oil_bj', tier: 'large', packName: '5 L bottle', price: 5000 },
  { id: 'price_veg_oil_s', rationId: 'ration_veg_oil_bj', tier: 'small', packName: '1 L bottle', price: 1100 },
  { id: 'price_sugar_bj_l', rationId: 'ration_sugar_bj', tier: 'large', packName: '25 kg bag', price: 15000 },
  { id: 'price_sugar_bj_m', rationId: 'ration_sugar_bj', tier: 'medium', packName: '5 kg bag', price: 3500 },
  { id: 'price_sugar_bj_s', rationId: 'ration_sugar_bj', tier: 'small', packName: '1 kg bag', price: 800 },
  { id: 'price_tomato_paste', rationId: 'ration_tomato_paste', tier: null, packName: '400 g can', price: 800 },
  { id: 'price_onions_bj_l', rationId: 'ration_onions_bj', tier: 'large', packName: '25 kg bag', price: 8000 },
  { id: 'price_onions_bj_m', rationId: 'ration_onions_bj', tier: 'medium', packName: '10 kg bag', price: 3500 },
  { id: 'price_onions_bj_s', rationId: 'ration_onions_bj', tier: 'small', packName: '1 kg bag', price: 500 },
  { id: 'price_tomatoes_l', rationId: 'ration_tomatoes_fresh', tier: 'large', packName: '25 kg crate', price: 8000 },
  { id: 'price_tomatoes_m', rationId: 'ration_tomatoes_fresh', tier: 'medium', packName: '10 kg lot', price: 4000 },
  { id: 'price_tomatoes_s', rationId: 'ration_tomatoes_fresh', tier: 'small', packName: '1 kg lot', price: 500 },
  { id: 'price_chili_fresh', rationId: 'ration_pepper_chili', tier: null, packName: '100 g pack', price: 200 },
  { id: 'price_okra_l', rationId: 'ration_okra', tier: 'large', packName: '5 kg lot', price: 2500 },
  { id: 'price_okra_m', rationId: 'ration_okra', tier: 'medium', packName: '2 kg lot', price: 1100 },
  { id: 'price_okra_s', rationId: 'ration_okra', tier: 'small', packName: '1 kg lot', price: 600 },
  { id: 'price_greens', rationId: 'ration_leafy_greens', tier: null, packName: '1 kg bunch', price: 500 },
  { id: 'price_plantain_l', rationId: 'ration_plantain', tier: 'large', packName: '10 kg lot', price: 3500 },
  { id: 'price_plantain_m', rationId: 'ration_plantain', tier: 'medium', packName: '5 kg lot', price: 2000 },
  { id: 'price_plantain_s', rationId: 'ration_plantain', tier: 'small', packName: '1 kg bunch', price: 500 },
  { id: 'price_fruit_bj_l', rationId: 'ration_seasonal_fruit_bj', tier: 'large', packName: '5 kg lot', price: 2500 },
  { id: 'price_fruit_bj_m', rationId: 'ration_seasonal_fruit_bj', tier: 'medium', packName: '2 kg lot', price: 1100 },
  { id: 'price_fruit_bj_s', rationId: 'ration_seasonal_fruit_bj', tier: 'small', packName: '1 kg lot', price: 600 },
  { id: 'price_salt_bj', rationId: 'ration_salt_bj', tier: null, packName: '1 kg pack', price: 200 },
  { id: 'price_bouillon', rationId: 'ration_bouillon_cubes', tier: null, packName: '100 g pack', price: 150 },
  { id: 'price_chili_powder', rationId: 'ration_chili_powder', tier: null, packName: '100 g pack', price: 200 },
  { id: 'price_garlic_bj', rationId: 'ration_garlic_bj', tier: null, packName: '250 g pack', price: 400 },
  { id: 'price_ginger', rationId: 'ration_ginger', tier: null, packName: '100 g pack', price: 150 },
  { id: 'price_tea_bj', rationId: 'ration_tea_bj', tier: null, packName: '160-bag box', price: 1500 },
  { id: 'price_instant_coffee', rationId: 'ration_instant_coffee', tier: null, packName: '100 g jar', price: 800 },
  { id: 'price_hot_chocolate_bj', rationId: 'ration_hot_chocolate_bj', tier: null, packName: '500 g pack', price: 1500 },
  { id: 'price_dishwashing_bj', rationId: 'ration_dishwashing_bj', tier: null, packName: 'bottle', price: 1500 },
  { id: 'price_handwashing_bj', rationId: 'ration_handwashing_soap_bj', tier: null, packName: 'bar', price: 300 },
  { id: 'price_bin_bags_bj', rationId: 'ration_bin_bags_bj', tier: null, packName: 'roll', price: 1500 },
  { id: 'price_matches_bj', rationId: 'ration_matches_bj', tier: null, packName: 'unit', price: 200 },
  { id: 'price_buckets_bj', rationId: 'ration_storage_buckets_bj', tier: null, packName: 'bucket', price: 3000 },
  { id: 'price_can_opener_bj', rationId: 'ration_can_opener_bj', tier: null, packName: 'unit', price: 2500 },
  { id: 'price_yeast_bj', rationId: 'ration_yeast_bj', tier: null, packName: '100 g pack', price: 300 },
  { id: 'price_toilet_paper_bj', rationId: 'ration_toilet_paper_bj', tier: null, packName: 'roll', price: 200 },
];
