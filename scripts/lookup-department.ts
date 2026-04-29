import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";
import { join } from "path";

const serviceAccount = JSON.parse(
  readFileSync(join(__dirname, "../firebase-service-account.json"), "utf8")
);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function main() {
  const orgId = (process.argv[2] || "").trim().toLowerCase();
  const nameQuery = (process.argv[3] || "").trim().toLowerCase();
  if (!orgId) {
    console.error("Usage: tsx scripts/lookup-department.ts <organizationId> [nameContains]");
    process.exit(1);
  }
  const snap = await db
    .collection("referenceData_departments")
    .where("organizationId", "==", orgId)
    .get();
  console.log(`Found ${snap.size} departments for org="${orgId}"`);
  for (const d of snap.docs) {
    const data = d.data();
    const name: string = data.name || "";
    if (!nameQuery || name.toLowerCase().includes(nameQuery)) {
      console.log(`  ${d.id}\t${name}\t(active=${data.isActive ?? data.active ?? "?"})`);
    }
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
