# Database Migration Guide - v2

## Overview

This migration adds new fields to support enhanced features from the PR system specifications alignment:

### Changes Applied

1. **Purchase Requests (PRs)**
   - Add `objectType` field ('PR' or 'PO')
   - Add `requiresDualApproval` flag
   - Enhance `approvalWorkflow` with dual approval fields
   - Initialize document management field structure

2. **Organizations**
   - Add email configuration fields (procurement, asset management, admin)
   - Add business rules configuration
   - Add vendor approval duration settings
   - Add high-value vendor rules configuration
   - Set default values for existing organizations

3. **Vendors**
   - Add approval status tracking fields
   - Add high-value classification fields
   - Migrate old `approved` field to new `isApproved`
   - Initialize cumulative order value tracking

## Pre-Migration Checklist

### Required Steps BEFORE Running Migration

1. **Create Database Backup**
   ```bash
   # Export Firestore data
   firebase firestore:export gs://your-bucket/backups/pre-migration-v2
   ```

2. **Test in Development First**
   - Run migration in development environment
   - Verify all changes are correct
   - Test application functionality
   - Only proceed to production after successful testing

3. **Verify Service Account Key**
   - Ensure `serviceAccountKey.json` exists in project root
   - Verify it has necessary permissions (Firestore read/write)

4. **Install Dependencies**
   ```bash
   npm install
   ```

## Running the Migration

### Development Environment

```bash
# Run the migration script
npx ts-node scripts/migrate-data-model-v2.ts
```

### Production Environment

**STOP!** Before running in production:
- [ ] Backup completed
- [ ] Tested in development
- [ ] All stakeholders notified
- [ ] Maintenance window scheduled
- [ ] Rollback plan prepared

```bash
# Set production environment
export GOOGLE_APPLICATION_CREDENTIALS="path/to/prod-serviceAccountKey.json"

# Run migration
npx ts-node scripts/migrate-data-model-v2.ts
```

## What the Migration Does

### 1. Purchase Requests Migration
- Sets `objectType` to 'PR' for PRs in SUBMITTED, IN_QUEUE, PENDING_APPROVAL, REVISION_REQUIRED statuses
- Sets `objectType` to 'PO' for PRs in APPROVED, ORDERED, COMPLETED statuses
- Initializes `requiresDualApproval` to `false` (will be set properly when PRs are processed)
- Enhances `approvalWorkflow` with dual approval tracking fields
- Adds `firstApprovalComplete`, `secondApprovalComplete`, and justification fields

### 2. Organizations Migration
- Sets `baseCurrency` to 'LSL' (default)
- Sets `allowedCurrencies` to ['LSL', 'USD', 'ZAR']
- Sets vendor approval durations:
  - `vendorApproval3QuoteDuration`: 12 months
  - `vendorApprovalCompletedDuration`: 6 months
  - `vendorApprovalManualDuration`: 12 months
- Sets high-value vendor rules:
  - `highValueVendorMultiplier`: 10
  - `highValueVendorMaxDuration`: 24 months

### 3. Vendors Migration
- Migrates `approved` field to `isApproved`
- Initializes `isHighValue` to `false`
- Initializes `cumulativeOrderValue` to `0`
- Sets `active` field if missing

## Post-Migration Steps

1. **Verify Data Integrity**
   ```bash
   # Check sample PRs
   firebase firestore:get purchaseRequests/[PR_ID]
   
   # Check organizations
   firebase firestore:get referenceData_organizations/[ORG_ID]
   
   # Check vendors
   firebase firestore:get referenceData_vendors/[VENDOR_ID]
   ```

2. **Test Application**
   - Login and navigate dashboard
   - View PRs in different statuses
   - Check organization settings (if UI is ready)
   - Verify vendor data displays correctly

3. **Monitor for Issues**
   - Check application logs
   - Monitor user reports
   - Watch for any errors in console

## Rollback Procedure

If issues are encountered:

1. **Stop the Application** (if running)

2. **Restore from Backup**
   ```bash
   # Restore Firestore data
   firebase firestore:import gs://your-bucket/backups/pre-migration-v2
   ```

3. **Verify Restoration**
   - Check that data is restored correctly
   - Test application functionality

4. **Investigate Issues**
   - Review migration logs
   - Check error messages
   - Determine root cause

## Migration Output

The script provides detailed output:

```
📝 Migrating Purchase Requests...
  Updated 10 PRs...
  Updated 20 PRs...
✅ PRs Migration Complete: 45 of 50 updated

🏢 Migrating Organizations...
  Updated organization: 1PWR Lesotho
  Updated organization: 1PWR South Africa
✅ Organizations Migration Complete: 2 of 2 updated

🏭 Migrating Vendors...
  Updated 10 vendors...
  Updated 20 vendors...
✅ Vendors Migration Complete: 35 of 38 updated

📊 MIGRATION SUMMARY
============================================================
Purchase Requests:
  Processed: 50
  Updated: 45

Organizations:
  Processed: 2
  Updated: 2

Vendors:
  Processed: 38
  Updated: 35

✅ No errors encountered
```

## Troubleshooting

### Error: "serviceAccountKey.json not found"
- Ensure the service account key file exists in project root
- Check file permissions

### Error: "Permission denied"
- Verify service account has Firestore read/write permissions
- Check IAM roles in Firebase Console

### Error: "Cannot connect to Firestore"
- Check network connectivity
- Verify Firebase project ID is correct
- Ensure Firestore is enabled for the project

### Migration Runs but No Updates
- Check if data already has the new fields
- Verify query filters are correct
- Review migration logic for your specific data structure

## Support

If you encounter issues:
1. Check this README for troubleshooting steps
2. Review migration script logs for specific errors
3. Consult with the development team
4. Reference the main Specifications.md document

## Important Notes

- **Non-Destructive**: This migration only adds new fields and doesn't remove existing data
- **Idempotent**: Safe to run multiple times (only updates missing fields)
- **Optional Fields**: All new fields are optional and won't break existing functionality
- **Backward Compatible**: Existing code continues to work with new schema

## Next Steps After Migration

After successful migration:
1. ✅ Mark Phase 2 as complete
2. 🚀 Proceed with Phase 3: Organization configuration management UI
3. 📝 Update application code to use new fields
4. 🧪 Implement and test new features

---

**Last Updated**: October 2025
**Migration Version**: 2.0.0
**Compatible with**: PR System Specifications v2025-01-15

