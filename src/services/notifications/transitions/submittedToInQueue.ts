import { StatusTransitionHandler, NotificationContext, EmailContent } from '../types';
import { PRStatus } from '../../../types/pr';

export class SubmittedToInQueueHandler implements StatusTransitionHandler {
  async getRecipients(context: NotificationContext): Promise<string[]> {
    const recipients: string[] = [];
    
    // Primary recipient: Requestor
    if (context.pr.requestorEmail) {
      recipients.push(context.pr.requestorEmail);
    }
    
    // CC: Procurement team (always)
    if (context.pr.organization) {
      // Get procurement email from organization
      // This would need to be fetched from the organization data
      // For now, we'll use a placeholder
      recipients.push('procurement@1pwrafrica.com');
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




