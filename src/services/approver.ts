import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { normalizeOrganizationId } from '@/utils/organization';
import { functions } from '@/config/firebase';

interface Approver {
  id: string;
  name: string;
  email: string;
  permissionLevel: number;  // 1 for global, 2 for organization
  organization?: string;  // Only for Level 2 approvers
  additionalOrganizations?: string[];
  normalizedOrganization?: string;
  normalizedAdditionalOrganizations?: string[];
  department?: string;
  isActive: boolean;
}

class ApproverService {
  private db = getFirestore();

  async getActiveApprovers(): Promise<Approver[]> {
    try {
      const usersRef = collection(this.db, 'users');
      const q = query(usersRef, where('isActive', '==', true));
      const querySnapshot = await getDocs(q);
      
      const approvers = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: `${data.firstName} ${data.lastName}`.trim(),
          email: data.email || '',
          permissionLevel: data.permissionLevel || 0,
          organization: data.organization || '',
          department: data.department || '',
          isActive: data.isActive === true
        } as Approver;
      });

      return approvers;
    } catch (error) {
      console.error('ApproverService: Error getting active approvers:', error);
      throw new Error('Failed to get active approvers. Please try again.');
    }
  }

  /**
   * Canonical approver resolution via the getPrApprovers Cloud Function:
   * approval authority from PR `users` joined with org coverage + active
   * employment from the HR directory (the canonical source). A sync gap in
   * the PR copy can no longer remove an approver. Falls back to the direct
   * Firestore read if the function is unreachable (e.g. HR API outage).
   */
  private async getApproversFromCanonical(organizationId: string): Promise<Approver[]> {
    const call = httpsCallable(functions, 'getPrApprovers');
    // Normalize with the alias map before calling: PRView passes the stored
    // org display name ("Sotho Minigrid Portfolio") while NewPRForm passes the
    // catalog id ("smp"). The callable's server-side normalizer is
    // alias-free, so name-form input silently dropped org-scoped (level 2/6)
    // approvers — 2026-09-03, Tumelo vanished from SMP push-to-approver.
    const normalized = normalizeOrganizationId(organizationId);
    const res = await call({ organizationId: normalized || organizationId });
    const payload = res.data as { approvers?: Approver[] };
    if (!payload || !Array.isArray(payload.approvers)) {
      throw new Error('getPrApprovers returned an unexpected payload');
    }
    return payload.approvers;
  }

  async getApprovers(organizationId: string): Promise<Approver[]> {
    try {
      return await this.getApproversFromCanonical(organizationId);
    } catch (canonicalError) {
      console.warn('ApproverService: canonical getPrApprovers failed, falling back to direct read:', canonicalError);
    }
    try {
      const usersRef = collection(this.db, 'users');
      
      // Query users with permission level 1, 2, or 6 and isActive=true
      // Level 1: Admin, Level 2: Senior Approver, Level 6: Finance Approver
      const q = query(
        usersRef,
        where('permissionLevel', 'in', [1, 2, 6]),
        where('isActive', '==', true)
      );
      
      const querySnapshot = await getDocs(q);
      
      // Filter and map users to approvers
      const normalizedTargetOrgId = normalizeOrganizationId(organizationId);

      const approvers = querySnapshot.docs
        .map(doc => {
          const data = doc.data();
          const permissionLevel = Number(data.permissionLevel ?? 0);
          const additionalOrganizations: string[] = Array.isArray(data.additionalOrganizations)
            ? data.additionalOrganizations
            : [];
          // Fall back to the legacy organizationId when organization is unset:
          // a null here silently removes Level 2 approvers from every approver
          // list (2026-08-20: Tumelo Makhetha "disappeared" this way when the
          // HR sync wrote organization:null over his existing assignment).
          const normalizedOrganization = normalizeOrganizationId(data.organization || data.organizationId || '');
          const normalizedAdditionalOrganizations = additionalOrganizations
            .map(org => normalizeOrganizationId(org))
            .filter(Boolean);

          return {
            id: doc.id,
            name: `${data.firstName} ${data.lastName}`.trim(),
            email: data.email || '',
            permissionLevel,
            organization: data.organization,
            additionalOrganizations,
            normalizedOrganization,
            normalizedAdditionalOrganizations,
            department: data.department,
            isActive: data.isActive === true
          } as Approver;
        })
        .filter(approver => {
          if (approver.permissionLevel === 6) {
            return approver.email?.toLowerCase() === 'admin@1pwrafrica.com';
          }
          // Level 1 approvers (global) are always included
          if (approver.permissionLevel === 1) return true;
          
          // Level 2 (Senior Approvers) must match the organization
          if (approver.permissionLevel === 2) {
            if (!normalizedTargetOrgId) return true;
            const matchesPrimary = !!approver.normalizedOrganization && normalizedTargetOrgId === approver.normalizedOrganization;
            const matchesAdditional = approver.normalizedAdditionalOrganizations?.includes(normalizedTargetOrgId);
            return matchesPrimary || Boolean(matchesAdditional);
          }
          
          // Level 6 (Finance Approvers) must match the organization
          if (approver.permissionLevel === 6) {
            if (!normalizedTargetOrgId) return true;
            const matchesPrimary = !!approver.normalizedOrganization && normalizedTargetOrgId === approver.normalizedOrganization;
            const matchesAdditional = approver.normalizedAdditionalOrganizations?.includes(normalizedTargetOrgId);
            return matchesPrimary || Boolean(matchesAdditional);
          }
          
          return false;
        });

      return approvers;
    } catch (error) {
      console.error('ApproverService: Error getting approvers:', error);
      throw new Error('Failed to get approvers. Please try again.');
    }
  }

  async getDepartmentApprovers(organization: string | { id: string; name: string }, department: string): Promise<Approver[]> {
    try {
      const normalizedOrgId = normalizeOrganizationId(organization);
      const usersRef = collection(this.db, 'users');
      const q = query(usersRef);
      const querySnapshot = await getDocs(q);
      
      const approvers = querySnapshot.docs.map(doc => {
        const data = doc.data();
        const permissionLevel = Number(data.permissionLevel ?? 0);
        const additionalOrganizations: string[] = Array.isArray(data.additionalOrganizations)
          ? data.additionalOrganizations
          : [];
        const normalizedOrganization = normalizeOrganizationId(data.organization || '');
        const normalizedAdditionalOrganizations = additionalOrganizations
          .map(org => normalizeOrganizationId(org))
          .filter(Boolean);

        return {
          id: doc.id,
          name: `${data.firstName} ${data.lastName}`.trim(),
          email: data.email || '',
          permissionLevel,
          organization: data.organization || '',
          additionalOrganizations,
          normalizedOrganization,
          normalizedAdditionalOrganizations,
          department: data.department || '',
          isActive: data.isActive === true
        } as Approver;
      }).filter(a => {
        if (a.permissionLevel === 6 && a.email?.toLowerCase() !== 'admin@1pwrafrica.com') {
          return false;
        }
        const matchesDepartment = a.department === department;
        if (!matchesDepartment) return false;

        if (!normalizedOrgId) return true;

        const matchesPrimary = !!a.normalizedOrganization && a.normalizedOrganization === normalizedOrgId;
        const matchesAdditional = a.normalizedAdditionalOrganizations?.includes(normalizedOrgId);

        return matchesPrimary || Boolean(matchesAdditional);
      });

      return approvers;
    } catch (error) {
      console.error('ApproverService: Error getting department approvers:', error);
      throw new Error(`Failed to get approvers for department ${department}. Please try again.`);
    }
  }
}

export const approverService = new ApproverService();
