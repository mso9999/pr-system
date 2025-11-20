# Archive Import Guide

## Overview
This guide explains how to import legacy purchase requests from the old Google Forms system into the new PR system's archive dataroom.

## Prerequisites
- CSV file: `Purchase request (Responses) - Form Responses 1.csv` in the project root
- Node.js and npm installed
- Firebase project access

## Import Process

### Step 1: Prepare the CSV File
1. Ensure the CSV file is named exactly: `Purchase request (Responses) - Form Responses 1.csv`
2. Place it in the project root directory (same level as `package.json`)
3. The file should contain all legacy purchase request data from Google Forms

### Step 2: Map Legacy Vendors to Vendor Codes (Recommended)

Before importing, map legacy vendor names to vendor codes in the current system:

```bash
npm run map-archive-vendors
```

This will:
- Analyze all unique vendor names from the CSV
- Match them against vendors in the current system
- Create `archive-vendor-mapping.json` with mappings
- Show exact matches, similar matches, and unmatched vendors

**Review and edit `archive-vendor-mapping.json`** to:
- Verify correct matches
- Manually map unmatched vendors to vendor codes
- Remove or correct incorrect matches

### Step 3: Run the Import Script
```bash
npm run import-archive
```

The script will:
- Load vendor mappings from `archive-vendor-mapping.json` (if available)
- Parse the CSV file
- Map CSV columns to ArchivePR format
- Map vendor names to vendor codes using the mapping file
- Extract departments from expense type fields (format: "2:Engineering R&D" -> "Engineering R&D")
- Upload each record to the `archivePRs` collection in Firestore
- Process in batches to avoid rate limiting
- Show progress and completion status

### Step 4: Verify Import
1. Log into the PR system
2. Navigate to "Archive Dataroom" from the sidebar or dashboard
3. Verify that archived PRs are visible and searchable

## Field Mapping

The import script maps Google Forms fields to archive PR fields:

| Google Forms Field | Archive PR Field |
|-------------------|------------------|
| Timestamp | submittedDate |
| Email Address | requestorEmail, requestorName |
| Description | description |
| Vendor | vendorName, vendorCode (mapped) |
| Currency | currency |
| Cost | amount |
| Payment Format | paymentType |
| Site | site |
| Entity | organization |
| Project | projectCategory |
| Expense Type | expenseType, department (extracted) |
| Reason/Context | description (combined) |
| Vehicle | vehicle |
| Deadline | requiredDate |
| Approver | approver |
| Other fields | notes (combined) |

## Archive Features

### Access
- **Sidebar Menu**: "Archive Dataroom" item in left navigation
- **Dashboard**: "Archive Dataroom" button in header
- **Direct URL**: `/archive`

### Viewing
- **List View**: Searchable, filterable table of all archived PRs
- **Detail View**: Read-only view of individual archived PRs
- **No Editing**: Archive PRs are view-only for historical reference

### Search & Filter
- Search by: requestor name, description, vendor, department, email
- Filter by: department, vendor (populated from actual archive data)
- Sort by: date, requestor name, amount
- Pagination: 10, 25, 50, or 100 records per page
- **Note**: All archive PRs are for 1PWR LESOTHO, so no organization filter is needed

## Troubleshooting

### Import Errors
- **File not found**: Ensure CSV file is in project root with exact filename
- **Firebase auth errors**: May need to authenticate first (see script comments)
- **Rate limiting**: Script includes delays between batches; if issues persist, reduce batch size

### Viewing Issues
- **No records shown**: Check Firestore console to verify `archivePRs` collection exists
- **Search not working**: Ensure Firestore indexes are created (should auto-create)
- **Missing fields**: Some old system fields may not map 1:1; check `originalData` field in Firestore

## Firestore Collection Structure

### Collection: `archivePRs`
```typescript
{
  id: string (auto-generated)
  submittedDate: string (ISO date)
  requestorName: string
  requestorEmail: string
  description: string
  vendorName: string (for display)
  vendorCode: string (linked to current system)
  vendor: string (legacy vendor name)
  currency: string
  amount: number
  organization: string (always "1PWR LESOTHO")
  department: string (extracted from expense type)
  site: string
  projectCategory: string
  expenseType: string
  vehicle?: string
  requiredDate?: string
  paymentType?: string
  approver?: string
  notes?: string
  originalData: object (all original CSV fields)
  importedAt: string (ISO date)
  sourceFile: string
  rowNumber: number
}
```

## Notes
- This is a **one-time import** - the script can be run multiple times but will create duplicate records
- Archive PRs are **read-only** - no editing or status changes
- Original data is preserved in the `originalData` field for reference
- The archive system is separate from the active PR system

