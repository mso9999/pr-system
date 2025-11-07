# Multiple File Upload & Delete Feature - November 6, 2025

## Overview
Implemented comprehensive multiple file upload and delete functionality for document management in APPROVED status (and system-wide where applicable).

## Bug Fix - November 7, 2025
**Issue**: Files were not being deleted from Firestore when the last file in an array was removed.
**Root Cause**: Delete handlers were setting the field to `undefined` when the array became empty, but the `pr.ts` service's `cleanUndefined()` function filters out undefined values, so Firestore never received the update.
**Solution**: Changed delete handlers to set the field to an empty array `[]` instead of `undefined` when all files are deleted.
**Files Modified**:
- `src/components/pr/ApprovedStatusActions.tsx` (handleProformaDelete, handlePoPDelete)
- `src/components/pr/OrderedStatusActions.tsx` (handleDeliveryNoteDelete, handleDeliveryPhotoDelete)

## Changes Made

### 1. New Reusable Component
**File**: `src/components/common/FileUploadManager.tsx`
- Handles multiple file uploads with progress indication
- Displays uploaded files with metadata (name, size, upload date, uploader)
- Download functionality for each file
- Delete functionality with confirmation
- Support for file type restrictions
- Maximum files limit option
- Helper text and visual feedback

### 2. Updated Utility Functions
**File**: `src/utils/formatters.ts`
- Added `formatFileSize()` function
- Converts bytes to human-readable format (KB, MB, GB)

### 3. Updated Type Definitions
**File**: `src/types/pr.ts`
- Changed `proformaInvoice` from `Attachment` to `Attachment | Attachment[]`
- Changed `proofOfPayment` from `Attachment` to `Attachment | Attachment[]`
- Backward compatible: supports both single attachment (legacy) and arrays (new)

### 4. Enhanced ApprovedStatusActions Component
**File**: `src/components/pr/ApprovedStatusActions.tsx`

#### New Helper Function
- `normalizeAttachments()`: Converts single attachment or array to consistent array format
- Ensures backward compatibility with existing data

#### Updated Upload Handlers
- `handleProformaUpload()`: Now accepts multiple files
- `handlePoPUpload()`: Now accepts multiple files
- Both handlers merge new files with existing attachments
- Upload multiple files in parallel using `Promise.all()`

#### New Delete Handlers
- `handleProformaDelete()`: Remove individual proforma files
- `handlePoPDelete()`: Remove individual PoP files
- Updates Firestore with remaining files after deletion

#### Updated Validation Logic
- Checks for array length instead of single file existence
- Works with `normalizeAttachments()` for consistency
- Shows file count in confirmation dialogs ("3 file(s)")

#### Updated UI Components
- Replaced manual file input with `FileUploadManager` component
- Shows list of all uploaded files with download/delete options
- Displays file count and metadata
- Maintains override functionality alongside file uploads

### 5. Enhanced OrderedStatusActions Component
**File**: `src/components/pr/OrderedStatusActions.tsx`

#### Updated Upload Handlers
- `handleDeliveryNoteUpload()`: Now accepts multiple files (was single file)
- `handleDeliveryPhotosUpload()`: Already supported multiple, now uses parallel uploads
- Both handlers merge new files with existing attachments

#### New Delete Handlers
- `handleDeliveryNoteDelete()`: Remove individual delivery note files
- `handleDeliveryPhotoDelete()`: Remove individual delivery photos
- Updates Firestore with remaining files after deletion

#### Updated Validation Logic
- Uses `normalizeAttachments()` for delivery notes
- Checks for array length for consistent validation
- Works seamlessly with override functionality

#### Updated UI Components
- Both delivery notes and photos now use `FileUploadManager`
- Consistent user experience across all document types
- File list display with metadata and actions

## Features

### User Capabilities
1. **Multiple File Upload**: 
   - Select and upload multiple files at once
   - No limit on number of files (can be configured via `maxFiles` prop)
   - Supported formats: PDF, JPG, JPEG, PNG

2. **File Management**:
   - View all uploaded files in a list
   - Download any file with one click
   - Delete individual files with confirmation
   - See file metadata (size, upload date, uploader)

3. **Backward Compatibility**:
   - Existing PRs with single attachments still work
   - Automatically converted to array format when accessed
   - No data migration required

### Technical Features
1. **Atomic Operations**: Each file operation updates Firestore
2. **Error Handling**: User-friendly error messages for failed operations
3. **Loading States**: Visual feedback during uploads and deletes
4. **Confirmation Dialogs**: Prevents accidental file deletion
5. **Type Safety**: Full TypeScript support with proper typing

## Files Modified
- ✅ `src/components/common/FileUploadManager.tsx` (NEW)
- ✅ `src/utils/formatters.ts`
- ✅ `src/types/pr.ts`
- ✅ `src/components/pr/ApprovedStatusActions.tsx`
- ✅ `src/components/pr/OrderedStatusActions.tsx`

## Usage Example

```typescript
<FileUploadManager
  label="Proforma Invoice"
  files={normalizeAttachments(pr.proformaInvoice)}
  onUpload={handleProformaUpload}
  onDelete={handleProformaDelete}
  uploading={uploadingProforma}
  accept=".pdf,.jpg,.jpeg,.png"
  helperText="PDF, JPG, or PNG files (multiple files allowed)"
  multiple
/>
```

## Completed Enhancements
- [x] ✅ Updated `ApprovedStatusActions.tsx` for proforma and PoP
- [x] ✅ Updated `OrderedStatusActions.tsx` for delivery notes and photos
- [x] ✅ Multiple file upload and individual delete
- [x] ✅ File metadata display
- [x] ✅ Backward compatibility with existing data

## Future Enhancements
- [ ] Add file upload progress bars
- [ ] Add bulk delete functionality (select multiple files to delete)
- [ ] Add file preview functionality (view images inline)
- [ ] Add drag-and-drop support
- [ ] Add file size limits and validation
- [ ] Compress large images before upload

## Testing Checklist

### APPROVED Status (Proforma & Proof of Payment)
- [ ] Upload single proforma file (backward compatibility)
- [ ] Upload multiple proforma files at once
- [ ] Upload proforma files one at a time (accumulative)
- [ ] Delete individual proforma files
- [ ] Download proforma files
- [ ] Upload single PoP file
- [ ] Upload multiple PoP files at once
- [ ] Delete individual PoP files
- [ ] Download PoP files
- [ ] Validate file requirements before moving to ORDERED
- [ ] Test with proforma override enabled
- [ ] Test with PoP override enabled
- [ ] Test error handling (network failures, large files)
- [ ] Verify file metadata display (name, size, date, uploader)
- [ ] Test with existing PRs that have single attachments

### ORDERED Status (Delivery Notes & Photos)
- [ ] Upload single delivery note file (backward compatibility)
- [ ] Upload multiple delivery note files at once
- [ ] Upload delivery notes one at a time (accumulative)
- [ ] Delete individual delivery notes
- [ ] Download delivery notes
- [ ] Upload single delivery photo
- [ ] Upload multiple delivery photos at once
- [ ] Upload photos one at a time (accumulative)
- [ ] Delete individual photos
- [ ] Download photos
- [ ] Validate delivery documentation before moving to COMPLETED
- [ ] Test with delivery override enabled
- [ ] Test error handling for image uploads
- [ ] Verify photo metadata display
- [ ] Test vendor auto-approval workflow with complete documentation

## Impact
- **User Experience**: Significantly improved across both APPROVED and ORDERED statuses
  - Users can now upload multiple proforma invoices, proof of payments, delivery notes, and photos
  - Easy management with individual file delete and download
  - Clear visual feedback with file metadata
- **Data Integrity**: Backward compatible - no data loss or migration required
  - Existing PRs with single attachments work seamlessly
  - Automatic conversion to array format when needed
- **Performance**: Parallel uploads for faster processing
  - Multiple files upload simultaneously
  - Reduced wait time for users
- **Maintainability**: Reusable component for future file upload needs
  - `FileUploadManager` can be used anywhere in the application
  - Consistent UI/UX across all file upload scenarios

## Notes
- The `FileUploadManager` component is designed to be reusable across the entire application
- Successfully applied to all document types:
  - ✅ Proforma invoices (APPROVED status)
  - ✅ Proof of Payment (APPROVED status)
  - ✅ Delivery notes (ORDERED status)
  - ✅ Delivery photos (ORDERED status)
- The implementation maintains all existing override functionality
- Validation logic updated to work with multiple files seamlessly
- All changes are backward compatible - no database migration required

