import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';

/** Mirror of the Fleet mission row returned by the Fleet Hub integration API. */
export interface FleetMissionPerson {
  employee_id: string;
  name: string;
  department?: string | null;
  country?: string | null;
}

export interface FleetMission {
  id: string;
  organization_id: string;
  title: string;
  destination: string;
  departure_date: string;
  return_date: string;
  mission_type: string;
  passengers: string;
  crew_size: number;
  personnel_manifest: string;
  loadout_summary: string;
  notes: string;
  status: string;
  approval_status: string;
  mission_profile: string;
  trip_shape: string;
  required_vehicle_class: string;
  created_at: string;
  updated_at: string;
}

export interface ListFleetMissionsResult {
  count: number;
  missions: FleetMission[];
}

export interface GetFleetMissionResult {
  mission: FleetMission | null;
}

export interface FleetSmokeTestResult {
  ok: boolean;
  status: number;
  message: string;
}

export async function listFleetMissions(opts?: {
  org?: string;
  approvalStatus?: string;
}): Promise<ListFleetMissionsResult> {
  const fn = httpsCallable<{ org?: string; approvalStatus?: string }, ListFleetMissionsResult>(
    functions,
    'listFleetMissions'
  );
  const res = await fn(opts ?? {});
  return res.data;
}

export async function getFleetMission(id: string, org?: string): Promise<GetFleetMissionResult> {
  const fn = httpsCallable<{ id: string; org?: string }, GetFleetMissionResult>(
    functions,
    'getFleetMission'
  );
  const res = await fn({ id, org });
  return res.data;
}

export async function fleetSmokeTest(): Promise<FleetSmokeTestResult> {
  const fn = httpsCallable<unknown, FleetSmokeTestResult>(functions, 'fleetSmokeTest');
  const res = await fn();
  return res.data;
}

/** Parse the personnel_manifest JSON string in the browser (defensive). */
export function parseFleetManifest(raw: string | null | undefined): FleetMissionPerson[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((p) => p && typeof p === 'object')
      .map((p) => ({
        employee_id: String((p as Record<string, unknown>).employee_id || ''),
        name: String((p as Record<string, unknown>).name || ''),
        department: ((p as Record<string, unknown>).department as string | null | undefined) ?? null,
        country: ((p as Record<string, unknown>).country as string | null | undefined) ?? null,
      }));
  } catch {
    return [];
  }
}

/** Whole days between two ISO dates (return − departure), minimum 0. */
export function fleetMissionDays(m: { departure_date?: string; return_date?: string }): number {
  const d = m.departure_date ? Date.parse(m.departure_date) : NaN;
  const r = m.return_date ? Date.parse(m.return_date) : NaN;
  if (!Number.isFinite(d) || !Number.isFinite(r)) return 0;
  const ms = r - d;
  if (ms <= 0) return 0;
  return Math.round(ms / 86_400_000);
}
