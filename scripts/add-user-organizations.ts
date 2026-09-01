/**
 * Add organization coverage to an existing PR user (additionalOrganizations).
 *
 * Use case: a user who should work across multiple organizations (e.g. after
 * the 2026-08-28 Zambia split, a ZM procurement officer needs both
 * `1pwr_zambia` and `kuwala`, the same way LS procurement carries
 * `1pwr_lesotho` + `smp`). Org fields are HR-owned, but the HR sync only
 * overwrites them when HR returns non-empty values, so this write persists
 * until HR manages the field. Durable fix remains the HR employee record.
 *
 * Usage:
 *   tsx scripts/add-user-organizations.ts --email eduardo@1pwrafrica.com --add kuwala,1pwr_zambia
 *
 * Flags:
 *   --dry-run    print the before/after payload without writing
 *
 * Requires firebase-service-account.json at the repo root.
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";
import { join } from "path";

const serviceAccount = JSON.parse(
  readFileSync(join(__dirname, "../firebase-service-account.json"), "utf8")
);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// Mirrors src/utils/organization.ts normalizeOrganizationId core behavior
// (lowercase, non-alnum -> _). Keep ids canonical: 1pwr_zambia, kuwala, smp...
function normalizeOrgId(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "_");
}

function parseArgs(): { email: string; add: string[]; dryRun: boolean } {
  const argv = process.argv.slice(2);
  const get = (k: string): string | undefined => {
    const i = argv.indexOf(`--${k}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const email = (get("email") || "").trim().toLowerCase();
  const add = (get("add") || "")
    .split(",")
    .map((s) => normalizeOrgId(s))
    .filter(Boolean);
  if (!email) {
    console.error("Missing required --email");
    process.exit(1);
  }
  if (add.length === 0) {
    console.error("Missing required --add org1,org2");
    process.exit(1);
  }
  return { email, add, dryRun: argv.includes("--dry-run") };
}

async function main() {
  const { email, add, dryRun } = parseArgs();

  const snap = await db.collection("users").get();
  const matches = snap.docs.filter(
    (d) => String(d.data().email || "").trim().toLowerCase() === email
  );
  if (matches.length === 0) {
    console.error(`No user doc matches email=${email}`);
    process.exit(1);
  }

  for (const d of matches) {
    const u = d.data();
    const primary = normalizeOrgId(String(u.organization || ""));
    const currentAdditional: string[] = Array.isArray(u.additionalOrganizations)
      ? u.additionalOrganizations.map((x: unknown) => String(x))
      : [];
    const currentNormalized = currentAdditional.map(normalizeOrgId);

    console.log(`\n--- users/${d.id} ---`);
    console.log("Before:", JSON.stringify({
      email: u.email,
      name: `${u.firstName || ""} ${u.lastName || ""}`.trim(),
      organization: u.organization,
      additionalOrganizations: currentAdditional,
      secondments: u.secondments || [],
    }, null, 2));

    // Display values: keep canonical ids already present; append new ones.
    const next = [...currentAdditional];
    for (const org of add) {
      if (org === primary) {
        console.log(`  '${org}' is already the primary organization — no change needed.`);
        continue;
      }
      if (currentNormalized.includes(org)) {
        console.log(`  '${org}' already in additionalOrganizations — no change needed.`);
        continue;
      }
      next.push(org);
      console.log(`  + adding '${org}' to additionalOrganizations`);
    }

    if (next.length === currentAdditional.length) {
      console.log("Nothing to change for this user.");
      continue;
    }

    console.log("After:", JSON.stringify({
      organization: u.organization,
      additionalOrganizations: next,
    }, null, 2));

    if (dryRun) {
      console.log("[--dry-run] not writing.");
      continue;
    }

    await db.collection("users").doc(d.id).update({
      additionalOrganizations: next,
      updatedAt: new Date().toISOString(),
    });
    console.log(`Updated users/${d.id}.`);
    console.log("NOTE: org assignment is HR-owned. Also set these orgs on the HR employee record so a future HR sync does not overwrite this.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
