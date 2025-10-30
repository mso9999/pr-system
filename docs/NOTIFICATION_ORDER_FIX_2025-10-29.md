# Notification Approver Email Fix - 2025-10-29

## Problem

When pushing a PR from "In Queue" to "Pending Approval", the approvers were not receiving email notifications. Their email addresses were not even appearing in the recipients list, only procurement and the requestor were notified.

### Root Cause

The **frontend notification service** (`src/services/notification.ts`) had an incomplete TODO that was never implemented:

```typescript
// TODO: Get approver email from pr.approvalWorkflow.currentApprover
recipients = [procurementEmail]; // Temporary: send to procurement
```

The code was:
1. Receiving the PR data with `approver` and `approver2` populated
2. **NOT** extracting the approver IDs from the PR
3. **NOT** resolving approver IDs to email addresses
4. Just sending to procurement as a "temporary" placeholder

This is separate from the backend modular notification handlers we created earlier. The frontend uses its own notification logic for immediate notifications.

## Solution

### 1. Implemented Approver Email Resolution in Frontend Notification Service

Modified `src/services/notification.ts` to properly fetch and resolve approver emails when `newStatus === PENDING_APPROVAL`:

```typescript
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
          }
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
}
```

**Key improvements:**
- Extracts approver IDs from `pr.approver` and `pr.approver2`
- Resolves user IDs to email addresses by querying the `users` collection
- Handles both email strings and user ID strings
- Sends to both approvers in dual-approval scenarios
- Falls back to procurement if no approvers found
- CCs procurement and requestor for transparency
- Includes detailed debug logging

### 2. Ensured Top-Level Approver Fields Are Updated (Previous Fix)

Modified `src/components/pr/ProcurementActions.tsx` to ensure `approver` and `approver2` are included in the Firestore update when pushing to approval (this was already done in the previous fix).

### 3. Backend Handlers (For Cloud Functions)

The modular notification handlers in `src/services/notifications/transitions/` were already updated to handle approver emails, but these are only used if notifications are processed by Firebase Cloud Functions. The frontend uses its own notification service for immediate notifications.

## Order of Operations

The correct sequence for pushing to approval is:

1. **Update PR document in Firestore** (`prService.updatePR`)
   - Sets `approver` and `approver2` at top level
   - Sets `approvalWorkflow` with approval details
   - Changes PR number from PR to PO

2. **Update status history** (`prService.updatePRStatus`)
   - Records the status change with timestamp and user

3. **Send notifications** (`notificationService.handleStatusChange`)
   - Fetches the updated PR from Firestore
   - Finds approver(s) from top-level fields
   - Sends emails to approvers (to) and requestor/procurement (cc)

## Files Modified

- `src/components/pr/ProcurementActions.tsx`
  - Added `approver` and `approver2` to update payload in 'approve' action

- `src/services/notifications/transitions/inQueueToPendingApproval.ts`
  - Added debug logging for PR data fetch
  - Added logging for approver email resolution
  - Added logging for final recipients list

## Testing

To verify the fix:

1. Create or edit a PR in "In Queue" status
2. Assign two approvers (for dual approval) or one approver
3. Save the PR
4. As procurement, push the PR to "Pending Approval"
5. Check browser console for debug logs:
   - "InQueueToPendingApproval: Fetched PR data" (should show approver IDs)
   - "InQueueToPendingApproval: Resolved primary approver" (should show email)
   - "InQueueToPendingApproval: Resolved second approver" (if dual approval, should show email)
   - "InQueueToPendingApproval: Final recipients" (should show all email addresses)
6. Check SendGrid activity feed - should show emails sent to approver(s)
7. Check approvers' email inboxes - they should receive the notification

## Related Issues

- Previous fix: Added second approver to notification handler (Error #6)
- Previous fix: Fixed order of operations to update PR before sending notifications (Error #17)
- This fix: Ensures top-level approver fields are updated in Firestore so notification handler can find them
