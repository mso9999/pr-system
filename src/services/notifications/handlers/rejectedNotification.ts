import { httpsCallable } from 'firebase/functions';
import { functions } from '@/config/firebase';
import { NotificationContext, EmailContent, PRRequestor } from '../templates/types';
import { generateRejectedEmail } from '../templates/rejectedTemplate';
// import { logger } from '@/utils/logger';

// Define a constant for the procurement team email
const PROCUREMENT_EMAIL = 'procurement@1pwrafrica.com';

// Extended NotificationContext with additional properties needed for rejection
interface RejectionContext extends NotificationContext {
  oldStatus?: string;
}

/**
 * Handles sending notifications for PR rejection
 */
export async function rejectedNotification(context: RejectionContext): Promise<boolean> {
  try {
    // Check if we have a valid PR
    if (!context.pr || !context.pr.id) {
      console.warn('No valid PR provided for notification', { 
        prNumber: context.prNumber 
      });
      return false;
    }

    // Get the recipients
    const recipients = getRecipients(context);
    if (!recipients.to || recipients.to.length === 0) {
      console.warn('No recipients found for PR notification', {
        prId: context.pr.id,
        prNumber: context.prNumber
      });
      return false;
    }

    // Get the name of the requestor
    let requestorName = 'Requestor';
    if (context.pr.requestor) {
      // Handle requestor as either string or object
      if (typeof context.pr.requestor === 'string') {
        requestorName = context.pr.requestor;
      } else {
        // Handle requestor as PRRequestor object
        const requestor = context.pr.requestor as PRRequestor & { name?: string };
        
        if (requestor.name) {
          requestorName = requestor.name;
        } else if (requestor.firstName || requestor.lastName) {
          requestorName = `${requestor.firstName || ''} ${requestor.lastName || ''}`.trim();
        } else if (requestor.email) {
          requestorName = requestor.email;
        }
      }
    }

    // Generate the email content
    const emailContent = generateEmailContent(context);

    // Send the notification
    try {
      const sendPRNotificationV2 = httpsCallable(functions, 'sendPRNotificationV2');
      
      await sendPRNotificationV2({
        notification: {
          type: 'PR_REJECTED',
          prId: context.pr.id,
          prNumber: context.prNumber || '',
          oldStatus: context.oldStatus || null,
          newStatus: 'REJECTED',
          metadata: {
            isUrgent: context.isUrgent,
            requestorEmail: context.pr?.requestor?.email || '',
            requestorName: requestorName
          }
        },
        recipients: recipients.to,
        cc: recipients.cc,
        emailBody: {
          subject: emailContent.subject,
          text: emailContent.text,
          html: emailContent.html
        }
      });

      console.info('PR rejection notification sent successfully', {
        prId: context.pr.id,
        prNumber: context.prNumber,
        recipients: recipients.to,
        cc: recipients.cc
      });

      return true;
    } catch (error) {
      console.error('Error sending PR rejection notification', error);
      return false;
    }
  } catch (error) {
    console.error('Error in rejectedNotification', error);
    return false;
  }
}

/**
 * Get the recipients for the rejection notification
 */
function getRecipients(context: RejectionContext): { to: string[], cc: string[] } {
  const to: string[] = [];
  const ccList = new Set<string>();

  // Primary recipient is the requestor
  const requestorEmail = context.pr?.requestor?.email || '';
  if (requestorEmail) {
    to.push(requestorEmail.toLowerCase());
  }

  // Add the procurement team to CC
  ccList.add(PROCUREMENT_EMAIL.toLowerCase());

  // Add the user who rejected the PR to CC if they're not already in the recipients
  if (context.user?.email) {
    const userEmail = context.user.email.toLowerCase();
    if (!to.includes(userEmail) && !ccList.has(userEmail)) {
      ccList.add(userEmail);
    }
  }

  // Convert CC set to array
  return {
    to,
    cc: Array.from(ccList)
  };
}

/**
 * Generate the email content for the rejection notification
 */
function generateEmailContent(context: RejectionContext): EmailContent {
  // Get the name of the user who rejected the PR
  let rejectorName = 'System';
  if (context.user) {
    if (context.user.name) {
      rejectorName = context.user.name;
    } else if (context.user.firstName || context.user.lastName) {
      rejectorName = `${context.user.firstName || ''} ${context.user.lastName || ''}`.trim();
    } else if (context.user.email) {
      rejectorName = context.user.email;
    }
  }

  // Generate the email content
  return generateRejectedEmail({
    pr: context.pr,
    prNumber: context.prNumber,
    baseUrl: context.baseUrl,
    user: context.user,
    notes: context.notes || '',
    isUrgent: context.isUrgent
  });
}
