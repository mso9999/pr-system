export interface Organization {
  id: string;
  name: string;
  code?: string;
  country?: string; // Operating country for the organization
  active: boolean;
  
  // Company Details for PO Documents
  companyLegalName?: string; // Full legal name for PO
  companyLogo?: string; // URL or path to company logo (PNG/JPG recommended)
  companyLogoWidth?: number; // Logo width in pixels for PO document (default: 200)
  companyLogoHeight?: number; // Logo height in pixels for PO document (default: auto)
  companyAddress?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  companyRegistrationNumber?: string;
  companyTaxId?: string; // VAT/Tax ID
  companyPhone?: string;
  companyWebsite?: string;
  
  // Default Delivery Address (can be same as company address)
  defaultDeliveryAddressSameAsCompany?: boolean; // If true, use companyAddress for delivery
  defaultDeliveryAddress?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  
  // Default Billing Address (can be same as company address)
  defaultBillingAddressSameAsCompany?: boolean; // If true, use companyAddress for billing
  defaultBillingAddress?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  
  // Company Banking Details (for PO documents)
  bankName?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankSwiftCode?: string;
  bankIban?: string;
  bankBranch?: string;
  
  // Company Contact Persons
  buyerRepresentativeName?: string;
  buyerRepresentativePhone?: string;
  buyerRepresentativeEmail?: string;
  buyerRepresentativeTitle?: string;
  
  // Email Configuration
  procurementEmail?: string;
  assetManagementEmail?: string;
  adminEmail?: string;
  
  // Business Rules
  baseCurrency: string;
  allowedCurrencies: string[];
  
  /**
   * @deprecated Use rulesService.getOrganizationRules() instead
   * These fields are kept for backwards compatibility only
   * SINGLE SOURCE OF TRUTH: referenceData_rules collection
   */
  rule1ThresholdAmount?: number;
  /**
   * @deprecated Use rulesService.getOrganizationRules() instead
   */
  rule2ThresholdAmount?: number;
  
  /**
   * @deprecated Use rulesService.getOrganizationRules() for Rule 6 & 7
   * SINGLE SOURCE OF TRUTH: referenceData_rules collection
   */
  // Final Price Variance Thresholds (percentages)
  finalPriceUpwardVarianceThreshold?: number; // default 5 (%)
  finalPriceDownwardVarianceThreshold?: number; // default 20 (%)
  
  // Vendor Approval Duration Settings (in months)
  vendorApproval3QuoteDuration: number; // default 12
  vendorApprovalCompletedDuration: number; // default 6
  vendorApprovalManualDuration: number; // default 12
  
  // High-Value Vendor Rules
  highValueVendorMultiplier: number; // default 10
  highValueVendorMaxDuration: number; // default 24 (months)
  
  // Other Settings
  timeZone?: string;
  businessDaysConfiguration?: any;
  holidayCalendar?: any;
  
  // Timestamps
  createdAt?: string;
  updatedAt?: string;
}
