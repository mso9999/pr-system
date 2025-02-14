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
 */
exports.updateUserPassword = functions.https.onCall(async (data, context) => {
    var _a, _b, _c;
    // Check if the caller is authenticated and has admin privileges
    if (!((_a = context.auth) === null || _a === void 0 ? void 0 : _a.token.admin)) {
        throw new functions.https.HttpsError('permission-denied', 'Only admins can update user passwords');
    }
    try {
        // Log incoming data for debugging
        console.log('Received update password request:', {
            userId: data.userId,
            email: data.email,
            passwordLength: (_b = data.newPassword) === null || _b === void 0 ? void 0 : _b.length
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
        try {
            // First verify the user exists
            const userRecord = await admin.auth().getUser(data.userId);
            console.log('Found user:', userRecord.uid);
            // Verify email matches
            if (((_c = userRecord.email) === null || _c === void 0 ? void 0 : _c.toLowerCase()) !== cleanEmail) {
                throw new functions.https.HttpsError('invalid-argument', `Email does not match user record. Expected: ${userRecord.email}, Got: ${cleanEmail}`);
            }
            // Update the user's password
            await admin.auth().updateUser(data.userId, {
                password: data.newPassword
            });
            console.log(`Successfully updated password for user: ${data.userId}`);
            return {
                success: true,
                message: 'Password updated successfully'
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
                    throw new functions.https.HttpsError('not-found', 'User not found');
                }
                if (authError.code === 'auth/invalid-password') {
                    throw new functions.https.HttpsError('invalid-argument', 'Invalid password format');
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