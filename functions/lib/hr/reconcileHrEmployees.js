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
exports.weeklyHrReconciliation = exports.reconcileHrEmployees = void 0;
/**
 * One-time / on-demand HR → PR reconciliation trigger.
 *
 *   reconcileHrEmployees    — callable (admin-only). Runs the full
 *                             reconciliation, persists a report to
 *                             hrReconciliationReports/<ts>, returns totals.
 *   weeklyHrReconciliation  — scheduled (Mondays 06:30 Africa/Maseru).
 *                             Detects departures that the nightly
 *                             incremental sync cannot see.
 */
const functions = __importStar(require("firebase-functions"));
const hrEmployeeSyncCore_1 = require("./hrEmployeeSyncCore");
exports.reconcileHrEmployees = functions
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
        const report = await (0, hrEmployeeSyncCore_1.runReconciliation)({ detectDepartures: true });
        return {
            success: true,
            totals: report.totals,
            reportId: new Date().toISOString().replace(/[:.]/g, "-"),
            unmappedDepartments: report.unmappedDepartments,
            errors: report.errors.slice(0, 25),
        };
    }
    catch (err) {
        throw new functions.https.HttpsError("internal", err instanceof Error ? err.message : String(err));
    }
});
exports.weeklyHrReconciliation = functions
    .runWith({ timeoutSeconds: 540, memory: "512MB" })
    .pubsub.schedule("30 6 * * 1") // Mondays at 06:30
    .timeZone("Africa/Maseru")
    .onRun(async () => {
    console.log("[hrSync] weeklyHrReconciliation starting");
    try {
        const report = await (0, hrEmployeeSyncCore_1.runReconciliation)({ detectDepartures: true });
        console.log("[hrSync] weeklyHrReconciliation done:", report.totals);
    }
    catch (err) {
        console.error("[hrSync] weeklyHrReconciliation failed:", err);
    }
    return null;
});
//# sourceMappingURL=reconcileHrEmployees.js.map