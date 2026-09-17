import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';
import { normalizeOrganizationId } from '../utils/organization';

/**
 * Fleet Hub work-order lookups for the PR flow. Vehicle-expense PRs (expense
 * type code 4) must link an open FM work order before they can be pushed to an
 * approver; these wrap the server-side callables (Fleet key never reaches the
 * browser).
 */
export interface FleetWorkOrder {
  id: string;
  /** Human-readable number, e.g. WO-LS-2026-00042 (empty on pre-2026 rows until backfilled). */
  workOrderNumber?: string;
  organizationId: string;
  vehicleId: string;
  vehicleCode?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  title: string;
  description?: string;
  symptom?: string;
  diagnosis?: string;
  intervention?: string;
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
  /** Total matching rows server-side (before limit/offset) — drives the pager. */
  total?: number;
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
 *
 * Goes through `normalizeOrganizationId` first so aliases (1pwr_zam, 1pz,
 * "1PWR Zambia", kuw, 1pwr_ben, 1pb, inclusive pueco, …) land on the same
 * country fleet as the catalog id — same bug class as the Kuwala picker fix.
 */
const FLEET_ORG_BY_PR_ORG: Record<string, string> = {
  '1pwr_zambia': '1pwr_zambia',
  kuwala: '1pwr_zambia',
  '1pwr_benin': '1pwr_benin',
  mgb: '1pwr_benin',
  pueco_benin: '1pwr_benin',
};

export function prOrgToFleetOrg(prOrgId?: string | null): string {
  const id = normalizeOrganizationId(prOrgId);
  return FLEET_ORG_BY_PR_ORG[id] || '1pwr_lesotho';
}

/**
 * FM filters work orders by `wo.vehicle_id` (FM UUID). Synced catalog rows
 * store that as `fmVehicleId`; leftover legacy docs only have the Firestore
 * id. Prefer the FM id so the picker does not silently return [].
 */
export function resolveFleetVehicleId(
  storedVehicleId?: string | null,
  vehicles?: Array<{ id?: string; fmVehicleId?: string; code?: string; fleetCode?: string; name?: string }> | null
): string {
  const stored = (storedVehicleId || '').trim();
  if (!stored) return '';
  const rows = vehicles || [];
  const row = rows.find((v) => v.id === stored || v.fmVehicleId === stored);
  if (row?.fmVehicleId) return row.fmVehicleId.trim();

  // Fallback: the stored doc has no FM id (legacy nickname rows like "Surf 2").
  // Find sibling mirror rows with the same display code that carry one — used
  // only when exactly one matches (ambiguous duplicates stay unresolved rather
  // than linking the wrong vehicle).
  const code = (row?.fleetCode || row?.code || row?.name || '').trim().toLowerCase();
  if (code) {
    const siblings = rows.filter(
      (v) => (v.fmVehicleId || '').trim() !== '' &&
        [v.fleetCode, v.code, v.name].some((c) => (c || '').trim().toLowerCase() === code)
    );
    if (siblings.length === 1 && siblings[0].fmVehicleId) return siblings[0].fmVehicleId.trim();
  }
  return stored;
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
  if (normalizeOrganizationId(prOrgId) === '1pwr_benin' && BENIN_WO_GATED_CODES.includes(code || '')) {
    return true;
  }
  return false;
}

export async function listFleetWorkOrders(opts: {
  org?: string;
  vehicleId?: string;
  status?: string;
  /** Text search over WO title / description / vehicle code. */
  q?: string;
  /** Page size (default 100 server-side; the modal picker pages with limit+offset). */
  limit?: number;
  offset?: number;
  /** recent (default) | priority | status */
  sort?: string;
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
