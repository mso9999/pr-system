/**
 * One-time seed for the "What's New" login primer.
 *
 * Adds the initial item announcing the in-app Field Camp Provisioning feature.
 * Idempotent: uses a stable doc id (`whats_new_provisioning_launch`) so re-runs
 * update the same doc in place.
 *
 * Usage:
 *   cp scripts/_slowbuffer-polyfill.cjs /tmp/_slowbuffer-polyfill.cjs   # if Node 26 issues
 *   npx tsx scripts/seed-whats-new.ts
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
db.settings({ ignoreUndefinedProperties: true });

const DOC_ID = "whats_new_provisioning_launch";
const now = new Date().toISOString();

const item = {
  title: "In-app Field Camp Provisioning",
  body:
    "The Lesotho field-camp provisioning spreadsheet is now built into the PR system. " +
    "Pick an organization, link a Fleet Hub mission to prepopulate crew size and trip days, " +
    "override them if you're only provisioning part of the trip, then generate a shopping list " +
    "and turn it straight into a Purchase Request. Plans are saved with a sequential plan number " +
    "and priced in the org's base currency using its ration catalog and price book.",
  date: now.slice(0, 10),
  active: true,
  audienceRoles: [], // everyone
  linkLabel: "Open Field Camp Provisioning",
  linkRoute: "/provisioning",
  createdAt: now,
  updatedAt: now,
};

async function main() {
  await db.collection("whatsNew").doc(DOC_ID).set(item, { merge: true });
  console.log(`Seeded whatsNew/${DOC_ID} (date=${item.date}).`);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
