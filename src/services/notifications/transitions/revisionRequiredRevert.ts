import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { NotificationContext, Recipients, EmailContent, StatusTransitionHandler } from '../types';
import { PRRequest } from '../../../types/pr';
import { PRStatus } from '../../../types/pr';

/**
 * Handler for when procurement reverts a PR from REVISION_REQUIRED back to its previous status
 * This can be any status: SUBMITTED, RESUBMITTED, IN_QUEUE, or PENDING_APPROVAL
 */
export class RevisionRequiredRevertHandler implements StatusTransitionHandler {
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

    // Primary recipient: Requestor (they need to know the revision is no longer needed)
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
    const statusLabel = this.getStatusLabel(context.newStatus);
    const subject = `PR ${context.prNumber} Reverted to ${statusLabel}`;
    
    const body = `
Your Purchase Request ${context.prNumber} has been reverted from REVISION_REQUIRED back to ${statusLabel} status by the procurement team.

**PR Details:**
- PR Number: ${context.prNumber}
- Description: ${context.pr.description || 'N/A'}
- Estimated Amount: ${context.pr.estimatedAmount ? `${context.pr.estimatedAmount.toLocaleString()} ${context.pr.currency || ''}` : 'N/A'}
- Organization: ${context.pr.organization || 'N/A'}
- New Status: ${statusLabel}

**Reason for Revert:**
${context.notes || 'The procurement team determined that the revision request was no longer necessary.'}

**What This Means:**
The revision that was previously requested is no longer needed. Your PR will continue processing from its previous status.

${this.getNextStepsMessage(context.newStatus)}

View PR: ${context.prUrl || `[PR Link]`}

Best regards,
Procurement Team
    `.trim();

    return {
      subject,
      body,
      isHtml: false
    };
  }

  private getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      [PRStatus.SUBMITTED]: 'SUBMITTED',
      [PRStatus.RESUBMITTED]: 'RESUBMITTED',
      [PRStatus.IN_QUEUE]: 'IN QUEUE',
      [PRStatus.PENDING_APPROVAL]: 'PENDING APPROVAL'
    };
    return labels[status] || status;
  }

  private getNextStepsMessage(status: string): string {
    switch (status) {
      case PRStatus.SUBMITTED:
      case PRStatus.RESUBMITTED:
        return '**Next Steps:** Procurement will review your PR and move it forward in the workflow.';
      case PRStatus.IN_QUEUE:
        return '**Next Steps:** Your PR is in the procurement queue and will be prepared for approval.';
      case PRStatus.PENDING_APPROVAL:
        return '**Next Steps:** Your PR is awaiting approval from the designated approver(s).';
      default:
        return '**Next Steps:** Your PR will continue processing.';
    }
  }
}


