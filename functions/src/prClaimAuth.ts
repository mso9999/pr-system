import * as functions from 'firebase-functions';

/**
 * Claim-only caller authorization for PR Cloud Functions.
 *
 * The signed Nexus `effectivePrivilege` claim (targetSystem 'pr') on the
 * caller's ID token is the sole authority. Sub-actions are minted from the
 * legacy numeric permission level by the Nexus resolver
 * (PR_LEGACY_LEVEL_ACTIONS), preserving the old 1-9 role distinctions.
 *
 * Sessions without a signed claim (emergency non-SSO fallback login) carry
 * no actions: every check fails closed, so direct logins are read-only.
 *
 * The retired inputs — Firestore users/{uid}.permissionLevel and the legacy
 * custom claims (admin / procurement / requester / permissionLevel) written
 * by setUserClaims & friends — are no longer consulted here.
 */

export type PrAction =
  | 'view_and_request'
  | 'edit_operational_prs'
  | 'approve_and_finance'
  | 'administer_pr'
  | 'approve_high_value'
  | 'approve_within_finance_limit'
  | 'process_procurement_queue'
  | 'manage_pr_users'
  | 'manage_pr_sites'
  | 'manage_finance_reference_data'
  | 'finance_administration'
  | 'manage_hr_lead_meta';

interface CallableAuthLike {
  uid: string;
  token: Record<string, unknown>;
}

/** Accepts either callable context.auth ({uid, token}) or a decoded token. */
function tokenOf(auth: CallableAuthLike | Record<string, unknown>): Record<string, unknown> {
  const maybeWrapped = auth as CallableAuthLike;
  if (maybeWrapped.token && typeof maybeWrapped.token === 'object') {
    return maybeWrapped.token;
  }
  return auth as Record<string, unknown>;
}

export function prCallerActions(auth: CallableAuthLike | Record<string, unknown> | undefined | null): Set<string> {
  if (!auth) return new Set();
  const token = tokenOf(auth);
  if (token.nexus_sso !== true) return new Set();
  if (String(token.targetSystem ?? '') !== 'pr') return new Set();
  if (!token.privilegeVersion) return new Set();
  const raw = (token.effectivePrivilege as Record<string, unknown> | undefined)?.actions;
  if (!Array.isArray(raw)) return new Set();
  return new Set(raw.map(String));
}

export function callerHasPrAction(
  auth: CallableAuthLike | Record<string, unknown> | undefined | null,
  ...actions: PrAction[]
): boolean {
  const owned = prCallerActions(auth);
  return actions.some((a) => owned.has(a));
}

/**
 * Require one of the given actions; throws HttpsError('permission-denied')
 * with the privilege-denial contract payload in details.
 */
export function requirePrAction(
  auth: CallableAuthLike | Record<string, unknown> | undefined | null,
  description: string,
  ...actions: PrAction[]
): Set<string> {
  if (!auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
  }
  const owned = prCallerActions(auth);
  if (actions.some((a) => owned.has(a))) {
    return owned;
  }
  throw new functions.https.HttpsError('permission-denied', `Your PR access does not allow you to ${description}.`, {
    code: 'privilege_denied',
    system: 'pr',
    action: description,
    assigned: [...owned],
    required: actions,
    resolution:
      'Ask your country HR team or the Nexus/IS&T User Administrator to correct the assignment, then sign out and relaunch PR from Nexus.',
  });
}
