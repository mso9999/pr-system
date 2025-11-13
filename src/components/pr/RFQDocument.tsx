import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import { PRRequest } from '@/types/pr';
import { Organization } from '@/types/organization';

interface RFQCustomData {
  responseDeadline: string;
  expectedDeliveryDate: string;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryCountry: string;
  incoterms: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  specialInstructions: string;
}

interface RFQDocumentProps {
  pr: PRRequest;
  orgLogo?: string;
  organization: Organization;
  customData: RFQCustomData;
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
  customData,
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
    const addr = organization?.companyAddress;
    if (!addr) return 'N/A';
    const parts = [
      addr.street,
      addr.city,
      addr.state,
      addr.postalCode,
      addr.country,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : 'N/A';
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
            <Text style={styles.value}>{formatDate(customData.responseDeadline || pr.requiredDate)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Expected Delivery Date:</Text>
            <Text style={styles.value}>{formatDate(customData.expectedDeliveryDate || pr.requiredDate)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Incoterms:</Text>
            <Text style={styles.value}>{customData.incoterms || pr.incoterms || 'EXW'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Department:</Text>
            <Text style={styles.value}>{pr.department || 'N/A'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Project Category:</Text>
            <Text style={styles.value}>{pr.projectCategory || 'N/A'}</Text>
          </View>
        </View>

        {/* Delivery Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Information</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Delivery Address:</Text>
            <Text style={styles.value}>{customData.deliveryAddress || 'To be confirmed'}</Text>
          </View>
          {customData.deliveryCity && (
            <View style={styles.row}>
              <Text style={styles.label}>City:</Text>
              <Text style={styles.value}>{customData.deliveryCity}</Text>
            </View>
          )}
          {customData.deliveryCountry && (
            <View style={styles.row}>
              <Text style={styles.label}>Country:</Text>
              <Text style={styles.value}>{customData.deliveryCountry}</Text>
            </View>
          )}
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
              const hasAttachments = item.attachments && Array.isArray(item.attachments) && item.attachments.length > 0;
              const hasFileLink = item.fileLink && typeof item.fileLink === 'string';
              
              return (
                <View
                  key={index}
                  style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlt}
                >
                  <Text style={styles.col1}>{String(index + 1)}</Text>
                  <Text style={styles.col2}>{String(item.description || '')}</Text>
                  <Text style={styles.col3}>{String(item.quantity || '')}</Text>
                  <Text style={styles.col4}>{String(item.uom || 'UNIT')}</Text>
                  <Text style={styles.col5}>{String(item.notes || '-')}</Text>
                  <View style={styles.col6}>
                    {hasAttachments && item.attachments.map((att, attIdx) => {
                      // Ensure att is an object with name and url properties
                      if (!att || typeof att !== 'object') return null;
                      const attName = String(att.name || 'Attachment');
                      const attUrl = String(att.url || '');
                      return (
                        <Text key={attIdx} style={styles.fileLink}>
                          {attName}
                          {'\n'}
                          <Text style={styles.attachmentItem}>{attUrl}</Text>
                        </Text>
                      );
                    })}
                    {hasFileLink && (
                      <Text style={styles.fileLink}>
                        {item.isFolder ? 'Folder: ' : 'File: '}
                        {String(item.fileLink)}
                      </Text>
                    )}
                    {!hasAttachments && !hasFileLink && <Text>-</Text>}
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Contact Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Procurement Contact</Text>
          {customData.contactPerson && (
            <View style={styles.row}>
              <Text style={styles.label}>Contact Person:</Text>
              <Text style={styles.value}>{customData.contactPerson}</Text>
            </View>
          )}
          {customData.contactEmail && (
            <View style={styles.row}>
              <Text style={styles.label}>Email:</Text>
              <Text style={styles.value}>{customData.contactEmail}</Text>
            </View>
          )}
          {customData.contactPhone && (
            <View style={styles.row}>
              <Text style={styles.label}>Phone:</Text>
              <Text style={styles.value}>{customData.contactPhone}</Text>
            </View>
          )}
          {!customData.contactPerson && !customData.contactEmail && !customData.contactPhone && (
            <View style={styles.row}>
              <Text style={styles.label}>Email:</Text>
              <Text style={styles.value}>{organization.procurementEmail || 'Contact via company email'}</Text>
            </View>
          )}
        </View>

        {/* Special Instructions */}
        {customData.specialInstructions && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Special Instructions & Requirements</Text>
            <Text style={styles.value}>{customData.specialInstructions}</Text>
          </View>
        )}

        {/* Quote Submission Instructions */}
        <View style={styles.instructions}>
          <Text style={styles.instructionsTitle}>Quote Submission Instructions:</Text>
          <Text style={styles.instructionsText}>
            1. Please provide detailed pricing for each line item{'\n'}
            2. Include unit price and total price for each item{'\n'}
            3. Specify delivery timeframe and payment terms{'\n'}
            4. Confirm your ability to meet the expected delivery date and delivery terms ({customData.incoterms || 'EXW'}){'\n'}
            5. Include all applicable taxes and fees{'\n'}
            6. State your quote validity period{'\n'}
            7. Submit quotes by the response deadline: {formatDate(customData.responseDeadline || pr.requiredDate)}
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

