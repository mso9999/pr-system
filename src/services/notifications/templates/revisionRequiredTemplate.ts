import { NotificationContext, EmailContent } from '../types';
import { generateEmailHeaders } from '../types/emailHeaders';
import { generateTable } from './baseTemplate';
import { styles } from './styles';
import { referenceDataService } from '../../referenceData';

interface RevisionRequiredDetails {
  prNumber: string;
  reviewerName: string;
  revisionNotes: string;
  baseUrl: string;
  prId: string;
  isUrgent?: boolean;
  category?: string;
  expenseType?: string;
  vendorName?: string;
}

function extractRevisionDetails(context: NotificationContext): RevisionRequiredDetails {
  const { pr, prNumber, user, notes, isUrgent } = context;
  return {
    prNumber,
    reviewerName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.name || 'System' : 'System',
    revisionNotes: notes || '',
    baseUrl: context.baseUrl || '',
    prId: pr?.id || '',
    isUrgent,
    // Use optional chaining to safely access properties that might not exist
    category: pr?.category || '',
    expenseType: pr?.expenseType || '',
    vendorName: pr?.vendorName || ''
  };
}

const formatCurrency = (amount?: number | null, currency?: string) => {
  if (amount === undefined || amount === null) return 'Not specified';
  try {
    return amount.toLocaleString('en-US', { 
      style: 'currency', 
      currency: currency || 'USD'
    });
  } catch (e) {
    console.error('Error formatting currency:', e);
    return `${amount} ${currency || 'USD'}`;
  }
};

const formatDate = (date?: string | Date | null) => {
  if (!date) return 'Not specified';
  try {
    return new Date(date).toLocaleDateString();
  } catch (e) {
    console.error('Error formatting date:', e);
    return 'Invalid date';
  }
};

function getRequestorName(requestor: any): string {
  if (!requestor) return 'Not specified';
  
  // If we have a name field, use it
  if (requestor.name) {
    return requestor.name;
  }
  
  // Next try displayName
  if (requestor.displayName) {
    return requestor.displayName;
  }
  
  // Then try firstName + lastName
  const firstName = requestor.firstName || '';
  const lastName = requestor.lastName || '';
  
  if (firstName || lastName) {
    return `${firstName} ${lastName}`.trim();
  }
  
  // Finally fall back to email
  return requestor.email || 'Not specified';
}

function getRequestorEmail(requestor: any): string {
  return requestor.email || 'Not specified';
}

/**
 * Gets the vendor name from the PR
 */
async function getVendorName(pr: any): Promise<string> {
  if (!pr) return 'Not specified';
  
  try {
    // Try to get from vendorDetails first
    if (pr.vendorDetails && pr.vendorDetails.name) {
      return pr.vendorDetails.name;
    }
    
    // Then try vendor
    if (pr.vendor && pr.vendor.name) {
      return pr.vendor.name;
    }
    
    // Then try preferred vendor
    if (pr.preferredVendor) {
      return pr.preferredVendor;
    }
    
    return 'Not specified';
  } catch (err) {
    console.error('Error getting vendor name:', err);
    return pr.vendorDetails?.code || pr.vendor?.code || pr.preferredVendor || 'Not specified';
  }
}

function formatAmount(amount?: number | null, currency?: string): string {
  return formatCurrency(amount, currency);
}

export async function generateRevisionRequiredEmail(context: NotificationContext): Promise<EmailContent> {
  try {
    const { pr, prNumber, user, notes, baseUrl, isUrgent } = context;
    // Always use production URL for notifications
    const prUrl = `https://pr.1pwrafrica.com/pr/${pr?.id || context.prId}`;
    
    const subject = `${isUrgent ? 'URGENT: ' : ''}PR ${prNumber} Status Changed: SUBMITTED → REVISION_REQUIRED`;
    
    // Get requestor name and details
    const requestorName = getRequestorName(pr?.requestor);
    const vendorName = await getVendorName(pr);
    
    console.log('Template data:', { 
      requestor: pr?.requestor,
      requestorName,
      vendor: pr?.vendorDetails || pr?.vendor,
      vendorName,
      preferredVendor: pr?.preferredVendor,
      vendorCode: pr?.vendorDetails?.code || pr?.vendor?.code || 'Not specified'
    });

    const requestorDetails = [
      { label: 'Name', value: requestorName },
      { label: 'Email', value: getRequestorEmail(pr?.requestor) },
      { label: 'Department', value: pr?.department || 'Not specified' },
      { label: 'Site', value: pr?.site || 'Not specified' }
    ];

    const prDetails = [
      { label: 'PR Number', value: prNumber },
      { label: 'Category', value: pr?.projectCategory || 'Not specified' },
      { label: 'Expense Type', value: pr?.expenseType || 'Not specified' },
      { label: 'Total Amount', value: pr?.estimatedAmount ? pr?.estimatedAmount.toLocaleString('en-US', { 
        style: 'currency', 
        currency: pr?.currency || 'USD' 
      }) : 'Not specified' },
      { label: 'Vendor', value: pr?.preferredVendor || 'Not specified' },
      { label: 'Required Date', value: formatDate(pr?.requiredDate) },
      { label: 'PR Link', value: prUrl }
    ];

    const html = `
      <div style="${styles.container}">
        ${isUrgent ? `<div style="${styles.urgentBadge}">URGENT</div>` : ''}
        <h2 style="${styles.heading}">Purchase Request #${prNumber} Requires Revision</h2>
        
        <div style="${styles.section}">
          <h3 style="${styles.subheading}">Revision Details</h3>
          <p style="${styles.paragraph}">
            <strong>Reviewer:</strong> ${user?.name || 'System'}
          </p>
          ${notes ? `
            <p style="${styles.paragraph}">
              <strong>Notes:</strong> ${notes}
            </p>
          ` : ''}
        </div>

        <div style="${styles.section}">
          <h3 style="${styles.subheading}">Requestor Information</h3>
          ${generateTable(requestorDetails)}
        </div>

        <div style="${styles.section}">
          <h3 style="${styles.subheading}">PR Details</h3>
          ${generateTable(prDetails)}
        </div>

        <div style="${styles.buttonContainer}">
          <a href="${prUrl}" style="${styles.button}">View Purchase Request</a>
        </div>
      </div>
    `;

    const emailContent: EmailContent = {
      subject,
      text: `PR ${prNumber} Requires Revision\n\nReviewer: ${user?.name || 'System'}\n${notes ? `Notes: ${notes}\n` : ''}\n\nRequestor Information:\n${requestorDetails.map(d => `${d.label}: ${d.value}`).join('\n')}\n\nPR Details:\n${prDetails.map(d => `${d.label}: ${d.value}`).join('\n')}\n\nView PR: ${prUrl}`,
      html,
      headers: generateEmailHeaders({
        to: pr?.requestorEmail || '',
        subject,
        prNumber,
        isHtml: true
      }),
      context: {
        ...context,
        pr,
        metadata: {
          ...context.metadata,
          vendorName
        }
      }
    };

    return emailContent;
  } catch (error) {
    console.error('Error generating revision required email:', error);
    throw error;
  }
}
