export interface ReferenceDataItem {
  id: string;
  code?: string;
  name: string;
  latitude?: number;
  longitude?: number;
  /** Structured postal address — used by sites */
  siteAddress?: SiteAddress;
  /** UGP projects linked to a site (one site may serve multiple projects) */
  ugpProjects?: UgpProjectLink[];
  /** Cross-system ids, e.g. { ugpSiteCode: 'LGS01' } */
  externalIds?: Record<string, string>;
  /** Origin of the record: 'ugp' when ingested from UGP, 'pr_admin' when created in PR */
  siteSource?: 'ugp' | 'pr_admin';
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
  
  // Vendor Documents
  documents?: VendorDocument[];

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
  /** FM Fleet Hub vehicle UUID — canonical id when source is fleet_hub */
  fmVehicleId?: string;
  /** Short fleet code from FM (e.g. R1, X3) */
  fleetCode?: string;
  /** Mirror origin: fleet_hub when synced from fm.1pwrafrica.com */
  source?: string;
  /** When a legacy Firestore doc was replaced by an FM UUID doc */
  supersededBy?: string;
  /** Last time FM pushed this mirror row */
  syncedAt?: string;
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

  /** When set (per organization department doc), request-side PR emails use this instead of the individual requestor. */
  notificationEmail?: string;

  // ── Department catalog provenance (HR is canonical as of 2026-06-30) ──
  /** HR source system for a mirrored department: 'pr' (originally from PR), 'hr' (created in HR), 'hr_renamed' (HR renamed a PR-sourced row). */
  sourceSystem?: 'pr' | 'hr' | 'hr_renamed';
  /** HR's external doc id — for source_system='pr' this equals the PR Firestore doc id; for 'hr'/'hr_renamed' it's an HR-generated slug. */
  sourceDocId?: string;
  /** HR internal primary key (departments.id in HR MySQL). */
  hrId?: number;
  /** Alternate names HR knows this department by (used for fuzzy name resolution). */
  aliases?: string[];
  /** Last time the HR catalog sync touched this doc (ISO 8601). */
  hrCatalogSyncedAt?: string;

  // ── Organization → Country link (PR is canonical for countries + orgs) ──
  /** ISO-2 country code (e.g. 'LS') linking an organization to its parent country in `referenceData_countries`. Set by the org form's country selector. */
  countryCode?: string;

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
  | 'countries'
  | 'permissions'
  | 'vehicles'
  | 'rules'
  | 'paymentTypes'
  // Field-camp provisioning (org-scoped, country/currency/menu/price aware)
  | 'rations'
  | 'provisioningMenus'
  | 'provisioningDefaults'
  | 'rationPrices';

/** Structured postal address for a site (all fields optional — fill what is known). */
export interface SiteAddress {
  street?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
}

/** Link from a site to a UGP project. `ugpProjectId` is required; the rest are convenience labels. */
export interface UgpProjectLink {
  ugpProjectId: string;
  ugpProjectCode?: string;
  ugpProjectName?: string;
}

// Types that don't depend on organization
export const ORG_INDEPENDENT_TYPES = [
  'currencies',
  'uom',
  'organizations',
  'countries',
  'paymentTypes'
] as const;

// Types that use code as ID
export const CODE_BASED_ID_TYPES = [
  'currencies',
  'uom',
  'organizations',
  'countries'
] as const;

/**
 * Vendor Document Interface
 * Represents a document attached to a vendor
 */
export interface VendorDocument {
  id: string;
  name: string;
  url: string;
  size: number;
  type: string;
  category: 'incorporation' | 'tax_certificate' | 'bank_letter' | 'insurance' | 'license' | 'other';
  uploadedBy: string;
  uploadedAt: string;
  notes?: string;
}

/**
 * Vendor Interface
 * Enhanced type for vendor-specific data with dual-authorization approval tracking
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
  
  // Dual-Authorization Approval System
  // Vendor is only approved if BOTH flags are true
  procurementApproved: boolean; // Set by Procurement or Superuser
  financeApproved: boolean; // Set by Finance/Admin or Superuser
  
  // Computed approval status (both must be true)
  isApproved: boolean; // Deprecated: Use procurementApproved && financeApproved
  
  // Approval Details
  procurementApprovalDate?: string;
  procurementApprovedBy?: string;
  procurementApprovalNote?: string;
  
  financeApprovalDate?: string;
  financeApprovedBy?: string;
  financeApprovalNote?: string;
  
  approvalExpiryDate?: string;
  approvalReason?: 'auto_3quote' | 'auto_completed' | 'manual_procurement' | 'manual_finance' | 'manual_both';
  associatedPONumber?: string; // If auto-approved from order
  lastCompletedOrderDate?: string;
  last3QuoteProcessDate?: string;
  
  // Legacy fields (for backward compatibility)
  approvalDate?: string;
  approvedBy?: string;
  approvalNote?: string;
  
  // High-Value Classification
  isHighValue?: boolean;
  cumulativeOrderValue?: number;
  
  // Documents
  documents?: VendorDocument[];
}
