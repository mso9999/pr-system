/**
 * Canonical PR authorization helpers — claim-only.
 *
 * The signed Nexus `effectivePrivilege` claim (targetSystem 'pr'), read from
 * the Firebase ID token in `services/auth.ts` and attached to the user as
 * `user.privilege`, is the sole client-side authority. The Nexus resolver
 * mints sub-actions from the legacy numeric permission level
 * (PR_LEGACY_LEVEL_ACTIONS), so the old 1–9 role distinctions survive the
 * 4-level ladder (A/B/C/D) collapse.
 *
 * Sessions without a signed claim (the ?fallback=1 emergency login) carry no
 * actions: every check here fails closed and the app is read-only.
 *
 * `user.permissionLevel` remains populated for DISPLAY and directory queries
 * only. It must not gate authorization — derive gates from the claim via the
 * helpers below.
 */

export const PR_ACTIONS = [
  'view_and_request',
  'edit_operational_prs',
  'approve_and_finance',
  'administer_pr',
  'approve_high_value',
  'approve_within_finance_limit',
  'process_procurement_queue',
  'manage_pr_users',
  'manage_pr_sites',
  'manage_finance_reference_data',
  'finance_administration',
  'manage_hr_lead_meta',
] as const;

export type PrAction = (typeof PR_ACTIONS)[number];

export interface PrPrivilegeSnapshot {
  level: string;
  actions: PrAction[];
  scopeCountries: string[];
  scopeOrganizations: string[];
  roleCrudOwners: string[];
  version: string;
}

/** Minimal shape: anything carrying a raw `privilege` claim. */
export interface PrSubject {
  privilege?: unknown;
}

const EMPTY: PrPrivilegeSnapshot = {
  level: 'NONE',
  actions: [],
  scopeCountries: [],
  scopeOrganizations: [],
  roleCrudOwners: [],
  version: '',
};

export function normalizePrPrivilege(raw: unknown): PrPrivilegeSnapshot {
  if (!raw || typeof raw !== 'object') return EMPTY;
  const record = raw as Record<string, unknown>;
  const actions = Array.isArray(record.actions) ? record.actions : [];
  const safeActions = [
    ...new Set(
      actions.map(String).filter((a): a is PrAction => (PR_ACTIONS as readonly string[]).includes(a))
    ),
  ].sort();
  const strList = (value: unknown): string[] =>
    Array.isArray(value)
      ? [...new Set(value.map(String).map((v) => v.trim()).filter(Boolean))]
      : [];
  return {
    level: String(record.level || 'NONE'),
    actions: safeActions,
    scopeCountries: strList(record.scopeCountries).map((v) => v.toUpperCase()),
    scopeOrganizations: strList(record.scopeOrganizations).map((v) => v.toLowerCase()),
    roleCrudOwners: strList(record.roleCrudOwners),
    version: String(record.version || ''),
  };
}

export function getPrActions(subject: PrSubject | null | undefined): Set<PrAction> {
  return new Set(normalizePrPrivilege(subject?.privilege).actions);
}

export function hasPrAction(subject: PrSubject | null | undefined, ...actions: PrAction[]): boolean {
  const owned = getPrActions(subject);
  return actions.some((a) => owned.has(a));
}

/** True when the session carries a signed Nexus PR claim at all. */
export function hasSignedPrClaim(subject: PrSubject | null | undefined): boolean {
  return normalizePrPrivilege(subject?.privilege).version !== '';
}

/**
 * Derive the legacy 1–9 permission level from the signed action set. Every
 * legacy level has a unique sub-action signature, so explicit assignments
 * round-trip exactly. Letter-only grants (department rules, toolset
 * approvals — no sub-actions) fall back to the letter's minimal legacy
 * equivalent; protected A maps to 1. Returns undefined for unsigned sessions
 * (emergency fallback login = read-only).
 *
 * DISPLAY ONLY. Authorization gates must use hasPrAction / the named
 * predicates below; the derived level exists so role badges, the What's New
 * audience, and directory filters keep working while gates migrate.
 */
export function deriveLegacyPermissionLevel(subject: PrSubject | null | undefined): number | undefined {
  const p = normalizePrPrivilege(subject?.privilege);
  if (p.actions.length === 0) return undefined;
  const has = (a: PrAction) => p.actions.includes(a);
  if (has('administer_pr')) return 1;
  if (has('approve_high_value')) return 2;
  if (has('process_procurement_queue')) return 3;
  if (has('finance_administration')) return 4;
  if (has('view_and_request') && p.actions.length === 1) return 5;
  if (has('manage_finance_reference_data')) return 6;
  if (has('manage_pr_users')) return 8;
  if (has('manage_pr_sites')) return 9;
  // Letter-only fallbacks
  if (p.level === 'A') return 1;
  if (p.level === 'B') return 2;
  if (p.level === 'C') return 7;
  if (has('edit_operational_prs')) return 7;
  return 5;
}

// ── Named gates (old numeric predicate → claim equivalent) ──────────────

/** Admin area entry (old `level<=4 || 8 || 9`; excludes requester, site manager, finance approver). */
export function canEnterAdminArea(subject: PrSubject | null | undefined): boolean {
  return hasPrAction(
    subject,
    'administer_pr',
    'approve_high_value',
    'process_procurement_queue',
    'finance_administration',
    'manage_pr_users',
    'manage_pr_sites'
  );
}

/** Admin area write access (old: only levels 1 and 8 wrote; 2,3,4,9 read-only). */
export function canWriteAdminArea(subject: PrSubject | null | undefined): boolean {
  return hasPrAction(subject, 'administer_pr', 'manage_pr_users');
}

/** Approve a PR of any amount (old levels 1,2). */
export function canApproveAnyAmount(subject: PrSubject | null | undefined): boolean {
  return hasPrAction(subject, 'approve_high_value', 'administer_pr');
}

/** Approve a PR within the Rule 1 finance limit (old levels 1,2,4,6). */
export function canApproveWithinFinanceLimit(subject: PrSubject | null | undefined): boolean {
  return hasPrAction(subject, 'approve_within_finance_limit', 'administer_pr');
}

/** Process the procurement queue: RFQ, PO steps, vendor interaction (old 1,3). */
export function canProcessProcurement(subject: PrSubject | null | undefined): boolean {
  return hasPrAction(subject, 'process_procurement_queue', 'administer_pr');
}

/** External-approval bypass and PO completion (old 1,4). */
export function canFinanceAdminister(subject: PrSubject | null | undefined): boolean {
  return hasPrAction(subject, 'finance_administration', 'administer_pr');
}

/** User management (old 1 superadmin, 8 user admin). */
export function canManagePrUsers(subject: PrSubject | null | undefined): boolean {
  return hasPrAction(subject, 'manage_pr_users', 'administer_pr');
}

/** Full user administration incl. level changes and HR Lead meta (old 1). */
export function canAdministerPr(subject: PrSubject | null | undefined): boolean {
  return hasPrAction(subject, 'administer_pr');
}

/** Operational PR edit (old level<=3-style edit gates: 1,2,3,7). */
export function canEditOperationalPrs(subject: PrSubject | null | undefined): boolean {
  return hasPrAction(subject, 'edit_operational_prs', 'administer_pr');
}

/** Provisioning Studio tab visibility (old {1,3,4,6}). */
export function canSeeProvisioningStudio(subject: PrSubject | null | undefined): boolean {
  return hasPrAction(
    subject,
    'administer_pr',
    'process_procurement_queue',
    'manage_finance_reference_data'
  );
}

/** Reference-data edit matrix — mirrors the retired REFERENCE_DATA_ACCESS levels. */
export function canEditReferenceDataType(subject: PrSubject | null | undefined, type: string): boolean {
  switch (type) {
    // HR- and FM-owned catalogs: never editable in PR.
    case 'departments':
    case 'vehicles':
      return false;
    // Admin-only catalogs.
    case 'currencies':
    case 'organizations':
    case 'countries':
    case 'permissions':
    case 'provisioningDefaults':
      return hasPrAction(subject, 'administer_pr');
    // Sites: legacy levels 1,2,3,9.
    case 'sites':
      return hasPrAction(subject, 'manage_pr_sites', 'administer_pr');
    // Vendors: legacy levels 1,2,3.
    case 'vendors':
      return hasPrAction(subject, 'approve_high_value', 'process_procurement_queue', 'administer_pr');
    // Finance catalogs: legacy levels 1,4,6.
    case 'expenseTypes':
    case 'projectCategories':
    case 'rules':
      return hasPrAction(subject, 'manage_finance_reference_data', 'administer_pr');
    // Procurement catalogs: legacy levels 1,3.
    case 'uom':
    case 'rations':
    case 'provisioningMenus':
      return hasPrAction(subject, 'process_procurement_queue', 'administer_pr');
    // Shared procurement+finance: legacy 1,3,4,6.
    case 'paymentTypes':
    case 'rationPrices':
      return hasPrAction(subject, 'process_procurement_queue', 'manage_finance_reference_data', 'administer_pr');
    default:
      return hasPrAction(subject, 'administer_pr');
  }
}

/** Human-readable assigned-role labels for the denial UI. */
export function assignedPrRoleLabels(subject: PrSubject | null | undefined): string[] {
  const p = normalizePrPrivilege(subject?.privilege);
  if (!p.actions.length) return ['View only (no signed PR grant)'];
  const legacy = deriveLegacyPermissionLevel(subject);
  const levelNames: Record<number, string> = {
    1: 'Administrator',
    2: 'Senior Approver',
    3: 'Procurement Officer',
    4: 'Finance Admin',
    5: 'Requester',
    6: 'Finance Approver',
    7: 'Site Manager',
    8: 'User Administrator',
    9: 'IT Administrator',
  };
  const label = legacy ? levelNames[legacy] : undefined;
  return [label ? `${label} (Level ${p.level})` : `Level ${p.level}`, ...p.actions];
}
