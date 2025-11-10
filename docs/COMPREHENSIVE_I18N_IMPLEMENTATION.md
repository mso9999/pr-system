# Comprehensive Internationalization (i18n) Implementation Guide

## Overview
This document provides the pattern and approach for making all PR views and status actions fully bilingual (English/French).

## Translation Files Status
✅ **COMPLETED**: Translation files have been significantly expanded with 60+ new keys:
- `src/locales/en.json` - English translations
- `src/locales/fr.json` - French translations

## Implementation Pattern

### Step 1: Import useTranslation Hook
Add to the top of your component file:

```typescript
import { useTranslation } from 'react-i18next';
```

### Step 2: Initialize Translation Function
At the start of your component function:

```typescript
export function YourComponent() {
  const { t } = useTranslation();
  // ... rest of component
}
```

### Step 3: Replace Hardcoded Strings
Replace all English strings with translation keys:

**Before:**
```typescript
<Button>Push to Approver</Button>
<Typography>Status</Typography>
<DialogTitle>Cancel PR</DialogTitle>
```

**After:**
```typescript
<Button>{t('pr.pushToApprover')}</Button>
<Typography>{t('pr.status')}</Typography>
<DialogTitle>{t('pr.cancelPR')}</DialogTitle>
```

### Step 4: Handle Dynamic Content
For strings with variables, use interpolation:

**Before:**
```typescript
enqueueSnackbar(`PR status successfully updated to ${newStatus}`, { variant: 'success' });
```

**After:**
First add to translation files:
```json
"prStatusUpdated": "PR status successfully updated to {{status}}"
```

Then use:
```typescript
enqueueSnackbar(t('pr.prStatusUpdated', { status: newStatus }), { variant: 'success' });
```

## Files Requiring Translation Updates

### Priority 1: Main PR Views (High Visibility)
1. **✅ STARTED: `src/components/pr/ProcurementActions.tsx`**
   - Import added, t() initialized
   - Continue replacing hardcoded strings with t() calls
   - Key translations: pushToApprover, moveToQueue, reject, revise, cancel, notes, confirm

2. **`src/components/pr/PRView.tsx`** (Largest file - 2800 lines)
   - Add `const { t } = useTranslation();`
   - Replace UI labels: status, requestor, department, site, etc.
   - Key sections to translate:
     - Basic Information section
     - Additional Information section
     - Status History & Notes
     - Overrides & Exceptions
     - All button labels and dialog titles

3. **`src/components/pr/ApproverActions.tsx`**
   - Button labels: approve, reject, revise
   - Dialog titles and messages
   - Validation messages
   - Quote selection UI

4. **`src/components/pr/ApprovedStatusActions.tsx`**
   - PO document management UI
   - Proforma invoice, proof of payment labels
   - Estimated delivery date
   - Move to ORDERED button

5. **`src/components/pr/OrderedStatusActions.tsx`**
   - Delivery documentation labels
   - Delivery notes, photos
   - Order completion dialog
   - Vendor approval workflow messages
   - Move to COMPLETED button

6. **`src/components/pr/CompletedStatusView.tsx`**
   - Document archive labels
   - Completion dates
   - File upload labels in read-only mode

### Priority 2: Supporting Components
7. **`src/components/pr/QuoteForm.tsx`**
   - Quote entry fields
   - Vendor selection
   - Amount, currency labels

8. **`src/components/pr/QuoteList.tsx`**
   - Quote display labels
   - Select preferred quote

9. **`src/components/pr/ResurrectionActions.tsx`**
   - Reactivation dialogs for REJECTED/CANCELED PRs

10. **`src/components/pr/PODocument.tsx`**
    - PO document generation labels

## Translation Keys Added

### General PR Keys
```
pr.purchaseRequest, pr.prNumber, pr.status, pr.requestor, pr.approver
pr.secondApprover, pr.department, pr.site, pr.category, pr.expenseType
pr.vendor, pr.preferredVendor, pr.selectedVendor
pr.estimatedAmount, pr.finalPrice, pr.requiredDate
pr.description, pr.lineItems, pr.quotes, pr.attachments
pr.comments, pr.history, pr.statusHistory, pr.workflowHistory
```

### Actions
```
pr.pushToApprover, pr.moveToQueue, pr.reviseAndResubmit
pr.revertToPrevious, pr.moveToCompleted
pr.approvePR, pr.rejectPR, pr.cancelPR
pr.saveChanges, pr.discardChanges
```

### Status & Approval
```
pr.approved, pr.notApproved, pr.approvalExpired, pr.notSpecified
pr.notes, pr.optionalNotes, pr.justification, pr.justificationRequired
```

### Documents & Overrides
```
pr.overridesExceptions, pr.ruleValidationOverride, pr.quoteRequirementOverride
pr.proformaOverride, pr.popOverride, pr.poDocumentOverride
pr.deliveryDocOverride, pr.finalPriceVariance, pr.priceDiscrepancy
pr.proformaInvoice, pr.proofOfPayment, pr.poDocument
pr.deliveryNotes, pr.deliveryPhotos, pr.noFilesUploaded
```

### Completion & Vendor
```
pr.completed, pr.completedOn, pr.createdOn, pr.totalDays
pr.completedOrderDetails, pr.deliveryDocumentation
pr.estimatedDelivery, pr.orderSatisfactory, pr.describeIssues
pr.approveVendorDespiteIssues, pr.vendorApprovalAction
pr.vendorAutoApproved, pr.vendorManualApproval, pr.vendorNotApproved
pr.confirmCompletion
```

## Testing Approach

### 1. Switch Language
Use the language toggle in the UI to switch between English and French.

### 2. Test All PR Statuses
Create test PRs and move them through each status to verify translations:
- SUBMITTED → IN_QUEUE (Procurement actions)
- IN_QUEUE → PENDING_APPROVAL (Push to approver)
- PENDING_APPROVAL → APPROVED (Approver actions)
- APPROVED → ORDERED (PO document management)
- ORDERED → COMPLETED (Delivery documentation)

### 3. Test Edge Cases
- Overrides and exceptions
- Dual approval workflow
- Quote management
- Document uploads
- Validation errors

## Common Patterns

### Buttons
```typescript
<Button>{t('common.save')}</Button>
<Button>{t('common.cancel')}</Button>
<Button>{t('pr.pushToApprover')}</Button>
```

### Form Labels
```typescript
<TextField label={t('pr.notes')} />
<TextField label={t('pr.justification')} />
```

### Typography Headers
```typescript
<Typography variant="h6">{t('pr.statusHistory')}</Typography>
<Typography>{t('pr.additionalInformation')}</Typography>
```

### Dialog Titles
```typescript
<DialogTitle>{t('pr.confirmCompletion')}</DialogTitle>
<DialogTitle>{t('pr.cancelPR')}</DialogTitle>
```

### Snackbar Messages
```typescript
enqueueSnackbar(t('pr.prApprovedSuccess'), { variant: 'success' });
enqueueSnackbar(t('errors.genericError'), { variant: 'error' });
```

## Status Mapping
The `status` object already has translations defined:
```typescript
// Use this for PR status display
<Chip label={t(`status.${pr.status}`)} />
```

## Implementation Timeline Estimate
- ProcurementActions: 1-2 hours
- PRView: 4-6 hours (largest file)
- ApproverActions: 2-3 hours
- ApprovedStatusActions: 2-3 hours  
- OrderedStatusActions: 2-3 hours
- CompletedStatusView: 1 hour
- Supporting components: 2-3 hours
- Testing: 2-3 hours

**Total: Approximately 16-23 hours of development work**

## Notes
- All translation keys follow the pattern: `category.key` (e.g., `pr.pushToApprover`)
- Common keys are in the `common` category (save, cancel, edit, etc.)
- Status translations use the exact status enum value as the key
- Use `t()` for all user-facing text, including:
  - Button labels
  - Form labels
  - Dialog titles and content
  - Tooltips
  - Snackbar messages
  - Table headers
  - Section titles

## Resources
- Translation config: `src/config/i18n.ts`
- English translations: `src/locales/en.json`
- French translations: `src/locales/fr.json`
- Language toggle component: `src/components/common/LanguageToggle.tsx`

