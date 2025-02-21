import { PRStatus } from '../../types/pr';
import { StatusTransitionHandler } from './types';
import { NewPRSubmittedHandler } from './transitions/newPRSubmitted';
import { SubmittedToRevisionRequiredHandler } from './transitions/submittedToRevisionRequired';
import { RevisionRequiredToResubmittedHandler } from './transitions/revisionRequiredToResubmitted';
import { SubmittedToPendingApprovalHandler } from './transitions/submittedToPendingApproval';
import { PendingApprovalToApprovedHandler } from './transitions/pendingApprovalToApproved';
import { PendingApprovalToRejectedHandler } from './transitions/pendingApprovalToRejected';

// Map of status transitions to their handlers
const transitionHandlers = new Map<string, StatusTransitionHandler>();

// Helper function to create transition key
function createTransitionKey(oldStatus: PRStatus | null, newStatus: PRStatus): string {
  return `${oldStatus || 'NEW'}->${newStatus}`;
}

// Register all transition handlers
transitionHandlers.set(createTransitionKey(null, PRStatus.SUBMITTED), new NewPRSubmittedHandler());
transitionHandlers.set(createTransitionKey(PRStatus.SUBMITTED, PRStatus.REVISION_REQUIRED), new SubmittedToRevisionRequiredHandler());
transitionHandlers.set(createTransitionKey(PRStatus.REVISION_REQUIRED, PRStatus.SUBMITTED), new RevisionRequiredToResubmittedHandler());
transitionHandlers.set(createTransitionKey(PRStatus.SUBMITTED, PRStatus.PENDING_APPROVAL), new SubmittedToPendingApprovalHandler());
transitionHandlers.set(createTransitionKey(PRStatus.PENDING_APPROVAL, PRStatus.APPROVED), new PendingApprovalToApprovedHandler());
transitionHandlers.set(createTransitionKey(PRStatus.PENDING_APPROVAL, PRStatus.REJECTED), new PendingApprovalToRejectedHandler());

export function getTransitionHandler(oldStatus: PRStatus | null, newStatus: PRStatus): StatusTransitionHandler | undefined {
  return transitionHandlers.get(createTransitionKey(oldStatus, newStatus));
}
