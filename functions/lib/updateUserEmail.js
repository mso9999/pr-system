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
exports.updateUserEmail = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const ADMIN_LEVEL = 1;
const USER_ADMIN_LEVEL = 8;
/**
 * Cloud Function to update a user's email in both Firebase Auth and Firestore.
 * Only Superadmin (Level 1) or IT Support (Level 8) can update user emails.
 */
exports.updateUserEmail = functions.https.onCall(async (data, context) => {
    // Check if the caller is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated to update emails');
    }
    const db = admin.firestore();
    // Get the calling user's data from Firestore to check permission level
    // (Don't rely on custom claims as they may not be set)
    let callingUserPermissionLevel;
    try {
        const callingUserDoc = await db.collection('users').doc(context.auth.uid).get();
        const callingUserData = callingUserDoc.data();
        callingUserPermissionLevel = callingUserData === null || callingUserData === void 0 ? void 0 : callingUserData.permissionLevel;
        // Only Level 1 (Superadmin) or Level 8 (IT Support/User Admin) can update emails
        if (!callingUserData || (callingUserPermissionLevel !== ADMIN_LEVEL && callingUserPermissionLevel !== USER_ADMIN_LEVEL)) {
            throw new functions.https.HttpsError('permission-denied', 'Only Superadmin (Level 1) or IT Support (Level 8) can update user emails');
        }
    }
    catch (error) {
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', 'Error checking permissions', error instanceof Error ? error.message : undefined);
    }
    // Validate required fields
    if (!data.userId || !data.newEmail) {
        const missingFields = [];
        if (!data.userId)
            missingFields.push('userId');
        if (!data.newEmail)
            missingFields.push('newEmail');
        throw new functions.https.HttpsError('invalid-argument', `Missing required fields: ${missingFields.join(', ')}`);
    }
    // Clean and validate email
    const cleanEmail = data.newEmail.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
        throw new functions.https.HttpsError('invalid-argument', `Invalid email format: ${cleanEmail}`);
    }
    // If caller is IT Support (Level 8), prevent updating superadmin (Level 1) emails
    if (callingUserPermissionLevel === USER_ADMIN_LEVEL) {
        const targetUserDoc = await db.collection('users').doc(data.userId).get();
        const targetUserData = targetUserDoc.data();
        if ((targetUserData === null || targetUserData === void 0 ? void 0 : targetUserData.permissionLevel) === ADMIN_LEVEL) {
            throw new functions.https.HttpsError('permission-denied', 'IT Support cannot update emails for Superadmin accounts');
        }
    }
    try {
        console.log('Received update email request:', {
            userId: data.userId,
            newEmail: cleanEmail,
            calledBy: context.auth.uid
        });
        // First check if user exists in Firebase Auth
        let authUserExists = true;
        try {
            await admin.auth().getUser(data.userId);
        }
        catch (getUserError) {
            if (getUserError.code === 'auth/user-not-found') {
                authUserExists = false;
                console.log(`User ${data.userId} not found in Auth - will create during email update`);
            }
            else {
                throw getUserError;
            }
        }
        // Check if the new email is already in use by another account
        try {
            const existingUser = await admin.auth().getUserByEmail(cleanEmail);
            if (existingUser.uid !== data.userId) {
                throw new functions.https.HttpsError('already-exists', `Email ${cleanEmail} is already in use by another account`);
            }
        }
        catch (error) {
            if (error.code !== 'auth/user-not-found' && !(error instanceof functions.https.HttpsError)) {
                throw error;
            }
            // Email not in use - good to proceed
        }
        if (authUserExists) {
            // Update email in Firebase Auth
            await admin.auth().updateUser(data.userId, {
                email: cleanEmail
            });
            console.log(`Updated email in Firebase Auth for user: ${data.userId}`);
        }
        else {
            // User doesn't exist in Auth - get their Firestore data and create them
            const firestoreUserDoc = await db.collection('users').doc(data.userId).get();
            if (!firestoreUserDoc.exists) {
                throw new functions.https.HttpsError('not-found', 'User not found in Firestore');
            }
            const firestoreUserData = firestoreUserDoc.data();
            const displayName = `${(firestoreUserData === null || firestoreUserData === void 0 ? void 0 : firestoreUserData.firstName) || ''} ${(firestoreUserData === null || firestoreUserData === void 0 ? void 0 : firestoreUserData.lastName) || ''}`.trim();
            // Create user in Auth with a temporary password (admin will need to reset)
            await admin.auth().createUser({
                uid: data.userId,
                email: cleanEmail,
                emailVerified: false,
                disabled: false,
                displayName: displayName || undefined
            });
            console.log(`Created new Auth account for user: ${data.userId} with email: ${cleanEmail}`);
        }
        // Update email in Firestore
        await db.doc(`users/${data.userId}`).update({
            email: cleanEmail,
            updatedAt: new Date().toISOString()
        });
        console.log(`Updated email in Firestore for user: ${data.userId}`);
        return {
            success: true,
            message: authUserExists
                ? 'Email updated successfully in both Auth and Firestore'
                : 'Email updated in Firestore and new Auth account created (password reset required)'
        };
    }
    catch (error) {
        console.error('Error updating user email:', error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        if (error instanceof Error && 'code' in error) {
            const authError = error;
            if (authError.code === 'auth/email-already-exists') {
                throw new functions.https.HttpsError('already-exists', 'This email is already in use by another account');
            }
            if (authError.code === 'auth/invalid-email') {
                throw new functions.https.HttpsError('invalid-argument', 'Invalid email format');
            }
        }
        throw new functions.https.HttpsError('internal', 'Failed to update user email', error instanceof Error ? error.message : undefined);
    }
});
//# sourceMappingURL=updateUserEmail.js.map