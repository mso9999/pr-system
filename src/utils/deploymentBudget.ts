/**
 * Cash budget around a deployment. Food stays with the provisioning wizard.
 * Lesotho and Benin share the steps. Currency, labels, category codes, and
 * the fuel safety-factor default change with the organisation.
 */

export type FoodMode = 'provisioning' | 'lump';

export interface OrgBudgetProfile {
  currency: 'LSL' | 'XOF';
  /** Lesotho's approved factor is 2 (T002V03). Benin stays at 1 until an admin sets another. */
  defaultSafetyFactor: number;
  showCategoryCodes: boolean;
  labels: {
    food: string;
    fuel: string;
    perDiem: string;
    lodging: string;
    transport: string;
    materials: string;
    contingency: string;
    wages: string;
  };
}

export interface FuelLeg {
  id: string;
  label: string;
  kilometres: number;
  pricePerLitre: number;
  kmPerLitre: number;
  safetyFactor: number;
}

export interface CashLine {
  id: string;
  kind: 'perDiem' | 'lodging' | 'transport' | 'materials' | 'contingency' | 'wages';
  quantity: number;
  unitPrice: number;
  /** Lesotho monthly-thrust code. Hidden for Benin. */
  categoryCode: string;
}

export interface PartyMember {
  id: string;
  name: string;
  departureDate: string;
  departureTime: string;
  returnDate: string;
  returnTime: string;
  days: number;
}

export interface DeploymentBudgetInput {
  foodMode: FoodMode;
  foodAmount: number;
  fuelLegs: FuelLeg[];
  /** When Fleet Hub has already priced the mission, this replaces the leg sum. */
  fleetFuelAmount: number | null;
  lines: CashLine[];
}

export interface BudgetLineResult {
  id: string;
  label: string;
  categoryCode: string | null;
  amount: number;
}

const LESOTHO: OrgBudgetProfile = {
  currency: 'LSL',
  defaultSafetyFactor: 2,
  showCategoryCodes: true,
  labels: {
    food: 'Food',
    fuel: 'Fuel',
    perDiem: 'Per diem',
    lodging: 'Lodging',
    transport: 'Transport',
    materials: 'Materials and other',
    contingency: 'Contingency',
    wages: 'Casuals',
  },
};

const BENIN: OrgBudgetProfile = {
  currency: 'XOF',
  defaultSafetyFactor: 1,
  showCategoryCodes: false,
  labels: {
    food: 'Restauration',
    fuel: 'Carburant',
    perDiem: 'Perdiem',
    lodging: 'Hébergement',
    transport: 'Transport',
    materials: 'Matériaux',
    contingency: 'Imprévus',
    wages: 'Manoeuvres',
  },
};

export function budgetProfile(organizationId: string): OrgBudgetProfile {
  const id = (organizationId || '').toLowerCase();
  if (id.includes('benin') || id === 'mgb') return BENIN;
  return LESOTHO;
}

/** Travel fuel estimator. Volume is kilometres ÷ km/L, then × price × safety factor. */
export function fuelLegCost(leg: FuelLeg): number {
  if (leg.kmPerLitre <= 0 || leg.kilometres < 0 || leg.pricePerLitre < 0 || leg.safetyFactor < 0) {
    return 0;
  }
  return (leg.kilometres / leg.kmPerLitre) * leg.pricePerLitre * leg.safetyFactor;
}

export function cashLineAmount(line: CashLine): number {
  if (line.quantity < 0 || line.unitPrice < 0) return 0;
  return line.quantity * line.unitPrice;
}

export function defaultCashLines(): CashLine[] {
  return [
    { id: 'perDiem', kind: 'perDiem', quantity: 0, unitPrice: 0, categoryCode: '9' },
    { id: 'lodging', kind: 'lodging', quantity: 0, unitPrice: 0, categoryCode: '9' },
    { id: 'transport', kind: 'transport', quantity: 0, unitPrice: 0, categoryCode: '9' },
    { id: 'materials', kind: 'materials', quantity: 0, unitPrice: 0, categoryCode: '3' },
    { id: 'contingency', kind: 'contingency', quantity: 1, unitPrice: 0, categoryCode: '16' },
    { id: 'wages', kind: 'wages', quantity: 0, unitPrice: 0, categoryCode: '15' },
  ];
}

/** Inclusive day count from departure date to return date. Empty dates yield 0. */
export function daysBetween(departureDate: string, returnDate: string): number {
  if (!departureDate || !returnDate) return 0;
  const start = Date.parse(departureDate);
  const end = Date.parse(returnDate);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0;
  return Math.round((end - start) / 86_400_000) + 1;
}

export function computeDeploymentBudget(
  profile: OrgBudgetProfile,
  input: DeploymentBudgetInput,
): { lines: BudgetLineResult[]; total: number; currency: OrgBudgetProfile['currency'] } {
  const fuelFromLegs = input.fuelLegs.reduce((sum, leg) => sum + fuelLegCost(leg), 0);
  const fuel = input.fleetFuelAmount != null ? input.fleetFuelAmount : fuelFromLegs;
  const results: BudgetLineResult[] = [
    {
      id: 'food',
      label: profile.labels.food,
      categoryCode: profile.showCategoryCodes ? '16' : null,
      amount: input.foodAmount,
    },
    {
      id: 'fuel',
      label: profile.labels.fuel,
      categoryCode: profile.showCategoryCodes ? '11' : null,
      amount: fuel,
    },
  ];
  for (const line of input.lines) {
    results.push({
      id: line.id,
      label: profile.labels[line.kind],
      categoryCode: profile.showCategoryCodes ? line.categoryCode : null,
      amount: cashLineAmount(line),
    });
  }
  const total = results.reduce((sum, line) => sum + line.amount, 0);
  return { lines: results, total, currency: profile.currency };
}
