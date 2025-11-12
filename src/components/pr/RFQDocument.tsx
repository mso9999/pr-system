import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import { PRRequest } from '@/types/pr';
import { Organization } from '@/types/organization';

interface RFQDocumentProps {
  pr: PRRequest;
  orgLogo?: string;
  organization: Organization;
}

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 20,
    borderBottom: '2 solid #333',
    paddingBottom: 10,
  },
  logo: {
    width: 120,
    height: 60,
    objectFit: 'contain',
    marginBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#1976d2',
  },
  subtitle: {
    fontSize: 11,
    color: '#666',
    marginBottom: 3,
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
    borderBottom: '1 solid #ddd',
    paddingBottom: 3,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  label: {
    width: '30%',
    fontWeight: 'bold',
    color: '#555',
  },
  value: {
    width: '70%',
    color: '#333',
  },
  table: {
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1976d2',
    color: 'white',
    padding: 8,
    fontWeight: 'bold',
    fontSize: 9,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1 solid #ddd',
    padding: 8,
    fontSize: 9,
  },
  tableRowAlt: {
    flexDirection: 'row',
    borderBottom: '1 solid #ddd',
    padding: 8,
    backgroundColor: '#f5f5f5',
    fontSize: 9,
  },
  col1: { width: '5%' },
  col2: { width: '35%' },
  col3: { width: '10%' },
  col4: { width: '12%' },
  col5: { width: '23%' },
  col6: { width: '15%' },
  fileLink: {
    color: '#1976d2',
    textDecoration: 'underline',
    fontSize: 8,
  },
  attachmentItem: {
    fontSize: 8,
    marginTop: 2,
    color: '#555',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    borderTop: '1 solid #ddd',
    paddingTop: 10,
    fontSize: 8,
    color: '#666',
  },
  instructions: {
    marginTop: 15,
    padding: 10,
    backgroundColor: '#fff3cd',
    borderLeft: '3 solid #ffc107',
  },
  instructionsTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#856404',
  },
  instructionsText: {
    fontSize: 9,
    lineHeight: 1.4,
    color: '#856404',
  },
});

export const RFQDocument: React.FC<RFQDocumentProps> = ({
  pr,
  orgLogo,
  organization,
}) => {
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Format company address
  const getCompanyAddress = () => {
    const addr = organization.companyAddress;
    if (!addr) return 'N/A';
    const parts = [
      addr.street,
      addr.city,
      addr.state,
      addr.postalCode,
      addr.country,
    ].filter(Boolean);
    return parts.join(', ');
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          {orgLogo && <Image src={orgLogo} style={styles.logo} />}
          <Text style={styles.title}>REQUEST FOR QUOTATION</Text>
          <Text style={styles.subtitle}>{organization.companyLegalName || organization.name}</Text>
          <Text style={styles.subtitle}>{getCompanyAddress()}</Text>
          {organization.companyPhone && (
            <Text style={styles.subtitle}>Tel: {organization.companyPhone}</Text>
          )}
          {organization.companyWebsite && (
            <Text style={styles.subtitle}>Web: {organization.companyWebsite}</Text>
          )}
        </View>

        {/* RFQ Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>RFQ Information</Text>
          <View style={styles.row}>
            <Text style={styles.label}>RFQ Number:</Text>
            <Text style={styles.value}>{pr.prNumber}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Issue Date:</Text>
            <Text style={styles.value}>{formatDate(pr.createdAt)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Response Deadline:</Text>
            <Text style={styles.value}>{formatDate(pr.requiredDate)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Expected Delivery Date:</Text>
            <Text style={styles.value}>{formatDate(pr.requiredDate)}</Text>
          </View>
          {pr.incoterms && (
            <View style={styles.row}>
              <Text style={styles.label}>Incoterms:</Text>
              <Text style={styles.value}>{pr.incoterms}</Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.label}>Department:</Text>
            <Text style={styles.value}>{pr.department || 'N/A'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Project Category:</Text>
            <Text style={styles.value}>{pr.projectCategory || 'N/A'}</Text>
          </View>
        </View>

        {/* Project Description */}
        {pr.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Project Description</Text>
            <Text style={styles.value}>{pr.description}</Text>
          </View>
        )}

        {/* Line Items Table */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Items Requested</Text>
          <View style={styles.table}>
            {/* Table Header */}
            <View style={styles.tableHeader}>
              <Text style={styles.col1}>#</Text>
              <Text style={styles.col2}>Description</Text>
              <Text style={styles.col3}>Qty</Text>
              <Text style={styles.col4}>UOM</Text>
              <Text style={styles.col5}>Notes/Specs</Text>
              <Text style={styles.col6}>Attachments</Text>
            </View>

            {/* Table Rows */}
            {pr.lineItems?.map((item, index) => {
              const hasAttachments = item.attachments && item.attachments.length > 0;
              const hasFileLink = item.fileLink;
              
              return (
                <View
                  key={index}
                  style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlt}
                >
                  <Text style={styles.col1}>{index + 1}</Text>
                  <Text style={styles.col2}>{item.description}</Text>
                  <Text style={styles.col3}>{item.quantity}</Text>
                  <Text style={styles.col4}>{item.uom || 'UNIT'}</Text>
                  <Text style={styles.col5}>{item.notes || '-'}</Text>
                  <View style={styles.col6}>
                    {hasAttachments && item.attachments.map((att, attIdx) => (
                      <Text key={attIdx} style={styles.fileLink}>
                        {att.name}
                        {'\n'}
                        <Text style={styles.attachmentItem}>{att.url}</Text>
                      </Text>
                    ))}
                    {hasFileLink && (
                      <Text style={styles.fileLink}>
                        {item.isFolder ? '📁 Folder: ' : '🔗 File: '}
                        {item.fileLink}
                      </Text>
                    )}
                    {!hasAttachments && !hasFileLink && <Text>-</Text>}
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Quote Submission Instructions */}
        <View style={styles.instructions}>
          <Text style={styles.instructionsTitle}>Quote Submission Instructions:</Text>
          <Text style={styles.instructionsText}>
            1. Please provide detailed pricing for each line item{'\n'}
            2. Include unit price and total price for each item{'\n'}
            3. Specify delivery timeframe and payment terms{'\n'}
            4. Confirm your ability to meet the expected delivery date{'\n'}
            5. State your delivery terms (Incoterms) if different from specified{'\n'}
            6. Submit your quote by the response deadline above{'\n'}
            {'\n'}
            <Text style={{ fontWeight: 'bold' }}>Contact Information (Procurement):</Text>{'\n'}
            {organization.procurementEmail ? `Email: ${organization.procurementEmail}` : 'Email: See company contact'}
            {organization.companyPhone && `{'\n'}Phone: ${organization.companyPhone}`}
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>
            This is an official Request for Quotation from {organization.companyLegalName || organization.name}. Please treat this document as confidential.
          </Text>
          <Text>Generated on {new Date().toLocaleDateString()} | RFQ #{pr.prNumber}</Text>
        </View>
      </Page>
    </Document>
  );
};

