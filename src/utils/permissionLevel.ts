/**
 * Firestore sometimes stores permissionLevel as a string (e.g. "3").
 * Always normalize before strict equality checks (=== 3).
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

export function isProcurementUser(user?: { permissionLevel?: unknown } | null): boolean {
  return normalizePermissionLevel(user?.permissionLevel) === 3;
}

export function isAdminUser(user?: { permissionLevel?: unknown; role?: string } | null): boolean {
  return (
    normalizePermissionLevel(user?.permissionLevel) === 1 || user?.role === 'admin'
  );
}
