/**
 * @fileoverview Purchase Request Type Definitions
 * @version 2.0.0
 * 
 * Description:
 * Core type definitions for the Purchase Request (PR) system. These types define
 * the shape of data throughout the application, from database schema to UI components.
 * 
 * Data Model Notes:
 * The PR system follows a hierarchical structure:
 * - PRRequest: Root entity containing core PR data
 *   ├── LineItems: Individual items being requested
 *   ├── Quotes: Vendor quotes for the PR
 *   ├── Workflow: Approval and processing steps
 *   └── Metrics: Performance and status metrics
 * 
 * Status Flow:
 * SUBMITTED -> IN_QUEUE -> PENDING_APPROVAL -> [APPROVED | REJECTED]
 * APPROVED -> ORDERED -> COMPLETED
 * Alternate: SUBMITTED/PENDING_APPROVAL -> REVISION_REQUIRED -> RESUBMITTED -> SUBMITTED
 * 
 * Related Modules:
 * - src/services/pr.ts: Main service using these types
 * - src/components/pr/*: UI components consuming these types
 * - Firestore: Database schema mirrors these types
 */

// Define a simplified User interface to avoid circular dependencies
export interface UserReference {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  displayName?: string;
  role?: string;
  organization?: string;
  department?: string;
  isActive?: boolean;
  permissionLevel?: number;
  permissions?: any;
}

/**
 * Vendor Interface
 * Represents a vendor in the system
 */
export interface Vendor {
  id?: string;
  name?: string;
  code?: string;
  email?: string;
  contactPerson?: string;
  phone?: string;
  address?: string;
}

/**
 * Vendor Details Interface
 * Represents detailed vendor information
 */
export interface VendorDetails {
  id?: string;
  name?: string;
  code?: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string;
  paymentTerms?: string;
}

/**
 * Purchase Request Status Enum
 * Defines all possible states a PR can be in
 */
export enum PRStatus {
  /** Initial draft state before submission */
  DRAFT = 'DRAFT',
  /** Initial state when PR is first created */
  SUBMITTED = 'SUBMITTED',
  /** PR has been resubmitted after revision */
  RESUBMITTED = 'RESUBMITTED',
  /** PR is in procurement queue for processing */
  IN_QUEUE = 'IN_QUEUE',
  /** Awaiting approval from designated approvers */
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  /** PR has been approved and is ready for processing */
  APPROVED = 'APPROVED',
  /** Purchase order has been placed */
  ORDERED = 'ORDERED',
  /** PR has been fully processed and closed */
  COMPLETED = 'COMPLETED',
  /** Changes requested by approver */
  REVISION_REQUIRED = 'REVISION_REQUIRED',
  /** PR has been canceled by requestor or admin */
  CANCELED = 'CANCELED',
  /** PR has been rejected by approver */
  REJECTED = 'REJECTED'
}

/**
 * Main Purchase Request Interface
 * Contains all data related to a purchase request
 */
export interface PRRequest {
  /** Unique identifier for the PR */
  id: string;
  /** Human-readable PR number (format: ORG-YYYYMM-XXX) */
  prNumber: string;
  /** Object type: PR before APPROVED, PO from APPROVED onward */
  objectType?: 'PR' | 'PO';
  /** Organization the PR belongs to */
  organization: string;
  /** Department making the request */
  department: string;
  /** Project or category the PR falls under */
  projectCategory: string;
  /** Detailed description of what is being requested */
  description: string;
  /** Site or location where items are needed */
  site: string;
  /** Type of expense (CAPEX/OPEX) */
  expenseType: string;
  /** Vehicle associated with request (if applicable) */
  vehicle?: string;
  /** Estimated total cost */
  estimatedAmount: number;
  /** Amount when last approved (used for approval rescinding on significant changes) */
  lastApprovedAmount?: number;
  /** Currency for the request */
  currency: string;
  /** Date by which items are needed */
  requiredDate: string;
  /** Preferred vendor if any */
  preferredVendor?: string;
  /** Final selected vendor (set during APPROVED status) */
  selectedVendor?: string;
  /** ID of user making request */
  requestorId: string;
  /** Email of requestor */
  requestorEmail: string;
  /** Full user object of requestor */ 
  requestor: UserReference;
  /** Current approver for this PR - single source of truth */
  approver?: string;
  /** Second approver for dual-approval PRs above Rule 2 */
  approver2?: string;
  /** Whether this PR requires dual approval */
  requiresDualApproval?: boolean;
  /**
   * @deprecated Use approver field instead. 
   * Will be removed in a future version. 
   */
  approvers?: string[];
  
  // Document Management Fields (APPROVED and ORDERED Status)
  /** Uploaded proforma invoice files (supports multiple) */
  proformaInvoice?: Attachment | Attachment[]; // Backward compatible: single or array
  /** Flag indicating proforma override is used */
  proformaOverride?: boolean;
  /** Justification note if proforma override is set */
  proformaOverrideJustification?: string;
  /** Uploaded proof of payment files (supports multiple) */
  proofOfPayment?: Attachment | Attachment[]; // Backward compatible: single or array
  /** Flag indicating PoP override is used */
  popOverride?: boolean;
  /** Justification note if PoP override is set */
  popOverrideJustification?: string;
  
  // Final Price Fields (APPROVED Status)
  /** Final price from proforma invoice (entered by procurement) */
  finalPrice?: number;
  /** Currency for final price */
  finalPriceCurrency?: string;
  /** User who entered the final price */
  finalPriceEnteredBy?: UserReference;
  /** Timestamp when final price was entered */
  finalPriceEnteredAt?: string;
  /** Whether final price requires approval due to variance */
  finalPriceRequiresApproval?: boolean;
  /** Variance percentage from approved amount */
  finalPriceVariancePercentage?: number;
  /** Whether final price has been approved by approver(s) */
  finalPriceApproved?: boolean;
  /** User who approved the final price */
  finalPriceApprovedBy?: UserReference;
  /** Timestamp when final price was approved */
  finalPriceApprovedAt?: string;
  /** Notes/justification for final price variance (from procurement) */
  finalPriceVarianceNotes?: string;
  /** Flag indicating final price variance override is used */
  finalPriceVarianceOverride?: boolean;
  /** Justification note if final price variance override is set */
  finalPriceVarianceOverrideJustification?: string;
  
  /** Uploaded delivery note files (ORDERED status, supports multiple) */
  deliveryNote?: Attachment | Attachment[]; // Backward compatible: single or array
  /** Array of uploaded delivery photo files (ORDERED status) */
  deliveryPhotos?: Attachment[];
  /** Flag indicating delivery doc override is used */
  deliveryDocOverride?: boolean;
  /** Justification note if delivery override is set */
  deliveryDocOverrideJustification?: string;
  /** System-generated PO document (created at APPROVED status) */
  poDocument?: Attachment;
  /** Flag indicating PO document override is used (for high-value PRs above Rule 3) */
  poDocumentOverride?: boolean;
  /** Justification note if PO document override is set */
  poDocumentOverrideJustification?: string;
  /** Expected delivery date (ETD) - required before ORDERED */
  estimatedDeliveryDate?: string;
  
  // PO Document Fields (APPROVED Status - for PO generation)
  /** PO issue date (date when PO was created/issued) */
  poIssueDate?: string;
  
  /** Delivery/Ship-to Address (if different from company address) */
  deliveryAddressDifferent?: boolean;
  deliveryAddress?: {
    recipientName?: string;
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    contactPerson?: string;
    contactPhone?: string;
  };
  
  /** Billing Address (if different from company address) */
  billingAddressDifferent?: boolean;
  billingAddress?: {
    recipientName?: string;
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  
  /** Supplier/Vendor Contact Person for this PO */
  supplierRepresentativeName?: string;
  supplierRepresentativePhone?: string;
  supplierRepresentativeEmail?: string;
  supplierRepresentativeTitle?: string;
  
  /** Buyer/Company Contact Person for this PO */
  buyerRepresentativeName?: string;
  buyerRepresentativePhone?: string;
  buyerRepresentativeEmail?: string;
  buyerRepresentativeTitle?: string;
  
  /** Mode of delivery/shipment */
  modeOfDelivery?: 'Air' | 'Sea' | 'Courier' | 'Pickup' | 'Road' | 'Rail' | 'Other';
  modeOfDeliveryOther?: string; // If "Other" is selected
  
  /** Packing or labeling instructions */
  packingInstructions?: string;
  
  /** Payment Information */
  paymentMethod?: 'Bank Transfer' | 'Check' | 'Credit Card' | 'Cash' | 'Letter of Credit' | 'Other';
  paymentMethodOther?: string; // If "Other" is selected
  paymentTerms?: string; // e.g., "Net 30 days", "50% advance, 50% on delivery"
  
  /** Banking Details (for supplier payment) */
  supplierBankName?: string;
  supplierBankAccountName?: string;
  supplierBankAccountNumber?: string;
  supplierBankSwiftCode?: string;
  supplierBankIban?: string;
  supplierBankBranch?: string;
  
  /** Tax and Duty Information */
  applicableTaxes?: string; // VAT, import duties, withholding tax, etc.
  taxPercentage?: number;
  dutyPercentage?: number;
  
  /** Reference to prior documents */
  referenceQuotationNumber?: string;
  referenceContractNumber?: string;
  referenceTenderNumber?: string;
  
  /** Internal Codes (for company use, not visible prominence to supplier) */
  internalProjectCode?: string; // Project code
  internalExpenseCode?: string; // Expense type code
  internalCostCenter?: string;
  
  /** Special Instructions and Remarks */
  poRemarks?: string;
  specialInstructions?: string;
  
  /** Line Item Details for PO (with SKU/Item Numbers) */
  lineItemsWithSKU?: Array<{
    lineNumber: number;
    itemNumber?: string; // SKU or internal item number
    description: string;
    quantity: number;
    uom: string;
    unitPrice: number;
    totalAmount: number;
    currency: string;
    notes?: string;
  }>;
  
  // Supplier Data Fields (for non-approved vendors)
  /** Manually entered supplier name (if not using approved vendor) */
  supplierName?: string;
  /** Contact information for non-approved vendors */
  supplierContact?: {
    phone?: string;
    email?: string;
    website?: string;
  };
  /** User ID who entered the supplier data */
  supplierDataEnteredBy?: string;
  /** When supplier data was entered */
  supplierDataTimestamp?: string;
  
  /** Vendor information */
  vendor?: Vendor;
  /** Detailed vendor information */
  vendorDetails?: VendorDetails;
  /** Whether this PR is urgent */
  isUrgent?: boolean;
  /** Approval workflow information */
  approvalWorkflow?: ApprovalWorkflow;
  /** Status history of the PR */
  statusHistory?: StatusHistoryItem[];
  /** Workflow history of the PR */
  workflowHistory?: WorkflowHistoryItem[];
  /** General history events */
  history?: HistoryItem[];
  /** Individual items being requested */
  lineItems: LineItem[];
  /** Vendor quotes received */
  quotes: Quote[];
  /** ID of the preferred quote selected by procurement (for multi-quote situations) */
  preferredQuoteId?: string;
  /** Current status of the PR */
  status: PRStatus;
  /** Creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
  /** User who submitted the PR */
  submittedBy?: string;
  /** Calculated metrics */
  metrics?: PRMetrics;
  /** Category of the purchase request */
  category?: string;
  /** Vendor name */
  vendorName?: string;
  /** Supporting documents */
  attachments?: Attachment[];
  /** Workflow information */
  workflow?: PRWorkflow;
  /** Procurement team review */
  procurementReview?: ApprovalInfo;
  /** Finance team approval */
  financeApproval?: ApprovalInfo;
  /** Technical review information */
  adjudication?: AdjudicationInfo;
  /** Expected delivery date */
  expectedLandingDate?: string;
  /** Actual total amount */
  totalAmount: number;
  /** General comments */
  comments?: string;
  /** Procurement team comments */
  procComments?: string;
  /** Timestamp of last resubmission */
  resubmittedAt?: string;
  /** When PR was confirmed */
  confirmedAt?: string;
  /** When PO was placed */
  orderedAt?: string;
  /** Purchase Order number */
  purchaseOrderNumber?: string;
  /** When PR was completed */
  completedAt?: string;
  /** When revision was requested */
  revisionAt?: string;
  /** When PR was rejected */
  rejectedAt?: string;
  /** When PR was canceled */
  canceledAt?: string;
  /** Additional notes */
  notes?: string;
}

/**
 * Attachment Interface
 * Represents a file attached to a PR or line item
 */
export interface Attachment {
  /** Unique identifier for the attachment */
  id: string;
  /** Name of the attachment */
  name: string;
  /** URL of the attachment */
  url: string;
  /** Path of the attachment */
  path?: string;
  /** Type of the attachment */
  type: string;
  /** Size of the attachment */
  size: number;
  /** Timestamp when the attachment was uploaded */
  uploadedAt: string; 
  /** User who uploaded the attachment */
  uploadedBy: UserReference;
}

/**
 * Approval Workflow Interface
 * Represents the approval workflow information for a PR
 */
export interface ApprovalWorkflow {
  /** Current approver for the PR */
  currentApprover: string | null;
  /** Second approver for dual-approval PRs */
  secondApprover?: string | null;
  /** Whether this PR requires dual approval (above Rule 2) */
  requiresDualApproval: boolean;
  /** Whether the first approver has approved */
  firstApprovalComplete: boolean;
  /** Quote ID selected by first approver */
  firstApproverSelectedQuoteId?: string;
  /** Justification from first approver (if 3-quote scenario) */
  firstApproverJustification?: string;
  /** Whether the second approver has approved */
  secondApprovalComplete: boolean;
  /** Quote ID selected by second approver */
  secondApproverSelectedQuoteId?: string;
  /** Justification from second approver (if 3-quote scenario) */
  secondApproverJustification?: string;
  /** Whether there is a quote selection conflict (both approvers selected different quotes) */
  quoteConflict?: boolean;
  /** History of approval steps */
  approvalHistory: ApprovalHistoryItem[];
  /** Timestamp of last update */
  lastUpdated: string;
}

/**
 * Approval History Item Interface
 * Represents a single step in the approval history
 */
export interface ApprovalHistoryItem {
  /** ID of the approver */
  approverId: string;
  /** Timestamp of the approval step */
  timestamp: string;
  /** Whether the approval was successful */
  approved: boolean;
  /** Notes about the approval step */
  notes?: string;
}

/**
 * Individual Line Item Interface
 * Represents a single item being requested
 */
export interface LineItem {
  /** Unique identifier for the line item */
  id: string;
  /** Description of the item */
  description: string;
  /** Quantity of the item being requested */
  quantity: number;
  /** Unit of measurement for the item */
  uom: string;
  /** Additional notes about the item */
  notes?: string;
  /** Supporting documents for the item */
  attachments: Attachment[];
}

/**
 * Vendor Quote Interface
 * Represents a quote received from a vendor
 */
export interface Quote {
  /** Unique identifier for the quote */
  id?: string;
  /** Vendor ID providing the quote */
  vendorId: string;
  /** Name of the vendor */
  vendorName: string;
  /** Date the quote was received */
  quoteDate: string;
  /** Total amount of the quote */
  amount: number;
  /** Currency of the quote */
  currency: string;
  /** Notes about the quote */
  notes: string;
  /** Attachments for the quote */
  attachments: Attachment[];
  /** User who submitted the quote */
  submittedBy?: string;
  /** Timestamp when the quote was submitted */
  submittedAt?: string;
}

/**
 * Approval Info Interface
 * Represents approval information for a PR
 */
export interface ApprovalInfo {
  /** User who approved the PR */
  approver: UserReference;
  /** Timestamp when the PR was approved */
  approvedAt?: string;
  /** Notes about the approval */
  notes?: string;
  /** Status of the approval */
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

/**
 * PR Workflow Interface
 * Represents the workflow information for a PR
 */
export interface PRWorkflow {
  /** Current step in the workflow */
  currentStep: WorkflowStep;
  /** Adjudication information (if applicable) */
  adjudication?: AdjudicationInfo;
  /** Finance approval information (if applicable) */
  financeApproval?: ApprovalInfo;
  /** Procurement review information (if applicable) */
  procurementReview?: ApprovalInfo;
  /** History of workflow steps */
  history: WorkflowHistory[];
}

/**
 * Adjudication Info Interface
 * Represents adjudication information for a PR
 */
export interface AdjudicationInfo {
  /** Notes about the adjudication */
  notes: string;
  /** User who added the adjudication information */
  addedBy: UserReference;
  /** Timestamp when the adjudication information was added */
  addedAt: string;
  /** Supporting documents for the adjudication */
  attachments?: Attachment[];
}

/**
 * Workflow History Interface
 * Represents a single step in the workflow history
 */
export interface WorkflowHistory {
  /** Step in the workflow */
  step: WorkflowStep;
  /** From status */
  fromStatus?: string;
  /** To status */
  toStatus?: string;
  /** Timestamp when the step was taken */
  timestamp: any; // Firestore Timestamp
  /** User who took the step */
  user: UserReference;
  /** Notes about the step */
  notes?: string;
}

/**
 * Workflow Step Enum
 * Defines all possible steps in the workflow
 */
export enum WorkflowStep {
  /** Initial state when PR is first created */
  SUBMITTED = 'SUBMITTED',
  /** PR is in procurement queue for processing */
  IN_QUEUE = 'IN_QUEUE',
  /** Adjudication is required for the PR */
  ADJUDICATION_REQUIRED = 'ADJUDICATION_REQUIRED',
  /** Adjudication is complete for the PR */
  ADJUDICATION_COMPLETE = 'ADJUDICATION_COMPLETE',
  /** Finance review is required for the PR */
  FINANCE_REVIEW = 'FINANCE_REVIEW',
  /** Procurement review is required for the PR */
  PROCUREMENT_REVIEW = 'PROCUREMENT_REVIEW',
  /** PR is ready for PO creation */
  READY_FOR_PO = 'READY_FOR_PO',
  /** PO has been created for the PR */
  PO_CREATED = 'PO_CREATED',
  /** PR has been fully processed and closed */
  COMPLETED = 'COMPLETED',
  /** PR has been rejected by approver */
  REJECTED = 'REJECTED'
}

/**
 * PR Metrics Interface
 * Represents calculated metrics for a PR
 */
export interface PRMetrics {
  /** Number of days the PR has been open */
  daysOpen: number;
  /** Whether the PR is marked as urgent */
  isUrgent: boolean;
  /** Whether the PR is overdue */
  isOverdue: boolean;
  /** Whether quotes are required for the PR */
  quotesRequired: boolean;
  /** Whether adjudication is required for the PR */
  adjudicationRequired: boolean;
  /** Whether finance approval is required for the PR */
  financeApprovalRequired: boolean;
  /** Whether customs clearance is required for the PR */
  customsClearanceRequired: boolean;
  /** Percentage of completion for the PR workflow */
  completionPercentage: number;
  /** Number of days in the current status */
  daysInCurrentStatus?: number;
  /** Expected delivery date */
  expectedDeliveryDate?: string | null;
  /** Expected landing date */
  expectedLandingDate?: string | null;
  /** Position in the queue */
  queuePosition?: number | null;
  /** Number of days since the PR was ordered */
  daysOrdered?: number;
  /** Number of days the PR is overdue */
  daysOverdue?: number;
  /** Time to close the PR */
  timeToClose?: number;
}

/**
 * PR Update Parameters Interface
 * Represents parameters for updating a PR
 */
export interface PRUpdateParams extends Partial<PRRequest> {
  /** Notes about the update */
  notes?: string;
}

/**
 * Status History Item Interface
 * Represents a single status change in the PR history
 */
export interface StatusHistoryItem {
  /** Status that the PR was changed to */
  status: PRStatus;
  /** Timestamp when the status was changed */
  timestamp: string;
  /** User who changed the status */
  user: UserReference;
  /** Notes about the status change */
  notes?: string;
}

/**
 * Workflow History Item Interface
 * Represents a single workflow step in the PR history
 */
export interface WorkflowHistoryItem {
  /** Step in the workflow */
  step: string;
  /** Status of the step */
  status: string;
  /** Timestamp of the step */
  timestamp: string;
  /** User who performed the step */
  user: UserReference;
  /** Notes about the step */
  notes?: string;
}

/**
 * History Item Interface
 * Represents a general history event in the PR lifecycle
 */
export interface HistoryItem {
  /** Action performed */
  action: string;
  /** Timestamp of the action */
  timestamp: string;
  /** User who performed the action */
  user: UserReference;
  /** Comment about the action */
  comment?: string;
}

/**
 * PR Amount Thresholds
 * 
 * IMPORTANT: These values are DEFAULT FALLBACKS ONLY.
 * Actual thresholds MUST be retrieved from the Rules collection in Firestore
 * which contains administrator-configurable values.
 * 
 * DO NOT rely on these constants directly in business logic.
 * Always fetch from Rules collection via prService.getRuleForOrganization()
 */
export const PR_AMOUNT_THRESHOLDS = {
  /** Admin approval threshold - DEFAULT VALUE ONLY */
  ADMIN_APPROVAL: 1000,     
  /** Quotes required threshold - DEFAULT VALUE ONLY */
  QUOTES_REQUIRED: 5000,     
  /** Finance approval threshold - DEFAULT VALUE ONLY */
  FINANCE_APPROVAL: 50000,   
  /** Adjudication required threshold - DEFAULT VALUE ONLY */
  ADJUDICATION_REQUIRED: 100000
};
