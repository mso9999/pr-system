import { db } from "@/config/firebase";
import { collection, getDocs, query, where, addDoc, writeBatch, doc, setDoc, getDoc } from "firebase/firestore";

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
export const ORG_INDEPENDENT_TYPES = ['vendors', 'currencies', 'organizations', 'uom', 'permissions'];

class ReferenceDataService {
  private db = db;

  private getCollectionName(type: string): string {
    return `${COLLECTION_PREFIX}${type}`;
  }

  private generateId(type: string, code: string): string {
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
    if (!orgId) return '';
    
    // Handle both string and object cases
    const rawId = typeof orgId === 'string' ? orgId : orgId.id;
    
    // Convert to lowercase and replace any non-alphanumeric chars with underscore
    const normalized = rawId.toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')  // Replace multiple underscores with single
      .replace(/^_|_$/g, ''); // Remove leading/trailing underscores
    
    return normalized;
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
        );
      }

      const querySnapshot = await getDocs(q);
      
      const items = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ReferenceData[];

      // Filter inactive items
      const activeItems = items.filter(item => item.active);

      return activeItems;
    } catch (error) {
      return this.handleError(error, 'getting reference data items');
    }
  }

  async getDepartments(organization: string | OrganizationData): Promise<ReferenceData[]> {
    try {
      const collectionRef = collection(this.db, this.getCollectionName('departments'));
      const normalizedOrgId = this.normalizeOrganizationId(organization);
      
      // Query for departments where organizationId matches
      const q = query(
        collectionRef,
        where('organizationId', '==', normalizedOrgId)
      );
      
      const querySnapshot = await getDocs(q);

      const items = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ReferenceData[];

      return items.filter(item => item.active);
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
}

export const referenceDataService = new ReferenceDataService();
