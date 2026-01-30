/**
 * @fileoverview PO Document PDF Template
 * @description Creates a professional, downloadable PDF Purchase Order document using react-pdf
 */

import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  Font,
} from '@react-pdf/renderer';
import { PRRequest } from '@/types/pr';
import { formatCurrency } from '@/utils/formatters';

// Register fonts if needed (optional - can use system fonts)
// Font.register({
//   family: 'Roboto',
//   src: 'https://fonts.gstatic.com/s/roboto/v27/KFOmCnqEu92Fr1Mu4mxP.ttf',
// });

// PDF Styles
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    backgroundColor: '#FFFFFF',
  },
  header: {
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 2,
    borderBottomColor: '#1976d2',
    paddingBottom: 10,
  },
  logo: {
    width: 100,
    height: 40,
    objectFit: 'contain',
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 10,
    color: '#666',
  },
  section: {
    marginTop: 15,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 8,
    textTransform: 'uppercase',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingBottom: 3,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  column: {
    flex: 1,
  },
  label: {
    fontSize: 8,
    color: '#666',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  value: {
    fontSize: 10,
    color: '#000',
  },
  valueBold: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000',
  },
  address: {
    fontSize: 9,
    color: '#333',
    lineHeight: 1.4,
  },
  table: {
    marginTop: 10,
    marginBottom: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1976d2',
    color: '#FFFFFF',
    padding: 8,
    fontWeight: 'bold',
    fontSize: 9,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    padding: 8,
    fontSize: 9,
  },
  tableRowAlt: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    padding: 8,
    fontSize: 9,
  },
  tableCell: {
    flex: 1,
  },
  tableCellSmall: {
    width: '8%',
  },
  tableCellMedium: {
    width: '12%',
  },
  tableCellLarge: {
    width: '30%',
  },
  totals: {
    marginTop: 10,
    alignItems: 'flex-end',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 5,
  },
  totalLabel: {
    fontSize: 10,
    marginRight: 20,
    width: 100,
    textAlign: 'right',
  },
  totalValue: {
    fontSize: 10,
    fontWeight: 'bold',
    width: 100,
    textAlign: 'right',
  },
  grandTotal: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1976d2',
  },
  footer: {
    marginTop: 30,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    fontSize: 8,
    color: '#666',
    textAlign: 'center',
  },
  signature: {
    marginTop: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  signatureBox: {
    width: '45%',
    borderTopWidth: 1,
    borderTopColor: '#000',
    paddingTop: 5,
  },
  signatureLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  alert: {
    backgroundColor: '#FFF3CD',
    border: '1px solid #FFE69C',
    padding: 10,
    marginBottom: 10,
    borderRadius: 4,
  },
  alertText: {
    fontSize: 9,
    color: '#856404',
  },
});

interface PODocumentProps {
  pr: PRRequest;
  organizationDetails?: {
    companyLegalName?: string;
    companyAddress?: {
      street?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
    };
    companyPhone?: string;
    companyWebsite?: string;
    companyRegistrationNumber?: string;
    companyTaxId?: string;
    logoUrl?: string;
  };
  vendorDetails?: {
    name?: string;
    contactName?: string;
    contactEmail?: string;
    contactPhone?: string;
    address?: string;
    city?: string;
    country?: string;
  } | null;
  logoBase64?: string;
}

export const PODocument: React.FC<PODocumentProps> = ({ pr, organizationDetails, vendorDetails, logoBase64 }) => {
  // Log logo status in PDF component
  console.log('[PODocument] Rendering PDF with logo:', {
    hasLogo: !!logoBase64,
    logoLength: logoBase64?.length,
    logoPreview: logoBase64?.substring(0, 50)
  });
  
  // Get supplier name from vendor details or PR
  const supplierName = vendorDetails?.name || pr.selectedVendor || pr.preferredVendor || pr.supplierName || 'Vendor Name';
  
  // Calculate totals - use lineItemsWithSKU if available, otherwise use lineItems with their unitPrice values
  const lineItems = pr.lineItemsWithSKU && pr.lineItemsWithSKU.length > 0 
    ? pr.lineItemsWithSKU 
    : pr.lineItems?.map((item, idx) => ({
        lineNumber: idx + 1,
        description: item.description,
        quantity: item.quantity,
        uom: item.uom,
        unitPrice: item.unitPrice || 0, // Use unitPrice from line item (entered by procurement)
        totalAmount: (item.quantity || 0) * (item.unitPrice || 0), // Calculate total from quantity × unitPrice
        currency: pr.currency || 'LSL',
      })) || [];

  const subtotal = lineItems.reduce((sum, item) => sum + (item.totalAmount || 0), 0);
  const taxAmount = pr.taxPercentage ? (subtotal * pr.taxPercentage / 100) : 0;
  const dutyAmount = pr.dutyPercentage ? (subtotal * pr.dutyPercentage / 100) : 0;
  const grandTotal = subtotal + taxAmount + dutyAmount;

  // Format dates
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Not specified';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            {logoBase64 && (
              <Image src={logoBase64} style={styles.logo} />
            )}
            {organizationDetails?.companyLegalName && (
              <Text style={{ fontSize: 14, fontWeight: 'bold', marginTop: 5 }}>
                {organizationDetails.companyLegalName}
              </Text>
            )}
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.title}>PURCHASE ORDER</Text>
            <Text style={styles.subtitle}>PO Number: {pr.prNumber}</Text>
            <Text style={styles.subtitle}>
              Issue Date: {formatDate(pr.poIssueDate || pr.createdAt)}
            </Text>
            <Text style={styles.subtitle}>Currency: {pr.currency || 'LSL'}</Text>
          </View>
        </View>

        {/* Parties: Buyer and Supplier */}
        <View style={styles.row}>
          {/* Buyer (FROM) */}
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>FROM (Buyer)</Text>
            <Text style={styles.valueBold}>
              {organizationDetails?.companyLegalName || pr.organization}
            </Text>
            {organizationDetails?.companyAddress && (
              <Text style={styles.address}>
                {organizationDetails.companyAddress.street || ''}
                {organizationDetails.companyAddress.street && '\n'}
                {organizationDetails.companyAddress.city || ''}
                {organizationDetails.companyAddress.state && `, ${organizationDetails.companyAddress.state}`}
                {organizationDetails.companyAddress.postalCode && ' '}
                {organizationDetails.companyAddress.postalCode || ''}
                {(organizationDetails.companyAddress.city || organizationDetails.companyAddress.postalCode) && '\n'}
                {organizationDetails.companyAddress.country || ''}
              </Text>
            )}
            {organizationDetails?.companyPhone && (
              <Text style={styles.value}>Phone: {organizationDetails.companyPhone}</Text>
            )}
            {organizationDetails?.companyWebsite && (
              <Text style={styles.value}>Website: {organizationDetails.companyWebsite}</Text>
            )}
            {organizationDetails?.companyTaxId && (
              <Text style={styles.value}>Tax ID: {organizationDetails.companyTaxId}</Text>
            )}
            {pr.buyerRepresentativeName && (
              <View style={{ marginTop: 8 }}>
                <Text style={styles.label}>Contact Person</Text>
                <Text style={styles.value}>{pr.buyerRepresentativeName}</Text>
                {pr.buyerRepresentativeTitle && (
                  <Text style={styles.value}>{pr.buyerRepresentativeTitle}</Text>
                )}
                {pr.buyerRepresentativeEmail && (
                  <Text style={styles.value}>{pr.buyerRepresentativeEmail}</Text>
                )}
                {pr.buyerRepresentativePhone && (
                  <Text style={styles.value}>{pr.buyerRepresentativePhone}</Text>
                )}
              </View>
            )}
          </View>

          {/* Supplier (TO) */}
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>TO (Supplier)</Text>
            <Text style={styles.valueBold}>{supplierName}</Text>
            {(vendorDetails?.address || vendorDetails?.city || vendorDetails?.country) && (
              <Text style={styles.address}>
                {vendorDetails.address && `${vendorDetails.address}\n`}
                {vendorDetails.city && vendorDetails.city}
                {vendorDetails.country && `\n${vendorDetails.country}`}
              </Text>
            )}
            {(pr.supplierRepresentativeName || vendorDetails?.contactName) && (
              <View style={{ marginTop: 8 }}>
                <Text style={styles.label}>Contact Person</Text>
                <Text style={styles.value}>{pr.supplierRepresentativeName || vendorDetails?.contactName}</Text>
                {pr.supplierRepresentativeTitle && (
                  <Text style={styles.value}>{pr.supplierRepresentativeTitle}</Text>
                )}
                {(pr.supplierRepresentativeEmail || vendorDetails?.contactEmail) && (
                  <Text style={styles.value}>{pr.supplierRepresentativeEmail || vendorDetails?.contactEmail}</Text>
                )}
                {(pr.supplierRepresentativePhone || vendorDetails?.contactPhone) && (
                  <Text style={styles.value}>{pr.supplierRepresentativePhone || vendorDetails?.contactPhone}</Text>
                )}
              </View>
            )}
          </View>
        </View>

        {/* Delivery and Billing Addresses */}
        <View style={styles.row}>
          {/* Ship To */}
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>Ship To</Text>
            {pr.deliveryAddressDifferent && pr.deliveryAddress ? (
              <View>
                {pr.deliveryAddress.recipientName && (
                  <Text style={styles.valueBold}>{pr.deliveryAddress.recipientName}</Text>
                )}
                <Text style={styles.address}>
                  {pr.deliveryAddress.street || ''}
                  {pr.deliveryAddress.street && '\n'}
                  {pr.deliveryAddress.city || ''}
                  {pr.deliveryAddress.state && `, ${pr.deliveryAddress.state}`}
                  {pr.deliveryAddress.postalCode && ' '}
                  {pr.deliveryAddress.postalCode || ''}
                  {(pr.deliveryAddress.city || pr.deliveryAddress.postalCode) && '\n'}
                  {pr.deliveryAddress.country || ''}
                </Text>
                {pr.deliveryAddress.contactPerson && (
                  <Text style={styles.value}>Contact: {pr.deliveryAddress.contactPerson}</Text>
                )}
                {pr.deliveryAddress.contactPhone && (
                  <Text style={styles.value}>Phone: {pr.deliveryAddress.contactPhone}</Text>
                )}
              </View>
            ) : (
              <Text style={styles.value}>Same as company address</Text>
            )}
          </View>

          {/* Bill To */}
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>Bill To</Text>
            {pr.billingAddressDifferent && pr.billingAddress ? (
              <View>
                {pr.billingAddress.recipientName && (
                  <Text style={styles.valueBold}>{pr.billingAddress.recipientName}</Text>
                )}
                <Text style={styles.address}>
                  {pr.billingAddress.street || ''}
                  {pr.billingAddress.street && '\n'}
                  {pr.billingAddress.city || ''}
                  {pr.billingAddress.state && `, ${pr.billingAddress.state}`}
                  {pr.billingAddress.postalCode && ' '}
                  {pr.billingAddress.postalCode || ''}
                  {(pr.billingAddress.city || pr.billingAddress.postalCode) && '\n'}
                  {pr.billingAddress.country || ''}
                </Text>
              </View>
            ) : (
              <Text style={styles.value}>Same as company address</Text>
            )}
          </View>
        </View>

        {/* Order Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Details</Text>
          
          {/* Line Items Table */}
          <View style={styles.table}>
            {/* Header */}
            <View style={styles.tableHeader}>
              <Text style={styles.tableCellSmall}>Line</Text>
              <Text style={styles.tableCellMedium}>Item#</Text>
              <Text style={styles.tableCellLarge}>Description</Text>
              <Text style={styles.tableCellMedium}>Qty</Text>
              <Text style={styles.tableCellMedium}>UOM</Text>
              <Text style={styles.tableCellMedium}>Unit Price</Text>
              <Text style={styles.tableCellMedium}>Total</Text>
            </View>

            {/* Rows */}
            {lineItems.map((item, idx) => (
              <View
                key={item.lineNumber || idx}
                style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}
              >
                <Text style={styles.tableCellSmall}>{item.lineNumber}</Text>
                <Text style={styles.tableCellMedium}>{item.itemNumber || '-'}</Text>
                <Text style={styles.tableCellLarge}>{item.description}</Text>
                <Text style={styles.tableCellMedium}>{item.quantity}</Text>
                <Text style={styles.tableCellMedium}>{item.uom}</Text>
                <Text style={styles.tableCellMedium}>
                  {formatCurrency(item.unitPrice || 0, item.currency || pr.currency || 'LSL', false)}
                </Text>
                <Text style={styles.tableCellMedium}>
                  {formatCurrency(item.totalAmount || 0, item.currency || pr.currency || 'LSL', false)}
                </Text>
              </View>
            ))}
          </View>

          {/* Totals */}
          <View style={styles.totals}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal:</Text>
              <Text style={styles.totalValue}>
                {formatCurrency(subtotal, pr.currency || 'LSL', false)}
              </Text>
            </View>
            {taxAmount > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>
                  Tax ({pr.taxPercentage}%):
                </Text>
                <Text style={styles.totalValue}>
                  {formatCurrency(taxAmount, pr.currency || 'LSL', false)}
                </Text>
              </View>
            )}
            {dutyAmount > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>
                  Duty ({pr.dutyPercentage}%):
                </Text>
                <Text style={styles.totalValue}>
                  {formatCurrency(dutyAmount, pr.currency || 'LSL', false)}
                </Text>
              </View>
            )}
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, styles.grandTotal]}>Grand Total:</Text>
              <Text style={[styles.totalValue, styles.grandTotal]}>
                {formatCurrency(grandTotal, pr.currency || 'LSL')}
              </Text>
            </View>
          </View>
        </View>

        {/* Delivery Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Information</Text>
          <View style={styles.row}>
            <View style={styles.column}>
              <Text style={styles.label}>Expected Delivery Date</Text>
              <Text style={styles.value}>{formatDate(pr.estimatedDeliveryDate)}</Text>
            </View>
            <View style={styles.column}>
              <Text style={styles.label}>Mode of Delivery</Text>
              <Text style={styles.value}>
                {pr.modeOfDelivery === 'Other' 
                  ? pr.modeOfDeliveryOther || 'Not specified'
                  : pr.modeOfDelivery || 'Not specified'}
              </Text>
            </View>
          </View>
          {pr.packingInstructions && (
            <View>
              <Text style={styles.label}>Packing/Labeling Instructions</Text>
              <Text style={styles.value}>{pr.packingInstructions}</Text>
            </View>
          )}
        </View>

        {/* Payment Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Information</Text>
          <View style={styles.row}>
            <View style={styles.column}>
              <Text style={styles.label}>Payment Method</Text>
              <Text style={styles.value}>
                {pr.paymentMethod === 'Other' 
                  ? pr.paymentMethodOther || 'Bank Transfer'
                  : pr.paymentMethod || 'Bank Transfer'}
              </Text>
            </View>
            <View style={styles.column}>
              <Text style={styles.label}>Payment Terms</Text>
              <Text style={styles.value}>{pr.paymentTerms || 'As agreed'}</Text>
            </View>
          </View>
          {pr.supplierBankName && (
            <View>
              <Text style={styles.label}>Banking Details</Text>
              <Text style={styles.value}>Bank: {pr.supplierBankName}</Text>
              {pr.supplierBankAccountName && (
                <Text style={styles.value}>Account Name: {pr.supplierBankAccountName}</Text>
              )}
              {pr.supplierBankAccountNumber && (
                <Text style={styles.value}>Account Number: {pr.supplierBankAccountNumber}</Text>
              )}
              {pr.supplierBankSwiftCode && (
                <Text style={styles.value}>SWIFT Code: {pr.supplierBankSwiftCode}</Text>
              )}
              {pr.supplierBankIban && (
                <Text style={styles.value}>IBAN: {pr.supplierBankIban}</Text>
              )}
            </View>
          )}
        </View>

        {/* Special Instructions */}
        {pr.specialInstructions && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Special Instructions</Text>
            <Text style={styles.value}>{pr.specialInstructions}</Text>
          </View>
        )}

        {/* References */}
        {(pr.referenceQuotationNumber || pr.referenceContractNumber || pr.referenceTenderNumber) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>References</Text>
            {pr.referenceQuotationNumber && (
              <Text style={styles.value}>Quotation: {pr.referenceQuotationNumber}</Text>
            )}
            {pr.referenceContractNumber && (
              <Text style={styles.value}>Contract: {pr.referenceContractNumber}</Text>
            )}
            {pr.referenceTenderNumber && (
              <Text style={styles.value}>Tender: {pr.referenceTenderNumber}</Text>
            )}
          </View>
        )}

        {/* Remarks */}
        {pr.poRemarks && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Remarks</Text>
            <Text style={styles.value}>{pr.poRemarks}</Text>
          </View>
        )}

        {/* Signature Section */}
        <View style={styles.signature}>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureLabel}>Authorized Signature</Text>
            {pr.buyerRepresentativeName && (
              <Text style={{ fontSize: 8, textAlign: 'center', marginTop: 3 }}>
                {pr.buyerRepresentativeName}
              </Text>
            )}
          </View>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureLabel}>Date</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>
            This is a computer-generated document. No signature is required.
          </Text>
          <Text style={{ marginTop: 5 }}>
            For any queries, please contact {organizationDetails?.companyPhone || 'the buyer'}.
          </Text>
          {(pr.internalProjectCode || pr.internalExpenseCode) && (
            <Text style={{ marginTop: 5, fontSize: 7 }}>
              Internal Reference: 
              {pr.internalProjectCode && ` Project: ${pr.internalProjectCode}`}
              {pr.internalExpenseCode && ` | Expense: ${pr.internalExpenseCode}`}
              {pr.internalCostCenter && ` | Cost Center: ${pr.internalCostCenter}`}
            </Text>
          )}
        </View>
      </Page>
    </Document>
  );
};



