import { PRStatus } from '../../../types/pr';
import { StatusTransitionHandler } from '../types';
import { NewPRSubmittedHandler } from './newPRSubmitted';
import { SubmittedToRevisionRequiredHandler } from './submittedToRevisionRequired';
import { RevisionRequiredToResubmittedHandler } from './revisionRequiredToResubmitted';
import { SubmittedToPendingApprovalHandler } from './submittedToPendingApproval';
import { PendingApprovalToApprovedHandler } from './pendingApprovalToApproved';
import { PendingApprovalToRejectedHandler } from './pendingApprovalToRejected';
import { QuoteConflictDetectedHandler } from './quoteConflictDetected';
import { SubmittedToInQueueHandler } from './submittedToInQueue';
import { InQueueToRejectedHandler } from './inQueueToRejected';
import { InQueueToRevisionRequiredHandler } from './inQueueToRevisionRequired';
import { InQueueToPendingApprovalHandler } from './inQueueToPendingApproval';
import { RevisionRequiredToSubmittedHandler } from './revisionRequiredToSubmitted';
import { RevisionRequiredRevertHandler } from './revisionRequiredRevert';
import { RevisionRequiredToRejectedHandler } from './revisionRequiredToRejected';

// Map of status transitions to their handlers
const transitionHandlers = new Map<string, StatusTransitionHandler>();

// Helper function to create transition key
function createTransitionKey(oldStatus: PRStatus | null, newStatus: PRStatus): string {
  return `${oldStatus || 'NEW'}->${newStatus}`;
}

// Register all transition handlers
transitionHandlers.set(createTransitionKey(null, PRStatus.SUBMITTED), new NewPRSubmittedHandler());
transitionHandlers.set(createTransitionKey(PRStatus.SUBMITTED, PRStatus.IN_QUEUE), new SubmittedToInQueueHandler());
transitionHandlers.set(createTransitionKey(PRStatus.SUBMITTED, PRStatus.REVISION_REQUIRED), new SubmittedToRevisionRequiredHandler());
transitionHandlers.set(createTransitionKey(PRStatus.SUBMITTED, PRStatus.PENDING_APPROVAL), new SubmittedToPendingApprovalHandler());
transitionHandlers.set(createTransitionKey(PRStatus.SUBMITTED, PRStatus.REJECTED), new InQueueToRejectedHandler()); // Can reject from SUBMITTED
transitionHandlers.set(createTransitionKey(PRStatus.REVISION_REQUIRED, PRStatus.SUBMITTED), new RevisionRequiredToSubmittedHandler());
transitionHandlers.set(createTransitionKey(PRStatus.REVISION_REQUIRED, PRStatus.RESUBMITTED), new RevisionRequiredToResubmittedHandler());
transitionHandlers.set(createTransitionKey(PRStatus.REVISION_REQUIRED, PRStatus.REJECTED), new RevisionRequiredToRejectedHandler());
// Revert handlers - from REVISION_REQUIRED back to any previous status
transitionHandlers.set(createTransitionKey(PRStatus.REVISION_REQUIRED, PRStatus.IN_QUEUE), new RevisionRequiredRevertHandler());
transitionHandlers.set(createTransitionKey(PRStatus.REVISION_REQUIRED, PRStatus.PENDING_APPROVAL), new RevisionRequiredRevertHandler());
transitionHandlers.set(createTransitionKey(PRStatus.IN_QUEUE, PRStatus.PENDING_APPROVAL), new InQueueToPendingApprovalHandler());
transitionHandlers.set(createTransitionKey(PRStatus.IN_QUEUE, PRStatus.REJECTED), new InQueueToRejectedHandler());
transitionHandlers.set(createTransitionKey(PRStatus.IN_QUEUE, PRStatus.REVISION_REQUIRED), new InQueueToRevisionRequiredHandler());
transitionHandlers.set(createTransitionKey(PRStatus.PENDING_APPROVAL, PRStatus.APPROVED), new PendingApprovalToApprovedHandler());
transitionHandlers.set(createTransitionKey(PRStatus.PENDING_APPROVAL, PRStatus.REJECTED), new PendingApprovalToRejectedHandler());
transitionHandlers.set(createTransitionKey(PRStatus.PENDING_APPROVAL, PRStatus.PENDING_APPROVAL), new QuoteConflictDetectedHandler()); // Special case: Quote conflict detection
transitionHandlers.set(createTransitionKey(PRStatus.PENDING_APPROVAL, PRStatus.REVISION_REQUIRED), new InQueueToRevisionRequiredHandler()); // Can request revision from PENDING_APPROVAL

export function getTransitionHandler(oldStatus: PRStatus | null, newStatus: PRStatus): StatusTransitionHandler | undefined {
  return transitionHandlers.get(createTransitionKey(oldStatus, newStatus));
}
