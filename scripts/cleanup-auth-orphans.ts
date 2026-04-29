/**
 * Delete Firebase Auth accounts that have no matching Firestore users
 * doc, by category. Refuses to delete anything if a UID is referenced
 * from PRs, archive PRs, or notifications (re-checks at runtime).
 *
 * Categories (each opt-in):
 *   --no-email             accounts with no email at all (anonymous/legacy)
 *   --test-emails          *@example.com
 *   --never-signed-in      corporate/test accounts that have never signed in
 *                          (filtered to the curated list in NEVER_SIGNED_IN
 *                          to avoid surprises)
 *   --uids a,b,c           explicit list of UIDs (must already be orphans)
 *
 * Always pass --dry-run first.
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth, UserRecord } from "firebase-admin/auth";
import { readFileSync } from "fs";
import { join } from "path";

const serviceAccount = JSON.parse(
  readFileSync(join(__dirname, "../firebase-service-account.json"), "utf8")
);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();
const auth = getAuth();

// Explicit allow-list for --never-signed-in. We only delete accounts that
// were created at some point with intent (so they have an email and a
// displayName) but never authenticated. These were created Jan 17, 2025
// and Dec 19, 2025 by older import paths.
const NEVER_SIGNED_IN_ALLOWED_EMAILS = new Set<string>([
  "bohloko@1pwrafrica.com",
  "thabang.hatlane@1pwrafrica.com",
  "tumelo.tshabalala@1pwrafrica.com",
  "olivier@1pwrbenin.com",
  "makoanyane@1pwrafrica.com", // uid is the literal "legacy_makoanyane_1pwrafrica_com"
]);

const TEST_EMAIL_DOMAIN_RE = /@example\.com$/i;

const UID_FIELDS = [
  "submittedBy",
  "requestor",
  "requestorId",
  "createdBy",
  "approver",
  "approver2",
  "currentApprover",
  "approvedBy",
  "rejectedBy",
  "userId",
  "uid",
];
const COLLECTIONS_TO_SCAN = [
  "purchaseRequests",
  "archivePRs",
  "notifications",
  "notificationLogs",
];

interface Args {
  noEmail: boolean;
  testEmails: boolean;
  neverSignedIn: boolean;
  explicitUids: string[];
  dryRun: boolean;
  yes: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const explicit = (() => {
    const i = argv.indexOf("--uids");
    if (i < 0) return [];
    return (argv[i + 1] || "").split(",").map((s) => s.trim()).filter(Boolean);
  })();
  return {
    noEmail: argv.includes("--no-email"),
    testEmails: argv.includes("--test-emails"),
    neverSignedIn: argv.includes("--never-signed-in"),
    explicitUids: explicit,
    dryRun: argv.includes("--dry-run"),
    yes: argv.includes("--yes"),
  };
}

async function listAuthUsers(): Promise<UserRecord[]> {
  const out: UserRecord[] = [];
  let token: string | undefined;
  do {
    const r = await auth.listUsers(1000, token);
    out.push(...r.users);
    token = r.pageToken;
  } while (token);
  return out;
}

async function findReferenced(uids: Set<string>): Promise<Set<string>> {
  const ref = new Set<string>();
  for (const col of COLLECTIONS_TO_SCAN) {
    const snap = await db.collection(col).get();
    snap.forEach((doc) => {
      const data = doc.data();
      for (const f of UID_FIELDS) {
        const v = data[f];
        if (typeof v === "string" && uids.has(v)) ref.add(v);
      }
      const sh = data.statusHistory;
      if (Array.isArray(sh)) {
        for (const e of sh) {
          for (const f of ["userId", "actorId", "approverId"]) {
            const v = e?.[f];
            if (typeof v === "string" && uids.has(v)) ref.add(v);
          }
        }
      }
    });
  }
  return ref;
}

async function main() {
  const args = parseArgs();
  if (!args.noEmail && !args.testEmails && !args.neverSignedIn && args.explicitUids.length === 0) {
    console.error(
      "Specify at least one of: --no-email, --test-emails, --never-signed-in, --uids a,b,c"
    );
    process.exit(1);
  }

  console.log("Loading Firestore users...");
  const fsSnap = await db.collection("users").get();
  const fsUids = new Set(fsSnap.docs.map((d) => d.id));
  console.log(`  ${fsUids.size} Firestore user docs`);

  console.log("Loading Auth users...");
  const allAuth = await listAuthUsers();
  console.log(`  ${allAuth.length} Auth users`);

  const orphans = allAuth.filter((u) => !fsUids.has(u.uid));
  console.log(`  ${orphans.length} Auth orphans (no Firestore doc)`);

  const targets: UserRecord[] = [];
  const seen = new Set<string>();
  const add = (u: UserRecord) => {
    if (seen.has(u.uid)) return;
    seen.add(u.uid);
    targets.push(u);
  };

  if (args.noEmail) {
    for (const u of orphans) if (!u.email) add(u);
  }
  if (args.testEmails) {
    for (const u of orphans) if (u.email && TEST_EMAIL_DOMAIN_RE.test(u.email)) add(u);
  }
  if (args.neverSignedIn) {
    for (const u of orphans) {
      const email = (u.email || "").toLowerCase();
      const never = !u.metadata.lastSignInTime;
      if (never && NEVER_SIGNED_IN_ALLOWED_EMAILS.has(email)) add(u);
    }
  }
  if (args.explicitUids.length) {
    const orphanByUid = new Map(orphans.map((u) => [u.uid, u]));
    for (const uid of args.explicitUids) {
      const u = orphanByUid.get(uid);
      if (!u) {
        console.error(`Refusing: uid ${uid} is not an Auth orphan (or doesn't exist)`);
        process.exit(2);
      }
      add(u);
    }
  }

  console.log(`\nTargets matching selected categories: ${targets.length}`);
  if (targets.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  console.log("Checking that no targeted UID is referenced from live data...");
  const referenced = await findReferenced(new Set(targets.map((t) => t.uid)));
  if (referenced.size > 0) {
    console.error(`Aborting: ${referenced.size} targeted UIDs are referenced from live data:`);
    for (const u of referenced) console.error(`  ${u}`);
    process.exit(3);
  }
  console.log("  OK — none are referenced.");

  console.log("\nWill delete the following Auth accounts:");
  for (const u of targets) {
    console.log(
      `  ${u.uid.padEnd(36)}  email=${u.email || "<none>"}  lastSignIn=${u.metadata.lastSignInTime || "(never)"}  displayName=${u.displayName || ""}`
    );
  }

  if (args.dryRun) {
    console.log("\n[--dry-run] not deleting.");
    return;
  }
  if (!args.yes) {
    console.error("\nRefusing to delete without --yes (use after a successful --dry-run).");
    process.exit(4);
  }

  console.log("\nDeleting...");
  let ok = 0;
  let fail = 0;
  // deleteUsers supports up to 1000 per call.
  const chunks: string[][] = [];
  for (let i = 0; i < targets.length; i += 1000) {
    chunks.push(targets.slice(i, i + 1000).map((t) => t.uid));
  }
  for (const chunk of chunks) {
    const r = await auth.deleteUsers(chunk);
    ok += r.successCount;
    fail += r.failureCount;
    for (const e of r.errors) {
      console.error(`  failed uid=${chunk[e.index]}: ${e.error.message}`);
    }
  }
  console.log(`\nDeleted ${ok} Auth accounts; ${fail} failures.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
