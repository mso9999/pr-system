export const PERMISSION_LEVELS = {
  ADMIN: 1,
  APPROVER: 2,
  PROC: 3,
  FIN_AD: 4,
  REQ: 5,
  FIN_APPROVER: 6,
  SITE_MANAGER: 7,
  USER_ADMIN: 8,
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
  rules: 'rules',
  paymentTypes: 'paymentTypes'
} as const;

export const PERMISSION_NAMES = {
  [PERMISSION_LEVELS.ADMIN]: 'Administrator',
  [PERMISSION_LEVELS.APPROVER]: 'Senior Approver',
  [PERMISSION_LEVELS.PROC]: 'Procurement Officer',
  [PERMISSION_LEVELS.FIN_AD]: 'Finance Admin',
  [PERMISSION_LEVELS.REQ]: 'Requester',
  [PERMISSION_LEVELS.FIN_APPROVER]: 'Finance Approver',
  [PERMISSION_LEVELS.SITE_MANAGER]: 'Site Manager',
  [PERMISSION_LEVELS.USER_ADMIN]: 'User Administrator',
} as const;

export const PERMISSION_DESCRIPTIONS: Record<number, string> = {
  [PERMISSION_LEVELS.ADMIN]:
    'Full system access including organizations, reference data, users, and all PR actions.',
  [PERMISSION_LEVELS.APPROVER]:
    'Can approve purchase requests, view admin area in read-only mode, and review reports.',
  [PERMISSION_LEVELS.PROC]:
    'Procurement officer – can process PRs, manage vendor interactions, and update procurement statuses.',
  [PERMISSION_LEVELS.FIN_AD]:
    'Finance admin – can process finance steps, manage payouts, and approve finance-related PR steps.',
  [PERMISSION_LEVELS.REQ]:
    'Requester – can create, view, and follow their own PRs.',
  [PERMISSION_LEVELS.FIN_APPROVER]:
    'Finance approver – can approve high value PRs and monitor finance queues.',
  [PERMISSION_LEVELS.SITE_MANAGER]:
    'Site manager – can submit and monitor PRs for specific sites and view site-level dashboards.',
  [PERMISSION_LEVELS.USER_ADMIN]:
    'User administrator – can view the admin area, manage user accounts (except super administrators), and reset passwords.',
};

export function getPermissionInfo(level?: number) {
  if (!level) {
    return {
      name: 'Unknown',
      description: 'No permission information available.',
    };
  }
  const name = PERMISSION_NAMES[level as keyof typeof PERMISSION_NAMES] || `Level ${level}`;
  const description = PERMISSION_DESCRIPTIONS[level] || 'Custom permission configuration.';

  return { name, description };
}

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
    editableBy: [PERMISSION_NAMES[PERMISSION_LEVELS.ADMIN], PERMISSION_NAMES[PERMISSION_LEVELS.APPROVER], PERMISSION_NAMES[PERMISSION_LEVELS.PROC]],
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
    editableBy: [PERMISSION_NAMES[PERMISSION_LEVELS.ADMIN], PERMISSION_NAMES[PERMISSION_LEVELS.APPROVER], PERMISSION_NAMES[PERMISSION_LEVELS.PROC]],
  },
  [REFERENCE_DATA_TYPES.uom]: {
    canEdit: false,
    editableBy: [PERMISSION_NAMES[PERMISSION_LEVELS.ADMIN], PERMISSION_NAMES[PERMISSION_LEVELS.PROC]],
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
    editableBy: [PERMISSION_NAMES[PERMISSION_LEVELS.ADMIN], PERMISSION_NAMES[PERMISSION_LEVELS.FIN_AD], PERMISSION_NAMES[PERMISSION_LEVELS.FIN_APPROVER]],
  },
  [REFERENCE_DATA_TYPES.paymentTypes]: {
    canEdit: false,
    editableBy: [PERMISSION_NAMES[PERMISSION_LEVELS.ADMIN], PERMISSION_NAMES[PERMISSION_LEVELS.PROC], PERMISSION_NAMES[PERMISSION_LEVELS.FIN_AD], PERMISSION_NAMES[PERMISSION_LEVELS.FIN_APPROVER]],
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
