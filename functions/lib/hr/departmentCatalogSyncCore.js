"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCatalogSync = runCatalogSync;
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
const admin = __importStar(require("firebase-admin"));
const departmentCatalogClient_1 = require("./departmentCatalogClient");
const db = admin.firestore();
const CURSOR_DOC = "hrSyncState/departmentCursor";
const REPORT_COLLECTION = "hrDepartmentSyncReports";
function emptyReport(mode, since) {
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
function slug(s) {
    return String(s || "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
}
function isSafeDocId(s) {
    return !!s && !/[\/]/.test(s) && s.length <= 1500 && s !== "." && s !== "..";
}
async function loadOrgMap() {
    const snap = await db.collection("referenceData_organizations").get();
    const m = new Map();
    snap.forEach((d) => {
        const data = d.data();
        const id = String(d.id);
        m.set(id, { id, name: data.name || id });
        // Also index by normalized id for case/slug-insensitive lookups.
        m.set(slug(id), { id, name: data.name || id });
    });
    return m;
}
function resolveOrg(orgId, orgMap, report) {
    const raw = String(orgId || "").trim();
    if (!raw)
        return { id: "", name: "" };
    const direct = orgMap.get(raw);
    if (direct)
        return direct;
    const slugged = orgMap.get(slug(raw));
    if (slugged)
        return slugged;
    if (!report.unmappedOrgs.includes(raw)) {
        report.unmappedOrgs.push(raw);
        report.totals.unmappedOrgs = report.unmappedOrgs.length;
    }
    return { id: raw, name: raw };
}
function buildDepartmentPatch(emp, org, existing, now) {
    const existingCode = existing === null || existing === void 0 ? void 0 : existing.get("code");
    const code = existingCode || slug(emp.source_doc_id || "") || slug(emp.name);
    const patch = {
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
async function getCursor() {
    var _a, _b;
    const snap = await db.doc(CURSOR_DOC).get();
    return { lastUpdatedAt: (_b = (_a = snap.data()) === null || _a === void 0 ? void 0 : _a.lastUpdatedAt) !== null && _b !== void 0 ? _b : null };
}
async function updateCursor(departments, now, mode) {
    let maxUpdatedAt = null;
    for (const d of departments) {
        if (d.updated_at) {
            if (!maxUpdatedAt || d.updated_at > maxUpdatedAt)
                maxUpdatedAt = d.updated_at;
        }
    }
    const patch = { updatedAt: now };
    if (maxUpdatedAt)
        patch.lastUpdatedAt = maxUpdatedAt;
    if (mode === "full")
        patch.lastFullSyncAt = now;
    if (mode === "incremental")
        patch.lastIncrementalSyncAt = now;
    await db.doc(CURSOR_DOC).set(Object.assign({}, patch), { merge: true });
}
async function persistReport(report) {
    const docId = new Date().toISOString().replace(/[:.]/g, "-");
    await db.collection(REPORT_COLLECTION).doc(docId).set(report);
    return docId;
}
/**
 * Run a catalog sync. `full` pulls everything and tombstones provenance-tracked
 * PR docs absent from HR; incremental pulls `?since=<cursor>` and does not
 * tombstone (HR may omit unchanged rows including deactivated ones).
 */
async function runCatalogSync(opts = {}) {
    const full = opts.full !== false;
    const report = emptyReport(full ? "full" : "incremental");
    const now = new Date().toISOString();
    let since;
    if (!full) {
        const cursor = await getCursor();
        since = cursor.lastUpdatedAt || undefined;
        report.since = since;
    }
    let dir;
    try {
        dir = await (0, departmentCatalogClient_1.getDepartments)(since ? { since } : {});
    }
    catch (err) {
        report.errors.push({ error: `HR /api/departments pull failed: ${err}` });
        report.totals.errors++;
        await persistReport(report);
        return report;
    }
    report.totals.pulled = dir.departments.length;
    const orgMap = await loadOrgMap();
    // Load existing PR departments once. Index by doc id and by sourceDocId.
    const existingSnap = await db.collection("referenceData_departments").get();
    const byDocId = new Map();
    const bySourceDocId = new Map();
    for (const d of existingSnap.docs) {
        byDocId.set(d.id, d);
        const sd = d.get("sourceDocId");
        if (typeof sd === "string" && sd)
            bySourceDocId.set(sd, d);
    }
    const seenDocIds = new Set();
    const seenSourceDocIds = new Set();
    for (const hrDept of dir.departments) {
        try {
            const org = resolveOrg(hrDept.organization_id, orgMap, report);
            const sourceDocId = hrDept.source_doc_id || null;
            // Find an existing PR doc to update.
            let existing = null;
            let targetDocId = null;
            if (sourceDocId) {
                const bySrc = bySourceDocId.get(sourceDocId);
                if (bySrc) {
                    existing = bySrc;
                    targetDocId = bySrc.id;
                }
                else if (hrDept.source_system === "pr" && byDocId.has(sourceDocId)) {
                    // PR-sourced row whose doc id IS the source_doc_id — update in place.
                    existing = byDocId.get(sourceDocId) || null;
                    targetDocId = sourceDocId;
                }
                else if (isSafeDocId(sourceDocId)) {
                    // HR-created row: use source_doc_id as the PR doc id (create if absent).
                    const byId = byDocId.get(sourceDocId);
                    if (byId) {
                        existing = byId;
                        targetDocId = sourceDocId;
                    }
                    else {
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
                const same = ed.name === patch.name &&
                    ed.organizationId === patch.organizationId &&
                    ed.country === patch.country &&
                    ed.active === patch.active &&
                    ed.sourceSystem === patch.sourceSystem &&
                    ed.sourceDocId === patch.sourceDocId &&
                    String(ed.hrId || "") === String(patch.hrId || "");
                if (same) {
                    report.totals.unchanged++;
                }
                else {
                    await db.doc(`referenceData_departments/${targetDocId}`).set(patch, { merge: true });
                    report.updated.push({ docId: targetDocId, name: hrDept.name, org: org.id });
                    report.totals.updated++;
                }
            }
            else {
                const createPatch = Object.assign(Object.assign({}, patch), { id: targetDocId, active: hrDept.active === true, createdAt: now });
                await db.doc(`referenceData_departments/${targetDocId}`).set(createPatch, { merge: true });
                report.created.push({ docId: targetDocId, name: hrDept.name, org: org.id });
                report.totals.created++;
            }
            seenDocIds.add(targetDocId);
            if (sourceDocId)
                seenSourceDocIds.add(sourceDocId);
        }
        catch (err) {
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
            if (seenSourceDocIds.has(sd) || seenDocIds.has(d.id))
                continue;
            if (data.active === false)
                continue; // already tombstoned
            try {
                await d.ref.set({ active: false, hrCatalogSyncedAt: now, updatedAt: now }, { merge: true });
                report.tombstoned.push({ docId: d.id, name: data.name || "" });
                report.totals.tombstoned++;
            }
            catch (err) {
                report.errors.push({ sourceDocId: sd, name: data.name, error: `Tombstone failed: ${err}` });
                report.totals.errors++;
            }
        }
    }
    await updateCursor(dir.departments, now, full ? "full" : "incremental");
    await persistReport(report);
    return report;
}
//# sourceMappingURL=departmentCatalogSyncCore.js.map