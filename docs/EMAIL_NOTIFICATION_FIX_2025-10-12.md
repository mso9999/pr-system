# Email Notification & PR Number Fix - October 12, 2025

## Overview
Fixed email notifications to display human-readable names instead of database IDs, and updated PR number generation to include proper country codes based on organization.

## Issues Identified

### 1. Email Notifications Showing Machine-Readable IDs
**Problem:** Email notifications were displaying internal database IDs instead of human-readable names for several fields.

**Symptoms:**
- Department showing as: `TMEl8lYYpw370XGQLW7J` instead of `C Level`
- Site showing as: `1pwr_headquarters` instead of `1PWR Headquarters`
- Vendor showing as: `1010` instead of vendor name

**Example from actual email:**
```
Department: TMEl8lYYpw370XGQLW7J
Site: 1pwr_headquarters
Vendor: 1010
```

**Root Cause:**
The email template was resolving some reference data (category, expense type, vendor) but not all fields. Specifically:
- Department was not being resolved at all
- Site was using the raw ID (`pr.site`) instead of the resolved value (`requestorSite`)
- The `resolveReferenceData` function didn't have a case for 'department' type

**Resolution:**
1. Added department resolution using `await resolveReferenceData(pr.department || '', 'department', pr.organization)`
2. Changed site display to use resolved `requestorSite` variable
3. Added 'department' case to `resolveReferenceData()` function switch statement
4. All reference data fields now properly resolve to human-readable names

**Files Modified:**
- `src/services/notifications/templates/newPRSubmitted.ts` (lines 268-272, 318, 322, 403)

### 2. PR Numbers Using Generic "XX" Country Code
**Problem:** PR numbers were using "XX" as the country code suffix instead of the actual country code (LS for Lesotho, BN for Benin, etc.).

**Symptoms:**
- PR numbers like: `251012-5338-1PW-XX` (should be `251012-5338-1PL-LS`)
- Generic "XX" appeared even when organization was known

**Root Cause:**
The `generatePRNumber()` function was using `organization.toLowerCase()` for lookups, but organizations stored in Firestore are formatted with spaces and capital letters (e.g., "1PWR LESOTHO", not "1pwr_lesotho").

Example:
```typescript
// Organization comes in as: "1PWR LESOTHO"
const countryCode = countryCodeMap[organization.toLowerCase()]; 
// Lookup fails: countryCodeMap["1pwr lesotho"] doesn't exist
// Returns default: "XX"
```

**Resolution:**
Added normalization step to handle spaces and special characters:
```typescript
const normalizedOrg = organization.toLowerCase().replace(/[^a-z0-9]/g, '_');
// "1PWR LESOTHO" → "1pwr_lesotho"
const countryCode = countryCodeMap[normalizedOrg] || 'XX';
```

**Country Code Mappings:**
- Lesotho → `LS`
- Benin → `BN` (using BN instead of BJ as per client request)
- Zambia → `ZM`

**PR Number Format:**
```
[YYMMDD-####-ORG-CC]
Example: 251012-5338-1PL-LS
         ^      ^    ^   ^
         Date   Seq  Org Country
```

**Files Modified:**
- `src/services/pr.ts` (lines 496-497, 531-532)

## Testing Verification

### Expected Behavior After Fix

#### Email Notifications
Before:
```
Department: TMEl8lYYpw370XGQLW7J
Site: 1pwr_headquarters
Vendor: 1010
```

After:
```
Department: C Level
Site: 1PWR Headquarters
Vendor: ABC Supply Company (or actual vendor name)
```

#### PR Numbers
Before:
```
PR Number: 251012-5338-1PW-XX
```

After:
```
PR Number: 251012-5338-1PL-LS  (for 1PWR Lesotho)
PR Number: 251012-5338-1PB-BN  (for 1PWR Benin)
PR Number: 251012-5338-PCB-BN  (for PUECO Benin)
```

### Test Cases
1. **Create new PR in 1PWR LESOTHO organization**
   - ✅ PR number should end with `-LS`
   - ✅ Email notification should show human-readable department
   - ✅ Email notification should show human-readable site
   - ✅ Email notification should show vendor name

2. **Create new PR in 1PWR BENIN organization**
   - ✅ PR number should end with `-BN` (not `-BJ`)
   - ✅ All reference data should display as human-readable names

3. **Verify existing PRs**
   - ✅ Existing PRs keep their original PR numbers (no changes to database)
   - ✅ New notifications for existing PRs will show proper formatting

## Implementation Details

### Reference Data Resolution Process

The `resolveReferenceData()` function in `newPRSubmitted.ts` now handles:
1. **Department** - Fetches from `referenceData_departments` collection
2. **Site** - Fetches from `referenceData_sites` collection
3. **Category** - Fetches from `referenceData_projectCategories` collection
4. **Expense Type** - Fetches from `referenceData_expenseTypes` collection
5. **Vendor** - Fetches from `referenceData_vendors` collection with special numeric ID handling

Each type:
- Queries Firestore using `referenceDataService`
- Filters by organization where applicable
- Matches by ID and returns the `name` field
- Falls back to formatting the ID if no match found

### Organization Normalization

The normalization process handles various input formats:
```typescript
Input                → Normalized
"1PWR LESOTHO"      → "1pwr_lesotho"
"1PWR Lesotho"      → "1pwr_lesotho"
"1PWR-LESOTHO"      → "1pwr_lesotho"
"PUECO Benin"       → "pueco_benin"
```

This ensures consistent lookups regardless of how the organization name is stored or displayed.

## Impact Assessment

### User Impact
- **High Positive:** Email notifications now much more readable and professional
- **High Positive:** PR numbers now clearly identify country/location
- **No Breaking Changes:** Existing PRs unchanged, only new PRs get new format
- **Backwards Compatible:** Code handles both old and new formats

### Data Integrity
- ✅ No data migration needed
- ✅ Existing PR numbers remain unchanged
- ✅ No changes to data structure or schema
- ✅ Only affects display/formatting in emails and new PR creation

## Configuration

### Supported Organizations

**Format:** `[Org Code]-[Country Code]`

| Organization | Org Code | Country Code | Example PR Number |
|-------------|----------|--------------|-------------------|
| 1PWR Lesotho | 1PL | LS | 251012-1234-1PL-LS |
| 1PWR Benin | 1PB | BN | 251012-1234-1PB-BN |
| 1PWR Zambia | 1PZ | ZM | 251012-1234-1PZ-ZM |
| PUECO Lesotho | PCL | LS | 251012-1234-PCL-LS |
| PUECO Benin | PCB | BN | 251012-1234-PCB-BN |
| NEO1 | NEO | LS | 251012-1234-NEO-LS |
| SMP | SMP | LS | 251012-1234-SMP-LS |

### Adding New Organizations

To add a new organization, update both maps in `src/services/pr.ts`:

```typescript
const orgCodeMap: { [key: string]: string } = {
  'new_org_name': 'NON',  // 3-letter org code
  // ... existing mappings
};

const countryCodeMap: { [key: string]: string } = {
  'new_org_name': 'CC',  // 2-letter ISO country code
  // ... existing mappings
};
```

## Deployment Notes

### Rollout
1. Changes deployed via Git push to main branch
2. Vite dev server automatically hot-reloaded changes
3. No database updates required
4. No user action required

### Verification Steps
1. Create a new PR in each organization
2. Check PR number format includes proper country code
3. Verify email notification received
4. Check email shows human-readable names for all fields
5. Confirm vendor names display correctly (not numeric IDs)

## Lessons Learned

### Best Practices
1. **Always Resolve Reference Data:** When displaying data to users (especially in emails), always resolve IDs to human-readable names
2. **Normalize Input Data:** When using strings as lookup keys, normalize them first to handle variations
3. **Test with Real Data:** Use actual email examples to verify formatting
4. **Document Data Formats:** Clearly document expected input/output formats for functions

### Code Review Recommendations
1. Review all email templates for proper reference data resolution
2. Audit any code that uses organization names as lookup keys
3. Verify PR number generation produces expected format
4. Test with different organization name formats (spaces, capitals, special chars)

## Related Documentation
- [PR Data Retrieval Fix](./PR_DATA_RETRIEVAL_FIX_2025-10-12.md)
- [PR Workflow Flowchart](../PR_WORKFLOW_FLOWCHART.md)
- [Specifications](../Specifications.md)
- [Architecture](../ARCHITECTURE.md)

## Git Commits
- `b60f8cd` - fix: email notifications now show human-readable names and PR numbers include country codes

---
**Last Updated:** October 12, 2025  
**Status:** ✅ Resolved and Deployed  
**Severity:** Medium (User Experience + Data Clarity)

