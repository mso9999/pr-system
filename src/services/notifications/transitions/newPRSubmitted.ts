import { StatusTransitionHandler, NotificationContext, Recipients, EmailContent } from '../types';
import { generateNewPREmail } from '../templates/newPRSubmitted';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
// import { logger } from '@/utils/logger';
import { UserReference } from '@/types/pr';

// Define procurement email constant
const PROCUREMENT_EMAIL = 'procurement@1pwrafrica.com';

export class NewPRSubmittedHandler implements StatusTransitionHandler {
  async getRecipients(context: NotificationContext): Promise<Recipients> {
    // Check if a notification has already been sent for this PR
    const hasExistingNotification = await this.checkForExistingNotification(context.prId);
    if (hasExistingNotification) {
      console.info('Notification already sent for this PR. Skipping duplicate.');
      return { to: [], cc: [] }; // Return empty recipients to prevent sending
    }
    
    // Get the requestor email from the PR, ensuring lowercase for comparison
    const requestorEmail = (context.pr?.requestorEmail || context.pr?.requestor?.email)?.toLowerCase();
    const submitterEmail = context.user?.email?.toLowerCase();
    
    // Create CC list with unique emails only (using lowercase)
    const ccList = new Set<string>();
    
    // Add requestor if they're not the submitter
    if (requestorEmail && requestorEmail !== submitterEmail) {
      ccList.add(requestorEmail);
    }
    
    // Add submitter to CC if they're not the requestor
    if (submitterEmail && submitterEmail !== requestorEmail) {
      ccList.add(submitterEmail);
    }
    
    console.debug('NewPRSubmittedHandler recipients:', { 
      to: [PROCUREMENT_EMAIL], 
      cc: Array.from(ccList) 
    });
    
    return {
      to: [PROCUREMENT_EMAIL],
      cc: Array.from(ccList)
    };
  }

  /**
   * Fetches user information from Firestore by email or ID
   * @param emailOrId User email or ID to fetch
   * @returns UserReference object or null if not found
   */
  private async getUserByEmailOrId(emailOrId: string): Promise<UserReference | null> {
    if (!emailOrId) {
      console.warn('Attempted to fetch user with empty email or ID');
      return null;
    }
    
    const identifier = emailOrId.trim();
    const isEmail = identifier.includes('@');
    
    try {
      // Query by email (case-insensitive)
      if (isEmail) {
        const usersRef = collection(db, 'users');
        // IMPORTANT: Ensure Firestore index exists for 'email' field
        const q = query(usersRef, where('email', '==', identifier.toLowerCase())); 
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const userDoc = querySnapshot.docs[0];
          const userData = userDoc.data();
          return {
            id: userDoc.id,
            email: userData.email || identifier,
            firstName: userData.firstName || '',
            lastName: userData.lastName || '',
            name: userData.name || userData.displayName || `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || identifier
          };
        }
      }
      
      // If not found by email or not an email, try by ID
      const userDoc = await getDoc(doc(db, 'users', identifier));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        return {
          id: userDoc.id,
          email: userData.email || '', // May not have email if fetched by ID
          firstName: userData.firstName || '',
          lastName: userData.lastName || '',
          name: userData.name || userData.displayName || `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || identifier // Fallback to ID if no name
        };
      }
      
      // If we get here, user wasn't found
      console.warn(`User not found for identifier: ${identifier}`);
      return null;
    } catch (error) {
      // Log the specific error, especially if it's an index issue
      console.error(`Error fetching user by identifier ${identifier}:`, error);
      if (error instanceof Error && error.message.includes('index')) {
        console.error('Firestore index likely missing for the users collection query.');
      }
      return null;
    }
  }

  async getEmailContent(context: NotificationContext): Promise<EmailContent> {
    // Ensure we have a valid PR object
    if (!context.pr) {
      console.error('Missing PR object in notification context');
      throw new Error('Missing PR object in notification context');
    }

    // --- Start Refactoring ---
    // Use the requestor object directly from the PR context if available
    // (Assumes createPR now saves the full object)
    let finalRequestor: UserReference | null = null;
    console.debug('getEmailContent: Initial context.pr.requestor:', context.pr.requestor);

    if (context.pr.requestor && typeof context.pr.requestor === 'object' && context.pr.requestor.name) {
       finalRequestor = context.pr.requestor as UserReference;
       console.debug('getEmailContent: Using requestor object directly from PR context:', finalRequestor);
    } else {
       console.warn('getEmailContent: Entering fallback logic.', {
         requestorField: context.pr.requestor, 
         type: typeof context.pr.requestor
       }); 
       // Fallback: Try fetching if only ID or email is present (should be less common now)
       const identifier = context.pr.requestorId || context.pr.requestorEmail || (typeof context.pr.requestor === 'object' ? context.pr.requestor.email : null);
       if (identifier) {
         console.warn('getEmailContent: Requestor object incomplete/missing in PR context, attempting fallback fetch...', { prId: context.pr.id, identifier });
         finalRequestor = await this.getUserByEmailOrId(identifier);
         console.debug('getEmailContent: Fallback fetch result:', finalRequestor);
       }
       
       if (!finalRequestor) {
         // If still not found, create a placeholder
         console.warn('Could not resolve requestor, using placeholder.', { prId: context.pr.id });
         finalRequestor = {
           id: context.pr.requestorId || 'unknown',
           email: context.pr.requestorEmail || 'unknown@example.com',
           name: 'Unknown Requestor'
         };
       }
    }

    // Ensure the PR object in the context has the resolved requestor
    context.pr.requestor = finalRequestor;

    // Format submitter information (can remain the same)
    const submitterName = context.user?.name || 
                         ((context.user?.firstName && context.user?.lastName) ? 
                         `${context.user?.firstName || ''} ${context.user?.lastName || ''}`.trim() : 
                         context.user?.email || 'Unknown Submitter');

    // Pass the context (now with guaranteed requestor object) to the template generator
    // The template `generateNewPREmail` should be updated to *expect* `context.pr.requestor` to be populated.
    // We remove the complex fetching logic from here as it's now redundant or a fallback.
    console.debug('Passing context to email template generator:', { 
      prId: context.pr.id, 
      requestor: context.pr.requestor, 
      submitterName 
    });
    return generateNewPREmail(context);
    // --- End Refactoring ---
  }

  /**
   * Checks if a notification has already been sent for this PR
   * @param prId PR ID to check
   * @returns boolean indicating if notification exists
   */
  private async checkForExistingNotification(prId: string): Promise<boolean> {
    try {
      const notificationsRef = collection(db, 'purchaseRequestsNotifications');
      const q = query(notificationsRef, where('prId', '==', prId), where('type', '==', 'NEW_PR_SUBMITTED'));
      const querySnapshot = await getDocs(q);
      return !querySnapshot.empty;
    } catch (error) {
      console.error('Error checking for existing notification:', error);
      return false; // Assume no notification exists if there's an error
    }
  }
}
