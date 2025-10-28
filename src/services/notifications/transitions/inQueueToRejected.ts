import { StatusTransitionHandler, NotificationContext, EmailContent } from '../types';
import { PRStatus } from '../../../types/pr';

export class InQueueToRejectedHandler implements StatusTransitionHandler {
  async getRecipients(context: NotificationContext): Promise<string[]> {
    const recipients: string[] = [];
    
    // Primary recipient: Requestor
    if (context.pr.requestorEmail) {
      recipients.push(context.pr.requestorEmail);
    }
    
    // CC: Procurement team (always)
    if (context.pr.organization) {
      recipients.push('procurement@1pwrafrica.com');
    }
    
    return recipients;
  }

  async getEmailContent(context: NotificationContext): Promise<EmailContent> {
    const requestorName = context.pr.requestorName || 
                         (context.pr.requestorFirstName && context.pr.requestorLastName 
                          ? `${context.pr.requestorFirstName} ${context.pr.requestorLastName}` 
                          : context.pr.requestorEmail || 'Requestor');
    
    const subject = `PR ${context.prNumber} Rejected`;
    
    const body = `
Dear ${requestorName},

Your Purchase Request ${context.prNumber} has been rejected by the procurement team.

**PR Details:**
- PR Number: ${context.prNumber}
- Description: ${context.pr.description || 'N/A'}
- Estimated Amount: ${context.pr.estimatedAmount ? `$${context.pr.estimatedAmount.toLocaleString()}` : 'N/A'}
- Organization: ${context.pr.organization || 'N/A'}

**Reason for Rejection:**
${context.notes || 'No specific reason provided.'}

**Next Steps:**
If you believe this rejection was made in error, please contact the procurement team to discuss the matter. The PR can be resurrected if needed.

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


