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
exports.getPrApprovers = void 0;
/**
 * getPrApprovers — canonical approver resolution for the PR system.
 *
 * The approver picker historically read the PR `users` Firestore collection
 * directly: permissionLevel + organization fields that are SYNCED from HR and
 * Nexus. When a sync null-wiped those fields (2026-08-20), approvers vanished
 * from every picker. This function resolves the list from the canonical
 * sources instead:
 *
 *   - approval authority (permissionLevel): PR `users` (PR-owned)
 *   - org coverage + active employment: HR directory API (canonical)
 *
 * A sync gap in the PR copy can no longer remove an approver. The frontend
 * (src/services/approver.ts) calls this first and falls back to the direct
 * Firestore read only if the function is unreachable.
 */
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const hrDirectoryClient_1 = require("./hr/hrDirectoryClient");
const db = admin.firestore();
// Levels that may appear in approver pickers: 1=Admin (global),
// 2=Senior Approver (org-scoped), 6=Finance Approver (org-scoped).
const APPROVER_LEVELS = [1, 2, 6];
function normalizeOrgId(input) {
    return String(input || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}
exports.getPrApprovers = functions.https.onCall(async (data, context) => {
    if (!context || !context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
    }
    const organizationId = String((data && data.organizationId) || "");
    if (!organizationId) {
        throw new functions.https.HttpsError("invalid-argument", "organizationId is required.");
    }
    // Callers pass whatever they have — a catalog id ("smp"), a code ("SMP"),
    // or the display name stored on the PR ("Sotho Minigrid Portfolio").
    // normalizeOrgId alone is alias-free, so name-form input missed org-scoped
    // approvers (2026-09-03: SMP PRs showed only global level-1 approvers).
    // Resolve through the org catalog: any of id/code/name maps to the doc id.
    const orgsSnap = await db.collection("referenceData_organizations").get();
    const aliasToId = new Map();
    orgsSnap.forEach((d) => {
        const data = d.data();
        for (const candidate of [d.id, data.code, data.name]) {
            const key = normalizeOrgId(candidate);
            if (key && !aliasToId.has(key))
                aliasToId.set(key, normalizeOrgId(d.id));
        }
    });
    const rawTarget = normalizeOrgId(organizationId);
    const target = aliasToId.get(rawTarget) || rawTarget;
    // PR-owned approval authority.
    const usersSnap = await db.collection("users").where("isActive", "==", true).get();
    // HR canonical org coverage. If HR is unreachable this throws and the
    // client falls back to the direct Firestore read (see approver.ts).
    const dir = await (0, hrDirectoryClient_1.getDirectory)();
    const hrByEmail = new Map();
    for (const emp of dir.employees) {
        const email = (emp.email || "").trim().toLowerCase();
        if (email)
            hrByEmail.set(email, emp);
    }
    const out = [];
    usersSnap.forEach((doc) => {
        var _a;
        const f = doc.data();
        const lvl = Number((_a = f.permissionLevel) !== null && _a !== void 0 ? _a : 0);
        if (!APPROVER_LEVELS.includes(lvl))
            return;
        const email = String(f.email || "").trim().toLowerCase();
        const hr = email ? hrByEmail.get(email) : undefined;
        // Org coverage: HR canonical when present; the PR copy as fallback so an
        // HR directory gap doesn't silently drop an active approver.
        const orgs = hr
            ? [normalizeOrgId(hr.primary_organization),
                ...(Array.isArray(hr.additional_organizations) ? hr.additional_organizations.map(normalizeOrgId) : [])]
                .filter(Boolean)
            : [normalizeOrgId(f.organization),
                ...(Array.isArray(f.additionalOrganizations) ? f.additionalOrganizations.map(normalizeOrgId) : [])]
                .filter(Boolean);
        if (lvl === 1 || orgs.includes(target)) {
            out.push({
                id: doc.id,
                name: f.name || `${f.firstName || ""} ${f.lastName || ""}`.trim() || email,
                email,
                permissionLevel: lvl,
                organization: hr ? String(hr.primary_organization || "") : String(f.organization || ""),
                additionalOrganizations: hr
                    ? (Array.isArray(hr.additional_organizations) ? hr.additional_organizations : [])
                    : (Array.isArray(f.additionalOrganizations) ? f.additionalOrganizations : []),
            });
        }
    });
    return { approvers: out, count: out.length, source: "hr-canonical" };
});
//# sourceMappingURL=prApprovers.js.map