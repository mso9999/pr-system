/**
 * Look at provider data + tokensValidAfterTime + customClaims for the
 * NO-EMAIL Auth orphans, to figure out where they're coming from.
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { readFileSync } from "fs";
import { join } from "path";

const sa = JSON.parse(readFileSync(join(__dirname, "../firebase-service-account.json"), "utf8"));
initializeApp({ credential: cert(sa) });
const db = getFirestore();
const auth = getAuth();

async function main() {
  const fs = await db.collection("users").get();
  const fsUids = new Set(fs.docs.map((d) => d.id));

  const all: any[] = [];
  let tok: string | undefined;
  do {
    const r = await auth.listUsers(1000, tok);
    all.push(...r.users);
    tok = r.pageToken;
  } while (tok);

  const orphansNoEmail = all.filter((u) => !fsUids.has(u.uid) && !u.email);
  console.log(`NO-EMAIL Auth orphans: ${orphansNoEmail.length}`);

  // breakdown by provider list, displayName presence, customClaims
  const byProviders = new Map<string, number>();
  let withDisplayName = 0;
  let withCustomClaims = 0;
  let withPhone = 0;
  for (const u of orphansNoEmail) {
    const providers = (u.providerData || []).map((p: any) => p.providerId).sort().join(",") || "(none)";
    byProviders.set(providers, (byProviders.get(providers) || 0) + 1);
    if (u.displayName) withDisplayName++;
    if (u.customClaims && Object.keys(u.customClaims).length) withCustomClaims++;
    if (u.phoneNumber) withPhone++;
  }
  console.log("\nProvider breakdown:");
  for (const [k, n] of byProviders) console.log(`  ${k}: ${n}`);
  console.log(`\nWith displayName: ${withDisplayName}`);
  console.log(`With customClaims: ${withCustomClaims}`);
  console.log(`With phoneNumber: ${withPhone}`);

  // Sample 5 with full record
  console.log("\nSample (first 5 orphans):");
  for (const u of orphansNoEmail.slice(0, 5)) {
    console.log(JSON.stringify({
      uid: u.uid,
      providerData: u.providerData,
      customClaims: u.customClaims,
      phoneNumber: u.phoneNumber,
      displayName: u.displayName,
      photoURL: u.photoURL,
      tenantId: u.tenantId,
      tokensValidAfterTime: u.tokensValidAfterTime,
      metadata: u.metadata,
    }, null, 2));
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
