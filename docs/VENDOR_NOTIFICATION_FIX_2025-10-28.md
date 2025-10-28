# Vendor Name Resolution Fix - October 28, 2025

## Issue
Email notifications were showing vendor codes (e.g., "1025") instead of vendor names (e.g., "Plumb link").

## Root Cause
The vendor resolution code in email notifications was looking for lowercase field names (`code`, `name`, `active`) that don't exist in the Firestore database. The actual field names in the `referenceData_vendors` collection are capitalized (`Code`, `Name`, `Approved`).

## Data Source: Firestore (NOT CSV)
**Important**: The source of truth for all reference data is **Firestore**, specifically these collections:
- `referenceData_vendors`
- `referenceData_departments`
- `referenceData_sites`
- `referenceData_organizations`
- etc.

The CSV files in the project root (`Vendors.csv`, `Departments.csv`, etc.) are **archival only** - they represent the initial data import but are no longer actively used or maintained. All CRUD operations happen directly in Firestore through the Admin Dashboard.

## Firestore Schema for Vendors

```javascript
{
  id: "plumb_link",                    // Auto-generated document ID
  Code: "1025",                        // Vendor code (string)
  Name: "Plumb link",                  // Vendor name
  Approved: "TRUE" | "" | undefined,   // Approval status (string from CSV import)
  "Products/Services": "...",          // Product categories
  "Contact Name": "...",               // Primary contact
  "Contact Phone": "...",
  "Contact Email": "...",
  "Website URL": "...",
  City: "...",
  Country: "...",
  Notes: "...",
  createdAt: "2025-01-19T15:27:52.192Z"
}
```

## Solution Implemented

### 1. Updated Vendor Resolution Logic
**File**: `src/services/notifications/templates/newPRSubmitted.ts`

Added support for capitalized field names:
```typescript
const vendor = items.find(item => 
  item.id === id ||
  (item.Code && item.Code.toString() === id) ||  // ✅ Check capitalized 'Code'
  (item.code && item.code.toString() === id) ||  // Fallback for lowercase
  // ... additional matching strategies
);

if (vendor) {
  const vendorName = vendor.name || vendor.Name;  // ✅ Check both cases
  return vendorName;
}
```

### 2. Updated Reference Data Service
**File**: `src/services/referenceData.ts`

Fixed active/approved filtering for vendors:
```typescript
const activeItems = items.filter(item => {
  if (type === 'vendors') {
    // Vendors use 'Approved' field (string from Firestore)
    return item.Approved === true || 
           item.Approved === 'TRUE' || 
           item.Approved === '' || 
           item.Approved === undefined || 
           item.active !== false;
  }
  return item.active !== false;
});
```

### 3. Firestore Fallback Query
Added direct Firestore query as fallback:
```typescript
const vendorsCollection = collection(db, 'referenceData_vendors');
const vendorDocs = await getDocs(vendorsCollection);
items = vendorDocs.docs.map(doc => {
  const data = doc.data();
  return {
    id: doc.id,
    Code: data.Code,
    Name: data.Name,
    Approved: data.Approved,
    // ... other fields
  };
});
```

## Testing
After deploying the fix:
1. Submit a PR with any vendor code (e.g., 1025, 1026, 1030)
2. Email notification should show vendor name instead of code
3. Check Firebase Functions logs for vendor resolution debug info

## Data Management Going Forward

### Adding/Updating Vendors
Use the **Admin Dashboard** → **Reference Data** → **Vendors**:
- All changes persist directly to Firestore
- No need to update CSV files
- Changes take effect immediately

### Field Naming Convention
The current Firestore schema uses capitalized field names (`Code`, `Name`, `Approved`). This is the established schema and should be maintained for consistency.

If future refactoring normalizes field names to lowercase, update:
- `src/services/referenceData.ts`
- `src/services/notifications/templates/newPRSubmitted.ts`
- Any other code that queries vendor data

## Related Files
- `src/services/notifications/templates/newPRSubmitted.ts` - Email template generation
- `src/services/referenceData.ts` - Reference data service layer
- `functions/src/index.ts` - Cloud Functions (uses SendGrid API)

## Deployment
```bash
cd functions
npm run build
firebase deploy --only functions --force
```

## Result
✅ Vendor names now display correctly in email notifications
✅ Code queries Firestore directly (no CSV dependency)
✅ Handles both field name conventions (capitalized and lowercase)

