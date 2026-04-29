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
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: tsx scripts/lookup-user-by-email.ts <email>");
    process.exit(1);
  }
  const target = email.trim().toLowerCase();
  const snap = await db.collection("users").get();
  const matches = snap.docs.filter(
    (d) => String(d.data().email || "").trim().toLowerCase() === target
  );
  if (matches.length === 0) {
    console.log(`No user doc matches email=${target}`);
    return;
  }
  for (const d of matches) {
    const u = d.data();
    console.log(`\n--- users/${d.id} ---`);
    console.log(JSON.stringify({
      id: d.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      role: u.role,
      permissionLevel: u.permissionLevel,
      isActive: u.isActive,
      organization: u.organization,
      additionalOrganizations: u.additionalOrganizations,
      department: u.department,
      isHrLead: u.isHrLead,
      hrLeadCountryCodes: u.hrLeadCountryCodes,
    }, null, 2));
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
