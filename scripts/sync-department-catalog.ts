/**
 * Local HR → PR department catalog sync runner.
 *
 * Mirrors the deployed runCatalogSync() but runs from your machine against
 * the same Firestore project, so you can review the proposed changes before
 * trusting the cloud function with the initial one-time sync.
 *
 * Prerequisites:
 *   - firebase-service-account.json at the repo root.
 *   - HR_API_KEY_PR_PORTAL and (optional) HR_API_BASE_URL in functions/.env.
 *
 * Usage:
 *   npm run sync-department-catalog            # full sync (writes Firestore + tombstones)
 *   npm run sync-department-catalog -- --dry-run
 *   npm run sync-department-catalog -- --incremental
 *
 * Node 26 + firebase-admin workaround: this script must be run with the
 * scripts/_slowbuffer-polyfill.cjs require hook, e.g.
 *   NODE_OPTIONS="--require /tmp/_slowbuffer-polyfill.cjs" npm run sync-department-catalog
 * See scripts/_slowbuffer-polyfill.cjs for the recipe.
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import * as dotenv from "dotenv";

const envPath = join(__dirname, "../functions/.env");
if (existsSync(envPath)) dotenv.config({ path: envPath });

const SA_PATH = join(__dirname, "../firebase-service-account.json");
if (!existsSync(SA_PATH)) {
  console.error(`Missing ${SA_PATH}. Place the service account JSON at the repo root.`);
  process.exit(1);
}

const sa = JSON.parse(readFileSync(SA_PATH, "utf8"));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const DEFAULT_BASE_URL = "https://hr.1pwrafrica.com";
const TIMEOUT_MS = 8000;
const CURSOR_DOC = "hrSyncState/departmentCursor";
const REPORT_COLLECTION = "hrDepartmentSyncReports";

interface HrDepartment {
  id: number;
  name: string;
  country: string | null;
  organization_id: string;
  active: boolean;
  source_system: "pr" | "hr" | "hr_renamed";
  source_doc_id: string | null;
  source_synced_at: string | null;
  aliases?: string[] | null;
  created_at: string | null;
  updated_at: string | null;
}

interface OrgInfo { id: string; name: string; }

function baseUrl(): string {
  return String(process.env.HR_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
}
function apiKey(): string {
  return String(process.env.HR_API_KEY_PR_PORTAL || "").trim();
}

async function getJson<T>(path: string): Promise<T> {
  const key = apiKey();
  if (!key) throw new Error("HR_API_KEY_PR_PORTAL is not set");
  const url = `${baseUrl()}${path}`;
  let lastStatus = 0;
  let lastBody = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const res = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json", "X-API-Key": key },
        signal: controller.signal,
      });
      clearTimeout(timer);
      lastStatus = res.status;
      lastBody = await res.text();
      if (res.ok) return JSON.parse(lastBody) as T;
      if (lastStatus === 401 || lastStatus === 403 || lastStatus === 404) break;
    } catch (err) {
      lastStatus = 0;
      lastBody = err instanceof Error ? err.message : String(err);
    }
    if (attempt < 2) await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
  }
  throw new Error(`HR API ${path} failed (HTTP ${lastStatus}): ${lastBody.slice(0, 200)}`);
}

function buildQuery(params: Record<string, string | undefined>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
    }
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

async function getDepartments(since?: string): Promise<{ count: number; departments: HrDepartment[] }> {
  const q = buildQuery({ since });
  return getJson(`/api/departments${q}`);
}

function slug(s: string): string {
  return String(s || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function isSafeDocId(s: string): boolean {
  return !!s && !/[\/]/.test(s) && s !== "." && s !== "..";
}

async function loadOrgMap(): Promise<Map<string, OrgInfo>> {
  const snap = await db.collection("referenceData_organizations").get();
  const m = new Map<string, OrgInfo>();
  snap.forEach((d) => {
    const data = d.data() as { name?: string };
    const id = String(d.id);
    m.set(id, { id, name: data.name || id });
    m.set(slug(id), { id, name: data.name || id });
  });
  return m;
}

interface Totals {
  pulled: number; created: number; updated: number; unchanged: number;
  tombstoned: number; prNativeUntouched: number; unmappedOrgs: number; errors: number;
}

async function run(full: boolean, dryRun: boolean): Promise<void> {
  let since: string | undefined;
  if (!full) {
    const cursorSnap = await db.doc(CURSOR_DOC).get();
    since = cursorSnap.data()?.lastUpdatedAt || undefined;
  }
  console.log(`[${full ? "FULL" : "INCREMENTAL"}]${since ? ` since=${since}` : ""}${dryRun ? " (DRY-RUN)" : ""}`);

  let dir: { count: number; departments: HrDepartment[] };
  try {
    dir = await getDepartments(since);
  } catch (err) {
    console.error("HR /api/departments pull failed:", err);
    process.exit(1);
  }
  console.log(`Pulled ${dir.departments.length} departments from HR.`);

  const orgMap = await loadOrgMap();
  const existingSnap = await db.collection("referenceData_departments").get();
  const byDocId = new Map<string, FirebaseFirestore.DocumentSnapshot>();
  const bySourceDocId = new Map<string, FirebaseFirestore.DocumentSnapshot>();
  for (const d of existingSnap.docs) {
    byDocId.set(d.id, d);
    const sd = d.get("sourceDocId");
    if (typeof sd === "string" && sd) bySourceDocId.set(sd, d);
  }

  const totals: Totals = {
    pulled: dir.departments.length, created: 0, updated: 0, unchanged: 0,
    tombstoned: 0, prNativeUntouched: 0, unmappedOrgs: 0, errors: 0,
  };
  const unmappedOrgs = new Set<string>();
  const created: string[] = [];
  const updated: string[] = [];
  const tombstoned: string[] = [];
  const prNativeUntouched: string[] = [];
  const seenDocIds = new Set<string>();
  const seenSourceDocIds = new Set<string>();
  const now = new Date().toISOString();
  const batch = dryRun ? null : db.batch();
  let batchOps = 0;

  for (const hr of dir.departments) {
    try {
      const rawOrg = String(hr.organization_id || "").trim();
      const org = orgMap.get(rawOrg) || orgMap.get(slug(rawOrg)) || { id: rawOrg, name: rawOrg };
      if (rawOrg && !orgMap.has(rawOrg) && !orgMap.has(slug(rawOrg))) unmappedOrgs.add(rawOrg);

      const sourceDocId = hr.source_doc_id || null;
      let existing: FirebaseFirestore.DocumentSnapshot | null = null;
      let targetDocId: string | null = null;

      if (sourceDocId) {
        const bySrc = bySourceDocId.get(sourceDocId);
        if (bySrc) { existing = bySrc; targetDocId = bySrc.id; }
        else if (hr.source_system === "pr" && byDocId.has(sourceDocId)) {
          existing = byDocId.get(sourceDocId) || null;
          targetDocId = sourceDocId;
        } else if (isSafeDocId(sourceDocId)) {
          const byId = byDocId.get(sourceDocId);
          if (byId) { existing = byId; targetDocId = sourceDocId; }
          else targetDocId = sourceDocId;
        }
      }
      if (!targetDocId) targetDocId = db.collection("referenceData_departments").doc().id;

      const existingCode = existing?.get("code") as string | undefined;
      const code = existingCode || slug(hr.source_doc_id || "") || slug(hr.name);
      const patch: Record<string, unknown> = {
        name: hr.name,
        code,
        organizationId: org.id,
        organization: { id: org.id, name: org.name },
        country: hr.country || null,
        active: hr.active === true,
        sourceSystem: hr.source_system,
        sourceDocId: sourceDocId,
        hrId: hr.id,
        hrCatalogSyncedAt: now,
        updatedAt: now,
      };
      if (Array.isArray(hr.aliases)) {
        patch.aliases = hr.aliases.filter((a) => typeof a === "string" && a.trim());
      }

      if (existing) {
        const ed = existing.data() || {};
        const same =
          ed.name === patch.name &&
          ed.organizationId === patch.organizationId &&
          ed.country === patch.country &&
          ed.active === patch.active &&
          ed.sourceSystem === patch.sourceSystem &&
          ed.sourceDocId === patch.sourceDocId &&
          String(ed.hrId || "") === String(patch.hrId || "");
        if (same) totals.unchanged++;
        else {
          if (!dryRun && batch) { batch.set(db.doc(`referenceData_departments/${targetDocId}`), patch, { merge: true }); batchOps++; }
          updated.push(`${targetDocId} (${hr.name})`);
          totals.updated++;
        }
      } else {
        const createPatch: Record<string, unknown> = { ...patch, id: targetDocId, active: hr.active === true, createdAt: now };
        if (!dryRun && batch) { batch.set(db.doc(`referenceData_departments/${targetDocId}`), createPatch, { merge: true }); batchOps++; }
        created.push(`${targetDocId} (${hr.name})`);
        totals.created++;
      }

      seenDocIds.add(targetDocId);
      if (sourceDocId) seenSourceDocIds.add(sourceDocId);

      if (batchOps >= 400) {
        if (!dryRun && batch) { await batch.commit(); }
        batchOps = 0;
      }
    } catch (err) {
      console.error(`Failed processing ${hr.name}:`, err);
      totals.errors++;
    }
  }

  // Tombstoning (full only)
  if (full) {
    for (const d of existingSnap.docs) {
      const data = d.data() || {};
      const sd = data.sourceDocId;
      const hasProvenance = typeof sd === "string" && sd;
      if (!hasProvenance) {
        prNativeUntouched.push(`${d.id} (${data.name || ""})`);
        totals.prNativeUntouched++;
        continue;
      }
      if (seenSourceDocIds.has(sd) || seenDocIds.has(d.id)) continue;
      if (data.active === false) continue;
      if (!dryRun && batch) {
        batch.set(d.ref, { active: false, hrCatalogSyncedAt: now, updatedAt: now }, { merge: true });
        batchOps++;
      }
      tombstoned.push(`${d.id} (${data.name || ""})`);
      totals.tombstoned++;
      if (batchOps >= 400) {
        if (!dryRun && batch) await batch.commit();
        batchOps = 0;
      }
    }
  }

  if (!dryRun && batch && batchOps > 0) {
    await batch.commit();
  }

  // Cursor + report
  if (!dryRun) {
    let maxUpdatedAt: string | null = null;
    for (const d of dir.departments) {
      if (d.updated_at && (!maxUpdatedAt || d.updated_at > maxUpdatedAt)) maxUpdatedAt = d.updated_at;
    }
    const cursorPatch: Record<string, unknown> = { updatedAt: now };
    if (maxUpdatedAt) cursorPatch.lastUpdatedAt = maxUpdatedAt;
    if (full) cursorPatch.lastFullSyncAt = now;
    else cursorPatch.lastIncrementalSyncAt = now;
    await db.doc(CURSOR_DOC).set(cursorPatch, { merge: true });

    const docId = new Date().toISOString().replace(/[:.]/g, "-");
    await db.collection(REPORT_COLLECTION).doc(docId).set({
      timestamp: new Date().toISOString(),
      generatedAtMs: Date.now(),
      mode: full ? "full" : "incremental",
      since: since || null,
      totals,
      created: created.map((s) => ({ docId: s.split(" ")[0], name: s.match(/\((.*)\)/)?.[1] || "" })),
      updated: updated.map((s) => ({ docId: s.split(" ")[0], name: s.match(/\((.*)\)/)?.[1] || "" })),
      tombstoned: tombstoned.map((s) => ({ docId: s.split(" ")[0], name: s.match(/\((.*)\)/)?.[1] || "" })),
      prNativeUntouched: prNativeUntouched.map((s) => ({ docId: s.split(" ")[0], name: s.match(/\((.*)\)/)?.[1] || "" })),
      unmappedOrgs: [...unmappedOrgs].sort(),
      errors: [],
    });
  }

  totals.unmappedOrgs = unmappedOrgs.size;
  console.log("\n=== Totals ===");
  console.log(JSON.stringify(totals, null, 2));
  if (unmappedOrgs.size) { console.log("Unmapped orgs:", [...unmappedOrgs].sort()); }
  if (created.length) { console.log(`\nCreated (${created.length}):`); created.slice(0, 50).forEach((s) => console.log("  + " + s)); }
  if (updated.length) { console.log(`\nUpdated (${updated.length}):`); updated.slice(0, 50).forEach((s) => console.log("  ~ " + s)); }
  if (tombstoned.length) { console.log(`\nTombstoned (${tombstoned.length}):`); tombstoned.slice(0, 50).forEach((s) => console.log("  ✝ " + s)); }
  if (prNativeUntouched.length) {
    console.log(`\nPR-native untouched (${prNativeUntouched.length}) — review manually:`);
    prNativeUntouched.slice(0, 50).forEach((s) => console.log("  ? " + s));
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const incremental = args.includes("--incremental");
  await run(!incremental, dryRun);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
