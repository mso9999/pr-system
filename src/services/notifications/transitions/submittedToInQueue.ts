import { StatusTransitionHandler, NotificationContext, EmailContent, Recipients } from '../types';
import { PRStatus } from '../../../types/pr';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/config/firebase';

const DEFAULT_PROCUREMENT_EMAIL = 'procurement@1pwrafrica.com';

/**
 * Fetches the organization's procurement email from Firestore
 * Falls back to default if not found or on error
 */
async function getProcurementEmail(organizationName: string): Promise<string> {
  try {
    if (!organizationName) {
      console.warn('No organization name provided, using default procurement email');
      return DEFAULT_PROCUREMENT_EMAIL;
    }

    // Normalize organization name to ID format (e.g., "1PWR BENIN" -> "1pwr_benin")
    const orgId = organizationName.toLowerCase().replace(/\s+/g, '_');
    
    console.log(`[SubmittedToInQueue] Fetching procurement email for organization: ${organizationName} (ID: ${orgId})`);
    
    // Try to find organization by ID first
    const orgRef = doc(db, 'organizations', orgId);
    const orgDoc = await getDoc(orgRef);
    
    if (orgDoc.exists()) {
      const orgData = orgDoc.data();
      if (orgData.procurementEmail) {
        console.log(`[SubmittedToInQueue] Found procurement email for ${organizationName}: ${orgData.procurementEmail}`);
        return orgData.procurementEmail;
      }
    }
    
    // If not found by ID, try querying by name
    const orgsRef = collection(db, 'organizations');
    const orgsQuery = query(orgsRef, where('name', '==', organizationName));
    const orgsSnapshot = await getDocs(orgsQuery);
    
    if (!orgsSnapshot.empty) {
      const orgData = orgsSnapshot.docs[0].data();
      if (orgData.procurementEmail) {
        console.log(`[SubmittedToInQueue] Found procurement email for ${organizationName} (by name): ${orgData.procurementEmail}`);
        return orgData.procurementEmail;
      }
    }
    
    console.warn(`[SubmittedToInQueue] No procurement email found for organization: ${organizationName}, using default: ${DEFAULT_PROCUREMENT_EMAIL}`);
    return DEFAULT_PROCUREMENT_EMAIL;
  } catch (error) {
    console.error('[SubmittedToInQueue] Error fetching organization procurement email:', error);
    console.warn(`[SubmittedToInQueue] Using default procurement email due to error: ${DEFAULT_PROCUREMENT_EMAIL}`);
    return DEFAULT_PROCUREMENT_EMAIL;
  }
}

export class SubmittedToInQueueHandler implements StatusTransitionHandler {
  async getRecipients(context: NotificationContext): Promise<Recipients> {
    const recipients: Recipients = {
      to: [],
      cc: []
    };
    
    // Primary recipient: Requestor
    if (context.pr.requestorEmail) {
      recipients.to.push(context.pr.requestorEmail);
    }
    
    // CC: Procurement team (organization-specific)
    if (context.pr.organization) {
      const procurementEmail = await getProcurementEmail(context.pr.organization);
      recipients.cc.push(procurementEmail);
      console.log(`[SubmittedToInQueue] Recipients: TO=${recipients.to.join(', ')}, CC=${recipients.cc.join(', ')}`);
    }
    
    return recipients;
  }

  async getEmailContent(context: NotificationContext): Promise<EmailContent> {
    const requestorName = context.pr.requestorName || 
                         (context.pr.requestorFirstName && context.pr.requestorLastName 
                          ? `${context.pr.requestorFirstName} ${context.pr.requestorLastName}` 
                          : context.pr.requestorEmail || 'Requestor');
    
    const subject = `PR ${context.prNumber} Moved to Queue for Processing`;
    
    const body = `
Dear ${requestorName},

Your Purchase Request ${context.prNumber} has been moved to the processing queue by the procurement team.

**PR Details:**
- PR Number: ${context.prNumber}
- Description: ${context.pr.description || 'N/A'}
- Estimated Amount: ${context.pr.estimatedAmount ? `$${context.pr.estimatedAmount.toLocaleString()}` : 'N/A'}
- Organization: ${context.pr.organization || 'N/A'}

**Next Steps:**
The procurement team will now:
1. Review your request
2. Obtain required quotes (if needed)
3. Assign appropriate approvers
4. Move the PR to pending approval

You will receive another notification when the PR is ready for approval or if any additional information is needed.

Thank you for your patience.

Best regards,
Procurement Team
    `.trim();

    return {
      subject,
      body,
      isHtml: false
    };
  }
}














