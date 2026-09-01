import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';

/**
 * Fleet Hub work-order lookups for the PR flow. Vehicle-expense PRs (expense
 * type code 4) must link an open FM work order before they can be pushed to an
 * approver; these wrap the server-side callables (Fleet key never reaches the
 * browser).
 */
export interface FleetWorkOrder {
  id: string;
  organizationId: string;
  vehicleId: string;
  vehicleCode?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  title: string;
  description?: string;
  type?: string;
  priority?: string;
  status: string;
  totalCost?: number;
  totalLabourHours?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ListFleetWorkOrdersResult {
  count: number;
  workOrders: FleetWorkOrder[];
}

export interface ValidateFleetWorkOrderResult {
  ok: boolean;
  reason?: string;
  workOrder?: FleetWorkOrder;
}

/**
 * PR organization → Fleet Hub organization (the fleet is registered under the
 * main country org in FM; sub-entities share it).
 */
export function prOrgToFleetOrg(prOrgId?: string | null): string {
  switch ((prOrgId || '').toLowerCase()) {
    case '1pwr_zambia':
    case 'kuwala':
      return '1pwr_zambia';
    case '1pwr_benin':
    case 'mgb':
    case 'pueco_benin':
      return '1pwr_benin';
    default:
      return '1pwr_lesotho';
  }
}

/** Benin chart-of-accounts codes for vehicle repair/maintenance (Entretien réparation). */
export const BENIN_WO_GATED_CODES = ['624200', '624300', '624800'];

/**
 * The FM work-order gate applies to code 4 (vehicle parts/service) everywhere,
 * and to Benin's repair codes only for the 1PWR Benin org (mgb / pueco_benin
 * have no FM-registered vehicles yet — gating them would block with no remedy).
 */
export function isWoGatedExpense(code: string | undefined, prOrgId?: string | null): boolean {
  if (code === '4') return true;
  if ((prOrgId || '') === '1pwr_benin' && BENIN_WO_GATED_CODES.includes(code || '')) return true;
  return false;
}

export async function listFleetWorkOrders(opts: {
  org?: string;
  vehicleId?: string;
  status?: string;
}): Promise<ListFleetWorkOrdersResult> {
  const fn = httpsCallable<typeof opts, ListFleetWorkOrdersResult>(functions, 'listFleetWorkOrders');
  const res = await fn(opts);
  return res.data;
}

/** Server-side re-validation at push-to-approver time. */
export async function validateFleetWorkOrderForPr(opts: {
  workOrderId: string;
  vehicleId?: string;
}): Promise<ValidateFleetWorkOrderResult> {
  const fn = httpsCallable<typeof opts, ValidateFleetWorkOrderResult>(
    functions,
    'validateFleetWorkOrderForPr'
  );
  const res = await fn(opts);
  return res.data;
}
