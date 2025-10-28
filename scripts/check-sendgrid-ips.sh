#!/bin/bash
# Get SendGrid IP addresses
# Replace YOUR_SENDGRID_API_KEY with your actual API key

SENDGRID_API_KEY="YOUR_SENDGRID_API_KEY"

echo "=== Your SendGrid IP Addresses ==="
curl --request GET \
  --url https://api.sendgrid.com/v3/ips \
  --header "Authorization: Bearer $SENDGRID_API_KEY" \
  --header "Content-Type: application/json"

echo ""
echo "=== Your IP Pools ==="
curl --request GET \
  --url https://api.sendgrid.com/v3/ips/pools \
  --header "Authorization: Bearer $SENDGRID_API_KEY" \
  --header "Content-Type: application/json"

