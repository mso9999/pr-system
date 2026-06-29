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
exports.runHrEmployeeSyncNow = exports.nightlyHrEmployeeSync = void 0;
/**
 * Nightly incremental HR → PR sync.
 *
 *   nightlyHrEmployeeSync  — scheduled (daily 02:00 Africa/Maseru). Pulls
 *                            only rows HR has updated since the last cursor.
 *                            Cannot detect departures — see
 *                            weeklyHrReconciliation.
 *   runHrEmployeeSyncNow   — callable (admin-only) for ad-hoc incremental
 *                            runs from the admin UI.
 */
const functions = __importStar(require("firebase-functions"));
const hrEmployeeSyncCore_1 = require("./hrEmployeeSyncCore");
exports.nightlyHrEmployeeSync = functions
    .runWith({ timeoutSeconds: 540, memory: "512MB" })
    .pubsub.schedule("0 2 * * *") // daily at 02:00
    .timeZone("Africa/Maseru")
    .onRun(async () => {
    console.log("[hrSync] nightlyHrEmployeeSync starting");
    try {
        const report = await (0, hrEmployeeSyncCore_1.runIncrementalSync)();
        console.log("[hrSync] nightlyHrEmployeeSync done:", report.totals);
    }
    catch (err) {
        console.error("[hrSync] nightlyHrEmployeeSync failed:", err);
    }
    return null;
});
exports.runHrEmployeeSyncNow = functions
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
        const report = await (0, hrEmployeeSyncCore_1.runIncrementalSync)();
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
//# sourceMappingURL=syncHrEmployees.js.map