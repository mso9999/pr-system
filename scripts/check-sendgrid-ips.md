# How to Find Your SendGrid IPs

## Method 1: SendGrid Dashboard (Easiest)

1. Login to https://app.sendgrid.com/
2. Go to **Settings → Sender Authentication**
3. Look for "IP Addresses" section
4. Note all IPs listed

## Method 2: Check Email Headers

1. Find a recent email sent through your system
2. View the email headers (varies by email client)
3. Look for "Received" headers showing SendGrid IPs

Example:
```
Received: from sendgrid.net ([149.72.126.143])
```

## Method 3: SendGrid API

If you have API access:

```bash
curl --request GET \
  --url https://api.sendgrid.com/v3/ips \
  --header 'Authorization: Bearer YOUR_API_KEY'
```

## What to Share with IT Team

Once you have your IPs, share this with `1pwrafrica.com` IT team:

```
Subject: Whitelist Request for PR System Emails

Hello,

Our purchase request system uses SendGrid to send notifications to:
- procurement@1pwrafrica.com

Please whitelist the following IPs to ensure email delivery:

[LIST YOUR SPECIFIC IPS HERE]

Or whitelist the entire SendGrid range:
- 149.72.0.0/16
- 167.89.0.0/16
- 168.245.0.0/16
- 173.255.192.0/18

SPF Record: v=spf1 include:sendgrid.net ~all
Domain: [YOUR SENDING DOMAIN]

Thank you!
```

## Current Blocked IP

The IP currently blocked on SpamCop: **149.72.126.143**

Check status: https://www.spamcop.net/bl.shtml?149.72.126.143


