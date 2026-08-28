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
  '1pwr_lso': '1pwr_lesotho',
  '1pwr_lso_ls': '1pwr_lesotho',
  '1pl': '1pwr_lesotho',
  lesotho: '1pwr_lesotho',
  '1pwr_benin': '1pwr_benin',
  '1pwr benin': '1pwr_benin',
  '1pwr_ben': '1pwr_benin',
  '1pb': '1pwr_benin',
  benin: '1pwr_benin',
  '1pwr_zambia': '1pwr_zambia',
  '1pwr zambia': '1pwr_zambia',
  '1pwr_zam': '1pwr_zambia',
  '1pz': '1pwr_zambia',
  zambia: '1pwr_zambia',
  kuwala: 'kuwala',
  neo1: 'neo1',
  neo: 'neo1',
  'pueco_lesotho': 'pueco_lesotho',
  'pueco lesotho': 'pueco_lesotho',
  pueco_lso: 'pueco_lesotho',
  pcl: 'pueco_lesotho',
  'pueco_benin': 'pueco_benin',
  'pueco benin': 'pueco_benin',
  pueco_ben: 'pueco_benin',
  pcb: 'pueco_benin',
  'inclusive_pueco_benin': 'pueco_benin',
  'inclusive_pueco benin': 'pueco_benin',
  'inclusive pueco_benin': 'pueco_benin',
  'inclusive pueco benin': 'pueco_benin',
  'inclusive_pue': 'pueco_benin',
  'inclusive pue': 'pueco_benin',
  smp: 'smp',
  smp_ls: 'smp',
  ls_smp: 'smp',
  'sotho_minigrid_portfolio': 'smp',
  'sotho minigrid portfolio': 'smp',
  'sotho_minigrid': 'smp',
  'sotho_minigrid_portfolio_ltd': 'smp',
  'sotho_minigrid_portfolio_limited': 'smp',
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

/** Catalog row injected when Firestore is missing or hiding SMP. */
export const SMP_FALLBACK_ORGANIZATION = {
  id: 'smp',
  name: 'SMP',
  code: 'SMP',
  active: true,
} as const;

const normalizeRawValue = (value: string | null | undefined): string => {
  if (!value) return '';
  return value.toString().trim();
};

export const normalizeOrganizationId = (input: OrganizationInput): string => {
  if (!input) return '';

  let rawValue: string;

  if (typeof input === 'object') {
    // Document id is canonical (smp, 1pwr_lesotho). Prefer it over `code`
    // (SMP, 1PWR_LSO) so catalog rows still match user assignments.
    rawValue =
      normalizeRawValue(input.id) ||
      normalizeRawValue(input.code) ||
      normalizeRawValue(input.name);
  } else {
    rawValue = normalizeRawValue(input);
  }

  if (!rawValue) return '';

  const normalized = rawValue.toLowerCase().replace(/[^a-z0-9]/g, '_');
  return ORGANIZATION_ALIAS_MAP[normalized] || normalized;
};

/** Every normalized identifier a catalog row or stored value might be known by. */
export const organizationIdentifiers = (organization: OrganizationInput): string[] => {
  if (!organization) return [];
  if (typeof organization === 'string') {
    const normalized = normalizeOrganizationId(organization);
    return normalized ? [normalized] : [];
  }
  const ids = [organization.id, organization.code, organization.name]
    .map((value) => normalizeOrganizationId(value))
    .filter((id): id is string => Boolean(id));
  return [...new Set(ids)];
};

export const organizationMatchesUser = (
  organization: OrganizationInput,
  userOrganizationIds: Set<string>
): boolean => {
  if (userOrganizationIds.size === 0) return false;
  const normalizedUserIds = new Set(
    [...userOrganizationIds].map((id) => normalizeOrganizationId(id)).filter(Boolean)
  );
  if (normalizedUserIds.size === 0) return false;
  return organizationIdentifiers(organization).some((id) => normalizedUserIds.has(id));
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
  kuwala: 'ZM',
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

export const listIncludesOrganization = (
  organizations: OrganizationInput[],
  target: OrganizationInput
): boolean => {
  const wanted = new Set(organizationIdentifiers(target));
  if (wanted.size === 0) return false;
  return organizations.some((org) => organizationIdentifiers(org).some((id) => wanted.has(id)));
};

/** Label for pickers. SMP always reads as "SMP" even if the catalog name is the legal entity. */
export const organizationDisplayName = (organization: OrganizationInput): string => {
  if (!organization) return '';
  const name =
    typeof organization === 'string'
      ? organization.trim()
      : (organization.name || organization.code || organization.id || '').trim();
  const ids = organizationIdentifiers(organization);
  if (ids.includes('smp')) {
    if (!name || /^smp$/i.test(name)) return 'SMP';
    if (/smp/i.test(name)) return name;
    return `SMP — ${name}`;
  }
  return name;
};

/** True unless the catalog row is explicitly inactive. */
export const isCatalogItemActive = (item: {
  active?: unknown;
  Active?: unknown;
  isActive?: unknown;
} | null | undefined): boolean => {
  if (!item) return true;
  const raw =
    item.active !== undefined && item.active !== null
      ? item.active
      : item.Active !== undefined && item.Active !== null
        ? item.Active
        : item.isActive;
  if (raw === undefined || raw === null || raw === '') return true;
  if (raw === false || raw === 'false' || raw === 'FALSE' || raw === 'N' || raw === 'n' || raw === 0) {
    return false;
  }
  return true;
};
