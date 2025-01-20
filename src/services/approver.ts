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
      console.log('ApproverService: Getting active approvers');
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

      console.log(`ApproverService: Found ${approvers.length} active approvers`);
      console.log('ApproverService: Approvers:', approvers);
      return approvers;
    } catch (error) {
      console.error('ApproverService: Error getting active approvers:', error);
      throw new Error('Failed to get active approvers. Please try again.');
    }
  }

  async getApprovers(organizationId: string): Promise<Approver[]> {
    try {
      console.log('ApproverService: Getting approvers for organization:', organizationId);
      const usersRef = collection(this.db, 'users');
      
      // Query users with permission level 1 or 2 and isActive=true
      const q = query(
        usersRef,
        where('permissionLevel', 'in', [1, 2]),
        where('isActive', '==', true)
      );
      
      const querySnapshot = await getDocs(q);
      
      // Log all users found with their raw data
      console.log('ApproverService: Raw users:', querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          firstName: data.firstName,
          lastName: data.lastName,
          permissionLevel: data.permissionLevel,
          organization: data.organization,
          organizationId: data.organizationId,
          // Log all fields that might contain the organization
          allFields: Object.keys(data).filter(key => 
            typeof key === 'string' && 
            key.toLowerCase().includes('org')
          ).reduce((obj, key) => ({
            ...obj,
            [key]: data[key]
          }), {})
        };
      }));
      
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
          // Log each approver and whether they pass the filter
          const isGlobal = approver.permissionLevel === 1;
          const normalizedApproverOrg = this.normalizeOrganizationId(approver.organization || '');
          const normalizedTargetOrg = this.normalizeOrganizationId(organizationId);
          const isOrgMatch = approver.permissionLevel === 2 && normalizedApproverOrg === normalizedTargetOrg;
          console.log('ApproverService: Filtering approver:', {
            approver,
            isGlobal,
            isOrgMatch,
            organizationId,
            organizationComparison: {
              approverOrg: approver.organization,
              normalizedApproverOrg,
              targetOrg: organizationId,
              normalizedTargetOrg,
              isEqual: normalizedApproverOrg === normalizedTargetOrg
            }
          });
          return isGlobal || isOrgMatch;
        });

      console.log(`ApproverService: Found ${approvers.length} approvers:`, approvers);
      return approvers;
    } catch (error) {
      console.error('Error getting approvers:', error);
      throw error;
    }
  }

  async getDepartmentApprovers(organization: string | { id: string; name: string }, department: string): Promise<Approver[]> {
    try {
      const normalizedOrgId = this.normalizeOrganizationId(organization);
      console.log('ApproverService: Getting approvers for department:', department);
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

      console.log(`ApproverService: Found ${approvers.length} approvers for department ${department}`);
      console.log('ApproverService: Approvers:', approvers);
      return approvers;
    } catch (error) {
      console.error('ApproverService: Error getting department approvers:', error);
      throw new Error(`Failed to get approvers for department ${department}. Please try again.`);
    }
  }
}

export const approverService = new ApproverService();
