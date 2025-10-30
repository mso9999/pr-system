# Approver Quote Selection with Red-Flag Conflict Resolution

**Date:** October 30, 2025  
**Status:** ✅ Implemented - Revised Approach

## Overview

Implemented comprehensive quote selection functionality for approvers with a **red-flag conflict resolution system**. When quote conflicts occur, PRs stay in PENDING_APPROVAL status but are visually red-flagged, with daily reminder notifications sent until resolved.

---

## 🎯 Key Design Decision

**NO NEW STATUS NEEDED**  
Instead of creating a `PENDING_ADJUDICATION` status, quote conflicts are handled via:
- PR stays in `PENDING_APPROVAL` status
- `quoteConflict` flag in `approvalWorkflow` object
- Visual red flag (🚩) indicators
- Daily automated reminder emails

---

## 📋 Implementation Summary

### 1. Data Model (`src/types/pr.ts`)

**No new status** - Kept existing statuses
**ApprovalWorkflow Interface Enhanced:**
```typescript
export interface ApprovalWorkflow {
  firstApproverSelectedQuoteId?: string;  // Quote selected by first approver
  secondApproverSelectedQuoteId?: string; // Quote selected by second approver
  quoteConflict?: boolean;                 // RED FLAG indicator
  // ... other fields
}
```

---

### 2. Quote Selection UI (`src/components/pr/ApproverActions.tsx`)

**Features:**
- ✅ Quote selection interface when approving with multiple quotes
- ✅ Visual badges: "Lowest Quote" (green), "Procurement Preferred" (blue)
- ✅ Justification required for non-lowest quote selection
- ✅ Conflict detection when both approvers select different quotes
- ✅ **PR stays in PENDING_APPROVAL** with conflict flag set
- ✅ **Red flag alert** with 🚩 icon and error styling
- ✅ Conflict resolution via quote re-selection
- ✅ Auto-approval when both select same quote

**Red Flag Alert UI:**
```jsx
<Alert 
  severity="error" 
  icon={<span style={{ fontSize: '24px' }}>🚩</span>}
  sx={{ 
    border: '2px solid',
    borderColor: 'error.main',
    backgroundColor: 'error.light'
  }}
>
  <Typography>⚠️ QUOTE CONFLICT - RED FLAGGED</Typography>
  <Typography>Daily reminder notifications will be sent until resolved.</Typography>
</Alert>
```

---

### 3. Conflict Detection Logic

**When Both Approvers Complete:**
```typescript
const quoteConflict = firstComplete && secondComplete && 
                      firstQuoteId && secondQuoteId && 
                      firstQuoteId !== secondQuoteId;

if (quoteConflict) {
  // Stay in PENDING_APPROVAL, set conflict flag
  await prService.updatePR(pr.id, {
    approvalWorkflow: {
      ...updatedWorkflow,
      quoteConflict: true  // RED FLAG
    }
  });
  
  // Send immediate notification with special prefix
  await notificationService.handleStatusChange(
    pr.id,
    PRStatus.PENDING_APPROVAL,
    PRStatus.PENDING_APPROVAL,  // Same status!
    currentUser,
    `QUOTE_CONFLICT: Both approvers selected different quotes...`
  );
}
```

---

### 4. Notification System

**Immediate Conflict Notification:**
- Handler: `src/services/notifications/transitions/quoteConflictDetected.ts`
- Detects conflict via `QUOTE_CONFLICT:` prefix in notes
- Special case: `PENDING_APPROVAL → PENDING_APPROVAL` transition
- Recipients:
  - **TO:** Both approvers
  - **CC:** Procurement, Requestor

**Email Content:**
- 🚩 Red flag icon in subject line
- Clear explanation of conflict
- Table showing each approver's selection
- Step-by-step resolution instructions
- Note about daily reminders

---

### 5. Daily Reminder System

**Scheduled Cloud Function:**
- File: `functions/src/scheduled/sendDailyQuoteConflictReminders.ts`
- Schedule: Every day at 9:00 AM (Lesotho time)
- Query: PRs with `status === 'PENDING_APPROVAL' AND quoteConflict === true`

**Daily Email includes:**
- Days in conflict counter
- Conflicting quote selections
- Action required instructions
- Link to PR
- Note that reminders will continue

**Function Logic:**
```typescript
export const sendDailyQuoteConflictReminders = functions.pubsub
  .schedule('0 9 * * *')
  .timeZone('Africa/Maseru')
  .onRun(async (context) => {
    // Query conflicted PRs
    const conflicts = await db
      .collection('purchaseRequests')
      .where('status', '==', 'PENDING_APPROVAL')
      .where('approvalWorkflow.quoteConflict', '==', true)
      .get();
    
    // Send reminders to each
    // Track days in conflict
    // Log notifications
  });
```

---

### 6. Conflict Resolution Workflow

```
┌─────────────────────────────────────────┐
│ PR in PENDING_APPROVAL                   │
│ Both approvers approve                   │
└───────────────┬─────────────────────────┘
                │
        ┌───────┴───────┐
        │               │
    Same Quote?     Different Quotes?
        │               │
        ▼               ▼
    APPROVED    🚩 RED FLAGGED
                (stays PENDING_APPROVAL)
                quoteConflict = true
                │
                ├─ Immediate notification
                ├─ Daily reminders at 9AM
                └─ Visual red alert
                │
        ┌───────┴───────┐
        │               │
   One changes     Still different
   to match           │
        │             └─ Daily reminders continue
        ▼
   Conflict Resolved!
   quoteConflict = false
   → APPROVED ✅
```

---

## 🎨 Visual Indicators

### Red Flag Alert Banner:
- **Color Scheme:** Error red (#d32f2f)
- **Icon:** 🚩 (red flag emoji)
- **Border:** 2px solid red
- **Background:** Light red/pink
- **Prominence:** Displays at top of PR actions section

### Key Messages:
- "⚠️ QUOTE CONFLICT - RED FLAGGED"
- "🔴 ACTION REQUIRED"
- "Daily reminder notifications will be sent until this conflict is resolved"

---

## 📧 Email Communication

### Initial Conflict Notification:
**Subject:** `🚩 ACTION REQUIRED: Quote Conflict - PR [number] Needs Agreement`

### Daily Reminders:
**Subject:** `🚩 DAILY REMINDER: Quote Conflict - PR [number] (Day X)`

**Content includes:**
- Days in conflict
- Comparison table of selections
- Resolution steps
- Direct link to PR
- Assurance that reminders will continue

---

## 🔧 Technical Files Modified

### Frontend:
1. **src/types/pr.ts** - Removed PENDING_ADJUDICATION, kept conflict flag
2. **src/components/pr/ApproverActions.tsx** - Quote selection UI and conflict handling
3. **src/services/notifications/transitions/quoteConflictDetected.ts** - New handler
4. **src/services/notifications/transitions/index.ts** - Handler registration

### Backend:
1. **functions/src/scheduled/sendDailyQuoteConflictReminders.ts** - New scheduled function
2. **functions/src/index.ts** - Export scheduled function

### Documentation:
1. **Specifications.md** - Updated workflow documentation
2. **docs/APPROVER_QUOTE_SELECTION_REVISED_2025-10-30.md** - This document

---

## ✅ Business Rules

| Scenario | Status | Conflict Flag | Notifications |
|----------|--------|---------------|---------------|
| Both approve same quote | PENDING_APPROVAL → APPROVED | false | Success notification |
| Both approve different quotes | Stays PENDING_APPROVAL | **true** 🚩 | Immediate + Daily |
| One changes to match | PENDING_APPROVAL → APPROVED | false → cleared | Resolution notification |
| Still different after change | Stays PENDING_APPROVAL | **true** 🚩 | Daily reminders continue |

---

## 🧪 Test Scenarios

✅ **To Verify:**
1. Single approver can select and approve quote
2. Justification required for non-lowest quote
3. Dual approval with same quote → Direct to APPROVED
4. Dual approval with different quotes → Red flagged, stays PENDING_APPROVAL
5. Immediate notification sent on conflict
6. Red flag alert displays prominently
7. Approver can change selection while red-flagged
8. Conflict resolves automatically when both match
9. Daily reminders sent at 9 AM
10. Reminders stop after resolution

---

## 🌟 Key Advantages of This Approach

### Simpler:
- No new status to manage
- Single source of truth: PENDING_APPROVAL
- Less complex status transitions

### Clearer:
- Red flag visually indicates problem
- Status doesn't change, making it obvious what state the PR is in
- "Still waiting for approval" is clear to all stakeholders

### More Persistent:
- Daily reminders ensure conflicts don't get forgotten
- Red flag stays visible until resolved
- Automatic tracking of days in conflict

### Less Confusing:
- Approvers don't see a status they don't understand
- Dashboard filters don't need adjustment
- Reporting stays simple

---

## 📊 Monitoring

### Notification Logs:
```firestore
collection: notificationLogs
{
  type: 'QUOTE_CONFLICT_REMINDER',
  prId: string,
  prNumber: string,
  recipients: string[],
  daysInConflict: number,
  status: 'sent' | 'failed',
  timestamp: Timestamp
}
```

### Query for Current Conflicts:
```firestore
purchaseRequests
  .where('status', '==', 'PENDING_APPROVAL')
  .where('approvalWorkflow.quoteConflict', '==', true)
```

---

## 🚀 Deployment Notes

### Firebase Configuration Needed:
```bash
# Set app URL for email links
firebase functions:config:set app.url="https://pr-system.1pwrafrica.com"

# Deploy functions
firebase deploy --only functions:sendDailyQuoteConflictReminders
```

### SMTP Configuration (Already set):
- Using cPanel SMTP via Nodemailer
- Configuration set via `functions.config().smtp`

---

## 📝 User Documentation

### For Approvers:

**When You See a Red Flag:**
1. A red alert banner will show at the top of the PR
2. You'll see which quote you selected vs. the other approver
3. Click "Approve" to change your selection
4. Select the quote you wish to approve
5. When both of you agree, the PR automatically proceeds to APPROVED

**Daily Reminders:**
- You'll receive an email every day at 9 AM until resolved
- Email shows how many days the conflict has been active
- Includes direct link to resolve

**For Procurement:**
- You'll be CC'd on all conflict notifications
- You can see red-flagged PRs in the dashboard (🚩 indicator)
- You cannot resolve the conflict - approvers must agree

---

## ✨ Summary

This revised approach provides a **cleaner, simpler** implementation of quote conflict resolution:

- ✅ No new status needed
- ✅ Clear visual indicators (red flag)
- ✅ Persistent daily reminders
- ✅ Automatic resolution when agreement reached
- ✅ Simple to understand for all users
- ✅ Easy to monitor and track

The system ensures quote conflicts cannot be forgotten or ignored, while keeping the approval workflow straightforward and intuitive.

**Status:** ✅ Complete and Ready for Testing


