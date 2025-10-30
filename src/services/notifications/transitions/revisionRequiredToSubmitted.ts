import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { NotificationContext, Recipients, EmailContent, StatusTransitionHandler } from '../types';
import { PRRequest } from '../../../types/pr';

export class RevisionRequiredToSubmittedHandler implements StatusTransitionHandler {
  async getRecipients(context: NotificationContext): Promise<Recipients> {
    const recipients: Recipients = {
      to: [],
      cc: []
    };

    // Get PR data
    const prRef = doc(db, 'purchaseRequests', context.prId);
    const prDoc = await getDoc(prRef);
    
    if (!prDoc.exists()) {
      throw new Error('PR not found');
    }

    const pr = prDoc.data() as PRRequest;

    // Primary recipient: Procurement team
    const organizationDoc = await getDoc(doc(db, 'referenceData_organizations', pr.organization));
    const procurementEmail = organizationDoc.data()?.procurementEmail || 'procurement@1pwrafrica.com';
    
    recipients.to.push(procurementEmail);

    // CC: Requestor
    if (pr.requestor?.email) {
      if (!recipients.cc) {
        recipients.cc = [];
      }
      recipients.cc.push(pr.requestor.email);
    }

    return recipients;
  }

  async getEmailContent(context: NotificationContext): Promise<EmailContent> {
    const subject = `PR ${context.prNumber} Resubmitted After Revision`;
    
    const body = `
PR ${context.prNumber} has been resubmitted by the requestor after addressing revision requests.

**PR Details:**
- PR Number: ${context.prNumber}
- Requestor: ${context.pr.requestor?.name || context.pr.requestorEmail || 'Unknown'}
- Description: ${context.pr.description || 'N/A'}
- Estimated Amount: ${context.pr.estimatedAmount ? `${context.pr.estimatedAmount.toLocaleString()} ${context.pr.currency || ''}` : 'N/A'}
- Organization: ${context.pr.organization || 'N/A'}

**Requestor Notes:**
${context.notes || 'No notes provided'}

**Next Steps:**
Please review the resubmitted PR and take appropriate action (move to queue, request additional revision, or reject).

View PR: ${context.prUrl || `[PR Link]`}

Best regards,
PR System
    `.trim();

    return {
      subject,
      body,
      isHtml: false
    };
  }
}


