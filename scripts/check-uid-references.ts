/**
 * Given a set of candidate-for-deletion UIDs, check whether any are
 * referenced from live data (PRs, archive PRs, approvers, notifications).
 *
 * Refuses to recommend deletion of any UID that is found.
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const serviceAccount = JSON.parse(
  readFileSync(join(__dirname, "../firebase-service-account.json"), "utf8")
);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();
const auth = getAuth();

// fields on PR-shaped docs that may carry a uid
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

async function buildOrphanSet(): Promise<Set<string>> {
  const fsSnap = await db.collection("users").get();
  const fsUids = new Set(fsSnap.docs.map((d) => d.id));
  const orphans = new Set<string>();
  let pageToken: string | undefined;
  do {
    const r = await auth.listUsers(1000, pageToken);
    for (const u of r.users) {
      if (!fsUids.has(u.uid)) orphans.add(u.uid);
    }
    pageToken = r.pageToken;
  } while (pageToken);
  return orphans;
}

async function scan(orphans: Set<string>) {
  const referenced = new Map<string, { collection: string; docId: string; field: string }[]>();
  for (const col of COLLECTIONS_TO_SCAN) {
    console.log(`Scanning ${col} ...`);
    const snap = await db.collection(col).get();
    let n = 0;
    snap.forEach((doc) => {
      const data = doc.data();
      for (const f of UID_FIELDS) {
        const v = data[f];
        if (typeof v === "string" && orphans.has(v)) {
          if (!referenced.has(v)) referenced.set(v, []);
          referenced.get(v)!.push({ collection: col, docId: doc.id, field: f });
          n++;
        }
      }
      // statusHistory entries can carry uid as `userId` or `actorId`
      const sh = data.statusHistory;
      if (Array.isArray(sh)) {
        for (const e of sh) {
          for (const f of ["userId", "actorId", "approverId"]) {
            const v = e?.[f];
            if (typeof v === "string" && orphans.has(v)) {
              if (!referenced.has(v)) referenced.set(v, []);
              referenced.get(v)!.push({ collection: col, docId: doc.id, field: `statusHistory.${f}` });
              n++;
            }
          }
        }
      }
    });
    console.log(`  ${col}: scanned ${snap.size} docs, ${n} orphan refs`);
  }
  return referenced;
}

async function main() {
  const orphans = await buildOrphanSet();
  console.log(`Auth orphans: ${orphans.size}\n`);
  const refs = await scan(orphans);
  console.log(`\nOrphan UIDs referenced in scanned collections: ${refs.size}`);
  for (const [uid, hits] of refs) {
    console.log(`  ${uid}  (${hits.length} refs) — sample: ${hits[0].collection}/${hits[0].docId}.${hits[0].field}`);
  }

  const safeToDelete = [...orphans].filter((u) => !refs.has(u));
  const blocked = [...orphans].filter((u) => refs.has(u));
  const out = {
    timestamp: new Date().toISOString(),
    totalOrphans: orphans.size,
    referencedCount: refs.size,
    safeToDeleteCount: safeToDelete.length,
    safeToDelete,
    blocked,
    references: Object.fromEntries([...refs.entries()].map(([k, v]) => [k, v])),
  };
  const outPath = join(process.cwd(), "scripts", "uid-reference-report.json");
  writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`\nWrote ${outPath}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
