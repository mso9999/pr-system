# File Link Troubleshooting Guide

## Issue: Files Not Downloading from External URLs

When uploading line items via CSV with file links, the system attempts to automatically download files from the provided URLs. However, downloads may fail due to **CORS (Cross-Origin Resource Sharing) restrictions** imposed by file hosting services.

### Why Dropbox Links Don't Work

Dropbox URLs like these **will NOT work** for automatic downloads:
```
❌ https://www.dropbox.com/scl/fi/.../file.pdf?rlkey=...&dl=0
❌ https://www.dropbox.com/scl/fi/.../file.pdf?rlkey=...&dl=1
```

**Reason**: These are web preview URLs that:
- Serve HTML pages, not raw files
- Block cross-origin requests (CORS)
- Require browser session/cookies

### ✅ Solutions

#### Option 1: Convert Dropbox URLs to Direct Download Links (Recommended)

Replace `www.dropbox.com` with `dl.dropboxusercontent.com` and ensure `dl=1`:

**Before:**
```
https://www.dropbox.com/scl/fi/4m6ny.../file.pdf?rlkey=wyez4...&dl=0
```

**After:**
```
https://dl.dropboxusercontent.com/scl/fi/4m6ny.../file.pdf?rlkey=wyez4...&dl=1
```

#### Option 2: Use Direct File URLs

Upload files to services that provide direct download URLs:
- **Firebase Storage** - Already integrated in the system
- **Amazon S3** with public access
- **Azure Blob Storage** with SAS tokens
- **GitHub Releases** (for public files)

#### Option 3: Upload Files Directly

Instead of using external links:
1. Download the files to your computer
2. Use the "Attach Files" button in each line item
3. Files will be uploaded directly to Firebase Storage

#### Option 4: Use Folder Links (For Reference Only)

If you just want to provide a reference to files (not download them):
- Keep the links as-is in your CSV
- They will be displayed as clickable links in the RFQ
- Vendors can click to access them (with appropriate permissions)

### Understanding File Link Behavior

| Link Type | System Behavior | Appears In RFQ | Use Case |
|-----------|----------------|----------------|----------|
| **Direct file URL** (downloadable) | ✅ Downloaded & uploaded to Firebase | ✓ As embedded file link | Specifications, drawings, BOMs |
| **Folder link** (not downloadable) | ⚠️ Kept as clickable link | ✓ As folder link | Multiple related files, shared drives |
| **Web preview URL** (e.g., Dropbox dl=0) | ❌ Failed, kept as link | ✓ As clickable link | Fallback behavior |

### Testing Your URLs

To test if a URL will work for automatic downloads:

1. **Open browser developer tools** (F12)
2. **Run this in the console:**
   ```javascript
   fetch('YOUR_URL_HERE', { mode: 'cors' })
     .then(r => {
       console.log('Status:', r.status);
       console.log('Content-Type:', r.headers.get('content-type'));
       console.log('Success:', !r.headers.get('content-type')?.includes('text/html'));
     })
     .catch(e => console.error('CORS Error:', e));
   ```

3. **Expected results:**
   - ✅ **Status: 200** and **Content-Type: application/pdf** (or other file type) → Will work
   - ❌ **Status: 200** and **Content-Type: text/html** → Won't work (web page)
   - ❌ **CORS Error** → Won't work (blocked by server)

### Current System Behavior

When a file download fails:
- ✅ The URL is **preserved** as a clickable link
- ✅ Displayed in the line item with a **link icon** (🔗)
- ✅ Included in the generated RFQ PDF
- ✅ Vendors can click to access (if they have permissions)

### Dropbox Quick Reference

| Parameter | What It Does | Works for Auto-Download? |
|-----------|--------------|--------------------------|
| `dl=0` | Preview in browser | ❌ No |
| `dl=1` | Force download (for browsers) | ❌ No (still serves HTML first) |
| Using `dl.dropboxusercontent.com` | Direct file access | ✅ Yes |

### Example: Converting Your Current Links

Your CSV has links like:
```
https://www.dropbox.com/scl/fi/4m6nynwy9v4nk6xzj7tzc/SOW_for_service_provider.pdf?rlkey=wyez4yc9nr4xu0dgxfjfd8hcg&dl=0
```

**Fix:** Change to:
```
https://dl.dropboxusercontent.com/scl/fi/4m6nynwy9v4nk6xzj7tzc/SOW_for_service_provider.pdf?rlkey=wyez4yc9nr4xu0dgxfjfd8hcg&dl=1
```

Then re-upload your CSV.

### Need Help?

If you continue to have issues:
1. Check the browser console for detailed error messages
2. Try the "Upload Files Directly" option (Option 3 above)
3. Contact support with the console error details

