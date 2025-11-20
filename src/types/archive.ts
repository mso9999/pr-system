/**
 * Archive PR Types
 * Types for legacy/archived purchase requests from the old Google Forms system
 */

export interface ArchivePR {
  /** Unique identifier (from import or generated) */
  id: string;
  
  /** Original submission timestamp from old system */
  submittedDate?: string;
  
  /** Requestor name (from old system) */
  requestorName?: string;
  
  /** Requestor email (if available) */
  requestorEmail?: string;
  
  /** Department */
  department?: string;
  
  /** Organization */
  organization?: string;
  
  /** Site/Location */
  site?: string;
  
  /** Project/Category */
  projectCategory?: string;
  
  /** Reason / context for request */
  reason?: string;
  
  /** Description of request */
  description?: string;
  
  /** Entity paying for the expense */
  entity?: string;
  
  /** Estimated or actual amount */
  amount?: number;
  
  /** Currency */
  currency?: string;
  
  /** Vendor/Supplier name (for display) */
  vendorName?: string;
  /** Vendor code (for linking to current system) */
  vendorCode?: string;
  /** Legacy vendor name (original from CSV) */
  vendor?: string;
  
  /** Required date */
  requiredDate?: string;
  
  /** Any additional notes or comments */
  notes?: string;
  
  /** Urgency information from legacy form */
  urgent?: string;
  
  /** Budget approval notes from legacy form */
  budgetApproval?: string;
  
  /** Attachment references from legacy form */
  attachments?: string[];
  
  /** Additional information provided in legacy form */
  otherInfo?: string;
  
  /** Status (if available from old system, otherwise null) */
  status?: string;
  
  /** Payment type requested */
  paymentType?: string;
  
  /** Related vehicle (if any) */
  vehicle?: string;
  
  /** Legacy responses preserving the original form columns */
  legacyResponses?: {
    question: string;
    answer: string;
  }[];
  
  /** Original data snapshot */
  originalData: Record<string, unknown>;
  
  /** Import metadata */
  importedAt: string;
  importedBy?: string;
  sourceFile?: string;
}

