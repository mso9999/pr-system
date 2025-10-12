# Deployment Guide - PR System v2.0

## 🚀 Pre-Deployment Checklist

### 1. Backup Current System
**CRITICAL: Do this FIRST before any deployment**

```bash
# In Firebase Console
# Go to: Firestore Database > Import/Export > Export Data
# Save to: gs://your-bucket/backups/pre-v2-deployment-YYYY-MM-DD
```

✅ **Verify backup completed successfully**

### 2. Code Review
- [ ] All 18 phases committed to repository
- [ ] No critical errors in TypeScript compilation
- [ ] All new components have no linter errors
- [ ] README.md updated with new features
- [ ] TESTING_CHECKLIST.md created

### 3. Environment Verification
- [ ] Firebase project configured correctly
- [ ] SendGrid API key available
- [ ] Service account key present
- [ ] Node.js and npm versions correct

---

## 📦 Deployment Steps

### Step 1: Database Migration

**Environment**: Start with DEVELOPMENT

```bash
# Navigate to scripts directory
cd scripts

# Install dependencies if needed
npm install

# Run migration (DEVELOPMENT FIRST!)
npx ts-node migrate-data-model-v2.ts
```

**Expected Output**:
```
📝 Migrating Purchase Requests...
✅ PRs Migration Complete: X of Y updated

🏢 Migrating Organizations...
✅ Organizations Migration Complete: X of Y updated

🏭 Migrating Vendors...
✅ Vendors Migration Complete: X of Y updated

📊 MIGRATION SUMMARY
✅ No errors encountered
```

**Validation**:
```bash
# Check sample documents in Firestore Console
# Verify new fields present:
# - PRs: objectType, requiresDualApproval, approvalWorkflow enhanced
# - Organizations: email fields, vendor approval durations
# - Vendors: isApproved, approvalExpiryDate, etc.
```

### Step 2: Deploy Firebase Functions

```bash
# Navigate to functions directory
cd functions

# Install dependencies
npm install

# Build TypeScript
npm run build

# Deploy functions
firebase deploy --only functions
```

**New Functions Deployed**:
- `dailyVendorExpiryCheck` - Runs daily at 1:00 AM
- `dailyReminders` - Runs daily at 8:00 AM
- `urgentReminders` - Runs daily at 3:00 PM
- `deliveryDelayCheck` - Runs daily at 9:00 AM

**Verify Deployment**:
```bash
# Check Firebase Console > Functions
# Verify all 4 new functions are deployed and scheduled
```

### Step 3: Configure SendGrid (if not already done)

```bash
# Set SendGrid API key
firebase functions:config:set sendgrid.api_key="YOUR_SENDGRID_API_KEY"

# Redeploy functions to pick up config
firebase deploy --only functions
```

### Step 4: Deploy Frontend

```bash
# Return to project root
cd ..

# Install dependencies
npm install

# Build production bundle
npm run build

# Deploy to Firebase Hosting (if using)
firebase deploy --only hosting

# OR deploy to your hosting provider
```

### Step 5: Configure Organizations

**In Production Admin Dashboard**:

1. Navigate to: Admin Dashboard > Organization Settings
2. For EACH organization, configure:
   - ✅ Procurement Email (e.g., procurement@1pwrafrica.com)
   - ✅ Asset Management Email (e.g., assets@1pwrafrica.com)
   - ✅ Admin Email (e.g., admin@1pwrafrica.com)
   - ✅ Vendor Approval Durations (defaults: 12, 6, 12 months)
   - ✅ High-Value Vendor Rules (defaults: 10x multiplier, 24 months)
   - ✅ Business Rules (Rule 1 & Rule 2 thresholds)

3. Save and verify settings persist

---

## ✅ Post-Deployment Verification

### Immediate Checks (Within 1 hour)

1. **Login Test**
   ```
   - [ ] Can log in as different user roles
   - [ ] Dashboard loads correctly
   - [ ] No console errors
   ```

2. **MY ACTIONS Button**
   ```
   - [ ] Appears for non-Procurement users
   - [ ] Shows correct count
   - [ ] Filters correctly by role
   ```

3. **Advanced Filters**
   ```
   - [ ] Filter panel opens
   - [ ] Filters apply correctly
   - [ ] Analytics display
   - [ ] CSV export works
   ```

4. **Create Test PR**
   ```
   - [ ] Basic info validates
   - [ ] Line items work
   - [ ] Status transitions work
   - [ ] Notifications sent
   ```

5. **Dual Approval Test** (if you have Rule 2 threshold configured)
   ```
   - [ ] Create PR above Rule 2 threshold
   - [ ] Push to approver
   - [ ] Verify both approvers notified
   - [ ] First approver approves
   - [ ] Second approver sees "1 of 2"
   - [ ] Second approver approves
   - [ ] Status moves to APPROVED
   ```

### Monitor for 24 Hours

1. **Scheduled Functions**
   ```
   - [ ] Check Firebase Console > Functions > Logs
   - [ ] Verify dailyVendorExpiryCheck ran at 1:00 AM
   - [ ] Verify dailyReminders ran at 8:00 AM
   - [ ] Verify urgentReminders ran at 3:00 PM
   - [ ] Verify deliveryDelayCheck ran at 9:00 AM
   ```

2. **Email Notifications**
   ```
   - [ ] Daily reminders received
   - [ ] Status change notifications work
   - [ ] Email addresses from org config used
   ```

3. **Document Uploads**
   ```
   - [ ] Test proforma upload in APPROVED status
   - [ ] Test PoP upload
   - [ ] Test delivery docs in ORDERED
   - [ ] Files stored correctly in Cloud Storage
   ```

4. **Vendor Approval**
   ```
   - [ ] Complete a test PO to COMPLETED
   - [ ] Answer vendor performance question
   - [ ] Verify vendor approved automatically
   - [ ] Check expiry date calculated correctly
   ```

---

## 🔧 Troubleshooting

### Issue: Migration Fails

**Symptoms**: Error messages during migration  
**Solution**:
1. Check service account key has Firestore read/write permissions
2. Verify Firebase project ID is correct
3. Review error messages for specific field issues
4. Restore from backup if necessary
5. Contact development team

### Issue: Scheduled Functions Not Running

**Symptoms**: No logs in Firebase Console  
**Solution**:
1. Check function deployment: `firebase functions:list`
2. Verify timezone settings in function code
3. Check Cloud Scheduler in Google Cloud Console
4. Review function logs for errors
5. Redeploy: `firebase deploy --only functions`

### Issue: MY ACTIONS Button Not Showing

**Symptoms**: Button doesn't appear for users  
**Solution**:
1. Verify user has permissionLevel !== 3 (not Procurement)
2. Check Redux state for myActionsFilter
3. Clear browser cache
4. Check console for JavaScript errors

### Issue: Dual Approval Not Working

**Symptoms**: Only one approver assigned  
**Solution**:
1. Verify PR amount is above Rule 2 threshold
2. Check organization has Rule 2 configured
3. Verify second approver (approver2) field is set
4. Check requiresDualApproval flag

### Issue: Document Uploads Failing

**Symptoms**: Upload errors or files not saved  
**Solution**:
1. Check Firebase Storage rules
2. Verify file size < 10MB
3. Check allowed file types
4. Review Storage service implementation
5. Check Cloud Storage bucket permissions

### Issue: Emails Not Sending

**Symptoms**: No email notifications received  
**Solution**:
1. Verify SendGrid API key configured: `firebase functions:config:get`
2. Check SendGrid dashboard for send logs
3. Verify organization email addresses configured
4. Check notificationLogs collection for errors
5. Review function logs in Firebase Console

---

## 🔄 Rollback Procedure

If critical issues are encountered:

### 1. Stop New Deployments
```bash
# Don't deploy any more changes until issue is resolved
```

### 2. Restore Database (if needed)
```bash
# In Firebase Console
# Go to: Firestore Database > Import/Export > Import Data
# Select: gs://your-bucket/backups/pre-v2-deployment-YYYY-MM-DD
```

### 3. Rollback Frontend
```bash
# Revert to previous version
git revert HEAD
git push origin main

# Redeploy
npm run build
firebase deploy --only hosting
```

### 4. Rollback Functions
```bash
# Navigate to functions
cd functions

# Checkout previous version
git checkout <previous-commit-hash> -- src/

# Redeploy
firebase deploy --only functions
```

### 5. Document Issues
- Create detailed incident report
- Note what failed and when
- Capture error logs
- Plan fixes before re-attempting deployment

---

## 📞 Support Contacts

**For Deployment Issues**:
- Development Team Lead
- Firebase Administrator
- System Administrator

**For Business Logic Questions**:
- Reference: `Specifications.md`
- Workflow Diagrams: `PR_WORKFLOW_FLOWCHART.md`

---

## ✨ Success Criteria

Deployment is considered successful when:

- ✅ All migration scripts complete without errors
- ✅ All Firebase Functions deployed and scheduled
- ✅ Organization configurations saved
- ✅ All user roles can log in and see appropriate features
- ✅ Test PR completes full lifecycle successfully
- ✅ Scheduled functions execute on schedule (verify logs)
- ✅ Email notifications sent correctly
- ✅ No critical errors in logs for 24 hours
- ✅ Performance remains acceptable (< 3s dashboard load)

---

**Document Version**: 1.0  
**Last Updated**: October 12, 2025  
**For**: PR System v2.0 Deployment

