export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  total: number;
}

export interface InvoiceIssuer {
  name: string;
  address: string;
  taxId?: string;
  registrationNumber?: string;
  banking: {
    bankName?: string;
    bankAddress?: string;
    accountName?: string;
    accountNumber?: string;
    swiftCode?: string;
    iban?: string;
    branch?: string;
    correspondent1?: string;
    correspondent2?: string;
  };
}

export interface InvoiceCustomer {
  name: string;
  address: string;
  contactPerson?: string;
  contactPhone?: string;
  contactEmail?: string;
}

export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'overdue';

export interface Invoice {
  id: string;
  invoiceNumber: string;
  poReference: string;
  contractReference: string;
  issuer: InvoiceIssuer;
  customer: InvoiceCustomer;
  milestone: string;
  lineItems: InvoiceLineItem[];
  totalAmount: number;
  currency: string;
  issueDate: string;
  dueDate: string;
  paymentTerms: string;
  supportingDocuments: string[];
  taxes?: number;
  notes?: string[];
  validityDays?: number;
  upfrontPercentage?: number;
  upfrontAmount?: number;
  oemCreditAmount?: number;
  status: InvoiceStatus;
  createdAt: string;
  updatedAt: string;
}
