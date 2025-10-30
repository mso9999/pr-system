# Notification System Fixes - Missing Transitions and SendGrid Issues

**Date:** October 29, 2025  
**Priority:** HIGH

## Issues Identified

### 1. Modular Notification System Not Being Used ⚠️

**Problem:** The codebase has a beautiful, well-designed modular notification system with transition handlers, but `src/services/notification.ts` is **NOT USING IT**.

**Current State:**
- ✅ Transition handlers exist in `src/services/notifications/transitions/`
- ✅ Handler registry exists in `src/services/notifications/transitions/index.ts`
- ✅ `getTransitionHandler()` function exists and works
- ❌ `notification.ts` uses hardcoded if/else logic instead of calling `getTransitionHandler()`

**Code Evidence:**
```typescript
// src/services/notification.ts lines 205-232
// Current HARDCODED logic:
if (newStatus === PRStatus.REVISION_REQUIRED || newStatus === PRStatus.REJECTED) {
  recipients = [requestorEmail];
  ccList.push(procurementEmail);
} else if (newStatus === PRStatus.PENDING_APPROVAL) {
  recipients = [procurementEmail]; // TODO: Get approver email  ❌
} else {
  recipients = [procurementEmail];
}
```

**What SHOULD Be Happening:**
```typescript
// Should be calling the modular system:
const handler = getTransitionHandler(oldStatus, newStatus);
if (handler) {
  const recipients = await handler.getRecipients(context);
  const emailContent = await handler.getEmailContent(context);
  // Use the handler's logic
}
```

### 2. Missing Transition Handlers

**Handlers that were missing (NOW CREATED):**
- ✅ `RevisionRequiredToSubmittedHandler` - For when requestor resubmits
- ✅ `RevisionRequiredRevertHandler` - For when procurement reverts from R&R
- ✅ `RevisionRequiredToRejectedHandler` - For when procurement rejects from R&R

**Handlers that existed but weren't registered:**
- ✅ `InQueueToPendingApprovalHandler` - Has proper approver email logic!

### 3. SendGrid IP Blocklisted 🚨

**Problem:** SendGrid's IP address is on SpamCop's RBL (Reputation Blocklist)

**Evidence:**
```json
{
  "event": "bounce",
  "email": "procurement@1pwrafrica.com",
  "reason": "550 \"JunkMail rejected - s.wrqvtzvf.outbound-mail.sendgrid.net [149.72.126.143]:30998 is in an RBL: Blocked - see https://www.spamcop.net/bl.shtml?149.72.126.143\"",
  "bounce_classification": "Reputation",
  "type": "blocked"
}
```

**Impact:** Even if notifications are triggered correctly, they won't be delivered.

**This is a SendGrid infrastructure issue, not a code issue.**

## Files Created/Modified

### Created Files:

1. **`src/services/notifications/transitions/revisionRequiredToSubmitted.ts`**
   - Handles: REVISION_REQUIRED → SUBMITTED (resubmit)
   - TO: Procurement
   - CC: Requestor

2. **`src/services/notifications/transitions/revisionRequiredRevert.ts`**
   - Handles: REVISION_REQUIRED → [Previous Status] (revert)
   - TO: Requestor
   - CC: Procurement
   - Supports reverting to: SUBMITTED, RESUBMITTED, IN_QUEUE, PENDING_APPROVAL

3. **`src/services/notifications/transitions/revisionRequiredToRejected.ts`**
   - Handles: REVISION_REQUIRED → REJECTED
   - TO: Requestor
   - CC: Procurement

### Modified Files:

1. **`src/services/notifications/transitions/index.ts`**
   - Imported new handlers
   - Registered all missing transitions in the handler map
   - Fixed incorrect handler for IN_QUEUE → PENDING_APPROVAL

**New Registrations:**
```typescript
// Resubmit from R&R
transitionHandlers.set('REVISION_REQUIRED->SUBMITTED', new RevisionRequiredToSubmittedHandler());
transitionHandlers.set('REVISION_REQUIRED->RESUBMITTED', new RevisionRequiredToResubmittedHandler());

// Reject from R&R
transitionHandlers.set('REVISION_REQUIRED->REJECTED', new RevisionRequiredToRejectedHandler());

// Revert from R&R to previous status
transitionHandlers.set('REVISION_REQUIRED->IN_QUEUE', new RevisionRequiredRevertHandler());
transitionHandlers.set('REVISION_REQUIRED->PENDING_APPROVAL', new RevisionRequiredRevertHandler());

// Fixed: Use correct handler with approver email logic
transitionHandlers.set('IN_QUEUE->PENDING_APPROVAL', new InQueueToPendingApprovalHandler());

// Added: Reject from SUBMITTED
transitionHandlers.set('SUBMITTED->REJECTED', new InQueueToRejectedHandler());

// Added: Request revision from PENDING_APPROVAL
transitionHandlers.set('PENDING_APPROVAL->REVISION_REQUIRED', new InQueueToRevisionRequiredHandler());
```

## Transition Coverage Map

| From Status | To Status | Handler | Status |
|------------|-----------|---------|--------|
| NEW | SUBMITTED | NewPRSubmittedHandler | ✅ Exists |
| SUBMITTED | IN_QUEUE | SubmittedToInQueueHandler | ✅ Exists |
| SUBMITTED | REVISION_REQUIRED | SubmittedToRevisionRequiredHandler | ✅ Exists |
| SUBMITTED | REJECTED | InQueueToRejectedHandler | ✅ Registered |
| SUBMITTED | PENDING_APPROVAL | SubmittedToPendingApprovalHandler | ✅ Exists |
| IN_QUEUE | PENDING_APPROVAL | InQueueToPendingApprovalHandler | ✅ Fixed |
| IN_QUEUE | REJECTED | InQueueToRejectedHandler | ✅ Exists |
| IN_QUEUE | REVISION_REQUIRED | InQueueToRevisionRequiredHandler | ✅ Exists |
| REVISION_REQUIRED | SUBMITTED | RevisionRequiredToSubmittedHandler | ✅ **CREATED** |
| REVISION_REQUIRED | RESUBMITTED | RevisionRequiredToResubmittedHandler | ✅ Exists |
| REVISION_REQUIRED | IN_QUEUE | RevisionRequiredRevertHandler | ✅ **CREATED** |
| REVISION_REQUIRED | PENDING_APPROVAL | RevisionRequiredRevertHandler | ✅ **CREATED** |
| REVISION_REQUIRED | REJECTED | RevisionRequiredToRejectedHandler | ✅ **CREATED** |
| PENDING_APPROVAL | APPROVED | PendingApprovalToApprovedHandler | ✅ Exists |
| PENDING_APPROVAL | REJECTED | PendingApprovalToRejectedHandler | ✅ Exists |
| PENDING_APPROVAL | REVISION_REQUIRED | InQueueToRevisionRequiredHandler | ✅ Registered |

## ⚠️ CRITICAL: notification.ts Still Not Using Handlers

**The main issue remains:** `src/services/notification.ts` needs to be refactored to USE the transition handler system.

**Current Code (Lines 205-232):**
- Uses hardcoded if/else logic
- Ignores the modular handler system
- Has TODO comment for approver email logic (but the handler has it!)

**Required Fix:**
The `handleStatusChange` function in `src/services/notification.ts` needs to be updated to:
1. Call `getTransitionHandler(oldStatus, newStatus)`
2. If handler exists, use `handler.getRecipients()` and `handler.getEmailContent()`
3. Fall back to default logic only if no handler exists

**This is why notifications aren't being sent correctly** - the system isn't using the correct handlers that have the proper recipient logic.

## SendGrid Blocklist Issue

### Root Cause
SendGrid IP `149.72.126.143` is on SpamCop's RBL due to reputation issues.

### Immediate Actions Needed

1. **Check SendGrid Dashboard:**
   - https://app.sendgrid.com/
   - Look for "Reputation" or "Deliverability" alerts
   - Check if there are any account warnings

2. **Request Removal from SpamCop:**
   - Visit: https://www.spamcop.net/bl.shtml?149.72.126.143
   - Follow delisting procedures
   - May require proving email practices are legitimate

3. **Consider SendGrid Alternatives (If Issue Persists):**
   - AWS SES (Amazon Simple Email Service)
   - Mailgun
   - Postmark
   - Resend.com

4. **Best Practices to Maintain Reputation:**
   - Implement proper SPF, DKIM, and DMARC records
   - Validate all email addresses before sending
   - Handle bounces and unsubscribes properly
   - Avoid sending to role-based emails excessively

### Temporary Workaround

While SendGrid is blocklisted, you could:
1. Use a different email service provider
2. Use a different SendGrid account (if available)
3. Route through a different IP pool in SendGrid settings

## Testing Recommendations

### After Fixing notification.ts:

1. **Test All R&R Transitions:**
   ```
   IN_QUEUE → REVISION_REQUIRED → SUBMITTED (resubmit)
   IN_QUEUE → REVISION_REQUIRED → IN_QUEUE (revert)
   SUBMITTED → REVISION_REQUIRED → REJECTED
   PENDING_APPROVAL → REVISION_REQUIRED → PENDING_APPROVAL (revert)
   ```

2. **Verify Email Recipients:**
   - Check Firestore `notifications` collection
   - Verify `recipients.to` and `recipients.cc` arrays
   - Confirm approver emails are included (not just procurement)

3. **Test SendGrid Delivery:**
   - Monitor SendGrid dashboard for delivery status
   - Check for any bounce/block events
   - Verify emails reach intended recipients

## Next Steps

### High Priority:
1. ✅ Create missing transition handlers (DONE)
2. ✅ Register all handlers (DONE)
3. ⚠️ **TODO: Refactor notification.ts to USE the handlers**
4. 🚨 **TODO: Fix SendGrid blocklist issue**

### Medium Priority:
5. Add error handling for missing handlers
6. Add logging to track which handler is used for each transition
7. Create tests for all transition handlers
8. Document expected email recipients for each transition

### Low Priority:
9. Consider moving notification system to Cloud Functions entirely
10. Implement retry logic with exponential backoff
11. Add notification preferences for users

## Related Documentation

- Transition handlers: `src/services/notifications/transitions/`
- Handler types: `src/services/notifications/types.ts`
- Main notification service: `src/services/notification.ts`
- R&R workflow: `docs/REVISION_REQUIRED_WORKFLOW_FIX_2025-10-29.md`
- Dual approver fix: `docs/DUAL_APPROVER_FIX_SUMMARY_2025-10-29.md`


