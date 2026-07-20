/**
 * Fetch the currently-deployed Firestore security rules from a Firebase project
 * via the Firebase Rules REST API, using a service account.
 *
 * Usage:
 *   NODE_OPTIONS="--require /tmp/_slowbuffer-polyfill.cjs" npx tsx scripts/fetch-deployed-rules.ts
 */
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const SA_PATH = join(__dirname, "../firebase-service-account.json");
if (!existsSync(SA_PATH)) {
  console.error(`Missing ${SA_PATH}.`);
  process.exit(1);
}
const sa = JSON.parse(readFileSync(SA_PATH, "utf8"));
const app = getApps().length ? initializeApp() : initializeApp({ credential: cert(sa), projectId: "pr-system-4ea55" });

const PROJECT = "pr-system-4ea55";

async function getToken(): Promise<string> {
  const cred = app.options.credential as any;
  const tok = await cred.getAccessToken();
  return tok.access_token;
}

async function main() {
  const token = await getToken();
  // 1. Get the release for cloud.firestore
  const releaseRes = await fetch(
    `https://firebaserules.googleapis.com/v1/projects/${PROJECT}/releases/cloud.firestore`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  console.log("=== release cloud.firestore HTTP", releaseRes.status, "===");
  const releaseJson = await releaseRes.json();
  console.log(JSON.stringify(releaseJson, null, 2));
  const rulesetName = (releaseJson as any)?.rulesetName as string | undefined;
  if (!rulesetName) {
    console.error("No rulesetName in release.");
    return;
  }
  // 2. Get the ruleset source
  const rsId = rulesetName.split("/").pop();
  const rsRes = await fetch(
    `https://firebaserules.googleapis.com/v1/projects/${PROJECT}/rulesets/${rsId}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  console.log("=== ruleset", rsId, "HTTP", rsRes.status, "===");
  const rsJson = await rsRes.json();
  const source = (rsJson as any)?.source;
  if (source?.files) {
    for (const f of source.files) {
      console.log(`--- ${f.name} ---`);
      console.log(f.content);
    }
  } else {
    console.log(JSON.stringify(rsJson, null, 2));
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
