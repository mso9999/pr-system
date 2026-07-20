/**
 * @fileoverview Invoice PDF Template
 * @description Creates a professional, downloadable PDF Invoice document using react-pdf.
 * Format aligned with 1PWR A GBC metering invoice style (PI-OPA-2026-001).
 */

import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from '@react-pdf/renderer';
import { Invoice } from '@/types/invoice';
import { formatCurrency } from '@/utils/formatters';

const styles = StyleSheet.create({
  page: {
    padding: 50,
    fontSize: 10,
    fontFamily: 'Helvetica',
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
    color: '#1a1a1a',
  },
  invoiceMeta: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
    gap: 30,
  },
  invoiceMetaText: {
    fontSize: 10,
    color: '#333',
  },
  partiesRow: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 20,
  },
  partyBox: {
    flex: 1,
  },
  partyLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    color: '#666',
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    paddingBottom: 2,
  },
  partyName: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  partyAddress: {
    fontSize: 9,
    color: '#333',
    lineHeight: 1.4,
    marginBottom: 2,
  },
  partyDetail: {
    fontSize: 9,
    color: '#333',
    marginBottom: 1,
  },
  table: {
    marginBottom: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    color: '#FFFFFF',
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontSize: 9,
    fontWeight: 'bold',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontSize: 9,
  },
  tableRowAlt: {
    flexDirection: 'row',
    backgroundColor: '#F8F8F8',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontSize: 9,
  },
  colLine: { width: '5%' },
  colDesc: { width: '50%' },
  colQty: { width: '12%' },
  colUnitPrice: { width: '16%', textAlign: 'right' },
  colAmount: { width: '17%', textAlign: 'right' },
  contractInfo: {
    marginTop: 8,
    marginBottom: 15,
    fontSize: 8,
    color: '#666',
    lineHeight: 1.5,
  },
  totalsSection: {
    marginTop: 10,
    marginBottom: 20,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 4,
  },
  totalsLabel: {
    fontSize: 10,
    width: 150,
    textAlign: 'right',
    marginRight: 10,
  },
  totalsValue: {
    fontSize: 10,
    width: 120,
    textAlign: 'right',
  },
  totalsGrand: {
    fontSize: 12,
    fontWeight: 'bold',
    borderTopWidth: 2,
    borderTopColor: '#1a1a1a',
    paddingTop: 6,
    marginTop: 4,
  },
  paymentSection: {
    marginTop: 15,
    marginBottom: 15,
  },
  paymentTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    color: '#666',
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    paddingBottom: 2,
  },
  paymentGrid: {
    flexDirection: 'row',
    gap: 20,
  },
  paymentCol: {
    flex: 1,
  },
  paymentRow: {
    fontSize: 9,
    marginBottom: 3,
    lineHeight: 1.3,
  },
  paymentLabel: {
    fontWeight: 'bold',
  },
  notesSection: {
    marginTop: 15,
    marginBottom: 10,
  },
  notesTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    color: '#666',
    marginBottom: 4,
  },
  noteItem: {
    fontSize: 8,
    color: '#555',
    marginBottom: 2,
    lineHeight: 1.4,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 50,
    right: 50,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingTop: 8,
    fontSize: 7,
    color: '#999',
    textAlign: 'center',
  },
});

interface InvoiceDocumentProps {
  invoice: Invoice;
  logoBase64?: string;
}

export const InvoiceDocument: React.FC<InvoiceDocumentProps> = ({ invoice, logoBase64 }) => {
  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'Not specified';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const subtotal = invoice.lineItems.reduce((sum, item) => sum + item.total, 0);
  const taxes = invoice.taxes ?? 0;
  const totalDue = invoice.totalAmount;

  const qtyUnit = (item: typeof invoice.lineItems[0]) => {
    const unit = item.unit || 'pcs';
    return `${item.quantity} ${unit}`;
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Title */}
        <Text style={styles.title}>INVOICE</Text>
        <View style={styles.invoiceMeta}>
          <Text style={styles.invoiceMetaText}>Invoice No: {invoice.invoiceNumber}</Text>
          <Text style={styles.invoiceMetaText}>Invoice Date: {formatDate(invoice.issueDate)}</Text>
          {invoice.validityDays && (
            <Text style={styles.invoiceMetaText}>Validity: {invoice.validityDays} calendar days</Text>
          )}
          <Text style={styles.invoiceMetaText}>Currency: {invoice.currency}</Text>
        </View>

        {/* Bill To / Supplier */}
        <View style={styles.partiesRow}>
          <View style={styles.partyBox}>
            <Text style={styles.partyLabel}>Bill To</Text>
            <Text style={styles.partyName}>{invoice.customer.name}</Text>
            <Text style={styles.partyAddress}>{invoice.customer.address}</Text>
            {invoice.customer.contactEmail && (
              <Text style={styles.partyDetail}>Email: {invoice.customer.contactEmail}</Text>
            )}
            {invoice.customer.contactPhone && (
              <Text style={styles.partyDetail}>Tel: {invoice.customer.contactPhone}</Text>
            )}
          </View>
          <View style={styles.partyBox}>
            <Text style={styles.partyLabel}>Supplier</Text>
            <Text style={styles.partyName}>{invoice.issuer.name}</Text>
            <Text style={styles.partyAddress}>{invoice.issuer.address}</Text>
            {invoice.issuer.registrationNumber && (
              <Text style={styles.partyDetail}>Reg. No: {invoice.issuer.registrationNumber}</Text>
            )}
            {invoice.issuer.taxId && (
              <Text style={styles.partyDetail}>Tax ID: {invoice.issuer.taxId}</Text>
            )}
          </View>
        </View>

        {/* Line Items Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.colLine}>Line</Text>
            <Text style={styles.colDesc}>Description</Text>
            <Text style={styles.colQty}>Qty/Unit</Text>
            <Text style={styles.colUnitPrice}>Unit Price ({invoice.currency})</Text>
            <Text style={styles.colAmount}>Amount ({invoice.currency})</Text>
          </View>
          {invoice.lineItems.map((item, idx) => (
            <View
              key={idx}
              style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}
            >
              <Text style={styles.colLine}>{idx + 1}</Text>
              <Text style={styles.colDesc}>{item.description}</Text>
              <Text style={styles.colQty}>{qtyUnit(item)}</Text>
              <Text style={styles.colUnitPrice}>
                {formatCurrency(item.unitPrice, invoice.currency, false)}
              </Text>
              <Text style={styles.colAmount}>
                {formatCurrency(item.total, invoice.currency, false)}
              </Text>
            </View>
          ))}
        </View>

        {/* Contract Ref and Milestone */}
        <View style={styles.contractInfo}>
          {invoice.poReference && (
            <Text>PO Reference: {invoice.poReference}</Text>
          )}
          {invoice.contractReference && (
            <Text>Contract Ref: {invoice.contractReference}</Text>
          )}
          {invoice.milestone && (
            <Text>Milestone: {invoice.milestone}</Text>
          )}
          <Text>Incoterm: CIF (Cost, Insurance and Freight)</Text>
        </View>

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Subtotal (Contract Value):</Text>
            <Text style={styles.totalsValue}>
              {formatCurrency(subtotal, invoice.currency, false)}
            </Text>
          </View>
          {invoice.upfrontPercentage != null && invoice.upfrontAmount != null ? (
            <>
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>{invoice.upfrontPercentage}% Advance Due:</Text>
                <Text style={styles.totalsValue}>
                  {formatCurrency(invoice.upfrontAmount, invoice.currency, false)}
                </Text>
              </View>
              {invoice.oemCreditAmount != null && invoice.oemCreditAmount > 0 && (
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>Less: Credit Note (OEM Direct Payment):</Text>
                  <Text style={styles.totalsValue}>
                    ({formatCurrency(invoice.oemCreditAmount, invoice.currency, false)})
                  </Text>
                </View>
              )}
              <View style={[styles.totalsRow, styles.totalsGrand]}>
                <Text style={[styles.totalsLabel, styles.totalsGrand]}>Total Due Now ({invoice.currency}):</Text>
                <Text style={[styles.totalsValue, styles.totalsGrand]}>
                  {formatCurrency(totalDue, invoice.currency, false)}
                </Text>
              </View>
            </>
          ) : (
            <>
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Taxes:</Text>
                <Text style={styles.totalsValue}>
                  {formatCurrency(taxes, invoice.currency, false)}
                </Text>
              </View>
              <View style={[styles.totalsRow, styles.totalsGrand]}>
                <Text style={[styles.totalsLabel, styles.totalsGrand]}>Total Due ({invoice.currency}):</Text>
                <Text style={[styles.totalsValue, styles.totalsGrand]}>
                  {formatCurrency(totalDue, invoice.currency, false)}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Payment Details */}
        <View style={styles.paymentSection}>
          <Text style={styles.paymentTitle}>Payment Details ({invoice.currency} Transfer)</Text>
          <View style={styles.paymentGrid}>
            <View style={styles.paymentCol}>
              {invoice.issuer.banking.accountName && (
                <Text style={styles.paymentRow}><Text style={styles.paymentLabel}>Beneficiary Name:</Text> {invoice.issuer.banking.accountName}</Text>
              )}
              {invoice.issuer.banking.bankName && (
                <Text style={styles.paymentRow}><Text style={styles.paymentLabel}>Bank Name:</Text> {invoice.issuer.banking.bankName}</Text>
              )}
              {invoice.issuer.banking.bankAddress && (
                <Text style={styles.paymentRow}><Text style={styles.paymentLabel}>Bank Address:</Text> {invoice.issuer.banking.bankAddress}</Text>
              )}
              {invoice.issuer.banking.accountNumber && (
                <Text style={styles.paymentRow}><Text style={styles.paymentLabel}>Account Number ({invoice.currency}):</Text> {invoice.issuer.banking.accountNumber}</Text>
              )}
            </View>
            <View style={styles.paymentCol}>
              {invoice.issuer.banking.iban && (
                <Text style={styles.paymentRow}><Text style={styles.paymentLabel}>IBAN:</Text> {invoice.issuer.banking.iban}</Text>
              )}
              {invoice.issuer.banking.swiftCode && (
                <Text style={styles.paymentRow}><Text style={styles.paymentLabel}>SWIFT/BIC:</Text> {invoice.issuer.banking.swiftCode}</Text>
              )}
              {invoice.issuer.banking.correspondent1 && (
                <Text style={styles.paymentRow}><Text style={styles.paymentLabel}>Correspondent Option 1:</Text> {invoice.issuer.banking.correspondent1}</Text>
              )}
              {invoice.issuer.banking.correspondent2 && (
                <Text style={styles.paymentRow}><Text style={styles.paymentLabel}>Correspondent Option 2:</Text> {invoice.issuer.banking.correspondent2}</Text>
              )}
            </View>
          </View>
        </View>

        {/* Payment Terms */}
        {invoice.paymentTerms && (
          <View style={styles.notesSection}>
            <Text style={styles.notesTitle}>Payment Terms</Text>
            <Text style={styles.noteItem}>{invoice.paymentTerms}</Text>
          </View>
        )}

        {/* Supporting Documents */}
        {invoice.supportingDocuments.length > 0 && (
          <View style={styles.notesSection}>
            <Text style={styles.notesTitle}>Supporting Documents</Text>
            {invoice.supportingDocuments.map((doc, idx) => (
              <Text key={idx} style={styles.noteItem}>- {doc}</Text>
            ))}
          </View>
        )}

        {/* Notes */}
        {invoice.notes && invoice.notes.length > 0 && (
          <View style={styles.notesSection}>
            <Text style={styles.notesTitle}>Notes</Text>
            {invoice.notes.map((note, idx) => (
              <Text key={idx} style={styles.noteItem}>- {note}</Text>
            ))}
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text>This is a computer-generated invoice from {invoice.issuer.name}. Payment is due per the terms stated above.</Text>
        </View>
      </Page>
    </Document>
  );
};
