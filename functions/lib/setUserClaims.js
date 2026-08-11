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
exports.setUserClaims = void 0;
const functions = __importStar(require("firebase-functions"));
/**
 * RETIRED (2026-08-11) — this function used to write the legacy PR custom
 * claims (admin / procurement / requester / permissionLevel). Authorization
 * is now claim-only: the signed Nexus `effectivePrivilege` claim, minted at
 * SSO time from the nexus_users.systemAccess.pr assignment, is the sole
 * authority, and no PR component reads the legacy claims anymore.
 *
 * The export is kept (failing closed) so a stale caller gets a clear error
 * instead of silently succeeding against a claim nobody enforces. The
 * function can be fully deleted in a later deploy once no caller remains.
 */
exports.setUserClaims = functions.https.onCall(async () => {
    throw new functions.https.HttpsError('failed-precondition', 'Legacy PR custom claims are retired. PR access is assigned in Nexus ' +
        '(systemAccess.pr.permissionLevel) and signed into the SSO claim at ' +
        'launch; the user relaunches PR from the Nexus portal to receive it.');
});
//# sourceMappingURL=setUserClaims.js.map