/**
 * Claim-based identity predicates (2026-08 authorization migration).
 *
 * The signed Nexus `effectivePrivilege` claim on the session user is the
 * sole authorization authority. The numeric `permissionLevel` field is a
 * display/directory value only and is no longer consulted here.
 *
 * These functions keep their historical signatures so existing call sites
 * compile unchanged: pass the Redux session user (which now carries
 * `privilege`) and the check is answered from the signed action set.
 * Users fetched for display (admin lists, profiles) have no signed claim
 * and therefore answer false — safe default, buttons simply hide.
 */
import { hasPrAction } from './prPrivilege';

type PrivilegedSubject = { privilege?: unknown } | null | undefined;

export function isProcurementUser(user?: PrivilegedSubject): boolean {
  return hasPrAction(user, 'process_procurement_queue');
}

export function isAdminUser(user?: PrivilegedSubject): boolean {
  return hasPrAction(user, 'administer_pr');
}

/**
 * @deprecated Numeric levels are retired as an authorization input. Kept
 * only for parsing legacy display values (e.g. showing a user's directory
 * permission level in admin screens).
 */
export function normalizePermissionLevel(level: unknown): number {
  if (typeof level === 'number' && !Number.isNaN(level)) {
    return level;
  }
  if (typeof level === 'string' && level.trim() !== '') {
    const parsed = Number(level);
    return Number.isNaN(parsed) ? 5 : parsed;
  }
  return 5;
}
