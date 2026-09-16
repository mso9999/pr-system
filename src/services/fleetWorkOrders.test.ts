import { describe, expect, it } from 'vitest';
import {
  isWoGatedExpense,
  prOrgToFleetOrg,
  resolveFleetVehicleId,
} from './fleetWorkOrders';

describe('prOrgToFleetOrg', () => {
  it('maps Zambia and Kuwala aliases onto the Zambia fleet', () => {
    expect(prOrgToFleetOrg('1pwr_zambia')).toBe('1pwr_zambia');
    expect(prOrgToFleetOrg('1PWR Zambia')).toBe('1pwr_zambia');
    expect(prOrgToFleetOrg('1pwr_zam')).toBe('1pwr_zambia');
    expect(prOrgToFleetOrg('1pz')).toBe('1pwr_zambia');
    expect(prOrgToFleetOrg('kuwala')).toBe('1pwr_zambia');
    expect(prOrgToFleetOrg('Kuw')).toBe('1pwr_zambia');
  });

  it('maps Benin and sub-entity aliases onto the Benin fleet', () => {
    expect(prOrgToFleetOrg('1pwr_benin')).toBe('1pwr_benin');
    expect(prOrgToFleetOrg('1PWR Benin')).toBe('1pwr_benin');
    expect(prOrgToFleetOrg('1pwr_ben')).toBe('1pwr_benin');
    expect(prOrgToFleetOrg('1pb')).toBe('1pwr_benin');
    expect(prOrgToFleetOrg('mgb')).toBe('1pwr_benin');
    expect(prOrgToFleetOrg('pueco_benin')).toBe('1pwr_benin');
    expect(prOrgToFleetOrg('inclusive_pueco_benin')).toBe('1pwr_benin');
  });

  it('defaults Lesotho orgs and unknown ids to the Lesotho fleet', () => {
    expect(prOrgToFleetOrg('1pwr_lesotho')).toBe('1pwr_lesotho');
    expect(prOrgToFleetOrg('1PWR Lesotho')).toBe('1pwr_lesotho');
    expect(prOrgToFleetOrg('smp')).toBe('1pwr_lesotho');
    expect(prOrgToFleetOrg('pueco_lesotho')).toBe('1pwr_lesotho');
    expect(prOrgToFleetOrg('neo1')).toBe('1pwr_lesotho');
    expect(prOrgToFleetOrg('')).toBe('1pwr_lesotho');
    expect(prOrgToFleetOrg(undefined)).toBe('1pwr_lesotho');
  });
});

describe('resolveFleetVehicleId', () => {
  const vehicles = [
    { id: 'legacy-doc', fmVehicleId: 'fm-uuid-1' },
    { id: 'fm-uuid-2', fmVehicleId: 'fm-uuid-2' },
    { id: 'no-fm-id' },
  ];

  it('prefers fmVehicleId when the stored value is the Firestore doc id', () => {
    expect(resolveFleetVehicleId('legacy-doc', vehicles)).toBe('fm-uuid-1');
  });

  it('keeps an already-canonical FM UUID', () => {
    expect(resolveFleetVehicleId('fm-uuid-2', vehicles)).toBe('fm-uuid-2');
    expect(resolveFleetVehicleId('fm-uuid-1', vehicles)).toBe('fm-uuid-1');
  });

  it('falls back to the stored id when there is no FM id', () => {
    expect(resolveFleetVehicleId('no-fm-id', vehicles)).toBe('no-fm-id');
    expect(resolveFleetVehicleId('unknown', vehicles)).toBe('unknown');
    expect(resolveFleetVehicleId('', vehicles)).toBe('');
  });
});

describe('isWoGatedExpense', () => {
  it('gates code 4 everywhere and Benin repair codes only for 1PWR Benin aliases', () => {
    expect(isWoGatedExpense('4', 'kuwala')).toBe(true);
    expect(isWoGatedExpense('624200', '1PWR Benin')).toBe(true);
    expect(isWoGatedExpense('624300', '1pwr_ben')).toBe(true);
    expect(isWoGatedExpense('624800', '1pb')).toBe(true);
    expect(isWoGatedExpense('624200', 'mgb')).toBe(false);
    expect(isWoGatedExpense('624200', '1pwr_lesotho')).toBe(false);
    expect(isWoGatedExpense('4F', '1pwr_benin')).toBe(false);
  });
});
