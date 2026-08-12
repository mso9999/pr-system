/**
 * @fileoverview Authentication Service Implementation
 * @version 1.3.1
 * 
 * Change History:
 * 1.0.0 - Initial implementation of basic auth functions
 * 1.1.0 - Added error handling and user state management
 * 1.2.0 - Improved logging and error messages, refactored to individual exports
 * 1.3.0 - Updated auth service to handle both UID and email-based user lookups
 * 1.3.1 - Updated auth service to normalize organization IDs
 * 
 * Description:
 * This module provides authentication services for the PR System application.
 * It wraps Firebase Authentication functionality with application-specific
 * logic and error handling. Manages user authentication state and provides
 * methods for sign-in, sign-out, and user state management.
 * 
 * Architecture Notes:
 * - Uses Firebase Auth for authentication backend
 * - Integrates with Redux store for state management
 * - Provides error handling and logging for auth operations
 * - Exports individual functions for better tree-shaking
 * 
 * Related Modules:
 * - src/config/firebase.ts: Provides the auth instance
 * - src/store/slices/authSlice.ts: Manages auth state in Redux
 * - src/components/auth/LoginPage.tsx: Uses these functions for user login
 * 
 * Data Flow:
 * 1. User initiates auth action (e.g., login)
 * 2. Auth service calls Firebase Auth
 * 3. Updates Redux store with result
 * 4. UI components react to state changes
 */

import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  AuthErrorCodes,
  onAuthStateChanged,
  getIdToken,
  sendPasswordResetEmail,
  getAuth,
  User as FirebaseUser,
  AuthError
} from 'firebase/auth';

import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  setDoc
} from 'firebase/firestore';

import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../config/firebase';
import { User, UserPermissions } from '../types/user';
import { store } from '../store';
import { setUser, clearUser, setLoading, setError } from '../store/slices/authSlice';
import { normalizeOrganizationId } from '@/utils/organization';
import { hasPrAction } from '@/utils/prPrivilege';

/**
 * Read the signed Nexus `effectivePrivilege` claim (targetSystem 'pr') from
 * the current ID token. Returns null for sessions without one (the
 * ?fallback=1 emergency login), which the app treats as read-only.
 */
const readSignedPrPrivilege = async (): Promise<Record<string, unknown> | null> => {
  const current = getAuth().currentUser;
  if (!current) return null;
  try {
    const tokenResult = await current.getIdTokenResult();
    const claims = tokenResult.claims as Record<string, unknown>;
    if (claims.nexus_sso !== true) return null;
    if (!claims.privilegeVersion) return null;
    // Fresh SSO tokens carry the PR grant at top level (targetSystem 'pr').
    // Refreshed tokens rebuilt from the Auth user record may target another
    // portal launched later; the PR grant then lives in systems.pr.
    let raw: unknown;
    if (String(claims.targetSystem ?? '') === 'pr') {
      raw = claims.effectivePrivilege;
    } else {
      const systems = claims.systems;
      raw = systems && typeof systems === 'object'
        ? (systems as Record<string, unknown>).pr
        : null;
    }
    if (!raw || typeof raw !== 'object') return null;
    return { ...(raw as Record<string, unknown>), version: String(claims.privilegeVersion) };
  } catch (e) {
    console.warn('auth.ts: could not read signed PR privilege from token', e);
    return null;
  }
};

// Check if we're in development mode
const isDevelopment = import.meta.env.MODE === 'development';

// IS&T "View As" — maps Nexus view-as role IDs to PR permission levels.
// Used by getUserDetails to override the displayed permission level when
// an IS&T staff member is previewing the system as another role.
// Write actions are always blocked when viewAs is active.
const VIEW_AS_PERMISSION_MAP: Record<string, number> = {
  requester: 5,        // REQ — Requester
  procurement: 3,      // PROC — Procurement Officer
  approver: 2,         // APPROVER — Senior Approver
  finance_admin: 4,    // FIN_AD — Finance Admin
  finance_approver: 6, // FIN_APPROVER — Finance Approver
  site_manager: 7,     // SITE_MANAGER — Site Manager
};

const VIEW_AS_ROLE_LABELS: Record<string, string> = {
  requester: 'Requester',
  procurement: 'Procurement Officer',
  approver: 'Senior Approver',
  finance_admin: 'Finance Admin',
  finance_approver: 'Finance Approver',
  site_manager: 'Site Manager',
};

let refreshTokenInterval: NodeJS.Timeout | null = null;

const startTokenRefresh = async (user: FirebaseUser) => {
  if (refreshTokenInterval) {
    clearInterval(refreshTokenInterval);
  }

  // Refresh token every 30 minutes. The refreshed ID token carries the
  // current signed Nexus privilege, so re-attach it to the stored user —
  // otherwise role changes in Nexus would only appear after a full re-login.
  refreshTokenInterval = setInterval(async () => {
    try {
      await getIdToken(user, true);
      const fresh = await readSignedPrPrivilege();
      const stored = store.getState().auth.user;
      if (stored && JSON.stringify(stored.privilege ?? null) !== JSON.stringify(fresh)) {
        store.dispatch(setUser({ ...stored, privilege: fresh }));
        console.log('auth.ts: signed PR privilege refreshed from token');
      }
      console.log('auth.ts: Token refreshed successfully');
    } catch (error) {
      console.error('auth.ts: Token refresh failed:', error);
      // Force re-login if token refresh fails
      await signOut();
    }
  }, 30 * 60 * 1000);
};

export const signIn = async (email: string, password: string): Promise<void> => {
  console.log('auth.ts: Attempting sign in');
  try {
    store.dispatch(setLoading(true));
    store.dispatch(setError(null));

    // Normalize email (Firebase Auth is case-insensitive, but normalize for consistency)
    const normalizedEmail = email.trim().toLowerCase();
    console.log('auth.ts: Normalized email:', normalizedEmail, 'from:', email);

    // Sign in with Firebase
    const userCredential = await signInWithEmailAndPassword(getAuth(), normalizedEmail, password);
    console.log('auth.ts: Firebase sign in successful');

    // Get user details from Firestore
    const userDetails = await getUserDetails(userCredential.user.uid);
    if (!userDetails) {
      console.error('auth.ts: User details not found in Firestore');
      throw new Error('User account not found');
    }

    // Start token refresh
    await startTokenRefresh(userCredential.user);

    // Update Redux store
    store.dispatch(setUser(userDetails));
    console.log('auth.ts: Sign in complete');
  } catch (error) {
    console.error('auth.ts: Sign in failed:', error);
    let errorMessage = 'Sign in failed';

    if (error instanceof Error) {
      const authError = error as AuthError;
      console.log('auth.ts: Auth error code:', authError.code);
      switch (authError.code) {
        case AuthErrorCodes.INVALID_PASSWORD:
          errorMessage = 'Invalid password. Please check your password or contact an administrator to reset it.';
          break;
        case AuthErrorCodes.INVALID_CREDENTIAL:
        case 'auth/invalid-credential':
          errorMessage = 'Invalid email or password. If you recently reset your password, please try again. If the problem persists, the account may not exist in Firebase Auth. Contact an administrator.';
          break;
        case AuthErrorCodes.USER_DELETED:
        case 'auth/user-not-found':
          errorMessage = 'Account not found. The account may not exist in Firebase Auth. Please contact an administrator to create the account.';
          break;
        case AuthErrorCodes.TOO_MANY_ATTEMPTS_TRY_LATER:
          errorMessage = 'Too many attempts. Please try again later';
          break;
        case 'auth/user-disabled':
          errorMessage = 'Account is disabled. Please contact an administrator.';
          break;
        default:
          errorMessage = authError.message || 'Sign in failed. Please check your credentials.';
      }
    }

    store.dispatch(setError(errorMessage));
    throw error;
  } finally {
    store.dispatch(setLoading(false));
  }
};

export const signOut = async (): Promise<void> => {
  try {
    await firebaseSignOut(getAuth());
    if (refreshTokenInterval) {
      clearInterval(refreshTokenInterval);
      refreshTokenInterval = null;
    }
    sessionStorage.removeItem('pr_fallback_session');
    sessionStorage.removeItem('pr_relaunch_attempted');
    store.dispatch(clearUser());
    console.log('auth.ts: Sign out successful');
  } catch (error) {
    console.error('auth.ts: Sign out failed:', error);
    throw error;
  }
};

// Phase 2: PR reads identity + permissions from nexus_users/{uid} (canonical)
// and PR-profile fields from users/{uid} (profile extension). If a user has no
// nexus_users doc yet (pre-backfill / drift), falls back to the legacy users-only
// path so nobody gets locked out. Flip READ_NEXUS_IDENTITY to false to roll back.
const READ_NEXUS_IDENTITY = true;

export const getUserDetails = async (uid: string): Promise<User> => {
  try {
    // Profile extension (PR-owned): organization, dept memberships, HR-lead scope,
    // lastWhatsNewSeenAt, etc. Always read if present.
    const prSnap = await getDoc(doc(db, 'users', uid));
    const pr = prSnap.exists() ? prSnap.data() : {};

    let permissionLevel: number;
    let email: string | undefined;
    let firstName: string | undefined;
    let lastName: string | undefined;
    let isActive: boolean | undefined;
    let role: string | undefined;
    let usedNexusIdentity = false;

    if (READ_NEXUS_IDENTITY) {
      // A denied/failed nexus_users read must not break user display — fall
      // back to the legacy users doc (same as when the nexus doc is missing).
      let nexusSnap: Awaited<ReturnType<typeof getDoc>> | null = null;
      try {
        nexusSnap = await getDoc(doc(db, 'nexus_users', uid));
      } catch (nexusReadError) {
        console.warn(`nexus_users read failed for ${uid}, falling back to users doc:`, nexusReadError);
      }
      if (nexusSnap && nexusSnap.exists()) {
        const nx = nexusSnap.data() as Record<string, any>;
        const prAccess = nx?.systemAccess?.pr ?? {};
        const nxPerm = typeof prAccess.permissionLevel === 'number'
          ? prAccess.permissionLevel
          : typeof prAccess.permissionLevel === 'string'
            ? Number(prAccess.permissionLevel) || 5
            : 5;
        const nxEnabled = prAccess.enabled !== false;
        const nxActive = nx?.isActive === true;

        // Gate sign-in: deny if Nexus has disabled PR access.
        if (!nxActive || !nxEnabled) {
          throw new Error('PR access disabled. Contact your Nexus administrator.');
        }

        permissionLevel = nxPerm;
        email = nx.email ?? pr.email;
        firstName = nx.firstName ?? pr.firstName;
        lastName = nx.lastName ?? pr.lastName;
        isActive = true;
        role = pr.role ?? prAccess.role;
        usedNexusIdentity = true;
      }
    }

    if (!usedNexusIdentity) {
      // Legacy fallback: identity + perm come from users/{uid}.
      // R9 Retirement: after 30 days of no fallback hits, remove this path
      // and set READ_NEXUS_IDENTITY permanent (remove the flag).
      console.warn(`[auth.ts] R9 Fallback: nexus_users doc missing for uid=${uid}, using legacy users doc`);
      if (!prSnap.exists()) {
        throw new Error('User not found');
      }
      const userData = pr;
      permissionLevel =
        typeof userData.permissionLevel === 'number'
          ? userData.permissionLevel
          : typeof userData.permissionLevel === 'string'
            ? Number(userData.permissionLevel) || 5
            : 5;
      email = userData.email;
      firstName = userData.firstName;
      lastName = userData.lastName;
      role = userData.role;
      isActive = userData.isActive;
    }

    const userData = pr;

    // If the user's organization is 'Codeium', update it to a default organization
    if (userData.organization === 'Codeium') {
      console.log('Found default organization, updating to 1PWR LESOTHO');
      await updateDoc(doc(db, 'users', uid), {
        organization: '1PWR LESOTHO',
        updatedAt: new Date().toISOString()
      });
      userData.organization = '1PWR LESOTHO';
    }

    // Signed Nexus PR claim — the sole client-side authorization authority.
    // `permissionLevel` above stays as a display/directory value only.
    const privilege = await readSignedPrPrivilege();

    // Self-heal stale sessions (2026-08-12 outage): custom claims never
    // recompute on token refresh, so a session minted before the PR claim
    // existed stays claim-less forever. If this session has no signed claim
    // and is NOT the emergency fallback login, bounce through Nexus SSO once
    // to re-mint. The sessionStorage guard prevents a redirect loop if the
    // resolver legitimately grants nothing.
    if (
      !privilege &&
      sessionStorage.getItem('pr_fallback_session') !== '1' &&
      !sessionStorage.getItem('pr_relaunch_attempted')
    ) {
      sessionStorage.setItem('pr_relaunch_attempted', '1');
      console.warn('auth.ts: no signed PR claim — relaunching via Nexus SSO to re-mint');
      window.location.replace(
        'https://nexus.1pwrafrica.com/sso/authorize?tool=pr&redirect_uri=' +
          encodeURIComponent(window.location.origin + '/dashboard')
      );
      await new Promise(() => {}); // navigation in progress
    }
    if (privilege) {
      sessionStorage.removeItem('pr_relaunch_attempted');
    }

    const claimSubject = { privilege };

    // Map permissions from the signed claim (legacy numeric mapping retired).
    // Unsigned sessions (emergency fallback login) get a read-only set.
    const permissions: UserPermissions = {
      canCreatePR: hasPrAction(claimSubject, 'view_and_request'),
      canApprovePR: hasPrAction(claimSubject, 'approve_and_finance'),
      canProcessPR: hasPrAction(claimSubject, 'process_procurement_queue'),
      canManageUsers: hasPrAction(claimSubject, 'manage_pr_users', 'administer_pr'),
      canViewReports: hasPrAction(
        claimSubject,
        'approve_and_finance',
        'process_procurement_queue',
        'administer_pr',
        'manage_pr_users'
      ),
      approvalLimit: hasPrAction(claimSubject, 'approve_high_value')
        ? Infinity
        : hasPrAction(claimSubject, 'approve_within_finance_limit')
          ? 100000
          : 0
    };

    // IS&T "View As" override: if pr_view_as is set in localStorage, override
    // the permission level for display purposes but block ALL write actions.
    // This lets IS&T see the system as another role would, without being able
    // to actually perform any actions.
    const viewAsRole = localStorage.getItem('pr_view_as');
    if (viewAsRole) {
      const viewAsPerm = VIEW_AS_PERMISSION_MAP[viewAsRole];
      if (viewAsPerm !== undefined) {
        return {
          id: uid,
          email,
          firstName,
          lastName,
          role: VIEW_AS_ROLE_LABELS[viewAsRole] || role,
          organization: userData.organization,
          isActive,
          permissionLevel: viewAsPerm,
          // View As is diagnostic: no signed authority attaches to the preview.
          privilege: null,
          additionalOrganizations: userData.additionalOrganizations || [],
          secondments: Array.isArray(userData.secondments) ? userData.secondments : undefined,
          multiDepartmentAppointmentsEnabled: userData.multiDepartmentAppointmentsEnabled === true,
          departmentMemberships: Array.isArray(userData.departmentMemberships)
            ? userData.departmentMemberships
            : undefined,
          isHrLead: userData.isHrLead === true,
          hrLeadCountryCodes: Array.isArray(userData.hrLeadCountryCodes)
            ? userData.hrLeadCountryCodes.map((c: string) => String(c).toUpperCase())
            : undefined,
          lastWhatsNewSeenAt: typeof userData.lastWhatsNewSeenAt === 'string' ? userData.lastWhatsNewSeenAt : undefined,
          permissions: {
            canCreatePR: false,
            canApprovePR: false,
            canProcessPR: false,
            canManageUsers: false,
            canViewReports: true,
            approvalLimit: 0,
          }
        };
      }
    }

    return {
      id: uid,
      email,
      firstName,
      lastName,
      role,
      organization: userData.organization,
      isActive,
      permissionLevel,
      privilege,
      additionalOrganizations: userData.additionalOrganizations || [],
      secondments: Array.isArray(userData.secondments) ? userData.secondments : undefined,
      multiDepartmentAppointmentsEnabled: userData.multiDepartmentAppointmentsEnabled === true,
      departmentMemberships: Array.isArray(userData.departmentMemberships)
        ? userData.departmentMemberships
        : undefined,
      isHrLead: userData.isHrLead === true,
      hrLeadCountryCodes: Array.isArray(userData.hrLeadCountryCodes)
        ? userData.hrLeadCountryCodes.map((c: string) => String(c).toUpperCase())
        : undefined,
      lastWhatsNewSeenAt: typeof userData.lastWhatsNewSeenAt === 'string' ? userData.lastWhatsNewSeenAt : undefined,
      permissions // Add permissions to user object
    };
  } catch (error) {
    console.error('Error fetching user details:', error);
    throw error;
  }
};

// Helper function to get approval limit based on permission level
function getApprovalLimit(permissionLevel: number): number {
  switch (permissionLevel) {
    case 1: // Admin
      return Infinity;
    case 2: // Approver
      return 1000000;
    case 3: // Procurement
      return 500000;
    case 4: // Finance Admin
      return 100000;
    default:
      return 0;
  }
}

export const getCurrentUser = async (): Promise<User | null> => {
  const user = getAuth().currentUser;
  if (!user) {
    return null;
  }
  return getUserDetails(user.uid);
};

export const initializeAuthListener = (): void => {
  onAuthStateChanged(getAuth(), async (user) => {
    try {
      if (user) {
        const userDetails = await getUserDetails(user.uid);
        if (userDetails) {
          store.dispatch(setUser(userDetails));
          await startTokenRefresh(user);
        } else {
          store.dispatch(setError('User account not found'));
          await signOut();
        }
      } else {
        store.dispatch(clearUser());
      }
    } catch (error) {
      console.error('auth.ts: Auth state change error:', error);
      store.dispatch(setError('Authentication error'));
    }
  });
};

export const resetPassword = async (email: string): Promise<void> => {
  console.log('auth.ts: Attempting password reset');
  try {
    store.dispatch(setLoading(true));
    store.dispatch(setError(null));

    await sendPasswordResetEmail(getAuth(), email);
    console.log('auth.ts: Password reset email sent');
  } catch (error) {
    console.error('auth.ts: Password reset failed:', error);
    let errorMessage = 'Password reset failed';

    if (error instanceof Error) {
      const authError = error as AuthError;
      switch (authError.code) {
        case AuthErrorCodes.USER_DELETED:
          errorMessage = 'Account not found';
          break;
        case AuthErrorCodes.INVALID_EMAIL:
          errorMessage = 'Invalid email address';
          break;
        default:
          errorMessage = authError.message;
      }
    }

    store.dispatch(setError(errorMessage));
    throw error;
  } finally {
    store.dispatch(setLoading(false));
  }
};

/**
 * Updates a user's email address in both Firebase Auth and Firestore
 * @param userId - The user's ID
 * @param newEmail - The new email address
 */
export const updateUserEmail = async (userId: string, newEmail: string): Promise<void> => {
  try {
    const updateUserEmailFunction = httpsCallable(functions, 'updateUserEmail');
    const result = await updateUserEmailFunction({ userId, newEmail });
    
    const response = result.data as {
      success: boolean;
    };

    if (!response.success) {
      throw new Error('Failed to update user email');
    }

    console.log(`Successfully updated email for user ${userId} to ${newEmail}`);
  } catch (error) {
    console.error('Error updating user email:', error);
    throw error;
  }
};

/**
 * Updates a user's password in Firebase Auth
 * @param userId The user's ID
 * @param email The user's email
 * @param newPassword The new password to set
 * @returns A promise that resolves with the result of the operation
 */
export async function updateUserPassword(userId: string, email: string, newPassword: string) {
  try {
    const updatePasswordFunction = httpsCallable(functions, 'updateUserPassword');
    return await updatePasswordFunction({
      userId,
      email,
      newPassword
    });
  } catch (error) {
    console.error('Error updating password:', error);
    throw error;
  }
}

/**
 * Creates a new user in both Firebase Auth and Firestore
 */
function messageFromCallableError(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return 'Failed to create user';
  }
  const e = error as { code?: string; message?: string; details?: unknown };
  if (typeof e.message === 'string' && e.message.trim()) {
    return e.message.trim();
  }
  if (typeof e.details === 'string' && e.details.trim()) {
    return e.details.trim();
  }
  if (e.code === 'functions/already-exists') {
    return 'This email is already registered.';
  }
  if (e.code === 'functions/permission-denied') {
    return 'You do not have permission to create users.';
  }
  if (e.code === 'functions/invalid-argument') {
    return 'Invalid user data. Check required fields and try again.';
  }
  return 'Failed to create user';
}

export const createUser = async (userData: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  department: string;
  organization: string;
  permissionLevel: number;
  additionalOrganizations?: string[];
  multiDepartmentAppointmentsEnabled?: boolean;
  departmentMemberships?: { departmentId: string; isLead: boolean }[];
  isHrLead?: boolean;
  hrLeadCountryCodes?: string[];
}): Promise<User> => {
  try {
    const createUserFunction = httpsCallable(functions, 'createUser');
    const result = await createUserFunction(userData);

    const response = result.data as {
      success: boolean;
      user: User;
    };

    if (!response.success) {
      throw new Error('Failed to create user');
    }

    return response.user;
  } catch (error) {
    console.error('Error creating user:', error);
    throw new Error(messageFromCallableError(error));
  }
};
