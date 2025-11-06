# PO Document Generation Feature

**Date:** November 2, 2025  
**Feature:** Downloadable PDF Purchase Order Document Generation  
**Status:** ✅ IMPLEMENTED (November 4, 2025)

## Overview

When a PR reaches APPROVED status, it becomes a PO (Purchase Order). Procurement can generate a comprehensive, professional PDF PO document that can be downloaded and sent to suppliers.

**Requirement Level:**
- **REQUIRED** for high-value PRs (above Rule 3 threshold) - can be overridden with written justification
- **OPTIONAL** for PRs below Rule 3 threshold

The PO document generation does not affect workflow progression - only proforma invoice and proof of payment uploads (or overrides) advance to ORDERED status.

## Key Principles

### 1. PR → PO Terminology Change
- **Before APPROVED:** Called "PR" (Purchase Request)
- **From APPROVED onward:** Called "PO" (Purchase Order)
- **PO Number = PR Number** (no renumbering)
- Format remains: ORG-YYYYMM-XXX

### 2. Requirement by Value
- **High-Value PRs (above Rule 3):** PO document **REQUIRED** - must generate OR override with justification
- **Lower-Value PRs (below Rule 3):** PO document **OPTIONAL** - not all suppliers require formal PO documents
- Generating/downloading PO does NOT advance status
- Only proforma invoice and proof of payment uploads (or overrides) advance to ORDERED
- Override mechanism: Checkbox + justification text field (similar to Proforma/PoP)

### 3. Editable and Regenerable
- Procurement can edit PO details before generation
- PO can be regenerated multiple times if corrections needed
- Each regeneration overwrites previous version
- Download history maintained for audit trail

## Business Requirements

### Workflow

```
APPROVED Status (PO)
    ↓
[Optional: Prepare PO Document]
    ↓
[Fill in PO-specific fields]
    ↓
[Click "Generate PO PDF"]
    ↓
[System creates PDF]
    ↓
[Download PDF]
    ↓
[Send to Supplier (external)]
    ↓
[Continue with Proforma/PoP uploads]
    ↓
ORDERED Status
```

### PO Document Sections

#### 1. Header Information
- **PO Number:** Automatically populated from PR number
- **Issue Date:** Set by procurement (date PO is issued)
- **Currency:** From PR currency field
- **Company Logo:** Optional (from organization settings)

#### 2. Buyer/Company Information
All populated from **Organization settings**:
- Company Legal Name
- Complete Address (street, city, state, postal code, country)
- Registration Number
- Tax ID / VAT Number
- Phone Number
- Website
- Buyer Representative:
  - Name (default from org, can override per PO)
  - Title
  - Phone
  - Email

#### 3. Supplier/Vendor Information
From **selected vendor** OR **manually entered**:
- Supplier Name
- Complete Address
- Supplier Contact Person:
  - Name
  - Title
  - Phone
  - Email

**First-Time Supplier Handling:**
- If supplier not in database, procurement enters all details
- After PO finalized, system prompts: "Add supplier to vendor database?"
- If YES: Creates new vendor record with PO details
- If NO: Details remain with this PO only

#### 4. Delivery Address (Ship-To)
- **Checkbox:** "Same as Company Address" (default)
- If different:
  - Recipient Name
  - Complete Address
  - Contact Person
  - Contact Phone

#### 5. Billing Address
- **Checkbox:** "Same as Company Address" (default)
- If different:
  - Recipient Name
  - Complete Address

#### 6. Order Details

**Line Items Table:**

| Line # | Item#/SKU | Description | Qty | UOM | Unit Price | Total | Notes |
|--------|-----------|-------------|-----|-----|------------|-------|-------|
| 1 | Optional | From PR | From PR | From PR | From Quote | Auto-calc | Optional |

**Totals:**
- Subtotal
- Tax Amount (if applicable)
- Duty Amount (if applicable)
- **Grand Total**

**Delivery Information:**
- Expected Delivery Date (ETD) - Required
- Mode of Delivery: Dropdown
  - Air
  - Sea
  - Courier
  - Pickup
  - Road
  - Rail
  - Other (with text field)

#### 7. Packing/Labeling Instructions
Optional free text:
- "Palletized"
- "Items must be branded"
- "Barcoded"
- "Individually wrapped"
- Custom instructions

#### 8. Payment Information

**Payment Method:** Dropdown
- Bank Transfer (default)
- Check
- Credit Card
- Cash
- Letter of Credit
- Other (with text field)

**Payment Terms:** Free text
- "Net 30 days"
- "50% advance, 50% on delivery"
- "Due on receipt"
- "Net 60 days"
- Custom terms

**Supplier Banking Details:**
- Bank Name
- Account Name (Beneficiary Name)
- Account Number
- SWIFT Code
- IBAN
- Bank Branch

**Tax and Duty Information:**
- Applicable Taxes/Duties (free text)
- Tax Percentage (optional)
- Duty Percentage (optional)

#### 9. Reference Information

**Prior Documents** (optional):
- Quotation Number/Reference
- Contract Number/Reference
- Tender Number/Reference
- RFQ Number

**Internal Codes** (for company use):
- Project Code (from PR)
- Expense Type Code (from PR)
- Cost Center Code (optional)
*Note: Displayed on PO but not prominently - for internal tracking*

#### 10. Special Instructions and Remarks

**Special Instructions:** (optional)
- Handling requirements
- Delivery requirements
- Quality requirements

**General Remarks:** (optional)
- Any additional information

#### 11. Footer
- Standard terms and conditions
- Authorized signature line (optional)
- Company stamp/seal area

## Implementation Details

### Type Definitions Added ✅

#### Organization Type Enhancements

**File:** `src/types/organization.ts`

Added 20+ fields for company details:
```typescript
// Company Details for PO Documents
companyLegalName?: string;
companyAddress?: {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
};
companyRegistrationNumber?: string;
companyTaxId?: string;
companyPhone?: string;
companyWebsite?: string;

// Company Banking Details
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
```

#### PR Type Enhancements

**File:** `src/types/pr.ts`

Added 50+ fields for PO document data:
```typescript
// PO Document Fields (APPROVED Status)
poIssueDate?: string;

// Delivery Address
deliveryAddressDifferent?: boolean;
deliveryAddress?: {...};

// Billing Address
billingAddressDifferent?: boolean;
billingAddress?: {...};

// Contact Persons
supplierRepresentativeName?: string;
supplierRepresentativePhone?: string;
supplierRepresentativeEmail?: string;
supplierRepresentativeTitle?: string;

buyerRepresentativeName?: string;
buyerRepresentativePhone?: string;
buyerRepresentativeEmail?: string;
buyerRepresentativeTitle?: string;

// Delivery & Payment
modeOfDelivery?: 'Air' | 'Sea' | 'Courier' | 'Pickup' | 'Road' | 'Rail' | 'Other';
modeOfDeliveryOther?: string;
packingInstructions?: string;

paymentMethod?: 'Bank Transfer' | 'Check' | 'Credit Card' | 'Cash' | 'Letter of Credit' | 'Other';
paymentMethodOther?: string;
paymentTerms?: string;

// Supplier Banking
supplierBankName?: string;
supplierBankAccountName?: string;
supplierBankAccountNumber?: string;
supplierBankSwiftCode?: string;
supplierBankIban?: string;
supplierBankBranch?: string;

// Tax & Duty
applicableTaxes?: string;
taxPercentage?: number;
dutyPercentage?: number;

// References
referenceQuotationNumber?: string;
referenceContractNumber?: string;
referenceTenderNumber?: string;

// Internal Codes
internalProjectCode?: string;
internalExpenseCode?: string;
internalCostCenter?: string;

// Instructions
poRemarks?: string;
specialInstructions?: string;

// Line Items with SKU
lineItemsWithSKU?: Array<{
  lineNumber: number;
  itemNumber?: string;
  description: string;
  quantity: number;
  uom: string;
  unitPrice: number;
  totalAmount: number;
  currency: string;
  notes?: string;
}>;
```

### Specifications Updated ✅

**File:** `Specifications.md`

- Lines 1159-1164: Updated PR to PO terminology
- Lines 1261-1443: Comprehensive PO document generation section
- Lines 267-295: Updated Organization data model with company details

## User Interface Requirements

### Admin Portal - Organization Settings

**New Section:** "Company Information for PO Documents"

```
Company Details
  Legal Name: [_____________________]
  Address:
    Street: [_____________________]
    City: [_______________]
    State/Province: [_______________]
    Postal Code: [__________]
    Country: [_______________]
  
  Registration Number: [_____________________]
  Tax ID / VAT: [_____________________]
  Phone: [_____________________]
  Website: [_____________________]

Default Buyer Representative
  Name: [_____________________]
  Title: [_____________________]
  Phone: [_____________________]
  Email: [_____________________]

Company Banking Details (for display on PO)
  Bank Name: [_____________________]
  Account Name: [_____________________]
  Account Number: [_____________________]
  SWIFT Code: [_____________________]
  IBAN: [_____________________]
  Branch: [_____________________]

[Save Company Information]
```

### PO View - APPROVED Status

**New Section:** "PO Document" (collapsible panel)

**When Collapsed:**
```
┌─ PO Document ────────────────────────────────┐
│ [Generate PO Document] [Download Last Generated] │
│ Last generated: 2025-11-02 14:30 by John Doe    │
└──────────────────────────────────────────────┘
```

**When Expanded:**
Shows form with all PO fields organized in tabs:
- **Header** (PO#, Issue Date)
- **Parties** (Buyer info, Supplier info)
- **Addresses** (Delivery, Billing)
- **Order Details** (Line items, totals, delivery info)
- **Payment** (Method, terms, banking)
- **Additional** (References, instructions, remarks)

**Actions:**
- [Save Draft] - Saves fields without generating PDF
- [Generate & Download PDF] - Creates PDF and downloads
- [Preview] - Shows PDF preview in modal

### Supplier Onboarding Prompt

When PO has manually entered supplier (not in database):

```
┌─ Add Supplier to Database? ──────────────────┐
│                                              │
│ This PO includes supplier details for:       │
│ [Supplier Name]                             │
│                                              │
│ Would you like to add this supplier to      │
│ the vendor database for future use?         │
│                                              │
│ [Yes, Add to Database] [No, Not Now]       │
│                                              │
└──────────────────────────────────────────────┘
```

## PDF Template Design

### Layout Structure

```
┌────────────────────────────────────────────────┐
│ [Company Logo]        PURCHASE ORDER           │
│                                                │
│ PO Number: ORG-202511-001                     │
│ Issue Date: November 2, 2025                  │
│ Currency: LSL                                  │
├────────────────────────────────────────────────┤
│                                                │
│ FROM (Buyer):              TO (Supplier):      │
│ [Company Details]          [Supplier Details]  │
│                                                │
├────────────────────────────────────────────────┤
│ Ship To:                   Bill To:            │
│ [Delivery Address]         [Billing Address]   │
├────────────────────────────────────────────────┤
│                                                │
│ ORDER DETAILS                                  │
│ ┌──────────────────────────────────────────┐  │
│ │ Line│SKU│Description│Qty│UOM│Price│Total│  │
│ ├─────┼───┼──────────┼───┼───┼────┼─────┤  │
│ │ 1   │...│...       │...│...│... │ ... │  │
│ │ 2   │...│...       │...│...│... │ ... │  │
│ └─────┴───┴──────────┴───┴───┴────┴─────┘  │
│                                                │
│                           Subtotal:  XXX.XX    │
│                           Tax (15%): XXX.XX    │
│                           Total:     XXX.XX    │
│                                                │
│ Delivery Date: [ETD]                          │
│ Delivery Mode: [Mode]                         │
│                                                │
├────────────────────────────────────────────────┤
│ PAYMENT INFORMATION                            │
│ Method: [Payment Method]                       │
│ Terms: [Payment Terms]                         │
│ Banking Details: [Supplier Bank Info]         │
│                                                │
├────────────────────────────────────────────────┤
│ SPECIAL INSTRUCTIONS                           │
│ [Packing Instructions]                         │
│ [Special Instructions]                         │
│                                                │
├────────────────────────────────────────────────┤
│ REFERENCES                                     │
│ Quote: [Ref#]  Contract: [Ref#]               │
│ Internal: Project [Code] | Expense [Code]     │
│                                                │
├────────────────────────────────────────────────┤
│ REMARKS                                        │
│ [General Remarks]                              │
│                                                │
├────────────────────────────────────────────────┤
│ Terms & Conditions                             │
│ [Standard T&C from Organization]              │
│                                                │
│ Authorized By: _______________                │
│                [Buyer Rep Name]                │
│                [Buyer Rep Title]               │
│                                                │
│ [Company Stamp]                                │
└────────────────────────────────────────────────┘
```

## Implementation Checklist

### ✅ Completed

- [x] Specifications documented
- [x] Organization type enhanced (company details, banking)
- [x] PR type enhanced (50+ PO document fields)
- [x] No linter errors
- [x] Terminology clarified (PR vs PO)
- [x] Optional feature clearly specified
- [x] Supplier onboarding workflow defined

### ✅ Implemented (November 4, 2025)

- [x] PO document preparation UI in ApprovedStatusActions
- [x] **PO document override UI (checkbox + justification) for high-value PRs**
- [x] **Validation logic to check Rule 3 threshold and enforce PO document or override**
- [x] PDF template creation using @react-pdf/renderer
- [x] PDF generation service function
- [x] Download PO functionality
- [x] PO regeneration logic
- [x] Audit trail (poIssueDate field tracking)
- [x] Integration with APPROVED status workflow
- [x] Validation in "Move to ORDERED" checks

### ⏳ Pending (Future Enhancements)

- [ ] Admin UI for organization company details (fallback to defaults currently)
- [ ] Supplier onboarding prompt and workflow (when manually entered supplier data)
- [ ] Advanced PO customization dialog (edit all PO-specific fields before generation)
- [ ] Upload generated PO to Firebase Storage (currently client-side download only)
- [ ] User acceptance testing

## Technical Implementation Notes

### PDF Generation Options

**Option 1: HTML to PDF (Recommended)**
- Use library like `html-pdf` or `puppeteer`
- Create HTML template with CSS styling
- Convert to PDF server-side
- Pros: Easy to style, good control, can preview in browser
- Cons: Requires server-side rendering

**Option 2: PDF Library**
- Use library like `pdfkit` or `jspdf`
- Programmatically create PDF
- Pros: No HTML/CSS needed, lightweight
- Cons: More code, harder to design complex layouts

**Option 3: Cloud Service**
- Use service like DocuSign, PDFMonkey, or similar
- Send data via API, receive PDF
- Pros: Professional templates, reliable
- Cons: External dependency, cost

**Recommendation:** Option 1 (HTML to PDF) for flexibility and control

### Storage

- Generated PDFs stored in Firebase Storage
- Path: `/pos/{organizationId}/{poId}/po_document.pdf`
- Versioning: Overwrite on regeneration, keep history in metadata
- Metadata includes: generation date, user, version number

### Performance

- PDF generation should be asynchronous (don't block UI)
- Show loading indicator during generation
- Cache generated PDF until fields change
- Regenerate only when "Generate" clicked or fields modified

## Testing Scenarios

### Test 1: Generate PO with All Fields
1. PR reaches APPROVED status
2. Open PO document section
3. Fill in all optional fields
4. Generate PDF
5. **Expected:** Comprehensive PDF with all sections populated

### Test 2: Generate PO with Minimal Fields
1. PR reaches APPROVED status
2. Leave most optional fields empty
3. Generate PDF
4. **Expected:** PDF with only required fields, clean layout

### Test 3: Company Address as Delivery/Billing
1. Keep "Same as Company Address" checked
2. Generate PDF
3. **Expected:** Company address used for both delivery and billing

### Test 4: Custom Delivery and Billing Addresses
1. Uncheck "Same as Company Address" for both
2. Enter custom addresses
3. Generate PDF
4. **Expected:** Custom addresses appear on PO

### Test 5: First-Time Supplier
1. Enter supplier details manually (not in database)
2. Generate PDF
3. **Expected:** Prompt to add supplier to database appears
4. Click "Yes, Add to Database"
5. **Expected:** New vendor record created

### Test 6: Regenerate PO
1. Generate PO
2. Download PDF
3. Edit some fields
4. Generate again
5. **Expected:** New PDF overwrites old, reflects changes

### Test 7: Low-Value PO Without Generation (Below Rule 3)
1. PR reaches APPROVED status (below Rule 3 threshold)
2. Do NOT generate PO
3. Upload proforma and PoP
4. Move to ORDERED
5. **Expected:** Can progress without PO document

### Test 8: High-Value PO Requires Document (Above Rule 3)
1. PR reaches APPROVED status (above Rule 3 threshold)
2. Do NOT generate PO
3. Upload proforma and PoP
4. Attempt to move to ORDERED
5. **Expected:** Validation error - "PO document required OR override with justification"

### Test 9: High-Value PO with Override
1. PR reaches APPROVED status (above Rule 3 threshold)
2. Do NOT generate PO
3. Check "Override PO Document Requirement"
4. Enter justification (e.g., "Supplier does not require formal PO")
5. Upload proforma and PoP
6. Move to ORDERED
7. **Expected:** Successfully moves to ORDERED with override recorded

### Test 10: Internal Codes Display
1. Fill in project and expense codes
2. Generate PDF
3. **Expected:** Codes appear but not prominently (small text, footer area)

## Future Enhancements

### Phase 1 (Current)
- Basic PO generation with all required fields
- Manual field entry
- Single PDF template

### Phase 2 (Future)
- Multiple PO templates (by organization or PO type)
- Auto-populate supplier banking from vendor database
- Digital signature integration
- Send PO via email directly from system

### Phase 3 (Future)
- PO comparison (show changes between versions)
- Bulk PO generation (multiple POs at once)
- Custom branding per organization
- Multi-language PO templates

## Conclusion

The PO Document Generation feature provides comprehensive, professional Purchase Order documents for supplier communication. With 50+ configurable fields and flexible layouts, it supports various business scenarios.

**Key Requirements:**
- **REQUIRED for high-value PRs** (above Rule 3 threshold) - can be overridden with justification
- **OPTIONAL for lower-value PRs** (below Rule 3 threshold)
- Does not affect workflow progression to ORDERED
- Override mechanism available for high-value PRs requiring flexibility

**Status:** ✅ IMPLEMENTED (November 4, 2025)  

## Implementation Summary

### Core Files Created/Modified:
1. **`src/components/pr/PODocument.tsx`** (NEW)
   - React-PDF document template
   - Professional PO layout with all sections
   - Dynamic content from PR data
   - Styled with react-pdf StyleSheet

2. **`src/components/pr/ApprovedStatusActions.tsx`** (MODIFIED)
   - Added PO Document section in APPROVED status UI
   - Generate & Download PO button
   - PO document override functionality with justification
   - Validation for high-value PRs (Rule 3 threshold)
   - Integration with "Move to ORDERED" workflow

3. **`src/services/pr.ts`** (MODIFIED)
   - Added `poIssueDate` field to getPR function
   - Ensures PO generation data is fetched from database

### Key Features Implemented:
✅ **PDF Generation**: Uses @react-pdf/renderer for client-side PDF generation  
✅ **Smart Validation**: Enforces PO document for high-value PRs (>Rule 3 threshold)  
✅ **Override Mechanism**: Allows bypass with mandatory justification for high-value PRs  
✅ **Visual Indicators**: Chips showing "Required" vs "Optional" based on PO value  
✅ **Regeneration**: Can download PO multiple times if needed  
✅ **Audit Trail**: Tracks PO issue date and generation status  
✅ **Workflow Integration**: Validated before moving to ORDERED status  

### How It Works:
1. When PR reaches APPROVED status, procurement sees PO Document section
2. For **high-value PRs** (>Rule 3): Section shows "Required" chip
3. For **lower-value PRs**: Section shows "Optional" chip
4. User can:
   - Click "Generate & Download PO" to create and download PDF
   - OR (for high-value only) set override with justification
5. PO can be regenerated anytime by clicking download again
6. When moving to ORDERED, system validates:
   - High-value PRs: Must have `poIssueDate` set OR `poDocumentOverride` active
   - Lower-value PRs: No PO document requirement

### Future Enhancements:
- Organization settings UI for company details (logo, address, banking)
- Advanced PO customization dialog before generation
- Supplier onboarding workflow integration
- Firebase Storage upload for PO versioning
- Email PO directly to supplier from system

