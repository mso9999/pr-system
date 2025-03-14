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
  currency?: string; // Made optional since it's not relevant for multipliers and quote requirements
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
