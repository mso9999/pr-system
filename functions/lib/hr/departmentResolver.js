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
exports.buildDepartmentResolver = buildDepartmentResolver;
/**
 * Resolves HR department name strings (e.g. "O&M", "Engineering") to PR
 * `referenceData_departments` doc ids. HR is canonical for the department
 * catalog as of 2026-06-30; PR mirrors it via departmentCatalogSync.
 *
 * Matching priority (most-specific first), all case/whitespace-insensitive:
 *   1. (country, organizationId, name)
 *   2. (country, name)            — used by the employee sync, which has
 *                                    country but not the employee's org_id
 *   3. (organizationId, name)
 *   4. (name)                     — last-resort fallback; ambiguous if the
 *                                    same name exists in multiple orgs
 *
 * Only active departments are eligible. If a name matches only an inactive
 * (tombstoned) department, it is reported as unmapped so an admin can fix
 * the HR record.
 *
 * Unmapped names and ambiguous matches are tracked for the reconciliation
 * report.
 */
const admin = __importStar(require("firebase-admin"));
const db = admin.firestore();
function normalizeName(s) {
    return s.trim().toLowerCase().replace(/\s+/g, " ");
}
function normCountry(s) {
    return String(s || "").trim().toUpperCase();
}
function normOrg(s) {
    return String(s || "").trim().toLowerCase();
}
async function buildDepartmentResolver() {
    const snap = await db.collection("referenceData_departments").get();
    // key → Set<docId>
    const byCountryOrgName = new Map();
    const byCountryName = new Map();
    const byOrgName = new Map();
    const byName = new Map();
    // Track inactive names so we can distinguish "no match" from "matches a tombstone".
    const inactiveNames = new Set();
    const index = (map, key, docId) => {
        const set = map.get(key);
        if (set)
            set.add(docId);
        else
            map.set(key, new Set([docId]));
    };
    for (const d of snap.docs) {
        const data = d.data();
        if (!data.name)
            continue;
        const nameKey = normalizeName(String(data.name));
        const isActive = data.active !== false;
        if (!isActive) {
            inactiveNames.add(nameKey);
            continue;
        }
        const country = normCountry(data.country);
        const org = normOrg(data.organizationId);
        index(byCountryOrgName, `${country}|${org}|${nameKey}`, d.id);
        if (country)
            index(byCountryName, `${country}|${nameKey}`, d.id);
        if (org)
            index(byOrgName, `${org}|${nameKey}`, d.id);
        index(byName, nameKey, d.id);
        // Also index aliases (HR alternate names) under the same scopes.
        if (Array.isArray(data.aliases)) {
            for (const alias of data.aliases) {
                if (!alias || !String(alias).trim())
                    continue;
                const aKey = normalizeName(String(alias));
                index(byCountryOrgName, `${country}|${org}|${aKey}`, d.id);
                if (country)
                    index(byCountryName, `${country}|${aKey}`, d.id);
                if (org)
                    index(byOrgName, `${org}|${aKey}`, d.id);
                index(byName, aKey, d.id);
            }
        }
    }
    const unmapped = new Set();
    const ambiguous = new Set();
    const pick = (set, name) => {
        if (!set || set.size === 0)
            return { departmentId: null, unmapped: false, ambiguous: false };
        if (set.size > 1) {
            ambiguous.add(name);
            return { departmentId: [...set][0], unmapped: false, ambiguous: true };
        }
        return { departmentId: [...set][0], unmapped: false, ambiguous: false };
    };
    const resolve = (name, ctx = {}) => {
        if (!name || !String(name).trim()) {
            return { departmentId: null, unmapped: false, ambiguous: false };
        }
        const nameKey = normalizeName(String(name));
        const country = normCountry(ctx.country);
        const org = normOrg(ctx.organizationId);
        // 1. (country, org, name)
        if (country && org) {
            const r = pick(byCountryOrgName.get(`${country}|${org}|${nameKey}`), String(name));
            if (r.departmentId)
                return r;
        }
        // 2. (country, name)
        if (country) {
            const r = pick(byCountryName.get(`${country}|${nameKey}`), String(name));
            if (r.departmentId)
                return r;
        }
        // 3. (org, name)
        if (org) {
            const r = pick(byOrgName.get(`${org}|${nameKey}`), String(name));
            if (r.departmentId)
                return r;
        }
        // 4. (name) — last resort
        const r = pick(byName.get(nameKey), String(name));
        if (r.departmentId)
            return r;
        // No active match. If it matches a tombstoned name, still report unmapped
        // (so admins fix the HR record) but note it in the unmapped set.
        unmapped.add(String(name).trim());
        return { departmentId: null, unmapped: true, ambiguous: false };
    };
    return {
        resolve,
        unmappedNames: () => [...unmapped].sort(),
        ambiguousNames: () => [...ambiguous].sort(),
    };
}
//# sourceMappingURL=departmentResolver.js.map