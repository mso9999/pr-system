/**
 * One-time seed for the Lesotho Field Camp provisioning catalog.
 *
 * Ports `docs/260528 Lesotho_Field_Camp_Provisioning_v3.xlsx` into PR's org-scoped
 * reference-data collections for 1PWR Lesotho (`1pwr_lesotho`, currency LSL):
 *
 *   - referenceData_rations               (22 issue items with pack planning + nutrition)
 *   - referenceData_provisioningDefaults  (planning defaults for the org)
 *   - referenceData_provisioningMenus     (default 7-day meal cycle)
 *   - referenceData_rationPrices          (a handful of indicative prices — REPLACE with real procurement data)
 *
 * Idempotent: re-running updates docs in place using stable seed ids (ration_{slug}).
 * Run with --dry-run to preview.
 *
 * Node 26 + firebase-admin workaround:
 *   cp scripts/_slowbuffer-polyfill.cjs /tmp/_slowbuffer-polyfill.cjs
 *   NODE_OPTIONS="--require /tmp/_slowbuffer-polyfill.cjs" npm run seed-rations -- --dry-run
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type { RationItem, RationPackPlanning } from "../src/types/provisioning";

const SA_PATH = join(__dirname, "../firebase-service-account.json");
if (!existsSync(SA_PATH)) {
  console.error(`Missing ${SA_PATH}. Place the service account JSON at the repo root.`);
  process.exit(1);
}
const sa = JSON.parse(readFileSync(SA_PATH, "utf8"));
initializeApp({ credential: cert(sa) });
const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

const ORG_ID = "1pwr_lesotho";
const ORG_NAME = "1PWR Lesotho";
const CURRENCY = "LSL";

const simple = (packSize: number, packName: string): RationPackPlanning => ({ mode: "simple", packSize, packName });
const bulk = (tiers: Array<{ tier: "large" | "medium" | "small"; size: number; packName: string; unit: string }>): RationPackPlanning => ({ mode: "bulk", tiers });

interface SeedRation {
  id: string;
  name: string;
  category: RationItem["category"];
  class: RationItem["class"];
  issueQtyPerPersonDay: number;
  issueUnit: string;
  nutrition: { kcal: number; proteinG: number; fruitVegG: number };
  specialFormula?: RationItem["specialFormula"];
  pack: RationPackPlanning;
  procurementNote?: string;
}

const RATIONS: SeedRation[] = [
  { id: "ration_maize_meal", name: "Maize Meal", category: "Staples", class: "Food", issueQtyPerPersonDay: 0.28, issueUnit: "kg", nutrition: { kcal: 3600, proteinG: 90, fruitVegG: 0 }, pack: bulk([{ tier: "large", size: 10, packName: "10 kg bag", unit: "kg" }, { tier: "medium", size: 5, packName: "5 kg bag", unit: "kg" }, { tier: "small", size: 2, packName: "2 kg bag", unit: "kg" }]) },
  { id: "ration_rice", name: "Rice", category: "Staples", class: "Food", issueQtyPerPersonDay: 0.15, issueUnit: "kg", nutrition: { kcal: 3500, proteinG: 70, fruitVegG: 0 }, pack: bulk([{ tier: "large", size: 10, packName: "10 kg bag", unit: "kg" }, { tier: "medium", size: 5, packName: "5 kg bag", unit: "kg" }, { tier: "small", size: 1, packName: "1 kg bag", unit: "kg" }]) },
  { id: "ration_bread_purchased", name: "Purchased Bread", category: "Staples", class: "Food", issueQtyPerPersonDay: 0.12, issueUnit: "kg", nutrition: { kcal: 2650, proteinG: 90, fruitVegG: 0 }, specialFormula: "purchasedBread", pack: simple(0.7, "loaf (700 g)"), procurementNote: "0.12 kg/person-day while purchased; switches to steamed flour after breadCoverageDays." },
  { id: "ration_flour_steamed", name: "Wheat Flour (camp steamed bread)", category: "Staples", class: "Food", issueQtyPerPersonDay: 0.12, issueUnit: "kg", nutrition: { kcal: 3640, proteinG: 103, fruitVegG: 0 }, specialFormula: "steamedFlour", pack: bulk([{ tier: "large", size: 10, packName: "10 kg bag", unit: "kg" }, { tier: "medium", size: 5, packName: "5 kg bag", unit: "kg" }, { tier: "small", size: 1, packName: "1 kg bag", unit: "kg" }]), procurementNote: "Issue qty derived: (0.12/0.7) × flourPerLoafKg × MAX(days − breadCoverageDays, 0) / days." },
  { id: "ration_yeast", name: "Instant Yeast", category: "Cooking Inputs", class: "Food", issueQtyPerPersonDay: 0.0018, issueUnit: "kg", nutrition: { kcal: 0, proteinG: 0, fruitVegG: 0 }, specialFormula: "yeast", pack: simple(0.01, "10 g sachet"), procurementNote: "Derived: steamed-flour issue qty × yeastProportion." },
  { id: "ration_sugar", name: "Sugar", category: "Seasoning", class: "Food", issueQtyPerPersonDay: 0.06, issueUnit: "kg", nutrition: { kcal: 4000, proteinG: 0, fruitVegG: 0 }, pack: bulk([{ tier: "large", size: 5, packName: "5 kg bag", unit: "kg" }, { tier: "medium", size: 2.5, packName: "2.5 kg bag", unit: "kg" }, { tier: "small", size: 1, packName: "1 kg bag", unit: "kg" }]) },
  { id: "ration_cooking_oil", name: "Cooking Oil", category: "Cooking Inputs", class: "Food", issueQtyPerPersonDay: 0.038, issueUnit: "L", nutrition: { kcal: 8840, proteinG: 0, fruitVegG: 0 }, pack: bulk([{ tier: "large", size: 5, packName: "5 L bottle", unit: "L" }, { tier: "medium", size: 2, packName: "2 L bottle", unit: "L" }, { tier: "small", size: 1, packName: "1 L bottle", unit: "L" }]) },
  { id: "ration_salt", name: "Salt", category: "Seasoning", class: "Food", issueQtyPerPersonDay: 0.005, issueUnit: "kg", nutrition: { kcal: 0, proteinG: 0, fruitVegG: 0 }, pack: simple(1, "1 kg pack") },
  { id: "ration_soup_powder", name: "Soup Powder", category: "Seasoning", class: "Food", issueQtyPerPersonDay: 0.025, issueUnit: "kg", nutrition: { kcal: 1500, proteinG: 50, fruitVegG: 0 }, pack: simple(0.2, "200 g pack") },
  { id: "ration_stock_cubes", name: "Stock Cubes", category: "Seasoning", class: "Food", issueQtyPerPersonDay: 0.005, issueUnit: "kg", nutrition: { kcal: 0, proteinG: 0, fruitVegG: 0 }, pack: simple(0.06, "24-cube box (60 g)") },
  { id: "ration_eggs", name: "Eggs", category: "Protein", class: "Food", issueQtyPerPersonDay: 0.525, issueUnit: "egg", nutrition: { kcal: 1430, proteinG: 12.6, fruitVegG: 0 }, pack: bulk([{ tier: "large", size: 30, packName: "30-egg tray", unit: "egg" }]) },
  { id: "ration_fresh_milk", name: "Fresh Milk", category: "Dairy", class: "Food", issueQtyPerPersonDay: 0.2, issueUnit: "L", nutrition: { kcal: 600, proteinG: 32, fruitVegG: 0 }, pack: bulk([{ tier: "large", size: 6, packName: "6 × 1 L case", unit: "L" }]) },
  { id: "ration_instant_milk", name: "Instant Milk Powder", category: "Dairy", class: "Food", issueQtyPerPersonDay: 0.03, issueUnit: "kg", nutrition: { kcal: 1600, proteinG: 250, fruitVegG: 0 }, pack: simple(0.4, "400 g tin") },
  { id: "ration_potatoes", name: "Potatoes", category: "Vegetables & Fruit", class: "Food", issueQtyPerPersonDay: 0.18, issueUnit: "kg", nutrition: { kcal: 770, proteinG: 20, fruitVegG: 0 }, pack: bulk([{ tier: "large", size: 10, packName: "10 kg pocket", unit: "kg" }, { tier: "medium", size: 5, packName: "5 kg pocket", unit: "kg" }, { tier: "small", size: 1, packName: "1 kg bag", unit: "kg" }]) },
  { id: "ration_onions", name: "Onions", category: "Vegetables & Fruit", class: "Food", issueQtyPerPersonDay: 0.07, issueUnit: "kg", nutrition: { kcal: 40, proteinG: 1.4, fruitVegG: 7 }, pack: bulk([{ tier: "large", size: 10, packName: "10 kg pocket", unit: "kg" }, { tier: "medium", size: 5, packName: "5 kg pocket", unit: "kg" }, { tier: "small", size: 1, packName: "1 kg bag", unit: "kg" }]) },
  { id: "ration_tomatoes", name: "Tomatoes", category: "Vegetables & Fruit", class: "Food", issueQtyPerPersonDay: 0.075, issueUnit: "kg", nutrition: { kcal: 18, proteinG: 0.9, fruitVegG: 7.5 }, pack: bulk([{ tier: "large", size: 10, packName: "10 kg box", unit: "kg" }, { tier: "medium", size: 5, packName: "5 kg box", unit: "kg" }, { tier: "small", size: 1, packName: "1 kg bag", unit: "kg" }]) },
  { id: "ration_cabbage", name: "Cabbage", category: "Vegetables & Fruit", class: "Food", issueQtyPerPersonDay: 0.1, issueUnit: "kg", nutrition: { kcal: 25, proteinG: 1.3, fruitVegG: 10 }, pack: bulk([{ tier: "large", size: 15, packName: "15 kg sack", unit: "kg" }, { tier: "medium", size: 7, packName: "7 kg bag", unit: "kg" }, { tier: "small", size: 1, packName: "1 head (~1 kg)", unit: "kg" }]) },
  { id: "ration_carrots", name: "Carrots", category: "Vegetables & Fruit", class: "Food", issueQtyPerPersonDay: 0.07, issueUnit: "kg", nutrition: { kcal: 41, proteinG: 0.9, fruitVegG: 7 }, pack: bulk([{ tier: "large", size: 10, packName: "10 kg pocket", unit: "kg" }, { tier: "medium", size: 5, packName: "5 kg pocket", unit: "kg" }, { tier: "small", size: 1, packName: "1 kg bag", unit: "kg" }]) },
  { id: "ration_apples", name: "Apples", category: "Vegetables & Fruit", class: "Food", issueQtyPerPersonDay: 0.075, issueUnit: "kg", nutrition: { kcal: 52, proteinG: 0.3, fruitVegG: 7.5 }, pack: bulk([{ tier: "large", size: 10, packName: "10 kg box", unit: "kg" }, { tier: "medium", size: 5, packName: "5 kg box", unit: "kg" }, { tier: "small", size: 1, packName: "1 kg bag", unit: "kg" }]) },
  { id: "ration_tea", name: "Tea (bags)", category: "Issued Beverages", class: "Food", issueQtyPerPersonDay: 0.006, issueUnit: "kg", nutrition: { kcal: 0, proteinG: 0, fruitVegG: 0 }, pack: simple(0.2, "100-bag box (200 g)") },
  { id: "ration_coffee", name: "Coffee", category: "Issued Beverages", class: "Food", issueQtyPerPersonDay: 0.004, issueUnit: "kg", nutrition: { kcal: 0, proteinG: 0, fruitVegG: 0 }, pack: simple(0.2, "200 g jar") },
  { id: "ration_bar_soap", name: "Bar Soap (handwashing)", category: "Kitchen & Hygiene", class: "Provision", issueQtyPerPersonDay: 0.05, issueUnit: "bar", nutrition: { kcal: 0, proteinG: 0, fruitVegG: 0 }, pack: simple(1, "bar") },
  { id: "ration_toilet_paper", name: "Toilet Paper", category: "Kitchen & Hygiene", class: "Provision", issueQtyPerPersonDay: 0.025, issueUnit: "roll", nutrition: { kcal: 0, proteinG: 0, fruitVegG: 0 }, specialFormula: "toiletPaper", pack: simple(9, "9-roll pack"), procurementNote: "Issue qty derived: 1 / personDaysPerToiletRoll." },
  { id: "ration_dishwashing", name: "Dishwashing Liquid", category: "Kitchen & Hygiene", class: "Fixed", issueQtyPerPersonDay: 2, issueUnit: "bottle", nutrition: { kcal: 0, proteinG: 0, fruitVegG: 0 }, pack: simple(1, "750 ml bottle"), procurementNote: "Fixed: per-deployment quantity (not scaled by person-days)." },
];

const DEFAULTS = {
  id: "provisioning_defaults_1pwr_lesotho",
  nutritionTargets: { kcal: 3000, proteinG: 80, fruitVegG: 400 },
  defaultBuffer: 0.05,
  breadCoverageDays: 7,
  flourPerLoafKg: 0.7,
  yeastProportion: 0.015,
  personDaysPerToiletRoll: 40,
  defaultCurrency: "LSL",
  reportingCurrency: "ZAR",
};

const MENU = {
  id: "provisioning_menu_1pwr_lesotho",
  name: "Default 7-day field camp cycle",
  cycleLength: 7,
  days: [
    { day: 1, breakfast: "Porridge + bread + tea", midday: "Rice + stewed beef + cabbage", evening: "Pap + beans + vegetables" },
    { day: 2, breakfast: "Porridge + bread + tea", midday: "Rice + chicken + carrots", evening: "Pap + fish + soup" },
    { day: 3, breakfast: "Bread + eggs + tea", midday: "Pap + beef + tomatoes", evening: "Rice + lentils + cabbage" },
    { day: 4, breakfast: "Porridge + bread + tea", midday: "Rice + chicken + vegetables", evening: "Pap + beans + carrots" },
    { day: 5, breakfast: "Bread + eggs + tea", midday: "Pap + beef + onions", evening: "Rice + fish + cabbage" },
    { day: 6, breakfast: "Porridge + bread + tea", midday: "Rice + chicken + tomatoes", evening: "Pap + lentils + vegetables" },
    { day: 7, breakfast: "Bread + eggs + tea", midday: "Pap + beef + carrots", evening: "Rice + beans + cabbage" },
  ],
};

// Indicative prices — REPLACE with real procurement data via the admin UI.
const PRICES: Array<{ id: string; rationId: string; tier: "large" | "medium" | "small" | null; packName: string; price: number }> = [
  { id: "price_maize_l", rationId: "ration_maize_meal", tier: "large", packName: "10 kg bag", price: 180 },
  { id: "price_maize_m", rationId: "ration_maize_meal", tier: "medium", packName: "5 kg bag", price: 95 },
  { id: "price_maize_s", rationId: "ration_maize_meal", tier: "small", packName: "2 kg bag", price: 40 },
  { id: "price_rice_l", rationId: "ration_rice", tier: "large", packName: "10 kg bag", price: 220 },
  { id: "price_rice_m", rationId: "ration_rice", tier: "medium", packName: "5 kg bag", price: 115 },
  { id: "price_rice_s", rationId: "ration_rice", tier: "small", packName: "1 kg bag", price: 25 },
  { id: "price_bread", rationId: "ration_bread_purchased", tier: null, packName: "loaf (700 g)", price: 12 },
  { id: "price_flour_l", rationId: "ration_flour_steamed", tier: "large", packName: "10 kg bag", price: 200 },
  { id: "price_flour_m", rationId: "ration_flour_steamed", tier: "medium", packName: "5 kg bag", price: 105 },
  { id: "price_flour_s", rationId: "ration_flour_steamed", tier: "small", packName: "1 kg bag", price: 22 },
  { id: "price_yeast", rationId: "ration_yeast", tier: null, packName: "10 g sachet", price: 5 },
  { id: "price_oil_l", rationId: "ration_cooking_oil", tier: "large", packName: "5 L bottle", price: 280 },
  { id: "price_oil_m", rationId: "ration_cooking_oil", tier: "medium", packName: "2 L bottle", price: 120 },
  { id: "price_oil_s", rationId: "ration_cooking_oil", tier: "small", packName: "1 L bottle", price: 65 },
  { id: "price_eggs", rationId: "ration_eggs", tier: "large", packName: "30-egg tray", price: 150 },
  { id: "price_milk", rationId: "ration_fresh_milk", tier: "large", packName: "6 × 1 L case", price: 180 },
  { id: "price_sugar_l", rationId: "ration_sugar", tier: "large", packName: "5 kg bag", price: 130 },
  { id: "price_salt", rationId: "ration_salt", tier: null, packName: "1 kg pack", price: 18 },
  { id: "price_tea", rationId: "ration_tea", tier: null, packName: "100-bag box (200 g)", price: 35 },
  { id: "price_soap", rationId: "ration_bar_soap", tier: null, packName: "bar", price: 12 },
  { id: "price_tp", rationId: "ration_toilet_paper", tier: null, packName: "9-roll pack", price: 90 },
  { id: "price_dish", rationId: "ration_dishwashing", tier: null, packName: "750 ml bottle", price: 45 },
];

async function run(dryRun: boolean): Promise<void> {
  const now = new Date().toISOString();
  console.log(`Seeding provisioning catalog for ${ORG_ID}${dryRun ? " (DRY-RUN)" : ""}...\n`);

  // Rations
  let rCreated = 0, rUpdated = 0, rUnchanged = 0;
  for (const r of RATIONS) {
    const ref = db.doc(`referenceData_rations/${r.id}`);
    const snap = await ref.get();
    const payload: Omit<RationItem, "id"> = {
      name: r.name,
      category: r.category,
      class: r.class,
      issueQtyPerPersonDay: r.issueQtyPerPersonDay,
      issueUnit: r.issueUnit,
      nutritionPerUnit: r.nutrition,
      specialFormula: r.specialFormula,
      packPlanning: r.pack,
      procurementNote: r.procurementNote,
      organizationId: ORG_ID,
      organization: { id: ORG_ID, name: ORG_NAME },
      active: true,
      updatedAt: now,
    };
    if (!snap.exists) {
      rCreated++;
      console.log(`  + ration ${r.id} (${r.name})`);
      if (!dryRun) await ref.set({ ...payload, id: r.id, createdAt: now });
    } else {
      const data = snap.data() as Partial<RationItem>;
      const changed = JSON.stringify(data.packPlanning) !== JSON.stringify(r.pack) || data.issueQtyPerPersonDay !== r.issueQtyPerPersonDay || data.nutritionPerUnit?.kcal !== r.nutrition.kcal;
      if (changed) { rUpdated++; console.log(`  ~ ration ${r.id} — update`); if (!dryRun) await ref.set(payload, { merge: true }); } else { rUnchanged++; }
    }
  }

  // Defaults
  const dRef = db.doc(`referenceData_provisioningDefaults/${DEFAULTS.id}`);
  const dSnap = await dRef.get();
  const dPayload = { ...DEFAULTS, name: "Default planning assumptions", organizationId: ORG_ID, organization: { id: ORG_ID, name: ORG_NAME }, active: true, updatedAt: now };
  if (!dSnap.exists) { console.log(`\n  + provisioningDefaults ${DEFAULTS.id}`); if (!dryRun) await dRef.set({ ...dPayload, createdAt: now }); }
  else { console.log(`\n  ~ provisioningDefaults ${DEFAULTS.id} — refresh`); if (!dryRun) await dRef.set(dPayload, { merge: true }); }

  // Menu
  const mRef = db.doc(`referenceData_provisioningMenus/${MENU.id}`);
  const mSnap = await mRef.get();
  const mPayload = { ...MENU, organizationId: ORG_ID, organization: { id: ORG_ID, name: ORG_NAME }, active: true, updatedAt: now };
  if (!mSnap.exists) { console.log(`  + provisioningMenu ${MENU.id}`); if (!dryRun) await mRef.set({ ...mPayload, createdAt: now }); }
  else { console.log(`  ~ provisioningMenu ${MENU.id} — refresh`); if (!dryRun) await mRef.set(mPayload, { merge: true }); }

  // Prices
  let pCreated = 0, pUpdated = 0;
  for (const p of PRICES) {
    const ref = db.doc(`referenceData_rationPrices/${p.id}`);
    const snap = await ref.get();
    const payload = {
      rationItemId: p.rationId,
      tier: p.tier,
      packName: p.packName,
      currency: CURRENCY,
      price: p.price,
      effectiveFrom: "2026-01-01",
      effectiveTo: null,
      source: "seed:indicative",
      note: "Indicative seed price — replace with real procurement data.",
      organizationId: ORG_ID,
      organization: { id: ORG_ID, name: ORG_NAME },
      active: true,
      updatedAt: now,
    };
    if (!snap.exists) { pCreated++; if (!dryRun) await ref.set({ ...payload, id: p.id, createdAt: now }); }
    else { pUpdated++; if (!dryRun) await ref.set(payload, { merge: true }); }
  }
  console.log(`\n  prices: ${pCreated} created, ${pUpdated} refreshed (indicative — replace via admin UI)`);

  console.log("\n=== Summary ===");
  console.log(`Rations: ${rCreated} created, ${rUpdated} updated, ${rUnchanged} unchanged`);
  console.log(`Defaults: 1  |  Menu: 1  |  Prices: ${PRICES.length}`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  await run(dryRun);
}

main().catch((err) => { console.error(err); process.exit(1); });
