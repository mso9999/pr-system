import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { NotificationContext, Recipients, EmailContent, StatusTransitionHandler } from '../types';
import { PRRequest } from '../../../types/pr';

export class RevisionRequiredToRejectedHandler implements StatusTransitionHandler {
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

    // Primary recipient: Requestor
    if (pr.requestor?.email) {
      recipients.to.push(pr.requestor.email);
    } else if (pr.requestorEmail) {
      recipients.to.push(pr.requestorEmail);
    }

    // CC: Procurement team
    const organizationDoc = await getDoc(doc(db, 'referenceData_organizations', pr.organization));
    const procurementEmail = organizationDoc.data()?.procurementEmail || 'procurement@1pwrafrica.com';
    
    if (!recipients.cc) {
      recipients.cc = [];
    }
    recipients.cc.push(procurementEmail);

    return recipients;
  }

  async getEmailContent(context: NotificationContext): Promise<EmailContent> {
    const requestorName = context.pr.requestor?.name || 
                         (context.pr.requestor?.firstName && context.pr.requestor?.lastName 
                          ? `${context.pr.requestor.firstName} ${context.pr.requestor.lastName}` 
                          : context.pr.requestorEmail || 'Requestor');
    
    const subject = `PR ${context.prNumber} Rejected`;
    
    const body = `
Dear ${requestorName},

Your Purchase Request ${context.prNumber}, which was in revision status, has been rejected by the procurement team.

**PR Details:**
- PR Number: ${context.prNumber}
- Description: ${context.pr.description || 'N/A'}
- Estimated Amount: ${context.pr.estimatedAmount ? `${context.pr.estimatedAmount.toLocaleString()} ${context.pr.currency || ''}` : 'N/A'}
- Organization: ${context.pr.organization || 'N/A'}

**Reason for Rejection:**
${context.notes || 'No specific reason provided.'}

**Next Steps:**
If you believe this rejection was made in error, please contact the procurement team to discuss the matter. The PR can be resurrected if needed.

View PR: ${context.prUrl || `[PR Link]`}

Thank you for your understanding.

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


