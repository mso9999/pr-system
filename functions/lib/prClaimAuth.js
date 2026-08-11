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
exports.prCallerActions = prCallerActions;
exports.callerHasPrAction = callerHasPrAction;
exports.requirePrAction = requirePrAction;
const functions = __importStar(require("firebase-functions"));
/** Accepts either callable context.auth ({uid, token}) or a decoded token. */
function tokenOf(auth) {
    const maybeWrapped = auth;
    if (maybeWrapped.token && typeof maybeWrapped.token === 'object') {
        return maybeWrapped.token;
    }
    return auth;
}
function prCallerActions(auth) {
    var _a, _b;
    if (!auth)
        return new Set();
    const token = tokenOf(auth);
    if (token.nexus_sso !== true)
        return new Set();
    if (String((_a = token.targetSystem) !== null && _a !== void 0 ? _a : '') !== 'pr')
        return new Set();
    if (!token.privilegeVersion)
        return new Set();
    const raw = (_b = token.effectivePrivilege) === null || _b === void 0 ? void 0 : _b.actions;
    if (!Array.isArray(raw))
        return new Set();
    return new Set(raw.map(String));
}
function callerHasPrAction(auth, ...actions) {
    const owned = prCallerActions(auth);
    return actions.some((a) => owned.has(a));
}
/**
 * Require one of the given actions; throws HttpsError('permission-denied')
 * with the privilege-denial contract payload in details.
 */
function requirePrAction(auth, description, ...actions) {
    if (!auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
    }
    const owned = prCallerActions(auth);
    if (actions.some((a) => owned.has(a))) {
        return owned;
    }
    throw new functions.https.HttpsError('permission-denied', `Your PR access does not allow you to ${description}.`, {
        code: 'privilege_denied',
        system: 'pr',
        action: description,
        assigned: [...owned],
        required: actions,
        resolution: 'Ask your country HR team or the Nexus/IS&T User Administrator to correct the assignment, then sign out and relaunch PR from Nexus.',
    });
}
//# sourceMappingURL=prClaimAuth.js.map