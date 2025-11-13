import { ReferenceDataItem } from "@/types/referenceData"
import { db } from "@/config/firebase"
import { collection, doc, getDocs, addDoc, updateDoc, deleteDoc, query, where, writeBatch, setDoc, getDoc, deleteField, or } from "firebase/firestore"

const COLLECTION_PREFIX = "referenceData_"
const CODE_BASED_ID_TYPES = ['currencies', 'uom', 'organizations', 'paymentTypes'] as const;
const ORGANIZATION_INDEPENDENT_TYPES = ['currencies', 'uom', 'organizations', 'vendors', 'permissions', 'paymentTypes'] as const;

export class ReferenceDataAdminService {
  private getCollectionName(type: string): string {
    return `${COLLECTION_PREFIX}${type}`;
  }

  async getItems(type: string, organization?: string): Promise<ReferenceDataItem[]> {
    const collectionName = this.getCollectionName(type);
    console.log(`Getting all items for type: ${type}, organization: ${organization}`);

    const collectionRef = collection(db, collectionName);
    let q = collectionRef as any;
    
    // Filter by organization if provided and type requires it
    if (organization && !ORGANIZATION_INDEPENDENT_TYPES.includes(type as any)) {
      q = query(collectionRef, where('organizationId', '==', this.standardizeOrgId(organization)));
    }
    
    const snapshot = await getDocs(q);

    if (type === 'vehicles') {
      console.log('All vehicles:', snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        organizationId: doc.data().organizationId,
        organization: doc.data().organization,
      })));
    }

    const items = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id || data.id || '', // Ensure we get the ID from either the document or the data
      } as ReferenceDataItem;
    });

    console.log(`Retrieved ${items.length} items from collection: ${collectionName}`);
    return items;
  }

  async addItem(type: string, item: Omit<ReferenceDataItem, "id">): Promise<string> {
    const collectionName = this.getCollectionName(type);
    console.log(`Adding item to collection: ${collectionName}`, item);
    const collectionRef = collection(db, collectionName);

    // Validate organization requirements
    if (!ORGANIZATION_INDEPENDENT_TYPES.includes(type as any)) {
      if (!item.organizationId && !item.organization?.id) {
        throw new Error(`Organization ID is required for type: ${type}`);
      }
      // Standardize organization ID
      const orgId = this.standardizeOrgId(item.organizationId || item.organization?.id || '');
      item.organizationId = orgId;
      if (item.organization) {
        item.organization.id = orgId;
      }
    } else if (type === 'vendors') {
      // For vendors, ensure organizationId is null and remove organization object
      item.organizationId = null;
      delete (item as any).organization;
    }

    // For code-based ID types, use code as ID
    if (CODE_BASED_ID_TYPES.includes(type as any) && item.code) {
      const id = item.code.toLowerCase();
      console.log(`Setting document with ID: ${id}`);
      const docRef = doc(collectionRef, id);
      
      // Check if document already exists
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        throw new Error(`An item with code ${item.code} already exists in ${type}`);
      }

      const timestamp = new Date().toISOString();
      await setDoc(docRef, {
        ...item,
        id,
        active: true,
        createdAt: timestamp,
        updatedAt: timestamp
      });
      console.log(`Added item to collection: ${collectionName} with ID: ${id}`);
      return id;
    }

    // For other types, let Firestore generate the ID
    const timestamp = new Date().toISOString();
    const docRef = await addDoc(collectionRef, {
      ...item,
      active: true,
      createdAt: timestamp,
      updatedAt: timestamp
    });
    console.log(`Added item to collection: ${collectionName} with ID: ${docRef.id}`);
    return docRef.id;
  }

  // Helper method to add multiple currencies at once
  async addCurrencies(currencies: Array<{ code: string; name: string }>) {
    const results = [];
    for (const currency of currencies) {
      try {
        const collectionName = this.getCollectionName('currencies');
        const collectionRef = collection(db, collectionName);
        const id = currency.code.toLowerCase();
        const docRef = doc(collectionRef, id);
        
        await setDoc(docRef, {
          code: currency.code,
          name: currency.name,
          active: true,
          createdAt: new Date().toISOString()
        });
        
        results.push({ success: true, id, currency });
      } catch (error) {
        results.push({ success: false, error, currency });
      }
    }
    return results;
  }

  async updateItem(type: string, id: string, updates: Partial<ReferenceDataItem>): Promise<void> {
    const collectionName = this.getCollectionName(type);
    console.log(`Updating item in collection: ${collectionName}`, { id, updates });
    
    if (!updates) {
      throw new Error('Updates cannot be undefined');
    }

    // For non-independent types, ensure organizationId is present
    if (!ORGANIZATION_INDEPENDENT_TYPES.includes(type as any)) {
      // Get existing item to preserve organizationId if not in updates
      const docRef = doc(db, collectionName, id);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        throw new Error(`Item not found: ${id}`);
      }
      const existingData = docSnap.data();
      
      // Check for organizationId in updates or organization.id
      const updatesOrgId = updates.organizationId || updates.organization?.id;
      const existingOrgId = existingData.organizationId || existingData.organization?.id;
      
      // Only require organizationId for new items or if explicitly changing it
      if (!updatesOrgId && !existingOrgId) {
        throw new Error(`Organization ID is required for type: ${type}`);
      }

      // Preserve existing organizationId if not provided in updates
      if (!updatesOrgId) {
        updates.organizationId = existingOrgId;
      } else {
        updates.organizationId = updatesOrgId;
      }
    } else {
      // For organization-independent types, remove any organization-related fields
      delete updates.organizationId;
      delete updates.organization;
    }

    const docRef = doc(db, collectionName, id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: new Date().toISOString()
    });
    console.log(`Updated item in collection: ${collectionName} with ID: ${id}`);
  }

  async deleteItem(type: string, id: string): Promise<void> {
    const collectionName = this.getCollectionName(type);
    console.log(`Deleting item from collection: ${collectionName} with ID: ${id}`);
    const docRef = doc(db, collectionName, id);
    console.log(`Document reference: ${docRef.path}`);
    await deleteDoc(docRef);
    console.log(`Deleted item from collection: ${collectionName} with ID: ${id}`);
  }

  async deleteAllItems(type: string): Promise<void> {
    const collectionName = this.getCollectionName(type);
    console.log(`Deleting all items from collection: ${collectionName}`);
    const collectionRef = collection(db, collectionName);
    const snapshot = await getDocs(collectionRef);
    
    const batch = writeBatch(db)
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref)
    })
    
    await batch.commit()
    console.log(`Deleted all items from collection: ${collectionName}`);
  }

  async getActiveItems(type: string): Promise<ReferenceDataItem[]> {
    const collectionName = this.getCollectionName(type);
    const collectionRef = collection(db, collectionName);
    const q = query(collectionRef, where("active", "==", true))
    const snapshot = await getDocs(q);
    const items = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as ReferenceDataItem[];
    console.log(`Retrieved ${items.length} active items from collection: ${collectionName}`);
    return items;
  }

  private standardizeOrgId(id: string): string {
    return id.toLowerCase().replace(/\s+/g, '_')
  }

  async getItemsByOrganization(type: string, organizationId: string): Promise<ReferenceDataItem[]> {
    const collectionName = this.getCollectionName(type);
    console.log(`Getting items for type ${type} and organization ${organizationId}`);

    // Standardize the organization ID
    const standardizedId = this.standardizeOrgId(organizationId);
    console.log(`Standardized organization ID: ${standardizedId}`);

    try {
      const collectionRef = collection(db, collectionName);
      
      // Query only by organizationId field
      const q = query(collectionRef, 
        where('active', '==', true),
        where('organizationId', '==', standardizedId)
      );
      const snapshot = await getDocs(q);

      const items = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      } as ReferenceDataItem));

      console.log(`Found ${items.length} items with organization ID: ${standardizedId}`);
      return items;
    } catch (error) {
      console.error('Error getting items by organization:', error);
      throw error;
    }
  }

  async checkVehicleDataState(): Promise<void> {
    const collectionName = this.getCollectionName('vehicles');
    const collectionRef = collection(db, collectionName);
    const snapshot = await getDocs(collectionRef);
    
    console.log('Current vehicle data state:');
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      console.log(`Vehicle ${doc.id}:`, {
        name: data.name,
        code: data.code,
        registrationNumber: data.registrationNumber,
        // Log the raw data too in case we need it
        raw: data
      });
    });
  }

  async migrateVehicleData(): Promise<void> {
    const collectionName = this.getCollectionName('vehicles');
    console.log('Starting vehicle data migration');
    
    try {
      const vehicles = await this.getItems('vehicles');
      console.log('Found vehicles to migrate:', vehicles);
      
      const batch = writeBatch(db);
      let migratedCount = 0;
      
      for (const vehicle of vehicles) {
        console.log('Processing vehicle:', vehicle);
        const docRef = doc(db, collectionName, vehicle.id);
        
        // Only migrate if we have either name or code
        if (vehicle.name || vehicle.code) {
          const updates: Record<string, any> = {
            registrationNumber: vehicle.code || '',  // Move current code to registration
            code: vehicle.name || '',               // Move current name to code
          };
          
          // Remove the name field
          updates.name = deleteField();
          
          console.log(`Migrating vehicle ${vehicle.id}:`, updates);
          batch.update(docRef, updates);
          migratedCount++;
        }
      }
      
      if (migratedCount > 0) {
        await batch.commit();
        console.log(`Successfully migrated ${migratedCount} vehicles`);
      } else {
        console.log('No vehicles needed migration');
      }
    } catch (error) {
      console.error('Error during vehicle migration:', error);
      throw error;
    }
  }

  async recoverVehicleData(): Promise<void> {
    const collectionName = this.getCollectionName('vehicles');
    console.log('Starting vehicle data recovery');
    
    try {
      // Read and parse CSV file
      const csvText = await fetch('/Vehicle.csv').then(res => res.text());
      const lines = csvText.split('\n');
      const registrationMap = new Map<string, string>();
      
      // Skip header row and parse CSV
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const [designation, registration] = line.split(',');
        if (designation && registration) {
          // Convert designation to lowercase and replace spaces with underscores for matching
          const normalizedKey = designation.toLowerCase().replace(/ /g, '_');
          registrationMap.set(normalizedKey, registration.trim());
        }
      }
      
      console.log('Registration map from CSV:', Object.fromEntries(registrationMap));

      const vehicles = await this.getItems('vehicles');
      console.log('Found vehicles to recover:', vehicles);
      
      // Get organization data
      const orgRef = doc(db, 'organizations', '1pwr_lesotho');
      const orgDoc = await getDoc(orgRef);
      const orgData = orgDoc.data();
      
      if (!orgData) {
        throw new Error('Could not find 1PWR Lesotho organization');
      }

      // Create minimal organization object to avoid undefined fields
      const orgObject = {
        id: '1pwr_lesotho',
        name: orgData.name || '1PWR LSO',
        shortName: orgData.shortName || 'LSO',
        currency: orgData.currency || 'LSL'
      };

      console.log('Using organization data:', orgObject);

      // Update vehicles with registration numbers from CSV
      const batch = writeBatch(db);
      let updatedCount = 0;
      
      for (const vehicle of vehicles) {
        console.log('Processing vehicle:', vehicle);
        const docRef = doc(db, collectionName, vehicle.id);
        
        // Get registration from CSV if it exists
        const registration = registrationMap.get(vehicle.id) || '';
        
        const updates: Record<string, any> = {
          registrationNumber: registration,
          code: vehicle.registrationNumber || vehicle.code || vehicle.id, // Keep existing code or use ID
          organization: orgObject
        };
        
        if (vehicle.name) {
          updates.name = deleteField();
        }
        
        console.log(`Updating vehicle ${vehicle.id} with:`, updates);
        batch.update(docRef, updates);
        updatedCount++;
      }
      
      if (updatedCount > 0) {
        await batch.commit();
        console.log(`Successfully updated ${updatedCount} vehicles with CSV data`);
      }
      
    } catch (error) {
      console.error('Error during vehicle recovery:', error);
      throw error;
    }
  }

  async migrateVehicleRegistrationNumbers(): Promise<void> {
    const vehicles = await this.getItems('vehicles');
    console.log(`Found ${vehicles.length} vehicles to migrate`);

    for (const vehicle of vehicles) {
      if (vehicle.registrationNumber && !vehicle.code) {
        console.log(`Migrating vehicle ${vehicle.id}: ${vehicle.registrationNumber} -> code`);
        await this.updateItem('vehicles', vehicle.id, {
          code: vehicle.registrationNumber,
          registrationNumber: undefined
        });
      }
    }
    console.log('Vehicle registration migration complete');
  }

  private validateItem(type: string, item: any): string[] {
    const errors: string[] = [];

    // Basic validation
    if (!item) {
      errors.push('Item is required');
      return errors;
    }

    // Type-specific validation
    switch (type) {
      case 'organizations':
        // Organization specific validation
        if (!item.name) errors.push('Name is required');
        if (!item.country) errors.push('Country is required');
        if (!item.currency) errors.push('Currency is required');
        break;

      case 'vendors':
        // Vendor specific validation
        if (!item.name) errors.push('Name is required');
        if (!item.organization) errors.push('Organization is required');
        break;

      case 'categories':
        // Category specific validation
        if (!item.name) errors.push('Name is required');
        if (!item.organization) errors.push('Organization is required');
        break;

      case 'units':
        // Unit specific validation
        if (!item.name) errors.push('Name is required');
        break;
        
      case 'vehicles':
        // All fields are optional
        break;

      case 'rules':
        if (!item.number?.trim()) errors.push('Number is required');
        if (!item.description?.trim()) errors.push('Description is required');
        if (item.threshold === undefined || item.threshold === null) errors.push('Threshold is required');
        if (typeof item.threshold !== 'number') errors.push('Threshold must be a number');
        if (!item.organizationId) errors.push('Organization is required');
        break;
    }

    return errors;
  }

  async createItem(type: string, item: Partial<ReferenceDataItem>): Promise<ReferenceDataItem> {
    const errors = this.validateItem(type, item);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    const collectionName = this.getCollectionName(type);
    const itemRef = doc(collection(db, collectionName));

    const itemData: ReferenceDataItem = {
      id: itemRef.id,
      ...item,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      active: item.active ?? true
    };

    await setDoc(itemRef, itemData);
    return itemData;
  }

  private getFieldsForType(type: string) {
    // This method is not implemented in the provided code
    // You need to implement it according to your requirements
    // For example:
    switch (type) {
      case 'organizations':
        return [
          { name: 'name', label: 'Name', required: true },
          { name: 'country', label: 'Country', required: true },
          { name: 'currency', label: 'Currency', required: true },
        ];
      case 'vendors':
        return [
          { name: 'name', label: 'Name', required: true },
          { name: 'organization', label: 'Organization', required: true },
        ];
      case 'categories':
        return [
          { name: 'name', label: 'Name', required: true },
          { name: 'organization', label: 'Organization', required: true },
        ];
      case 'units':
        return [
          { name: 'name', label: 'Name', required: true },
        ];
      case 'vehicles':
        return [
          { name: 'name', label: 'Name' },
          { name: 'code', label: 'Code' },
          { name: 'registrationNumber', label: 'Registration Number' },
        ];
      case 'rules':
        return [
          { name: 'number', label: 'Number', required: true },
          { name: 'description', label: 'Description', required: true },
          { name: 'threshold', label: 'Threshold', required: true },
        ];
      default:
        return [];
    }
  }
}

export const referenceDataAdminService = new ReferenceDataAdminService()
