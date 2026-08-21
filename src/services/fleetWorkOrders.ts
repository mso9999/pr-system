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
