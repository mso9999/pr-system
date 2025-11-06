export interface ReferenceDataItem {
  id: string;
  code?: string;
  name: string;
  type?: string;
  organization?: {
    id: string;
    name: string;
  };
  organizationId?: string;
  approved?: boolean;
  productsServices?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  city?: string;
  country?: string;
  url?: string;
  notes?: string;
  isActive?: boolean;
  
  // Vendor Approval Status Tracking
  isApproved?: boolean;
  approvalDate?: string;
  approvalExpiryDate?: string;
  approvalReason?: 'auto_3quote' | 'auto_completed' | 'manual';
  approvedBy?: string;
  approvalNote?: string;
  associatedPONumber?: string;
  lastCompletedOrderDate?: string;
  last3QuoteProcessDate?: string;
  
  // High-Value Vendor Classification
  isHighValue?: boolean;
  cumulativeOrderValue?: number;

  // Organization specific fields
  /** Display name for the organization (e.g., '1PWR Lesotho') */
  orgName?: string;
  /** Timezone offset from GMT in hours (e.g., +2 for SAST) */
  timezoneOffset?: number;
  /** Currency code used by the organization (e.g., 'LSL') */
  currency?: string;

  // Permission specific fields
  level?: number;
  actions?: string[];
  scope?: string[];

  // Vehicle specific fields
  /** Registration number of the vehicle (required) */
  registrationNumber?: string;
  /** Manufacturing year of the vehicle (required) */
  year?: number;
  /** Manufacturer of the vehicle (required) */
  make?: string;
  /** Model of the vehicle (required) */
  model?: string;
  /** Vehicle Identification Number (optional) */
  vinNumber?: string;
  /** Engine number for identification (optional) */
  engineNumber?: string;

  // Rule specific fields
  number?: string;
  description?: string;
  threshold?: number;
  active?: boolean;
}

export interface Rule {
  id: string;
  type: 'RULE_1' | 'RULE_2';
  number: string;
  description: string;
  threshold: number;
  uom?: string; // Unit of Measure: Can be currency (LSL, USD, etc.), percentage (%), or NA
  currency?: string; // Deprecated - kept for backwards compatibility, use uom instead
  active: boolean;
  organization: {
    id: string;
    name: string;
  };
  organizationId: string;
  approverThresholds: {
    procurement: number;
    financeAdmin: number;
    ceo: number | null;
  };
  quoteRequirements: {
    aboveThreshold: number;
    belowThreshold: {
      approved: number;
      default: number;
    };
  };
  createdAt: string;
  updatedAt: string;
}

export type ReferenceDataType = 
  | 'departments'
  | 'sites'
  | 'expenseTypes'
  | 'projectCategories'
  | 'vendors'
  | 'currencies'
  | 'uom'
  | 'organizations'
  | 'permissions'
  | 'vehicles'
  | 'rules';

// Types that don't depend on organization
export const ORG_INDEPENDENT_TYPES = [
  'currencies',
  'uom',
  'organizations'
] as const;

// Types that use code as ID
export const CODE_BASED_ID_TYPES = [
  'currencies',
  'uom',
  'organizations'
] as const;

/**
 * Vendor Interface
 * Enhanced type for vendor-specific data with approval tracking
 */
export interface Vendor extends ReferenceDataItem {
  // Core vendor fields
  id: string;
  name: string;
  code?: string;
  contactEmail?: string;
  contactPhone?: string;
  url?: string;
  address?: string;
  city?: string;
  country?: string;
  productsServices?: string;
  active: boolean;
  
  // Approval Status Tracking
  isApproved: boolean;
  approvalDate?: string;
  approvalExpiryDate?: string;
  approvalReason?: 'auto_3quote' | 'auto_completed' | 'manual';
  approvedBy?: string;
  approvalNote?: string; // Justification or override reason
  associatedPONumber?: string; // If auto-approved from order
  lastCompletedOrderDate?: string;
  last3QuoteProcessDate?: string;
  
  // High-Value Classification
  isHighValue?: boolean;
  cumulativeOrderValue?: number;
  
  // Documents (will be added in later phases)
  // bankLetter?: Attachment;
  // corporateDocuments?: Attachment[];
}
