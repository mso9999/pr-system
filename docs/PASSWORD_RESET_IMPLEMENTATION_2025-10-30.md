# Password Reset Implementation
**Date:** October 30, 2025  
**Status:** ✅ Completed and Deployed

## Overview
Implemented self-contained password reset functionality within the PR System app, allowing Superadmin and IT Support users to reset passwords for users without requiring access to the Firebase Console.

## Business Requirement
User management should be self-contained within the PR System application. Superadmin users need the ability to reset user passwords directly from the User Management interface without manual intervention in Firebase. IT Support (User Administrator, Permission Level 8) should also be able to reset passwords for all users except Superadmins.

## Implementation Details

### Backend: Firebase Cloud Function
**File:** `functions/src/updateUserPassword.ts`

Created a v1 callable Cloud Function with the following features:
- **Authentication Required:** Caller must be authenticated
- **Authorization:** Superadmin (Permission Level 1) and IT Support (Permission Level 8) can reset passwords
- **Restriction:** IT Support cannot reset passwords for Superadmin accounts (Level 1)
- **Email Validation:** Validates email format and ensures it matches the user record
- **Password Validation:** Minimum 6 characters (Firebase Auth requirement)
- **Audit Logging:** Console logs for tracking password reset operations

```typescript
export const updateUserPassword = functions.https.onCall(async (data: UpdatePasswordData, context) => {
  // Verify caller is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  // Verify caller is Superadmin or IT Support
  const callingUserDoc = await db.collection('users').doc(context.auth.uid).get();
  const callingUserData = callingUserDoc.data();
  const callingUserPermissionLevel = callingUserData?.permissionLevel;
  if (!callingUserData || (callingUserPermissionLevel !== 1 && callingUserPermissionLevel !== 8)) {
    throw new functions.https.HttpsError('permission-denied', 'Only Superadmin (Level 1) or IT Support (Level 8) can update passwords');
  }
  
  // If caller is IT Support, prevent resetting superadmin passwords
  if (callingUserPermissionLevel === 8) {
    const targetUserDoc = await db.collection('users').doc(data.userId).get();
    const targetUserData = targetUserDoc.data();
    if (targetUserData?.permissionLevel === 1) {
      throw new functions.https.HttpsError('permission-denied', 'IT Support cannot reset passwords for Superadmin accounts');
    }
  }

  // Update password
  await admin.auth().updateUser(data.userId, { password: data.newPassword });
});
```

### Frontend: User Management Integration
**File:** `src/services/auth.ts`

Added `updateUserPassword` function that calls the Cloud Function:

```typescript
export const updateUserPassword = async (
  userId: string,
  email: string,
  newPassword: string
): Promise<void> => {
  const updatePasswordFn = httpsCallable(functions, 'updateUserPassword');
  await updatePasswordFn({ userId, email, newPassword });
};
```

**File:** `src/pages/UserManagement.tsx`

Integrated password reset into the user edit dialog with:
- Password field (optional - only shown when editing existing users)
- Minimum 6 character validation
- Clear visual feedback on success/failure
- Automatic clearing after successful reset

## Security Features
1. **Caller Authentication:** Cloud Function verifies the caller is logged in
2. **Permission Check:** Only users with `permissionLevel: 1` (Superadmin) or `permissionLevel: 8` (IT Support) can reset passwords
3. **Superadmin Protection:** IT Support cannot reset passwords for Superadmin accounts (Level 1)
4. **User Verification:** Validates that the email matches the user record
5. **Secure Transport:** All communication via HTTPS
6. **No Password Storage:** Password is directly passed to Firebase Auth API

## Deployment Process

### Issue Resolution
Encountered several deployment challenges:

1. **Node.js Runtime Upgrade**
   - Error: "Runtime Node.js 18 was decommissioned on 2025-10-30"
   - Solution: Updated `functions/package.json` to use Node.js 20

2. **Function Version Conflict**
   - Error: "Functions cannot be downgraded from GCFv2 to GCFv1"
   - Solution: Deleted existing v2 function, redeployed as v1

3. **Production Deployment**
   ```bash
   firebase deploy --only functions:updateUserPassword
   ```

### Final Configuration
- **Runtime:** Node.js 20
- **Function Type:** Firebase v1 callable function
- **Region:** us-central1
- **Trigger:** HTTPS callable
- **Export:** Properly exported in `functions/src/index.ts`

## Testing
✅ Superadmin can reset passwords for any user  
✅ IT Support can reset passwords for all users except Superadmins  
✅ IT Support cannot reset Superadmin passwords (blocked by backend and frontend)  
✅ Non-authorized users cannot access the function  
✅ Password validation prevents weak passwords  
✅ Email validation prevents mismatches  
✅ Users can log in with new password immediately

## Usage
1. Navigate to User Management as Superadmin or IT Support
2. Click the key icon (Reset Password) on any user
3. Enter a new password (min 6 characters) or use the generated random password
4. Click "Reset Password"
5. Password is immediately updated in Firebase Auth
6. Note: IT Support will see an error if attempting to reset a Superadmin password

## Files Modified
- `functions/src/updateUserPassword.ts` - New Cloud Function
- `functions/src/index.ts` - Export function
- `functions/package.json` - Node.js 20 runtime
- `src/services/auth.ts` - Frontend integration
- `src/pages/UserManagement.tsx` - UI integration

## Future Enhancements
- Consider adding password strength requirements (uppercase, numbers, special chars)
- Add option to force password change on next login
- Email notification to user when password is reset
- Audit trail in Firestore for password reset events

## Related Issues
- Issue #26: Production URL Called Despite Emulator Configuration (resolved by production deployment)
- Issue #25: Node.js 18 Decommissioning
- Issue #24: GCFv2 to GCFv1 Downgrade Error

