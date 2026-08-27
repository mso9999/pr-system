import { describe, expect, it } from 'vitest';
import {
  isCatalogItemActive,
  listIncludesOrganization,
  normalizeOrganizationId,
  organizationDisplayName,
  organizationIdentifiers,
  organizationMatchesUser,
} from './organization';

describe('normalizeOrganizationId', () => {
  it('maps SMP name, code, and aliases onto the catalog id', () => {
    expect(normalizeOrganizationId('SMP')).toBe('smp');
    expect(normalizeOrganizationId('smp')).toBe('smp');
    expect(normalizeOrganizationId('Sotho Minigrid Portfolio')).toBe('smp');
    expect(normalizeOrganizationId('sotho_minigrid_portfolio')).toBe('smp');
    expect(normalizeOrganizationId({ id: 'smp', code: 'SMP', name: 'SMP' })).toBe('smp');
  });

  it('prefers document id over a mismatched admin code', () => {
    expect(
      normalizeOrganizationId({
        id: 'smp',
        code: 'Sotho Minigrid Portfolio Ltd',
        name: 'SMP',
      })
    ).toBe('smp');
    expect(
      normalizeOrganizationId({
        id: '1pwr_lesotho',
        code: '1PWR_LSO',
        name: '1PWR LESOTHO',
      })
    ).toBe('1pwr_lesotho');
  });
});

describe('organizationMatchesUser', () => {
  it('lets a user assigned as smp or SMP select the SMP catalog row', () => {
    const smpOrg = { id: 'smp', code: 'SMP', name: 'SMP' };
    expect(organizationMatchesUser(smpOrg, new Set(['smp']))).toBe(true);
    expect(organizationMatchesUser(smpOrg, new Set(['SMP']))).toBe(true);
    expect(organizationMatchesUser(smpOrg, new Set(['1pwr_lesotho']))).toBe(false);
  });

  it('matches when only the catalog code or name lines up with the assignment', () => {
    const smpOrg = { id: 'smp', code: 'Sotho Minigrid Portfolio Ltd', name: 'SMP' };
    expect(organizationMatchesUser(smpOrg, new Set(['smp']))).toBe(true);
    expect(organizationIdentifiers(smpOrg)).toEqual(['smp']);
  });
});

describe('organizationDisplayName', () => {
  it('always labels the SMP catalog row as SMP', () => {
    expect(organizationDisplayName({ id: 'smp', name: 'SMP' })).toBe('SMP');
    expect(organizationDisplayName({ id: 'smp', name: 'Sotho Minigrid Portfolio' })).toBe(
      'SMP — Sotho Minigrid Portfolio'
    );
  });
});

describe('listIncludesOrganization', () => {
  it('finds SMP whether the list uses id or display name', () => {
    expect(listIncludesOrganization([{ id: 'smp', name: 'SMP' }], 'SMP')).toBe(true);
    expect(listIncludesOrganization([{ id: '1pwr_lesotho', name: '1PWR LESOTHO' }], 'smp')).toBe(false);
  });
});

describe('isCatalogItemActive', () => {
  it('keeps SMP visible unless explicitly deactivated', () => {
    expect(isCatalogItemActive({ active: true })).toBe(true);
    expect(isCatalogItemActive({ isActive: true })).toBe(true);
    expect(isCatalogItemActive({ active: 'Y' })).toBe(true);
    expect(isCatalogItemActive({})).toBe(true);
    expect(isCatalogItemActive({ active: false })).toBe(false);
    expect(isCatalogItemActive({ active: 'N' })).toBe(false);
  });
});
