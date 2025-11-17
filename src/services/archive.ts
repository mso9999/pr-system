/**
 * Archive PR Service
 * Handles operations for archived/legacy purchase requests
 */

import { collection, query, getDocs, doc, getDoc, orderBy, where, limit, QueryConstraint } from 'firebase/firestore';
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
    organizations: string[];
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

    // Apply filters
    if (filters?.organization) {
      constraints.push(where('organization', '==', filters.organization));
    }
    if (filters?.department) {
      constraints.push(where('department', '==', filters.department));
    }
    if (filters?.vendor) {
      constraints.push(where('vendor', '==', filters.vendor));
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
        pr.vendor?.toLowerCase().includes(searchLower) ||
        pr.department?.toLowerCase().includes(searchLower) ||
        pr.organization?.toLowerCase().includes(searchLower) ||
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
    const docRef = doc(db, ARCHIVE_COLLECTION, id);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data(),
      } as ArchivePR;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching archive PR:', error);
    throw new Error(`Failed to fetch archive PR: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get unique values for filter dropdowns
 */
export async function getArchiveFilterOptions(): Promise<{
  organizations: string[];
  departments: string[];
  vendors: string[];
}> {
  try {
    const archiveRef = collection(db, ARCHIVE_COLLECTION);
    const querySnapshot = await getDocs(archiveRef);
    
    const organizations = new Set<string>();
    const departments = new Set<string>();
    const vendors = new Set<string>();
    
    querySnapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      if (data.organization) organizations.add(data.organization);
      if (data.department) departments.add(data.department);
      if (data.vendor) vendors.add(data.vendor);
    });
    
    return {
      organizations: Array.from(organizations).sort(),
      departments: Array.from(departments).sort(),
      vendors: Array.from(vendors).sort(),
    };
  } catch (error) {
    console.error('Error fetching archive filter options:', error);
    return {
      organizations: [],
      departments: [],
      vendors: [],
    };
  }
}

