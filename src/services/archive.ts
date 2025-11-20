/**
 * Archive PR Service
 * Handles operations for archived/legacy purchase requests
 */

import { collection, query, getDocs, doc, getDoc, orderBy, where, limit, QueryConstraint, startAfter } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { ArchivePR } from '@/types/archive';

const ARCHIVE_COLLECTION = 'archivePRs';

class ArchiveService {
  async getArchivePRs(
    filters?: {
      searchTerm?: string;
      organization?: string;
      department?: string;
      vendor?: string;
      startDate?: string;
      endDate?: string;
    },
    sortBy: 'submittedDate' | 'requestorName' | 'amount' = 'submittedDate',
    sortOrder: 'asc' | 'desc' = 'desc',
    pageSize: number = 50
  ): Promise<ArchivePR[]> {
    return getArchivePRs(filters, sortBy, sortOrder, pageSize);
  }

  async getArchivePRById(id: string): Promise<ArchivePR | null> {
    return getArchivePRById(id);
  }

  async getArchiveFilterOptions(): Promise<{
    departments: string[];
    vendors: string[];
  }> {
    return getArchiveFilterOptions();
  }
}

export const archiveService = new ArchiveService();

/**
 * Fetch all archived PRs with optional filters
 */
export async function getArchivePRs(
  filters?: {
    searchTerm?: string;
    organization?: string;
    department?: string;
    vendor?: string;
    startDate?: string;
    endDate?: string;
  },
  sortBy: 'submittedDate' | 'requestorName' | 'amount' = 'submittedDate',
  sortOrder: 'asc' | 'desc' = 'desc',
  pageSize: number = 50
): Promise<ArchivePR[]> {
  try {
    const archiveRef = collection(db, ARCHIVE_COLLECTION);
    const constraints: QueryConstraint[] = [];

    // Apply filters (no organization filter - all are 1PWR LESOTHO)
    if (filters?.department) {
      constraints.push(where('department', '==', filters.department));
    }
    if (filters?.vendor) {
      // Search both vendorName and vendor fields
      constraints.push(where('vendorName', '==', filters.vendor));
    }
    if (filters?.startDate) {
      constraints.push(where('submittedDate', '>=', filters.startDate));
    }
    if (filters?.endDate) {
      constraints.push(where('submittedDate', '<=', filters.endDate));
    }

    // Apply sorting
    constraints.push(orderBy(sortBy, sortOrder));
    constraints.push(limit(pageSize));

    const q = query(archiveRef, ...constraints);
    const querySnapshot = await getDocs(q);
    
    const archivePRs: ArchivePR[] = [];
    querySnapshot.forEach((docSnapshot) => {
      archivePRs.push({
        id: docSnapshot.id,
        ...docSnapshot.data(),
      } as ArchivePR);
    });

    // Apply client-side search if provided (for text search across multiple fields)
    if (filters?.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      return archivePRs.filter(pr => 
        pr.requestorName?.toLowerCase().includes(searchLower) ||
        pr.description?.toLowerCase().includes(searchLower) ||
        pr.vendorName?.toLowerCase().includes(searchLower) ||
        pr.vendor?.toLowerCase().includes(searchLower) ||
        pr.department?.toLowerCase().includes(searchLower) ||
        pr.requestorEmail?.toLowerCase().includes(searchLower)
      );
    }

    return archivePRs;
  } catch (error) {
    console.error('Error fetching archive PRs:', error);
    throw new Error(`Failed to fetch archive PRs: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get a single archived PR by ID
 */
export async function getArchivePRById(id: string): Promise<ArchivePR | null> {
  try {
    console.log('[ArchiveService] Fetching archive PR with ID:', id);
    const docRef = doc(db, ARCHIVE_COLLECTION, id);
    console.log('[ArchiveService] Document reference created, fetching...');
    const docSnap = await getDoc(docRef);
    console.log('[ArchiveService] Document fetched, exists:', docSnap.exists());
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      console.log('[ArchiveService] Document data keys:', Object.keys(data));
      console.log('[ArchiveService] Legacy responses count:', data.legacyResponses?.length || 0);
      const result = {
        id: docSnap.id,
        ...data,
      } as ArchivePR;
      console.log('[ArchiveService] Returning archive PR');
      return result;
    }
    
    console.log('[ArchiveService] Document does not exist');
    return null;
  } catch (error) {
    console.error('[ArchiveService] Error fetching archive PR:', error);
    throw new Error(`Failed to fetch archive PR: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get unique values for filter dropdowns
 * Note: All archive PRs are for 1PWR LESOTHO, so no organization filter needed
 * Uses a sample of documents to build filter options efficiently
 */
export async function getArchiveFilterOptions(): Promise<{
  departments: string[];
  vendors: string[];
}> {
  try {
    const archiveRef = collection(db, ARCHIVE_COLLECTION);
    const departments = new Set<string>();
    const vendors = new Set<string>();
    
    // Fetch in batches to avoid loading all 9k+ documents at once
    // Sample up to 2000 documents which should give us good coverage of unique values
    const maxSampleSize = 2000;
    const batchSize = 500;
    let lastDoc: any = null;
    let totalFetched = 0;
    
    while (totalFetched < maxSampleSize) {
      const constraints: QueryConstraint[] = [orderBy('submittedDate', 'desc'), limit(batchSize)];
      if (lastDoc) {
        constraints.push(startAfter(lastDoc));
      }
      
      const q = query(archiveRef, ...constraints);
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        break;
      }
      
      querySnapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        if (data.department) departments.add(data.department);
        // Use vendorName if available, otherwise fall back to vendor
        const vendor = data.vendorName || data.vendor;
        if (vendor) vendors.add(vendor);
        lastDoc = docSnapshot;
        totalFetched++;
      });
      
      // If we got fewer than batchSize, we're done
      if (querySnapshot.size < batchSize) {
        break;
      }
    }
    
    return {
      departments: Array.from(departments).sort(),
      vendors: Array.from(vendors).sort(),
    };
  } catch (error) {
    console.error('Error fetching archive filter options:', error);
    // Fallback: return empty arrays and let the component handle it
    return {
      departments: [],
      vendors: [],
    };
  }
}

