/**
 * Reconcile Firestore profile for an existing Firebase Auth account.
 *
 * Use case: a Firebase Auth account exists for a user (e.g. legacy
 * import, or a previous createUser call where the Auth side succeeded
 * but the Firestore write failed) but there is no matching
 * `users/<uid>` document. This script writes the missing Firestore
 * profile under the existing Auth UID (so the user keeps their
 * password) using the values you pass on the CLI.
 *
 * Usage:
 *   tsx scripts/reconcile-firestore-user.ts \
 *     --email monoane@1pwrafrica.com \
 *     --first Sello --last Monoane \
 *     --org 1pwr_lesotho \
 *     --dept o_m \
 *     --level 5
 *
 * Optional flags:
 *   --inactive                          (default: active=true)
 *   --additional 1pwr_zambia,smp        (comma-separated additional orgs)
 *   --hr-lead                           (sets isHrLead=true)
 *   --hr-countries LS,ZM                (sets hrLeadCountryCodes)
 *   --dry-run                           (print payload, do not write)
 *   --overwrite                         (allow writing if doc exists)
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { readFileSync } from "fs";
import { join } from "path";

const serviceAccount = JSON.parse(
  readFileSync(join(__dirname, "../firebase-service-account.json"), "utf8")
);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();
const auth = getAuth();

interface Args {
  email: string;
  first: string;
  last: string;
  org: string;
  dept: string;
  level: number;
  active: boolean;
  additional: string[];
  isHrLead: boolean;
  hrCountries: string[];
  dryRun: boolean;
  overwrite: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (k: string): string | undefined => {
    const i = argv.indexOf(`--${k}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const has = (k: string) => argv.includes(`--${k}`);

  const required = (k: string) => {
    const v = get(k);
    if (!v) {
      console.error(`Missing required --${k}`);
      process.exit(1);
    }
    return v;
  };

  const additional = (get("additional") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const hrCountries = (get("hr-countries") || "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  return {
    email: required("email").trim().toLowerCase(),
    first: required("first").trim(),
    last: required("last").trim(),
    org: required("org").trim(),
    dept: required("dept").trim(),
    level: Number(required("level")),
    active: !has("inactive"),
    additional,
    isHrLead: has("hr-lead"),
    hrCountries,
    dryRun: has("dry-run"),
    overwrite: has("overwrite"),
  };
}

async function main() {
  const a = parseArgs();
  if (!Number.isFinite(a.level) || a.level <= 0) {
    console.error(`Invalid --level ${a.level}`);
    process.exit(1);
  }

  console.log(`Looking up Firebase Auth account for ${a.email}...`);
  let authUser;
  try {
    authUser = await auth.getUserByEmail(a.email);
  } catch (e: any) {
    if (e?.code === "auth/user-not-found") {
      console.error(`No Auth account exists for ${a.email}. Use the admin UI to create one fresh.`);
    } else {
      console.error(`Auth lookup failed:`, e);
    }
    process.exit(1);
  }
  const uid = authUser.uid;
  console.log(`  uid=${uid}  authEmail=${authUser.email}  displayName=${authUser.displayName || ""}`);

  const ref = db.collection("users").doc(uid);
  const existing = await ref.get();
  if (existing.exists && !a.overwrite) {
    console.error(`Firestore doc users/${uid} already exists. Pass --overwrite to replace.`);
    console.log(JSON.stringify(existing.data(), null, 2));
    process.exit(1);
  }

  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    id: uid,
    email: a.email,
    firstName: a.first,
    lastName: a.last,
    organization: a.org,
    additionalOrganizations: a.additional,
    department: a.dept,
    permissionLevel: a.level,
    isActive: a.active,
    multiDepartmentAppointmentsEnabled: false,
    isHrLead: a.isHrLead,
    hrLeadCountryCodes: a.isHrLead ? a.hrCountries : [],
    createdAt: existing.exists ? (existing.data()?.createdAt || now) : now,
    updatedAt: now,
  };

  console.log(`\nPayload for users/${uid}:`);
  console.log(JSON.stringify(payload, null, 2));

  if (a.dryRun) {
    console.log("\n[--dry-run] not writing.");
    return;
  }

  await ref.set(payload, { merge: false });
  console.log(`\nWrote users/${uid}.`);

  try {
    await auth.setCustomUserClaims(uid, { permissionLevel: a.level });
    console.log(`Set custom claim permissionLevel=${a.level} on Auth user.`);
  } catch (e) {
    console.warn(`Warning: could not set custom claims:`, e);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
