# SendGrid IP Whitelist Issue - 2025-10-29

## Problem

Email notifications sent to `procurement@1pwrafrica.com` are being blocked due to SendGrid's sender IP addresses being listed on SpamCop's RBL (Realtime Blacklist).

### Recent Blocked IPs

1. **First occurrence:** `149.72.126.143`
   - Bounce timestamp: 2025-10-29T19:52:10.000Z
   - Reason: "JunkMail rejected - Blocked on SpamCop"

2. **Second occurrence:** `149.72.120.130`
   - Bounce timestamp: 2025-10-29T22:07:02.000Z
   - Reason: "JunkMail rejected - Blocked on SpamCop"

### Root Cause

You are using SendGrid's **shared IP pool**, which means:
- Your emails are sent from a pool of IP addresses shared with other SendGrid customers
- If other customers send spam, the shared IPs get blocklisted
- The IP address changes with each email, making whitelisting ineffective
- New IPs keep appearing and getting blocked

## Solutions

### Option 1: Whitelist SendGrid's IP Ranges (Temporary Fix)

Since you're using a shared pool, you need to whitelist **all** SendGrid outbound IP ranges:

**SendGrid IP Ranges (as of 2024):**
```
149.72.0.0/16
167.89.0.0/17
168.245.0.0/16
```

**Steps:**
1. Contact your email provider (whoever manages `procurement@1pwrafrica.com`)
2. Request whitelisting of the above IP ranges
3. Provide the SpamCop RBL links as justification:
   - https://www.spamcop.net/bl.shtml?149.72.126.143
   - https://www.spamcop.net/bl.shtml?149.72.120.130

**Warning:** This only works if your email provider allows range-based whitelisting. Some providers require exact IPs, which won't work with a shared pool.

### Option 2: Purchase a Dedicated IP from SendGrid (Recommended)

**Benefits:**
- You get a consistent IP address that only you use
- Better email deliverability and reputation control
- Can whitelist a single IP address
- Professional email infrastructure

**Steps:**
1. Log in to your SendGrid account
2. Navigate to Settings → IP Management
3. Purchase a dedicated IP address ($19.95/month+)
4. Allow 2-4 weeks for the IP to "warm up" (gradual volume increase)
5. Once stable, whitelist the single dedicated IP

### Option 3: Contact SendGrid Support (Immediate Action)

**Steps:**
1. Log in to SendGrid: https://sendgrid.com/
2. Go to Support → Submit a Ticket
3. Report the IPs being blocklisted:
   - `149.72.126.143`
   - `149.72.120.130`
4. Request that SendGrid:
   - Investigate why their shared pool IPs are on the SpamCop RBL
   - Take action to delist the IPs
   - Provide guidance on preventing future blocks

### Option 4: Use a Different Email Provider

If SendGrid's reputation continues to be an issue, consider:
- **AWS SES** (Simple Email Service)
- **Mailgun**
- **Postmark**
- **Microsoft 365 SMTP** (if using Office 365)

## Immediate Workaround

For testing/development, consider:
1. Using a different email address for procurement that doesn't have strict spam filtering
2. Setting up email forwarding from a Gmail/Outlook account to procurement
3. Temporarily using a test email account that you control

## Long-Term Fix

The **best long-term solution** is **Option 2 (Dedicated IP)**, because:
- ✅ Consistent, whitelist-able IP address
- ✅ Professional email infrastructure
- ✅ Better deliverability
- ✅ Full control over sender reputation
- ❌ Requires monthly fee ($19.95+)
- ❌ Requires IP warmup period

## Technical Details

### SpamCop RBL Listing

SpamCop lists IPs that are reported as sources of spam. The listings are usually temporary (24-48 hours) if spam stops. However, SendGrid's shared pool keeps getting re-listed because:
1. Multiple customers share the same IPs
2. Some customers send spam (intentionally or through compromised accounts)
3. The volume of spam reports keeps the IPs listed

### How to Check if an IP is Listed

Visit: `https://www.spamcop.net/bl.shtml?<IP_ADDRESS>`

Examples:
- https://www.spamcop.net/bl.shtml?149.72.126.143
- https://www.spamcop.net/bl.shtml?149.72.120.130

## Contact Information

**SendGrid Support:**
- Website: https://support.sendgrid.com/
- Phone: +1 (877) 969-5744
- Email: support@sendgrid.com

**Your Email Provider:**
- Contact whoever manages `procurement@1pwrafrica.com`
- Request IP whitelist or adjust spam filter settings


