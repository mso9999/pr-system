"use strict";
/**
 * Scheduled Cloud Function: Send Daily Quote Conflict Reminders
 *
 * Runs once per day to send reminder emails for PRs that have quote conflicts.
 * Checks for PRs in PENDING_APPROVAL status with quoteConflict flag set to true.
 *
 * Schedule: Runs every day at 9:00 AM (configurable)
 */
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
exports.sendDailyQuoteConflictReminders = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const emailSender_1 = require("../utils/emailSender");
exports.sendDailyQuoteConflictReminders = functions.pubsub
    .schedule('0 9 * * *') // Every day at 9:00 AM UTC
    .timeZone('Africa/Maseru') // Lesotho time zone
    .onRun(async (context) => {
    console.log('Starting daily quote conflict reminder job...');
    try {
        const db = admin.firestore();
        // Query for PRs with quote conflicts
        const conflictedPRsSnapshot = await db
            .collection('purchaseRequests')
            .where('status', '==', 'PENDING_APPROVAL')
            .where('approvalWorkflow.quoteConflict', '==', true)
            .get();
        console.log(`Found ${conflictedPRsSnapshot.size} PRs with quote conflicts`);
        if (conflictedPRsSnapshot.empty) {
            console.log('No conflicted PRs found. Job complete.');
            return null;
        }
        // Process each conflicted PR
        const emailPromises = conflictedPRsSnapshot.docs.map(async (prDoc) => {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
            const pr = prDoc.data();
            const prId = prDoc.id;
            console.log(`Processing PR ${pr.prNumber} (${prId})`);
            try {
                // Get approver details
                const approver1Id = pr.approver;
                const approver2Id = pr.approver2;
                if (!approver1Id || !approver2Id) {
                    console.warn(`PR ${pr.prNumber} missing approvers. Skipping.`);
                    return;
                }
                // Fetch approver emails
                const approver1Doc = await db.collection('users').doc(approver1Id).get();
                const approver2Doc = await db.collection('users').doc(approver2Id).get();
                const approver1Email = approver1Doc.exists ? (_a = approver1Doc.data()) === null || _a === void 0 ? void 0 : _a.email : null;
                const approver2Email = approver2Doc.exists ? (_b = approver2Doc.data()) === null || _b === void 0 ? void 0 : _b.email : null;
                if (!approver1Email || !approver2Email) {
                    console.warn(`PR ${pr.prNumber} missing approver emails. Skipping.`);
                    return;
                }
                const approver1Name = approver1Doc.exists
                    ? `${(_c = approver1Doc.data()) === null || _c === void 0 ? void 0 : _c.firstName} ${(_d = approver1Doc.data()) === null || _d === void 0 ? void 0 : _d.lastName}`
                    : 'Approver 1';
                const approver2Name = approver2Doc.exists
                    ? `${(_e = approver2Doc.data()) === null || _e === void 0 ? void 0 : _e.firstName} ${(_f = approver2Doc.data()) === null || _f === void 0 ? void 0 : _f.lastName}`
                    : 'Approver 2';
                // Get quote details
                const quotes = pr.quotes || [];
                const firstQuoteId = (_g = pr.approvalWorkflow) === null || _g === void 0 ? void 0 : _g.firstApproverSelectedQuoteId;
                const secondQuoteId = (_h = pr.approvalWorkflow) === null || _h === void 0 ? void 0 : _h.secondApproverSelectedQuoteId;
                const firstQuote = quotes.find((q) => q.id === firstQuoteId);
                const secondQuote = quotes.find((q) => q.id === secondQuoteId);
                // Calculate days in conflict
                const conflictStartDate = new Date(((_j = pr.approvalWorkflow) === null || _j === void 0 ? void 0 : _j.lastUpdated) || pr.updatedAt);
                const daysInConflict = Math.floor((Date.now() - conflictStartDate.getTime()) / (1000 * 60 * 60 * 24));
                // Construct email
                const subject = `🚩 DAILY REMINDER: Quote Conflict - PR ${pr.prNumber} (Day ${daysInConflict})`;
                const htmlBody = `
<h2>🚩 Daily Reminder: Quote Selection Conflict</h2>

<div style="background-color: #fff3cd; border: 2px solid #ff9800; border-radius: 5px; padding: 15px; margin: 20px 0;">
  <h3 style="color: #d32f2f; margin-top: 0;">⚠️ This PR has been in conflict for ${daysInConflict} day${daysInConflict !== 1 ? 's' : ''}</h3>
  <p><strong>Purchase Request ${pr.prNumber}</strong> is still waiting for approver agreement on quote selection.</p>
</div>

<h3>PR Details:</h3>
<ul>
  <li><strong>PR Number:</strong> ${pr.prNumber}</li>
  <li><strong>Description:</strong> ${pr.description || 'N/A'}</li>
  <li><strong>Amount:</strong> ${pr.estimatedAmount} ${pr.estimatedAmountCurrency}</li>
  <li><strong>Organization:</strong> ${pr.organization}</li>
  <li><strong>Days in Conflict:</strong> ${daysInConflict}</li>
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
    <td style="border: 1px solid #ddd; padding: 12px;">${(firstQuote === null || firstQuote === void 0 ? void 0 : firstQuote.vendorName) || 'Unknown'}</td>
    <td style="border: 1px solid #ddd; padding: 12px; text-align: right;">${((_k = firstQuote === null || firstQuote === void 0 ? void 0 : firstQuote.amount) === null || _k === void 0 ? void 0 : _k.toFixed(2)) || 'N/A'} ${(firstQuote === null || firstQuote === void 0 ? void 0 : firstQuote.currency) || ''}</td>
  </tr>
  <tr>
    <td style="border: 1px solid #ddd; padding: 12px;">${approver2Name}</td>
    <td style="border: 1px solid #ddd; padding: 12px;">${(secondQuote === null || secondQuote === void 0 ? void 0 : secondQuote.vendorName) || 'Unknown'}</td>
    <td style="border: 1px solid #ddd; padding: 12px; text-align: right;">${((_l = secondQuote === null || secondQuote === void 0 ? void 0 : secondQuote.amount) === null || _l === void 0 ? void 0 : _l.toFixed(2)) || 'N/A'} ${(secondQuote === null || secondQuote === void 0 ? void 0 : secondQuote.currency) || ''}</td>
  </tr>
</table>

<h3>Action Required:</h3>
<p><strong>One or both approvers must change their selection to match.</strong></p>
<ol>
  <li>Open the PR</li>
  <li>Click "Approve" to update your quote selection</li>
  <li>Select the quote you wish to approve</li>
  <li>Once both approvers select the same quote, the PR will automatically proceed</li>
</ol>

<p style="margin-top: 30px;">
  <a href="${((_m = functions.config().app) === null || _m === void 0 ? void 0 : _m.url) || 'https://pr-system.1pwrafrica.com'}/pr/${prId}" style="background-color: #1976d2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
    View PR and Resolve Conflict
  </a>
</p>

<p style="margin-top: 30px; color: #666; font-size: 12px;">
  This is an automated daily reminder from the 1PWR Purchase Request System.<br>
  You will continue to receive these reminders until the conflict is resolved.
</p>
          `.trim();
                const textBody = `
🚩 DAILY REMINDER: Quote Selection Conflict (Day ${daysInConflict})

Purchase Request ${pr.prNumber} is still waiting for approver agreement.

Conflicting Selections:
- ${approver1Name}: ${(firstQuote === null || firstQuote === void 0 ? void 0 : firstQuote.vendorName) || 'Unknown'} - ${((_o = firstQuote === null || firstQuote === void 0 ? void 0 : firstQuote.amount) === null || _o === void 0 ? void 0 : _o.toFixed(2)) || 'N/A'} ${(firstQuote === null || firstQuote === void 0 ? void 0 : firstQuote.currency) || ''}
- ${approver2Name}: ${(secondQuote === null || secondQuote === void 0 ? void 0 : secondQuote.vendorName) || 'Unknown'} - ${((_p = secondQuote === null || secondQuote === void 0 ? void 0 : secondQuote.amount) === null || _p === void 0 ? void 0 : _p.toFixed(2)) || 'N/A'} ${(secondQuote === null || secondQuote === void 0 ? void 0 : secondQuote.currency) || ''}

Action Required: One or both approvers must change their selection to match.

View PR: ${((_q = functions.config().app) === null || _q === void 0 ? void 0 : _q.url) || 'https://pr-system.1pwrafrica.com'}/pr/${prId}
          `.trim();
                // Send email to both approvers
                const recipients = [approver1Email, approver2Email];
                const ccList = ['procurement@1pwrafrica.com'];
                // Add requestor to CC if available
                if (pr.requestorEmail) {
                    ccList.push(pr.requestorEmail);
                }
                await (0, emailSender_1.sendEmail)({
                    from: '"1PWR System" <notifications@1pwrafrica.com>',
                    to: recipients,
                    cc: ccList,
                    subject,
                    text: textBody,
                    html: htmlBody,
                });
                console.log(`Sent reminder email for PR ${pr.prNumber} to ${recipients.join(', ')}`);
                // Log the notification
                await db.collection('notificationLogs').add({
                    type: 'QUOTE_CONFLICT_REMINDER',
                    prId,
                    prNumber: pr.prNumber,
                    recipients,
                    cc: ccList,
                    status: 'sent',
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                    daysInConflict,
                });
            }
            catch (error) {
                console.error(`Error processing PR ${pr.prNumber}:`, error);
                // Log the failed notification
                await db.collection('notificationLogs').add({
                    type: 'QUOTE_CONFLICT_REMINDER',
                    prId,
                    prNumber: pr.prNumber,
                    status: 'failed',
                    error: error instanceof Error ? error.message : String(error),
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                });
            }
        });
        await Promise.all(emailPromises);
        console.log('Daily quote conflict reminder job complete.');
        return null;
    }
    catch (error) {
        console.error('Error in daily quote conflict reminder job:', error);
        throw error;
    }
});
//# sourceMappingURL=sendDailyQuoteConflictReminders.js.map