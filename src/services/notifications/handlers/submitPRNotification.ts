import { getFunctions, httpsCallable } from 'firebase/functions';
import { collection, addDoc, serverTimestamp, query, where, getDocs, getDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { generateNewPREmail } from '../templates/newPRSubmitted';
import { NotificationType, NotificationLog } from '@/types/notification';
import { NotificationContext } from '@/services/notifications/types';
import { getEnvironmentConfig } from '@/config/environment';
// import { logger } from '@/utils/logger';

const functions = getFunctions();

export class SubmitPRNotificationHandler {
  private readonly DEFAULT_PROCUREMENT_EMAIL = 'procurement@1pwrafrica.com';
  private readonly notificationsCollection = 'purchaseRequestsNotifications';

  /**
   * Logs a notification in Firestore
   */
  private async logNotification(
    prId: string,
    recipients: string[],
    status: NotificationLog['status'] = 'pending'
  ): Promise<string> {
    const notification: Omit<NotificationLog, 'id'> = {
      type: 'PR_SUBMITTED' as NotificationType,
      prId,
      recipients,
      sentAt: new Date(),
      status,
    };

    const docRef = await addDoc(collection(db, this.notificationsCollection), notification);
    return docRef.id;
  }

  /**
   * Fetches the organization's procurement email from Firestore
   * Falls back to default if not found or on error
   */
  private async getProcurementEmail(organizationName: string): Promise<string> {
    try {
      if (!organizationName) {
        console.warn('No organization name provided, using default procurement email');
        return this.DEFAULT_PROCUREMENT_EMAIL;
      }

      // Normalize organization name to ID format (e.g., "1PWR BENIN" -> "1pwr_benin")
      const orgId = organizationName.toLowerCase().replace(/\s+/g, '_');
      
      console.log(`Fetching procurement email for organization: ${organizationName} (ID: ${orgId})`);
      
      // Try to find organization by ID first
      const orgRef = doc(db, 'organizations', orgId);
      const orgDoc = await getDoc(orgRef);
      
      if (orgDoc.exists()) {
        const orgData = orgDoc.data();
        if (orgData.procurementEmail) {
          console.log(`Found procurement email for ${organizationName}: ${orgData.procurementEmail}`);
          return orgData.procurementEmail;
        }
      }
      
      // If not found by ID, try querying by name
      const orgsRef = collection(db, 'organizations');
      const orgsQuery = query(orgsRef, where('name', '==', organizationName));
      const orgsSnapshot = await getDocs(orgsQuery);
      
      if (!orgsSnapshot.empty) {
        const orgData = orgsSnapshot.docs[0].data();
        if (orgData.procurementEmail) {
          console.log(`Found procurement email for ${organizationName} (by name): ${orgData.procurementEmail}`);
          return orgData.procurementEmail;
        }
      }
      
      console.warn(`No procurement email found for organization: ${organizationName}, using default: ${this.DEFAULT_PROCUREMENT_EMAIL}`);
      return this.DEFAULT_PROCUREMENT_EMAIL;
    } catch (error) {
      console.error('Error fetching organization procurement email:', error);
      console.warn(`Using default procurement email due to error: ${this.DEFAULT_PROCUREMENT_EMAIL}`);
      return this.DEFAULT_PROCUREMENT_EMAIL;
    }
  }

  /**
   * Fetches the approver details if only an ID is available
   */
  private async getApproverDetails(approverId: string): Promise<any | null> {
    try {
      if (!approverId) {
        console.warn('Empty approver ID provided to getApproverDetails');
        return null;
      }
      
      console.debug('Fetching approver details for ID:', approverId);
      
      // Handle the case where approverId is an object
      if (typeof approverId === 'object') {
        console.debug('Approver ID is already an object:', approverId);
        return approverId;
      }
      
      const userDocRef = doc(db, 'users', approverId);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        console.debug('Found approver data:', { userData });
        
        return {
          id: approverId,
          email: userData.email,
          firstName: userData.firstName || '',
          lastName: userData.lastName || '',
          name: userData.firstName && userData.lastName ? 
            `${userData.firstName} ${userData.lastName}` : 
            userData.displayName || userData.email
        };
      }
      
      console.warn('Approver not found in users collection:', approverId);
      return null;
    } catch (error) {
      console.error('Error fetching approver details:', error);
      return null;
    }
  }

  /**
   * Creates and sends a PR submission notification
   * @returns Object containing success status and notification ID
   */
  async createNotification(pr: any, inputPrNumber?: string): Promise<{ success: boolean; notificationId?: string; message?: string }> {
    try {
      console.log('SubmitPRNotificationHandler.createNotification called with:', { 
        pr: pr, 
        inputPrNumber,
        prId: pr?.id,
        prNumber: pr?.prNumber,
        prKeys: pr ? Object.keys(pr) : 'pr is null/undefined',
        prType: typeof pr,
        prIdType: typeof pr?.id
      });
      
      // Add more detailed debugging
      console.log('Detailed PR object analysis:', {
        hasId: 'id' in pr,
        idValue: pr?.id,
        idType: typeof pr?.id,
        prKeys: pr ? Object.keys(pr) : 'pr is null/undefined',
        prStringified: JSON.stringify(pr, null, 2)
      });
      
      // Check if pr is null or undefined
      if (!pr) {
        console.error('PR object is null or undefined');
        return { success: false, message: 'PR object is null or undefined' };
      }
      
      // Determine the PR number to use
      // Priority: inputPrNumber (passed from createPR) > pr.prNumber (from PR object)
      let prNumber = '';
      
      // First check if we have an explicitly passed PR number
      if (inputPrNumber) {
        prNumber = inputPrNumber;
        console.log('Using explicitly passed PR number:', prNumber);
      } 
      // Then check if PR object has a valid PR number
      else if (pr.prNumber) {
        prNumber = pr.prNumber;
        console.log('Using PR number from PR object:', prNumber);
      } 
      // If we don't have a PR number at this point, something went wrong
      else {
        console.error('No PR number available for notification', { 
          prId: pr.id, 
          inputPrNumber,
          prPrNumber: pr.prNumber,
          organization: pr.organization
        });
        throw new Error('PR number is required for notification but was not provided');
      }

      console.log('Creating PR submission notification', { prId: pr.id, prNumber });
      
      // Comprehensive duplicate check across multiple collections
      console.log('Checking for existing notifications for PR:', pr.id);
      
      // Check if this PR already has a notification sent in the notifications collection
      const notificationsRef = collection(db, 'notifications');
      const q = query(
        notificationsRef,
        where('prId', '==', pr.id),
        where('type', '==', 'PR_SUBMITTED')
      );
      
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        console.warn('PR submission notification already exists in notifications collection, skipping duplicate', { 
          prId: pr.id, 
          prNumber,
          existingNotifications: querySnapshot.size,
          existingNotificationIds: querySnapshot.docs.map(d => d.id)
        });
        return { 
          success: true, 
          message: 'Notification already sent - duplicate prevented',
          notificationId: querySnapshot.docs[0].id
        };
      }

      // Also check in the purchaseRequestsNotifications collection
      const prNotificationsRef = collection(db, this.notificationsCollection);
      const prNotificationsQuery = query(
        prNotificationsRef,
        where('prId', '==', pr.id),
        where('type', '==', 'PR_SUBMITTED')
      );
      
      const prNotificationsSnapshot = await getDocs(prNotificationsQuery);
      if (!prNotificationsSnapshot.empty) {
        console.warn('PR submission notification already exists in purchaseRequestsNotifications, skipping duplicate', { 
          prId: pr.id, 
          prNumber,
          existingNotifications: prNotificationsSnapshot.size,
          existingNotificationIds: prNotificationsSnapshot.docs.map(d => d.id)
        });
        return { 
          success: true, 
          message: 'Notification already sent - duplicate prevented',
          notificationId: prNotificationsSnapshot.docs[0].id
        };
      }
      
      // Also check in the notificationLogs collection
      const notificationLogsRef = collection(db, 'notificationLogs');
      const notificationLogsQuery = query(
        notificationLogsRef,
        where('notification.prId', '==', pr.id),
        where('type', '==', 'PR_SUBMITTED'),
        where('status', '==', 'sent'),
        // Only check logs from the last hour to avoid issues with very old notifications
        where('timestamp', '>=', new Date(Date.now() - 60 * 60 * 1000))
      );
      
      const notificationLogsSnapshot = await getDocs(notificationLogsQuery);
      if (!notificationLogsSnapshot.empty) {
        console.warn('PR submission notification already exists in notificationLogs, skipping duplicate', { 
          prId: pr.id, 
          prNumber,
          existingNotifications: notificationLogsSnapshot.size,
          existingNotificationIds: notificationLogsSnapshot.docs.map(d => d.id)
        });
        return { 
          success: true, 
          message: 'Notification already sent via logs - duplicate prevented',
          notificationId: notificationLogsSnapshot.docs[0].id
        };
      }
      
      console.log('No existing notifications found, proceeding to create new notification for PR:', pr.id);
      
      // Get the PR document to ensure we have all the data
      let prDoc = await this.getPRDocument(pr.id);
      
      // If PR document is not found in Firestore yet (due to eventual consistency),
      // use the in-memory PR data passed to this function
      if (!prDoc) {
        console.warn(`Using in-memory PR data for ID: ${pr.id} since Firestore document is not available yet.`);
        prDoc = { ...pr };
        
        if (!prDoc.id) {
          console.error('PR ID is missing from in-memory data');
          throw new Error('PR ID is required for notification');
        }
      }

      const config = getEnvironmentConfig();
      const baseUrl = config.baseUrl;
      if (!baseUrl) {
        throw new Error('Base URL is not configured');
      }

      // Get organization's procurement email dynamically
      const procurementEmail = await this.getProcurementEmail(prDoc.organization);
      
      // Generate notification ID and log
      const notificationId = await this.logNotification(prDoc.id, [procurementEmail]);

      // Detailed raw data logging to detect approver issues
      console.debug('Raw PR approver data:', {
        approver: prDoc.approver,
        approverType: typeof prDoc.approver,
        approverList: prDoc.approvers,
        workflowExists: !!prDoc.approvalWorkflow,
        workflowApprover: prDoc.approvalWorkflow?.currentApprover,
        workflowApproverType: typeof prDoc.approvalWorkflow?.currentApprover,
      });

      // Find approver information - pr.approver is the single source of truth
      let approverId = null;
      let approverInfo = null;

      // Check the PR.approver field (single source of truth)
      if (prDoc.approver) {
        if (typeof prDoc.approver === 'string') {
          approverId = prDoc.approver;
          console.debug('Using approver ID from PR.approver (single source of truth):', approverId);
        } else if (typeof prDoc.approver === 'object') {
          approverInfo = prDoc.approver;
          console.debug('Using approver object from PR.approver (single source of truth):', approverInfo);
        }
      }
      
      // If no approver is set, check if there's an approver in the workflow
      if (!approverId && !approverInfo && prDoc.approvalWorkflow?.currentApprover) {
        if (typeof prDoc.approvalWorkflow.currentApprover === 'string') {
          approverId = prDoc.approvalWorkflow.currentApprover;
          console.debug('Using approver ID from approvalWorkflow.currentApprover as fallback:', approverId);
        } else if (typeof prDoc.approvalWorkflow.currentApprover === 'object') {
          approverInfo = prDoc.approvalWorkflow.currentApprover;
          console.debug('Using approver object from approvalWorkflow.currentApprover as fallback:', approverInfo);
        }
      }
      
      // Check for discrepancy between approver and approvalWorkflow.currentApprover
      if (prDoc.approvalWorkflow?.currentApprover && prDoc.approver !== prDoc.approvalWorkflow.currentApprover) {
        console.warn('Discrepancy detected between PR.approver and approvalWorkflow.currentApprover', {
          prId: prDoc.id,
          prApprover: prDoc.approver,
          workflowApprover: prDoc.approvalWorkflow.currentApprover
        });
        
        // Fix the discrepancy by updating approvalWorkflow.currentApprover to match pr.approver
        if (prDoc.approver) {
          console.log('Updating approvalWorkflow.currentApprover to match PR.approver (single source of truth)', {
            prId: prDoc.id,
            approver: prDoc.approver
          });
          
          // Update the document in memory
          if (prDoc.approvalWorkflow) {
            prDoc.approvalWorkflow.currentApprover = prDoc.approver;
          }
          
          // Update the document in the database
          try {
            const prRef = doc(db, 'prs', prDoc.id);
            await updateDoc(prRef, {
              'approvalWorkflow.currentApprover': prDoc.approver
            });
            
            console.log('Updated approvalWorkflow.currentApprover directly via Firestore', {
              prId: prDoc.id,
              approver: prDoc.approver
            });
          } catch (error) {
            console.error('Failed to update approvalWorkflow.currentApprover', {
              prId: prDoc.id,
              error
            });
          }
        }
      }

      // If we only have an ID, fetch the full details
      if (approverId && !approverInfo) {
        console.debug('Fetching detailed approver info for:', approverId);
        approverInfo = await this.getApproverDetails(approverId);
        
        // If we get back null but have a valid ID, create a minimal info object
        if (!approverInfo && approverId) {
          console.warn(`Could not find full approver details for ID: ${approverId}, creating minimal info`);
          approverInfo = {
            id: approverId,
            email: `approver-${approverId}@unknown.com`, // placeholder email
            name: `Approver (ID: ${approverId})` // placeholder name
          };
        }
      }

      // Log what we found
      console.info('Approver resolution result:', { 
        hasApprover: !!approverInfo, 
        approverId, 
        approverInfo: approverInfo ? {
          id: approverInfo.id,
          email: approverInfo.email,
          name: approverInfo.name || 
                (approverInfo.firstName && approverInfo.lastName ? 
                `${approverInfo.firstName} ${approverInfo.lastName}`.trim() : 
                '')
        } : null
      });

      // Log the complete PR document structure for debugging
      console.debug('PR document structure for requestor information:', {
        requestorId: prDoc.requestorId,
        requestorEmail: prDoc.requestorEmail,
        requestorObject: prDoc.requestor,
        requestorName: prDoc.requestor?.name,
        requestorFirstName: prDoc.requestor?.firstName,
        requestorLastName: prDoc.requestor?.lastName
      });

      // Enhanced requestor information resolution - ensure we have a complete requestor object
      let requestorInfo = {
        firstName: prDoc.requestor?.firstName || '',
        lastName: prDoc.requestor?.lastName || '',
        email: prDoc.requestor?.email || prDoc.requestorEmail || '',
        // Prioritize full name from requestor object with fallbacks
        name: ''  // Will fill this below
      };

      // Standard name resolution
      requestorInfo.name = await this.getRequestorName(prDoc);

      // If the requestor name is a placeholder with an ID, try to fetch the full details
      if ((requestorInfo.name.startsWith('Requestor (ID:') || !requestorInfo.name) && prDoc.requestorId) {
        try {
          const userDoc = await getDoc(doc(db, 'users', prDoc.requestorId));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            
            requestorInfo = {
              ...requestorInfo,
              firstName: userData.firstName || requestorInfo.firstName,
              lastName: userData.lastName || requestorInfo.lastName,
              email: userData.email || requestorInfo.email,
              name: userData.firstName && userData.lastName 
                ? `${userData.firstName} ${userData.lastName}` : 
                userData.name || requestorInfo.name
            };
            
            console.debug('Updated requestor info with user data from Firestore', requestorInfo);
          }
        } catch (error) {
          console.error('Error fetching requestor details from users collection', {
            error: error instanceof Error ? error.message : String(error),
            requestorId: prDoc.requestorId
          });
        }
      }

      // Additional checks for requestor name from PR document structure
      if ((!requestorInfo.name || requestorInfo.name === 'Unknown Requestor') && 
          requestorInfo.email?.toLowerCase() !== 'jopi@1pwrafrica.com') {
        // First check for name in the primary requestor field
        if (prDoc.requestor?.name) {
          requestorInfo.name = prDoc.requestor.name;
          console.debug('Using requestor name from prDoc.requestor.name', requestorInfo.name);
        }
        // Then try combining firstName and lastName if available
        else if (prDoc.requestor?.firstName || prDoc.requestor?.lastName) {
          requestorInfo.name = `${prDoc.requestor.firstName || ''} ${prDoc.requestor.lastName || ''}`.trim();
          console.debug('Using combined firstName/lastName', requestorInfo.name);
        }
      }

      // Force default name if nothing found
      if (!requestorInfo.name || requestorInfo.name === 'Unknown Requestor') {
        if (requestorInfo.email) {
          // Extract name from email with our improved nameFromEmail function
          requestorInfo.name = this.nameFromEmail(requestorInfo.email);
          console.debug('Using nameFromEmail for fallback name', requestorInfo.name);
        } else {
          // Last resort default that's more informative than 'Unknown'
          requestorInfo.name = 'PR Requestor';
          console.debug('Using default fallback name: PR Requestor');
        }
      }

      // Log final requestor info for debugging
      console.debug('Final requestor information:', requestorInfo);

      // Create notification context
      const notificationContext: NotificationContext = {
        pr: prDoc,
        prId: prDoc.id,
        prNumber,
        approver: approverInfo,
        baseUrl,
        requestorInfo: {
          name: requestorInfo.name || 'Unknown Requestor',
          email: requestorInfo.email || 'Unknown Email'
        },
        metadata: {
          isUrgent: prDoc.isUrgent || false,
        }
      };

      // Get the requestor name - this will use our generalizable approach
      const requestorName = await this.getRequestorName(prDoc);
      
      console.log(`Creating PR submission notification`, { prId: prDoc.id, prNumber, requestorName });
      console.log(`[VENDOR DEBUG] ========== PR NOTIFICATION START ==========`);
      console.log(`[VENDOR DEBUG] PR ID: ${prDoc.id}`);
      console.log(`[VENDOR DEBUG] PR Number: ${prNumber}`);
      console.log(`[VENDOR DEBUG] Preferred Vendor: '${prDoc.preferredVendor}' (type: ${typeof prDoc.preferredVendor})`);
      console.log(`[VENDOR DEBUG] Organization: '${prDoc.organization}'`);
      console.log(`[VENDOR DEBUG] Full PR object:`, JSON.stringify(prDoc, null, 2));
      console.log(`[VENDOR DEBUG] ==========================================`);
      
      // Generate email content
      const { html, text, subject } = await generateNewPREmail(notificationContext);
      console.log(`[VENDOR DEBUG] Email content generated`);

      // Use the procurement email we already fetched earlier
      console.log(`[NOTIFICATION] Using procurement email for ${prDoc.organization}: ${procurementEmail}`);
      
      // Get recipients - TO is the procurement email for the organization
      const recipients = [procurementEmail];
      
      // Add CC list
      const cc: string[] = [];
      
      // Always CC the requestor
      if (prDoc.requestorEmail) {
        cc.push(prDoc.requestorEmail);
        console.log(`[NOTIFICATION] Adding requestor to CC: ${prDoc.requestorEmail}`);
      }
      
      // If requestor has a different email in their user record, CC that too
      if (prDoc.requestor?.email && prDoc.requestor.email !== prDoc.requestorEmail) {
        cc.push(prDoc.requestor.email);
        console.log(`[NOTIFICATION] Adding requestor alternate email to CC: ${prDoc.requestor.email}`);
      }
      
      console.log(`[NOTIFICATION] Final recipients - TO: ${recipients.join(', ')}, CC: ${cc.join(', ') || '(none)'}`);
      
      // Create notification document
      const notificationRef = collection(db, 'notifications');
      await addDoc(notificationRef, {
        type: 'PR_SUBMITTED' as NotificationType,
        prId: prDoc.id,
        prNumber,
        recipients,
        cc,
        status: 'pending',
        createdAt: serverTimestamp(),
        metadata: {
          requestorName,
          requestorEmail: prDoc.requestorEmail,
          isUrgent: prDoc.isUrgent || false
        },
        emailBody: {
          subject,
          text,
          html
        },
        notification: {
          type: 'NEW_PR',
          prId: prDoc.id,
          prNumber,
          user: {
            requestor: typeof prDoc.requestor === 'string' ? prDoc.requestor : 
              (typeof prDoc.requestor === 'object' && prDoc.requestor !== null ? 
                (prDoc.requestor.name || `${prDoc.requestor.firstName || ''} ${prDoc.requestor.lastName || ''}`.trim() || prDoc.requestor.email) : 
                requestorName),
            name: requestorName,
            metadata: {
              requestorName,
              requestorEmail: prDoc.requestorEmail,
            }
          },
          metadata: {
            requestorName,
            requestorEmail: prDoc.requestorEmail,
            isUrgent: prDoc.isUrgent || false
          }
        }
      });
      
      console.info(`Notification logged`, { 
        type: 'PR_SUBMITTED', 
        prId: prDoc.id, 
        prNumber,
        recipients: { to: recipients, cc: cc },
        status: 'pending' 
      });
      
      return {
        success: true,
        notificationId: notificationRef.id
      };
    } catch (error: unknown) {
      console.error('Failed to create PR submission notification', { 
        error: error instanceof Error ? error.message : String(error),
        prId: pr.id,
        prNumber: pr.prNumber
      });
      
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Gets the requestor name from PR data
   */
  private async getRequestorName(prDoc: any): Promise<string> {
    console.debug('Getting requestor name for PR', {
      id: prDoc.id,
      requestorId: prDoc.requestorId,
      requestorEmail: prDoc.requestorEmail,
      requestor: prDoc.requestor
    });
    
    // 1. If we have a requestorId, look up the user in the database
    if (prDoc.requestorId) {
      try {
        const userDoc = await getDoc(doc(db, 'users', prDoc.requestorId));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          
          // Use firstName and lastName if available
          if (userData.firstName && userData.lastName) {
            const fullName = `${userData.firstName} ${userData.lastName}`.trim();
            console.debug('Using user firstName/lastName from database lookup', fullName);
            return fullName;
          }
          
          // Use name field if available
          if (userData.name) {
            console.debug('Using user.name from database lookup', userData.name);
            return userData.name;
          }
          
          // Use displayName if available
          if (userData.displayName) {
            console.debug('Using user.displayName from database lookup', userData.displayName);
            return userData.displayName;
          }
          
          console.debug('User found but no name fields available', userData);
        } else {
          console.warn(`User with ID ${prDoc.requestorId} not found in database`);
        }
      } catch (error) {
        console.error('Error fetching user details', {
          error: error instanceof Error ? error.message : String(error),
          requestorId: prDoc.requestorId
        });
      }
    }
    
    // 2. If we have a requestorEmail, look up the user by email
    if (prDoc.requestorEmail) {
      try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', prDoc.requestorEmail));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const userData = querySnapshot.docs[0].data();
          
          // Use firstName and lastName if available
          if (userData.firstName && userData.lastName) {
            const fullName = `${userData.firstName} ${userData.lastName}`.trim();
            console.debug('Using user firstName/lastName from email lookup', fullName);
            return fullName;
          }
          
          // Use name field if available
          if (userData.name) {
            console.debug('Using user.name from email lookup', userData.name);
            return userData.name;
          }
          
          // Use displayName if available
          if (userData.displayName) {
            console.debug('Using user.displayName from email lookup', userData.displayName);
            return userData.displayName;
          }
          
          console.debug('User found by email but no name fields available', userData);
        } else {
          console.warn(`No user found with email ${prDoc.requestorEmail}`);
        }
      } catch (error) {
        console.error('Error looking up user by email', {
          error: error instanceof Error ? error.message : String(error),
          requestorEmail: prDoc.requestorEmail
        });
      }
    }
    
    // 3. Check if requestor is an object with name information
    if (prDoc.requestor && typeof prDoc.requestor === 'object') {
      // Use name field if available
      if (prDoc.requestor.name) {
        console.debug('Using requestor.name from PR', prDoc.requestor.name);
        return prDoc.requestor.name;
      }
      
      // Use firstName and lastName if available
      if (prDoc.requestor.firstName || prDoc.requestor.lastName) {
        const combinedName = `${prDoc.requestor.firstName || ''} ${prDoc.requestor.lastName || ''}`.trim();
        if (combinedName) {
          console.debug('Using combined firstName/lastName from requestor object', combinedName);
          return combinedName;
        }
      }
      
      // If requestor has an email, look up user by that email
      if (prDoc.requestor.email) {
        try {
          const usersRef = collection(db, 'users');
          const q = query(usersRef, where('email', '==', prDoc.requestor.email));
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            const userData = querySnapshot.docs[0].data();
            
            // Use firstName and lastName if available
            if (userData.firstName && userData.lastName) {
              const fullName = `${userData.firstName} ${userData.lastName}`.trim();
              console.debug('Using user firstName/lastName from requestor.email lookup', fullName);
              return fullName;
            }
            
            // Use name field if available
            if (userData.name) {
              console.debug('Using user.name from requestor.email lookup', userData.name);
              return userData.name;
            }
            
            // Use displayName if available
            if (userData.displayName) {
              console.debug('Using user.displayName from requestor.email lookup', userData.displayName);
              return userData.displayName;
            }
            
            console.debug('User found by requestor.email but no name fields available', userData);
          } else {
            console.warn(`No user found with email ${prDoc.requestor.email}`);
          }
        } catch (error) {
          console.error('Error looking up user by requestor.email', {
            error: error instanceof Error ? error.message : String(error),
            requestorEmail: prDoc.requestor.email
          });
        }
      }
    }
    
    // 4. If requestor is a string, it might be a name or email
    if (typeof prDoc.requestor === 'string') {
      // If it doesn't contain @ symbol, assume it's a name
      if (!prDoc.requestor.includes('@')) {
        console.debug('Using requestor string as name', prDoc.requestor);
        return prDoc.requestor;
      }
      
      // If it contains @ symbol, look up user by email
      try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', prDoc.requestor));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const userData = querySnapshot.docs[0].data();
          
          // Use firstName and lastName if available
          if (userData.firstName && userData.lastName) {
            const fullName = `${userData.firstName} ${userData.lastName}`.trim();
            console.debug('Using user firstName/lastName from requestor string email lookup', fullName);
            return fullName;
          }
          
          // Use name field if available
          if (userData.name) {
            console.debug('Using user.name from requestor string email lookup', userData.name);
            return userData.name;
          }
          
          // Use displayName if available
          if (userData.displayName) {
            console.debug('Using user.displayName from requestor string email lookup', userData.displayName);
            return userData.displayName;
          }
          
          console.debug('User found by requestor string email but no name fields available', userData);
        } else {
          console.warn(`No user found with email ${prDoc.requestor}`);
        }
      } catch (error) {
        console.error('Error looking up user by requestor string email', {
          error: error instanceof Error ? error.message : String(error),
          requestorEmail: prDoc.requestor
        });
      }
    }
    
    // Last resort - return a placeholder indicating we couldn't find the name
    console.warn('Could not determine requestor name from any available data');
    return 'Unknown Requestor';
  }
  
  /**
   * Formats a human-readable name from an email address
   */
  private nameFromEmail(email: string): string {
    if (!email || !email.includes('@')) return email;
    
    // Extract username part
    const username = email.split('@')[0];
    
    // Clean and capitalize the username
    return username
      .split(/[._-]/)
      .map((part: string) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  }

  private async getPRDocument(prId: string, maxRetries: number = 5): Promise<any> {
    // Increase retries and wait time to handle Firestore's eventual consistency
    const retryDelays = [200, 500, 1000, 1500, 2000]; // Progressive backoff
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Try to get the document from Firestore
        const prRef = doc(db, 'prs', prId);
        const prSnap = await getDoc(prRef);
        
        if (prSnap.exists()) {
          console.log(`Successfully retrieved PR document from Firestore on attempt ${attempt}/${maxRetries}: ${prId}`);
          return { id: prSnap.id, ...prSnap.data() };
        }
        
        // If not found and this is not the last attempt, wait and retry with progressive backoff
        if (attempt < maxRetries) {
          const delay = retryDelays[attempt - 1] || 1000;
          console.log(`PR document not found in Firestore (attempt ${attempt}/${maxRetries}): ${prId}. Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        // If not found after all retries, log a warning but don't fail - we'll use the in-memory data
        console.warn(`PR document not found in Firestore after ${maxRetries} attempts and ~${retryDelays.reduce((a, b) => a + b, 0)}ms: ${prId}. This may be due to Firestore's eventual consistency or the document was not created successfully.`);
        return null;
      } catch (error) {
        console.error(`Error fetching PR document (attempt ${attempt}/${maxRetries})`, { 
          error: error instanceof Error ? error.message : String(error),
          prId 
        });
        
        // If this is not the last attempt, wait and retry
        if (attempt < maxRetries) {
          const delay = retryDelays[attempt - 1] || 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        return null;
      }
    }
    
    return null;
  }
}

export const submitPRNotification = new SubmitPRNotificationHandler();
