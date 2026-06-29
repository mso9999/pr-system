import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';

export interface HrSyncTotals {
  hrEmployeesPulled: number;
  matched: number;
  provisioned: number;
  emailUpdated: number;
  departures: number;
  prOnly: number;
  unmappedDepartments: number;
  errors: number;
}

export interface HrSyncResult {
  success: boolean;
  totals: HrSyncTotals;
  reportId: string;
  unmappedDepartments: string[];
  errors: Array<{ email?: string; employeeId?: string; error: string }>;
}

export interface HrRefreshResult {
  success: boolean;
  outcome: 'matched' | 'provisioned' | 'not_found';
  uid?: string;
  email?: string;
}

export interface HrSmokeTestResult {
  ok: boolean;
  status: number;
  message: string;
}

export async function runHrEmployeeSyncNow(): Promise<HrSyncResult> {
  const fn = httpsCallable<unknown, HrSyncResult>(functions, 'runHrEmployeeSyncNow');
  const res = await fn();
  return res.data;
}

export async function reconcileHrEmployees(): Promise<HrSyncResult> {
  const fn = httpsCallable<unknown, HrSyncResult>(functions, 'reconcileHrEmployees');
  const res = await fn();
  return res.data;
}

export async function refreshUserFromHr(employeeId: string): Promise<HrRefreshResult> {
  const fn = httpsCallable<{ employeeId: string }, HrRefreshResult>(functions, 'refreshUserFromHr');
  const res = await fn({ employeeId });
  return res.data;
}

export async function hrSmokeTest(): Promise<HrSmokeTestResult> {
  const fn = httpsCallable<unknown, HrSmokeTestResult>(functions, 'hrSmokeTest');
  const res = await fn();
  return res.data;
}
