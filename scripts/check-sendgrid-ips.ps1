# PowerShell script to get SendGrid IP addresses
# Replace YOUR_SENDGRID_API_KEY with your actual API key

$SENDGRID_API_KEY = "YOUR_SENDGRID_API_KEY"
$headers = @{
    "Authorization" = "Bearer $SENDGRID_API_KEY"
    "Content-Type" = "application/json"
}

Write-Host "=== Your SendGrid IP Addresses ===" -ForegroundColor Cyan
$ips = Invoke-RestMethod -Uri "https://api.sendgrid.com/v3/ips" -Headers $headers -Method Get
$ips | ConvertTo-Json -Depth 10

Write-Host "`n=== Your IP Pools ===" -ForegroundColor Cyan
$pools = Invoke-RestMethod -Uri "https://api.sendgrid.com/v3/ips/pools" -Headers $headers -Method Get
$pools | ConvertTo-Json -Depth 10

Write-Host "`n=== IP Addresses to Whitelist ===" -ForegroundColor Green
foreach ($ip in $ips) {
    Write-Host $ip.ip -ForegroundColor Yellow
}

