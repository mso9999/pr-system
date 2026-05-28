import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { organizationService } from '@/services/organizationService';
import type { PRRequest } from '@/types/pr';

export type PRRequestSideEmailFields = Pick<
  PRRequest,
  'organization' | 'department' | 'requestorEmail' | 'requestor'
>;

export function getDirectRequestorEmail(pr: PRRequestSideEmailFields): string | undefined {
  const e = (pr.requestorEmail || pr.requestor?.email)?.trim();
  return e || undefined;
}

/**
 * Departmental notification address when configured on referenceData_departments for
 * this PR's organization and department; otherwise the individual requestor email.
 */
export async function resolveRequestSideNotificationEmail(
  pr: PRRequestSideEmailFields
): Promise<string | undefined> {
  const direct = getDirectRequestorEmail(pr);
  const deptId = pr.department?.trim();
  if (!deptId) return direct;

  try {
    const deptSnap = await getDoc(doc(db, 'referenceData_departments', deptId));
    if (!deptSnap.exists()) return direct;

    const data = deptSnap.data();
    const configured =
      typeof data.notificationEmail === 'string' ? data.notificationEmail.trim() : '';
    if (!configured || !configured.includes('@')) return direct;

    const org = await organizationService.getOrganizationByName(pr.organization || '');
    if (!org || data.organizationId !== org.id) {
      return direct;
    }

    return configured;
  } catch {
    return direct;
  }
}
