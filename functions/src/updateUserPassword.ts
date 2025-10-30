import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

interface UpdatePasswordData {
  userId: string;
  email: string;
  newPassword: string;
}

/**
 * Validates an email address
 * @param email The email to validate
 * @returns true if email is valid, false otherwise
 */
function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  
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
export const updateUserPassword = functions.https.onCall(async (data: UpdatePasswordData, context) => {
  try {
    // Check if the caller is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated to update passwords'
      );
    }

    // Get the calling user's data from Firestore to check permission level
    const db = admin.firestore();
    const callingUserDoc = await db.collection('users').doc(context.auth.uid).get();
    const callingUserData = callingUserDoc.data();
    
    // Only Level 1 (Superadmin) can reset passwords
    if (!callingUserData || callingUserData.permissionLevel !== 1) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Only Superadmin (Level 1) can update user passwords'
      );
    }
  } catch (error) {
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError(
      'internal',
      'Error checking permissions',
      error instanceof Error ? error.message : undefined
    );
  }

  try {
    // Log incoming data for debugging
    console.log('Received update password request:', {
      userId: data.userId,
      email: data.email,
      passwordLength: data.newPassword?.length
    });

    // Validate input
    if (!data.userId || !data.email || !data.newPassword) {
      const missingFields = [];
      if (!data.userId) missingFields.push('userId');
      if (!data.email) missingFields.push('email');
      if (!data.newPassword) missingFields.push('newPassword');

      throw new functions.https.HttpsError(
        'invalid-argument',
        `Missing required fields: ${missingFields.join(', ')}`
      );
    }

    // Clean and validate email
    const cleanEmail = data.email.trim().toLowerCase();
    if (!isValidEmail(cleanEmail)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        `Invalid email format: ${cleanEmail}`
      );
    }

    // Validate password length
    if (data.newPassword.length < 6) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Password must be at least 6 characters long'
      );
    }

    try {
      // First verify the user exists
      const userRecord = await admin.auth().getUser(data.userId);
      console.log('Found user:', userRecord.uid);
      
      // Verify email matches
      if (userRecord.email?.toLowerCase() !== cleanEmail) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          `Email does not match user record. Expected: ${userRecord.email}, Got: ${cleanEmail}`
        );
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
    } catch (error) {
      console.error('Error in Firebase Auth operations:', error);
      
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      if (error instanceof Error && 'code' in error) {
        const authError = error as { code: string };
        if (authError.code === 'auth/user-not-found') {
          throw new functions.https.HttpsError(
            'not-found',
            'User not found'
          );
        }
        if (authError.code === 'auth/invalid-password') {
          throw new functions.https.HttpsError(
            'invalid-argument',
            'Invalid password format'
          );
        }
      }

      throw new functions.https.HttpsError(
        'internal',
        'Error updating user password',
        error instanceof Error ? error.message : undefined
      );
    }
  } catch (error) {
    console.error('Error in updateUserPassword:', error);
    
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      'Error updating user password',
      error instanceof Error ? error.message : undefined
    );
  }
});
