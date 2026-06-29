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
 * Resolves HR department name strings (e.g. "O&M", "Engineering") to
 * PR `referenceData_departments` doc ids. HR returns a department NAME;
 * PR stores department as a doc ID. We cache all department docs once
 * per run and match case-insensitively, ignoring whitespace differences.
 *
 * Unmapped names are tracked so the reconciliation report can flag them
 * for an admin to add or rename a department in PR.
 */
const admin = __importStar(require("firebase-admin"));
const db = admin.firestore();
function normalizeName(s) {
    return s.trim().toLowerCase().replace(/\s+/g, " ");
}
async function buildDepartmentResolver() {
    const snap = await db.collection("referenceData_departments").get();
    const byName = new Map();
    for (const d of snap.docs) {
        const data = d.data();
        if (!data.name)
            continue;
        byName.set(normalizeName(data.name), d.id);
    }
    const unmapped = new Set();
    const resolve = (name) => {
        if (!name || !String(name).trim()) {
            return { departmentId: null, unmapped: false };
        }
        const key = normalizeName(String(name));
        const id = byName.get(key);
        if (id)
            return { departmentId: id, unmapped: false };
        unmapped.add(String(name).trim());
        return { departmentId: null, unmapped: true };
    };
    return {
        resolve,
        unmappedNames: () => [...unmapped].sort(),
    };
}
//# sourceMappingURL=departmentResolver.js.map