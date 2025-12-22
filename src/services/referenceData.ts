import { db } from "@/config/firebase";
import { collection, getDocs, query, where, addDoc, writeBatch, doc, setDoc, getDoc } from "firebase/firestore";
import { normalizeOrganizationId as normalizeOrgId } from "@/utils/organization";

export interface OrganizationData {
  id: string;
  name: string;
}

export interface ReferenceData {
  id: string;
  name: string;
  code?: string;
  type?: string;
  active: boolean;
  organization?: OrganizationData;
  organizationId?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}

const COLLECTION_PREFIX = "referenceData_";
export const ORG_INDEPENDENT_TYPES = ['vendors', 'currencies', 'organizations', 'uom', 'permissions', 'paymentTypes'];

class ReferenceDataService {
  private db = db;

  private getCollectionName(type: string): string {
    return `${COLLECTION_PREFIX}${type}`;
  }

  private generateId(type: string, code: string): string | null {
    if (['currencies', 'uom', 'organizations'].includes(type)) {
      return code.toLowerCase().replace(/[^a-z0-9]/g, '_');
    }
    return null; // Let Firestore auto-generate
  }

  private handleError(error: any, context: string): never {
    console.error(`Error ${context}:`, error);
    throw error;
  }

  private normalizeOrganizationId(orgId: string | OrganizationData): string {
    // Use the centralized normalization function that includes the alias map
    return normalizeOrgId(orgId);
  }

  async getItemsByType(type: string, organization?: string | OrganizationData): Promise<ReferenceData[]> {
    try {
      const collectionName = this.getCollectionName(type);
      const collectionRef = collection(this.db, collectionName);
      let q = collectionRef;

      // Only filter by organization for org-dependent types
      if (!ORG_INDEPENDENT_TYPES.includes(type) && organization) {
        const normalizedOrgId = this.normalizeOrganizationId(organization);
        
        // Query for both old and new organization field formats
        q = query(
          collectionRef, 
          where('organizationId', '==', normalizedOrgId)
        ) as any; // Type workaround for Firestore query types
      }

      const querySnapshot = await getDocs(q);
      
      const items = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ReferenceData[];

      // Filter inactive items
      // For vendors, check 'approved' or 'Approved' field, for others check 'active'
      const activeItems = items.filter(item => {
        if (type === 'vendors') {
          // Check both lowercase and uppercase 'approved'/'Approved' fields
          const approvedValue = item.approved !== undefined ? item.approved : item.Approved;
          const activeValue = item.active !== undefined ? item.active : item.isActive;
          
          // Vendor is active if approved is true, "TRUE", empty string, undefined, OR active is true
          const shouldInclude = approvedValue === true || 
                 approvedValue === 'TRUE' || 
                 approvedValue === '' || 
                 approvedValue === undefined || 
                 activeValue === true;
          
          // Debug logging for vendor 1030 specifically
          if (item.id === '1030' || item.code === '1030') {
            console.debug(`[VENDOR DEBUG] referenceData.ts filtering vendor 1030: approved=${approvedValue}, active=${activeValue}, shouldInclude=${shouldInclude}`);
          }
          
          return shouldInclude;
        }
        // For departments and other types, check 'active' field
        // Default to true if not specified (include items without active field)
        const active = item.active !== undefined ? item.active : (item.Active !== undefined ? item.Active : true);
        const isActive = active === true || active === 'true' || active === undefined || active === null;
        if (!isActive && organization) {
          console.log(`[getItemsByType] Filtered out inactive ${type} item:`, { id: item.id, name: item.name, active, organization: this.normalizeOrganizationId(organization) });
        }
        return isActive;
      });
      
      // Check if vendor 1030 is in active items after filtering
      if (type === 'vendors') {
        const vendor1030 = activeItems.find(v => v.id === '1030' || v.code === '1030');
        if (vendor1030) {
          console.debug('[VENDOR DEBUG] referenceData.ts: vendor 1030 INCLUDED in active items:', {
            id: vendor1030.id,
            name: vendor1030.name,
            active: vendor1030.active,
            approved: vendor1030.approved
          });
        } else {
          console.error('[VENDOR DEBUG] referenceData.ts: vendor 1030 FILTERED OUT. Total items before filter:', items.length, ', after filter:', activeItems.length);
        }
      }

      return activeItems;
    } catch (error) {
      return this.handleError(error, 'getting reference data items');
    }
  }

  async getDepartments(organization: string | OrganizationData): Promise<ReferenceData[]> {
    try {
      const collectionRef = collection(this.db, this.getCollectionName('departments'));
      const normalizedOrgId = this.normalizeOrganizationId(organization);
      
      console.log(`[getDepartments] Called with organization:`, organization);
      console.log(`[getDepartments] Normalized org ID:`, normalizedOrgId);
      
      // Try multiple possible organizationId formats
      const possibleOrgIds = [
        normalizedOrgId,
        ...(typeof organization === 'object' && organization.code ? [organization.code.toLowerCase()] : []),
        ...(typeof organization === 'object' && organization.id ? [organization.id.toLowerCase()] : []),
        ...(typeof organization === 'object' && organization.name ? [organization.name.toLowerCase().replace(/[^a-z0-9]/g, '_')] : [])
      ].filter((id, index, arr) => arr.indexOf(id) === index); // Remove duplicates
      
      console.log(`[getDepartments] Trying organizationIds:`, possibleOrgIds);
      
      // Query for departments where organizationId matches any of the possible formats
      let querySnapshot;
      let foundItems: any[] = [];
      
      for (const orgId of possibleOrgIds) {
        const q = query(
          collectionRef,
          where('organizationId', '==', orgId)
        );
        
        console.log(`[getDepartments] Querying for organizationId == "${orgId}"`);
        querySnapshot = await getDocs(q);
        console.log(`[getDepartments] Found ${querySnapshot.size} departments with organizationId "${orgId}"`);
        
        if (querySnapshot.size > 0) {
          const items = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          foundItems.push(...items);
          console.log(`[getDepartments] Sample department data:`, items[0] ? { id: items[0].id, name: items[0].name, organizationId: items[0].organizationId, active: items[0].active } : 'none');
        }
      }
      
      // Remove duplicates by id
      const uniqueItems = foundItems.filter((item, index, self) => 
        index === self.findIndex(t => t.id === item.id)
      );
      
      console.log(`[getDepartments] Total unique departments found: ${uniqueItems.length}`);

      const items = uniqueItems as ReferenceData[];

      console.log(`[getDepartments] Found ${items.length} departments for org ${normalizedOrgId}, active status:`, items.map(item => ({ id: item.id, name: item.name, organizationId: item.organizationId, active: item.active })));

      // Filter by active status - match the logic in getItemsByType
      // Include items where active is not explicitly false (default to true if undefined)
      const activeItems = items.filter(item => {
        const active = item.active !== undefined ? item.active : (item.Active !== undefined ? item.Active : true);
        // Include if active is true, 'true', undefined, or null (only exclude if explicitly false)
        const isActive = active !== false && active !== 'false';
        if (!isActive) {
          console.log(`[getDepartments] Filtered out inactive department:`, { id: item.id, name: item.name, active, org: normalizedOrgId });
        }
        return isActive;
      });

      console.log(`[getDepartments] After filtering, ${activeItems.length} active departments for org ${normalizedOrgId}`);
      if (activeItems.length === 0 && items.length > 0) {
        console.warn(`[getDepartments] All ${items.length} departments for org ${normalizedOrgId} were filtered out. Check active field values.`);
      }
      return activeItems;
    } catch (error) {
      return this.handleError(error, 'getting departments');
    }
  }

  async getProjectCategories(organization: string): Promise<ReferenceData[]> {
    return this.getItemsByType('projectCategories', organization);
  }

  async getSites(organization: string): Promise<ReferenceData[]> {
    return this.getItemsByType('sites', organization);
  }
  
  async getVendors(organization?: string): Promise<ReferenceData[]> {
    return this.getItemsByType('vendors', organization || '');
  }

  async getExpenseTypes(organization: string): Promise<ReferenceData[]> {
    return this.getItemsByType('expenseTypes', organization);
  }

  async getVehicles(organization: string): Promise<ReferenceData[]> {
    return this.getItemsByType('vehicles', organization);
  }

  async getOrganizations(): Promise<ReferenceData[]> {
    return this.getItemsByType('organizations');
  }

  async getCurrencies(): Promise<ReferenceData[]> {
    return this.getItemsByType('currencies');
  }

  async createItem(type: string, data: Omit<ReferenceData, 'id'>): Promise<ReferenceData> {
    try {
      const collectionName = this.getCollectionName(type);
      const collectionRef = collection(this.db, collectionName);

      // Ensure required fields for organization-specific types
      if (!ORG_INDEPENDENT_TYPES.includes(type)) {
        if (!data.organizationId) {
          throw new Error('Organization ID is required');
        }

        // Get organization details
        const orgDoc = await getDoc(doc(this.db, 'referenceData_organizations', data.organizationId));
        if (!orgDoc.exists()) {
          throw new Error('Organization not found');
        }

        const org = orgDoc.data() as ReferenceData;
        data.organization = {
          id: org.id,
          name: org.name
        };
      }

      // Handle organization field
      if (data.organization) {
        const normalizedOrgId = this.normalizeOrganizationId(data.organization);
        data.organizationId = normalizedOrgId;
      }

      // Generate ID for code-based types
      const id = data.code ? this.generateId(type, data.code) : null;
      const timestamp = new Date().toISOString();

      const itemData = {
        ...data,
        active: true,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      if (id) {
        const docRef = doc(collectionRef, id);
        await setDoc(docRef, itemData);
        return { ...itemData, id };
      } else {
        const docRef = await addDoc(collectionRef, itemData);
        return { ...itemData, id: docRef.id };
      }
    } catch (error) {
      return this.handleError(error, 'creating reference data item');
    }
  }

  async getVendorById(vendorId: string): Promise<ReferenceData | null> {
    try {
      const docRef = doc(this.db, this.getCollectionName('vendors'), vendorId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data()
        } as ReferenceData;
      }
      
      return null;
    } catch (error) {
      return this.handleError(error, 'getting vendor by ID');
    }
  }

  async getRules(organization?: string | OrganizationData): Promise<ReferenceData[]> {
    try {
      const rulesCollection = collection(this.db, 'referenceData_rules');
      let q = rulesCollection;

      if (organization) {
        const normalizedOrgId = this.normalizeOrganizationId(organization);
        if (normalizedOrgId) {
          q = query(
            rulesCollection,
            where('organizationId', '==', normalizedOrgId)
          ) as any;
        }
      }

      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        console.warn('[ReferenceDataService] No rules found for organization:', organization);
        return [];
      }

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ReferenceData[];
    } catch (error) {
      return this.handleError(error, 'getting rules');
    }
  }
}

export const referenceDataService = new ReferenceDataService();
