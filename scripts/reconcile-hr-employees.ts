/**
 * Local one-time HR → PR reconciliation runner.
 *
 * Mirrors the deployed runReconciliation() but runs from your machine
 * against the same Firestore project, so you can review the report and
 * the proposed changes before trusting the cloud function with the
 * initial reconciliation.
 *
 * Prerequisites:
 *   - firebase-service-account.json at the repo root (same file the
 *     other local scripts use).
 *   - HR_API_KEY_PR_PORTAL and (optional) HR_API_BASE_URL in your env,
 *     OR a functions/.env file in this repo (this script loads it).
 *
 * Usage:
 *   npx ts-node scripts/reconcile-hr-employees.ts            # full reconcile (writes Firestore)
 *   npx ts-node scripts/reconcile-hr-employees.ts --dry-run  # pull + report, no writes
 *   npx ts-node scripts/reconcile-hr-employees.ts --incremental
 *   npx ts-node scripts/reconcile-hr-employees.ts --refresh 1PWR0159F
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import * as crypto from "crypto";
import * as dotenv from "dotenv";

// Load functions/.env so HR_API_KEY_PR_PORTAL / HR_API_BASE_URL are visible.
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
const auth = getAuth();

const DEFAULT_BASE_URL = "https://hr.1pwrafrica.com";

interface HrEmployee {
  employee_id: string | null;
  name: string;
  email: string;
  role: string;
  type: string;
  country: string | null;
  department: string | null;
  primary_deployment: string | null;
  status: string;
  employment_start_date: string | null;
  current_position_title: string | null;
  phone: string | null;
  headshot: string | null;
  last_updated_at: string | null;
}

async function hrGet<T>(path: string): Promise<T> {
  const key = process.env.HR_API_KEY_PR_PORTAL;
  if (!key) throw new Error("HR_API_KEY_PR_PORTAL is not set");
  const base = String(process.env.HR_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
  const url = `${base}${path}`;
  const res = await (globalThis as any).fetch(url, {
    headers: { Accept: "application/json", "X-API-Key": key },
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`HR ${path} HTTP ${res.status}: ${body.slice(0, 200)}`);
  return JSON.parse(body) as T;
}

async function getDirectory(since?: string): Promise<{ count: number; employees: HrEmployee[] }> {
  const q = since ? `?since=${encodeURIComponent(since)}` : "";
  return hrGet<{ count: number; employees: HrEmployee[] }>(`/api/employees/directory${q}`);
}

function splitName(name: string) {
  const t = (name || "").trim();
  const i = t.indexOf(" ");
  if (i === -1) return { firstName: t, lastName: "" };
  return { firstName: t.slice(0, i), lastName: t.slice(i + 1).trim() };
}

async function buildDeptResolver(): Promise<{ resolve: (n: string | null | undefined) => string | null }> {
  const snap = await db.collection("referenceData_departments").get();
  const byName = new Map<string, string>();
  for (const d of snap.docs) {
    const data = d.data() as { name?: string };
    if (data.name) byName.set(data.name.trim().toLowerCase().replace(/\s+/g, " "), d.id);
  }
  return {
    resolve: (n) => {
      if (!n || !String(n).trim()) return null;
      return byName.get(String(n).trim().toLowerCase().replace(/\s+/g, " ")) || null;
    },
  };
}

async function loadPrByEmail(): Promise<Map<string, { uid: string; data: any }>> {
  const snap = await db.collection("users").get();
  const m = new Map<string, { uid: string; data: any }>();
  snap.forEach((d) => {
    const email = String(d.data().email || "").trim().toLowerCase();
    if (email && !m.has(email)) m.set(email, { uid: d.id, data: d.data() });
  });
  return m;
}

async function loadPrByHrId(): Promise<Map<string, { uid: string; data: any }>> {
  const snap = await db.collection("users").where("hrEmployeeId", ">", "").get();
  const m = new Map<string, { uid: string; data: any }>();
  snap.forEach((d) => {
    const id = String(d.data().hrEmployeeId || "").trim();
    if (id) m.set(id, { uid: d.id, data: d.data() });
  });
  return m;
}

function randomPassword(): string {
  const a = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.randomBytes(24);
  let out = "";
  for (let i = 0; i < 24; i++) out += a[bytes[i] % a.length];
  return out;
}

async function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes("--dry-run");
  const incremental = argv.includes("--incremental");
  const refreshIdx = argv.indexOf("--refresh");
  const refreshId = refreshIdx !== -1 ? argv[refreshIdx + 1] : undefined;

  const now = new Date().toISOString();
  const resolver = await buildDeptResolver();

  // ── Single-user refresh ───────────────────────────────────────────────
  if (refreshId) {
    console.log(`Refreshing single employee ${refreshId}...`);
    const emp = await hrGet<HrEmployee>(`/api/employees/show/${encodeURIComponent(refreshId)}`);
    const email = emp.email.trim().toLowerCase();
    const byId = await db.collection("users").where("hrEmployeeId", "==", emp.employee_id).limit(1).get();
    let uid: string | null = null;
    if (!byId.empty) uid = byId.docs[0].id;
    else if (email) {
      const byEmail = await db.collection("users").where("email", "==", email).limit(1).get();
      if (!byEmail.empty) uid = byEmail.docs[0].id;
    }
    if (uid) {
      console.log(`  matched PR uid=${uid}; ${dryRun ? "(dry-run, no write)" : "updating HR-owned fields"}`);
      if (!dryRun) {
        const { firstName, lastName } = splitName(emp.name);
        const dept = resolver.resolve(emp.department);
        const patch: Record<string, unknown> = {
          hrEmployeeId: emp.employee_id || null,
          hrStatus: emp.status === "active" ? "active" : "inactive",
          hrCountry: emp.country || null,
          hrDepartmentName: emp.department || null,
          employeeType: emp.type || null,
          primaryDeployment: emp.primary_deployment || null,
          employmentStartDate: emp.employment_start_date || null,
          currentPositionTitle: emp.current_position_title || null,
          phone: emp.phone || null,
          headshot: emp.headshot || null,
          hrLastUpdatedAt: emp.last_updated_at || null,
          hrSyncedAt: now,
          firstName,
          lastName,
          email,
          updatedAt: now,
        };
        if (dept) patch.department = dept;
        await db.doc(`users/${uid}`).set(patch, { merge: true });
      }
    } else {
      console.log(`  no PR match; ${dryRun ? "(dry-run, would provision)" : "provisioning"}`);
      if (!dryRun) {
        const rec = await auth.createUser({ email, password: randomPassword(), displayName: emp.name });
        await auth.setCustomUserClaims(rec.uid, { permissionLevel: 5 });
        const { firstName, lastName } = splitName(emp.name);
        const dept = resolver.resolve(emp.department);
        const doc: Record<string, unknown> = {
          id: rec.uid, email, firstName, lastName, isActive: true,
          permissionLevel: 5, createdAt: now, updatedAt: now,
          hrEmployeeId: emp.employee_id || null, hrStatus: emp.status === "active" ? "active" : "inactive",
          hrCountry: emp.country || null, hrDepartmentName: emp.department || null,
          employeeType: emp.type || null, primaryDeployment: emp.primary_deployment || null,
          employmentStartDate: emp.employment_start_date || null,
          currentPositionTitle: emp.current_position_title || null,
          phone: emp.phone || null, headshot: emp.headshot || null,
          hrLastUpdatedAt: emp.last_updated_at || null, hrSyncedAt: now,
        };
        if (dept) doc.department = dept;
        await db.doc(`users/${rec.uid}`).set(doc, { merge: true });
        console.log(`  provisioned uid=${rec.uid}`);
      }
    }
    return;
  }

  // ── Bulk reconcile / incremental ──────────────────────────────────────
  let since: string | undefined;
  if (incremental) {
    const cur = (await db.doc("hrSyncState/cursor").get()).data() as { lastUpdatedAt?: string } | undefined;
    since = cur?.lastUpdatedAt;
    console.log(`Incremental sync since=${since || "(none, full pull)"}`);
  }
  const dir = await getDirectory(since);
  console.log(`HR returned ${dir.employees.length} employee(s).${dryRun ? " (DRY RUN — no writes)" : ""}`);

  const prByEmail = await loadPrByEmail();
  let matched = 0, provisioned = 0, unmappedDept = new Set<string>();
  const provisionedRows: { email: string; employeeId: string }[] = [];

  for (const emp of dir.employees) {
    const email = emp.email.trim().toLowerCase();
    if (!email) { console.warn(`  skip (no email): ${emp.employee_id}`); continue; }
    const dept = resolver.resolve(emp.department);
    if (emp.department && !dept) unmappedDept.add(emp.department);

    const m = prByEmail.get(email);
    if (m) {
      matched++;
      if (!dryRun) {
        const { firstName, lastName } = splitName(emp.name);
        const skipDept = m.data.multiDepartmentAppointmentsEnabled === true;
        const patch: Record<string, unknown> = {
          hrEmployeeId: emp.employee_id || null,
          hrStatus: emp.status === "active" ? "active" : "inactive",
          hrCountry: emp.country || null,
          hrDepartmentName: emp.department || null,
          employeeType: emp.type || null,
          primaryDeployment: emp.primary_deployment || null,
          employmentStartDate: emp.employment_start_date || null,
          currentPositionTitle: emp.current_position_title || null,
          phone: emp.phone || null,
          headshot: emp.headshot || null,
          hrLastUpdatedAt: emp.last_updated_at || null,
          hrSyncedAt: now,
          firstName, lastName, email, updatedAt: now,
        };
        if (dept && !skipDept) patch.department = dept;
        await db.doc(`users/${m.uid}`).set(patch, { merge: true });
      }
    } else {
      provisioned++;
      provisionedRows.push({ email, employeeId: emp.employee_id || "" });
      if (!dryRun) {
        try {
          const rec = await auth.createUser({ email, password: randomPassword(), displayName: emp.name });
          await auth.setCustomUserClaims(rec.uid, { permissionLevel: 5 });
          const { firstName, lastName } = splitName(emp.name);
          const doc: Record<string, unknown> = {
            id: rec.uid, email, firstName, lastName, isActive: true,
            permissionLevel: 5, createdAt: now, updatedAt: now,
            hrEmployeeId: emp.employee_id || null, hrStatus: emp.status === "active" ? "active" : "inactive",
            hrCountry: emp.country || null, hrDepartmentName: emp.department || null,
            employeeType: emp.type || null, primaryDeployment: emp.primary_deployment || null,
            employmentStartDate: emp.employment_start_date || null,
            currentPositionTitle: emp.current_position_title || null,
            phone: emp.phone || null, headshot: emp.headshot || null,
            hrLastUpdatedAt: emp.last_updated_at || null, hrSyncedAt: now,
          };
          if (dept) doc.department = dept;
          await db.doc(`users/${rec.uid}`).set(doc, { merge: true });
        } catch (err: any) {
          if (err?.code === "auth/email-already-exists") {
            const existing = await auth.getUserByEmail(email);
            console.warn(`  Auth orphan adopted for ${email} uid=${existing.uid} — Firestore profile not written by this script`);
          } else {
            console.error(`  provision failed for ${email}:`, err?.message || err);
          }
        }
      }
    }
  }

  // Departure detection only for full (non-incremental) runs.
  let departures = 0;
  if (!incremental) {
    const prByHrId = await loadPrByHrId();
    const hrIds = new Set(dir.employees.map((e) => e.employee_id).filter(Boolean) as string[]);
    for (const [hrId, { uid }] of prByHrId) {
      if (!hrIds.has(hrId)) {
        departures++;
        if (!dryRun) {
          await db.doc(`users/${uid}`).set({ hrStatus: "inactive", hrSyncedAt: now, updatedAt: now }, { merge: true });
        }
      }
    }
  }

  // Update cursor (always, even in dry-run we skip).
  if (!dryRun) {
    let maxUpdatedAt: string | null = null;
    for (const e of dir.employees) {
      if (e.last_updated_at && (!maxUpdatedAt || e.last_updated_at > maxUpdatedAt)) maxUpdatedAt = e.last_updated_at;
    }
    const patch: Record<string, unknown> = { updatedAt: now };
    if (maxUpdatedAt) patch.lastUpdatedAt = maxUpdatedAt;
    patch[incremental ? "lastIncrementalSyncAt" : "lastFullSyncAt"] = now;
    await db.doc("hrSyncState/cursor").set(patch, { merge: true });
  }

  console.log("\n=== Summary ===");
  console.log(`HR employees pulled: ${dir.employees.length}`);
  console.log(`Matched to existing PR users: ${matched}`);
  console.log(`Provisioned (new): ${provisioned}`);
  console.log(`Departures (now hrStatus=inactive): ${departures}`);
  console.log(`Unmapped department names: ${unmappedDept.size}`);
  if (unmappedDept.size) {
    console.log("  - " + [...unmappedDept].sort().join("\n  - "));
  }
  if (provisionedRows.length) {
    console.log("\nProvisioned (need organization assignment):");
    for (const r of provisionedRows) console.log(`  ${r.email}  (${r.employeeId})`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
