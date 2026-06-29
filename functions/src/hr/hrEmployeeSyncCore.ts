/**
 * Core HR → PR employee sync logic. Function-triggers (callable + scheduled)
 * live in sibling files and delegate here.
 *
 * HR is canonical for the biographical fields listed in the HR-owned block
 * of `src/types/user.ts`. PR keeps ownership of permissionLevel,
 * organization, additionalOrganizations, isActive, isHrLead, etc.
 *
 * Matching: existing PR users are matched to HR employees by email
 * (case-insensitive). On match we stamp `hrEmployeeId` and overwrite the
 * HR-owned fields. New HR hires are provisioned as PR Auth + Firestore
 * users with a random password and a password-reset email.
 *
 * Departures: HR drops inactive rows from /directory, so incremental
 * `?since=` pulls cannot see them. The weekly full reconciliation diff
 * detects them by absence and mirrors `hrStatus: 'inactive'` (PR's own
 * `isActive` is never flipped automatically).
 */
import * as admin from "firebase-admin";
import { sendEmail } from "../utils/emailSender";
import {
  getDirectory,
  showEmployee,
  type HrEmployee,
} from "./hrDirectoryClient";
import { buildDepartmentResolver, type DepartmentResolver } from "./departmentResolver";

const db = admin.firestore();
const auth = admin.auth();

const ADMIN_LEVEL = 1;
const USER_ADMIN_LEVEL = 8;
const DEFAULT_PROVISIONED_LEVEL = 5; // Requester

const HR_OWNED_FIELDS = [
  "hrEmployeeId",
  "hrStatus",
  "hrCountry",
  "hrDepartmentName",
  "employeeType",
  "primaryDeployment",
  "employmentStartDate",
  "currentPositionTitle",
  "phone",
  "headshot",
  "hrLastUpdatedAt",
  "hrSyncedAt",
  // Biographical fields HR owns (PR rules block client edits when hrEmployeeId is set)
  "firstName",
  "lastName",
  "email",
  // `department` (PR dept id) is mirrored from HR but is PR-owned — admins
  // may override it, and multi-department appointments are PR-owned.
] as const;

export interface SyncReport {
  timestamp: string;
  generatedAtMs: number;
  mode: "full" | "incremental";
  since?: string;
  totals: {
    hrEmployeesPulled: number;
    matched: number;
    provisioned: number;
    emailUpdated: number;
    departures: number;
    prOnly: number;
    unmappedDepartments: number;
    errors: number;
  };
  matched: Array<{ uid: string; email: string; employeeId: string; emailChanged?: boolean }>;
  provisioned: Array<{ uid: string; email: string; employeeId: string }>;
  departures: Array<{ uid: string; email: string; employeeId: string }>;
  prOnly: Array<{ uid: string; email: string }>;
  unmappedDepartments: string[];
  errors: Array<{ uid?: string; email?: string; employeeId?: string; error: string }>;
}

function emptyReport(mode: "full" | "incremental", since?: string): SyncReport {
  return {
    timestamp: new Date().toISOString(),
    generatedAtMs: Date.now(),
    mode,
    since,
    totals: {
      hrEmployeesPulled: 0,
      matched: 0,
      provisioned: 0,
      emailUpdated: 0,
      departures: 0,
      prOnly: 0,
      unmappedDepartments: 0,
      errors: 0,
    },
    matched: [],
    provisioned: [],
    departures: [],
    prOnly: [],
    unmappedDepartments: [],
    errors: [],
  };
}

function splitName(name: string): { firstName: string; lastName: string } {
  const trimmed = (name || "").trim();
  if (!trimmed) return { firstName: "", lastName: "" };
  const firstSpace = trimmed.indexOf(" ");
  if (firstSpace === -1) return { firstName: trimmed, lastName: "" };
  return {
    firstName: trimmed.slice(0, firstSpace),
    lastName: trimmed.slice(firstSpace + 1).trim(),
  };
}

function hrOwnedPatch(
  emp: HrEmployee,
  resolver: DepartmentResolver,
  now: string,
  opts: { skipDepartment?: boolean } = {}
): Record<string, unknown> {
  const { firstName, lastName } = splitName(emp.name);
  const { departmentId, unmapped } = resolver.resolve(emp.department);
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
  };
  // Only mirror HR's department into PR's `department` (id) when the user
  // is NOT in multi-department mode — multi-department appointments and
  // primary-department overrides are PR-owned.
  if (departmentId && !opts.skipDepartment) {
    patch.department = departmentId;
  }
  if (unmapped && emp.department) {
    // tracked on the resolver; nothing to put on the patch
  }
  return patch;
}

function randomPassword(): string {
  // 24 chars from a safe alphabet — satisfies Firebase's >=6 char rule
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  const bytes = require("crypto").randomBytes(24);
  for (let i = 0; i < 24; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

async function sendProvisionedWelcome(email: string, name: string): Promise<void> {
  try {
    const link = await auth.generatePasswordResetLink(email);
    await sendEmail({
      from: '"1PWR System" <notifications@1pwrafrica.com>',
      to: email,
      subject: "Your 1PWR PR System account",
      text: `Hello ${name},\n\nAn account has been created for you on the 1PWR PR System (https://pr-system-1pwr.web.app). Your profile was provisioned from the 1PWR HR portal.\n\nSet your password to sign in:\n${link}\n\nIf you did not expect this email, please contact your HR administrator.`,
      html: `<p>Hello ${name},</p><p>An account has been created for you on the <strong>1PWR PR System</strong>.</p><p>Your profile was provisioned from the 1PWR HR portal. Set your password to sign in:</p><p><a href="${link}">Set your password</a></p><p style="color:#666;font-size:12px">If you did not expect this email, please contact your HR administrator.</p>`,
    });
  } catch (err) {
    // Non-fatal — the account exists; user can still request a reset later.
    console.warn(`[hrSync] welcome email failed for ${email}:`, err);
  }
}

async function provisionUser(
  emp: HrEmployee,
  resolver: DepartmentResolver,
  report: SyncReport,
  now: string
): Promise<void> {
  const email = emp.email.trim().toLowerCase();
  if (!email) {
    report.errors.push({ employeeId: emp.employee_id || undefined, error: "HR employee has no email" });
    report.totals.errors++;
    return;
  }

  const { firstName, lastName } = splitName(emp.name);
  const patch = hrOwnedPatch(emp, resolver, now);

  let uid: string;
  let createdNow = false;
  try {
    const record = await auth.createUser({
      email,
      password: randomPassword(),
      displayName: emp.name,
    });
    uid = record.uid;
    createdNow = true;
  } catch (err: any) {
    if (err?.code === "auth/email-already-exists") {
      // Auth orphan — adopt the existing Auth account and write the Firestore profile.
      try {
        const existing = await auth.getUserByEmail(email);
        uid = existing.uid;
      } catch (lookupErr) {
        report.errors.push({ email, employeeId: emp.employee_id || undefined, error: `Auth email exists but lookup failed: ${lookupErr}` });
        report.totals.errors++;
        return;
      }
    } else {
      report.errors.push({ email, employeeId: emp.employee_id || undefined, error: `Auth createUser failed: ${err?.message || err}` });
      report.totals.errors++;
      return;
    }
  }

  try {
    await auth.setCustomUserClaims(uid, { permissionLevel: DEFAULT_PROVISIONED_LEVEL });
    const userDoc: Record<string, unknown> = {
      id: uid,
      email,
      firstName,
      lastName,
      isActive: true,
      permissionLevel: DEFAULT_PROVISIONED_LEVEL,
      // PR-owned fields intentionally left unset: organization, additionalOrganizations, isHrLead, etc.
      // Admin assigns organization after reviewing the reconciliation report.
      createdAt: now,
      updatedAt: now,
      ...patch,
    };
    await db.doc(`users/${uid}`).set(userDoc, { merge: true });
    report.provisioned.push({ uid, email, employeeId: emp.employee_id || "" });
    report.totals.provisioned++;
    if (createdNow) {
      await sendProvisionedWelcome(email, emp.name);
    }
  } catch (err) {
    report.errors.push({ email, employeeId: emp.employee_id || undefined, error: `Provision write failed: ${err}` });
    report.totals.errors++;
    if (createdNow) {
      try { await auth.deleteUser(uid); } catch (e) { console.warn(`[hrSync] rollback failed for ${uid}`, e); }
    }
  }
}

async function updateMatchedUser(
  uid: string,
  existing: admin.firestore.DocumentData,
  emp: HrEmployee,
  resolver: DepartmentResolver,
  report: SyncReport,
  now: string
): Promise<void> {
  const patch = hrOwnedPatch(emp, resolver, now, {
    skipDepartment: existing.multiDepartmentAppointmentsEnabled === true,
  });
  const newEmail = emp.email.trim().toLowerCase();
  const existingEmail = String(existing.email || "").trim().toLowerCase();
  let emailChanged = false;

  if (newEmail && existingEmail && newEmail !== existingEmail) {
    try {
      await auth.updateUser(uid, { email: newEmail });
      patch.email = newEmail;
      emailChanged = true;
      report.totals.emailUpdated++;
    } catch (err) {
      // If the new email collides with another Auth account, leave Auth email
      // as-is and log. Don't fail the whole sync.
      report.errors.push({
        uid,
        email: existingEmail,
        employeeId: emp.employee_id || undefined,
        error: `Auth email update to ${newEmail} failed: ${err}`,
      });
      report.totals.errors++;
      // Keep Firestore email consistent with Auth (unchanged) by not patching email.
    }
  } else if (newEmail) {
    patch.email = newEmail;
  }

  await db.doc(`users/${uid}`).set(
    { ...patch, updatedAt: now },
    { merge: true }
  );
  report.matched.push({ uid, email: newEmail || existingEmail, employeeId: emp.employee_id || "", emailChanged });
  report.totals.matched++;
}

async function loadPrUsersByEmail(): Promise<Map<string, { uid: string; data: admin.firestore.DocumentData }>> {
  const snap = await db.collection("users").get();
  const map = new Map<string, { uid: string; data: admin.firestore.DocumentData }>();
  snap.forEach((d) => {
    const data = d.data();
    const email = String(data.email || "").trim().toLowerCase();
    if (email) {
      // First-write-wins: duplicate emails are an existing data issue we don't try to fix here.
      if (!map.has(email)) map.set(email, { uid: d.id, data });
    }
  });
  return map;
}

async function loadPrUsersByHrId(): Promise<Map<string, { uid: string; data: admin.firestore.DocumentData }>> {
  const snap = await db.collection("users").where("hrEmployeeId", ">", "").get();
  const map = new Map<string, { uid: string; data: admin.firestore.DocumentData }>();
  snap.forEach((d) => {
    const data = d.data();
    const id = String(data.hrEmployeeId || "").trim();
    if (id) map.set(id, { uid: d.id, data });
  });
  return map;
}

/**
 * Full reconciliation: pull the entire HR directory, match by email, upsert
 * HR-owned fields, provision new hires, and (optionally) detect departures
 * by diffing PR users that have an hrEmployeeId against the directory.
 */
export async function runReconciliation(opts: { detectDepartures?: boolean } = {}): Promise<SyncReport> {
  const report = emptyReport("full");
  const now = new Date().toISOString();
  const resolver = await buildDepartmentResolver();

  const dir = await getDirectory();
  report.totals.hrEmployeesPulled = dir.employees.length;
  const hrByEmail = new Map<string, HrEmployee>();
  const hrIds = new Set<string>();
  for (const emp of dir.employees) {
    const email = emp.email.trim().toLowerCase();
    if (email) hrByEmail.set(email, emp);
    if (emp.employee_id) hrIds.add(emp.employee_id);
  }

  const prByEmail = await loadPrUsersByEmail();

  for (const emp of dir.employees) {
    const email = emp.email.trim().toLowerCase();
    if (!email) {
      report.errors.push({ employeeId: emp.employee_id || undefined, error: "HR employee has no email" });
      report.totals.errors++;
      continue;
    }
    const matched = prByEmail.get(email);
    try {
      if (matched) {
        await updateMatchedUser(matched.uid, matched.data, emp, resolver, report, now);
      } else {
        await provisionUser(emp, resolver, report, now);
      }
    } catch (err) {
      report.errors.push({ email, employeeId: emp.employee_id || undefined, error: String(err) });
      report.totals.errors++;
    }
  }

  // PR-only: users with an email not present in HR. Leave them alone.
  for (const [email, { uid }] of prByEmail) {
    if (!hrByEmail.has(email)) {
      report.prOnly.push({ uid, email });
      report.totals.prOnly++;
    }
  }

  if (opts.detectDepartures !== false) {
    const prByHrId = await loadPrUsersByHrId();
    for (const [hrId, { uid, data }] of prByHrId) {
      if (!hrIds.has(hrId)) {
        // No longer in HR active directory — mirror inactive status.
        try {
          await db.doc(`users/${uid}`).set(
            { hrStatus: "inactive", hrSyncedAt: now, updatedAt: now },
            { merge: true }
          );
          report.departures.push({ uid, email: String(data.email || ""), employeeId: hrId });
          report.totals.departures++;
        } catch (err) {
          report.errors.push({ uid, email: String(data.email || ""), employeeId: hrId, error: `Departure flag failed: ${err}` });
          report.totals.errors++;
        }
      }
    }
  }

  report.unmappedDepartments = resolver.unmappedNames();
  report.totals.unmappedDepartments = report.unmappedDepartments.length;

  await updateCursor(dir.employees, now, "full");
  await persistReport(report);
  return report;
}

/**
 * Incremental sync: pull only HR rows updated since the cursor, upsert
 * HR-owned fields, provision new hires. Cannot detect departures (inactive
 * rows drop out of /directory).
 */
export async function runIncrementalSync(): Promise<SyncReport> {
  const report = emptyReport("incremental");
  const now = new Date().toISOString();
  const resolver = await buildDepartmentResolver();

  const cursor = await getCursor();
  const since = cursor.lastUpdatedAt || undefined;
  report.since = since;

  const dir = await getDirectory(since ? { since } : {});
  report.totals.hrEmployeesPulled = dir.employees.length;

  const prByEmail = await loadPrUsersByEmail();

  for (const emp of dir.employees) {
    const email = emp.email.trim().toLowerCase();
    if (!email) {
      report.errors.push({ employeeId: emp.employee_id || undefined, error: "HR employee has no email" });
      report.totals.errors++;
      continue;
    }
    const matched = prByEmail.get(email);
    try {
      if (matched) {
        await updateMatchedUser(matched.uid, matched.data, emp, resolver, report, now);
      } else {
        await provisionUser(emp, resolver, report, now);
      }
    } catch (err) {
      report.errors.push({ email, employeeId: emp.employee_id || undefined, error: String(err) });
      report.totals.errors++;
    }
  }

  report.unmappedDepartments = resolver.unmappedNames();
  report.totals.unmappedDepartments = report.unmappedDepartments.length;

  await updateCursor(dir.employees, now, "incremental");
  await persistReport(report);
  return report;
}

/** Refresh a single user by HR employee_id (uses /show). */
export async function refreshOneUser(employeeId: string): Promise<{
  outcome: "matched" | "provisioned" | "not_found";
  uid?: string;
  email?: string;
}> {
  const emp = await showEmployee(employeeId);
  if (!emp) {
    return { outcome: "not_found" };
  }
  const now = new Date().toISOString();
  const resolver = await buildDepartmentResolver();
  const email = emp.email.trim().toLowerCase();

  // Prefer an existing link by hrEmployeeId, then by email.
  let existingUid: string | null = null;
  let existingData: admin.firestore.DocumentData | null = null;

  const byIdSnap = await db.collection("users").where("hrEmployeeId", "==", emp.employee_id).limit(1).get();
  if (!byIdSnap.empty) {
    existingUid = byIdSnap.docs[0].id;
    existingData = byIdSnap.docs[0].data();
  } else if (email) {
    const byEmailSnap = await db.collection("users").where("email", "==", email).limit(1).get();
    if (!byEmailSnap.empty) {
      existingUid = byEmailSnap.docs[0].id;
      existingData = byEmailSnap.docs[0].data();
    }
  }

  if (existingUid && existingData) {
    const report = emptyReport("incremental");
    await updateMatchedUser(existingUid, existingData, emp, resolver, report, now);
    return { outcome: "matched", uid: existingUid, email };
  }

  const report = emptyReport("incremental");
  await provisionUser(emp, resolver, report, now);
  if (report.provisioned.length > 0) {
    return { outcome: "provisioned", uid: report.provisioned[0].uid, email };
  }
  if (report.errors.length > 0) {
    throw new Error(report.errors[0].error);
  }
  return { outcome: "not_found" };
}

// ── Sync state ───────────────────────────────────────────────────────────

const CURSOR_DOC = "hrSyncState/cursor";

export interface HrSyncCursor {
  lastUpdatedAt: string | null;
  lastFullSyncAt: string | null;
  lastIncrementalSyncAt: string | null;
}

async function getCursor(): Promise<HrSyncCursor> {
  const snap = await db.doc(CURSOR_DOC).get();
  const data = snap.data();
  return {
    lastUpdatedAt: data?.lastUpdatedAt ?? null,
    lastFullSyncAt: data?.lastFullSyncAt ?? null,
    lastIncrementalSyncAt: data?.lastIncrementalSyncAt ?? null,
  };
}

async function updateCursor(employees: HrEmployee[], now: string, mode: "full" | "incremental"): Promise<void> {
  let maxUpdatedAt: string | null = null;
  for (const e of employees) {
    if (e.last_updated_at) {
      if (!maxUpdatedAt || e.last_updated_at > maxUpdatedAt) maxUpdatedAt = e.last_updated_at;
    }
  }
  const patch: Record<string, unknown> = {};
  if (maxUpdatedAt) patch.lastUpdatedAt = maxUpdatedAt;
  if (mode === "full") patch.lastFullSyncAt = now;
  if (mode === "incremental") patch.lastIncrementalSyncAt = now;
  await db.doc(CURSOR_DOC).set({ ...patch, updatedAt: now }, { merge: true });
}

async function persistReport(report: SyncReport): Promise<string> {
  const docId = new Date().toISOString().replace(/[:.]/g, "-");
  await db.collection("hrReconciliationReports").doc(docId).set(report);
  return docId;
}

// ── Authz helper for callables ────────────────────────────────────────────

export async function assertAdmin(uid: string): Promise<void> {
  const doc = await db.collection("users").doc(uid).get();
  const lvl = Number(doc.data()?.permissionLevel);
  if (lvl !== ADMIN_LEVEL && lvl !== USER_ADMIN_LEVEL) {
    throw new Error("Superadmin or User Admin only");
  }
}

export { HR_OWNED_FIELDS };
