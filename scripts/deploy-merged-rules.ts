/**
 * Deploy a merged Firestore ruleset to pr-system-4ea55 via the Firebase Rules
 * REST API, using the service account. Takes the currently-deployed Nexus
 * ruleset and appends a catch-all so PR system collections are readable again.
 *
 * TEMPORARY restore — the next Nexus rules deploy will overwrite this. The
 * permanent fix is a unified ruleset or project separation.
 *
 * Usage:
 *   NODE_OPTIONS="--require /tmp/_slowbuffer-polyfill.cjs" npx tsx scripts/deploy-merged-rules.ts
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
const NEXUS_RULES_PATH = "/tmp/nexus_rules.txt";

const CATCHALL = `
    // ── Catch-all: authenticated access to any other collection ──
    // TEMPORARY (2026-07-03): restores PR system collections (referenceData_*,
    // purchaseRequests, whatsNew, departments, provisioningPlans, archivePRs,
    // etc.) that the Nexus ruleset above does not list. To be replaced by a
    // unified ruleset maintained in one place.
    match /{document=**} {
      allow read, write: if isAuthenticated();
    }
`;

async function getToken(): Promise<string> {
  const cred = app.options.credential as any;
  const tok = await cred.getAccessToken();
  return tok.access_token;
}

function injectCatchAll(rules: string): string {
  // Remove trailing whitespace/newlines, then strip the final two closing braces
  // (service + databases match) and re-add them around the catch-all.
  const trimmed = rules.replace(/\s+$/, "");
  // The structure ends with:  \n  }\n}  (databases match close, service close)
  const m = trimmed.match(/(\n  }\n)\s*}\s*$/);
  if (!m) {
    throw new Error("Could not find closing braces to inject catch-all before.");
  }
  const databasesClose = m[1]; // "\n  }\n"
  const before = trimmed.slice(0, m.index);
  return `${before}${CATCHALL}${databasesClose}}\n`;
}

async function main() {
  const token = await getToken();
  const nexusRules = readFileSync(NEXUS_RULES_PATH, "utf8");
  const merged = injectCatchAll(nexusRules);
  console.log("=== merged rules tail ===");
  console.log(merged.split("\n").slice(-18).join("\n"));

  // 1. Create ruleset
  const createRes = await fetch(`https://firebaserules.googleapis.com/v1/projects/${PROJECT}/rulesets`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ source: { files: [{ name: "firestore.rules", content: merged }] } }),
  });
  const createJson = await createRes.json();
  if (!createRes.ok) {
    console.error("ruleset create failed:", createRes.status, JSON.stringify(createJson, null, 2));
    process.exit(1);
  }
  const rulesetName = (createJson as any).name as string;
  console.log("Created ruleset:", rulesetName);

  // 2. Update release
  const releaseRes = await fetch(`https://firebaserules.googleapis.com/v1/projects/${PROJECT}/releases/cloud.firestore`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: `projects/${PROJECT}/releases/cloud.firestore`, rulesetName }),
  });
  const releaseJson = await releaseRes.json();
  if (!releaseRes.ok) {
    console.error("release update failed:", releaseRes.status, JSON.stringify(releaseJson, null, 2));
    process.exit(1);
  }
  console.log("Released cloud.firestore ->", rulesetName);
  console.log(JSON.stringify(releaseJson, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
