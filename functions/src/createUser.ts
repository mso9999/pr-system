import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

export interface CreateUserData {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    department: string;
    organization: string;
    permissionLevel: number;
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

    try {
        const userRecord = await admin.auth().createUser({
            email: data.email,
            password: data.password,
            displayName: `${data.firstName} ${data.lastName}`
        });

        await admin.auth().setCustomUserClaims(userRecord.uid, {
            permissionLevel: requestedPermissionLevel
        });

        const userDoc = {
            id: userRecord.uid,
            email: data.email,
            firstName: data.firstName,
            lastName: data.lastName,
            department: data.department,
            organization: data.organization,
            isActive: true,
            permissionLevel: requestedPermissionLevel,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        await db.doc(`users/${userRecord.uid}`).set(userDoc);

        return {
            success: true,
            user: userDoc
        };
    } catch (error) {
        console.error('Error creating user:', error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', 'Failed to create user', error instanceof Error ? error.message : undefined);
    }
});
