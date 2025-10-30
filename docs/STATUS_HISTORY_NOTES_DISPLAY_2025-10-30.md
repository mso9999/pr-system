# Status History Notes Display
**Date:** October 30, 2025  
**Status:** ✅ Completed

## Overview
Added a comprehensive, read-only display of all status history notes to the PR view, providing full visibility into the complete lifecycle of status changes and associated notes.

## Business Requirement
Users need to see the entire record of notes at each status change throughout the PR/PO lifecycle. This should be:
- **Read-only:** No editing of historical notes
- **Comprehensive:** Show all status changes with timestamps, users, and notes
- **Accessible:** Visible in any view mode (edit or read-only)
- **Well-formatted:** Easy to read and scan

## Problem Statement
While the system had various history tracking mechanisms (workflow history, approval history), there was no single, clear view showing:
- All status changes chronologically
- Who made each status change
- What notes were provided at each status change
- When each change occurred

This made it difficult to:
- Track the complete decision-making process
- Understand why statuses changed
- Audit the PR lifecycle
- Review approver justifications and comments

## Implementation Details

### Data Structure
Uses the `statusHistory` field from `PRRequest`:

```typescript
export interface StatusHistoryItem {
  /** Status that the PR was changed to */
  status: PRStatus;
  /** Timestamp when the status was changed */
  timestamp: string;
  /** User who changed the status */
  user: UserReference;
  /** Notes about the status change */
  notes?: string;
}
```

### UI Implementation
**File:** `src/components/pr/PRView.tsx` (lines 2258-2337)

Added a new section after "Workflow History" that displays status history in a table format:

```typescript
{/* Status History Notes */}
{pr?.statusHistory && pr.statusHistory.length > 0 && (
  <Box sx={{ mb: 3 }}>
    <Typography variant="h6" gutterBottom>
      Status History & Notes
    </Typography>
    <Paper sx={{ p: 2 }}>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold' }}>Date & Time</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>User</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Notes</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pr.statusHistory
              .slice()
              .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
              .map((historyItem, index) => (
                <TableRow key={index} hover>
                  {/* Table cells with formatted data */}
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  </Box>
)}
```

### Features

#### 1. Chronological Sorting
- **Order:** Most recent first (descending by timestamp)
- **Method:** `.slice().sort()` to create new sorted array without mutating original
- **Comparison:** `new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()`

#### 2. Date & Time Formatting
```typescript
{new Date(historyItem.timestamp).toLocaleString('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
})}
```

**Example Output:**
- `Oct 30, 2025, 03:17 PM`
- `Oct 29, 2025, 07:48 PM`
- `Oct 28, 2025, 08:37 PM`

**Properties:**
- `whiteSpace: 'nowrap'` - Prevents date/time from wrapping
- `verticalAlign: 'top'` - Aligns with top of row for long notes

#### 3. Status Chip with Color Coding
```typescript
<Chip
  label={historyItem.status}
  size="small"
  color={
    historyItem.status === 'REJECTED'
      ? 'error'
      : historyItem.status === 'APPROVED'
      ? 'success'
      : historyItem.status === 'REVISION_REQUIRED'
      ? 'warning'
      : 'default'
  }
/>
```

**Color Mapping:**
- **Red (error):** REJECTED - indicates failure
- **Green (success):** APPROVED - indicates completion
- **Orange (warning):** REVISION_REQUIRED - indicates action needed
- **Gray (default):** All other statuses - neutral states

#### 4. User Display
```typescript
<Typography variant="body2">
  {historyItem.user?.email || 'System'}
</Typography>
```

**Features:**
- Shows user's email address
- Falls back to "System" for automated status changes
- Consistent typography (body2)

#### 5. Notes Formatting
```typescript
{historyItem.notes ? (
  <Typography 
    variant="body2" 
    sx={{ 
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
      maxWidth: '400px'
    }}
  >
    {historyItem.notes}
  </Typography>
) : (
  <Typography variant="body2" color="text.secondary" fontStyle="italic">
    No notes
  </Typography>
)}
```

**Properties:**
- `whiteSpace: 'pre-wrap'` - Preserves line breaks and spaces
- `wordBreak: 'break-word'` - Breaks long words to prevent overflow
- `maxWidth: '400px'` - Constrains width for readability
- **Placeholder:** Shows "No notes" in italic gray when notes are empty

### Table Structure

```
┌─────────────────────┬──────────────────┬────────────────────┬──────────────────────────┐
│ Date & Time         │ Status           │ User               │ Notes                    │
│ (no wrap)           │ (chip)           │ (email)            │ (pre-wrap, max 400px)    │
├─────────────────────┼──────────────────┼────────────────────┼──────────────────────────┤
│ Oct 30, 2025,       │ [PENDING_APPROVAL] │ mso@1pwrafrica.com │ Both approvers have    │
│ 08:17 PM            │ (default)        │                    │ approved different quotes│
├─────────────────────┼──────────────────┼────────────────────┼──────────────────────────┤
│ Oct 29, 2025,       │ [PENDING_APPROVAL] │ tumelo@1pwra...   │ Lowest quote selected  │
│ 09:48 PM            │ (default)        │                    │ for best value          │
├─────────────────────┼──────────────────┼────────────────────┼──────────────────────────┤
│ Oct 29, 2025,       │ [IN_QUEUE]       │ procurement@...    │ Quotes added, ready    │
│ 07:51 PM            │ (default)        │                    │ for approval            │
├─────────────────────┼──────────────────┼────────────────────┼──────────────────────────┤
│ Oct 28, 2025,       │ [SUBMITTED]      │ jopi@1pwra...     │ No notes                │
│ 08:32 PM            │ (default)        │                    │ (italic gray)            │
└─────────────────────┴──────────────────┴────────────────────┴──────────────────────────┘
```

### UI Styling

#### Table
- **Size:** `small` - Compact display
- **Container:** `<TableContainer>` for horizontal scroll on small screens
- **Paper:** Elevated card with padding

#### Table Cells
- **Header:** Bold font weight for column headers
- **Body:** Vertical align top for multi-line content
- **Hover:** Row hover effect for better scanning

#### Typography
- **Variant:** `body2` for consistent sizing
- **Secondary text:** Gray italic for "No notes" placeholder
- **Preserve formatting:** `pre-wrap` for notes with line breaks

## Use Cases

### 1. Approval Justification Review
**Scenario:** Finance wants to review why an approver selected a non-lowest quote

**Solution:**
- Navigate to PR view
- Scroll to "Status History & Notes"
- Find the PENDING_APPROVAL → APPROVED transition
- Read approver's justification notes explaining vendor selection

### 2. Rejection Reason Lookup
**Scenario:** Requestor wants to understand why their PR was rejected

**Solution:**
- View rejected PR
- Check Status History
- Find REJECTED status entry
- Read approver's notes explaining rejection reason

### 3. Revision Requirements
**Scenario:** Procurement needs to know what changes were requested

**Solution:**
- Open PR in REVISION_REQUIRED status
- Review Status History Notes
- See detailed notes from approver about required changes
- Reference this when making corrections

### 4. Audit Trail
**Scenario:** Admin auditing a high-value PR months after approval

**Solution:**
- Complete chronological record of all status changes
- Each change shows who made it, when, and why (if notes provided)
- Can verify proper approval process was followed
- Can review justifications for decisions

### 5. Quote Conflict Resolution Tracking
**Scenario:** Understanding how a quote conflict was resolved

**Solution:**
- View PR that had quote conflict
- Status History shows:
  - Initial PENDING_APPROVAL entries from both approvers
  - Notes explaining each approver's quote selection
  - Final resolution with one approver changing selection
  - Notes explaining the final agreed-upon choice

## Visual Appearance

### Section Header
```
┌────────────────────────────────────────────────────────┐
│ Status History & Notes                                  │
│ ════════════════════════════════════════════════════   │
│ ┌────────────────────────────────────────────────────┐ │
│ │ [Table with all status changes]                    │ │
│ └────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

### Empty State
If `statusHistory` is empty or undefined, the entire section is not rendered (conditional rendering).

### With Data
```
Status History & Notes
════════════════════════

Date & Time          | Status            | User              | Notes
─────────────────────┼───────────────────┼───────────────────┼─────────────
Oct 30, 2025, 8:17 PM | [PENDING_APPROVAL] | mso@1pwrafrica.com | Quote conflict
                     |    (gray chip)    |                   | detected. Both
                     |                   |                   | approvers must
                     |                   |                   | agree on quote.
─────────────────────┼───────────────────┼───────────────────┼─────────────
Oct 29, 2025, 7:48 PM | [APPROVED]       | tumelo@1pwra...   | Selected lowest
                     |  (green chip)     |                   | quote for best
                     |                   |                   | value.
─────────────────────┼───────────────────┼───────────────────┼─────────────
Oct 28, 2025, 8:32 PM | [REJECTED]       | approval@1pwra... | Duplicate PR
                     |   (red chip)      |                   | already exists.
                     |                   |                   | Please check
                     |                   |                   | PR-2025-001.
```

## Location in PR View

The Status History Notes section appears:
1. **After:** Workflow History (if present)
2. **Before:** Edit mode stepper
3. **Always visible:** In both view and edit modes
4. **Conditional:** Only renders if `statusHistory` exists and has items

### Context in Full PR View
```
[PR Header with Back Button and Actions]

[Procurement Actions] (if applicable)
[Approver Actions] (if applicable)
[Approved Status Actions] (if applicable)

[PR Status Chip]

[Workflow History] ← Existing feature
[Status History & Notes] ← NEW FEATURE

[Edit Mode Stepper] (if editing)

[Basic Information]
[Line Items]
[Quotes]
```

## Data Population

Status history is populated automatically by the system whenever:
1. **Status changes** via `prService.updatePRStatus()`
2. **Notes are provided** in status change dialogs
3. **User information** is captured from current authenticated user
4. **Timestamp** is automatically generated

### Example Status History Entry Creation
```typescript
const statusHistoryItem: StatusHistoryItem = {
  status: newStatus,
  timestamp: new Date().toISOString(),
  user: {
    id: currentUser.id,
    email: currentUser.email,
    displayName: `${currentUser.firstName} ${currentUser.lastName}`
  },
  notes: providedNotes || undefined
};
```

## Benefits

1. **Complete Audit Trail:** Every status change is documented
2. **Decision Transparency:** Understand reasoning behind approvals/rejections
3. **Improved Communication:** Notes provide context for future reference
4. **Compliance:** Meets audit and accountability requirements
5. **Knowledge Preservation:** Historical decisions are documented
6. **Conflict Resolution:** Track how disagreements were resolved
7. **Training:** New users can see examples of proper justifications
8. **Accountability:** Clear record of who made each decision

## Accessibility

- **Keyboard Navigation:** Table is fully keyboard navigable
- **Screen Readers:** Proper semantic HTML table structure
- **Color Contrast:** All text meets WCAG AA standards
- **Responsive:** Horizontal scroll on small screens

## Performance Considerations

- **Conditional Rendering:** Section only renders if data exists
- **Client-side Sorting:** Single-pass sort on render
- **No Pagination:** Assumes reasonable number of status changes per PR
- **Efficient Re-renders:** Uses React key prop for list items

## Future Enhancements

- Add export to CSV functionality
- Add filtering by status type
- Add search within notes
- Add date range filtering
- Show time elapsed between status changes
- Add expand/collapse for long notes
- Add "copy notes" button for reference
- Show attachments associated with status changes
- Add visual timeline view option

## Related Files

- `src/components/pr/PRView.tsx` - Main PR view component with status history display
- `src/types/pr.ts` - StatusHistoryItem interface definition
- `src/services/pr.ts` - PR service that populates statusHistory
- `docs/QUOTE_CONFLICT_UI_ENHANCEMENT_2025-10-30.md` - Related conflict resolution UI

## Testing

✅ **Empty History:** Section does not render
✅ **Single Entry:** Displays correctly without errors
✅ **Multiple Entries:** Sorted chronologically (newest first)
✅ **Long Notes:** Word wrap and max width prevent overflow
✅ **No Notes:** Shows "No notes" placeholder
✅ **User Fallback:** Shows "System" when user is null
✅ **Status Colors:** Correct chip colors for each status
✅ **Date Formatting:** Consistent and readable format
✅ **Read-only:** No edit controls present

## Compliance

- **GDPR:** User emails displayed are authorized PR participants
- **Audit Requirements:** Immutable historical record maintained
- **Data Retention:** Follows standard PR lifecycle retention policies

