# SendGrid IP Whitelist Guide

## Current Issue
Your SendGrid IP `149.72.154.232` is blocked by SpamCop RBL, causing email delivery failures.

## Solution: Whitelist SendGrid IPs

### Step 1: Get Your SendGrid API Key

1. Log into SendGrid: https://app.sendgrid.com/
2. Go to **Settings** → **API Keys**
3. Create a new API key or use an existing one with **Mail Send** permissions

### Step 2: Find Your IP Addresses

**Option A: Use PowerShell Script**
```powershell
cd scripts
# Edit check-sendgrid-ips.ps1 and add your API key
.\check-sendgrid-ips.ps1
```

**Option B: Use SendGrid Dashboard**
1. Go to: https://app.sendgrid.com/settings/ip_addresses
2. Note all IP addresses listed

**Option C: Check Email Headers**
Look at bounced emails for lines like:
```
Received: from s.wrqvwxzv.outbound-mail.sendgrid.net ([149.72.154.232])
```

### Step 3: SendGrid's Complete IP Range

If you're on a **shared IP pool** (free/essentials plan), SendGrid rotates through many IPs. Here are the common ranges:

#### SendGrid IP Ranges to Whitelist:
```
# Primary ranges
149.72.0.0/16
167.89.0.0/16
168.245.0.0/16

# Additional ranges
208.117.48.0/20
198.37.144.0/20
198.21.0.0/20
```

#### Specific IPs from your bounces:
```
149.72.154.232  (current bounce)
149.72.123.24   (from previous bounce)
```

### Step 4: Whitelist in Your Mail Server

**For your mail server (`server.1pwrafrica.com`):**

#### If using Exim:
1. SSH into your server
2. Edit `/etc/exim4/exim4.conf.template` or your ACL configuration
3. Add to the whitelist section:
```
# Whitelist SendGrid IPs
acl_check_rcpt:
  accept  hosts = 149.72.0.0/16 : 167.89.0.0/16 : 168.245.0.0/16
```

#### If using Postfix:
1. Edit `/etc/postfix/sender_access` or create it:
```
149.72.0.0/16    OK
167.89.0.0/16    OK
168.245.0.0/16   OK
```

2. Update Postfix configuration:
```bash
postmap /etc/postfix/sender_access
postfix reload
```

#### If using SpamAssassin:
1. Edit `/etc/spamassassin/local.cf`:
```
whitelist_from_rcvd *@1pwrafrica.com *.sendgrid.net
whitelist_from_rcvd *@1pwrafrica.com *.sendgrid.com

# Whitelist specific IPs
trusted_networks 149.72.0.0/16 167.89.0.0/16 168.245.0.0/16
```

2. Restart SpamAssassin:
```bash
systemctl restart spamassassin
```

### Step 5: Alternative Solutions

#### Option A: Request Different IP Pool from SendGrid
1. Contact SendGrid support: https://support.sendgrid.com/
2. Request to be moved to a different IP pool with better reputation
3. Mention the SpamCop RBL issue

#### Option B: Upgrade to Dedicated IP
- Dedicated IPs give you full control over reputation
- Available on Pro plans and above
- Go to: Settings → IP Addresses → Purchase Dedicated IP

#### Option C: Use Domain Authentication
1. Set up domain authentication (SPF, DKIM, DMARC)
2. Go to: Settings → Sender Authentication → Authenticate Your Domain
3. This improves deliverability even with shared IPs

### Step 6: Verify Whitelist Works

After whitelisting, test with:
```bash
# From your mail server
telnet smtp.sendgrid.net 587

# Or check if IP is still blacklisted
host -t A 232.154.72.149.zen.spamcop.net
```

If the lookup returns NXDOMAIN, the IP is not blacklisted.

## Quick Reference

**Current problematic IPs:**
- `149.72.154.232` - Blocked by SpamCop
- `149.72.123.24` - Also from SendGrid

**SendGrid hostnames to whitelist:**
- `*.sendgrid.net`
- `*.sendgrid.com`

**Recommended action:**
1. Whitelist all `149.72.0.0/16` range immediately
2. Contact SendGrid support about reputation issue
3. Set up proper domain authentication

## Additional Resources

- [SendGrid IP Addresses Documentation](https://docs.sendgrid.com/ui/account-and-settings/ips-and-whitelabeling)
- [SendGrid Sender Authentication](https://docs.sendgrid.com/ui/account-and-settings/how-to-set-up-domain-authentication)
- [SpamCop Blacklist Removal](https://www.spamcop.net/bl.shtml)

