import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { User } from '../types/user';

interface Approver {
  id: string;
  name: string;
  email: string;
  permissionLevel: number;  // 1 for global, 2 for organization
  organization?: string;  // Only for Level 2 approvers
  department?: string;
  isActive: boolean;
}

class ApproverService {
  private db = getFirestore();

  private normalizeOrganizationId(orgId: string | { id: string; name: string }): string {
    if (!orgId) return '';
    const id = typeof orgId === 'string' ? orgId : orgId.id;
    return id.toLowerCase().replace(/[^a-z0-9]/g, '_');
  }

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

  async getApprovers(organizationId: string): Promise<Approver[]> {
    try {
      const usersRef = collection(this.db, 'users');
      
      // Query users with permission level 1 or 2 and isActive=true
      // Level 1: Admin, Level 2: Senior Approver
      const q = query(
        usersRef,
        where('permissionLevel', 'in', [1, 2]),
        where('isActive', '==', true)
      );
      
      const querySnapshot = await getDocs(q);
      
      // Filter and map users to approvers
      const approvers = querySnapshot.docs
        .map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            name: `${data.firstName} ${data.lastName}`.trim(),
            email: data.email || '',
            permissionLevel: data.permissionLevel,
            organization: data.organization,
            department: data.department,
            isActive: data.isActive === true
          } as Approver;
        })
        .filter(approver => {
          // Level 1 approvers (global) are always included
          if (approver.permissionLevel === 1) return true;
          
          // Level 2 (Senior Approvers) must match the organization
          if (approver.permissionLevel === 2) {
            const normalizedOrgId = this.normalizeOrganizationId(organizationId);
            const approverOrgId = this.normalizeOrganizationId(approver.organization || '');
            return normalizedOrgId === approverOrgId;
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
      const normalizedOrgId = this.normalizeOrganizationId(organization);
      const usersRef = collection(this.db, 'users');
      const q = query(usersRef);
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
      }).filter(a => 
        a.department === department && 
        a.organization === normalizedOrgId
      );

      return approvers;
    } catch (error) {
      console.error('ApproverService: Error getting department approvers:', error);
      throw new Error(`Failed to get approvers for department ${department}. Please try again.`);
    }
  }
}

export const approverService = new ApproverService();
