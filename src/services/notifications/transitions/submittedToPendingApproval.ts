import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { StatusTransitionHandler, NotificationContext, Recipients, EmailContent } from '../types';
import { getBaseUrl } from '../../../utils/environment';

export class SubmittedToPendingApprovalHandler implements StatusTransitionHandler {
  async getRecipients(context: NotificationContext): Promise<Recipients> {
    const { prId } = context;
    const recipients: Recipients = {
      to: [], // Will be filled with approver
      cc: [] // Will be filled with requestor and procurement
    };

    // Get PR data to find approver and requestor
    const prRef = doc(db, 'purchaseRequests', prId);
    const prDoc = await getDoc(prRef);
    
    if (!prDoc.exists()) {
      throw new Error('PR not found');
    }

    const pr = prDoc.data();

    // Add current approver as primary recipient - prioritize pr.approver as the single source of truth
    if (pr.approver) {
      // If approver is an object with email
      if (typeof pr.approver === 'object' && pr.approver?.email) {
        recipients.to.push(pr.approver.email);
      } 
      // If approver is a string and looks like an email
      else if (typeof pr.approver === 'string' && pr.approver.includes('@')) {
        recipients.to.push(pr.approver);
      }
      // If approver is just an ID, we'll need to fetch the user details
      else {
        // This would require additional code to fetch user details by ID
        console.log('Approver ID found, but email not available directly:', pr.approver);
      }
    }
    // Fallback to approvalWorkflow.currentApprover only if pr.approver is not available
    else if (pr.approvalWorkflow?.currentApprover?.email) {
      recipients.to.push(pr.approvalWorkflow.currentApprover.email);
    }

    // Add requestor to CC - check multiple possible locations for the email
    // First try the requestor object structure
    if (pr.requestor?.email) {
      recipients.cc?.push(pr.requestor.email);
    } 
    // Then try the requestorEmail field directly
    else if (pr.requestorEmail) {
      recipients.cc?.push(pr.requestorEmail);
    }
    
    // Ensure we always have the requestor email
    if (recipients.cc?.length === 0 && pr.requestor) {
      // Last resort - try to extract email from the requestor string if it's an email format
      const requestorString = pr.requestor.toString();
      if (requestorString.includes('@')) {
        recipients.cc?.push(requestorString);
      }
    }

    // Add procurement to CC
    if (!recipients.cc) {
      recipients.cc = [];
    }
    recipients.cc.push('procurement@1pwrafrica.com');

    // Log the recipients for debugging
    console.log('Notification recipients for pending approval:', {
      to: recipients.to,
      cc: recipients.cc,
      pr: {
        id: prId,
        approver: pr.approver,
        requestor: pr.requestor
      }
    });

    return recipients;
  }

  async getEmailContent(context: NotificationContext): Promise<EmailContent> {
    const { pr } = context;
    
    if (!pr) {
      throw new Error('PR data is missing in notification context');
    }

    const baseUrl = getBaseUrl();
    // Always use production URL for notifications
    const prViewUrl = `https://pr.1pwrafrica.com/pr/${pr.id}`;
    
    return {
      subject: `PR #${pr.prNumber} - Pending Your Approval`,
      text: `A purchase request requires your approval. PR #${pr.prNumber} has been submitted and is pending your review. Please log in to the system to approve or request revisions: ${prViewUrl}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
          <h2>Purchase Request Pending Approval</h2>
          <p>Dear Approver,</p>
          <p>A purchase request requires your approval:</p>
          <ul>
            <li><strong>PR Number:</strong> ${pr.prNumber}</li>
            <li><strong>Requestor:</strong> ${pr.requestor?.name || pr.requestor?.email || 'Unknown'}</li>
            <li><strong>Department:</strong> ${pr.department || 'Not specified'}</li>
            <li><strong>Description:</strong> ${pr.description || 'Not provided'}</li>
            <li><strong>Total Amount:</strong> ${pr.currency || '$'} ${pr.totalAmount?.toFixed(2) || 'Not specified'}</li>
          </ul>
          <p>Please <a href="${prViewUrl}">click here</a> to review, approve, or request revisions for this purchase request.</p>
          <p>Thank you,<br>1PWR System</p>
        </div>
      `
    };
  }
}
