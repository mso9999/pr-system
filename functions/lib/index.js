"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendTestEmail = exports.processNotifications = exports.sendRevisionRequiredNotification = exports.createUser = exports.updateUserPassword = exports.sendDailyQuoteConflictReminders = exports.deliveryDelayCheck = exports.urgentReminders = exports.dailyReminders = exports.dailyVendorExpiryCheck = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const emailSender_1 = require("./utils/emailSender");
const fs_1 = require("fs");
const path_1 = require("path");
// Version information - read from package.json
let BACKEND_VERSION = '1.0.0';
try {
    const packageJsonPath = (0, path_1.join)(__dirname, '../package.json');
    const packageJson = JSON.parse((0, fs_1.readFileSync)(packageJsonPath, 'utf-8'));
    BACKEND_VERSION = packageJson.version || '1.0.0';
}
catch (error) {
    console.warn('Could not read package.json version, using default:', error);
}
console.log('=== Firebase Functions Initializing ===');
console.log(`Backend Version: ${BACKEND_VERSION}`);
console.log(`Initialization Date: ${new Date().toISOString()}`);
// Initialize Firebase
admin.initializeApp();
const db = admin.firestore();
const serverTimestamp = admin.firestore.FieldValue.serverTimestamp;
// Import scheduled functions
var scheduledVendorExpiryCheck_1 = require("./scheduledVendorExpiryCheck");
Object.defineProperty(exports, "dailyVendorExpiryCheck", { enumerable: true, get: function () { return scheduledVendorExpiryCheck_1.dailyVendorExpiryCheck; } });
var scheduledReminders_1 = require("./scheduledReminders");
Object.defineProperty(exports, "dailyReminders", { enumerable: true, get: function () { return scheduledReminders_1.dailyReminders; } });
Object.defineProperty(exports, "urgentReminders", { enumerable: true, get: function () { return scheduledReminders_1.urgentReminders; } });
Object.defineProperty(exports, "deliveryDelayCheck", { enumerable: true, get: function () { return scheduledReminders_1.deliveryDelayCheck; } });
var sendDailyQuoteConflictReminders_1 = require("./scheduled/sendDailyQuoteConflictReminders");
Object.defineProperty(exports, "sendDailyQuoteConflictReminders", { enumerable: true, get: function () { return sendDailyQuoteConflictReminders_1.sendDailyQuoteConflictReminders; } });
// Export user management functions
var updateUserPassword_1 = require("./updateUserPassword");
Object.defineProperty(exports, "updateUserPassword", { enumerable: true, get: function () { return updateUserPassword_1.updateUserPassword; } });
var createUser_1 = require("./createUser");
Object.defineProperty(exports, "createUser", { enumerable: true, get: function () { return createUser_1.createUser; } });
// Helper function to ensure requestor name is properly set
function ensureRequestorName(user, requestorEmail) {
    var _a, _b;
    console.log('ensureRequestorName input:', { user, requestorEmail });
    // Check if user object has requestor property (from the PR form)
    if (user === null || user === void 0 ? void 0 : user.requestor) {
        if (typeof user.requestor === 'string' && user.requestor) {
            console.log('Using user.requestor string:', user.requestor);
            return user.requestor;
        }
        else if (typeof user.requestor === 'object' && ((_a = user.requestor) === null || _a === void 0 ? void 0 : _a.name)) {
            console.log('Using user.requestor.name:', user.requestor.name);
            return user.requestor.name;
        }
    }
    // Check metadata for requestorName
    if (((_b = user === null || user === void 0 ? void 0 : user.metadata) === null || _b === void 0 ? void 0 : _b.requestorName) && user.metadata.requestorName !== 'PR Requestor' && user.metadata.requestorName !== 'Unknown Requestor') {
        console.log('Using user.metadata.requestorName:', user.metadata.requestorName);
        return user.metadata.requestorName;
    }
    // First check if user object has a name property that's not the default
    if ((user === null || user === void 0 ? void 0 : user.name) && user.name !== 'PR Requestor' && user.name !== 'Unknown Requestor') {
        console.log('Using user.name:', user.name);
        return user.name;
    }
    // If we have a requestor email but no name, try to format it
    if (requestorEmail) {
        const formattedName = requestorEmail.split('@')[0].replace(/\./g, ' ').replace(/^(.)|\s+(.)/g, (match) => match.toUpperCase());
        console.log('Using formatted email name:', formattedName);
        return formattedName;
    }
    console.log('No valid requestor name found, using default');
    return 'PR Requestor';
}
// Helper function to format reference data
function formatReferenceData(rawValue) {
    if (!rawValue)
        return '';
    // Handle vendor IDs (convert to names)
    // Format category IDs (underscore format)
    if (rawValue.includes('_')) {
        return rawValue.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    }
    return rawValue;
}
// Helper function to generate email subject
function getEmailSubject(notification, emailBody) {
    if (emailBody.subject) {
        return emailBody.subject;
    }
    const statusText = notification.newStatus
        ? notification.newStatus.charAt(0).toUpperCase() + notification.newStatus.slice(1).toLowerCase()
        : 'Updated';
    return `PR #${notification.prNumber} ${statusText}`;
}
// New function to handle revision required notifications with CORS support
exports.sendRevisionRequiredNotification = functions.https.onCall(
// Explicitly type context and safely assert data type
async (data, context) => {
    var _a, _b, _c, _d;
    // First cast to unknown, then to the desired type
    const notificationData = data;
    console.log('Starting sendRevisionRequiredNotification with data:', JSON.stringify(notificationData, null, 2));
    // Check authentication using context (type is now explicit)
    if (!context || !context.auth) {
        console.error('Authentication missing');
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated to send notifications');
    }
    // Validate required fields
    if (!((_a = notificationData.notification) === null || _a === void 0 ? void 0 : _a.prId) || !((_b = notificationData.notification) === null || _b === void 0 ? void 0 : _b.prNumber) || !Array.isArray(notificationData.recipients) || notificationData.recipients.length === 0) {
        console.error('Invalid arguments:', {
            prId: (_c = notificationData.notification) === null || _c === void 0 ? void 0 : _c.prId,
            prNumber: (_d = notificationData.notification) === null || _d === void 0 ? void 0 : _d.prNumber,
            recipients: notificationData.recipients
        });
        throw new functions.https.HttpsError('invalid-argument', 'The function must be called with valid prId, prNumber, and recipients array.');
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
    const finalHtml = formattedHtml.replace(/<strong>Name<\/strong><\/td>\s*<td[^>]*>\s*<\/td>/g, `<strong>Name</strong></td><td style="padding: 8px; border: 1px solid #ddd">${requestorName}</td>`);
    try {
        // Prepare email options
        const mailOptions = {
            from: '"1PWR System" <notifications@1pwrafrica.com>',
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
        const failedEmails = [];
        try {
            await (0, emailSender_1.sendEmail)(mailOptions);
            console.log('Email sent successfully via SMTP');
        }
        catch (error) {
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
    }
    catch (error) {
        console.error('Error in sendRevisionRequiredNotification:', error);
        throw new functions.https.HttpsError('internal', 'Failed to send revision required notification: ' + (error instanceof Error ? error.message : String(error)));
    }
});
// Firestore trigger to send emails for new notifications
exports.processNotifications = functions.firestore
    .document('notifications/{notificationId}')
    .onCreate(async (snapshot, context) => {
    var _a;
    const notificationData = snapshot.data(); // Assume data matches the interface
    console.log('Processing new notification:', JSON.stringify(notificationData, null, 2));
    // Validate essential parts of the payload
    if (!notificationData ||
        !notificationData.recipients || notificationData.recipients.length === 0 ||
        !notificationData.notification ||
        !notificationData.notification.prId ||
        !notificationData.notification.prNumber ||
        !notificationData.emailBody) {
        console.error('Invalid notification data structure:', notificationData);
        // Optionally update the doc status to 'invalid'
        try {
            await snapshot.ref.update({ status: 'invalid', error: 'Invalid data structure', updatedAt: new Date().toISOString() });
        }
        catch (updateError) {
            console.error('Failed to update notification status to invalid:', updateError);
        }
        return null;
    }
    try {
        // Extract data based on NotificationPayload interface
        const { recipients, cc = [], notification, emailBody, metadata // Keep metadata for potential future use or fallback
         } = notificationData;
        const { prId, prNumber, user, type } = notification; // Destructure from notification object
        const { subject, text, html } = emailBody; // Destructure from emailBody object
        // Use the helper function to determine the requestor name
        const requestorName = ensureRequestorName(user, (_a = notification.metadata) === null || _a === void 0 ? void 0 : _a.requestorEmail);
        console.log('Determined requestor name via helper:', requestorName);
        // Modify HTML to include the correct requestor name
        // Ensure these replacements are robust enough for different email templates
        let finalHtml = html;
        // Example replacement targets (adjust based on actual HTML templates)
        finalHtml = finalHtml.replace(/(<strong>Name<\/strong><\/td>\s*<td[^>]*>)(?:Unknown|PR Requestor|Submitter)?(<\/td>)/gi, `$1${requestorName}$2`);
        finalHtml = finalHtml.replace(/(<strong>Submitted By:<\/strong>\s*)(?:Unknown|PR Requestor|Submitter)?(<\/p>)/gi, `$1${requestorName}$2`);
        // Add more specific replacements if needed
        // Prepare email options for nodemailer
        const mailOptions = {
            from: '"1PWR System" <notifications@1pwrafrica.com>',
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
            await (0, emailSender_1.sendEmail)(mailOptions);
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
                notification: {
                    prId,
                    prNumber,
                    type: type || 'PR_NOTIFICATION',
                    user, // Include the user object that was used
                    metadata: notification.metadata // Include notification metadata
                },
                recipients,
                cc: cc,
                emailBody: {
                    subject: mailOptions.subject,
                    text: mailOptions.text,
                    // Log finalHtml to see what was actually sent
                    html: finalHtml
                },
                metadata: metadata || {} // Log top-level metadata if present
            });
            return { success: true };
        }
        catch (error) {
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
    }
    catch (error) {
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
exports.sendTestEmail = functions.https.onCall(async (data, context) => {
    console.log('sendTestEmail called with data:', data);
    try {
        const { to, subject, message } = data;
        if (!to || !subject || !message) {
            throw new functions.https.HttpsError('invalid-argument', 'Missing required fields: to, subject, message');
        }
        // Use SMTP
        const mailOptions = {
            from: '"1PWR System" <notifications@1pwrafrica.com>',
            to: to,
            subject: subject,
            text: message,
            html: `<p>${message}</p>`
        };
        const result = await (0, emailSender_1.sendEmail)(mailOptions);
        console.log('Test email sent successfully via SMTP');
        return {
            success: true,
            messageId: result.messageId,
            message: 'Test email sent successfully via SMTP'
        };
    }
    catch (error) {
        console.error('Error sending test email:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
        };
    }
});
// Note: testSendGrid has been replaced by sendTestEmail which now uses SMTP
// export { testSendGrid } from './testSendGrid';
//# sourceMappingURL=index.js.map