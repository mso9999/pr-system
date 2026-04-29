/**
 * Local equivalent of the deployed runAudit() function — useful for
 * baseline checks and operator runs. Uses the same anonymous-Auth
 * filter as the cloud function.
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth, UserRecord } from "firebase-admin/auth";
import { readFileSync } from "fs";
import { join } from "path";

const sa = JSON.parse(readFileSync(join(__dirname, "../firebase-service-account.json"), "utf8"));
initializeApp({ credential: cert(sa) });
const db = getFirestore();
const auth = getAuth();

const isAnonymous = (u: UserRecord) =>
  !u.email && (!u.providerData || u.providerData.length === 0);

async function main() {
  const fs = await db.collection("users").get();
  const fsUids = new Set(fs.docs.map((d) => d.id));

  const all: UserRecord[] = [];
  let token: string | undefined;
  do {
    const r = await auth.listUsers(1000, token);
    all.push(...r.users);
    token = r.pageToken;
  } while (token);

  let anonymous = 0, authOrphans = 0, synced = 0;
  const orphans: UserRecord[] = [];
  for (const u of all) {
    if (isAnonymous(u)) { anonymous++; continue; }
    if (!fsUids.has(u.uid)) { authOrphans++; orphans.push(u); }
    else synced++;
  }

  const fsOrphans: { uid: string; email: string }[] = [];
  const authByUid = new Map(all.map((u) => [u.uid, u]));
  fs.forEach((d) => {
    if (!authByUid.has(d.id)) fsOrphans.push({ uid: d.id, email: d.data().email || "" });
  });

  console.log("=== User-sync audit baseline ===");
  console.log(`Auth users (total):                 ${all.length}`);
  console.log(`Anonymous Auth (ignored — 1PWR AM): ${anonymous}`);
  console.log(`Firestore users:                    ${fsUids.size}`);
  console.log(`Properly synced:                    ${synced}`);
  console.log(`Auth orphans (no Firestore):        ${authOrphans}`);
  console.log(`Firestore orphans (no Auth):        ${fsOrphans.length}`);

  if (orphans.length) {
    console.log("\nAuth orphans:");
    for (const u of orphans) {
      console.log(`  ${u.email || "<no email>"}  uid=${u.uid}  lastSignIn=${u.metadata.lastSignInTime || "(never)"}`);
    }
  }
  if (fsOrphans.length) {
    console.log("\nFirestore orphans:");
    for (const o of fsOrphans) console.log(`  ${o.email}  uid=${o.uid}`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
