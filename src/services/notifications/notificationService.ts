import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { User } from '../../types/user';
import { PRStatus, PRRequest } from '../../types/pr';
import { NotificationContext } from './types';
import { getTransitionHandler } from './transitions';

/**
 * Notification Service class
 * 
 * Handles sending notifications for PR status changes using status-specific handlers.
 */
export class NotificationService {
  private readonly notificationsCollection = 'notifications';
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000; // 1 second

  /**
   * Gets a PR document from Firestore
   *
   * @param prId PR ID
   * @returns PR document data
   */
  private async getPRDocument(prId: string): Promise<any> {
    try {
      const docRef = doc(db, 'prs', prId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          ...data,
          id: prId
        };
      }
      
      return null;
    } catch (error) {
      console.error(`Error getting PR document ${prId}:`, error);
      return null;
    }
  }

  /**
   * Handles a PR status change notification.
   * 
   * @param prId PR ID associated with the notification
   * @param oldStatus Previous PR status (null for new PR)
   * @param newStatus New PR status
   * @param user User who triggered the status change
   * @param metadata Additional metadata for the notification
   */
  async handleStatusChange(
    prId: string,
    oldStatus: PRStatus | null,
    newStatus: PRStatus,
    user: User | null,
    metadata?: Record<string, any>
  ): Promise<void> {
    let lastError: Error | null = null;

    try {
      // Get the PR data from Firestore
      const prDoc = await this.getPRDocument(prId);
      if (!prDoc) {
        throw new Error(`PR with ID ${prId} not found`);
      }

      // Create notification context
      const context: NotificationContext = {
        prId,
        pr: prDoc as PRRequest,
        prNumber: prDoc.prNumber || `ID-${prId.substring(0, 8)}`,
        oldStatus: oldStatus || PRStatus.SUBMITTED,
        newStatus,
        isUrgent: prDoc.isUrgent,
        user: user ? {
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName
        } : undefined,
        notes: metadata?.notes,
        metadata
      };

      // Get the appropriate handler for this transition
      const handler = getTransitionHandler(oldStatus, newStatus);
      if (!handler) {
        throw new Error(`No handler found for transition ${oldStatus} -> ${newStatus}`);
      }

      // Execute any pre-transition logic
      if (handler.beforeTransition) {
        await handler.beforeTransition(context);
      }

      // Get recipients and email content
      const recipients = await handler.getRecipients(context);
      const emailContent = await handler.getEmailContent(context);

      // Try to send the notification with retries.
      //
      // The old flow called the `sendPRNotificationV2` callable, but that
      // function was removed from the Cloud Functions deploy (deleted from the
      // pr-system-4ea55 project on 2026-07-03) — so every status transition
      // (approve, reject, submit, etc. — everything except SUBMITTED→REVISION_REQUIRED)
      // was failing with `functions/not-found`, which surfaced to approvers as a
      // "Failed to update PR status" error even though the PR itself had already
      // been updated successfully.
      //
      // The replacement is the `processNotifications` Firestore trigger
      // (functions/src/index.ts), which fires on documents written to the
      // `notifications` collection and sends the email server-side. So we write
      // the notification doc directly with the exact payload the trigger expects
      // (recipients / cc / notification / emailBody), and let it do the send.
      // This also keeps the write within Firestore rules (notifications.create
      // is allowed for any authenticated user).
      for (let attempts = 1; attempts <= this.maxRetries; attempts++) {
        try {
          const notificationDoc = {
            recipients: recipients.to || [],
            cc: recipients.cc || [],
            notification: {
              prId: context.prId,
              prNumber: context.prNumber,
              user: context.user ? {
                email: context.user.email,
                name: `${context.user.firstName} ${context.user.lastName}`.trim()
              } : null,
              type: 'STATUS_CHANGE',
              metadata: {
                ...(context.metadata || {}),
                oldStatus: context.oldStatus,
                newStatus: context.newStatus,
                notes: context.notes,
              },
            },
            emailBody: {
              subject: emailContent.subject,
              text: emailContent.text,
              html: emailContent.html,
            },
            status: 'pending',
            createdAt: serverTimestamp(),
          };

          const docRef = await addDoc(collection(db, this.notificationsCollection), notificationDoc);

          console.log('Notification queued (trigger will send):', docRef.id);

          // Save notification to Firestore
          await this.logNotification(
            'STATUS_CHANGE',
            context.prId,
            [...(recipients.to || []), ...(recipients.cc || [])],
            'SENT',
            {
              prNumber: context.prNumber,
              oldStatus: context.oldStatus,
              newStatus: context.newStatus,
              user: context.user,
              notes: context.notes,
              emailContent,
              timestamp: serverTimestamp()
            }
          );

          // Execute any post-transition logic
          if (handler.afterTransition) {
            await handler.afterTransition(context);
          }

          return;

        } catch (error) {
          lastError = error as Error;
          console.error(`Error sending status change notification (attempt ${attempts}/${this.maxRetries}):`, error);
          
          if (attempts < this.maxRetries) {
            console.log(`Retrying in ${this.retryDelay}ms...`);
            await new Promise(resolve => setTimeout(resolve, this.retryDelay));
          }
        }
      }

      // If we get here, all attempts failed
      throw lastError || new Error('Failed to send notification after multiple attempts');
    } catch (error) {
      console.error('Error handling status change:', error);
      throw error;
    }
  }

  /**
   * Logs a notification to Firestore
   * 
   * @param type Notification type
   * @param prId PR ID associated with the notification
   * @param recipients List of recipient email addresses
   * @param status Notification status
   * @param metadata Additional metadata for the notification
   * @returns ID of the created notification document
   */
  async logNotification(
    type: string,
    prId: string,
    recipients: string[],
    status: string,
    metadata?: Record<string, any>
  ): Promise<string> {
    try {
      // Filter out any undefined values from metadata
      const cleanMetadata = metadata ? Object.fromEntries(
        Object.entries(metadata).filter(([_, v]) => v !== undefined)
      ) : {};

      // Create notification document
      const notificationData = {
        type,
        prId,
        recipients,
        status,
        timestamp: new Date().toISOString(),
        ...cleanMetadata // Spread cleaned metadata to include all fields, including prNumber
      };

      console.log('Notification logged:', notificationData);

      // Add to Firestore
      const docRef = await addDoc(collection(db, this.notificationsCollection), notificationData);
      return docRef.id;
    } catch (error) {
      console.error('Error logging notification:', error);
      throw error;
    }
  }
}

export const notificationService = new NotificationService();
