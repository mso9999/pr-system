/**
 * Inspect Firebase Auth orphans (Auth accounts without matching Firestore users doc).
 * Prints providers, last sign-in, creation date, displayName, email, disabled state.
 * Helps decide which orphans are real users to reconcile vs dead/test accounts to delete.
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

async function main() {
  const onlyWithEmail = process.argv.includes("--with-email");

  const fsSnap = await db.collection("users").get();
  const fsUids = new Set(fsSnap.docs.map((d) => d.id));

  const all: UserRecord[] = [];
  let pageToken: string | undefined;
  do {
    const r = await auth.listUsers(1000, pageToken);
    all.push(...r.users);
    pageToken = r.pageToken;
  } while (pageToken);

  const orphans = all.filter((u) => !fsUids.has(u.uid));
  const filtered = onlyWithEmail ? orphans.filter((u) => !!u.email) : orphans;

  console.log(`Total Auth users: ${all.length}`);
  console.log(`Total Firestore users: ${fsUids.size}`);
  console.log(`Auth orphans (no Firestore doc): ${orphans.length}`);
  console.log(`Showing ${filtered.length} orphan(s)${onlyWithEmail ? " with an email" : ""}\n`);

  filtered.sort((a, b) => (a.email || "zzz").localeCompare(b.email || "zzz"));

  for (const u of filtered) {
    const providers = u.providerData.map((p) => p.providerId).join(",") || "(none)";
    const last = u.metadata.lastSignInTime || "(never)";
    const created = u.metadata.creationTime;
    console.log(
      `- email=${u.email || "<none>"}  uid=${u.uid}  disabled=${u.disabled}  providers=${providers}  created=${created}  lastSignIn=${last}  displayName=${u.displayName || ""}`
    );
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
