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
exports.hrSmokeTest = exports.refreshUserFromHr = void 0;
/**
 * Per-user refresh from HR (admin-only callable).
 *
 * Looks up one employee by HR employee_id and either updates the matched
 * PR user's HR-owned fields or provisions a new PR account. Useful from
 * the User Management screen's "Refresh from HR" action.
 */
const functions = __importStar(require("firebase-functions"));
const hrEmployeeSyncCore_1 = require("./hrEmployeeSyncCore");
exports.refreshUserFromHr = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Sign-in required");
    }
    try {
        await (0, hrEmployeeSyncCore_1.assertAdmin)(context.auth.uid);
    }
    catch (err) {
        throw new functions.https.HttpsError("permission-denied", err instanceof Error ? err.message : String(err));
    }
    const employeeId = String((data === null || data === void 0 ? void 0 : data.employeeId) || "").trim();
    if (!employeeId) {
        throw new functions.https.HttpsError("invalid-argument", "employeeId is required");
    }
    try {
        const result = await (0, hrEmployeeSyncCore_1.refreshOneUser)(employeeId);
        return Object.assign({ success: true }, result);
    }
    catch (err) {
        throw new functions.https.HttpsError("internal", err instanceof Error ? err.message : String(err));
    }
});
exports.hrSmokeTest = functions.https.onCall(async (_data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Sign-in required");
    }
    try {
        await (0, hrEmployeeSyncCore_1.assertAdmin)(context.auth.uid);
    }
    catch (err) {
        throw new functions.https.HttpsError("permission-denied", err instanceof Error ? err.message : String(err));
    }
    // Lazy import to avoid loading the client at module init for non-HR workloads.
    const { smokeTest } = await Promise.resolve().then(() => __importStar(require("./hrDirectoryClient")));
    return smokeTest();
});
//# sourceMappingURL=refreshUserFromHr.js.map