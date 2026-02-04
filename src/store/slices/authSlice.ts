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
  department?: string;
  isActive: boolean;
  permissionLevel: number;
  additionalOrganizations?: string[];
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
}

/** Initial authentication state */
const initialState: AuthState = {
  user: null,
  loading: false,
  error: null,
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
    },
  },
});

// Export actions for use in components and services
export const { setUser, setLoading, setError, clearUser } = authSlice.actions;

// Export the reducer for store configuration
export default authSlice.reducer;

// Export type for use in components
export type { AuthState };
