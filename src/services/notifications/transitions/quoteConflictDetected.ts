import { NotificationHandler, NotificationContext, NotificationRecipients } from '../types';
import { prService } from '@/services/pr';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '@/config/firebase';

/**
 * Handler for Quote Conflict Detection in PENDING_APPROVAL
 * 
 * This occurs when both approvers have approved a PR but selected different quotes.
 * The PR stays in PENDING_APPROVAL status but is red-flagged with quoteConflict flag.
 * Daily reminders will be sent until resolved.
 * 
 * Recipients:
 * - TO: Both approvers (need to resolve the conflict)
 * - CC: Procurement (needs to be aware of the conflict)
 * - CC: Requestor (informational)
 */
export class QuoteConflictDetectedHandler implements NotificationHandler {
  canHandle(context: NotificationContext): boolean {
    // Detect quote conflict by checking for special prefix in notes
    return context.fromStatus === 'PENDING_APPROVAL' && 
           context.toStatus === 'PENDING_APPROVAL' &&
           context.notes?.startsWith('QUOTE_CONFLICT:');
  }

  async getRecipients(context: NotificationContext): Promise<NotificationRecipients> {
    // Fetch the PR to get approver info
    const pr = await prService.getPR(context.prId);
    
    console.log('QuoteConflictDetected: Fetched PR data', {
      prId: context.prId,
      approver: pr?.approver || '(not set)',
      approver2: pr?.approver2 || '(not set)',
      firstSelectedQuote: pr?.approvalWorkflow?.firstApproverSelectedQuoteId || '(not set)',
      secondSelectedQuote: pr?.approvalWorkflow?.secondApproverSelectedQuoteId || '(not set)',
      quoteConflict: pr?.approvalWorkflow?.quoteConflict
    });

    if (!pr) {
      console.error('QuoteConflictDetected: PR not found:', context.prId);
      return { to: [], cc: [] };
    }

    const recipients: string[] = [];
    const ccList: string[] = [];

    // Helper function to get user email from ID
    const getUserEmail = async (userId: string): Promise<string | null> => {
      try {
        // Check if already an email
        if (userId.includes('@')) {
          return userId;
        }

        // Fetch from users collection
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          const email = userDoc.data().email;
          return email || null;
        }

        return null;
      } catch (error) {
        console.error(`Error fetching email for user ${userId}:`, error);
        return null;
      }
    };

    // Add both approvers to TO list (they need to resolve the conflict)
    if (pr.approver) {
      const approver1Email = await getUserEmail(pr.approver);
      if (approver1Email) {
        recipients.push(approver1Email);
        console.log('QuoteConflictDetected: Resolved approver 1', {
          approverId: pr.approver,
          approverEmail: approver1Email
        });
      } else {
        console.warn('QuoteConflictDetected: Could not resolve approver 1 email:', pr.approver);
      }
    }

    if (pr.approver2) {
      const approver2Email = await getUserEmail(pr.approver2);
      if (approver2Email) {
        recipients.push(approver2Email);
        console.log('QuoteConflictDetected: Resolved approver 2', {
          approverId: pr.approver2,
          approverEmail: approver2Email
        });
      } else {
        console.warn('QuoteConflictDetected: Could not resolve approver 2 email:', pr.approver2);
      }
    }

    // Add procurement to CC
    const procurementEmail = 'procurement@1pwrafrica.com'; // TODO: Get from org config
    ccList.push(procurementEmail);

    // Add requestor to CC
    const requestorEmail = pr.requestorEmail || pr.requestor?.email;
    if (requestorEmail) {
      ccList.push(requestorEmail);
    }

    console.log('QuoteConflictDetected: Final recipients', {
      to: recipients,
      cc: ccList,
      toCount: recipients.length,
      ccCount: ccList.length
    });

    return {
      to: recipients,
      cc: ccList
    };
  }

  getSubject(context: NotificationContext): string {
    return `🚩 ACTION REQUIRED: Quote Conflict - PR ${context.prNumber || context.prId} Needs Agreement`;
  }

  async getEmailBody(context: NotificationContext): Promise<string> {
    const pr = await prService.getPR(context.prId);
    
    if (!pr) {
      return 'PR details unavailable.';
    }

    // Get quote details
    const firstQuoteId = pr.approvalWorkflow?.firstApproverSelectedQuoteId;
    const secondQuoteId = pr.approvalWorkflow?.secondApproverSelectedQuoteId;
    
    const firstQuote = pr.quotes?.find(q => q.id === firstQuoteId);
    const secondQuote = pr.quotes?.find(q => q.id === secondQuoteId);

    // Get approver names
    const getApproverName = async (approverId: string | undefined): Promise<string> => {
      if (!approverId) return 'Unknown';
      try {
        const userDoc = await getDoc(doc(db, 'users', approverId));
        if (userDoc.exists()) {
          const data = userDoc.data();
          return `${data.firstName} ${data.lastName}` || data.email || 'Unknown';
        }
      } catch (error) {
        console.error('Error fetching approver name:', error);
      }
      return 'Unknown';
    };

    const approver1Name = await getApproverName(pr.approver);
    const approver2Name = await getApproverName(pr.approver2);

    return `
<h2>🚩 Quote Selection Conflict Detected</h2>

<p><strong>Both approvers have approved Purchase Request ${pr.prNumber}, but they have selected different quotes for approval.</strong></p>

<div style="background-color: #fff3cd; border: 2px solid #ff9800; border-radius: 5px; padding: 15px; margin: 20px 0;">
  <h3 style="color: #d32f2f; margin-top: 0;">⚠️ RED FLAGGED - ACTION REQUIRED</h3>
  <p>This PR cannot proceed until both approvers agree on the same quote.</p>
</div>

<h3>PR Details:</h3>
<ul>
  <li><strong>PR Number:</strong> ${pr.prNumber}</li>
  <li><strong>Description:</strong> ${pr.description || 'N/A'}</li>
  <li><strong>Amount Range:</strong> ${pr.estimatedAmount} ${pr.estimatedAmountCurrency}</li>
  <li><strong>Organization:</strong> ${pr.organization}</li>
</ul>

<h3>Conflicting Quote Selections:</h3>
<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
  <tr style="background-color: #f5f5f5;">
    <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Approver</th>
    <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Selected Quote</th>
    <th style="border: 1px solid #ddd; padding: 12px; text-align: right;">Amount</th>
  </tr>
  <tr>
    <td style="border: 1px solid #ddd; padding: 12px;">${approver1Name}</td>
    <td style="border: 1px solid #ddd; padding: 12px;">${firstQuote?.vendorName || 'Unknown'}</td>
    <td style="border: 1px solid #ddd; padding: 12px; text-align: right;">${firstQuote?.amount.toFixed(2)} ${firstQuote?.currency}</td>
  </tr>
  <tr>
    <td style="border: 1px solid #ddd; padding: 12px;">${approver2Name}</td>
    <td style="border: 1px solid #ddd; padding: 12px;">${secondQuote?.vendorName || 'Unknown'}</td>
    <td style="border: 1px solid #ddd; padding: 12px; text-align: right;">${secondQuote?.amount.toFixed(2)} ${secondQuote?.currency}</td>
  </tr>
</table>

<h3>How to Resolve:</h3>
<ol>
  <li>Review the PR and all quote details</li>
  <li>Discuss and reach consensus on which quote to approve</li>
  <li><strong>One or both approvers must change their quote selection</strong> to match</li>
  <li>Open the PR and click "Approve" to update your selection</li>
  <li>Once both approvers select the same quote, the PR will automatically proceed to APPROVED</li>
</ol>

<p><strong style="color: #d32f2f;">⚠️ This PR is currently ON HOLD and red-flagged until the conflict is resolved.</strong></p>

<p style="background-color: #ffe0e0; padding: 10px; border-radius: 5px;">
  <strong>📅 Reminder:</strong> You will receive daily reminder emails until this conflict is resolved.
</p>

<p style="margin-top: 30px;">
  <a href="${window.location.origin}/pr/${context.prId}" style="background-color: #1976d2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
    View PR and Resolve Conflict
  </a>
</p>

<p style="margin-top: 30px; color: #666; font-size: 12px;">
  This is an automated notification from the 1PWR Purchase Request System.
</p>
    `.trim();
  }
}


