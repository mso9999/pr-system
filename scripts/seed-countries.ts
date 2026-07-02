/**
 * One-time seed for PR-canonical countries + organization countryCode backfill.
 *
 * PR is now the canonical source for countries and organizations (HR pulls
 * them from PR's /api/countries + /api/organizations). This script:
 *
 *   1. Upserts referenceData_countries docs (doc id = ISO-2 code) for the
 *      known 1PWR countries: LS, ZM, BJ.
 *   2. Backfills `countryCode` (ISO-2) on every referenceData_organizations
 *      doc using the org-id → ISO-2 map that HR previously kept in
 *      config/pr_org_map.php. If an org has no `country` (display name),
 *      it's filled from the countries collection.
 *
 * Idempotent. Run with --dry-run to preview.
 *
 * Node 26 + firebase-admin workaround:
 *   cp scripts/_slowbuffer-polyfill.cjs /tmp/_slowbuffer-polyfill.cjs
 *   NODE_OPTIONS="--require /tmp/_slowbuffer-polyfill.cjs" npm run seed-countries -- --dry-run
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const SA_PATH = join(__dirname, "../firebase-service-account.json");
if (!existsSync(SA_PATH)) {
  console.error(`Missing ${SA_PATH}. Place the service account JSON at the repo root.`);
  process.exit(1);
}

const sa = JSON.parse(readFileSync(SA_PATH, "utf8"));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

// The canonical country list to seed (ISO-2 → display name).
const COUNTRIES: Array<{ code: string; name: string }> = [
  { code: "LS", name: "Lesotho" },
  { code: "ZM", name: "Zambia" },
  { code: "BJ", name: "Benin" },
];

// Org-id → ISO-2 country code. This is the mapping HR previously kept in
// config/pr_org_map.php; PR now owns it canonically via this backfill +
// the org form's country selector.
const ORG_TO_COUNTRY: Record<string, string> = {
  "1pwr_lesotho": "LS",
  "1pwr_zambia": "ZM",
  "1pwr_benin": "BJ",
  "pueco_lesotho": "LS",
  "pueco_benin": "BJ",
  smp: "LS",
  neo1: "LS",
  mgb: "BJ", // Mionwa Gen — Benin
};

async function run(dryRun: boolean): Promise<void> {
  const now = new Date().toISOString();
  console.log(`Seeding countries + backfilling org countryCode${dryRun ? " (DRY-RUN)" : ""}...\n`);

  // 1. Upsert countries.
  const countryNameByCode = new Map(COUNTRIES.map((c) => [c.code, c.name]));
  let countriesCreated = 0;
  let countriesUpdated = 0;
  let countriesUnchanged = 0;

  for (const c of COUNTRIES) {
    const ref = db.doc(`referenceData_countries/${c.code}`);
    const snap = await ref.get();
    const patch = {
      code: c.code,
      name: c.name,
      active: true,
      updatedAt: now,
    };
    if (!snap.exists) {
      console.log(`  + country ${c.code} (${c.name}) — create`);
      countriesCreated++;
      if (!dryRun) await ref.set({ ...patch, id: c.code, createdAt: now });
    } else {
      const data = snap.data() as { name?: string; active?: boolean };
      if (data.name !== c.name || data.active === false) {
        console.log(`  ~ country ${c.code} (${c.name}) — update`);
        countriesUpdated++;
        if (!dryRun) await ref.set(patch, { merge: true });
      } else {
        countriesUnchanged++;
      }
    }
  }

  // 2. Backfill countryCode on organizations.
  const orgSnap = await db.collection("referenceData_organizations").get();
  let orgsBackfilled = 0;
  let orgsUnchanged = 0;
  const orgsUnmapped: string[] = [];

  for (const d of orgSnap.docs) {
    const data = d.data() as {
      name?: string;
      country?: string | null;
      countryCode?: string | null;
    };
    const expected = ORG_TO_COUNTRY[d.id];
    if (!expected) {
      orgsUnmapped.push(d.id);
      continue;
    }
    const current = data.countryCode || null;
    if (current === expected) {
      orgsUnchanged++;
      continue;
    }
    const countryName = countryNameByCode.get(expected) || data.country || expected;
    const patch: Record<string, unknown> = {
      countryCode: expected,
      country: data.country || countryName,
      updatedAt: now,
    };
    console.log(`  ~ org ${d.id} (${data.name || d.id}) — countryCode: ${current || "(none)"} → ${expected}`);
    orgsBackfilled++;
    if (!dryRun) await d.ref.set(patch, { merge: true });
  }

  console.log("\n=== Summary ===");
  console.log(`Countries: ${countriesCreated} created, ${countriesUpdated} updated, ${countriesUnchanged} unchanged`);
  console.log(`Organizations: ${orgsBackfilled} backfilled, ${orgsUnchanged} unchanged, ${orgsUnmapped.length} unmapped`);
  if (orgsUnmapped.length) {
    console.log("Unmapped org ids (no entry in ORG_TO_COUNTRY — add to the script if needed):");
    orgsUnmapped.forEach((id) => console.log(`  ? ${id}`));
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  await run(dryRun);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
