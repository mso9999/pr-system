/**
 * One-time starter seed for the 1PWR Benin (West Africa) Field Camp provisioning catalog.
 *
 * Writes `src/utils/provisioningSeedDataBenin.ts` into the org-scoped reference-data
 * collections for `1pwr_benin` (currency XOF, country BJ), and upserts the
 * `referenceData_organizations/1pwr_benin` doc so the Provisioning Studio has an org
 * to select. Idempotent; re-running updates in place using stable ids.
 *
 * Run with --dry-run to preview.
 *   NODE_OPTIONS="--require /tmp/_slowbuffer-polyfill.cjs" npm run seed-benin-rations -- --dry-run
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type { RationItem } from "../src/types/provisioning";
import {
  BENIN_RATIONS as RATIONS, BENIN_DEFAULTS as DEFAULTS, BENIN_MENU as MENU, BENIN_PRICES as PRICES,
  PROVISIONING_BENIN_ORG_ID as ORG_ID, PROVISIONING_BENIN_ORG_NAME as ORG_NAME,
  PROVISIONING_BENIN_CURRENCY as CURRENCY, PROVISIONING_BENIN_COUNTRY as COUNTRY,
} from "../src/utils/provisioningSeedDataBenin";

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
  console.log(`Seeding Benin provisioning catalog for ${ORG_ID}${dryRun ? " (DRY-RUN)" : ""}...\n`);

  // Organization doc (so the studio can select 1pwr_benin)
  const orgRef = db.doc(`referenceData_organizations/${ORG_ID}`);
  const orgSnap = await orgRef.get();
  const orgPayload = {
    id: ORG_ID,
    name: ORG_NAME,
    shortName: "BJ",
    currency: CURRENCY,
    country: COUNTRY,
    countryCode: COUNTRY,
    active: true,
    updatedAt: now,
  };
  if (!orgSnap.exists) {
    console.log(`  + organization ${ORG_ID} (currency ${CURRENCY}, country ${COUNTRY})`);
    if (!dryRun) await orgRef.set({ ...orgPayload, createdAt: now });
  } else {
    console.log(`  ~ organization ${ORG_ID} — refresh currency/country`);
    if (!dryRun) await orgRef.set(orgPayload, { merge: true });
  }

  // Rations
  let rCreated = 0, rUpdated = 0, rUnchanged = 0;
  for (const r of RATIONS) {
    const ref = db.doc(`referenceData_rations/${r.id}`);
    const snap = await ref.get();
    const payload: Omit<RationItem, "id"> = {
      name: r.name, category: r.category, class: r.class,
      issueQtyPerPersonDay: r.issueQtyPerPersonDay, issueUnit: r.issueUnit,
      nutritionPerUnit: r.nutrition, specialFormula: r.specialFormula,
      packPlanning: r.pack, procurementNote: r.procurementNote,
      organizationId: ORG_ID, organization: { id: ORG_ID, name: ORG_NAME },
      active: true, updatedAt: now,
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
      if (changed) { rUpdated++; console.log(`  ~ ration ${r.id} — update`); if (!dryRun) await ref.set(payload, { merge: true }); }
      else rUnchanged++;
    }
  }

  // Defaults
  const DEFAULTS_ID = `provisioning_defaults_${ORG_ID}`;
  const dRef = db.doc(`referenceData_provisioningDefaults/${DEFAULTS_ID}`);
  const dPayload = { ...DEFAULTS, id: DEFAULTS_ID, name: "Default planning assumptions (Benin)", organizationId: ORG_ID, organization: { id: ORG_ID, name: ORG_NAME }, active: true, updatedAt: now };
  if (!(await dRef.get()).exists) { console.log(`\n  + provisioningDefaults ${dPayload.id}`); if (!dryRun) await dRef.set({ ...dPayload, createdAt: now }); }
  else { console.log(`\n  ~ provisioningDefaults ${dPayload.id} — refresh`); if (!dryRun) await dRef.set(dPayload, { merge: true }); }

  // Menu
  const mRef = db.doc(`referenceData_provisioningMenus/${MENU.id}`);
  const mPayload = { ...MENU, organizationId: ORG_ID, organization: { id: ORG_ID, name: ORG_NAME }, active: true, updatedAt: now };
  if (!(await mRef.get()).exists) { console.log(`  + provisioningMenu ${MENU.id}`); if (!dryRun) await mRef.set({ ...mPayload, createdAt: now }); }
  else { console.log(`  ~ provisioningMenu ${MENU.id} — refresh`); if (!dryRun) await mRef.set(mPayload, { merge: true }); }

  // Prices
  let pCreated = 0, pUpdated = 0;
  for (const p of PRICES) {
    const ref = db.doc(`referenceData_rationPrices/${p.id}`);
    const payload = {
      rationItemId: p.rationId, tier: p.tier, packName: p.packName,
      currency: CURRENCY, price: p.price, effectiveFrom: "2026-01-01", effectiveTo: null,
      source: "seed:indicative_west_africa", note: "Indicative XOF starter price — refine via Provisioning Studio.",
      organizationId: ORG_ID, organization: { id: ORG_ID, name: ORG_NAME },
      active: true, updatedAt: now,
    };
    if (!(await ref.get()).exists) { pCreated++; if (!dryRun) await ref.set({ ...payload, id: p.id, createdAt: now }); }
    else { pUpdated++; if (!dryRun) await ref.set(payload, { merge: true }); }
  }
  console.log(`\n  prices: ${pCreated} created, ${pUpdated} refreshed`);

  // Retire orphaned rations for this org from prior seeds.
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

  console.log("\n=== Summary ===");
  console.log(`Rations: ${rCreated} created, ${rUpdated} updated, ${rUnchanged} unchanged (${RATIONS.length} total)`);
  console.log(`Defaults: 1  |  Menu: 1  |  Prices: ${PRICES.length}  |  Org: upserted`);
}

async function main(): Promise<void> {
  const dryRun = process.argv.slice(2).includes("--dry-run");
  await run(dryRun);
}

main().catch((err) => { console.error(err); process.exit(1); });
