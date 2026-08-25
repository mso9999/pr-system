import { describe, expect, it } from 'vitest';
import {
  expandRelatedOrganizationIds,
  isCatalogItemActive,
  normalizeOrganizationId,
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
    expect(organizationMatchesUser(smpOrg, expandRelatedOrganizationIds(['SMP']))).toBe(true);
  });

  it('matches when only the catalog code or name lines up with the assignment', () => {
    const smpOrg = { id: 'smp', code: 'Sotho Minigrid Portfolio Ltd', name: 'SMP' };
    expect(organizationMatchesUser(smpOrg, new Set(['smp']))).toBe(true);
    expect(organizationIdentifiers(smpOrg)).toEqual(['smp']);
  });
});

describe('expandRelatedOrganizationIds', () => {
  it('lets 1PWR Lesotho users select SMP and vice versa', () => {
    expect([...expandRelatedOrganizationIds(['1pwr_lesotho'])].sort()).toEqual([
      '1pwr_lesotho',
      'smp',
    ]);
    expect([...expandRelatedOrganizationIds(['SMP'])].sort()).toEqual([
      '1pwr_lesotho',
      'smp',
    ]);
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
