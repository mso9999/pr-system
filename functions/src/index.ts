import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { sendEmail } from './utils/emailSender';

// Version information
const BACKEND_VERSION = '1.0.0';
console.log('=== Firebase Functions Initializing ===');
console.log(`Backend Version: ${BACKEND_VERSION}`);
console.log(`Initialization Date: ${new Date().toISOString()}`);

// Initialize Firebase
admin.initializeApp();
const db = admin.firestore();
const serverTimestamp = admin.firestore.FieldValue.serverTimestamp;

// Import scheduled functions
export { dailyVendorExpiryCheck } from './scheduledVendorExpiryCheck';
export { dailyReminders, urgentReminders, deliveryDelayCheck } from './scheduledReminders';
export { sendDailyQuoteConflictReminders } from './scheduled/sendDailyQuoteConflictReminders';

// Export user management functions
export { updateUserPassword } from './updateUserPassword';
export { createUser } from './createUser';

// Helper function to ensure requestor name is properly set
function ensureRequestorName(user: any, requestorEmail?: string): string {
    console.log('ensureRequestorName input:', { user, requestorEmail });
    
    // Check if user object has requestor property (from the PR form)
    if (user?.requestor) {
        if (typeof user.requestor === 'string' && user.requestor) {
            console.log('Using user.requestor string:', user.requestor);
            return user.requestor;
        } else if (typeof user.requestor === 'object' && user.requestor?.name) {
            console.log('Using user.requestor.name:', user.requestor.name);
            return user.requestor.name;
        }
    }
    
    // Check metadata for requestorName
    if (user?.metadata?.requestorName && user.metadata.requestorName !== 'PR Requestor' && user.metadata.requestorName !== 'Unknown Requestor') {
        console.log('Using user.metadata.requestorName:', user.metadata.requestorName);
        return user.metadata.requestorName;
    }
    
    // First check if user object has a name property that's not the default
    if (user?.name && user.name !== 'PR Requestor' && user.name !== 'Unknown Requestor') {
        console.log('Using user.name:', user.name);
        return user.name;
    }
    
    // If we have a requestor email but no name, try to format it
    if (requestorEmail) {
        const formattedName = requestorEmail.split('@')[0].replace(/\./g, ' ').replace(/^(.)|\s+(.)/g, 
            (match: string) => match.toUpperCase());
        console.log('Using formatted email name:', formattedName);
        return formattedName;
    }
    
    console.log('No valid requestor name found, using default');
    return 'PR Requestor';
}

// Helper function to format reference data
function formatReferenceData(rawValue: string): string {
    if (!rawValue) return '';
    
    // Handle vendor IDs (convert to names)
    
    // Format category IDs (underscore format)
    if (rawValue.includes('_')) {
        return rawValue.split('_').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    }
    
    return rawValue;
}

// Helper function to generate email subject
function getEmailSubject(notification: any, emailBody: any): string {
    if (emailBody.subject) {
        return emailBody.subject;
    }
    
    const statusText = notification.newStatus 
        ? notification.newStatus.charAt(0).toUpperCase() + notification.newStatus.slice(1).toLowerCase() 
        : 'Updated';
    
    return `PR #${notification.prNumber} ${statusText}`;
}

// Define interface for notification payloads
interface NotificationPayload {
    notification: {
        type: string;
        prId: string;
        prNumber: string;
        oldStatus?: string | null;
        newStatus?: string | null;
        user?: any;
        metadata?: {
            requestorEmail?: string;
            requestorName?: string;
            isUrgent?: boolean;
        };
    };
    recipients: string[];
    cc?: string[];
    emailBody: {
        subject?: string;
        text: string;
        html: string;
    };
    metadata?: {
        requestorEmail?: string;
    };
}

// New function to handle revision required notifications with CORS support
export const sendRevisionRequiredNotification = functions.https.onCall(
    // Explicitly type context and safely assert data type
    async (data: any, context: functions.https.CallableContext) => { 
    // First cast to unknown, then to the desired type
    const notificationData = data as unknown as NotificationPayload; 
    console.log('Starting sendRevisionRequiredNotification with data:', JSON.stringify(notificationData, null, 2));

    // Check authentication using context (type is now explicit)
    if (!context || !context.auth) {
        console.error('Authentication missing');
        throw new functions.https.HttpsError(
            'unauthenticated',
            'User must be authenticated to send notifications'
        );
    }

    // Validate required fields
    if (!notificationData.notification?.prId || !notificationData.notification?.prNumber || !Array.isArray(notificationData.recipients) || notificationData.recipients.length === 0) {
        console.error('Invalid arguments:', { 
            prId: notificationData.notification?.prId,
            prNumber: notificationData.notification?.prNumber,
            recipients: notificationData.recipients
        });
        throw new functions.https.HttpsError(
            'invalid-argument',
            'The function must be called with valid prId, prNumber, and recipients array.'
        );
    }

    const { notification, recipients, cc = [], emailBody, metadata = { requestorEmail: '' } } = notificationData;
    console.log('Preparing to send revision required emails to:', { recipients, cc });

    // Ensure requestor name is properly set
    const requestorName = ensureRequestorName(notification.user, metadata.requestorEmail);
    console.log('Using requestor name:', requestorName);
    
    // Format email body to ensure human-readable values
    const formattedHtml = emailBody.html
        .replace(/>(\s*)<\/td>/g, '>$1</td>') // Preserve existing empty cells
        .replace(/(\w+)_(\w+)/g, (match) => formatReferenceData(match)) // Format reference data with underscores
        .replace(/>(\d{4})<\/td>/g, (match, id) => `>${formatReferenceData(id)}</td>`); // Format numeric vendor IDs
    
    // Update requestor name in the email
    const finalHtml = formattedHtml.replace(
        /<strong>Name<\/strong><\/td>\s*<td[^>]*>\s*<\/td>/g, 
        `<strong>Name</strong></td><td style="padding: 8px; border: 1px solid #ddd">${requestorName}</td>`
    );

    try {
        // Prepare email options
        const mailOptions: any = {
            from: '"1PWR System" <noreply@1pwrafrica.com>',
            to: recipients,
            subject: getEmailSubject(notification, emailBody),
            text: emailBody.text,
            html: finalHtml
        };
        
        // Add CC if present
        if (cc.length > 0) {
            mailOptions.cc = cc;
        }
        
        console.log('Sending email with options:', {
            to: mailOptions.to,
            cc: mailOptions.cc,
            subject: mailOptions.subject
        });
        
        // Send emails using SMTP
        const failedEmails: any[] = [];
        
        try {
            await sendEmail(mailOptions);
            console.log('Email sent successfully via SMTP');
        } catch (error) {
            console.error('Failed to send email:', error);
            failedEmails.push({
                recipient: recipients.join(','),
                error: error instanceof Error ? error.message : String(error)
            });
        }
        
        // Log the notification
        const logData = {
            type: 'REVISION_REQUIRED',
            status: failedEmails.length > 0 ? 'partial' : 'sent',
            timestamp: serverTimestamp(),
            notification,
            recipients,
            cc,
            emailBody,
            metadata,
            failedRecipients: failedEmails.length > 0 ? failedEmails.map(f => f.recipient) : []
        };
        console.log('Logging revision required notification:', logData);
        
        await db.collection('notificationLogs').add(logData);
        console.log('Revision required notification logged successfully');

        return { 
            success: failedEmails.length === 0,
            partialSuccess: failedEmails.length > 0 && failedEmails.length < recipients.length,
            failedRecipients: failedEmails.length > 0 ? failedEmails.map(f => f.recipient) : []
        };
    } catch (error) {
        console.error('Error in sendRevisionRequiredNotification:', error);
        throw new functions.https.HttpsError(
            'internal',
            'Failed to send revision required notification: ' + (error instanceof Error ? error.message : String(error))
        );
    }
});

// Firestore trigger to send emails for new notifications
export const processNotifications = functions.firestore
  .document('notifications/{notificationId}')
  .onCreate(async (snapshot, context) => {
    const notificationData = snapshot.data() as NotificationPayload; // Assume data matches the interface
    console.log('Processing new notification:', JSON.stringify(notificationData, null, 2));

    // Validate essential parts of the payload
    if (
      !notificationData || 
      !notificationData.recipients || notificationData.recipients.length === 0 ||
      !notificationData.notification || 
      !notificationData.notification.prId ||
      !notificationData.notification.prNumber ||
      !notificationData.emailBody
      ) { 
      console.error('Invalid notification data structure:', notificationData);
      // Optionally update the doc status to 'invalid'
      try {
        await snapshot.ref.update({ status: 'invalid', error: 'Invalid data structure', updatedAt: new Date().toISOString() });
      } catch (updateError) {
        console.error('Failed to update notification status to invalid:', updateError);
      }
      return null;
    }

    try {
      // Extract data based on NotificationPayload interface
      const { 
        recipients, 
        cc = [], 
        notification, 
        emailBody,
        metadata // Keep metadata for potential future use or fallback
      } = notificationData;
      
      const { prId, prNumber, user, type } = notification; // Destructure from notification object
      const { subject, text, html } = emailBody; // Destructure from emailBody object
      
      // Use the helper function to determine the requestor name
      const requestorName = ensureRequestorName(user, notification.metadata?.requestorEmail);
      console.log('Determined requestor name via helper:', requestorName);
      
      // Modify HTML to include the correct requestor name
      // Ensure these replacements are robust enough for different email templates
      let finalHtml = html;
      
      // Example replacement targets (adjust based on actual HTML templates)
      finalHtml = finalHtml.replace(
        /(<strong>Name<\/strong><\/td>\s*<td[^>]*>)(?:Unknown|PR Requestor|Submitter)?(<\/td>)/gi, 
        `$1${requestorName}$2`
      );
      finalHtml = finalHtml.replace(
        /(<strong>Submitted By:<\/strong>\s*)(?:Unknown|PR Requestor|Submitter)?(<\/p>)/gi, 
        `$1${requestorName}$2`
      );
      // Add more specific replacements if needed
      
      // Prepare email options for nodemailer
      const mailOptions: any = {
        from: '"1PWR System" <noreply@1pwrafrica.com>',
        to: recipients,
        subject: subject || `PR #${prNumber} Notification`,
        text: text,
        html: finalHtml
      };
      
      // Add CC if present
      if (cc.length > 0) {
        mailOptions.cc = cc;
      }
      
      console.log('Sending email with options:', {
        to: mailOptions.to,
        cc: mailOptions.cc,
        subject: mailOptions.subject
      });
      
      // Send the email using SMTP
      try {
        await sendEmail(mailOptions);
        console.log('Email sent successfully via SMTP');
        
        // Update the notification status in Firestore
        await snapshot.ref.update({
          status: 'sent',
          sentAt: new Date().toISOString()
        });
        
        // Also log to notificationLogs for tracking
        // Use the structure derived from NotificationPayload
        await db.collection('notificationLogs').add({
          type: type || 'PR_NOTIFICATION', // Use type from notification object
          status: 'sent',
          timestamp: serverTimestamp(),
          notification: { // Log the original notification sub-object
            prId,
            prNumber,
            type: type || 'PR_NOTIFICATION',
            user, // Include the user object that was used
            metadata: notification.metadata // Include notification metadata
          },
          recipients,
          cc: cc,
          emailBody: { // Log the original emailBody
            subject: mailOptions.subject,
            text: mailOptions.text,
            // Log finalHtml to see what was actually sent
            html: finalHtml 
          },
          metadata: metadata || {} // Log top-level metadata if present
        });
        
        return { success: true };
      } catch (error) {
        console.error('Failed to send email:', error);
        
        // Update the notification status to indicate failure
        await snapshot.ref.update({
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
          updatedAt: new Date().toISOString()
        });
        
        // Log failure to notificationLogs
        await db.collection('notificationLogs').add({
          type: type || 'PR_NOTIFICATION', 
          status: 'failed',
          timestamp: serverTimestamp(),
          error: error instanceof Error ? error.message : String(error),
          notification: { 
            prId,
            prNumber,
            type: type || 'PR_NOTIFICATION',
            user, 
            metadata: notification.metadata 
          },
          recipients,
          cc: cc,
          emailBody: { 
            subject: mailOptions.subject,
            text: mailOptions.text,
            html: finalHtml 
          },
          metadata: metadata || {}
        });

        return { 
          success: false, 
          error: error instanceof Error ? error.message : String(error)
        };
      }
    } catch (error) {
      console.error('Error processing notification:', error);
      
      // Update the notification status to indicate processing error
      await snapshot.ref.update({
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
        updatedAt: new Date().toISOString()
      });
      
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });


export const sendTestEmail = functions.https.onCall(async (data, context) => {
    console.log('sendTestEmail called with data:', data);
    
    try {
        const { to, subject, message } = data;
        
        if (!to || !subject || !message) {
            throw new functions.https.HttpsError('invalid-argument', 'Missing required fields: to, subject, message');
        }
        
        // Use SMTP
        const mailOptions = {
            from: '"1PWR System" <noreply@1pwrafrica.com>',
            to: to,
            subject: subject,
            text: message,
            html: `<p>${message}</p>`
        };
        
        const result = await sendEmail(mailOptions);
        console.log('Test email sent successfully via SMTP');
        
        return {
            success: true,
            messageId: result.messageId,
            message: 'Test email sent successfully via SMTP'
        };
        
    } catch (error) {
        console.error('Error sending test email:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
        };
    }
});

// Note: testSendGrid has been replaced by sendTestEmail which now uses SMTP
// export { testSendGrid } from './testSendGrid';