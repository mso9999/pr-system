import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { callerHasPrAction, requirePrAction } from './prClaimAuth';

export interface UpdateUserData {
    userId: string;
    firstName?: string;
    lastName?: string;
    department?: string;
    organization?: string;
    permissionLevel?: number;
    isActive?: boolean;
    additionalOrganizations?: string[];
}

export const updateUser = functions.https.onCall(async (data: UpdateUserData, context) => {
    try {
        requirePrAction(context.auth, 'update user accounts', 'manage_pr_users', 'administer_pr');

        // Get user reference
        const userRef = admin.firestore().collection('users').doc(data.userId);

        // department, organization, and additionalOrganizations are HR-owned
        // (set in the HR portal, mirrored here by the HR sync). Editing them
        // here never reaches the Nexus resolver — a silent no-op that reads
        // as "role switched but nothing changed" (2026-08-19). They are no
        // longer accepted; only PR-owned profile fields remain editable.
        const updateData: any = {
            firstName: data.firstName,
            lastName: data.lastName,
            isActive: data.isActive
        };

        // Permission-level changes update the Nexus assignment record
        // (nexus_users.systemAccess.pr) — the resolver signs it into the
        // target's next SSO claim. Legacy custom claims are no longer
        // written; the users/{uid} field stays as a display cache only.
        if (data.permissionLevel !== undefined) {
            if (!callerHasPrAction(context.auth, 'administer_pr')) {
                throw new functions.https.HttpsError(
                    'permission-denied',
                    'Only PR administrators can change permission levels'
                );
            }
            await admin.firestore().doc(`nexus_users/${data.userId}`).set({
                systemAccess: {
                    pr: { enabled: true, permissionLevel: data.permissionLevel }
                }
            }, { merge: true });
            updateData.permissionLevel = data.permissionLevel;
        }

        // Update Firestore
        await userRef.update(updateData);

        // Permission changes must reach the target's session: revoke refresh
        // tokens so the next sign-in re-mints via Nexus SSO with the new
        // claim. (The resolver runs in Nexus; PR cannot re-mint directly.)
        if (data.permissionLevel !== undefined || data.isActive !== undefined) {
            try {
                await admin.auth().revokeRefreshTokens(data.userId);
            } catch (revokeError) {
                console.warn('updateUser: revokeRefreshTokens failed (non-fatal):', revokeError);
            }
        }

        return {
            success: true,
            message: 'User updated successfully'
        };
    } catch (error) {
        console.error('Error updating user:', error);
        if (error instanceof functions.https.HttpsError) throw error;
        throw new functions.https.HttpsError('internal', 'Error updating user');
    }
});

export const getUserClaims = functions.https.onCall(async (data: { userId: string }, context) => {
  // Verify that the caller is an admin
  requirePrAction(context.auth, 'inspect user claims', 'manage_pr_users', 'administer_pr');

  try {
    const user = await admin.auth().getUser(data.userId);
    return {
      success: true,
      claims: user.customClaims || {}
    };
  } catch (error) {
    console.error('Error getting user claims:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Error getting user claims'
    );
  }
});
