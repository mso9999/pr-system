# Custom Domain Setup for PR System

## Overview
Connect a custom domain to your Firebase Hosting deployment instead of using the default `pr-system-4ea55.web.app` URL.

## Prerequisites
- Domain ownership (e.g., `1pwrafrica.com`)
- Access to DNS management (via your domain registrar or DNS provider)
- Firebase project already deployed

## Method 1: Firebase Console (Easiest)

### Step 1: Add Custom Domain
1. Go to [Firebase Console - Hosting](https://console.firebase.google.com/project/pr-system-4ea55/hosting)
2. Click **"Add custom domain"**
3. Enter your domain:
   - For subdomain: `pr.1pwrafrica.com` or `procurement.1pwrafrica.com`
   - For apex domain: `1pwrafrica.com` (redirects to www recommended)

### Step 2: Verify Domain Ownership
Firebase will provide a **TXT record** like:
```
Type: TXT
Name: @  (or your domain name)
Value: google-site-verification=abc123...
```

**Add this to your DNS provider:**
- Log into your DNS provider (InMotion, GoDaddy, Cloudflare, etc.)
- Navigate to DNS Management
- Add the TXT record
- Save changes

### Step 3: Configure DNS Records

#### For Subdomain (e.g., `pr.1pwrafrica.com`):
Firebase will provide a **CNAME record**:
```
Type: CNAME
Name: pr
Value: pr-system-4ea55.web.app
TTL: 3600 (or automatic)
```

#### For Apex Domain (e.g., `1pwrafrica.com`):
Firebase will provide **A records**:
```
Type: A
Name: @
Value: 151.101.1.195
TTL: 3600

Type: A
Name: @
Value: 151.101.65.195
TTL: 3600
```

**Add these records to your DNS provider:**
1. Log into DNS management
2. Add the CNAME or A records as shown above
3. Save changes
4. Wait for DNS propagation (5 minutes to 48 hours, usually < 1 hour)

### Step 4: SSL Certificate Provisioning
- Firebase automatically provisions a **free SSL certificate** (Let's Encrypt)
- This process takes **15 minutes to 24 hours**
- Status will show in Firebase Console
- Your site will be accessible via HTTPS once complete

### Step 5: Verify Setup
Once DNS propagates and SSL is ready:
- Visit your custom domain: `https://pr.1pwrafrica.com`
- Should redirect to HTTPS automatically
- Original URL still works: `https://pr-system-4ea55.web.app`

## Method 2: Firebase CLI

```bash
# Add a custom domain
firebase hosting:sites:create pr-1pwrafrica

# Connect the domain
firebase target:apply hosting production pr-1pwrafrica
firebase deploy --only hosting:production
```

Then follow the console steps above for DNS configuration.

## Common DNS Providers

### InMotion Hosting
1. Log into cPanel or Account Management Panel
2. Navigate to **Domains** → **Zone Editor** or **DNS Management**
3. Add the records provided by Firebase
4. Save changes

### GoDaddy
1. Log into GoDaddy account
2. Go to **My Products** → **Domains**
3. Click **DNS** next to your domain
4. Add records under **Records** section
5. Save

### Cloudflare (Recommended for performance)
1. Log into Cloudflare
2. Select your domain
3. Go to **DNS** tab
4. Add the records
5. **Important:** Set proxy status to "DNS only" (grey cloud) for initial setup
6. After verification, you can enable proxy (orange cloud)

### Namecheap
1. Log into Namecheap
2. Go to **Domain List** → Manage
3. Click **Advanced DNS**
4. Add the records
5. Save

## Recommended Subdomain Names
- `pr.1pwrafrica.com` - Clean and professional
- `procurement.1pwrafrica.com` - Descriptive
- `requests.1pwrafrica.com` - Alternative
- `po.1pwrafrica.com` - Short form

## Troubleshooting

### DNS Not Propagating
- Use [DNS Checker](https://dnschecker.org) to verify propagation
- Flush your local DNS cache:
  - Windows: `ipconfig /flushdns`
  - Mac: `sudo dscacheutil -flushcache`
  - Linux: `sudo systemd-resolve --flush-caches`

### SSL Certificate Pending
- Ensure DNS records are correct
- Wait up to 24 hours
- Check Firebase Console for error messages
- Verify domain ownership TXT record is present

### "Domain already exists" Error
- Domain may already be connected to another Firebase project
- Remove it from the other project first
- Or use a different subdomain

## Security & Best Practices
1. ✅ Always use HTTPS (Firebase enforces this)
2. ✅ Keep original Firebase URL as backup
3. ✅ Set appropriate DNS TTL (3600 seconds is good)
4. ✅ Monitor SSL certificate renewal (Firebase does this automatically)
5. ✅ Consider using Cloudflare for additional DDoS protection

## Estimated Timeline
- DNS Verification: 5-60 minutes
- DNS Propagation: 5 minutes to 24 hours (usually < 1 hour)
- SSL Certificate: 15 minutes to 24 hours
- **Total: 1-24 hours for full setup**

## Support
- Firebase Hosting Docs: https://firebase.google.com/docs/hosting/custom-domain
- Firebase Support: https://firebase.google.com/support
- DNS Propagation Checker: https://dnschecker.org

