/**
 * PR number org/country segments (YYMMDD-####-ORG-CC).
 * Shared by client code and Node backfill scripts — no Firebase imports.
 */

import { normalizeOrganizationId } from './organization';

const ORG_CODE_MAP: Record<string, string> = {
  '1pwr_lesotho': '1PL',
  '1pwr_benin': '1PB',
  '1pwr_zambia': '1PZ',
  neo1: 'NEO',
  pueco_benin: 'PCB',
  pueco_lesotho: 'PCL',
  smp: 'SMP',
  mgb: 'MIO',
  mionwa: 'MIO',
  mionwa_gen: 'MIO',
  lesotho: '1PL',
  benin: '1PB',
  zambia: '1PZ',
  sotho_minigrid_portfolio: 'SMP',
};

const COUNTRY_CODE_MAP: Record<string, string> = {
  '1pwr_lesotho': 'LS',
  '1pwr_benin': 'BN',
  '1pwr_zambia': 'ZM',
  neo1: 'LS',
  pueco_benin: 'BN',
  pueco_lesotho: 'LS',
  smp: 'LS',
  mgb: 'BN',
  mionwa: 'BN',
  mionwa_gen: 'BN',
  lesotho: 'LS',
  benin: 'BN',
  zambia: 'ZM',
  sotho_minigrid_portfolio: 'LS',
};

export function getOrgCodes(organization: string): { orgCode: string; countryCode: string } {
  const normalizedOrg = normalizeOrganizationId(organization);
  return {
    orgCode: ORG_CODE_MAP[normalizedOrg] || organization.substring(0, 3).toUpperCase(),
    countryCode: COUNTRY_CODE_MAP[normalizedOrg] || 'XX',
  };
}

/**
 * Maps organization country from reference data (usually ISO 3166-1 alpha-2) to the PR number suffix.
 * Benin PRs use BN (not BJ) per business convention.
 */
export function mapIsoCountryToPrCountryCode(isoOrName: string | undefined): string {
  const raw = (isoOrName || '').trim();
  if (!raw) return 'XX';
  const u = raw.toUpperCase().replace(/\s+/g, '_');
  if (u === 'BENIN' || u === 'BEN') return 'BN';
  if (u === 'LESOTHO') return 'LS';
  if (u === 'ZAMBIA') return 'ZM';
  if (u === 'MALAWI') return 'MW';
  if (u === 'SOUTH_AFRICA') return 'ZA';
  if (u.length === 2 && /^[A-Z]{2}$/.test(u)) {
    if (u === 'BJ') return 'BN';
    return u;
  }
  return 'XX';
}
