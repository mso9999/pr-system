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
exports.authUserCreated = void 0;
/**
 * Auth onCreate audit logger.
 *
 * Fires whenever a Firebase Auth user is created (admin SDK, console,
 * or normal sign-up). Writes a record to `userCreationAudit/<uid>`
 * with the provider, email, displayName, and creation time so we have
 * a forensic trail of every Auth account ever created.
 *
 * Anonymous Auth accounts (no email AND no provider data) are
 * deliberately NOT logged — the project is shared with 1PWR AM which
 * uses anonymous auth and would flood this collection.
 *
 * This is write-only. It does NOT block, modify, or delete the user.
 */
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const db = admin.firestore();
exports.authUserCreated = functions.auth.user().onCreate(async (user) => {
    try {
        const isAnonymous = !user.email && (!user.providerData || user.providerData.length === 0);
        if (isAnonymous)
            return;
        const providerIds = (user.providerData || []).map((p) => p.providerId);
        const record = {
            uid: user.uid,
            email: user.email || null,
            emailVerified: user.emailVerified,
            displayName: user.displayName || null,
            phoneNumber: user.phoneNumber || null,
            providerIds,
            disabled: user.disabled,
            createdAt: user.metadata.creationTime || new Date().toISOString(),
            observedAt: new Date().toISOString(),
        };
        await db
            .collection("userCreationAudit")
            .doc(user.uid)
            .set(record, { merge: true });
    }
    catch (e) {
        console.error("authUserCreated logger failed:", e);
    }
});
//# sourceMappingURL=authUserCreated.js.map