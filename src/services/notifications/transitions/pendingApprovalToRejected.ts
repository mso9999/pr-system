import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { StatusTransitionHandler, NotificationContext, Recipients, EmailContent } from '../types';
import { getBaseUrl } from '../../../utils/environment';

export class PendingApprovalToRejectedHandler implements StatusTransitionHandler {
  async getRecipients(context: NotificationContext): Promise<Recipients> {
    const { prId } = context;
    const recipients: Recipients = {
      to: [], // Will be filled with requestor
      cc: ['procurement@1pwrafrica.com'] // Procurement team always in CC
    };

    // Get PR data to find requestor
    const prRef = doc(db, 'purchaseRequests', prId);
    const prDoc = await getDoc(prRef);
    
    if (!prDoc.exists()) {
      throw new Error('PR not found');
    }

    const pr = prDoc.data();

    // Add requestor as primary recipient
    if (pr.requestor?.email) {
      recipients.to.push(pr.requestor.email);
    }

    return recipients;
  }

  async getEmailContent(context: NotificationContext): Promise<EmailContent> {
    const { prNumber, user, notes, prId } = context;
    const userName = user ? `${user.firstName} ${user.lastName}`.trim() : 'System';
    // Always use production URL for notifications
    const baseUrl = 'https://pr.1pwrafrica.com';

    const subject = `PR #${prNumber} Rejected`;
    const text = `Your PR #${prNumber} has been rejected by ${userName}.\n` +
      (notes ? `Reason: ${notes}\n` : '') +
      `View PR at: ${baseUrl}/pr/${prId}`;

    const html = `
      <h2>PR #${prNumber} Rejected</h2>
      <p>Your purchase request has been rejected by ${userName}.</p>
      ${notes ? `<p><strong>Reason:</strong> ${notes}</p>` : ''}
      <p><a href="${baseUrl}/pr/${prId}" style="display: inline-block; padding: 10px 20px; background-color: #dc3545; color: white; text-decoration: none; border-radius: 5px;">View PR Details</a></p>
    `;

    return { subject, text, html };
  }
}
