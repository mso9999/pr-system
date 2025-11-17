# Payment Type Feature - Implementation Summary

## Overview
Added a payment type dropdown field that appears from IN_QUEUE status onwards, linked to reference data. Procurement can set payment type starting at IN_QUEUE status.

## Changes Made

### 1. Type Definitions (`src/types/referenceData.ts`)
- Added `'paymentTypes'` to `ReferenceDataType` union
- Added `'paymentTypes'` to `ORG_INDEPENDENT_TYPES` array (payment types are universal, not organization-specific)

### 2. PR Request Type (`src/types/pr.ts`)
- Added `paymentType?: string` field to `PRRequest` interface
- Field is optional and becomes relevant from IN_QUEUE status onwards

### 3. PRView Component (`src/components/pr/PRView.tsx`)
- Added `paymentTypes` state variable
- Updated reference data loading to include payment types
- Added `paymentType` to `EditablePRFields` interface
- **Added Payment Type dropdown** in Basic Information section:
  - **Visibility:** Shows only when status is IN_QUEUE, PENDING_APPROVAL, APPROVED, ORDERED, COMPLETED, or CANCELED
  - **Editability:** 
    - Procurement officers can edit in all visible statuses (when in edit mode)
    - Other users can only edit in PENDING_APPROVAL status (for approvers)
  - **Position:** Appears after the Required Date field
  - **Options:** Populated from reference data, shows only active payment types
  - **Helper text:** Shows "Please select payment type" when not selected

### 4. Seed Script (`src/scripts/seedPaymentTypes.ts`)
- Created new seed script to populate initial payment types
- Pre-populated with:
  - **Cash**
  - **EFT (Electronic Funds Transfer)**
  - **Credit Card**
  - **Check** (bonus)
  - **Bank Transfer** (bonus)
- Added npm script: `npm run seed-payment-types`

### 5. Package.json
- Added `"seed-payment-types": "tsx src/scripts/seedPaymentTypes.ts"` script

### 6. Bug Fixes (Previously Requested)
- **Fixed Firestore composite filter query issue** (`src/services/pr.ts`):
  - Added `and` import from firebase/firestore
  - Properly wrapped `or()` filter with `and()` when organization filter is present
  - This fixes the "InvalidQuery: When using composite filters..." error users were experiencing during PR submission

- **Added admin@1pwrafrica.com to notifications** (`src/services/notification.ts`):
  - Admin email now included in CC list for all status changes from APPROVED onwards
  - Applies to: APPROVED, ORDERED, COMPLETED, and CANCELED statuses

## How to Deploy

### 1. Seed Payment Types (First Time Only)
```bash
cd "C:\Users\1PWR\PR system"
npm run seed-payment-types
```

**Note:** You may need to authenticate first. If the script fails, you can manually add payment types via Firebase Console or the admin panel.

### 2. Build and Deploy
```bash
npm run build
firebase deploy --only hosting
```

### 3. Push to GitHub
```bash
git add .
git commit -m "Add payment type dropdown, fix Firestore query bug, add admin notifications"
git push origin main
```

## User Experience

### For Requestors:
- Payment type field is NOT visible during PR creation
- Becomes visible once PR reaches IN_QUEUE status
- Can view payment type but cannot edit it (procurement sets it)

### For Procurement Officers:
- Can set payment type starting at IN_QUEUE status
- Field remains editable in all subsequent statuses (PENDING_APPROVAL, APPROVED, ORDERED, COMPLETED)

### For Approvers:
- Can see payment type from IN_QUEUE onwards
- Can set payment type during PENDING_APPROVAL status
- Field becomes read-only after approval (unless user is procurement)

### For Admins:
- Now receive notifications for all PRs from APPROVED status onwards
- admin@1pwrafrica.com added to CC list automatically

## Firebase Console - Manual Payment Type Setup

If you prefer to manually add payment types via Firebase Console:

1. Go to Firebase Console → Firestore Database
2. Create collection: `referenceData_paymentTypes`
3. Add documents with structure:
   ```json
   {
     "id": "cash",
     "code": "CASH",
     "name": "Cash",
     "isActive": true,
     "createdAt": "2025-11-12T...",
     "updatedAt": "2025-11-12T..."
   }
   ```
4. Repeat for: EFT, Credit Card, Check, Bank Transfer

## Database Structure

### Collection: `referenceData_paymentTypes`
```
{
  id: string (auto-generated or custom)
  code: string (e.g., "CASH", "EFT")
  name: string (display name)
  isActive: boolean
  createdAt: string (ISO date)
  updatedAt: string (ISO date)
}
```

### PR Document Update
```
{
  ... existing PR fields ...
  paymentType: string (reference to payment type id)
}
```

## Testing Checklist

- [ ] Seed payment types successfully
- [ ] Payment type dropdown appears in IN_QUEUE status
- [ ] Payment type dropdown appears in PENDING_APPROVAL status
- [ ] Payment type dropdown appears in APPROVED status
- [ ] Payment type dropdown appears in ORDERED status
- [ ] Payment type dropdown appears in COMPLETED status
- [ ] Procurement can edit payment type in IN_QUEUE status
- [ ] Procurement can edit payment type in all subsequent statuses
- [ ] Approvers can set payment type during PENDING_APPROVAL
- [ ] Non-procurement users cannot edit payment type in IN_QUEUE
- [ ] Payment type persists after saving
- [ ] Payment type displays correctly in view mode
- [ ] PR submission works without Firestore query errors
- [ ] admin@1pwrafrica.com receives notifications for APPROVED and later statuses

## Future Enhancements (Optional)

1. Make payment type required/optional based on business rules
2. Add payment terms field (e.g., "Net 30", "Due on Receipt")
3. Link payment type to accounting system integration
4. Add payment status tracking (Pending, Paid, Overdue)
5. Generate payment reports filtered by payment type

