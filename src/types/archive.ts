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
  
  /** Description of request */
  description?: string;
  
  /** Estimated or actual amount */
  amount?: number;
  
  /** Currency */
  currency?: string;
  
  /** Vendor/Supplier name */
  vendor?: string;
  
  /** Required date */
  requiredDate?: string;
  
  /** Any additional notes or comments */
  notes?: string;
  
  /** Status (if available from old system, otherwise null) */
  status?: string;
  
  /** Any other fields from the CSV that don't map directly */
  [key: string]: any;
  
  /** Import metadata */
  importedAt: string;
  importedBy?: string;
  sourceFile?: string;
}

