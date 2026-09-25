import { describe, expect, it } from 'vitest';
import {
  budgetProfile,
  computeDeploymentBudget,
  daysBetween,
  defaultCashLines,
  fuelLegCost,
} from './deploymentBudget';

describe('deployment budget organisation', () => {
  it('uses LSL and safety factor 2 for Lesotho, and shows category codes', () => {
    const profile = budgetProfile('1pwr_lesotho');
    expect(profile.currency).toBe('LSL');
    expect(profile.defaultSafetyFactor).toBe(2);
    expect(profile.showCategoryCodes).toBe(true);
    expect(profile.labels.lodging).toBe('Lodging');
  });

  it('uses XOF and safety factor 1 for Benin, and hides category codes', () => {
    const profile = budgetProfile('1pwr_benin');
    expect(profile.currency).toBe('XOF');
    expect(profile.defaultSafetyFactor).toBe(1);
    expect(profile.showCategoryCodes).toBe(false);
    expect(profile.labels.food).toBe('Restauration');
    expect(profile.labels.contingency).toBe('Imprévus');
  });
});

describe('fuel estimator', () => {
  it('prices kilometres at the pump price and the safety factor', () => {
    // 240 km, 10 km/L, LSL 30/L, factor 2 → 24 L × 30 × 2
    expect(fuelLegCost({
      id: 'hq',
      label: 'HQ to site',
      kilometres: 240,
      pricePerLitre: 30,
      kmPerLitre: 10,
      safetyFactor: 2,
    })).toBeCloseTo(1440, 6);
  });
});

describe('MAK 4-week shape', () => {
  it('totals food, return fuel, running fuel, and per diem in LSL with codes', () => {
    const profile = budgetProfile('1pwr_lesotho');
    const lines = defaultCashLines().map((line) =>
      line.kind === 'perDiem' ? { ...line, quantity: 21, unitPrice: 72 } : line,
    );
    const result = computeDeploymentBudget(profile, {
      foodMode: 'lump',
      foodAmount: 21600,
      fuelLegs: [
        { id: 'return', label: 'HQ to MAK and back', kilometres: 240, pricePerLitre: 30, kmPerLitre: 10, safetyFactor: 1 },
        { id: 'running', label: 'Daily running', kilometres: 1200, pricePerLitre: 30, kmPerLitre: 10, safetyFactor: 1 },
      ],
      fleetFuelAmount: null,
      lines,
    });
    const byId = Object.fromEntries(result.lines.map((line) => [line.id, line]));
    expect(byId.food.categoryCode).toBe('16');
    expect(byId.fuel.categoryCode).toBe('11');
    expect(byId.perDiem.categoryCode).toBe('9');
    expect(byId.perDiem.amount).toBe(1512);
    expect(byId.fuel.amount).toBeCloseTo(4320, 6);
    expect(result.total).toBeCloseTo(21600 + 4320 + 1512, 6);
    expect(result.currency).toBe('LSL');
  });
});

describe('Benin mission sheet', () => {
  it('totals carburant, restauration, hébergement, transport, and imprévus in XOF', () => {
    const profile = budgetProfile('1pwr_benin');
    const lines = defaultCashLines().map((line) => {
      if (line.kind === 'lodging') return { ...line, quantity: 3, unitPrice: 7500 };
      if (line.kind === 'transport') return { ...line, quantity: 1, unitPrice: 15000 };
      if (line.kind === 'contingency') return { ...line, quantity: 1, unitPrice: 5000 };
      return line;
    });
    const result = computeDeploymentBudget(profile, {
      foodMode: 'lump',
      foodAmount: 6500 * 3,
      fuelLegs: [
        { id: 'gasoil', label: 'Gasoil', kilometres: 450, pricePerLitre: 700, kmPerLitre: 100 / 35, safetyFactor: 1 },
      ],
      fleetFuelAmount: null,
      lines,
    });
    expect(result.lines.every((line) => line.categoryCode === null)).toBe(true);
    expect(result.lines.find((line) => line.id === 'lodging')?.label).toBe('Hébergement');
    // 450 km at 35 L/100 km = 157.5 L × 700
    expect(result.lines.find((line) => line.id === 'fuel')?.amount).toBeCloseTo(157.5 * 700, 4);
    expect(result.currency).toBe('XOF');
    expect(result.total).toBeGreaterThan(6500 * 3 + 7500 * 3);
  });
});

describe('party dates', () => {
  it('counts the departure day and the return day', () => {
    expect(daysBetween('2026-09-01', '2026-09-07')).toBe(7);
    expect(daysBetween('', '2026-09-07')).toBe(0);
  });
});
