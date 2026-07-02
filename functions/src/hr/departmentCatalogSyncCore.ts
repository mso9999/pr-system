/**
 * Core HR → PR department catalog sync. Function triggers (callable +
 * scheduled) live in departmentCatalogSync.ts and delegate here.
 *
 * HR is canonical for the department catalog as of 2026-06-30. PR mirrors
 * `GET /api/departments` into `referenceData_departments`, preserving
 * existing PR doc ids for PR-sourced rows (so FKs on PRs/users don't
 * break) and creating new docs for HR-created rows.
 *
 * Match key: HR `source_doc_id`. For `source_system='pr'` this IS the PR
 * Firestore doc id; we update that doc in place. For `source_system` in
 * `('hr','hr_renamed')` we upsert a doc whose id is the HR `source_doc_id`
 * (slug-safe), creating it if absent.
 *
 * Tombstoning (full sync only): PR docs that carry a `sourceDocId`
 * (provenance-tracked) but are absent from HR's response are set
 * `active=false`. PR-native docs with no provenance are left alone and
 * flagged in the report — they predate the HR-canonical switch and may be
 * genuinely PR-only; an admin should decide.
 */
import * as admin from "firebase-admin";
import { getDepartments, type HrDepartment } from "./departmentCatalogClient";

const db = admin.firestore();

const CURSOR_DOC = "hrSyncState/departmentCursor";
const REPORT_COLLECTION = "hrDepartmentSyncReports";

export interface CatalogSyncReport {
  timestamp: string;
  generatedAtMs: number;
  mode: "full" | "incremental";
  since?: string;
  totals: {
    pulled: number;
    created: number;
    updated: number;
    unchanged: number;
    tombstoned: number;
    prNativeUntouched: number;
    unmappedOrgs: number;
    errors: number;
  };
  created: Array<{ docId: string; name: string; org: string }>;
  updated: Array<{ docId: string; name: string; org: string }>;
  tombstoned: Array<{ docId: string; name: string }>;
  prNativeUntouched: Array<{ docId: string; name: string }>;
  unmappedOrgs: string[];
  errors: Array<{ sourceDocId?: string; name?: string; error: string }>;
}

function emptyReport(mode: "full" | "incremental", since?: string): CatalogSyncReport {
  return {
    timestamp: new Date().toISOString(),
    generatedAtMs: Date.now(),
    mode,
    since,
    totals: {
      pulled: 0,
      created: 0,
      updated: 0,
      unchanged: 0,
      tombstoned: 0,
      prNativeUntouched: 0,
      unmappedOrgs: 0,
      errors: 0,
    },
    created: [],
    updated: [],
    tombstoned: [],
    prNativeUntouched: [],
    unmappedOrgs: [],
    errors: [],
  };
}

function slug(s: string): string {
  return String(s || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function isSafeDocId(s: string): boolean {
  return !!s && !/[\/]/.test(s) && s.length <= 1500 && s !== "." && s !== "..";
}

interface OrgInfo {
  id: string;
  name: string;
}

async function loadOrgMap(): Promise<Map<string, OrgInfo>> {
  const snap = await db.collection("referenceData_organizations").get();
  const m = new Map<string, OrgInfo>();
  snap.forEach((d) => {
    const data = d.data() as { name?: string; id?: string };
    const id = String(d.id);
    m.set(id, { id, name: data.name || id });
    // Also index by normalized id for case/slug-insensitive lookups.
    m.set(slug(id), { id, name: data.name || id });
  });
  return m;
}

function resolveOrg(orgId: string | null | undefined, orgMap: Map<string, OrgInfo>, report: CatalogSyncReport): OrgInfo {
  const raw = String(orgId || "").trim();
  if (!raw) return { id: "", name: "" };
  const direct = orgMap.get(raw);
  if (direct) return direct;
  const slugged = orgMap.get(slug(raw));
  if (slugged) return slugged;
  if (!report.unmappedOrgs.includes(raw)) {
    report.unmappedOrgs.push(raw);
    report.totals.unmappedOrgs = report.unmappedOrgs.length;
  }
  return { id: raw, name: raw };
}

function buildDepartmentPatch(
  emp: HrDepartment,
  org: OrgInfo,
  existing: admin.firestore.DocumentSnapshot | null,
  now: string
): Record<string, unknown> {
  const existingCode = existing?.get("code") as string | undefined;
  const code = existingCode || slug(emp.source_doc_id || "") || slug(emp.name);
  const patch: Record<string, unknown> = {
    name: emp.name,
    code,
    organizationId: org.id,
    organization: { id: org.id, name: org.name },
    country: emp.country || null,
    active: emp.active === true,
    sourceSystem: emp.source_system,
    sourceDocId: emp.source_doc_id || null,
    hrId: emp.id,
    hrCatalogSyncedAt: now,
    updatedAt: now,
  };
  if (Array.isArray(emp.aliases)) {
    patch.aliases = emp.aliases.filter((a) => typeof a === "string" && a.trim());
  }
  return patch;
}

async function getCursor(): Promise<{ lastUpdatedAt: string | null }> {
  const snap = await db.doc(CURSOR_DOC).get();
  return { lastUpdatedAt: snap.data()?.lastUpdatedAt ?? null };
}

async function updateCursor(departments: HrDepartment[], now: string, mode: "full" | "incremental"): Promise<void> {
  let maxUpdatedAt: string | null = null;
  for (const d of departments) {
    if (d.updated_at) {
      if (!maxUpdatedAt || d.updated_at > maxUpdatedAt) maxUpdatedAt = d.updated_at;
    }
  }
  const patch: Record<string, unknown> = { updatedAt: now };
  if (maxUpdatedAt) patch.lastUpdatedAt = maxUpdatedAt;
  if (mode === "full") patch.lastFullSyncAt = now;
  if (mode === "incremental") patch.lastIncrementalSyncAt = now;
  await db.doc(CURSOR_DOC).set({ ...patch }, { merge: true });
}

async function persistReport(report: CatalogSyncReport): Promise<string> {
  const docId = new Date().toISOString().replace(/[:.]/g, "-");
  await db.collection(REPORT_COLLECTION).doc(docId).set(report);
  return docId;
}

/**
 * Run a catalog sync. `full` pulls everything and tombstones provenance-tracked
 * PR docs absent from HR; incremental pulls `?since=<cursor>` and does not
 * tombstone (HR may omit unchanged rows including deactivated ones).
 */
export async function runCatalogSync(opts: { full?: boolean } = {}): Promise<CatalogSyncReport> {
  const full = opts.full !== false;
  const report = emptyReport(full ? "full" : "incremental");
  const now = new Date().toISOString();

  let since: string | undefined;
  if (!full) {
    const cursor = await getCursor();
    since = cursor.lastUpdatedAt || undefined;
    report.since = since;
  }

  let dir: { count: number; departments: HrDepartment[] };
  try {
    dir = await getDepartments(since ? { since } : {});
  } catch (err) {
    report.errors.push({ error: `HR /api/departments pull failed: ${err}` });
    report.totals.errors++;
    await persistReport(report);
    return report;
  }
  report.totals.pulled = dir.departments.length;

  const orgMap = await loadOrgMap();

  // Load existing PR departments once. Index by doc id and by sourceDocId.
  const existingSnap = await db.collection("referenceData_departments").get();
  const byDocId = new Map<string, admin.firestore.DocumentSnapshot>();
  const bySourceDocId = new Map<string, admin.firestore.DocumentSnapshot>();
  for (const d of existingSnap.docs) {
    byDocId.set(d.id, d);
    const sd = d.get("sourceDocId");
    if (typeof sd === "string" && sd) bySourceDocId.set(sd, d);
  }

  const seenDocIds = new Set<string>();
  const seenSourceDocIds = new Set<string>();

  for (const hrDept of dir.departments) {
    try {
      const org = resolveOrg(hrDept.organization_id, orgMap, report);
      const sourceDocId = hrDept.source_doc_id || null;

      // Find an existing PR doc to update.
      let existing: admin.firestore.DocumentSnapshot | null = null;
      let targetDocId: string | null = null;

      if (sourceDocId) {
        const bySrc = bySourceDocId.get(sourceDocId);
        if (bySrc) {
          existing = bySrc;
          targetDocId = bySrc.id;
        } else if (hrDept.source_system === "pr" && byDocId.has(sourceDocId)) {
          // PR-sourced row whose doc id IS the source_doc_id — update in place.
          existing = byDocId.get(sourceDocId) || null;
          targetDocId = sourceDocId;
        } else if (isSafeDocId(sourceDocId)) {
          // HR-created row: use source_doc_id as the PR doc id (create if absent).
          const byId = byDocId.get(sourceDocId);
          if (byId) {
            existing = byId;
            targetDocId = sourceDocId;
          } else {
            targetDocId = sourceDocId;
          }
        }
      }

      if (!targetDocId) {
        // No source_doc_id and no match — create with an auto id.
        targetDocId = db.collection("referenceData_departments").doc().id;
      }

      const patch = buildDepartmentPatch(hrDept, org, existing, now);

      if (existing) {
        // Skip write if nothing material changed (compare a few fields).
        const ed = existing.data() || {};
        const same =
          ed.name === patch.name &&
          ed.organizationId === patch.organizationId &&
          ed.country === patch.country &&
          ed.active === patch.active &&
          ed.sourceSystem === patch.sourceSystem &&
          ed.sourceDocId === patch.sourceDocId &&
          String(ed.hrId || "") === String(patch.hrId || "");
        if (same) {
          report.totals.unchanged++;
        } else {
          await db.doc(`referenceData_departments/${targetDocId}`).set(patch, { merge: true });
          report.updated.push({ docId: targetDocId, name: hrDept.name, org: org.id });
          report.totals.updated++;
        }
      } else {
        const createPatch: Record<string, unknown> = {
          ...patch,
          id: targetDocId,
          active: hrDept.active === true,
          createdAt: now,
        };
        await db.doc(`referenceData_departments/${targetDocId}`).set(createPatch, { merge: true });
        report.created.push({ docId: targetDocId, name: hrDept.name, org: org.id });
        report.totals.created++;
      }

      seenDocIds.add(targetDocId);
      if (sourceDocId) seenSourceDocIds.add(sourceDocId);
    } catch (err) {
      report.errors.push({
        sourceDocId: hrDept.source_doc_id || undefined,
        name: hrDept.name,
        error: String(err),
      });
      report.totals.errors++;
    }
  }

  // Tombstoning (full sync only): provenance-tracked PR docs absent from HR.
  if (full) {
    for (const d of existingSnap.docs) {
      const data = d.data() || {};
      const sd = data.sourceDocId;
      const hasProvenance = typeof sd === "string" && sd;
      if (!hasProvenance) {
        // PR-native, never synced from HR. Don't touch; flag for admin review.
        report.prNativeUntouched.push({ docId: d.id, name: data.name || "" });
        report.totals.prNativeUntouched++;
        continue;
      }
      if (seenSourceDocIds.has(sd) || seenDocIds.has(d.id)) continue;
      if (data.active === false) continue; // already tombstoned
      try {
        await d.ref.set({ active: false, hrCatalogSyncedAt: now, updatedAt: now }, { merge: true });
        report.tombstoned.push({ docId: d.id, name: data.name || "" });
        report.totals.tombstoned++;
      } catch (err) {
        report.errors.push({ sourceDocId: sd, name: data.name, error: `Tombstone failed: ${err}` });
        report.totals.errors++;
      }
    }
  }

  await updateCursor(dir.departments, now, full ? "full" : "incremental");
  await persistReport(report);
  return report;
}
