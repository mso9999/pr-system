#!/usr/bin/env npx tsx
/**
 * Remap purchaseRequests.vehicle from legacy Firestore doc ids to FM vehicle UUIDs.
 *
 * Builds a mapping from referenceData_vehicles:
 *   - doc id → fmVehicleId (when fmVehicleId differs)
 *   - legacy doc id → fmVehicleId via supersededBy / fmVehicleId fields
 *   - org + code/name fallback
 *
 * Usage:
 *   npx tsx scripts/migrate-pr-vehicle-refs.ts           # dry run
 *   npx tsx scripts/migrate-pr-vehicle-refs.ts --apply   # write updates
 */

import { initializeApp, cert, type ServiceAccount } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const APPLY = process.argv.includes("--apply");
const SERVICE_ACCOUNT_PATH = join(__dirname, "../firebase-service-account.json");

function normOrg(org: string): string {
  return (org || "").toLowerCase().replace(/\s+/g, "_");
}

function normCode(code: string): string {
  return (code || "").trim().toLowerCase();
}

async function main(): Promise<void> {
  if (!existsSync(SERVICE_ACCOUNT_PATH)) {
    console.error(`Service account not found: ${SERVICE_ACCOUNT_PATH}`);
    process.exit(1);
  }

  const serviceAccount = JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, "utf8")) as ServiceAccount;
  const app = initializeApp({ credential: cert(serviceAccount) });
  const firestore = getFirestore(app);

  console.log(`=== Migrate PR.vehicle references (${APPLY ? "APPLY" : "DRY RUN"}) ===\n`);

  const vehicleSnap = await firestore.collection("referenceData_vehicles").get();
  const idMap = new Map<string, string>();

  for (const doc of vehicleSnap.docs) {
    const d = doc.data();
    const fmId = String(d.fmVehicleId || "").trim();
    const canonical = fmId || doc.id;

    idMap.set(doc.id, canonical);
    if (fmId) {
      idMap.set(fmId, canonical);
    }

    const org = normOrg(String(d.organizationId || ""));
    const code = normCode(String(d.fleetCode || d.code || d.name || ""));
    if (org && code) {
      idMap.set(`${org}::${code}`, canonical);
    }
  }

  const prSnap = await firestore.collection("purchaseRequests").get();
  let candidates = 0;
  let updated = 0;
  let unchanged = 0;
  let unmapped = 0;

  for (const doc of prSnap.docs) {
    const data = doc.data();
    const current = String(data.vehicle || "").trim();
    if (!current) continue;

    const mapped = idMap.get(current);
    if (!mapped) {
      unmapped++;
      console.log(`  UNMAPPED PR ${data.prNumber || doc.id}: vehicle=${current}`);
      continue;
    }

    if (mapped === current) {
      unchanged++;
      continue;
    }

    candidates++;
    console.log(`  ${data.prNumber || doc.id}: ${current} → ${mapped}`);

    if (APPLY) {
      await doc.ref.update({
        vehicle: mapped,
        vehicleMigratedAt: new Date().toISOString(),
        vehicleMigrationPrevious: current,
      });
      updated++;
    }
  }

  console.log(`\nPRs with vehicle field: ${candidates + unchanged + unmapped} scanned`);
  console.log(`Would update / updated: ${APPLY ? updated : candidates}`);
  console.log(`Already canonical:      ${unchanged}`);
  console.log(`Unmapped:               ${unmapped}`);

  if (!APPLY && candidates > 0) {
    console.log("\nRe-run with --apply to write changes.");
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
