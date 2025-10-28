import { 
  doc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  collection, 
  query, 
  where,
  addDoc,
  deleteDoc, 
  serverTimestamp, 
  Timestamp,
  DocumentData, 
  Query, 
  QueryConstraint,
  orderBy, 
  limit,
  FieldValue,
  setDoc,
} from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore'; 
import { app, auth } from '@/config/firebase'; 
// import { logger } from '@/utils/logger';
import { PRRequest, PRStatus, UserReference, HistoryItem, LineItem, ApprovalWorkflow, StatusHistoryItem, ApprovalHistoryItem } from '@/types/pr'; 
import { User } from '@/types/user'; 
import { mapFirebaseUserToUserReference } from '@/utils/userMapper';
import { Notification } from '@/types/notification';
import { SubmitPRNotificationHandler } from './notifications/handlers/submitPRNotification'; 

const PR_COLLECTION = 'purchaseRequests';
const COUNTER_COLLECTION = 'counters';
const APPROVAL_RULES_COLLECTION = 'approvalRules'; 
const NOTIFICATION_COLLECTION = 'notifications'; 
const db = getFirestore(app);

interface ApprovalRule {
  id: string;
  organization: string;
  minAmount: number;
  approverLevel: number; 
  // Add other relevant fields from your DB structure
}

interface PRUpdateData {
  [key: string]: any; 
  history?: HistoryItem[]; 
  statusHistory?: StatusHistoryItem[]; 
  status?: PRStatus;
  approvalWorkflow?: Partial<ApprovalWorkflow>;
  updatedAt?: FieldValue; 
}

interface PRCreateData extends Omit<PRRequest, 'id' | 'prNumber' | 'createdAt' | 'updatedAt' | 'history' | 'totalAmount'> {
  requestor: UserReference;
  vehicle?: string; // Make optional
  preferredVendor?: string; // Make optional
  // Ensure other required fields are present
}

/**
 * Function to safely convert Firestore Timestamps or existing ISO strings to ISO strings.
 * Returns undefined if the input is invalid or missing.
 */
function safeTimestampToISO(timestamp: Timestamp | string | undefined | null): string | undefined {
  if (timestamp instanceof Timestamp) {
    try {
      return timestamp.toDate().toISOString();
    } catch (e) {
       console.error("Failed to convert Firestore Timestamp to Date:", e);
       return undefined;
    }
  }
  if (typeof timestamp === 'string') {
    // Basic validation if it's already an ISO string
    try {
      // Attempt to parse; Date.parse returns NaN for invalid strings
      if (!isNaN(Date.parse(timestamp))) {
        // Check if it roughly looks like an ISO string to avoid converting random strings
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|([+-]\d{2}:\d{2}))$/.test(timestamp)) {
            return timestamp;
        }
      }
    } catch(e) {
       console.error("Failed during string timestamp parsing/validation:", e);
       return undefined;
    }
  }
  // Return undefined for null, undefined, or invalid/non-ISO strings
  return undefined;
}

// Renamed and corrected History Item creation for status changes
function createStatusHistoryItem(
  status: PRStatus,
  user: UserReference,
  notes?: string
): Omit<StatusHistoryItem, 'id'> { 
  return {
    status, 
    timestamp: new Date().toISOString(), 
    user: user, 
    notes: notes || `Status changed to ${status}`,
  };
}

/**
 * Fetches a single Purchase Request by its ID.
 * @param prId - The ID of the PR to fetch.
 * @returns A promise resolving to the PRRequest object or null if not found.
 */
export async function getPR(prId: string): Promise<PRRequest | null> {
  console.log(`Fetching PR with ID: ${prId}`);
  if (!prId) {
    console.warn('getPR called with no prId.');
    return null;
  }

  try {
    const prDocRef = doc(db, PR_COLLECTION, prId);
    const docSnap = await getDoc(prDocRef);

    if (!docSnap.exists()) {
      console.warn(`PR with ID ${prId} not found.`);
      return null;
    }

    const data = docSnap.data();
    const pr: PRRequest = {
      id: docSnap.id,
      prNumber: data.prNumber || `TEMP-${docSnap.id.substring(0,6)}`,
      organization: data.organization,
      department: data.department,
      projectCategory: data.projectCategory,
      site: data.site,
      description: data.description,
      status: data.status as PRStatus,
      expenseType: data.expenseType,
      estimatedAmount: data.estimatedAmount || 0,
      currency: data.currency,
      totalAmount: data.totalAmount || 0,
      requestor: data.requestor as UserReference,
      requestorId: data.requestorId,
      requestorEmail: data.requestorEmail,
      submittedBy: data.submittedBy,
      approver: data.approver, 
      requiredDate: data.requiredDate || '', // Simple date string from HTML input, no conversion needed
      preferredVendor: data.preferredVendor || '',
      vehicle: data.vehicle || '',
      createdAt: safeTimestampToISO(data.createdAt) || new Date().toISOString(),
      updatedAt: safeTimestampToISO(data.updatedAt) || new Date().toISOString(),
      lineItems: (data.lineItems || []).map((item: any): LineItem => ({ ...item })),
      quotes: data.quotes || [],
      attachments: data.attachments || [],
      history: (data.history || []).map((item: any): HistoryItem => ({
          ...item,
          timestamp: safeTimestampToISO(item.timestamp) || new Date().toISOString(), 
      })),
      approvalWorkflow: { 
          ...data.approvalWorkflow,
          lastUpdated: safeTimestampToISO(data.approvalWorkflow?.lastUpdated),
          approvalHistory: (data.approvalWorkflow?.approvalHistory || []).map((item: any) => ({
              ...item,
              timestamp: safeTimestampToISO(item.timestamp),
          })),
      },
      statusHistory: (data.statusHistory || []).map((item: any): StatusHistoryItem => ({
          ...item,
          timestamp: safeTimestampToISO(item.timestamp),
      })),
      isUrgent: data.isUrgent || false,
      metrics: data.metrics || undefined,
      purchaseOrderNumber: data.purchaseOrderNumber,
    };
    console.log(`Successfully fetched PR with ID: ${prId}`);
    return pr;

  } catch (error) {
    console.error(`Failed to fetch PR with ID ${prId}:`, error);
    throw new Error(`Failed to fetch purchase request: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Updates the status of a PR and adds a status history record.
 * @param prId - The ID of the PR to update.
 * @param status - The new status.
 * @param notes - Optional notes for the history record.
 * @param user - The user performing the action.
 * @returns A promise that resolves when the update is complete.
 */
export async function updatePRStatus(
  prId: string, 
  status: PRStatus, 
  notes?: string, 
  user?: UserReference 
): Promise<void> {
    console.log(`Updating status for PR ${prId} to ${status} by user ${user?.id || 'System'}`);
    if (!prId || !status || !user) {
        const missing = [!prId && 'prId', !status && 'status', !user && 'user'].filter(Boolean).join(', ');
        console.error(`updatePRStatus called with missing arguments: ${missing}`);
        throw new Error(`Missing required arguments for status update: ${missing}`);
    }

    try {
        const prDocRef = doc(db, PR_COLLECTION, prId);
        
        // Fetch current PR to get existing status history
        const currentPRSnap = await getDoc(prDocRef);
        if (!currentPRSnap.exists()) {
            throw new Error(`PR with ID ${prId} not found for status update.`);
        }
        const currentData = currentPRSnap.data();
        // Use statusHistory array
        const currentStatusHistory: StatusHistoryItem[] = currentData.statusHistory || []; 

        // Create new status history item using the renamed function
        const statusHistoryEntry = createStatusHistoryItem(status, user, notes);

        // Prepare update data
        const updateData: PRUpdateData = {
            status: status,
            // Append to statusHistory
            statusHistory: [...currentStatusHistory, statusHistoryEntry], 
            updatedAt: serverTimestamp(), 
        };
        
        // If status indicates final approval or rejection, potentially update workflow
        if (status === PRStatus.APPROVED || status === PRStatus.REJECTED) {
           // Add logic here if workflow state needs specific updates on final states
           // e.g., update approvalWorkflow.currentApprover to null or set a final timestamp
        }

        await updateDoc(prDocRef, updateData);
        console.log(`Successfully updated status for PR ${prId} to ${status}`);
        
        // Add notification creation logic here if needed upon status change
        // Example: await createNotificationForStatusChange(prId, status, user, currentData);

    } catch (error) {
        console.error(`Failed to update status for PR ${prId}:`, error);
        throw new Error(`Failed to update PR status: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Updates arbitrary fields of a PR document (except status, which should use updatePRStatus).
 * @param prId - The ID of the PR to update.
 * @param updateData - An object containing the fields to update.
 * @returns A promise that resolves when the update is complete.
 */
export async function updatePR(prId: string, updateData: Partial<PRRequest>): Promise<void> {
  console.log(`Updating PR ${prId} with data:`, updateData);
  if (!prId || !updateData || Object.keys(updateData).length === 0) {
    console.error('updatePR called with invalid arguments.');
    throw new Error('Missing required arguments for PR update.');
  }
  try {
    const prDocRef = doc(db, PR_COLLECTION, prId);
    
    // Remove status if present (should use updatePRStatus for status updates)
    if ('status' in updateData) {
      delete (updateData as any).status;
    }
    
    // Filter out undefined values - Firestore doesn't allow undefined
    const cleanedData: any = {};
    Object.keys(updateData).forEach(key => {
      const value = (updateData as any)[key];
      if (value !== undefined) {
        cleanedData[key] = value;
      }
    });
    
    await updateDoc(prDocRef, { ...cleanedData, updatedAt: serverTimestamp() });
    console.log(`Successfully updated PR ${prId}`);
  } catch (error) {
    console.error(`Failed to update PR ${prId}:`, error);
    throw new Error(`Failed to update PR: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Finds the relevant approval rule for a given organization and amount.
 * @param organization - The organization name or ID.
 * @param amount - The estimated or total amount of the PR.
 * @returns A promise resolving to the matching ApprovalRule or null.
 */
export async function getRuleForOrganization(
    organization: string, 
    amount: number
): Promise<ApprovalRule | null> {
    console.log(`Fetching approval rule for org: ${organization}, amount: ${amount}`);
    if (!organization) {
        console.warn('getRuleForOrganization called with missing organization.');
        return null;
    }

    try {
        const rulesCollectionRef = collection(db, APPROVAL_RULES_COLLECTION);
        
        // Query for rules matching the organization, where amount is >= minAmount,
        // ordered by minAmount descending to get the highest applicable rule first.
        const q = query(
            rulesCollectionRef, 
            where('organization', '==', organization),
            where('minAmount', '<=', amount),
            orderBy('minAmount', 'desc'), 
            limit(1) 
        );

        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            console.warn(`No applicable approval rule found for org ${organization} and amount ${amount}.`);
            return null;
        }

        const docSnap = querySnapshot.docs[0];
        const ruleData = docSnap.data();
        
        const rule: ApprovalRule = {
            id: docSnap.id,
            organization: ruleData.organization,
            minAmount: ruleData.minAmount,
            approverLevel: ruleData.approverLevel, 
            // Map other fields...
        };

        console.log(`Found matching approval rule ID: ${rule.id} with level ${rule.approverLevel}`);
        return rule;

    } catch (error) {
        console.error(`Failed to fetch approval rule for org ${organization}:`, error);
        throw new Error(`Failed to fetch approval rule: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Creates a new Purchase Request.
 * Automatically assigns PR number and sets initial status.
 * @param prData - Data for the new PR, excluding id, prNumber, createdAt, updatedAt.
 * @returns A promise that resolves with the new PR's ID and number.
 */
export async function createPR(
  prData: PRCreateData
): Promise<{ prId: string; prNumber: string }> {
   console.log('[PR SERVICE] ========== CREATE PR START ==========');
   console.log('[PR SERVICE] Attempting to create PR with data:', prData);
   console.log('[PR SERVICE] Preferred Vendor from input:', prData.preferredVendor);
   console.log('[PR SERVICE] ==========================================');
   
   if (!prData || !prData.requestorId) {
     console.error('createPR called with invalid prData or missing requestorId.');
     throw new Error('Invalid PR data provided.');
   }

   try {
     const prNumber = await generatePRNumber(prData.organization || 'UNK'); // Pass organization

     const finalPRData: Omit<PRRequest, 'id'> = {
       ...prData,
       prNumber,
       status: PRStatus.SUBMITTED,
       totalAmount: prData.estimatedAmount, // Add totalAmount, using estimatedAmount initially
       createdAt: new Date().toISOString(), // Set server-side or consistent client-side
       updatedAt: new Date().toISOString(),
       history: [], // Initialize history
       statusHistory: [], // Initialize status history
       // approvalWorkflow initialization might be needed here
     };

     console.log('[PR SERVICE] Final PR data before saving to Firestore:');
     console.log('[PR SERVICE] - PR Number:', finalPRData.prNumber);
     console.log('[PR SERVICE] - Preferred Vendor:', finalPRData.preferredVendor);
     console.log('[PR SERVICE] - Organization:', finalPRData.organization);

     // Use addDoc to create a new document with an auto-generated ID
     const docRef = await addDoc(collection(db, PR_COLLECTION), finalPRData);
     console.log(`[PR SERVICE] Successfully created PR ${prNumber} with ID ${docRef.id}`);
     
    // Trigger notification for new PR submission
    try {
      const notificationHandler = new SubmitPRNotificationHandler();
      
      // Create the complete PR object with the generated ID
      const completePRData = {
        ...finalPRData,
        id: docRef.id
      };
      
      // Add a delay to allow Firestore to make the document available
      // This helps with eventual consistency issues
      // Increased from 100ms to 500ms to better handle Firestore propagation
      console.log('Waiting 500ms for Firestore document propagation before sending notification...');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const notificationResult = await notificationHandler.createNotification(completePRData, prNumber);
      console.log('PR submission notification result:', notificationResult);
    } catch (notificationError) {
      console.error('Failed to send PR submission notification:', notificationError);
      // Don't throw here - PR creation should succeed even if notification fails
    }
     
     return { prId: docRef.id, prNumber: prNumber };

   } catch (error) {
     console.error('Failed to create PR:', error);
     throw new Error(`Failed to create purchase request: ${error instanceof Error ? error.message : String(error)}`);
   }
}

/**
 * Fetches all PRs for a specific user, optionally filtered by organization.
 * @param userId - The ID of the user whose PRs to fetch.
 * @param organization - Optional organization name to filter by.
 * @param showOnlyMyPRs - If true, only show PRs where the user is the requestor.
 * @returns A promise that resolves with an array of PRs.
 */
export async function getUserPRs(
    userId: string, 
    organization?: string, 
    showOnlyMyPRs: boolean = true
): Promise<PRRequest[]> {
    console.log(`Fetching PRs for user ${userId}, org: ${organization}, onlyMine: ${showOnlyMyPRs}`);
    if (!userId) {
        console.error('getUserPRs called without userId');
        throw new Error('User ID is required to fetch PRs.');
    }

    try {
        const prCollectionRef = collection(db, PR_COLLECTION);
        const constraints: QueryConstraint[] = [];

        if (showOnlyMyPRs) {
            constraints.push(where('requestorId', '==', userId));
        } else {
            // If not only showing my PRs, maybe fetch all PRs the user can *see*?
            // This might involve checking roles/permissions or if they are an approver.
            // For now, let's assume it means all PRs in their org if org is provided,
            // or all PRs if no org is provided (requires appropriate Firestore rules).
            // If showing all PRs user can *act on* is needed, more complex logic is required.
            console.warn('Fetching non-owned PRs - current logic might need refinement based on visibility rules.');
            // Example: Fetching all PRs (adjust constraints based on actual requirements)
             if (organization) {
                 constraints.push(where('organization', '==', organization));
             } 
            // If no organization and not showOnlyMyPRs, fetch all? Might be too broad.
            // Consider adding permission checks here or ensuring Firestore rules handle this.
        }
        
        if (organization && constraints.length === 0) { // Add org filter if not added by showOnlyMyPRs logic
           constraints.push(where('organization', '==', organization));
        }

        constraints.push(orderBy('createdAt', 'desc')); // Order by creation date

        const q = query(prCollectionRef, ...constraints);
        const querySnapshot = await getDocs(q);

        const prs: PRRequest[] = [];
        querySnapshot.forEach((docSnapshot) => {
            const data = docSnapshot.data();
            prs.push({
                id: docSnapshot.id,
                ...data,
                createdAt: safeTimestampToISO(data.createdAt),
                updatedAt: safeTimestampToISO(data.updatedAt),
                requiredDate: safeTimestampToISO(data.requiredDate),
                lastModifiedAt: safeTimestampToISO(data.lastModifiedAt), // Ensure lastModifiedAt is serializable
                // Ensure nested timestamps are also converted
                history: (data.history || []).map((item: any): HistoryItem => ({
                    ...item,
                    timestamp: safeTimestampToISO(item.timestamp),
                })),
                statusHistory: (data.statusHistory || []).map((item: any): StatusHistoryItem => ({
                    ...item,
                    timestamp: safeTimestampToISO(item.timestamp),
                })),
                approvalWorkflow: data.approvalWorkflow ? {
                    ...data.approvalWorkflow,
                    lastUpdated: safeTimestampToISO(data.approvalWorkflow.lastUpdated),
                    approvalHistory: (data.approvalWorkflow.approvalHistory || []).map((item: any): ApprovalHistoryItem => ({
                      ...item,
                      timestamp: safeTimestampToISO(item.timestamp),
                  })),
                } : undefined,
            } as PRRequest);
        });

        console.log(`Fetched ${prs.length} PRs for user ${userId}`);
        return prs;

    } catch (error) {
        console.error(`Failed to fetch PRs for user ${userId}:`, error);
        throw new Error(`Failed to retrieve purchase requests: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Generates a new PR number based on the organization and current date.
 * Uses a Firestore counter to ensure unique sequential numbers.
 * @param organization - The organization code.
 * @returns The next PR number
 */
export async function generatePRNumber(organization: string = 'UNK'): Promise<string> {
  // New format: [YYMMDD-####-ORG-CC]
  const now = new Date();
  const yy = now.getFullYear().toString().slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const currentYear = now.getFullYear();
  
  // Normalize organization name (handle spaces, special chars, case)
  const normalizedOrg = organization.toLowerCase().replace(/[^a-z0-9]/g, '_');
  
  // Get organization code mapping from actual database values
  const orgCodeMap: { [key: string]: string } = {
    '1pwr_lesotho': '1PL',
    '1pwr_benin': '1PB',
    '1pwr_zambia': '1PZ',
    'neo1': 'NEO',
    'pueco_benin': 'PCB',
    'pueco_lesotho': 'PCL',
    'smp': 'SMP',
    // Legacy mappings for backward compatibility
    'lesotho': '1PL',
    'benin': '1PB',
    'zambia': '1PZ',
    'sotho_minigrid_portfolio': 'SMP'
  };
  
  // Get country code mapping from actual database values
  const countryCodeMap: { [key: string]: string } = {
    '1pwr_lesotho': 'LS',
    '1pwr_benin': 'BN', // Using BN instead of BJ as requested
    '1pwr_zambia': 'ZM',
    'neo1': 'LS',
    'pueco_benin': 'BN', // Using BN instead of BJ as requested
    'pueco_lesotho': 'LS',
    'smp': 'LS',
    // Legacy mappings for backward compatibility
    'lesotho': 'LS',
    'benin': 'BN', // Using BN instead of BJ as requested
    'zambia': 'ZM',
    'sotho_minigrid_portfolio': 'LS'
  };
  
  const orgCode = orgCodeMap[normalizedOrg] || organization.substring(0, 3).toUpperCase();
  const countryCode = countryCodeMap[normalizedOrg] || 'XX';
  
  // Use Firestore transaction to get and increment counter atomically
  // Counter document is stored per year to enable annual reset
  const counterDocId = `pr_counter_${currentYear}_${normalizedOrg}`;
  const counterRef = doc(db, 'counters', counterDocId);
  
  try {
    // Use runTransaction to ensure atomic read and update
    const { runTransaction } = await import('firebase/firestore');
    const sequentialNumber = await runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      
      let newCount = 1; // Start from 1
      if (counterDoc.exists()) {
        const currentCount = counterDoc.data().count || 0;
        newCount = currentCount + 1;
      }
      
      // Update the counter
      transaction.set(counterRef, {
        count: newCount,
        year: currentYear,
        organization: normalizedOrg,
        lastUpdated: new Date().toISOString()
      });
      
      return newCount;
    });
    
    // Format the sequential number with leading zeros (4 digits)
    const sequentialStr = sequentialNumber.toString().padStart(4, '0');
    
    const prNumber = `${yy}${mm}${dd}-${sequentialStr}-${orgCode}-${countryCode}`;
    console.log(`Generated PR Number: ${prNumber} (sequential: ${sequentialNumber})`);
    return prNumber;
  } catch (error) {
    console.error('Failed to generate PR number with counter, falling back to timestamp:', error);
    // Fallback to timestamp-based if counter fails (to prevent complete failure)
    const timestampNumber = Date.now() % 10000;
    const sequentialStr = timestampNumber.toString().padStart(4, '0');
    const prNumber = `${yy}${mm}${dd}-${sequentialStr}-${orgCode}-${countryCode}`;
    console.warn(`Using timestamp-based PR Number: ${prNumber}`);
    return prNumber;
  }
}

/**
 * Deletes a Purchase Request.
 * @param prId - The ID of the PR to delete.
 * @returns A promise that resolves when the deletion is complete.
 */
export async function deletePR(prId: string): Promise<void> {
  console.log(`Attempting to delete PR ${prId}`);
  if (!prId) {
      console.error('deletePR called without prId');
      throw new Error('PR ID is required to delete.');
  }
  try {
      const prDocRef = doc(db, PR_COLLECTION, prId);
      await deleteDoc(prDocRef); 
      console.log(`Successfully deleted PR ${prId}`);
  } catch (error) {
      console.error(`Failed to delete PR ${prId}:`, error);
      throw new Error(`Failed to delete purchase request: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Aggregated service object for legacy compatibility
export const prService = {
  getPR,
  updatePR,
  updatePRStatus,
  getRuleForOrganization,
  createPR,
  getUserPRs,
  generatePRNumber,
  deletePR
};