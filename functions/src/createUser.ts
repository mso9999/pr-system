import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import type { Firestore } from 'firebase-admin/firestore';

export interface DepartmentMembershipInput {
    departmentId: string;
    isLead: boolean;
}

export interface CreateUserData {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    department: string;
    organization: string;
    permissionLevel: number;
    additionalOrganizations?: string[];
    multiDepartmentAppointmentsEnabled?: boolean;
    departmentMemberships?: DepartmentMembershipInput[];
    isHrLead?: boolean;
    hrLeadCountryCodes?: string[];
}

const ADMIN_LEVEL = 1;
const USER_ADMIN_LEVEL = 8;
const MIN_REQUESTER_LEVEL = 5;

function normalizePermissionLevel(level: unknown): number {
    if (typeof level === 'number') return level;
    if (typeof level === 'string') {
        const parsed = Number(level);
        if (!Number.isNaN(parsed)) return parsed;
    }
    return MIN_REQUESTER_LEVEL;
}

function isUserAdminLevel(level: number) {
    return level === USER_ADMIN_LEVEL;
}

function canManageUsers(level: number) {
    return level > 0 && (level <= 4 || isUserAdminLevel(level));
}

function normalizeCountry(code: unknown): string {
    return typeof code === 'string' ? code.trim().toUpperCase() : '';
}

async function getOrgCountry(db: Firestore, organizationId: string): Promise<string | undefined> {
    const snap = await db.collection('referenceData_organizations').doc(organizationId).get();
    const c = snap.data()?.country;
    return typeof c === 'string' ? c.trim() : undefined;
}

function callerCanEnableMultiDepartment(
    caller: FirebaseFirestore.DocumentData | undefined,
    orgCountry: string | undefined
): boolean {
    const level = normalizePermissionLevel(caller?.permissionLevel);
    if (level === ADMIN_LEVEL) return true;
    if (!caller?.isHrLead || !Array.isArray(caller.hrLeadCountryCodes) || caller.hrLeadCountryCodes.length === 0) {
        return false;
    }
    const oc = normalizeCountry(orgCountry);
    if (!oc) return false;
    return caller.hrLeadCountryCodes.map((x: unknown) => normalizeCountry(x)).includes(oc);
}

function validateMemberships(
    multi: boolean,
    memberships: DepartmentMembershipInput[] | undefined,
    departmentFallback: string
): { department: string; memberships?: DepartmentMembershipInput[]; multiFlag: boolean } {
    if (!multi) {
        return { department: departmentFallback, multiFlag: false };
    }
    const list = Array.isArray(memberships) ? memberships : [];
    const filled = list.filter((m) => m.departmentId && String(m.departmentId).trim());
    if (filled.length < 2 || filled.length > 3) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'Multi-department mode requires 2 or 3 distinct department assignments.'
        );
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

export const createUser = functions.https.onCall(async (data: CreateUserData, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated to manage users.');
    }

    const db = admin.firestore();

    const callerDoc = await db.collection('users').doc(context.auth.uid).get();
    const callerData = callerDoc.data();
    const callerPermissionLevel = normalizePermissionLevel(callerData?.permissionLevel);

    if (!canManageUsers(callerPermissionLevel)) {
        throw new functions.https.HttpsError('permission-denied', 'You do not have access to manage users.');
    }

    const requestedPermissionLevel = normalizePermissionLevel(data.permissionLevel);
    if (!data.email || !data.password || !data.firstName || !data.lastName || !data.organization || !data.department) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required fields.');
    }

    if (callerPermissionLevel === USER_ADMIN_LEVEL) {
        if (requestedPermissionLevel === ADMIN_LEVEL || requestedPermissionLevel < MIN_REQUESTER_LEVEL) {
            throw new functions.https.HttpsError(
                'permission-denied',
                'User Administrators can only create non-administrator accounts at requester level or higher.'
            );
        }
    }

    if (requestedPermissionLevel <= 0) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid permission level.');
    }

    const orgCountry = await getOrgCountry(db, data.organization);

    const wantsMulti = !!data.multiDepartmentAppointmentsEnabled;
    let resolvedDepartment = data.department;
    let resolvedMemberships: DepartmentMembershipInput[] | undefined;

    if (wantsMulti) {
        if (callerPermissionLevel === USER_ADMIN_LEVEL) {
            throw new functions.https.HttpsError(
                'permission-denied',
                'User Administrators cannot enable multi-department assignments.'
            );
        }
        if (!callerCanEnableMultiDepartment(callerData, orgCountry)) {
            throw new functions.https.HttpsError(
                'permission-denied',
                'Only administrators or HR Leads for this organization country may enable multi-department appointments.'
            );
        }
        const v = validateMemberships(true, data.departmentMemberships, data.department);
        resolvedDepartment = v.department;
        resolvedMemberships = v.memberships;
    }

    if (data.isHrLead || (data.hrLeadCountryCodes && data.hrLeadCountryCodes.length > 0)) {
        if (callerPermissionLevel !== ADMIN_LEVEL) {
            throw new functions.https.HttpsError('permission-denied', 'Only administrators may assign HR Lead role.');
        }
    }

    // We create the Auth account first, then write Firestore. If the Firestore
    // write (or any post-Auth step) fails we MUST roll back the Auth account,
    // otherwise we leave behind an orphan account that blocks future create
    // attempts for the same email and forces manual reconciliation.
    let createdAuthUid: string | null = null;
    try {
        const userRecord = await admin.auth().createUser({
            email: data.email,
            password: data.password,
            displayName: `${data.firstName} ${data.lastName}`
        });
        createdAuthUid = userRecord.uid;

        await admin.auth().setCustomUserClaims(userRecord.uid, {
            permissionLevel: requestedPermissionLevel
        });

        const userDoc: Record<string, unknown> = {
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
        } else {
            userDoc.multiDepartmentAppointmentsEnabled = false;
        }

        if (callerPermissionLevel === ADMIN_LEVEL) {
            if (data.isHrLead && Array.isArray(data.hrLeadCountryCodes) && data.hrLeadCountryCodes.length > 0) {
                userDoc.isHrLead = true;
                userDoc.hrLeadCountryCodes = data.hrLeadCountryCodes
                    .map((c) => String(c).trim().toUpperCase())
                    .filter(Boolean);
            } else {
                userDoc.isHrLead = false;
                userDoc.hrLeadCountryCodes = [];
            }
        } else {
            userDoc.isHrLead = false;
            userDoc.hrLeadCountryCodes = [];
        }

        await db.doc(`users/${userRecord.uid}`).set(userDoc);

        return {
            success: true,
            user: userDoc
        };
    } catch (error) {
        console.error('Error creating user:', error);

        // Roll back the Auth account if we created it but failed before
        // committing the Firestore profile, to keep the two stores in sync.
        if (createdAuthUid) {
            try {
                await admin.auth().deleteUser(createdAuthUid);
                console.warn(`Rolled back Auth user ${createdAuthUid} after createUser failure`);
            } catch (rollbackErr) {
                console.error(
                    `CRITICAL: failed to roll back orphan Auth user ${createdAuthUid}. Manual cleanup required.`,
                    rollbackErr
                );
            }
        }

        if (error instanceof functions.https.HttpsError) {
            throw error;
        }

        const err = error as { code?: string; message?: string };
        const code = err.code || '';

        if (code === 'auth/email-already-exists') {
            throw new functions.https.HttpsError(
                'already-exists',
                'This email is already registered in Firebase Authentication. Remove or rename the existing account, or use a different email.'
            );
        }
        if (code === 'auth/invalid-email') {
            throw new functions.https.HttpsError('invalid-argument', 'Invalid email address.');
        }
        if (code === 'auth/invalid-password' || code === 'auth/weak-password') {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'Password does not meet Firebase requirements. Try again or contact support.'
            );
        }

        const detail = err.message || (error instanceof Error ? error.message : String(error));
        throw new functions.https.HttpsError(
            'internal',
            detail && detail !== 'Failed to create user' ? detail : 'Failed to create user'
        );
    }
});
