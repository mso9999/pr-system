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
exports.createUser = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const prClaimAuth_1 = require("./prClaimAuth");
const ADMIN_LEVEL = 1;
const MIN_REQUESTER_LEVEL = 5;
function normalizePermissionLevel(level) {
    if (typeof level === 'number')
        return level;
    if (typeof level === 'string') {
        const parsed = Number(level);
        if (!Number.isNaN(parsed))
            return parsed;
    }
    return MIN_REQUESTER_LEVEL;
}
function normalizeCountry(code) {
    return typeof code === 'string' ? code.trim().toUpperCase() : '';
}
async function getOrgCountry(db, organizationId) {
    var _a;
    const snap = await db.collection('referenceData_organizations').doc(organizationId).get();
    const c = (_a = snap.data()) === null || _a === void 0 ? void 0 : _a.country;
    return typeof c === 'string' ? c.trim() : undefined;
}
/**
 * Multi-department appointments: PR administrator (administer_pr) or an HR
 * Lead whose signed-off country list covers the organization's country. The
 * HR Lead flags ride on the caller's users/{uid} profile (HR-owned data),
 * never on legacy custom claims.
 */
function callerCanEnableMultiDepartment(caller, orgCountry, callerIsAdmin) {
    if (callerIsAdmin)
        return true;
    if (!(caller === null || caller === void 0 ? void 0 : caller.isHrLead) || !Array.isArray(caller.hrLeadCountryCodes) || caller.hrLeadCountryCodes.length === 0) {
        return false;
    }
    const oc = normalizeCountry(orgCountry);
    if (!oc)
        return false;
    return caller.hrLeadCountryCodes.map((x) => normalizeCountry(x)).includes(oc);
}
function validateMemberships(multi, memberships, departmentFallback) {
    if (!multi) {
        return { department: departmentFallback, multiFlag: false };
    }
    const list = Array.isArray(memberships) ? memberships : [];
    const filled = list.filter((m) => m.departmentId && String(m.departmentId).trim());
    if (filled.length < 2 || filled.length > 3) {
        throw new functions.https.HttpsError('invalid-argument', 'Multi-department mode requires 2 or 3 distinct department assignments.');
    }
    const ids = filled.map((m) => m.departmentId.trim());
    if (new Set(ids).size !== ids.length) {
        throw new functions.https.HttpsError('invalid-argument', 'Departments must be unique.');
    }
    return {
        department: ids[0],
        memberships: filled.map((m) => ({
            departmentId: m.departmentId.trim(),
            isLead: !!m.isLead,
        })),
        multiFlag: true,
    };
}
exports.createUser = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated to manage users.');
    }
    const db = admin.firestore();
    (0, prClaimAuth_1.requirePrAction)(context.auth, 'create user accounts', 'manage_pr_users', 'administer_pr', 'process_procurement_queue');
    // Legacy distinction preserved: procurement officers (legacy level 3) may
    // only create requester-level accounts; user administrators (legacy 8)
    // cannot create administrators or sub-requester levels.
    const callerIsAdmin = (0, prClaimAuth_1.callerHasPrAction)(context.auth, 'administer_pr');
    const callerIsUserAdmin = !callerIsAdmin && (0, prClaimAuth_1.callerHasPrAction)(context.auth, 'manage_pr_users');
    const callerIsProcOnly = !callerIsAdmin && !callerIsUserAdmin && (0, prClaimAuth_1.callerHasPrAction)(context.auth, 'process_procurement_queue');
    const callerDoc = await db.collection('users').doc(context.auth.uid).get();
    const callerData = callerDoc.data();
    const requestedPermissionLevel = normalizePermissionLevel(data.permissionLevel);
    if (!data.email || !data.password || !data.firstName || !data.lastName || !data.organization || !data.department) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required fields.');
    }
    if (callerIsUserAdmin) {
        if (requestedPermissionLevel === ADMIN_LEVEL || requestedPermissionLevel < MIN_REQUESTER_LEVEL) {
            throw new functions.https.HttpsError('permission-denied', 'User Administrators can only create non-administrator accounts at requester level or higher.');
        }
    }
    if (callerIsProcOnly && requestedPermissionLevel !== MIN_REQUESTER_LEVEL) {
        throw new functions.https.HttpsError('permission-denied', 'Procurement officers can only create requester-level accounts.');
    }
    if (requestedPermissionLevel <= 0) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid permission level.');
    }
    const orgCountry = await getOrgCountry(db, data.organization);
    const wantsMulti = !!data.multiDepartmentAppointmentsEnabled;
    let resolvedDepartment = data.department;
    let resolvedMemberships;
    if (wantsMulti) {
        if (callerIsUserAdmin || callerIsProcOnly) {
            throw new functions.https.HttpsError('permission-denied', 'Only administrators or HR Leads may enable multi-department assignments.');
        }
        if (!callerCanEnableMultiDepartment(callerData, orgCountry, callerIsAdmin)) {
            throw new functions.https.HttpsError('permission-denied', 'Only administrators or HR Leads for this organization country may enable multi-department appointments.');
        }
        const v = validateMemberships(true, data.departmentMemberships, data.department);
        resolvedDepartment = v.department;
        resolvedMemberships = v.memberships;
    }
    if (data.isHrLead || (data.hrLeadCountryCodes && data.hrLeadCountryCodes.length > 0)) {
        if (!(0, prClaimAuth_1.callerHasPrAction)(context.auth, 'manage_hr_lead_meta', 'administer_pr')) {
            throw new functions.https.HttpsError('permission-denied', 'Only administrators may assign HR Lead role.');
        }
    }
    // We create the Auth account first, then write Firestore. If the Firestore
    // write (or any post-Auth step) fails we MUST roll back the Auth account,
    // otherwise we leave behind an orphan account that blocks future create
    // attempts for the same email and forces manual reconciliation.
    let createdAuthUid = null;
    try {
        const userRecord = await admin.auth().createUser({
            email: data.email,
            password: data.password,
            displayName: `${data.firstName} ${data.lastName}`
        });
        createdAuthUid = userRecord.uid;
        // Authorization now flows through Nexus: record the PR assignment on
        // nexus_users.systemAccess.pr — the resolver signs it into the user's
        // claim at SSO time. Legacy custom claims are no longer written.
        await db.doc(`nexus_users/${userRecord.uid}`).set({
            email: data.email,
            systemAccess: {
                pr: { enabled: true, permissionLevel: requestedPermissionLevel, role: null }
            }
        }, { merge: true });
        const userDoc = {
            id: userRecord.uid,
            email: data.email,
            firstName: data.firstName,
            lastName: data.lastName,
            department: resolvedDepartment,
            organization: data.organization,
            isActive: true,
            permissionLevel: requestedPermissionLevel,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        if (Array.isArray(data.additionalOrganizations) && data.additionalOrganizations.length > 0) {
            userDoc.additionalOrganizations = data.additionalOrganizations;
        }
        if (wantsMulti && resolvedMemberships) {
            userDoc.multiDepartmentAppointmentsEnabled = true;
            userDoc.departmentMemberships = resolvedMemberships;
        }
        else {
            userDoc.multiDepartmentAppointmentsEnabled = false;
        }
        if (callerIsAdmin) {
            if (data.isHrLead && Array.isArray(data.hrLeadCountryCodes) && data.hrLeadCountryCodes.length > 0) {
                userDoc.isHrLead = true;
                userDoc.hrLeadCountryCodes = data.hrLeadCountryCodes
                    .map((c) => String(c).trim().toUpperCase())
                    .filter(Boolean);
            }
            else {
                userDoc.isHrLead = false;
                userDoc.hrLeadCountryCodes = [];
            }
        }
        else {
            userDoc.isHrLead = false;
            userDoc.hrLeadCountryCodes = [];
        }
        await db.doc(`users/${userRecord.uid}`).set(userDoc);
        return {
            success: true,
            user: userDoc
        };
    }
    catch (error) {
        console.error('Error creating user:', error);
        // Roll back the Auth account if we created it but failed before
        // committing the Firestore profile, to keep the two stores in sync.
        if (createdAuthUid) {
            try {
                await admin.auth().deleteUser(createdAuthUid);
                console.warn(`Rolled back Auth user ${createdAuthUid} after createUser failure`);
            }
            catch (rollbackErr) {
                console.error(`CRITICAL: failed to roll back orphan Auth user ${createdAuthUid}. Manual cleanup required.`, rollbackErr);
            }
        }
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        const err = error;
        const code = err.code || '';
        if (code === 'auth/email-already-exists') {
            throw new functions.https.HttpsError('already-exists', 'This email is already registered in Firebase Authentication. Remove or rename the existing account, or use a different email.');
        }
        if (code === 'auth/invalid-email') {
            throw new functions.https.HttpsError('invalid-argument', 'Invalid email address.');
        }
        if (code === 'auth/invalid-password' || code === 'auth/weak-password') {
            throw new functions.https.HttpsError('invalid-argument', 'Password does not meet Firebase requirements. Try again or contact support.');
        }
        const detail = err.message || (error instanceof Error ? error.message : String(error));
        throw new functions.https.HttpsError('internal', detail && detail !== 'Failed to create user' ? detail : 'Failed to create user');
    }
});
//# sourceMappingURL=createUser.js.map