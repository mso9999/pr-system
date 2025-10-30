# Firestore Undefined Values Fix

**Date:** October 29, 2025  
**Issue:** Saving PR with quotes failed with "Unsupported field value: undefined"

## Problem

When trying to save a PR with quotes, the operation failed with:
```
FirebaseError: Function updateDoc() called with invalid data. 
Unsupported field value: undefined (found in document purchaseRequests/c9ivfOnFrpddKvGHeFeN)
```

### Root Cause

Firestore **does not allow `undefined` values** in documents. However, the code was sending update payloads that contained `undefined` values in:
1. **Top-level fields**: e.g., `approver2: undefined` when not in dual approval scenario
2. **Nested objects**: e.g., `approvalWorkflow: { secondApprover: undefined }`
3. **Other optional fields**: Any field that could be `undefined`

The original filtering logic in `updatePR` only filtered out `undefined` at the **top level**, missing nested objects:

```typescript
// OLD CODE - Only filters top level
const cleanedData: any = {};
Object.keys(updateData).forEach(key => {
  const value = (updateData as any)[key];
  if (value !== undefined) {
    cleanedData[key] = value;  // But value itself might contain nested undefined!
  }
});
```

This meant:
- ✅ `approver2: undefined` would be filtered out at top level
- ❌ `approvalWorkflow: { secondApprover: undefined }` would NOT be cleaned
- Result: Firestore error when trying to save

## The Fix

### Recursive Cleaning Function

**File:** `src/services/pr.ts`  
**Lines:** 280-300

Implemented a recursive `cleanUndefined` function that:
1. Traverses the entire object tree
2. Removes `undefined` values at **all levels**
3. Handles arrays, nested objects, and primitive values
4. Preserves `null` values (which Firestore accepts)

```typescript
// Recursively filter out undefined values - Firestore doesn't allow undefined
const cleanUndefined = (obj: any): any => {
  if (obj === null) return null;  // Preserve null
  if (obj === undefined) return undefined;  // Mark for removal
  
  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => cleanUndefined(item));
  }
  
  // Handle objects
  if (typeof obj === 'object') {
    const cleaned: any = {};
    Object.keys(obj).forEach(key => {
      const value = cleanUndefined(obj[key]);
      if (value !== undefined) {  // Only include if not undefined
        cleaned[key] = value;
      }
    });
    return cleaned;
  }
  
  // Primitive values (string, number, boolean)
  return obj;
};

const cleanedData = cleanUndefined(updateData);
```

### How It Works

**Example Input:**
```typescript
{
  approver: 'BSY3Ov0tOIgYXvM7bYBfVapjmXA2',
  approver2: undefined,  // ❌ Should be removed
  quotes: [
    {
      id: 'abc123',
      vendorId: '1020',
      amount: 23453,
      attachments: [...]
    }
  ],
  approvalWorkflow: {
    currentApprover: 'BSY3Ov0tOIgYXvM7bYBfVapjmXA2',
    secondApprover: undefined,  // ❌ Should be removed
    lastUpdated: '2025-10-29T...'
  }
}
```

**After Cleaning:**
```typescript
{
  approver: 'BSY3Ov0tOIgYXvM7bYBfVapjmXA2',
  // approver2 removed ✅
  quotes: [
    {
      id: 'abc123',
      vendorId: '1020',
      amount: 23453,
      attachments: [...]
    }
  ],
  approvalWorkflow: {
    currentApprover: 'BSY3Ov0tOIgYXvM7bYBfVapjmXA2',
    // secondApprover removed ✅
    lastUpdated: '2025-10-29T...'
  }
}
```

## Why This Matters

### Firestore Rules:
- ✅ **Allowed:** `null`, strings, numbers, booleans, arrays, objects, timestamps
- ❌ **NOT Allowed:** `undefined`

### JavaScript vs Firestore:
- **JavaScript:** `undefined` means "property doesn't exist"
- **Firestore:** Cannot store `undefined`, must omit the field entirely or use `null`

### Common Scenarios:
1. **Optional fields** that may not be set: `approver2`, `vehicle`, `notes`
2. **Conditional fields** based on business logic: dual approval fields
3. **Partial updates** where some fields are intentionally not updated

## Testing

### Test Case 1: Add Quote to PR (The Failing Scenario)
**Steps:**
1. Open PR in IN_QUEUE status
2. Click Edit
3. Add Quote → Select vendor → Enter amount → Upload attachment
4. Click Save

**Before Fix:**
- ❌ Error: "Unsupported field value: undefined"
- Quote not saved

**After Fix:**
- ✅ Quote saved successfully
- No errors

### Test Case 2: Save PR Without Second Approver
**Steps:**
1. Open PR with amount < Rule 3 (single approver scenario)
2. Click Edit, make changes
3. Click Save

**Before Fix:**
- ❌ Error if `approver2: undefined` in payload

**After Fix:**
- ✅ Saves successfully
- `approver2` field omitted from Firestore document

### Test Case 3: Update PR with Complex Nested Data
**Steps:**
1. Edit PR with multiple line items, quotes, attachments
2. Save

**Before Fix:**
- ❌ Could fail if any nested field was `undefined`

**After Fix:**
- ✅ All nested `undefined` values cleaned
- Saves successfully

## Related Issues

- **APPROVER2_PERSISTENCE_BUG_FINAL_2025-10-29.md** - Second approver not persisting
- **NON_LOWEST_QUOTE_JUSTIFICATION_2025-10-29.md** - Quote selection validation

## Performance Considerations

The recursive cleaning function adds minimal overhead:
- **O(n)** complexity where n = total fields in the object tree
- Runs only once per save operation
- Negligible impact on user experience

## Alternative Approaches Considered

1. **Manual field-by-field cleaning**: Too error-prone, would miss new fields
2. **TypeScript strict mode**: Would catch some issues at compile time, but not all
3. **Firestore SDK v10+**: Uses different API but same `undefined` restriction
4. **Convert undefined to null**: Changes semantics, could cause issues

**Chosen approach** (recursive cleaning) is:
- ✅ Comprehensive
- ✅ Maintainable
- ✅ Future-proof
- ✅ Transparent (doesn't change business logic)

## Prevention

To avoid similar issues in the future:

1. **Use optional chaining safely**:
   ```typescript
   // BAD - can result in undefined
   approver2: someCondition ? approverId : undefined
   
   // GOOD - omit entirely
   ...(someCondition && { approver2: approverId })
   ```

2. **Default to null for Firestore**:
   ```typescript
   // If you need to explicitly clear a field
   approver2: null  // Firestore accepts null
   ```

3. **Validate payloads before sending**:
   - The recursive `cleanUndefined` function now handles this automatically
   - No manual validation needed

## Impact

**Files Modified:**
- `src/services/pr.ts` (lines 280-300)

**Breaking Changes:** None

**Affected Operations:**
- All PR updates via `updatePR` function
- Quote additions, approver assignments, status changes, etc.

**Benefits:**
- ✅ Prevents Firestore errors from `undefined` values
- ✅ More robust data handling
- ✅ Cleaner Firestore documents (no unnecessary fields)
- ✅ Better error prevention than manual checking


