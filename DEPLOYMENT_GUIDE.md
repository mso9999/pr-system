# PR System Deployment Guide

## Option 1: Firebase Hosting (Recommended)

### Prerequisites
- Firebase CLI installed: `npm install -g firebase-tools`
- Firebase project already exists (pr-system-4ea55)

### One-Time Setup
```bash
# 1. Login to Firebase
firebase login

# 2. Initialize hosting (already configured via firebase.json)
# Skip if firebase.json already exists

# 3. Verify your project
firebase projects:list
```

### Deploy to Production

#### Manual Deployment
```bash
# 1. Build the production app
npm run build

# 2. Test locally (optional)
firebase serve

# 3. Deploy to Firebase Hosting
firebase deploy --only hosting
```

#### Automated Deployment (GitHub Actions)
1. Generate a Firebase CI token:
   ```bash
   firebase login:ci
   ```
   Copy the token provided (no service account JSON needed).

2. Add GitHub secrets (Settings → Secrets and variables → Actions → New repository secret):

   | Secret Name | Value |
   |-------------|-------|
   | `FIREBASE_TOKEN` | The token from `firebase login:ci` |
   | `VITE_FIREBASE_API_KEY` | `AIzaSyD0tA1fvWs5dCr-7JqJv_bxlay2Bhs72jQ` |
   | `VITE_FIREBASE_AUTH_DOMAIN` | `pr-system-4ea55.firebaseapp.com` |
   | `VITE_FIREBASE_PROJECT_ID` | `pr-system-4ea55` |
   | `VITE_FIREBASE_STORAGE_BUCKET` | `pr-system-4ea55.firebasestorage.app` |
   | `VITE_FIREBASE_MESSAGING_SENDER_ID` | `562987209098` |
   | `VITE_FIREBASE_APP_ID` | `1:562987209098:web:2f788d189f1c0867cb3873` |
   | `VITE_FIREBASE_MEASUREMENT_ID` | `G-ZT7LN4XP80` (optional but recommended) |

   **Tip:** the values above match the `.env` file checked out locally; update them if Firebase settings ever change.

3. Push or merge to `main` → workflow builds with those secrets and auto-deploys to Firebase Hosting.

4. To force a redeploy without new code, make a trivial commit (e.g., doc tweak) or trigger the workflow manually via GitHub → Actions → “Deploy to Firebase Hosting” → “Run workflow”.

### Your App URL
After deployment: `https://pr-system-4ea55.web.app`
Or custom domain: `https://pr-system-4ea55.firebaseapp.com`

---

## Option 2: InMotion Hosting

### Prerequisites
- cPanel access or FTP credentials
- InMotion hosting plan

### Build for Production
```bash
# 1. Build the app
npm run build

# This creates a 'dist' folder with static files
```

### Deploy via cPanel File Manager
1. Log into cPanel
2. Navigate to File Manager
3. Go to `public_html` (or your domain's directory)
4. Upload all files from the `dist` folder
5. Create `.htaccess` file (see below)

### Deploy via FTP
```bash
# 1. Using FileZilla or similar FTP client
# 2. Connect to your InMotion server
# 3. Navigate to public_html
# 4. Upload all files from dist/ folder
# 5. Upload the .htaccess file
```

### Required .htaccess for SPA Routing
Create this file in your public_html directory:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteCond %{REQUEST_FILENAME} !-l
  RewriteRule . /index.html [L]
</IfModule>

# Enable GZIP compression
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css text/javascript application/javascript application/json
</IfModule>

# Browser caching
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType image/jpg "access plus 1 year"
  ExpiresByType image/jpeg "access plus 1 year"
  ExpiresByType image/gif "access plus 1 year"
  ExpiresByType image/png "access plus 1 year"
  ExpiresByType image/svg+xml "access plus 1 year"
  ExpiresByType text/css "access plus 1 month"
  ExpiresByType application/javascript "access plus 1 month"
  ExpiresByType application/pdf "access plus 1 month"
</IfModule>

# Security headers
<IfModule mod_headers.c>
  Header set X-Content-Type-Options "nosniff"
  Header set X-Frame-Options "SAMEORIGIN"
  Header set X-XSS-Protection "1; mode=block"
</IfModule>
```

### Environment Variables for InMotion
Since InMotion serves static files, your `.env` variables are baked into the build.

⚠️ **Important**: Never commit `.env` to git. Your Firebase config is already in the code, which is okay since Firebase uses security rules, not secret keys.

### Post-Deployment Checklist
- [ ] Verify Firebase connection works
- [ ] Test user login
- [ ] Test PR creation
- [ ] Test file uploads
- [ ] Check that routing works (refresh on any page)
- [ ] Verify mobile responsiveness
- [ ] Test in different browsers

---

## Firebase Security (Production)

### Update Firestore Rules for Production
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Only authenticated users
    function isAuthenticated() {
      return request.auth != null;
    }
    
    // Check user permission level
    function getUserPermission() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.permissionLevel;
    }
    
    match /purchaseRequests/{prId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow update: if isAuthenticated();
      allow delete: if getUserPermission() == 1; // Superadmin only
    }
    
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow write: if request.auth.uid == userId || getUserPermission() == 1;
    }
    
    match /referenceData/{docId} {
      allow read: if isAuthenticated();
      allow write: if getUserPermission() in [1, 3, 4]; // Superadmin, Procurement, Finance
    }
  }
}
```

### Update Storage Rules for Production
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null 
                   && request.resource.size < 10 * 1024 * 1024 // 10MB max
                   && request.resource.contentType.matches('image/.*|application/pdf|application/vnd.*');
    }
  }
}
```

---

## Monitoring & Maintenance

### Firebase Console
- Monitor usage: https://console.firebase.google.com
- Check Firestore usage
- Monitor Storage usage
- View Authentication users

### Performance Monitoring (Optional)
```bash
# Add Firebase Performance Monitoring
npm install firebase/performance

# In your main.tsx, add:
import { getPerformance } from 'firebase/performance';
const perf = getPerformance(app);
```

### Analytics (Optional)
```bash
# Add Firebase Analytics
npm install firebase/analytics

# In your main.tsx, add:
import { getAnalytics } from 'firebase/analytics';
const analytics = getAnalytics(app);
```

---

## Troubleshooting

### Build Errors
```bash
# Clear cache and rebuild
rm -rf node_modules dist
npm install
npm run build
```

### Firebase Deployment Issues
```bash
# Logout and login again
firebase logout
firebase login

# Verify project
firebase use pr-system-4ea55
```

### InMotion 404 Errors
- Verify .htaccess is present
- Check mod_rewrite is enabled (contact InMotion support)
- Verify all files uploaded correctly

### Firebase Connection Errors
- Check Firebase config in `.env`
- Verify Firestore rules allow your operations
- Check browser console for specific errors

---

## Custom Domain Setup

### Firebase Hosting with Custom Domain
1. Go to Firebase Console → Hosting
2. Click "Add custom domain"
3. Follow DNS setup instructions
4. Wait for SSL certificate (automatic)

### InMotion with Domain
1. Domain should already point to InMotion
2. Upload files to correct directory
3. SSL via cPanel (Let's Encrypt free)

---

## Rollback Procedure

### Firebase Hosting
```bash
# View deployment history
firebase hosting:channel:list

# Rollback to previous version
firebase hosting:channel:deploy <channel-name>
```

### InMotion Hosting
- Keep previous dist/ folder backed up
- Re-upload previous version via FTP/cPanel

---

## Support Contacts
- Firebase Support: https://firebase.google.com/support
- InMotion Support: https://www.inmotionhosting.com/support
- GitHub Repository: https://github.com/mso9999/pr-system

