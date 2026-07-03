/**
 * One-time seed for the Lesotho Field Camp provisioning catalog.
 *
 * Writes the pure data in `src/utils/provisioningSeedData.ts` (a faithful port of
 * `docs/260528 Lesotho_Field_Camp_Provisioning_v3.xlsx`) into PR's org-scoped
 * reference-data collections for 1PWR Lesotho (`1pwr_lesotho`, currency LSL):
 *
 *   - referenceData_rations               (37 issue items: every Shopping List row 5–41)
 *   - referenceData_provisioningDefaults  (Inputs & Dashboard!B5:B15 planning defaults)
 *   - referenceData_provisioningMenus     (the actual 7-Day Menu cycle)
 *   - referenceData_rationPrices          (the spreadsheet's actual pack prices, LSL)
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
import type { RationItem } from "../src/types/provisioning";
import {
  RATIONS, PROVISIONING_DEFAULTS as DEFAULTS, PROVISIONING_MENU as MENU, PROVISIONING_PRICES as PRICES,
  PROVISIONING_ORG_ID as ORG_ID, PROVISIONING_ORG_NAME as ORG_NAME, PROVISIONING_CURRENCY as CURRENCY,
} from "../src/utils/provisioningSeedData";

const SA_PATH = join(__dirname, "../firebase-service-account.json");
if (!existsSync(SA_PATH)) {
  console.error(`Missing ${SA_PATH}. Place the service account JSON at the repo root.`);
  process.exit(1);
}
const sa = JSON.parse(readFileSync(SA_PATH, "utf8"));
initializeApp({ credential: cert(sa) });
const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

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
      const changed = JSON.stringify(data.packPlanning) !== JSON.stringify(r.pack)
        || data.issueQtyPerPersonDay !== r.issueQtyPerPersonDay
        || JSON.stringify(data.nutritionPerUnit) !== JSON.stringify(r.nutrition)
        || data.name !== r.name;
      if (changed) {
        rUpdated++;
        console.log(`  ~ ration ${r.id} — update`);
        if (!dryRun) await ref.set(payload, { merge: true });
      } else {
        rUnchanged++;
      }
    }
  }

  // Defaults
  const DEFAULTS_ID = "provisioning_defaults_1pwr_lesotho";
  const dRef = db.doc(`referenceData_provisioningDefaults/${DEFAULTS_ID}`);
  const dSnap = await dRef.get();
  const dPayload = { ...DEFAULTS, id: DEFAULTS_ID, name: "Default planning assumptions", organizationId: ORG_ID, organization: { id: ORG_ID, name: ORG_NAME }, active: true, updatedAt: now };
  if (!dSnap.exists) { console.log(`\n  + provisioningDefaults ${dPayload.id}`); if (!dryRun) await dRef.set({ ...dPayload, createdAt: now }); }
  else { console.log(`\n  ~ provisioningDefaults ${dPayload.id} — refresh`); if (!dryRun) await dRef.set(dPayload, { merge: true }); }

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
      source: "seed:spreadsheet_v3",
      note: "Ported from 260528 Lesotho_Field_Camp_Provisioning_v3.xlsx.",
      organizationId: ORG_ID,
      organization: { id: ORG_ID, name: ORG_NAME },
      active: true,
      updatedAt: now,
    };
    if (!snap.exists) { pCreated++; if (!dryRun) await ref.set({ ...payload, id: p.id, createdAt: now }); }
    else { pUpdated++; if (!dryRun) await ref.set(payload, { merge: true }); }
  }
  console.log(`\n  prices: ${pCreated} created, ${pUpdated} refreshed`);

  console.log("\n=== Summary ===");
  console.log(`Rations: ${rCreated} created, ${rUpdated} updated, ${rUnchanged} unchanged (${RATIONS.length} total)`);

  // Retire orphaned rations for this org (from older seeds) that are no longer in the catalog.
  const validIds = new Set(RATIONS.map((r) => r.id));
  const allRationsSnap = await db.collection("referenceData_rations").where("organizationId", "==", ORG_ID).get();
  let retired = 0;
  for (const docSnap of allRationsSnap.docs) {
    if (validIds.has(docSnap.id)) continue;
    const data = docSnap.data() as { active?: boolean };
    if (data.active === false) continue;
    retired++;
    console.log(`  - retiring orphan ration ${docSnap.id}`);
    if (!dryRun) await docSnap.ref.set({ active: false, updatedAt: now }, { merge: true });
  }
  if (retired > 0) console.log(`  orphan rations retired: ${retired}`);

  console.log(`Defaults: 1  |  Menu: 1  |  Prices: ${PRICES.length}`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  await run(dryRun);
}

main().catch((err) => { console.error(err); process.exit(1); });
