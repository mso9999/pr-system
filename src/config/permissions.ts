import { PermissionLevel } from '../types/user';

export const PERMISSION_LEVELS = {
  ADMIN: 1,
  APPROVER: 2,
  PROC: 3,
  FIN_AD: 4,
  REQ: 5,
  APPROVER_2: 6,
} as const;

export const REFERENCE_DATA_TYPES = {
  departments: 'departments',
  projectCategories: 'projectCategories',
  sites: 'sites',
  expenseTypes: 'expenseTypes',
  vehicles: 'vehicles',
  vendors: 'vendors',
  currencies: 'currencies',
  uom: 'uom',
  organizations: 'organizations',
  permissions: 'permissions',
  rules: 'rules'
} as const;

export const PERMISSION_NAMES = {
  [PERMISSION_LEVELS.ADMIN]: 'Administrator',
  [PERMISSION_LEVELS.APPROVER]: 'Approver',
  [PERMISSION_LEVELS.PROC]: 'Procurement',
  [PERMISSION_LEVELS.FIN_AD]: 'Finance Admin',
  [PERMISSION_LEVELS.REQ]: 'Requester',
  [PERMISSION_LEVELS.APPROVER_2]: 'Approver',
} as const;

export interface ReferenceDataAccess {
  canEdit: boolean;
  editableBy: string[];
}

export const REFERENCE_DATA_ACCESS: Record<string, ReferenceDataAccess> = {
  [REFERENCE_DATA_TYPES.departments]: {
    canEdit: false,
    editableBy: [PERMISSION_NAMES[PERMISSION_LEVELS.ADMIN], PERMISSION_NAMES[PERMISSION_LEVELS.APPROVER], PERMISSION_NAMES[PERMISSION_LEVELS.PROC]],
  },
  [REFERENCE_DATA_TYPES.currencies]: {
    canEdit: false,
    editableBy: [PERMISSION_NAMES[PERMISSION_LEVELS.ADMIN]],
  },
  [REFERENCE_DATA_TYPES.vendors]: {
    canEdit: false,
    editableBy: [PERMISSION_NAMES[PERMISSION_LEVELS.ADMIN], PERMISSION_NAMES[PERMISSION_LEVELS.APPROVER], PERMISSION_NAMES[PERMISSION_LEVELS.PROC]],
  },
  [REFERENCE_DATA_TYPES.expenseTypes]: {
    canEdit: false,
    editableBy: [PERMISSION_NAMES[PERMISSION_LEVELS.ADMIN], PERMISSION_NAMES[PERMISSION_LEVELS.FIN_AD]],
  },
  [REFERENCE_DATA_TYPES.sites]: {
    canEdit: false,
    editableBy: [PERMISSION_NAMES[PERMISSION_LEVELS.ADMIN], PERMISSION_NAMES[PERMISSION_LEVELS.APPROVER], PERMISSION_NAMES[PERMISSION_LEVELS.PROC]],
  },
  [REFERENCE_DATA_TYPES.vehicles]: {
    canEdit: false,
    editableBy: [PERMISSION_NAMES[PERMISSION_LEVELS.ADMIN], PERMISSION_NAMES[PERMISSION_LEVELS.APPROVER], PERMISSION_NAMES[PERMISSION_LEVELS.PROC]],
  },
  [REFERENCE_DATA_TYPES.projectCategories]: {
    canEdit: false,
    editableBy: [PERMISSION_NAMES[PERMISSION_LEVELS.ADMIN], PERMISSION_NAMES[PERMISSION_LEVELS.FIN_AD]],
  },
  [REFERENCE_DATA_TYPES.uom]: {
    canEdit: false,
    editableBy: [PERMISSION_NAMES[PERMISSION_LEVELS.ADMIN]],
  },
  [REFERENCE_DATA_TYPES.organizations]: {
    canEdit: false,
    editableBy: [PERMISSION_NAMES[PERMISSION_LEVELS.ADMIN]],
  },
  [REFERENCE_DATA_TYPES.permissions]: {
    canEdit: false,
    editableBy: [PERMISSION_NAMES[PERMISSION_LEVELS.ADMIN]],
  },
  [REFERENCE_DATA_TYPES.rules]: {
    canEdit: false,
    editableBy: [PERMISSION_NAMES[PERMISSION_LEVELS.ADMIN], PERMISSION_NAMES[PERMISSION_LEVELS.FIN_AD]],
  },
} as const;

export function hasEditAccess(permissionLevel: number, referenceDataType: string): boolean {
  const permissionName = PERMISSION_NAMES[permissionLevel as keyof typeof PERMISSION_NAMES];
  return REFERENCE_DATA_ACCESS[referenceDataType]?.editableBy.includes(permissionName) || false;
}

export function getEditableTypes(permissionLevel: number): string[] {
  const permissionName = PERMISSION_NAMES[permissionLevel as keyof typeof PERMISSION_NAMES];
  return Object.entries(REFERENCE_DATA_ACCESS)
    .filter(([_, access]) => access.editableBy.includes(permissionName))
    .map(([type]) => type);
}
