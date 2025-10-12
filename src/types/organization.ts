export interface Organization {
  id: string;
  name: string;
  code?: string;
  active: boolean;
  
  // Email Configuration
  procurementEmail?: string;
  assetManagementEmail?: string;
  adminEmail?: string;
  
  // Business Rules
  baseCurrency: string;
  allowedCurrencies: string[];
  rule1ThresholdAmount?: number;
  rule2ThresholdAmount?: number;
  
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
