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
exports.updateUserPassword = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const prClaimAuth_1 = require("./prClaimAuth");
/**
 * Validates an email address
 * @param email The email to validate
 * @returns true if email is valid, false otherwise
 */
function isValidEmail(email) {
    if (!email || typeof email !== 'string')
        return false;
    // Trim and convert to lowercase
    email = email.trim().toLowerCase();
    // Basic email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}
/**
 * Cloud Function to update a user's password in Firebase Auth
 * Using v1 onCall with CORS support
 */
exports.updateUserPassword = functions.https.onCall(async (data, context) => {
    var _a, _b, _c, _d, _e, _f, _g;
    // Check if the caller is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated to update passwords');
    }
    // Claim-only: password resets need the signed manage_pr_users grant
    // (legacy level 8) or full PR administration (legacy level 1). The signed
    // Nexus claim is the sole authority — Firestore permissionLevel is no
    // longer consulted for authorization.
    const db = admin.firestore();
    (0, prClaimAuth_1.requirePrAction)(context.auth, 'reset user passwords', 'manage_pr_users', 'administer_pr');
    const callerIsAdmin = (0, prClaimAuth_1.callerHasPrAction)(context.auth, 'administer_pr');
    try {
        // Log incoming data for debugging
        console.log('Received update password request:', {
            userId: data.userId,
            email: data.email,
            passwordLength: (_a = data.newPassword) === null || _a === void 0 ? void 0 : _a.length
        });
        // Validate input
        if (!data.userId || !data.email || !data.newPassword) {
            const missingFields = [];
            if (!data.userId)
                missingFields.push('userId');
            if (!data.email)
                missingFields.push('email');
            if (!data.newPassword)
                missingFields.push('newPassword');
            throw new functions.https.HttpsError('invalid-argument', `Missing required fields: ${missingFields.join(', ')}`);
        }
        // Clean and validate email
        const cleanEmail = data.email.trim().toLowerCase();
        if (!isValidEmail(cleanEmail)) {
            throw new functions.https.HttpsError('invalid-argument', `Invalid email format: ${cleanEmail}`);
        }
        // Validate password length
        if (data.newPassword.length < 6) {
            throw new functions.https.HttpsError('invalid-argument', 'Password must be at least 6 characters long');
        }
        // A non-administrator user manager cannot reset an administrator's
        // password. The target's level is read from the nexus_users assignment
        // record (display data, not the caller's authority source).
        if (!callerIsAdmin) {
            const targetNexusDoc = await db.collection('nexus_users').doc(data.userId).get();
            const targetLevel = Number((_e = (_d = (_c = (_b = targetNexusDoc.data()) === null || _b === void 0 ? void 0 : _b.systemAccess) === null || _c === void 0 ? void 0 : _c.pr) === null || _d === void 0 ? void 0 : _d.permissionLevel) !== null && _e !== void 0 ? _e : 0);
            if (targetLevel === 1) {
                throw new functions.https.HttpsError('permission-denied', 'Only PR administrators can reset passwords for administrator accounts');
            }
        }
        try {
            let userRecord;
            let userCreated = false;
            // Try to get the user - if they don't exist, create them
            try {
                userRecord = await admin.auth().getUser(data.userId);
                console.log('Found existing user:', userRecord.uid);
            }
            catch (getUserError) {
                // If user doesn't exist, create them
                if (getUserError.code === 'auth/user-not-found') {
                    console.log(`User ${data.userId} not found in Auth, creating new account...`);
                    // Verify the user exists in Firestore first
                    const firestoreUserDoc = await db.collection('users').doc(data.userId).get();
                    if (!firestoreUserDoc.exists) {
                        throw new functions.https.HttpsError('not-found', 'User not found in Firestore. Cannot create Auth account.');
                    }
                    const firestoreUserData = firestoreUserDoc.data();
                    const firestoreEmail = (_f = firestoreUserData === null || firestoreUserData === void 0 ? void 0 : firestoreUserData.email) === null || _f === void 0 ? void 0 : _f.toLowerCase().trim();
                    // Verify email matches
                    if (firestoreEmail !== cleanEmail) {
                        throw new functions.https.HttpsError('invalid-argument', `Email does not match Firestore record. Expected: ${firestoreEmail}, Got: ${cleanEmail}`);
                    }
                    // Create the user in Firebase Auth
                    userRecord = await admin.auth().createUser({
                        uid: data.userId,
                        email: cleanEmail,
                        emailVerified: false,
                        password: data.newPassword,
                        disabled: false
                    });
                    userCreated = true;
                    console.log(`Created new Auth account for user: ${data.userId}`);
                }
                else {
                    throw getUserError;
                }
            }
            // If user already exists, verify email matches
            if (!userCreated && ((_g = userRecord.email) === null || _g === void 0 ? void 0 : _g.toLowerCase()) !== cleanEmail) {
                throw new functions.https.HttpsError('invalid-argument', `Email does not match user record. Expected: ${userRecord.email}, Got: ${cleanEmail}`);
            }
            // If user was just created, password is already set, otherwise update it
            if (!userCreated) {
                await admin.auth().updateUser(data.userId, {
                    password: data.newPassword
                });
                console.log(`Successfully updated password for user: ${data.userId}`);
            }
            else {
                console.log(`Password set for newly created user: ${data.userId}`);
            }
            return {
                success: true,
                message: userCreated === true
                    ? 'User account created and password set successfully'
                    : 'Password updated successfully'
            };
        }
        catch (error) {
            console.error('Error in Firebase Auth operations:', error);
            if (error instanceof functions.https.HttpsError) {
                throw error;
            }
            if (error instanceof Error && 'code' in error) {
                const authError = error;
                if (authError.code === 'auth/user-not-found') {
                    throw new functions.https.HttpsError('not-found', 'User not found in Firebase Auth');
                }
                if (authError.code === 'auth/invalid-password') {
                    throw new functions.https.HttpsError('invalid-argument', 'Invalid password format');
                }
                if (authError.code === 'auth/email-already-exists') {
                    throw new functions.https.HttpsError('already-exists', 'Email already exists in Firebase Auth');
                }
            }
            throw new functions.https.HttpsError('internal', 'Error updating user password', error instanceof Error ? error.message : undefined);
        }
    }
    catch (error) {
        console.error('Error in updateUserPassword:', error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', 'Error updating user password', error instanceof Error ? error.message : undefined);
    }
});
//# sourceMappingURL=updateUserPassword.js.map