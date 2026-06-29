/**
 * @fileoverview User Type Definitions
 * @version 1.2.0
 * 
 * Description:
 * Type definitions for user-related data in the PR System. These types define
 * user profiles, permissions, and role-based access control.
 * 
 * User Roles:
 * - ADMIN: Full system access
 * - FINANCE_APPROVER: Can approve high-value PRs
 * - PROCUREMENT: Can process and manage PRs
 * - USER: Can create and view PRs
 * 
 * Related Modules:
 * - src/services/auth.ts: Authentication service
 * - src/hooks/useAuth.ts: Auth hook
 * - src/components/auth/*: Auth UI components
 */

/**
 * Department assignment with optional lead responsibility (per department).
 */
export interface DepartmentMembership {
  departmentId: string;
  /** True if this employee is a lead for this department */
  isLead: boolean;
}

/**
 * User Role Enum
 * Defines possible user roles and their hierarchy
 */
export enum UserRole {
  ADMIN = 'ADMIN',           // Level 1: Full system access
  APPROVER = 'APPROVER',     // Level 2: Can approve requests within their orgs
  PROC = 'PROC',            // Level 3: Can manage procurement process
  FIN_AD = 'FIN_AD',        // Level 4: Can process procurement requests
  REQ = 'REQ',              // Level 5: Can create and view requests
  FIN_APPROVER = 'FIN_APPROVER' // Level 6: Finance Approver with approval limits
}

/**
 * User Profile Interface
 * Core user data structure
 */
export interface User {
  /** Unique identifier */
  id: string;
  /** Email address */
  email: string;
  /** User's first name */
  firstName?: string;
  /** User's last name */
  lastName?: string;
  /** User's role */
  role: string;
  /** User's department */
  department?: string;
  /** Associated organization */
  organization?: string;
  /** Whether user is active */
  isActive?: boolean;
  /** Permission level */
  permissionLevel?: number;
  /** Additional organizations */
  additionalOrganizations?: string[];
  /** When true, user has 2–3 department assignments (see departmentMemberships). Default false. */
  multiDepartmentAppointmentsEnabled?: boolean;
  /** Used when multiDepartmentAppointmentsEnabled is true: 2–3 departments, each with optional Lead. */
  departmentMemberships?: DepartmentMembership[];
  /** HR Lead: may enable multi-department appointments for employees in countries listed in hrLeadCountryCodes. Set by admin only. */
  isHrLead?: boolean;
  /** ISO 3166-1 alpha-2 country codes (e.g. LS, ZM) where this HR Lead may manage employee department assignments. */
  hrLeadCountryCodes?: string[];
  /** User permissions */
  permissions?: string[];
  /** User's name */
  name?: string;

  // ── HR-owned fields (synced from hr.1pwrafrica.com; do not edit in PR) ──
  /** HR canonical employee id (e.g. 1PWR0159F). Foreign key to the HR portal. */
  hrEmployeeId?: string;
  /** Mirror of HR `status` ('active' | 'inactive'). PR's isActive is separate. */
  hrStatus?: 'active' | 'inactive';
  /** ISO-2 country code from HR (e.g. LS, BJ, ZM). */
  hrCountry?: string;
  /** Department name as reported by HR (resolved to `department` id where possible). */
  hrDepartmentName?: string;
  /** Employment type from HR (e.g. 'Full time – fixed contract'). */
  employeeType?: string;
  /** HR primary deployment (e.g. 'Field', 'Office'). */
  primaryDeployment?: string;
  /** HR employment start date (YYYY-MM-DD). */
  employmentStartDate?: string;
  /** HR current position title. */
  currentPositionTitle?: string;
  /** Phone from HR employee profile. */
  phone?: string;
  /** Headshot URL from HR. */
  headshot?: string;
  /** HR `last_updated_at` (ISO 8601) — cursor for incremental sync. */
  hrLastUpdatedAt?: string;
  /** Last time PR synced this user from HR (ISO 8601). */
  hrSyncedAt?: string;
}

/**
 * User Without Id Interface
 * User data structure without id
 */
export interface UserWithoutId extends Omit<User, 'id'> {}

/**
 * User Update Data Interface
 * Data structure for updating user data
 */
export interface UserUpdateData extends Partial<UserWithoutId> {}

/**
 * User Permissions Interface
 * Defines what actions a user can perform
 */
export interface UserPermissions {
  /** Can create PRs */
  canCreatePR: boolean;
  /** Can approve PRs */
  canApprovePR: boolean;
  /** Maximum approval amount */
  approvalLimit?: number;
  /** Can process PRs */
  canProcessPR: boolean;
  /** Can manage users */
  canManageUsers: boolean;
  /** Can view reports */
  canViewReports: boolean;
}

/**
 * User Preferences Interface
 * User-specific settings
 */
export interface UserPreferences {
  /** Email notification settings */
  notifications: {
    /** PR status changes */
    prStatusChanges: boolean;
    /** New PRs to approve */
    newApprovals: boolean;
    /** Daily summaries */
    dailySummary: boolean;
  };
  /** UI theme preference */
  theme: 'light' | 'dark';
  /** Default currency */
  defaultCurrency: string;
  /** Items per page in lists */
  pageSize: number;
}

/**
 * User With Password Interface
 * User data structure with password
 */
export interface UserWithPassword extends User {
  /** User's password */
  password: string;
}
