import { db } from "@/config/firebase"
import { collection, getDocs, query, where, doc, getDoc, updateDoc, setDoc } from "firebase/firestore"
import { Organization } from "@/types/organization"

const COLLECTION_NAME = "referenceData_organizations"

export class OrganizationService {
  async getOrganizations(): Promise<Organization[]> {
    const collectionRef = collection(db, COLLECTION_NAME)
    const snapshot = await getDocs(collectionRef)
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Organization[]
  }

  async getActiveOrganizations(): Promise<Organization[]> {
    const collectionRef = collection(db, COLLECTION_NAME)
    const q = query(collectionRef, where("active", "==", true))
    const snapshot = await getDocs(q)
    const organizations = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Organization[]
    console.log('Retrieved organizations (full data):', organizations);
    return organizations;
  }

  async getOrganizationById(id: string): Promise<Organization | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id)
      const docSnap = await getDoc(docRef)
      
      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data()
        } as Organization
      }
      return null
    } catch (error) {
      console.error('Error fetching organization:', error)
      throw error
    }
  }

  async updateOrganization(id: string, data: Partial<Organization>): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id)
      
      // Remove id from data if present (can't update document id)
      const { id: _, ...updateData } = data as any
      
      // Add timestamp
      const updates = {
        ...updateData,
        updatedAt: new Date().toISOString()
      }
      
      await updateDoc(docRef, updates)
      console.log('Organization updated successfully:', id)
    } catch (error) {
      console.error('Error updating organization:', error)
      throw error
    }
  }

  async createOrganization(data: Omit<Organization, 'id'>): Promise<string> {
    try {
      // Generate ID from name (normalize: lowercase, replace spaces with underscores)
      const id = data.name.toLowerCase().replace(/[^a-z0-9]/g, '_')
      const docRef = doc(db, COLLECTION_NAME, id)
      
      // Check if organization already exists
      const existingDoc = await getDoc(docRef)
      if (existingDoc.exists()) {
        throw new Error(`Organization with ID ${id} already exists`)
      }
      
      const orgData = {
        ...data,
        active: data.active ?? true,
        baseCurrency: data.baseCurrency || 'LSL',
        allowedCurrencies: data.allowedCurrencies || ['LSL', 'USD', 'ZAR'],
        vendorApproval3QuoteDuration: data.vendorApproval3QuoteDuration || 12,
        vendorApprovalCompletedDuration: data.vendorApprovalCompletedDuration || 6,
        vendorApprovalManualDuration: data.vendorApprovalManualDuration || 12,
        highValueVendorMultiplier: data.highValueVendorMultiplier || 10,
        highValueVendorMaxDuration: data.highValueVendorMaxDuration || 24,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      
      await setDoc(docRef, orgData)
      console.log('Organization created successfully:', id)
      return id
    } catch (error) {
      console.error('Error creating organization:', error)
      throw error
    }
  }

  /**
   * Validate email address format
   */
  validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  /**
   * Validate organization configuration before saving
   */
  validateOrganizationConfig(org: Partial<Organization>): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    // Validate email addresses if provided
    if (org.procurementEmail && !this.validateEmail(org.procurementEmail)) {
      errors.push('Invalid procurement email address format')
    }
    if (org.assetManagementEmail && !this.validateEmail(org.assetManagementEmail)) {
      errors.push('Invalid asset management email address format')
    }
    if (org.adminEmail && !this.validateEmail(org.adminEmail)) {
      errors.push('Invalid admin email address format')
    }

    // Validate numeric values
    if (org.vendorApproval3QuoteDuration !== undefined && org.vendorApproval3QuoteDuration < 1) {
      errors.push('Vendor approval 3-quote duration must be at least 1 month')
    }
    if (org.vendorApprovalCompletedDuration !== undefined && org.vendorApprovalCompletedDuration < 1) {
      errors.push('Vendor approval completed duration must be at least 1 month')
    }
    if (org.vendorApprovalManualDuration !== undefined && org.vendorApprovalManualDuration < 1) {
      errors.push('Vendor approval manual duration must be at least 1 month')
    }
    if (org.highValueVendorMultiplier !== undefined && org.highValueVendorMultiplier < 1) {
      errors.push('High-value vendor multiplier must be at least 1')
    }
    if (org.highValueVendorMaxDuration !== undefined && org.highValueVendorMaxDuration < 1) {
      errors.push('High-value vendor max duration must be at least 1 month')
    }

    // Validate currencies
    if (org.allowedCurrencies && org.allowedCurrencies.length === 0) {
      errors.push('At least one allowed currency must be specified')
    }
    if (org.baseCurrency && org.allowedCurrencies && !org.allowedCurrencies.includes(org.baseCurrency)) {
      errors.push('Base currency must be in the list of allowed currencies')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }
}

export const organizationService = new OrganizationService()
