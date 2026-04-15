import type { DepartmentMembership, User } from '@/types/user';

/** Normalize country code for comparison (ISO 3166-1 alpha-2). */
export function normalizeCountryCode(cc: string | undefined): string {
  return (cc || '').trim().toUpperCase();
}

/**
 * Whether the current user may enable multi-department appointments (2–3 depts + Lead flags)
 * for an employee in `targetOrganizationId`.
 * — Superadmin (permission level 1), or
 * — HR Lead with the target org's country in `hrLeadCountryCodes`.
 */
export function canToggleMultiDepartmentAssignment(
  caller: Pick<User, 'permissionLevel' | 'isHrLead' | 'hrLeadCountryCodes'> | null | undefined,
  targetOrgCountry: string | undefined
): boolean {
  if (!caller) return false;
  if (caller.permissionLevel === 1) return true;
  if (!caller.isHrLead || !caller.hrLeadCountryCodes?.length) return false;
  const target = normalizeCountryCode(targetOrgCountry);
  if (!target) return false;
  return caller.hrLeadCountryCodes.map(normalizeCountryCode).includes(target);
}

/** Only superadmin may assign HR Lead role and country scope to other users. */
export function canManageHrLeadMeta(caller: Pick<User, 'permissionLevel'> | null | undefined): boolean {
  return caller?.permissionLevel === 1;
}

/** Validate 2–3 unique department rows for multi mode. Returns memberships or null. */
export function validateDepartmentSlots(
  slots: Array<{ departmentId: string; isLead: boolean }>
): DepartmentMembership[] | null {
  const filled = slots.filter((s) => s.departmentId && s.departmentId.trim());
  if (filled.length < 2 || filled.length > 3) return null;
  const ids = filled.map((s) => s.departmentId.trim());
  if (new Set(ids).size !== ids.length) return null;
  return filled.map((s) => ({
    departmentId: s.departmentId.trim(),
    isLead: !!s.isLead,
  }));
}
