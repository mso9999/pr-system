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
exports.reconcileDepartmentCatalog = exports.runDepartmentCatalogSyncNow = exports.nightlyDepartmentCatalogSync = void 0;
/**
 * Department catalog sync triggers.
 *
 *   nightlyDepartmentCatalogSync  — scheduled (daily 01:00 Africa/Maseru).
 *                                   Runs BEFORE the 02:00 employee sync so
 *                                   the resolver has a fresh catalog.
 *   runDepartmentCatalogSyncNow   — callable (admin-only), incremental.
 *   reconcileDepartmentCatalog    — callable (admin-only), full + tombstone.
 */
const functions = __importStar(require("firebase-functions"));
const departmentCatalogSyncCore_1 = require("./departmentCatalogSyncCore");
const hrEmployeeSyncCore_1 = require("./hrEmployeeSyncCore");
function summarize(r) {
    const t = r.totals;
    return [
        `pulled ${t.pulled}`,
        `created ${t.created}`,
        `updated ${t.updated}`,
        `unchanged ${t.unchanged}`,
        t.tombstoned ? `tombstoned ${t.tombstoned}` : null,
        t.prNativeUntouched ? `pr-native untouched ${t.prNativeUntouched}` : null,
        t.unmappedOrgs ? `unmapped orgs ${t.unmappedOrgs}` : null,
        t.errors ? `errors ${t.errors}` : null,
    ]
        .filter(Boolean)
        .join(", ");
}
exports.nightlyDepartmentCatalogSync = functions
    .runWith({ timeoutSeconds: 540, memory: "512MB" })
    .pubsub.schedule("0 1 * * *") // daily at 01:00
    .timeZone("Africa/Maseru")
    .onRun(async () => {
    console.log("[hrDeptSync] nightlyDepartmentCatalogSync starting");
    try {
        const report = await (0, departmentCatalogSyncCore_1.runCatalogSync)({ full: true });
        console.log("[hrDeptSync] nightlyDepartmentCatalogSync done:", summarize(report));
    }
    catch (err) {
        console.error("[hrDeptSync] nightlyDepartmentCatalogSync failed:", err);
    }
    return null;
});
exports.runDepartmentCatalogSyncNow = functions
    .runWith({ timeoutSeconds: 540, memory: "512MB" })
    .https.onCall(async (_data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Sign-in required");
    }
    try {
        await (0, hrEmployeeSyncCore_1.assertAdmin)(context.auth.uid);
    }
    catch (err) {
        throw new functions.https.HttpsError("permission-denied", err instanceof Error ? err.message : String(err));
    }
    try {
        const report = await (0, departmentCatalogSyncCore_1.runCatalogSync)({ full: false });
        return {
            success: true,
            totals: report.totals,
            summary: summarize(report),
            unmappedOrgs: report.unmappedOrgs,
            errors: report.errors.slice(0, 25),
        };
    }
    catch (err) {
        throw new functions.https.HttpsError("internal", err instanceof Error ? err.message : String(err));
    }
});
exports.reconcileDepartmentCatalog = functions
    .runWith({ timeoutSeconds: 540, memory: "512MB" })
    .https.onCall(async (_data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Sign-in required");
    }
    try {
        await (0, hrEmployeeSyncCore_1.assertAdmin)(context.auth.uid);
    }
    catch (err) {
        throw new functions.https.HttpsError("permission-denied", err instanceof Error ? err.message : String(err));
    }
    try {
        const report = await (0, departmentCatalogSyncCore_1.runCatalogSync)({ full: true });
        return {
            success: true,
            totals: report.totals,
            summary: summarize(report),
            unmappedOrgs: report.unmappedOrgs,
            prNativeUntouched: report.prNativeUntouched.slice(0, 50),
            errors: report.errors.slice(0, 25),
        };
    }
    catch (err) {
        throw new functions.https.HttpsError("internal", err instanceof Error ? err.message : String(err));
    }
});
//# sourceMappingURL=departmentCatalogSync.js.map