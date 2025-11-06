/**
 * @fileoverview Notification Service
 * @version 1.1.0
 * 
 * Description:
 * Manages the notification system for the PR System, handling email notifications
 * and in-app notifications for PR status changes, approvals, and comments.
 * 
 * Architecture Notes:
 * - Uses Firebase Cloud Functions for email delivery
 * - Maintains notification logs in Firestore
 * - Implements retry logic for failed notifications
 * - Supports batch notification processing
 * 
 * Notification Types:
 * - PR_CREATED: New PR created
 * - PR_UPDATED: PR details modified
 * - STATUS_CHANGE: PR status changed
 * - APPROVAL_REQUESTED: New approval needed
 * - COMMENT_ADDED: New comment on PR
 * 
 * Related Modules:
 * - src/types/notification.ts: Notification type definitions
 * - src/services/pr.ts: PR service that triggers notifications
 * - Cloud Functions: Email delivery implementation
 * 
 * Error Handling:
 * - Failed notifications are logged and retried
 * - Notification status is tracked (pending/sent/failed)
 * - Dead letter queue for undeliverable notifications
 */

import { getFunctions, httpsCallable } from 'firebase/functions';
import { collection, addDoc, doc, getDoc, serverTimestamp, query, where, getDocs, Timestamp, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { UserReference } from '../types/pr';
import { PRStatus, PRRequest } from '../types/pr';
import { Notification } from '../types/notification';
import {
  generateRevisionRequiredEmail,
  generateResubmittedEmail,
  generatePendingApprovalEmail,
  generateApprovedEmail,
  generateRejectedEmail,
  generateNewPREmail
} from './notifications/templates';
import { EmailContent } from './notifications/types';
import { generatePRNumber, updatePR } from './pr'; // Import specific functions

const functions = getFunctions();

/**
 * Notification Service class
 * 
 * Handles logging and sending notifications for PR status changes, approvals, and comments.
 */
export class NotificationService {
  /**
   * Collection name for notification logs in Firestore
   */
  private readonly notificationsCollection = 'purchaseRequestsNotifications';

  private readonly PROCUREMENT_EMAIL = 'procurement@1pwrafrica.com';

  /**
   * Logs a notification in Firestore and returns the notification ID.
   * 
   * @param type Notification type (e.g. STATUS_CHANGE, APPROVAL_REQUESTED)
   * @param prId PR ID associated with the notification
   * @param recipients List of recipient email addresses
   * @param status Initial notification status (default: 'pending')
   * @param metadata Additional metadata to include in the notification
   * @returns Notification ID
   */
  async logNotification(
    type: string,
    prId: string,
    recipients: string[],
    status: string = 'pending',
    metadata?: Record<string, any>
  ): Promise<string> {
    try {
      // Filter out any undefined values from metadata
      const cleanMetadata = metadata ? Object.fromEntries(
        Object.entries(metadata).filter(([_, v]) => v !== undefined)
      ) : {};
      
      // Ensure prNumber is always defined
      if (!cleanMetadata.prNumber && prId) {
        cleanMetadata.prNumber = `ID-${prId.substring(0, 8)}`;
      }
      
      const notificationLog = {
        type,
        prId,
        recipients,
        status,
        timestamp: serverTimestamp(),
        ...cleanMetadata
      };
      
      const notificationRef = collection(db, 'notificationLogs');
      const notificationDoc = await addDoc(notificationRef, notificationLog);
      console.log('Notification logged:', { type, prId, recipients, status });
      
      return notificationDoc.id;
    } catch (error) {
      console.error('Error logging notification:', error);
      throw error;
    }
  }

  /**
   * Handles a PR status change notification.
   * 
   * @param prId PR ID associated with the notification
   * @param oldStatus Previous PR status
   * @param newStatus New PR status
   * @param user User who triggered the status change
   * @param notes Optional notes about the status change
   */
  async handleStatusChange(
    prId: string,
    oldStatus: string,
    newStatus: string,
    user: UserReference | null,
    notes?: string
  ): Promise<void> {
    const maxAttempts = 3;
    const retryDelay = 1000; // 1 second delay between retries
    let lastError: Error | null = null;
    
    try {
      // Fetch PR data (force fetch from server to avoid cache issues)
      const prRef = doc(db, 'purchaseRequests', prId);
      const prSnapshot = await getDoc(prRef, { source: 'server' });
      
      if (!prSnapshot.exists()) {
        throw new Error(`PR with ID ${prId} not found`);
      }
      
      const pr = { id: prId, ...prSnapshot.data() } as PRRequest;
      console.log('Full PR data (from server):', pr);
      
      // Ensure prNumber is always defined
      const prNumber = pr.prNumber || `ID-${prId.substring(0, 8)}`;
      
      // Create notification object
      const notification = {
        type: 'STATUS_CHANGE',
        prId,
        oldStatus: oldStatus || 'NEW', // Ensure oldStatus is never null
        newStatus,
        prNumber,
        timestamp: new Date().toISOString(),
        userId: user?.id
      };
      
      // Generate base URL for PR link
      const prUrl = `${window.location.origin}/pr/${prId}`;
      
      // Log notification in Firestore
      await this.logNotification('STATUS_CHANGE', prId, [], 'pending', { 
        prNumber,
        oldStatus: oldStatus || 'NEW', // Ensure oldStatus is never null
        newStatus
      });

      // Generate email content first
      const emailContent = {
        subject: `${pr.isUrgent ? 'URGENT: ' : ''}PR ${prNumber} Status Changed: ${oldStatus || 'NEW'} → ${newStatus}`,
        text: `PR ${prNumber} status has changed from ${oldStatus || 'NEW'} to ${newStatus}\n${notes ? `Notes: ${notes}\n` : ''}`,
        html: `
          <p>PR ${prNumber} status has changed from ${oldStatus || 'NEW'} to ${newStatus}</p>
          ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
          <p><a href="${prUrl}">View PR</a></p>
        `,
        headers: {}
      };

      console.log('Email content for cloud function:', {
        ...emailContent,
        vendorDetails: pr.vendorDetails
      });

      // Determine recipients based on status transition FIRST (before creating notification doc)
      let recipients: string[] = [];
      const ccList: string[] = [];
      
      // Get procurement email from organization config (fallback to default)
      let procurementEmail = this.PROCUREMENT_EMAIL;
      try {
        const orgId = pr.organization?.toLowerCase().replace(/[^a-z0-9]/g, '_');
        if (orgId) {
          const orgDoc = await getDoc(doc(db, 'referenceData_organizations', orgId));
          if (orgDoc.exists() && orgDoc.data().procurementEmail) {
            procurementEmail = orgDoc.data().procurementEmail;
          }
        }
      } catch (error) {
        console.warn('Could not fetch org-specific procurement email, using default:', error);
      }
      
      // Route notifications based on status transition
      if (newStatus === PRStatus.REVISION_REQUIRED || newStatus === PRStatus.REJECTED) {
        // Send to requestor when revisions are needed or PR is rejected
        const requestorEmail = pr.requestorEmail || pr.requestor?.email;
        if (requestorEmail) {
          recipients = [requestorEmail];
          // CC procurement to stay informed (team email covers all procurement users)
          ccList.push(procurementEmail);
          // Note: We don't CC individual procurement users as they're already on the team email
        } else {
          console.warn('No requestor email found for REVISION_REQUIRED notification, sending to procurement');
          recipients = [procurementEmail];
        }
      } else if (newStatus === PRStatus.PENDING_APPROVAL) {
        // Send to approver(s) when approval is needed
        // Fetch approver email(s) from pr.approver and pr.approver2
        const approverIds: string[] = [];
        if (pr.approver) approverIds.push(pr.approver);
        if (pr.approver2) approverIds.push(pr.approver2);
        
        // Resolve user IDs to emails
        for (const approverId of approverIds) {
          try {
            // Check if it's already an email
            if (approverId.includes('@')) {
              recipients.push(approverId);
            } else {
              // Fetch email from users collection
              const userDoc = await getDoc(doc(db, 'users', approverId));
              if (userDoc.exists()) {
                const approverEmail = userDoc.data().email;
                if (approverEmail) {
                  recipients.push(approverEmail);
                  console.log(`Resolved approver ${approverId} to email: ${approverEmail}`);
                } else {
                  console.warn(`No email found for approver ${approverId}`);
                }
              } else {
                console.warn(`User document not found for approver ${approverId}`);
              }
            }
          } catch (error) {
            console.error(`Error fetching email for approver ${approverId}:`, error);
          }
        }
        
        // If no approvers found, send to procurement as fallback
        if (recipients.length === 0) {
          console.warn('No approver emails found, sending to procurement as fallback');
          recipients = [procurementEmail];
        }
        
        // CC procurement and requestor
        ccList.push(procurementEmail);
        const requestorEmail = pr.requestorEmail || pr.requestor?.email;
        if (requestorEmail && requestorEmail !== user?.email) {
          ccList.push(requestorEmail);
        }
      } else {
        // Default: send to procurement
        recipients = [procurementEmail];
        const requestorEmail = pr.requestorEmail || pr.requestor?.email;
        if (requestorEmail && requestorEmail !== user?.email) {
          ccList.push(requestorEmail);
        }
      }
      
      console.log('Notification recipients:', recipients);
      console.log('CC list:', ccList);

      // Create notification document with proper nested structure for Cloud Function
      // Remove headers from emailContent as Cloud Function doesn't need it
      const { headers, ...emailBody } = emailContent;
      
      const notificationPayload = {
        notification: {
          type: 'STATUS_CHANGE',
          prId,
          prNumber,
          oldStatus: oldStatus || null,
          newStatus,
          user: user || null,
          metadata: {
            requestorEmail: pr.requestorEmail || pr.requestor?.email,
            requestorName: pr.requestor?.name || `${pr.requestor?.firstName || ''} ${pr.requestor?.lastName || ''}`.trim(),
            isUrgent: pr.isUrgent || false
          }
        },
        recipients,
        cc: ccList,
        emailBody,
        status: 'pending',
        createdAt: serverTimestamp()
      };
      
      // Filter out any undefined values to prevent Firestore errors
      const cleanPayload = Object.fromEntries(
        Object.entries(notificationPayload).filter(([_, v]) => v !== undefined)
      );
      
      const notificationsRef = collection(db, 'notifications');
      const notificationDoc = await addDoc(notificationsRef, cleanPayload);

      // Notification logged to Firestore with proper structure
      // The processNotifications Firestore trigger will automatically send the email
      console.log('Notification logged to Firestore - processNotifications trigger will send email automatically');

      // No errors - notification will be processed by Firestore trigger
          return;
    } catch (error) {
      console.error('Error in handleStatusChange:', error);
      throw error;
    }
  }

  async handleSubmission(pr: PRRequest, action: string): Promise<void> {
    try {
      console.log('Starting handleSubmission with:', {
        prId: pr.id,
        prNumber: pr.prNumber,
        action
      });

      // Use handleStatusChange which now uses the modular notification system
      await this.handleStatusChange(
        pr.id,
        '', // Empty string instead of null for new PR
        PRStatus.SUBMITTED, // newStatus is SUBMITTED for new PR
        {
          id: pr.requestorId || '',
          email: pr.requestorEmail || '',
          firstName: pr.requestor?.firstName || '',
          lastName: pr.requestor?.lastName || '',
          name: pr.requestor?.name || `${pr.requestor?.firstName || ''} ${pr.requestor?.lastName || ''}`,
          role: pr.requestor?.role,
          organization: pr.requestor?.organization,
          isActive: true,
          permissionLevel: pr.requestor?.permissionLevel || 0,
          permissions: pr.requestor?.permissions || {
            canCreatePR: true,
            canApprovePR: false,
            canProcessPR: false,
            canManageUsers: false,
            canViewReports: false
          }
        } as unknown as UserReference,
        undefined // no notes for initial submission
      );

    } catch (error) {
      console.error('Error in handleSubmission:', error);
      throw error;
    }
  }

  /**
   * Sends a notification to an approver.
   */
  async sendApproverNotification(
    prId: string,
    prNumber: string,
    approverId: string
  ): Promise<void> {
    try {
      // Get approver's email
      const approverRef = doc(db, 'users', approverId);
      const approverDoc = await getDoc(approverRef);
      
      if (!approverDoc.exists()) {
        throw new Error('Approver not found');
      }

      const approverEmail = approverDoc.data().email;

      // Log notification with both approver and procurement
      await this.logNotification(
        'APPROVAL_REQUESTED', 
        prId, 
        [approverEmail, this.PROCUREMENT_EMAIL]
      );

      // Send notification via cloud function
      const sendApproverNotification = httpsCallable(functions, 'sendApproverNotification');
      await sendApproverNotification({
        prId,
        prNumber,
        approverId,
        recipients: [approverEmail],
        cc: [this.PROCUREMENT_EMAIL] // Always CC procurement
      });

      console.log('Approver notification sent successfully');
    } catch (error) {
      console.error('Error sending approver notification:', error);
      throw new Error('Failed to send approver notification');
    }
  }

  /**
   * Sends a direct notification to a specific user.
   * 
   * @param prId PR ID associated with the notification
   * @param userId ID of the user to notify
   * @param message Custom message for the notification
   */
  async sendNotification(
    prId: string,
    userId: string,
    message: string
  ): Promise<void> {
    try {
      // Get user data to get email
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        throw new Error('User not found');
      }

      const userData = userDoc.data();
      
      // Log notification
      await this.logNotification(
        'CUSTOM',
        prId,
        [userData.email],
        'pending'
      );

      // Send email via Cloud Function
      const sendEmailNotification = httpsCallable(functions, 'sendEmailNotification');
      await sendEmailNotification({ 
        notification: {
          type: 'CUSTOM',
          prId,
          message,
          timestamp: serverTimestamp()
        }
      });

    } catch (error) {
      console.error('Error sending notification:', error);
      throw new Error('Failed to send notification');
    }
  }

  /**
   * Retrieves a list of notifications associated with a PR.
   * 
   * @param prId PR ID to retrieve notifications for
   * @returns List of notification logs
   */
  async getNotificationsByPR(prId: string): Promise<any[]> {
    const q = query(
      collection(db, this.notificationsCollection),
      where('prId', '==', prId)
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }

  async getProcurementTeamEmails(organization: string): Promise<string[]> {
    try {
      console.log('Getting procurement team emails:', {
        rawOrg: organization,
        normalizedOrgId: organization
      });

      // Query users with procurement team permissions (level 2 or 3)
      const q = query(
        collection(db, 'users'),
        where('organization', '==', organization),
        where('permissionLevel', 'in', [2, 3])
      );

      const querySnapshot = await getDocs(q);
      console.log('Procurement team query results:', {
        totalResults: querySnapshot.size,
        docs: querySnapshot.docs
      });

      const emails = querySnapshot.docs
        .map(doc => doc.data().email?.toLowerCase())
        .filter(email => email) as string[];

      console.log('Found procurement team emails:', {
        organization,
        count: emails.length,
        emails
      });

      // Always include backup procurement email
      if (!emails.includes(this.PROCUREMENT_EMAIL)) {
        emails.push(this.PROCUREMENT_EMAIL);
      }

      return emails;
    } catch (error) {
      console.error('Error getting procurement team emails:', error);
      // Return backup email if query fails
      return [this.PROCUREMENT_EMAIL];
    }
  }

  async createNotification(
    pr: PRRequest,
    oldStatus: PRStatus | null,
    newStatus: PRStatus,
    user: UserReference | null,
    notes?: string
  ): Promise<any> {
    try {
      // Ensure prNumber is always defined with a proper PR number format
      // Use the proper PR number format instead of falling back to internal ID
      let prNumber = pr.prNumber;
      if (!prNumber) {
        try {
          // Generate a proper PR number if one doesn't exist
          prNumber = await generatePRNumber(pr.organization);
          
          // Update the PR with the new PR number
          await updatePR(pr.id, { prNumber });
          console.log(`Generated and updated PR number: ${prNumber} for PR ID: ${pr.id}`);
        } catch (error) {
          console.error('Error generating PR number:', error);
          // Only as a last resort, use a formatted version of the ID
          prNumber = `PR-${pr.organization.substring(0, 3)}-${new Date().getFullYear()}-${pr.id.substring(0, 3)}`;
        }
      }
      
      const context: any = {
        pr: {
          ...pr,
          prNumber // Ensure the PR object has the updated PR number
        },
        prNumber,
        user,
        notes,
        baseUrl: window.location.origin,
        isUrgent: pr.isUrgent || false
      };
      
      // Fetch vendor data if not already present
      if (pr.preferredVendor && !pr.vendorDetails) {
        try {
          // Vendor details would be fetched here if needed
          console.log('Would fetch vendor details for:', pr.preferredVendor);
        } catch (err) {
          console.error('Error fetching vendor data:', err);
        }
      }

      // Create email content based on status transition
      let subject = '';
      let plainText = '';
      let htmlContent = '';

      // Format currency amount if available
      const formattedAmount = pr.estimatedAmount 
        ? `${pr.currency || 'LSL'}\u00A0${Number(pr.estimatedAmount).toFixed(2)}`
        : 'N/A';

      if (oldStatus === null && newStatus === PRStatus.SUBMITTED) {
        // New PR submission
        subject = `${pr.isUrgent ? 'URGENT: ' : ''}New PR ${prNumber} Submitted`;
        
        plainText = `New PR ${prNumber} Submitted\n\n`;
        plainText += `Submitted By: ${user?.firstName || ''} ${user?.lastName || ''}\n\n`;
        plainText += `Requestor Information:\n`;
        plainText += `Name: ${pr.requestor?.firstName || ''} ${pr.requestor?.lastName || ''}\n`;
        plainText += `Email: ${pr.requestorEmail || pr.requestor?.email || ''}\n`;
        plainText += `Department: ${pr.department || ''}\n`;
        plainText += `Site: ${pr.site || ''}\n\n`;
        plainText += `PR Details:\n`;
        plainText += `PR Number: ${prNumber}\n`;
        plainText += `Category: ${pr.projectCategory || ''}\n`;
        plainText += `Expense Type: ${pr.expenseType || ''}\n`;
        plainText += `Total Amount: ${formattedAmount}\n`;
        plainText += `Vendor: ${pr.preferredVendor || ''}\n`;
        plainText += `Required Date: ${pr.requiredDate ? new Date(pr.requiredDate).toLocaleDateString() : ''}\n\n`;
        plainText += `View PR: ${window.location.origin}/pr/${pr.id}`;
        
        htmlContent = `
      <div style="
    font-family: Arial, sans-serif;
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
  ">
        ${pr.isUrgent ? `<div style="
    display: inline-block;
    padding: 8px 16px;
    border-radius: 4px;
    font-weight: bold;
    margin-bottom: 20px;
    background-color: #ff4444;
    color: white;
  ">URGENT</div>` : ''}
        <h2 style="
    color: #333;
    margin-bottom: 30px;
  ">New Purchase Request #${prNumber} Submitted</h2>
       
        <div style="
    margin-bottom: 30px;
  ">
          <h3 style="
    color: #444;
    margin-bottom: 15px;
  ">Submission Details</h3>
          <p style="
    margin: 10px 0;
    line-height: 1.5;
  ">
            <strong>Submitted By:</strong> ${user?.firstName || ''} ${user?.lastName || ''}
          </p>
         
        </div>

        <div style="
    margin-bottom: 30px;
  ">
          <h3 style="
    color: #444;
    margin-bottom: 15px;
  ">Requestor Information</h3>
         
    <table style="
    border-collapse: collapse;
    width: 100%;
    margin-bottom: 30px;
  ">
     
        <tr>
          <td style="
    padding: 8px;
    border: 1px solid #ddd;
  "><strong>Name</strong></td>
          <td style="
    padding: 8px;
    border: 1px solid #ddd;
  ">${pr.requestor?.firstName || ''} ${pr.requestor?.lastName || ''}</td>
        </tr>
     
        <tr>
          <td style="
    padding: 8px;
    border: 1px solid #ddd;
  "><strong>Email</strong></td>
          <td style="
    padding: 8px;
    border: 1px solid #ddd;
  ">${pr.requestorEmail || pr.requestor?.email || ''}</td>
        </tr>
     
        <tr>
          <td style="
    padding: 8px;
    border: 1px solid #ddd;
  "><strong>Department</strong></td>
          <td style="
    padding: 8px;
    border: 1px solid #ddd;
  ">${pr.department || ''}</td>
        </tr>
     
        <tr>
          <td style="
    padding: 8px;
    border: 1px solid #ddd;
  "><strong>Site</strong></td>
          <td style="
    padding: 8px;
    border: 1px solid #ddd;
  ">${pr.site || ''}</td>
        </tr>
     
    </table>
 
        </div>

        <div style="
    margin-bottom: 30px;
  ">
          <h3 style="
    color: #444;
    margin-bottom: 15px;
  ">PR Details</h3>
         
    <table style="
    border-collapse: collapse;
    width: 100%;
    margin-bottom: 30px;
  ">
     
        <tr>
          <td style="
    padding: 8px;
    border: 1px solid #ddd;
  "><strong>PR Number</strong></td>
          <td style="
    padding: 8px;
    border: 1px solid #ddd;
  ">${prNumber}</td>
        </tr>
     
        <tr>
          <td style="
    padding: 8px;
    border: 1px solid #ddd;
  "><strong>Category</strong></td>
          <td style="
    padding: 8px;
    border: 1px solid #ddd;
  ">${pr.projectCategory || ''}</td>
        </tr>
     
        <tr>
          <td style="
    padding: 8px;
    border: 1px solid #ddd;
  "><strong>Expense Type</strong></td>
          <td style="
    padding: 8px;
    border: 1px solid #ddd;
  ">${pr.expenseType || ''}</td>
        </tr>
     
        <tr>
          <td style="
    padding: 8px;
    border: 1px solid #ddd;
  "><strong>Total Amount</strong></td>
          <td style="
    padding: 8px;
    border: 1px solid #ddd;
  ">${formattedAmount}</td>
        </tr>
     
        <tr>
          <td style="
    padding: 8px;
    border: 1px solid #ddd;
  "><strong>Vendor</strong></td>
          <td style="
    padding: 8px;
    border: 1px solid #ddd;
  ">${pr.preferredVendor || ''}</td>
        </tr>
     
        <tr>
          <td style="
    padding: 8px;
    border: 1px solid #ddd;
  "><strong>Required Date</strong></td>
          <td style="
    padding: 8px;
    border: 1px solid #ddd;
  ">${pr.requiredDate ? new Date(pr.requiredDate).toLocaleDateString() : ''}</td>
        </tr>
     
    </table>
 
        </div>

        <div style="
    margin-top: 30px;
    text-align: center;
  ">
          <a href="${window.location.origin}/pr/${pr.id}" style="
    display: inline-block;
    padding: 10px 20px;
    background-color: #4CAF50;
    color: white;
    text-decoration: none;
    border-radius: 4px;
    font-weight: bold;
  ">View Purchase Request</a>
        </div>
      </div>
        `;
      } else {
        // Status change notification
        subject = `${pr.isUrgent ? 'URGENT: ' : ''}PR ${prNumber} Status Changed: ${oldStatus || 'NEW'} → ${newStatus}`;
        
        plainText = `PR ${prNumber} status has changed from ${oldStatus || 'NEW'} to ${newStatus}\n`;
        if (notes) plainText += `Notes: ${notes}\n`;
        plainText += `\nView PR: ${window.location.origin}/pr/${pr.id}`;
        
        htmlContent = `
      <div style="
    font-family: Arial, sans-serif;
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
  ">
        ${pr.isUrgent ? `<div style="
    display: inline-block;
    padding: 8px 16px;
    border-radius: 4px;
    font-weight: bold;
    margin-bottom: 20px;
    background-color: #ff4444;
    color: white;
  ">URGENT</div>` : ''}
        <h2 style="
    color: #333;
    margin-bottom: 30px;
  ">Purchase Request #${prNumber} Status Update</h2>
       
        <div style="
    margin-bottom: 30px;
    padding: 15px;
    background-color: #f8f9fa;
    border-left: 4px solid #4CAF50;
  ">
          <p style="
    margin: 10px 0;
    line-height: 1.5;
    font-size: 16px;
  ">
            Status changed from <strong>${oldStatus || 'NEW'}</strong> to <strong>${newStatus}</strong>
          </p>
          ${notes ? `<p style="
    margin: 10px 0;
    line-height: 1.5;
  ">
            <strong>Notes:</strong> ${notes}
          </p>` : ''}
          <p style="
    margin: 10px 0;
    line-height: 1.5;
    font-size: 14px;
    color: #666;
  ">
            Updated by: ${user?.firstName || ''} ${user?.lastName || ''} at ${new Date().toLocaleString()}
          </p>
        </div>

        <div style="
    margin-bottom: 30px;
  ">
          <h3 style="
    color: #444;
    margin-bottom: 15px;
  ">PR Details</h3>
         
    <table style="
    border-collapse: collapse;
    width: 100%;
    margin-bottom: 30px;
  ">
     
        <tr>
          <td style="
    padding: 8px;
    border: 1px solid #ddd;
  "><strong>PR Number</strong></td>
          <td style="
    padding: 8px;
    border: 1px solid #ddd;
  ">${prNumber}</td>
        </tr>
     
        <tr>
          <td style="
    padding: 8px;
    border: 1px solid #ddd;
  "><strong>Requestor</strong></td>
          <td style="
    padding: 8px;
    border: 1px solid #ddd;
  ">${pr.requestor?.firstName || ''} ${pr.requestor?.lastName || ''}</td>
        </tr>
     
        <tr>
          <td style="
    padding: 8px;
    border: 1px solid #ddd;
  "><strong>Department</strong></td>
          <td style="
    padding: 8px;
    border: 1px solid #ddd;
  ">${pr.department || ''}</td>
        </tr>
     
        <tr>
          <td style="
    padding: 8px;
    border: 1px solid #ddd;
  "><strong>Total Amount</strong></td>
          <td style="
    padding: 8px;
    border: 1px solid #ddd;
  ">${formattedAmount}</td>
        </tr>
     
    </table>
 
        </div>

        <div style="
    margin-top: 30px;
    text-align: center;
  ">
          <a href="${window.location.origin}/pr/${pr.id}" style="
    display: inline-block;
    padding: 10px 20px;
    background-color: #4CAF50;
    color: white;
    text-decoration: none;
    border-radius: 4px;
    font-weight: bold;
  ">View Purchase Request</a>
        </div>
      </div>
        `;
      }

      let emailContent = {
        subject,
        text: plainText,
        html: htmlContent,
        headers: {}
      };

      // Get recipients - always include procurement email and requestor email
      const recipients = [this.PROCUREMENT_EMAIL];
      
      // Set up CC list for proper email formatting
      const ccList = [];
      
      // Add requestor email to CC list if available
      if (pr.requestorEmail) {
        ccList.push(pr.requestorEmail);
      } else if (pr.requestor?.email) {
        ccList.push(pr.requestor.email);
      }
      
      // Add submitter email to CC if available and different from requestor
      if (user?.email && 
          user.email !== pr.requestorEmail && 
          user.email !== pr.requestor?.email) {
        ccList.push(user.email);
      }
      
      console.log('Notification recipients:', recipients);
      console.log('CC list:', ccList);
      
      // Log the notification
      const notification: any = {
        id: '',
        type: 'STATUS_CHANGE',
        prId: pr.id,
        prNumber,
        oldStatus: oldStatus || undefined,
        newStatus,
        timestamp: new Date().toISOString(),
        user: user || '',
        notes: notes || '',
        emailContent,
        recipients: recipients // Set the recipients here
      };

      // Log notification to Firestore
      const notificationId = await this.logNotification(notification.type, notification.prId, notification.recipients || [], 'pending');
      
      // Directly call the Cloud Function to send the email
      try {
        const sendPRNotificationV2 = httpsCallable(functions, 'sendPRNotificationV2');
        const result = await sendPRNotificationV2({
          notification: {
            prId: pr.id,
            prNumber,
            oldStatus: oldStatus || 'NEW',
            newStatus,
            user: user ? {
              email: user.email || '',
              name: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email || ''
            } : {
              email: '',
              name: 'System'
            },
            notes: notes || '',
            metadata: {
              description: pr.description || '',
              amount: pr.estimatedAmount || 0,
              currency: pr.currency || 'USD',
              department: pr.department || '',
              requiredDate: pr.requiredDate || '',
              isUrgent: pr.isUrgent || false
            }
          },
          recipients,
          cc: ccList, // Pass the CC list
          emailBody: emailContent
        });
        
        console.log('Email notification sent successfully:', result);
        
        // Update notification status in Firestore
        await this.updateNotificationStatus(notificationId, 'sent');
      } catch (error) {
        console.error('Error sending email notification:', error);
        
        // Update notification status in Firestore
        await this.updateNotificationStatus(notificationId, 'error', { error: error instanceof Error ? error.message : String(error) });
      }

      return notification;
    } catch (error: any) {
      console.error('Error creating notification:', error);
      throw new Error(`Failed to create notification: ${error.message}`);
    }
  }

  /**
   * Updates the status of a notification in Firestore
   * 
   * @param notificationId ID of the notification to update
   * @param status New status of the notification
   * @param metadata Additional metadata to include in the update
   */
  async updateNotificationStatus(notificationId: string, status: string, metadata?: Record<string, any>): Promise<void> {
    try {
      const notificationRef = doc(db, 'notificationLogs', notificationId);
      
      await updateDoc(notificationRef, {
        status,
        updatedAt: serverTimestamp(),
        ...(metadata || {})
      });
      
      console.log(`Notification ${notificationId} status updated to ${status}`);
    } catch (error) {
      console.error(`Error updating notification ${notificationId} status:`, error);
    }
  }
}

/**
 * Singleton instance of the Notification Service
 */
export const notificationService = new NotificationService();
