import { StatusTransitionHandler, NotificationContext, EmailContent } from '../types';
import { PRStatus } from '../../../types/pr';

export class InQueueToRevisionRequiredHandler implements StatusTransitionHandler {
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
    
    const subject = `PR ${context.prNumber} Requires Revision`;
    
    const body = `
Dear ${requestorName},

Your Purchase Request ${context.prNumber} requires revision before it can proceed to approval.

**PR Details:**
- PR Number: ${context.prNumber}
- Description: ${context.pr.description || 'N/A'}
- Estimated Amount: ${context.pr.estimatedAmount ? `$${context.pr.estimatedAmount.toLocaleString()}` : 'N/A'}
- Organization: ${context.pr.organization || 'N/A'}

**Required Changes:**
${context.notes || 'Please review the PR and make the necessary corrections.'}

**Next Steps:**
1. Log into the PR system
2. Navigate to your PR ${context.prNumber}
3. Make the requested changes
4. Resubmit the PR for processing

The PR will return to the procurement team for review once you have made the necessary revisions.

Thank you for your attention to this matter.

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





