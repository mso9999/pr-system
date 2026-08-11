/**
 * @fileoverview Authentication Redux Slice
 * @version 1.2.0
 * 
 * Description:
 * Redux slice for authentication state management in the PR System.
 * Handles user authentication state, loading states, and error handling.
 * 
 * State Shape:
 * ```typescript
 * {
 *   user: User | null;      // Current authenticated user
 *   loading: boolean;       // Auth operation in progress
 *   error: string | null;   // Last auth error message
 * }
 * ```
 * 
 * Actions:
 * - setUser: Updates the authenticated user
 * - setLoading: Updates loading state
 * - setError: Sets error message
 * - clearUser: Logs out user
 * 
 * Usage Example:
 * ```typescript
 * import { useDispatch, useSelector } from 'react-redux';
 * import { setUser, setError } from './authSlice';
 * 
 * // Set user
 * dispatch(setUser(userData));
 * 
 * // Handle error
 * dispatch(setError('Authentication failed'));
 * ```
 * 
 * Related Modules:
 * - src/services/auth.ts: Auth service
 * - src/hooks/useAuth.ts: Auth hook
 * - src/components/auth/*: Auth components
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

/**
 * User Interface
 * Defines the shape of the user object
 */
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  organization: string;
  isActive: boolean;
  permissionLevel: number;
  /** Signed Nexus `effectivePrivilege` claim (targetSystem 'pr') — see types/user.ts */
  privilege?: unknown;
  additionalOrganizations?: string[];
  secondments?: { organizationId: string; startDate?: string | null; endDate?: string | null; reason?: string | null }[];
  multiDepartmentAppointmentsEnabled?: boolean;
  departmentMemberships?: { departmentId: string; isLead: boolean }[];
  isHrLead?: boolean;
  hrLeadCountryCodes?: string[];
  lastWhatsNewSeenAt?: string;
}

/**
 * Authentication State Interface
 * Defines the shape of the auth slice state
 */
interface AuthState {
  /** Currently authenticated user or null if not authenticated */
  user: User | null;
  /** Whether an auth operation is in progress */
  loading: boolean;
  /** Last authentication error message */
  error: string | null;
  /** IS&T "View As" role ID (e.g. 'requester', 'approver') or null */
  viewAs: string | null;
  /** Derived: true when viewAs is set */
  isViewingAs: boolean;
}

/** Initial authentication state */
const initialState: AuthState = {
  user: null,
  loading: false,
  error: null,
  viewAs: null,
  isViewingAs: false,
};

/**
 * Authentication Slice
 * Contains reducers for managing auth state
 */
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    /**
     * Updates the authenticated user
     * @param state Current auth state
     * @param action Payload contains User object or null
     */
    setUser(state, action: PayloadAction<User | null>) {
      state.user = action.payload;
      state.loading = false;
      state.error = null;
      // Log the user state when it's set
      console.log('Auth Slice: Setting user state:', {
        email: action.payload?.email,
        role: action.payload?.role,
        permissionLevel: action.payload?.permissionLevel
      });
    },

    /**
     * Updates the loading state
     * @param state Current auth state
     * @param action Payload contains boolean loading state
     */
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },

    /**
     * Sets the error message
     * @param state Current auth state
     * @param action Payload contains error message
     */
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
      state.loading = false;
    },

    /**
     * Clears the authenticated user (logout)
     * @param state Current auth state
     */
    clearUser(state) {
      state.user = null;
      state.loading = false;
      state.error = null;
      state.viewAs = null;
      state.isViewingAs = false;
    },

    setViewAs(state, action: PayloadAction<string | null>) {
      state.viewAs = action.payload;
      state.isViewingAs = action.payload !== null;
    },

    clearViewAs(state) {
      state.viewAs = null;
      state.isViewingAs = false;
    },
  },
});

// Export actions for use in components and services
export const { setUser, setLoading, setError, clearUser, setViewAs, clearViewAs } = authSlice.actions;

// Export the reducer for store configuration
export default authSlice.reducer;

// Export type for use in components
export type { AuthState };
