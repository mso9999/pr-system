import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { NotificationContext, Recipients, EmailContent, StatusTransitionHandler } from '../types';
import { getBaseUrl } from '../../../utils/environment';
import { generatePendingApprovalEmail } from '../templates/pendingApprovalTemplate';
import { PRRequest } from '../../../types/pr';
import { generateEmailHeaders } from '../types/emailHeaders';

// Helper function to fetch user email from Firestore
async function getUserEmail(userIdOrEmail: string): Promise<string | null> {
  try {
    // Check if it's already an email (contains @)
    if (userIdOrEmail.includes('@')) {
      return userIdOrEmail;
    }
    
    // Otherwise, fetch from users collection
    const userDoc = await getDoc(doc(db, 'users', userIdOrEmail));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      return userData.email || null;
    }
    
    console.warn(`User with ID ${userIdOrEmail} not found`);
    return null;
  } catch (error) {
    console.error(`Error fetching user email for ${userIdOrEmail}:`, error);
    return null;
  }
}

export class InQueueToPendingApprovalHandler implements StatusTransitionHandler {
  async getRecipients(context: NotificationContext): Promise<Recipients> {
    const recipients: Recipients = {
      to: [],
      cc: []
    };

    // Get PR data to find approver and requestor
    const prRef = doc(db, 'purchaseRequests', context.prId);
    const prDoc = await getDoc(prRef);
    
    if (!prDoc.exists()) {
      throw new Error('PR not found');
    }

    const pr = prDoc.data() as PRRequest;

    console.log('InQueueToPendingApproval: Fetched PR data', {
      prId: context.prId,
      approver: pr.approver || '(not set)',
      approver2: pr.approver2 || '(not set)',
      approvalWorkflow: pr.approvalWorkflow ? {
        currentApprover: pr.approvalWorkflow.currentApprover || '(not set)',
        secondApprover: pr.approvalWorkflow.secondApprover || '(not set)'
      } : '(not set)'
    });

    // Add current approver(s) as primary recipient(s)
    // For dual approval (high-value PRs), both approvers should receive the notification
    
    // Resolve primary approver
    let approverEmail: string | null = null;
    if (pr.approver) {
      // According to PR type definition, approver is a string (email or user ID)
      approverEmail = await getUserEmail(pr.approver);
      console.log('InQueueToPendingApproval: Resolved primary approver', {
        approverId: pr.approver,
        approverEmail: approverEmail || '(not found)'
      });
      if (approverEmail) {
        recipients.to.push(approverEmail);
      }
    } 
    // Fallback to approvalWorkflow.currentApprover only if pr.approver is not available
    else if (pr.approvalWorkflow?.currentApprover) {
      // Handle currentApprover which could be a string or an object
      if (typeof pr.approvalWorkflow.currentApprover === 'string') {
        approverEmail = await getUserEmail(pr.approvalWorkflow.currentApprover);
        if (approverEmail) {
          recipients.to.push(approverEmail);
        }
      } else if (typeof pr.approvalWorkflow.currentApprover === 'object' && pr.approvalWorkflow.currentApprover?.email) {
        recipients.to.push(pr.approvalWorkflow.currentApprover.email);
      }
    }

    // Resolve second approver for dual approval scenarios (high-value PRs above Rule 3)
    let approver2Email: string | null = null;
    if (pr.approver2) {
      approver2Email = await getUserEmail(pr.approver2);
      console.log('InQueueToPendingApproval: Resolved second approver', {
        approver2Id: pr.approver2,
        approver2Email: approver2Email || '(not found)'
      });
      if (approver2Email) {
        recipients.to.push(approver2Email);
      }
    } 
    // Fallback to approvalWorkflow.secondApprover
    else if (pr.approvalWorkflow?.secondApprover) {
      if (typeof pr.approvalWorkflow.secondApprover === 'string') {
        approver2Email = await getUserEmail(pr.approvalWorkflow.secondApprover);
        if (approver2Email) {
          recipients.to.push(approver2Email);
        }
      } else if (typeof pr.approvalWorkflow.secondApprover === 'object' && pr.approvalWorkflow.secondApprover?.email) {
        recipients.to.push(pr.approvalWorkflow.secondApprover.email);
      }
    }

    // Add requestor in CC
    if (pr.requestor?.email) {
      if (!recipients.cc) {
        recipients.cc = [];
      }
      recipients.cc.push(pr.requestor.email);
    }

    // Add procurement team to CC
    if (!recipients.cc) {
      recipients.cc = [];
    }
    recipients.cc.push('procurement@1pwrafrica.com');

    console.log('InQueueToPendingApproval: Final recipients', {
      to: recipients.to,
      cc: recipients.cc,
      toCount: recipients.to.length,
      ccCount: recipients.cc?.length || 0
    });

    return recipients;
  }

  async getEmailContent(context: NotificationContext): Promise<EmailContent> {
    // Make sure we have a PR object in the context
    if (!context.pr) {
      // Fetch PR data if not provided in context
      const prRef = doc(db, 'purchaseRequests', context.prId);
      const prDoc = await getDoc(prRef);
      
      if (!prDoc.exists()) {
        throw new Error('PR not found');
      }
      
      // Add PR data to context
      const prData = prDoc.data() as PRRequest;
      context.pr = {
        ...prData,
        id: prDoc.id
      };
    }
    
    // Ensure baseUrl is set
    if (!context.baseUrl) {
      context.baseUrl = getBaseUrl();
    }
    
    // Convert to template-compatible format
    const templateContext = {
      pr: {
        id: context.pr.id,
        prNumber: context.pr.prNumber,
        requestor: context.pr.requestor,
        site: context.pr.site,
        category: context.pr.category,
        expenseType: context.pr.expenseType,
        estimatedAmount: context.pr.estimatedAmount,
        currency: context.pr.currency,
        preferredVendor: context.pr.preferredVendor,
        requiredDate: context.pr.requiredDate,
        isUrgent: context.pr.isUrgent
      },
      prNumber: context.prNumber,
      user: context.user ? {
        firstName: context.user.firstName || '',
        lastName: context.user.lastName || '',
        email: context.user.email,
        name: context.user.name || `${context.user.firstName || ''} ${context.user.lastName || ''}`.trim()
      } : null,
      notes: context.notes,
      baseUrl: context.baseUrl,
      isUrgent: context.isUrgent || false
    };
    
    // Get email content from template
    const emailContent = generatePendingApprovalEmail(templateContext);
    
    // Convert to service-compatible format
    return {
      subject: emailContent.subject,
      text: emailContent.text,
      html: emailContent.html,
      headers: generateEmailHeaders({
        prId: context.prId,
        prNumber: context.prNumber,
        subject: emailContent.subject,
        notificationType: 'PENDING_APPROVAL'
      })
    };
  }
}
