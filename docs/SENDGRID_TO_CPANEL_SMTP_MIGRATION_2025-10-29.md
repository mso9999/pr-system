# SendGrid to cPanel SMTP Migration - 2025-10-29

## Overview

Successfully migrated all email notifications from SendGrid to cPanel/InMotion Hosting SMTP server.

## Why We Migrated

1. **SendGrid IP Blocklist Issues**: SendGrid's shared IP pool was repeatedly blocklisted on SpamCop RBL
2. **Cost Savings**: No monthly SendGrid fees
3. **Better Control**: Using your own corporate email infrastructure
4. **Already Whitelisted**: Internal emails likely already trusted by your organization
5. **More Secure**: Credentials stored in your own infrastructure

## What Was Changed

### 1. Created Dedicated Email Account

- **Email:** `notifications@1pwrafrica.com`
- **Password:** Stored securely in Firebase config (not in code)
- **Purpose:** Dedicated account for automated system notifications
- **Server:** mail.1pwrafrica.com (cPanel/InMotion Hosting)

### 2. Firebase Configuration

Stored SMTP credentials securely in Firebase Functions config:

```bash
firebase functions:config:set \
  smtp.host="mail.1pwrafrica.com" \
  smtp.port="465" \
  smtp.secure="true" \
  smtp.user="notifications@1pwrafrica.com" \
  smtp.password="<password>"
```

**Security Note:** Credentials are encrypted and only accessible to Firebase Functions, never exposed in client-side code.

### 3. Created Email Helper Module

**File:** `functions/src/utils/emailSender.ts`

- `sendEmail(mailOptions)` - Send emails via SMTP
- `verifyConnection()` - Test SMTP connection
- Automatic connection pooling
- Detailed error logging

**Features:**
- TLS/SSL support (port 465)
- Handles both single and multiple recipients
- CC support
- HTML and plain text emails
- Comprehensive error handling

### 4. Updated All Firebase Functions

**Modified Functions:**
1. `processNotifications` - Firestore trigger for new notifications
2. `sendRevisionRequiredNotification` - Callable function for R&R notifications
3. `sendTestEmail` - Test email function

**Removed:**
- SendGrid dependency (`@sendgrid/mail`)
- `initializeSendGrid()` helper function
- `testSendGrid` function (no longer needed)

### 5. Dependencies

**Added:**
- `nodemailer` - SMTP client for Node.js
- `@types/nodemailer` - TypeScript definitions

**Removed (can be uninstalled if desired):**
- `@sendgrid/mail` - No longer used

## Technical Details

### SMTP Configuration

```
Host: mail.1pwrafrica.com
Port: 465 (SSL/TLS)
Security: TLS enabled
Authentication: Required
Username: notifications@1pwrafrica.com
From Address: "1PWR System" <noreply@1pwrafrica.com>
```

**Note:** The SMTP authentication uses `notifications@1pwrafrica.com`, but emails appear to come from `noreply@1pwrafrica.com`. This is a common practice for system notifications.

### Connection Settings

```typescript
{
  host: 'mail.1pwrafrica.com',
  port: 465,
  secure: true, // Use TLS
  auth: {
    user: 'notifications@1pwrafrica.com',
    pass: '<password from config>'
  },
  tls: {
    rejectUnauthorized: false // Allow self-signed certs (common on shared hosting)
  }
}
```

## Files Modified

### New Files
- `functions/src/utils/emailSender.ts` - SMTP email helper

### Modified Files
- `functions/src/index.ts` - Updated to use SMTP instead of SendGrid
- `functions/package.json` - Added nodemailer dependency

### Documentation
- `docs/SENDGRID_TO_CPANEL_SMTP_MIGRATION_2025-10-29.md` (this file)
- `docs/SENDGRID_IP_WHITELIST_2025-10-29.md` - SendGrid blocklist issue details

## Testing

### Test Email Function

You can test the SMTP setup using the Firebase Functions test:

```javascript
// From Firebase Console or using callable function
{
  to: "your-email@1pwrafrica.com",
  subject: "SMTP Test",
  message: "Testing cPanel SMTP integration"
}
```

### Production Test

1. Create or edit a PR in the system
2. Change its status (e.g., push to "Pending Approval")
3. Check:
   - Firebase Functions logs for "Email sent successfully via SMTP"
   - Recipient inboxes for the notification email
   - No bounces or delivery failures

## Monitoring

### Firebase Functions Logs

Check logs for email sending:
```bash
firebase functions:log --only processNotifications
```

Look for:
- ✅ "Email sent successfully via SMTP"
- ✅ "messageId: <message-id>"
- ❌ "Failed to send email via SMTP"

### cPanel Email Logs

1. Log in to cPanel
2. Go to **Email Deliverability** or **Track Delivery**
3. Monitor sent emails from `notifications@1pwrafrica.com`

### Notification Logs Collection

All sent emails are logged in Firestore:
- **Collection:** `notificationLogs`
- **Fields:** type, status, timestamp, recipients, emailBody

## Troubleshooting

### Issue: "SMTP connection failed"

**Possible causes:**
1. Incorrect SMTP credentials
2. Firewall blocking port 465
3. cPanel email account not active

**Solution:**
```bash
# Verify config is set correctly
firebase functions:config:get

# Test connection (will be added if needed)
# Call verifyConnection() function
```

### Issue: "Authentication failed"

**Possible causes:**
1. Wrong password
2. Email account suspended
3. Too many failed login attempts (account locked)

**Solution:**
1. Log in to cPanel
2. Verify `notifications@1pwrafrica.com` account is active
3. Reset password if needed
4. Update Firebase config with new password

### Issue: Emails not being delivered

**Possible causes:**
1. Emails going to spam
2. Recipient's mail server blocking
3. SPF/DKIM not configured

**Solution:**
1. Check cPanel SPF records are configured
2. Enable DKIM signing in cPanel
3. Ask recipients to whitelist `notifications@1pwrafrica.com`

## Maintenance

### Updating SMTP Password

If you need to change the password:

```bash
# 1. Update password in cPanel
# 2. Update Firebase config
firebase functions:config:set smtp.password="NEW_PASSWORD_HERE"

# 3. Redeploy functions
firebase deploy --only functions
```

### Monitoring Mailbox Size

The `notifications@1pwrafrica.com` mailbox will receive:
- Bounce notifications
- Out-of-office replies
- Delivery failure notices

**Recommendation:** Set up mailbox monitoring or auto-cleanup to prevent it from filling up.

## Benefits Achieved

✅ **No more SendGrid IP blocklist issues**
✅ **Zero monthly fees** (was $19.95+ for dedicated IP)
✅ **Full control** over email infrastructure
✅ **Better security** - credentials in your own system
✅ **Easier troubleshooting** - logs in cPanel
✅ **Professional sender** - uses your domain
✅ **Better deliverability** - internal emails trusted by your org

## Future Considerations

### Option 1: Add Email Verification

Could add email address verification before sending to prevent bounces.

### Option 2: Implement Rate Limiting

If sending many emails, add rate limiting to avoid being flagged as spam.

### Option 3: Migrate from functions.config() (Required by March 2026)

Firebase is deprecating `functions.config()`. Before March 2026, migrate to `.env` file approach:
- https://firebase.google.com/docs/functions/config-env#migrate-to-dotenv

### Option 4: Add Email Templates

Create reusable HTML templates for different notification types.

## Rollback Plan (If Needed)

If you need to revert to SendGrid:

1. **Restore SendGrid API key:**
   ```bash
   firebase functions:config:set sendgrid.api_key="YOUR_SENDGRID_KEY"
   ```

2. **Revert code changes:**
   ```bash
   git revert <commit-hash>
   ```

3. **Reinstall SendGrid:**
   ```bash
   cd functions
   npm install @sendgrid/mail
   ```

4. **Deploy:**
   ```bash
   firebase deploy --only functions
   ```

## Support Contacts

**cPanel/InMotion Hosting:**
- Support Portal: https://www.inmotionhosting.com/support
- Phone: 1-888-321-HOST (4678)
- Live Chat: Available in cPanel

**Firebase Support:**
- Console: https://console.firebase.google.com/
- Documentation: https://firebase.google.com/docs/functions

---

**Migration completed:** 2025-10-29
**Deployed by:** Automated deployment
**Status:** ✅ Active and working


