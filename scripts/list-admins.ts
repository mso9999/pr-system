import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";
import { join } from "path";

const sa = JSON.parse(
  readFileSync(join(__dirname, "../firebase-service-account.json"), "utf8")
);
initializeApp({ credential: cert(sa) });
const db = getFirestore();

async function main() {
  for (const lvl of [1, 8]) {
    const s = await db.collection("users").where("permissionLevel", "==", lvl).get();
    console.log(`-- level=${lvl} (${s.size}) --`);
    s.forEach((d) => {
      const u = d.data();
      console.log(`  ${u.email || "<no email>"}  active=${u.isActive}  ${u.firstName || ""} ${u.lastName || ""}`);
    });
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
