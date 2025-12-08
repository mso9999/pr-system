type OrganizationInput =
  | string
  | null
  | undefined
  | {
      id?: string | null;
      name?: string | null;
      code?: string | null;
    };

const ORGANIZATION_ALIAS_MAP: Record<string, string> = {
  '1pwr_lesotho': '1pwr_lesotho',
  '1pwr lesotho': '1pwr_lesotho',
  '1pl': '1pwr_lesotho',
  lesotho: '1pwr_lesotho',
  '1pwr_benin': '1pwr_benin',
  '1pwr benin': '1pwr_benin',
  '1pb': '1pwr_benin',
  benin: '1pwr_benin',
  '1pwr_zambia': '1pwr_zambia',
  '1pwr zambia': '1pwr_zambia',
  '1pz': '1pwr_zambia',
  zambia: '1pwr_zambia',
  neo1: 'neo1',
  neo: 'neo1',
  'pueco_lesotho': 'pueco_lesotho',
  'pueco lesotho': 'pueco_lesotho',
  pcl: 'pueco_lesotho',
  'pueco_benin': 'pueco_benin',
  'pueco benin': 'pueco_benin',
  pcb: 'pueco_benin',
  smp: 'smp',
  'sotho_minigrid_portfolio': 'smp',
  'sotho minigrid portfolio': 'smp',
  'sotho_minigrid': 'smp',
};

const normalizeRawValue = (value: string | null | undefined): string => {
  if (!value) return '';
  return value.toString().trim();
};

export const normalizeOrganizationId = (input: OrganizationInput): string => {
  if (!input) return '';

  let rawValue: string;

  if (typeof input === 'object') {
    rawValue =
      normalizeRawValue(input.code) ||
      normalizeRawValue(input.id) ||
      normalizeRawValue(input.name);
  } else {
    rawValue = normalizeRawValue(input);
  }

  if (!rawValue) return '';

  const normalized = rawValue.toLowerCase().replace(/[^a-z0-9]/g, '_');
  return ORGANIZATION_ALIAS_MAP[normalized] || normalized;
};

export const organizationMatchesUser = (
  organization: OrganizationInput,
  userOrganizationIds: Set<string>
): boolean => {
  if (userOrganizationIds.size === 0) return false;
  const normalized = normalizeOrganizationId(organization);
  return normalized ? userOrganizationIds.has(normalized) : false;
};
