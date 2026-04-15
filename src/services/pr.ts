import { 
  doc, 
  getDoc,
  getDocFromServer,
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
  or,
  and,
} from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore'; 
import { app, auth } from '@/config/firebase'; 
// import { logger } from '@/utils/logger';
import { PRRequest, PRStatus, UserReference, HistoryItem, LineItem, ApprovalWorkflow, StatusHistoryItem, ApprovalHistoryItem, PendingAmendment, AmendmentHistoryItem } from '@/types/pr';
import { approverService } from '@/services/approver';
import { User } from '@/types/user'; 
import { mapFirebaseUserToUserReference } from '@/utils/userMapper';
import { normalizeOrganizationId } from '@/utils/organization';
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
  // Clean the user object to remove undefined fields before storing
  const cleanedUser: UserReference = {
    id: user.id,
    email: user.email,
    ...(user.firstName && { firstName: user.firstName }),
    ...(user.lastName && { lastName: user.lastName }),
    ...(user.name && { name: user.name }),
    ...(user.displayName && { displayName: user.displayName }),
    ...(user.role && { role: user.role }),
    ...(user.organization && { organization: user.organization }),
    ...(user.department && { department: user.department }),
    ...(user.isActive !== undefined && { isActive: user.isActive }), // isActive can be false
    ...(user.permissionLevel !== undefined && { permissionLevel: user.permissionLevel }),
    ...(user.permissions && Object.keys(user.permissions).length > 0 && { permissions: user.permissions }),
  };

  return {
    status, 
    timestamp: new Date().toISOString(), 
    user: cleanedUser, 
    notes: notes || `Status changed to ${status}`,
  };
}

/**
 * Fetches a single Purchase Request by its ID.
 * @param prId - The ID of the PR to fetch.
 * @param forceServerFetch - If true, bypasses Firestore cache and fetches from server
 * @returns A promise resolving to the PRRequest object or null if not found.
 */
export async function getPR(prId: string, forceServerFetch: boolean = true): Promise<PRRequest | null> {
  console.log(`Fetching PR with ID: ${prId}, forceServerFetch: ${forceServerFetch}`);
  if (!prId) {
    console.warn('getPR called with no prId.');
    return null;
  }

  try {
    const prDocRef = doc(db, PR_COLLECTION, prId);
    let docSnap;
    if (forceServerFetch) {
      try {
        docSnap = await getDocFromServer(prDocRef);
      } catch (serverError) {
        console.warn(`Server fetch failed for PR ${prId}, falling back to cache:`, serverError);
        docSnap = await getDoc(prDocRef);
      }
    } else {
      docSnap = await getDoc(prDocRef);
    }

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
      sites: data.sites || (data.site ? [data.site] : []), // Support both sites array and legacy site field
      description: data.description,
      status: data.status as PRStatus,
      expenseType: data.expenseType,
      paymentType: data.paymentType || undefined,
      estimatedAmount: data.estimatedAmount || 0,
      currency: data.currency,
      totalAmount: data.totalAmount || 0,
      requestor: data.requestor as UserReference,
      requestorId: data.requestorId,
      requestorEmail: data.requestorEmail,
      submittedBy: data.submittedBy,
      approver: data.approver,
      approver2: data.approver2,
      requiresDualApproval: data.requiresDualApproval || false,
      requiredDate: data.requiredDate || '',
      preferredVendor: data.preferredVendor || '',
      vehicle: data.vehicle || '',
      createdAt: safeTimestampToISO(data.createdAt) || new Date().toISOString(),
      updatedAt: safeTimestampToISO(data.updatedAt) || new Date().toISOString(),
      lineItems: (data.lineItems || []).map((item: any): LineItem => ({ ...item })),
      lineItemsWithSKU: data.lineItemsWithSKU || [],
      quotes: data.quotes || [],
      preferredQuoteId: data.preferredQuoteId, // ID of the preferred quote selected by procurement
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
      
      // APPROVED Status fields (added for PO document management)
      estimatedDeliveryDate: data.estimatedDeliveryDate,
      poIssueDate: data.poIssueDate,
      proformaInvoice: data.proformaInvoice,
      proformaOverride: data.proformaOverride,
      proformaOverrideJustification: data.proformaOverrideJustification,
      proofOfPayment: data.proofOfPayment,
      popOverride: data.popOverride,
      popOverrideJustification: data.popOverrideJustification,
      deliveryNote: data.deliveryNote,
      deliveryPhotos: data.deliveryPhotos,
      deliveryDocOverride: data.deliveryDocOverride,
      deliveryDocOverrideJustification: data.deliveryDocOverrideJustification,
      poDocument: data.poDocument,
      poDocumentOverride: data.poDocumentOverride,
      poDocumentOverrideJustification: data.poDocumentOverrideJustification,
      
      // Final Price fields
      finalPrice: data.finalPrice,
      finalPriceCurrency: data.finalPriceCurrency,
      finalPriceEnteredBy: data.finalPriceEnteredBy,
      finalPriceEnteredAt: data.finalPriceEnteredAt,
      finalPriceRequiresApproval: data.finalPriceRequiresApproval,
      finalPriceVariancePercentage: data.finalPriceVariancePercentage,
      finalPriceApproved: data.finalPriceApproved,
      finalPriceApprovedBy: data.finalPriceApprovedBy,
      finalPriceApprovedAt: data.finalPriceApprovedAt,
      finalPriceVarianceNotes: data.finalPriceVarianceNotes,
      finalPriceVarianceOverride: data.finalPriceVarianceOverride,
      finalPriceVarianceOverrideJustification: data.finalPriceVarianceOverrideJustification,
      
      // PO Line Item Price Discrepancy Justification
      poLineItemDiscrepancyJustification: data.poLineItemDiscrepancyJustification,
      
      // Rule Validation Override
      ruleValidationOverride: data.ruleValidationOverride,
      ruleValidationOverrideJustification: data.ruleValidationOverrideJustification,
      ruleValidationOverrideBy: data.ruleValidationOverrideBy,
      ruleValidationOverrideAt: data.ruleValidationOverrideAt,

      // Quote Requirement Override
      quoteRequirementOverride: data.quoteRequirementOverride,
      quoteRequirementOverrideJustification: data.quoteRequirementOverrideJustification,
      quoteRequirementOverrideBy: data.quoteRequirementOverrideBy,
      quoteRequirementOverrideAt: data.quoteRequirementOverrideAt,
      
      // PO Document Fields - Addresses
      deliveryAddressDifferent: data.deliveryAddressDifferent,
      deliveryAddress: data.deliveryAddress,
      billingAddressDifferent: data.billingAddressDifferent,
      billingAddress: data.billingAddress,
      
      // PO Document Fields - Representatives
      supplierRepresentativeName: data.supplierRepresentativeName,
      supplierRepresentativePhone: data.supplierRepresentativePhone,
      supplierRepresentativeEmail: data.supplierRepresentativeEmail,
      supplierRepresentativeTitle: data.supplierRepresentativeTitle,
      buyerRepresentativeName: data.buyerRepresentativeName,
      buyerRepresentativePhone: data.buyerRepresentativePhone,
      buyerRepresentativeEmail: data.buyerRepresentativeEmail,
      buyerRepresentativeTitle: data.buyerRepresentativeTitle,
      
      // PO Document Fields - Delivery & Payment
      modeOfDelivery: data.modeOfDelivery,
      modeOfDeliveryOther: data.modeOfDeliveryOther,
      packingInstructions: data.packingInstructions,
      paymentMethod: data.paymentMethod,
      paymentMethodOther: data.paymentMethodOther,
      paymentTerms: data.paymentTerms,
      
      // PO Document Fields - Banking
      supplierBankName: data.supplierBankName,
      supplierBankAccountName: data.supplierBankAccountName,
      supplierBankAccountNumber: data.supplierBankAccountNumber,
      supplierBankSwiftCode: data.supplierBankSwiftCode,
      supplierBankIban: data.supplierBankIban,
      supplierBankBranch: data.supplierBankBranch,
      
      // PO Document Fields - Tax & Duty
      applicableTaxes: data.applicableTaxes,
      taxPercentage: data.taxPercentage,
      dutyPercentage: data.dutyPercentage,
      
      // PO Document Fields - References
      referenceQuotationNumber: data.referenceQuotationNumber,
      referenceContractNumber: data.referenceContractNumber,
      referenceTenderNumber: data.referenceTenderNumber,
      
      // PO Document Fields - Internal Codes
      internalProjectCode: data.internalProjectCode,
      internalExpenseCode: data.internalExpenseCode,
      internalCostCenter: data.internalCostCenter,
      
      // PO Document Fields - Remarks
      poRemarks: data.poRemarks,
      specialInstructions: data.specialInstructions,
      
      // Supplier Data Fields
      supplierName: data.supplierName,
      supplierContact: data.supplierContact,
      supplierDataEnteredBy: data.supplierDataEnteredBy,
      supplierDataTimestamp: data.supplierDataTimestamp,
      
      // Vendor information
      selectedVendor: data.selectedVendor,
      vendor: data.vendor,
      vendorDetails: data.vendorDetails,
      
      // Last approved amount for approval rescinding
      lastApprovedAmount: data.lastApprovedAmount,
      
      // Object type (PR vs PO)
      objectType: data.objectType || 'PR',
    };
    
    // Debug logging for approver fields and quotes on fetch
    console.log(`Successfully fetched PR with ID: ${prId}`, {
      prNumber: pr.prNumber,
      status: pr.status,
      approver: pr.approver || '(not set)',
      approver2: pr.approver2 || '(not set)',
      approvalWorkflow: pr.approvalWorkflow ? {
        currentApprover: pr.approvalWorkflow.currentApprover || '(not set)',
        secondApprover: pr.approvalWorkflow.secondApprover || '(not set)'
      } : '(not set)',
      rawDataApprover2: data.approver2 || '(not in raw data)',
      quotesCount: pr.quotes?.length || 0,
      preferredQuoteId: pr.preferredQuoteId || '(not set)',
      rawQuotes: data.quotes || '(no quotes in raw data)',
      // APPROVED status fields
      estimatedDeliveryDate: pr.estimatedDeliveryDate || '(not set)',
      proformaOverride: pr.proformaOverride || false,
      popOverride: pr.popOverride || false,
      finalPrice: pr.finalPrice || '(not set)'
    });
    
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
        const currentStatus = currentData.status as PRStatus;
        // Use statusHistory array
        const currentStatusHistory: StatusHistoryItem[] = currentData.statusHistory || []; 

        // Check if we're reverting from PO status back to PR status
        const poStatuses = [PRStatus.APPROVED, PRStatus.ORDERED, PRStatus.COMPLETED];
        const prStatuses = [PRStatus.SUBMITTED, PRStatus.RESUBMITTED, PRStatus.IN_QUEUE, PRStatus.PENDING_APPROVAL, PRStatus.REVISION_REQUIRED];
        const isRevertingFromPOtoPR = poStatuses.includes(currentStatus) && prStatuses.includes(status);
        
        if (isRevertingFromPOtoPR) {
            console.log(`Status reverting from PO (${currentStatus}) to PR (${status}). Rescinding approvals...`);
            await rescindApprovals(
                prId,
                `Status reverted from ${currentStatus} to ${status}`,
                user
            );
        }

        // Clean the user object first to remove any undefined fields
        // Only include fields that have actual values (not undefined or null)
        const cleanUser: UserReference = {
          id: user.id,
          email: user.email || ''
        };
        // Only include optional fields if they have actual values (not undefined)
        if (user.firstName !== undefined && user.firstName !== null) cleanUser.firstName = user.firstName;
        if (user.lastName !== undefined && user.lastName !== null) cleanUser.lastName = user.lastName;
        if (user.name !== undefined && user.name !== null) {
          cleanUser.name = user.name;
        } else if (user.firstName || user.lastName) {
          cleanUser.name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown';
        }
        if (user.displayName !== undefined && user.displayName !== null) cleanUser.displayName = user.displayName;
        if (user.role !== undefined && user.role !== null) cleanUser.role = user.role;
        if (user.organization !== undefined && user.organization !== null) cleanUser.organization = user.organization;
        if (user.department !== undefined && user.department !== null) cleanUser.department = user.department;
        if (user.isActive !== undefined && user.isActive !== null) cleanUser.isActive = user.isActive;
        if (user.permissionLevel !== undefined && user.permissionLevel !== null) cleanUser.permissionLevel = user.permissionLevel;
        if (user.permissions !== undefined && user.permissions !== null) cleanUser.permissions = user.permissions;

        // Create new status history item using the cleaned user
        const statusHistoryEntry = createStatusHistoryItem(status, cleanUser, notes);

        // Recursively remove undefined values - Firestore doesn't accept undefined
        const cleanUndefined = (obj: any, depth: number = 0): any => {
          // Prevent infinite recursion
          if (depth > 10) {
            console.warn('[updatePRStatus] cleanUndefined: Max depth reached, returning null');
            return null;
          }
          
          // Handle null (Firestore accepts null)
          if (obj === null) {
            return null;
          }
          // Handle undefined - return a sentinel value that we'll filter out
          if (obj === undefined) {
            return '__UNDEFINED__';
          }
          // Handle arrays - clean each item and filter out undefined sentinels
          if (Array.isArray(obj)) {
            const cleaned = obj
              .map(item => cleanUndefined(item, depth + 1))
              .filter(item => item !== '__UNDEFINED__');
            return cleaned;
          }
          // Handle objects (but not Firestore special types like serverTimestamp)
          if (typeof obj === 'object' && obj !== null) {
            // Check if it's a Firestore special value (like serverTimestamp)
            // These have special properties that indicate they're Firestore types
            if (obj.constructor && obj.constructor.name && 
                (obj.constructor.name.includes('FieldValue') || 
                 obj.constructor.name === 'Timestamp' ||
                 typeof obj.toMillis === 'function')) {
              return obj; // Don't clean Firestore special values
            }
            
            const cleaned: any = {};
            for (const key in obj) {
              if (Object.prototype.hasOwnProperty.call(obj, key)) {
                const value = cleanUndefined(obj[key], depth + 1);
                // Only add the key if the value is not the undefined sentinel
                if (value !== '__UNDEFINED__') {
                  cleaned[key] = value;
                }
              }
            }
            return cleaned;
          }
          // Handle primitives
          return obj;
        };

        // Clean the status history entry before adding it
        const cleanedStatusHistoryEntry = cleanUndefined(statusHistoryEntry);
        console.log('[updatePRStatus] Cleaned status history entry:', JSON.stringify(cleanedStatusHistoryEntry, null, 2));
        
        // Clean existing status history entries as well (they might have undefined values)
        const cleanedCurrentStatusHistory = currentStatusHistory.map(entry => cleanUndefined(entry));
        console.log('[updatePRStatus] Cleaned current status history entries count:', cleanedCurrentStatusHistory.length);

        // Prepare update data
        const updateData: PRUpdateData = {
            status: status,
            // Append to statusHistory (both cleaned)
            statusHistory: [...cleanedCurrentStatusHistory, cleanedStatusHistoryEntry], 
            updatedAt: serverTimestamp(), 
        };
        
        // If status indicates final approval or rejection, potentially update workflow
        if (status === PRStatus.APPROVED || status === PRStatus.REJECTED) {
           // Add logic here if workflow state needs specific updates on final states
           // e.g., update approvalWorkflow.currentApprover to null or set a final timestamp
        }

        // Clean the entire update data object (cleanUndefined function is already defined above)
        const cleanedUpdateData = cleanUndefined(updateData);
        console.log('[updatePRStatus] Cleaned update data:', JSON.stringify(cleanedUpdateData, null, 2));
        await updateDoc(prDocRef, cleanedUpdateData);
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
    
    // Recursively filter out undefined values - Firestore doesn't allow undefined
    const cleanUndefined = (obj: any): any => {
      if (obj === null) return null;
      if (obj === undefined) return undefined;
      if (Array.isArray(obj)) {
        return obj.map(item => cleanUndefined(item));
      }
      if (typeof obj === 'object') {
        const cleaned: any = {};
        Object.keys(obj).forEach(key => {
          const value = cleanUndefined(obj[key]);
          if (value !== undefined) {
            cleaned[key] = value;
          }
        });
        return cleaned;
      }
      return obj;
    };
    
    const cleanedData = cleanUndefined(updateData);
    
    // Migration: If sites array is provided, ensure old site field is removed
    if ('sites' in cleanedData && Array.isArray(cleanedData.sites) && cleanedData.sites.length > 0) {
      // Remove legacy site field if sites array is present
      if ('site' in cleanedData) {
        delete cleanedData.site;
        console.log(`[updatePR] Migrated from site to sites array, removed legacy site field`);
      }
    }
    
    // Debug logging for approver fields and justifications
    console.log(`Firestore update payload for ${prId}:`, {
      approver: cleanedData.approver || '(not in payload)',
      approver2: cleanedData.approver2 || '(not in payload)',
      approvalWorkflow: cleanedData.approvalWorkflow ? {
        currentApprover: cleanedData.approvalWorkflow.currentApprover || '(not set)',
        secondApprover: cleanedData.approvalWorkflow.secondApprover || '(not set)'
      } : '(not in payload)',
      poLineItemDiscrepancyJustification: cleanedData.poLineItemDiscrepancyJustification ? 
        `${cleanedData.poLineItemDiscrepancyJustification.substring(0, 50)}...` : '(not in payload)',
      allKeys: Object.keys(cleanedData).sort()
    });
    
    await updateDoc(prDocRef, { ...cleanedData, updatedAt: serverTimestamp() });
    console.log(`Successfully updated PR ${prId}`);
  } catch (error) {
    console.error(`Failed to update PR ${prId}:`, error);
    throw new Error(`Failed to update PR: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Rescinds (clears) all approvals for a PR/PO
 * Used when status reverts from PO to PR or when amount changes significantly
 * @param prId - The ID of the PR to rescind approvals for
 * @param reason - Reason for rescinding approvals (for audit trail)
 * @param user - User who triggered the change (optional)
 * @returns A promise that resolves when approvals are rescinded
 */
export async function rescindApprovals(
  prId: string,
  reason: string,
  user?: UserReference
): Promise<void> {
  console.log(`Rescinding approvals for PR ${prId}. Reason: ${reason}`);
  
  if (!prId) {
    throw new Error('PR ID is required to rescind approvals');
  }
  
  try {
    const prDocRef = doc(db, PR_COLLECTION, prId);
    const prSnap = await getDoc(prDocRef);
    
    if (!prSnap.exists()) {
      throw new Error(`PR with ID ${prId} not found`);
    }
    
    const currentPR = prSnap.data() as PRRequest;
    const currentWorkflow = currentPR.approvalWorkflow || {
      currentApprover: null,
      secondApprover: null,
      requiresDualApproval: false,
      firstApprovalComplete: false,
      secondApprovalComplete: false,
      approvalHistory: [],
      lastUpdated: new Date().toISOString()
    };
    
    // Check if there are any approvals to rescind
    const hasApprovals = currentWorkflow.firstApprovalComplete || currentWorkflow.secondApprovalComplete;
    
    if (!hasApprovals) {
      console.log(`No approvals to rescind for PR ${prId}`);
      return;
    }
    
    // Create history entry for approval rescission
    const historyEntry: ApprovalHistoryItem = {
      approverId: user?.id || 'system',
      timestamp: new Date().toISOString(),
      approved: false,
      notes: `Approvals rescinded: ${reason}`
    };
    
    // Clear all approval-related fields
    const updatedWorkflow: ApprovalWorkflow = {
      ...currentWorkflow,
      firstApprovalComplete: false,
      secondApprovalComplete: false,
      firstApproverJustification: '',
      secondApproverJustification: '',
      firstApproverSelectedQuoteId: undefined,
      secondApproverSelectedQuoteId: undefined,
      quoteConflict: false,
      approvalHistory: [...(currentWorkflow.approvalHistory || []), historyEntry],
      lastUpdated: new Date().toISOString()
    };
    
    // Update the PR with rescinded approvals
    await updateDoc(prDocRef, {
      approvalWorkflow: updatedWorkflow,
      updatedAt: serverTimestamp()
    });
    
    console.log(`Successfully rescinded approvals for PR ${prId}`);
    
    // TODO: Send notifications to approvers, requestor, and procurement
    // This should be implemented when the notification system is ready
    
  } catch (error) {
    console.error(`Failed to rescind approvals for PR ${prId}:`, error);
    throw new Error(`Failed to rescind approvals: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Reassigns a PR/PO to a different organization.
 * Superadmin-only. Updates org, rewrites PR number segments, validates approvers,
 * and records everything in statusHistory.
 */
export async function reassignOrganization(
  prId: string,
  newOrganization: string,
  reason: string,
  user: UserReference
): Promise<{ approversCleared: boolean; statusReverted: boolean; newPrNumber: string }> {
  if (!prId || !newOrganization || !reason) {
    throw new Error('PR ID, new organization, and reason are required.');
  }

  const currentPR = await getPR(prId);
  if (!currentPR) {
    throw new Error(`PR with ID ${prId} not found.`);
  }

  const oldOrganization = currentPR.organization;
  const oldPrNumber = currentPR.prNumber;

  if (normalizeOrganizationId(oldOrganization) === normalizeOrganizationId(newOrganization)) {
    throw new Error('New organization is the same as the current organization.');
  }

  // Rewrite org/country segments in PR number (format: YYMMDD-####-ORG-CC)
  const { orgCode: newOrgCode, countryCode: newCountryCode } = getOrgCodes(newOrganization);
  const parts = oldPrNumber.split('-');
  let newPrNumber: string;
  if (parts.length >= 4) {
    parts[2] = newOrgCode;
    parts[3] = newCountryCode;
    newPrNumber = parts.join('-');
  } else {
    newPrNumber = oldPrNumber;
  }

  // Check approver validity for the new org
  const validApprovers = await approverService.getApprovers(newOrganization);
  const validApproverIds = new Set(validApprovers.map(a => a.id));

  const approver1Valid = !currentPR.approver || validApproverIds.has(currentPR.approver);
  const approver2Valid = !currentPR.approver2 || validApproverIds.has(currentPR.approver2);
  const approversCleared = !approver1Valid || !approver2Valid;

  const needsStatusRevert = approversCleared &&
    (currentPR.status === PRStatus.PENDING_APPROVAL || currentPR.status === PRStatus.APPROVED);

  // Build update payload
  const updatePayload: Partial<PRRequest> = {
    organization: newOrganization,
    prNumber: newPrNumber,
  };

  if (approversCleared) {
    updatePayload.approver = undefined as any;
    updatePayload.approver2 = undefined as any;
    updatePayload.requiresDualApproval = false;
    updatePayload.approvalWorkflow = {
      currentApprover: null,
      secondApprover: null,
      requiresDualApproval: false,
      firstApprovalComplete: false,
      secondApprovalComplete: false,
      approvalHistory: [
        ...(currentPR.approvalWorkflow?.approvalHistory || []),
        {
          approverId: user.id,
          timestamp: new Date().toISOString(),
          approved: false,
          notes: `Approvers cleared: not valid for new organization (${newOrganization}). Previous org: ${oldOrganization}.`
        }
      ],
      lastUpdated: new Date().toISOString()
    };
  }

  await updatePR(prId, updatePayload);

  // Record the org change in statusHistory
  const targetStatus = needsStatusRevert ? PRStatus.IN_QUEUE : currentPR.status;
  const noteParts = [
    `Organization reassigned from ${oldOrganization} to ${newOrganization}.`,
    `PR number updated: ${oldPrNumber} → ${newPrNumber}.`,
    `Reason: ${reason}`,
  ];
  if (approversCleared) {
    noteParts.push(`Approvers cleared (not valid for new organization).`);
    if (needsStatusRevert) {
      noteParts.push(`Status reverted from ${currentPR.status} to ${targetStatus}.`);
    }
  }

  await updatePRStatus(prId, targetStatus, noteParts.join(' '), user);

  console.log(`Organization reassigned for PR ${prId}: ${oldOrganization} → ${newOrganization}, number: ${oldPrNumber} → ${newPrNumber}`);

  return {
    approversCleared,
    statusReverted: needsStatusRevert,
    newPrNumber
  };
}

/**
 * Checks if amount change exceeds rescinding thresholds
 * @param oldAmount - The previously approved amount
 * @param newAmount - The new amount being set
 * @returns Object with shouldRescind flag and reason if applicable
 */
export function shouldRescindApprovalsForAmountChange(
  oldAmount: number,
  newAmount: number
): { shouldRescind: boolean; reason?: string; percentChange?: number } {
  if (!oldAmount || oldAmount === 0) {
    return { shouldRescind: false };
  }
  
  const difference = newAmount - oldAmount;
  const percentChange = (difference / oldAmount) * 100;
  
  // Check for upward change > 5%
  if (percentChange > 5) {
    return {
      shouldRescind: true,
      reason: `Amount increased by ${percentChange.toFixed(2)}% (from ${oldAmount} to ${newAmount})`,
      percentChange
    };
  }
  
  // Check for downward change > 20%
  if (percentChange < -20) {
    return {
      shouldRescind: true,
      reason: `Amount decreased by ${Math.abs(percentChange).toFixed(2)}% (from ${oldAmount} to ${newAmount})`,
      percentChange
    };
  }
  
  return { shouldRescind: false };
}

/**
 * Checks if final price variance requires approver sign-off
 * @param approvedAmount - The amount when PR was approved
 * @param finalPrice - The final price from proforma invoice
 * @param upwardThreshold - Maximum upward variance allowed (percentage, default 5%)
 * @param downwardThreshold - Maximum downward variance allowed (percentage, default 20%)
 * @returns Object with requiresApproval flag, variance percentage, and reason
 */
export function checkFinalPriceVariance(
  approvedAmount: number,
  finalPrice: number,
  upwardThreshold: number = 5,
  downwardThreshold: number = 20
): { 
  requiresApproval: boolean; 
  variancePercentage: number; 
  reason?: string;
  withinThresholds: boolean;
} {
  if (!approvedAmount || approvedAmount === 0) {
    return { 
      requiresApproval: false, 
      variancePercentage: 0,
      withinThresholds: true
    };
  }
  
  const difference = finalPrice - approvedAmount;
  const variancePercentage = (difference / approvedAmount) * 100;
  
  // Check for upward variance exceeding threshold
  if (variancePercentage > upwardThreshold) {
    return {
      requiresApproval: true,
      variancePercentage,
      reason: `Final price is ${variancePercentage.toFixed(2)}% higher than approved amount (${finalPrice} vs ${approvedAmount}). Exceeds upward threshold of ${upwardThreshold}%.`,
      withinThresholds: false
    };
  }
  
  // Check for downward variance exceeding threshold
  if (variancePercentage < -downwardThreshold) {
    return {
      requiresApproval: true,
      variancePercentage,
      reason: `Final price is ${Math.abs(variancePercentage).toFixed(2)}% lower than approved amount (${finalPrice} vs ${approvedAmount}). Exceeds downward threshold of ${downwardThreshold}%.`,
      withinThresholds: false
    };
  }
  
  // Within acceptable range
  return { 
    requiresApproval: false, 
    variancePercentage,
    withinThresholds: true,
    reason: `Final price variance of ${variancePercentage.toFixed(2)}% is within acceptable thresholds (${-downwardThreshold}% to +${upwardThreshold}%).`
  };
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

    // Recursively remove undefined values - Firestore doesn't accept undefined
    const cleanUndefined = (obj: any): any => {
      if (obj === null || obj === undefined) {
        return null;
      }
      if (Array.isArray(obj)) {
        // Filter out undefined values from arrays, but keep null
        return obj
          .map(item => cleanUndefined(item))
          .filter(item => item !== undefined);
      }
      if (typeof obj === 'object') {
        const cleaned: any = {};
        for (const key in obj) {
          const value = cleanUndefined(obj[key]);
          if (value !== undefined) {
            cleaned[key] = value;
          }
        }
        return cleaned;
      }
      return obj;
    };

    const cleanedPRData = cleanUndefined(finalPRData) as Omit<PRRequest, 'id'>;

    // Migration: If sites array is provided, ensure old site field is removed
    if ('sites' in cleanedPRData && Array.isArray(cleanedPRData.sites) && cleanedPRData.sites.length > 0) {
      // Remove legacy site field if sites array is present
      if ('site' in cleanedPRData) {
        delete (cleanedPRData as any).site;
        console.log('[PR SERVICE] Migrated from site to sites array, removed legacy site field');
      }
    }

    // Validate required fields before attempting to save
    const requiredFields = ['prNumber', 'organization', 'department', 'projectCategory', 'description', 'sites', 'expenseType', 'estimatedAmount', 'currency', 'requiredDate', 'requestorId', 'requestorEmail', 'requestor', 'status'];
    const missingFields = requiredFields.filter(field => {
      const value = cleanedPRData[field as keyof typeof cleanedPRData];
      // Special handling for sites array
      if (field === 'sites') {
        return !Array.isArray(value) || value.length === 0;
      }
      return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
    });

    if (missingFields.length > 0) {
      console.error('[PR SERVICE] ❌ Missing or empty required fields:', missingFields);
      console.error('[PR SERVICE] Current cleaned data:', cleanedPRData);
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    console.log('[PR SERVICE] ========== FINAL PR DATA ==========');
    console.log('[PR SERVICE] Full cleaned PR data:', JSON.stringify(cleanedPRData, null, 2));
    console.log('[PR SERVICE] - PR Number:', cleanedPRData.prNumber);
    console.log('[PR SERVICE] - Organization:', cleanedPRData.organization);
    console.log('[PR SERVICE] - Department:', cleanedPRData.department);
    console.log('[PR SERVICE] - Project Category:', cleanedPRData.projectCategory);
    console.log('[PR SERVICE] - Sites:', cleanedPRData.sites);
    console.log('[PR SERVICE] - Expense Type:', cleanedPRData.expenseType);
    console.log('[PR SERVICE] - Preferred Vendor:', cleanedPRData.preferredVendor);
    console.log('[PR SERVICE] - Requestor ID:', cleanedPRData.requestorId);
    console.log('[PR SERVICE] - Estimated Amount:', cleanedPRData.estimatedAmount);
    console.log('[PR SERVICE] - Currency:', cleanedPRData.currency);
    console.log('[PR SERVICE] - Status:', cleanedPRData.status);
    console.log('[PR SERVICE] =====================================');
    console.log('[PR SERVICE] Attempting to save to Firestore...');

    // Use addDoc to create a new document with an auto-generated ID
    let docRef;
    try {
      docRef = await addDoc(collection(db, PR_COLLECTION), cleanedPRData);
      console.log(`[PR SERVICE] ✅ Successfully created PR ${prNumber} with ID ${docRef.id}`);
    } catch (firestoreError: any) {
      console.error('[PR SERVICE] ❌ Firestore error details:');
      console.error('[PR SERVICE] - Error code:', firestoreError?.code);
      console.error('[PR SERVICE] - Error message:', firestoreError?.message);
      console.error('[PR SERVICE] - Error stack:', firestoreError?.stack);
      console.error('[PR SERVICE] - Full error object:', firestoreError);
      throw firestoreError; // Re-throw to be caught by outer catch
    }
     
    // Trigger notification for new PR submission
    try {
      const notificationHandler = new SubmitPRNotificationHandler();
      
      // Create the complete PR object with the generated ID
      const completePRData = {
        ...cleanedPRData,
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
 * @param showOnlyMyPRs - If true, only show PRs where the user is the requestor, first approver, or second approver.
 * @param forceServerFetch - If true, bypass Firestore cache and fetch from server.
 * @returns A promise that resolves with an array of PRs.
 */
export async function getUserPRs(
    userId: string, 
    organization?: string, 
    showOnlyMyPRs: boolean = true,
    forceServerFetch: boolean = false
): Promise<PRRequest[]> {
    console.log(`Fetching PRs for user ${userId}, org: ${organization}, onlyMine: ${showOnlyMyPRs}, forceServerFetch: ${forceServerFetch}`);
    if (!userId) {
        console.error('getUserPRs called without userId');
        throw new Error('User ID is required to fetch PRs.');
    }

    try {
        const prCollectionRef = collection(db, PR_COLLECTION);
        const constraints: QueryConstraint[] = [];

        if (showOnlyMyPRs) {
            // Show PRs where user is requestor OR listed as approver (approver or approver2)
            const userFilter = or(
                where('requestorId', '==', userId),
                where('approver', '==', userId),
                where('approver2', '==', userId)
            );
            
            // If organization is provided, wrap both filters in an AND
            if (organization) {
                constraints.push(
                    and(
                        userFilter,
                        where('organization', '==', organization)
                    ) as any
                );
            } else {
                constraints.push(userFilter as any);
            }
        } else {
            // Show all PRs in the organization that user has visibility to
            if (organization) {
                constraints.push(where('organization', '==', organization));
            }
        }

        constraints.push(orderBy('createdAt', 'desc')); // Order by creation date

        const q = query(prCollectionRef, ...constraints);
        // Force fetch from server if requested (bypasses Firestore cache)
        const querySnapshot = forceServerFetch 
            ? await getDocs(query(prCollectionRef, ...constraints))  // TODO: Add { source: 'server' } when supported
            : await getDocs(q);

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

const ORG_CODE_MAP: Record<string, string> = {
  '1pwr_lesotho': '1PL',
  '1pwr_benin': '1PB',
  '1pwr_zambia': '1PZ',
  'neo1': 'NEO',
  'pueco_benin': 'PCB',
  'pueco_lesotho': 'PCL',
  'smp': 'SMP',
  'mgb': 'MIO',
  'mionwa': 'MIO',
  'mionwa_gen': 'MIO',
  'lesotho': '1PL',
  'benin': '1PB',
  'zambia': '1PZ',
  'sotho_minigrid_portfolio': 'SMP'
};

const COUNTRY_CODE_MAP: Record<string, string> = {
  '1pwr_lesotho': 'LS',
  '1pwr_benin': 'BN',
  '1pwr_zambia': 'ZM',
  'neo1': 'LS',
  'pueco_benin': 'BN',
  'pueco_lesotho': 'LS',
  'smp': 'LS',
  'mgb': 'BN',
  'mionwa': 'BN',
  'mionwa_gen': 'BN',
  'lesotho': 'LS',
  'benin': 'BN',
  'zambia': 'ZM',
  'sotho_minigrid_portfolio': 'LS'
};

export function getOrgCodes(organization: string): { orgCode: string; countryCode: string } {
  const normalizedOrg = normalizeOrganizationId(organization);
  return {
    orgCode: ORG_CODE_MAP[normalizedOrg] || organization.substring(0, 3).toUpperCase(),
    countryCode: COUNTRY_CODE_MAP[normalizedOrg] || 'XX'
  };
}

/**
 * Generates a new PR number based on the organization and current date.
 * Uses a Firestore counter to ensure unique sequential numbers.
 * @param organization - The organization code.
 * @returns The next PR number
 */
export async function generatePRNumber(organization: string = 'UNK'): Promise<string> {
  const now = new Date();
  const yy = now.getFullYear().toString().slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const currentYear = now.getFullYear();
  
  const normalizedOrg = normalizeOrganizationId(organization);
  const { orgCode, countryCode } = getOrgCodes(organization);
  
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

export interface PRWithVendorRelationship extends PRRequest {
  vendorRelationship: string[];
}

/**
 * Get all PRs/POs associated with a specific vendor, including relationship type
 * A vendor is associated with a PR if they are:
 * - The preferred vendor
 * - The selected vendor
 * - Submitted a quote (even if not selected)
 * 
 * @param vendorId - The vendor ID to search for
 * @param vendorName - Optional vendor name for quote matching
 * @returns Promise<PRWithVendorRelationship[]> - Array of PRs with vendor relationship info
 */
export async function getPRsByVendor(vendorId: string, vendorName?: string): Promise<PRWithVendorRelationship[]> {
  console.log(`Fetching PRs for vendor: ${vendorId}`);
  if (!vendorId) {
    console.error('getPRsByVendor called without vendorId');
    throw new Error('Vendor ID is required');
  }

  try {
    const prCollectionRef = collection(db, PR_COLLECTION);
    
    // Map to store PRs with their relationship types
    const prMap = new Map<string, { pr: PRRequest; relationships: Set<string> }>();
    
    const convertPR = (data: any, docId: string): PRRequest => ({
      id: docId,
      ...data,
      createdAt: safeTimestampToISO(data.createdAt),
      updatedAt: safeTimestampToISO(data.updatedAt),
      requiredDate: safeTimestampToISO(data.requiredDate),
      lastModifiedAt: safeTimestampToISO(data.lastModifiedAt),
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
    
    // Query 1: PRs where vendor is preferred vendor
    try {
      const q1 = query(
        prCollectionRef,
        where('preferredVendor', '==', vendorId),
        orderBy('createdAt', 'desc')
      );
      const snapshot1 = await getDocs(q1);
      
      snapshot1.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        const pr = convertPR(data, docSnapshot.id);
        
        if (!prMap.has(docSnapshot.id)) {
          prMap.set(docSnapshot.id, { pr, relationships: new Set() });
        }
        prMap.get(docSnapshot.id)!.relationships.add('Preferred Vendor');
      });
    } catch (error) {
      console.error('Error querying preferredVendor:', error);
    }
    
    // Query 2: PRs where vendor is selected vendor
    try {
      const q2 = query(
        prCollectionRef,
        where('selectedVendor', '==', vendorId),
        orderBy('createdAt', 'desc')
      );
      const snapshot2 = await getDocs(q2);
      
      snapshot2.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        
        if (!prMap.has(docSnapshot.id)) {
          const pr = convertPR(data, docSnapshot.id);
          prMap.set(docSnapshot.id, { pr, relationships: new Set() });
        }
        prMap.get(docSnapshot.id)!.relationships.add('Selected Vendor');
      });
    } catch (error) {
      console.error('Error querying selectedVendor:', error);
    }
    
    // Query 3: Get all PRs and check for quotes from this vendor
    try {
      const q3 = query(prCollectionRef, orderBy('createdAt', 'desc'));
      const snapshot3 = await getDocs(q3);
      
      snapshot3.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        const quotes = data.quotes || [];
        
        // Check if any quote is from this vendor
        const hasQuote = quotes.some((quote: any) => {
          const matchesId = quote.vendorId === vendorId || quote.vendor === vendorId;
          const matchesName = vendorName && quote.vendorName && 
            quote.vendorName.toLowerCase() === vendorName.toLowerCase();
          return matchesId || matchesName;
        });
        
        if (hasQuote) {
          if (!prMap.has(docSnapshot.id)) {
            const pr = convertPR(data, docSnapshot.id);
            prMap.set(docSnapshot.id, { pr, relationships: new Set() });
          }
          prMap.get(docSnapshot.id)!.relationships.add('Quote Submitted');
        }
      });
    } catch (error) {
      console.error('Error querying for quotes:', error);
    }

    // Convert map to array with relationship info
    const prsWithRelationships: PRWithVendorRelationship[] = Array.from(prMap.values()).map(({ pr, relationships }) => ({
      ...pr,
      vendorRelationship: Array.from(relationships).sort((a, b) => {
        // Sort order: Selected Vendor, Preferred Vendor, Quote Submitted
        const order = { 'Selected Vendor': 0, 'Preferred Vendor': 1, 'Quote Submitted': 2 };
        return (order[a as keyof typeof order] || 3) - (order[b as keyof typeof order] || 3);
      })
    }));
    
    // Sort by creation date
    prsWithRelationships.sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    console.log(`Found ${prsWithRelationships.length} PRs for vendor ${vendorId} (all relationships)`);
    return prsWithRelationships;
  } catch (error) {
    console.error(`Failed to fetch PRs for vendor ${vendorId}:`, error);
    throw new Error(`Failed to retrieve purchase requests: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get all quotes associated with a specific vendor across all PRs
 * @param vendorId - The vendor ID (can be vendor.id or vendor.name)
 * @returns Promise<Array> - Array of quotes with PR context
 */
export async function getQuotesByVendor(vendorId: string, vendorName?: string): Promise<Array<{
  prId: string;
  prNumber: string;
  quote: any;
  prStatus: string;
  organization: string;
}>> {
  console.log(`Fetching quotes for vendor: ${vendorId} / ${vendorName}`);
  if (!vendorId && !vendorName) {
    console.error('getQuotesByVendor called without vendorId or vendorName');
    throw new Error('Vendor ID or name is required');
  }

  try {
    const prCollectionRef = collection(db, PR_COLLECTION);
    
    // Get all PRs (we'll filter quotes in memory since Firestore doesn't support array-contains with nested fields well)
    const q = query(prCollectionRef, orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    
    const vendorQuotes: Array<{
      prId: string;
      prNumber: string;
      quote: any;
      prStatus: string;
      organization: string;
    }> = [];

    querySnapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      const quotes = data.quotes || [];
      
      // Filter quotes for this vendor
      quotes.forEach((quote: any) => {
        const matchesId = vendorId && (quote.vendorId === vendorId || quote.vendor === vendorId);
        const matchesName = vendorName && quote.vendorName && 
          quote.vendorName.toLowerCase() === vendorName.toLowerCase();
        
        if (matchesId || matchesName) {
          vendorQuotes.push({
            prId: docSnapshot.id,
            prNumber: data.prNumber || docSnapshot.id,
            quote: quote,
            prStatus: data.status,
            organization: data.organization,
          });
        }
      });
    });

    console.log(`Found ${vendorQuotes.length} quotes for vendor ${vendorId}`);
    return vendorQuotes;
  } catch (error) {
    console.error(`Failed to fetch quotes for vendor:`, error);
    throw new Error(`Failed to retrieve quotes: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ─── PO Amendment Functions ──────────────────────────────────────────

function computeAmendmentDiff(
  original: PRRequest,
  changes: Partial<PRRequest>
): Record<string, { from: any; to: any }> {
  const diff: Record<string, { from: any; to: any }> = {};
  const ignore = new Set(['updatedAt', 'pendingAmendment', 'amendmentHistory', 'approvalWorkflow']);
  
  for (const [key, newVal] of Object.entries(changes)) {
    if (ignore.has(key)) continue;
    const oldVal = (original as any)[key];
    const oldStr = JSON.stringify(oldVal ?? null);
    const newStr = JSON.stringify(newVal ?? null);
    if (oldStr !== newStr) {
      diff[key] = { from: oldVal ?? null, to: newVal ?? null };
    }
  }
  return diff;
}

export async function submitAmendment(
  prId: string,
  changes: Partial<PRRequest>,
  notes: string,
  user: UserReference
): Promise<void> {
  console.log(`[Amendment] Submitting amendment for PR ${prId}`);
  const pr = await getPR(prId, true);
  if (!pr) throw new Error('PR not found');

  if (!['APPROVED', 'ORDERED', 'COMPLETED'].includes(pr.status)) {
    throw new Error('Amendments can only be submitted for approved POs');
  }
  if (pr.pendingAmendment?.status === 'PENDING') {
    throw new Error('This PO already has a pending amendment. Cancel or wait for resolution.');
  }

  const amendment: PendingAmendment = {
    changes,
    requestedBy: user,
    requestedAt: new Date().toISOString(),
    notes,
    status: 'PENDING',
  };

  const prDocRef = doc(db, PR_COLLECTION, prId);
  await updateDoc(prDocRef, {
    pendingAmendment: amendment,
    updatedAt: serverTimestamp(),
  });
  console.log(`[Amendment] Pending amendment saved for PR ${prId}`);

  try {
    const { notificationService } = await import('./notification');
    await notificationService.handleAmendment(prId, 'submitted', user);
  } catch (err) {
    console.error('[Amendment] Notification failed (non-blocking):', err);
  }
}

export async function resolveAmendment(
  prId: string,
  approved: boolean,
  resolverNotes: string,
  user: UserReference
): Promise<void> {
  console.log(`[Amendment] Resolving amendment for PR ${prId}: ${approved ? 'APPROVED' : 'REJECTED'}`);
  const pr = await getPR(prId, true);
  if (!pr) throw new Error('PR not found');
  if (!pr.pendingAmendment || pr.pendingAmendment.status !== 'PENDING') {
    throw new Error('No pending amendment to resolve');
  }

  const amendment = pr.pendingAmendment;
  const isDualApproval = pr.requiresDualApproval || pr.approvalWorkflow?.requiresDualApproval;

  if (isDualApproval) {
    const isFirstApprover = user.id === pr.approver || user.id === pr.approvalWorkflow?.currentApprover;
    const isSecondApprover = user.id === pr.approver2 || user.id === pr.approvalWorkflow?.secondApprover;
    const decision = { approverId: user.id, approved, at: new Date().toISOString(), notes: resolverNotes };

    if (isFirstApprover && !amendment.firstApproverDecision) {
      amendment.firstApproverDecision = decision;
    } else if (isSecondApprover && !amendment.secondApproverDecision) {
      amendment.secondApproverDecision = decision;
    } else if (!amendment.firstApproverDecision) {
      amendment.firstApproverDecision = decision;
    } else if (!amendment.secondApproverDecision) {
      amendment.secondApproverDecision = decision;
    }

    // If either approver rejects, the amendment is rejected
    if (amendment.firstApproverDecision?.approved === false || amendment.secondApproverDecision?.approved === false) {
      await finalizeAmendment(pr, amendment, false, user, resolverNotes);
      return;
    }

    // Both must approve
    if (amendment.firstApproverDecision?.approved && amendment.secondApproverDecision?.approved) {
      await finalizeAmendment(pr, amendment, true, user, resolverNotes);
      return;
    }

    // Only one has decided so far — save partial decision
    const prDocRef = doc(db, PR_COLLECTION, prId);
    await updateDoc(prDocRef, {
      pendingAmendment: amendment,
      updatedAt: serverTimestamp(),
    });
    console.log(`[Amendment] Partial dual-approval decision recorded for PR ${prId}`);
    return;
  }

  // Single approval
  await finalizeAmendment(pr, amendment, approved, user, resolverNotes);
}

async function finalizeAmendment(
  pr: PRRequest,
  amendment: PendingAmendment,
  approved: boolean,
  resolver: UserReference,
  resolverNotes: string
): Promise<void> {
  const diff = computeAmendmentDiff(pr, amendment.changes);

  const historyEntry: AmendmentHistoryItem = {
    changes: diff,
    requestedBy: amendment.requestedBy,
    requestedAt: amendment.requestedAt,
    notes: amendment.notes,
    resolution: approved ? 'APPROVED' : 'REJECTED',
    resolvedBy: resolver,
    resolvedAt: new Date().toISOString(),
    resolverNotes,
  };

  const prDocRef = doc(db, PR_COLLECTION, pr.id);
  const existingHistory: AmendmentHistoryItem[] = pr.amendmentHistory || [];

  if (approved) {
    // Apply changes + archive amendment + clear pending
    const cleanChanges = { ...amendment.changes };
    delete (cleanChanges as any).id;
    delete (cleanChanges as any).prNumber;
    delete (cleanChanges as any).status;

    await updateDoc(prDocRef, {
      ...cleanChanges,
      pendingAmendment: null,
      amendmentHistory: [...existingHistory, historyEntry],
      updatedAt: serverTimestamp(),
    });
    console.log(`[Amendment] Amendment APPROVED and applied for PR ${pr.id}`);
  } else {
    await updateDoc(prDocRef, {
      pendingAmendment: null,
      amendmentHistory: [...existingHistory, historyEntry],
      updatedAt: serverTimestamp(),
    });
    console.log(`[Amendment] Amendment REJECTED for PR ${pr.id}`);
  }

  try {
    const { notificationService } = await import('./notification');
    await notificationService.handleAmendment(pr.id, approved ? 'approved' : 'rejected', resolver, resolverNotes);
  } catch (err) {
    console.error('[Amendment] Notification failed (non-blocking):', err);
  }
}

export async function cancelAmendment(
  prId: string,
  user: UserReference
): Promise<void> {
  console.log(`[Amendment] Cancelling amendment for PR ${prId}`);
  const pr = await getPR(prId, true);
  if (!pr) throw new Error('PR not found');
  if (!pr.pendingAmendment || pr.pendingAmendment.status !== 'PENDING') {
    throw new Error('No pending amendment to cancel');
  }

  const diff = computeAmendmentDiff(pr, pr.pendingAmendment.changes);
  const historyEntry: AmendmentHistoryItem = {
    changes: diff,
    requestedBy: pr.pendingAmendment.requestedBy,
    requestedAt: pr.pendingAmendment.requestedAt,
    notes: pr.pendingAmendment.notes,
    resolution: 'REJECTED',
    resolvedBy: user,
    resolvedAt: new Date().toISOString(),
    resolverNotes: 'Cancelled by submitter',
  };

  const existingHistory: AmendmentHistoryItem[] = pr.amendmentHistory || [];
  const prDocRef = doc(db, PR_COLLECTION, prId);
  await updateDoc(prDocRef, {
    pendingAmendment: null,
    amendmentHistory: [...existingHistory, historyEntry],
    updatedAt: serverTimestamp(),
  });
  console.log(`[Amendment] Amendment cancelled for PR ${prId}`);
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
  deletePR,
  getPRsByVendor,
  getQuotesByVendor,
  reassignOrganization,
  submitAmendment,
  resolveAmendment,
  cancelAmendment,
  computeAmendmentDiff,
};