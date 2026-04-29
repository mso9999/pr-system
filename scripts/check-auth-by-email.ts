import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { readFileSync } from "fs";
import { join } from "path";

const serviceAccount = JSON.parse(
  readFileSync(join(__dirname, "../firebase-service-account.json"), "utf8")
);

initializeApp({ credential: cert(serviceAccount) });

async function main() {
  const email = (process.argv[2] || "").trim();
  if (!email) {
    console.error("Usage: tsx scripts/check-auth-by-email.ts <email>");
    process.exit(1);
  }
  try {
    const u = await getAuth().getUserByEmail(email);
    console.log(`Firebase Auth account FOUND for ${email}:`);
    console.log(JSON.stringify({
      uid: u.uid,
      email: u.email,
      emailVerified: u.emailVerified,
      displayName: u.displayName,
      disabled: u.disabled,
      providerIds: u.providerData.map(p => p.providerId),
      metadata: u.metadata,
    }, null, 2));
  } catch (e: any) {
    if (e?.code === "auth/user-not-found") {
      console.log(`Firebase Auth: NO account exists for ${email}`);
    } else {
      console.log("Lookup error:", e?.code || e?.message || e);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
