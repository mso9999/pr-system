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
  'inclusive_pueco_benin': 'pueco_benin',
  'inclusive_pueco benin': 'pueco_benin',
  'inclusive pueco_benin': 'pueco_benin',
  'inclusive pueco benin': 'pueco_benin',
  'inclusive_pue': 'pueco_benin',
  'inclusive pue': 'pueco_benin',
  smp: 'smp',
  'sotho_minigrid_portfolio': 'smp',
  'sotho minigrid portfolio': 'smp',
  'sotho_minigrid': 'smp',
  mgb: 'mgb',
  'mionwa_gen': 'mgb',
  'mionwa gen': 'mgb',
  mionwa: 'mgb',
  'mionwa_generation': 'mgb',
  'mionwa generation': 'mgb',
  inclusive_mionwa: 'mgb',
  'inclusive mionwa': 'mgb',
  mionwa_inclusive: 'mgb',
  'mionwa inclusive': 'mgb',
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

/**
 * Normalize a country reference to ISO-2 uppercase — the format Nexus signs
 * into claim scopeCountries. Accepts ISO-3 (AM convention) and common names.
 */
export const normalizeCountryIso2 = (input: string | null | undefined): string => {
  const code = (input || '').toString().trim();
  if (!code) return '';
  const upper = code.toUpperCase();
  const alias: Record<string, string> = {
    LSO: 'LS', LESOTHO: 'LS',
    BEN: 'BJ', BN: 'BJ', BENIN: 'BJ',
    ZMB: 'ZM', ZM: 'ZM', ZAMBIA: 'ZM',
  };
  return alias[upper] || upper;
};

/**
 * Last-resort org => ISO-2 country map, used when the org catalog doc has no
 * `country` yet. Country assignments verified 2026-08-12 against document
 * currencies (LSL/ZAR=LS, XOF=BJ, ZMW=ZM). Covers orgs with no catalog doc
 * at all (mgb). Keep aligned with the organizations collection.
 */
export const ORG_COUNTRY_FALLBACK: Record<string, string> = {
  '1pwr_lesotho': 'LS',
  '1pwr_benin': 'BJ',
  '1pwr_zambia': 'ZM',
  'pueco_lesotho': 'LS',
  'pueco_benin': 'BJ',
  smp: 'LS',
  neo1: 'LS',
  mgb: 'BJ',
};

export const organizationCountryFallback = (organization: OrganizationInput): string => {
  const id = normalizeOrganizationId(organization);
  return id ? (ORG_COUNTRY_FALLBACK[id] || '') : '';
};
