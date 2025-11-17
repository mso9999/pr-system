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

### Step 2: Run the Import Script
```bash
npm run import-archive
```

The script will:
- Parse the CSV file
- Map fields from the old system to the new archive format
- Import records into Firestore collection `archivePRs`
- Process in batches to avoid rate limiting
- Show progress and completion status

### Step 3: Verify Import
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
| Vendor | vendor |
| Currency | currency |
| Cost | amount |
| Payment Format | paymentType |
| Site | site |
| Entity | organization |
| Project | projectCategory |
| Expense Type | expenseType |
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
- Search by: requestor name, description, vendor, department, organization
- Filter by: organization, department, vendor
- Sort by: date, requestor name, amount
- Pagination: 10, 25, 50, or 100 records per page

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
  vendor: string
  currency: string
  amount: number
  organization: string
  department: string
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

