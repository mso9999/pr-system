# PO Line Items vs Final Price Validation - November 7, 2025

## Overview
Implemented validation to cross-check the **sum of line items** against the **final price** entered from the proforma invoice. If there's a discrepancy, the system requires a justification before allowing PO generation.

## Important: Two Separate Validations

This validation is **distinct** from the existing Final Price vs Approved Amount variance check (Rules 6 & 7):

### This Validation (Line Items → Final Price)
- **Purpose**: Ensure itemized breakdown matches proforma total
- **Compares**: Sum of line items (with tax/duty) vs Final Price
- **When**: Before PO generation
- **Field**: `poLineItemDiscrepancyJustification`

### Separate Validation (Final Price → Approved Amount)  
- **Purpose**: Detect significant price increases/decreases from approval
- **Compares**: Final Price vs Last Approved Amount
- **When**: Before moving to ORDERED status
- **Field**: `finalPriceVarianceOverrideJustification`
- **Location**: `ApprovedStatusActions.tsx` (Rules 6 & 7)

## Business Logic

### Price Calculation
1. **Line Items Total**: Sum of all `lineItemsWithSKU` `totalAmount` fields + tax + duty
2. **Final Price**: The actual price from the proforma invoice (stored in `pr.finalPrice`)
3. **Discrepancy**: Difference between Final Price and Line Items Total

### Validation Rules
- **Threshold**: 0.01% (to account for minor rounding differences)
- **Trigger Conditions** (justification required if):
  1. Final price exists BUT no line items have pricing (can't validate breakdown)
  2. Both exist AND prices don't match within threshold (`|discrepancy percentage| > 0.01%`)
- **Enforcement**: PO cannot be generated without justification when either condition is met
- **Note**: Validation triggers whenever a final price is entered, regardless of line item status

## Implementation Details

### 1. Price Discrepancy Detection
**File**: `src/components/pr/POReviewDialog.tsx`

```typescript
// Calculate line item totals (only lineItemsWithSKU has pricing information)
const lineItems = pr.lineItemsWithSKU?.length > 0 ? pr.lineItemsWithSKU : pr.lineItems || [];
const subtotal = lineItems.reduce((sum, item) => sum + (item.totalAmount || 0), 0);
const taxAmount = pr.taxPercentage ? (subtotal * pr.taxPercentage / 100) : 0;
const dutyAmount = pr.dutyPercentage ? (subtotal * pr.dutyPercentage / 100) : 0;
const lineItemGrandTotal = subtotal + taxAmount + dutyAmount;

// Check for discrepancy between LINE ITEMS and FINAL PRICE
const finalPrice = pr.finalPrice || 0;
const lineItemsHavePricing = lineItemGrandTotal > 0;
const discrepancyAmount = finalPrice - lineItemGrandTotal;
const discrepancyPercentage = lineItemGrandTotal > 0 ? (discrepancyAmount / lineItemGrandTotal) * 100 : 0;
const DISCREPANCY_THRESHOLD = 0.01; // 0.01%

// Discrepancy exists if:
// 1. Final price entered but no line item pricing (can't validate breakdown)
// 2. Both exist but don't match within threshold
const hasDiscrepancy = finalPrice > 0 && (
  !lineItemsHavePricing || // Final price exists but no line items to validate against
  Math.abs(discrepancyPercentage) > DISCREPANCY_THRESHOLD // Prices don't match
);
```

### 2. UI Warning Component
When a discrepancy is detected, an Alert is displayed showing:
- Line Items Total (sum of itemized pricing with tax/duty)
- Final Price (from proforma invoice)
- Discrepancy Amount and Percentage
- Required justification text field

The justification field:
- Is required when there's a discrepancy
- Shows error state if empty
- Provides placeholder examples (shipping costs, handling fees, additional services not itemized, volume discounts, rounding differences, etc.)

### 3. Validation on Generate
**File**: `src/components/pr/POReviewDialog.tsx`

```typescript
const handleGenerate = async () => {
  // Validate price discrepancy justification if needed
  if (hasDiscrepancy && !priceDiscrepancyJustification.trim()) {
    alert('Please provide a justification for the price discrepancy...');
    return;
  }
  
  // Store justification in PR
  const updatedPR: Partial<PRRequest> = {
    // ... other fields
    poLineItemDiscrepancyJustification: hasDiscrepancy ? priceDiscrepancyJustification : undefined,
  };
  
  await onGenerate(updatedPR);
};
```

### 4. Type Definitions
**File**: `src/types/pr.ts`

Added new field to `PRRequest` interface:
```typescript
/** Justification for price discrepancy between line items and final price */
poLineItemDiscrepancyJustification?: string;
```

## User Experience

### Without Discrepancy
1. User enters final price in Approved Status
2. User clicks "Generate PO"
3. PO Review Dialog opens with pre-populated data
4. User reviews and clicks "Generate & Download PO"
5. PO is generated successfully

### With Discrepancy
1. PR has line items with SKU totaling LSL 1,500 (with tax/duty)
2. User enters final price of LSL 1,650 in Approved Status
3. User clicks "Generate PO"
4. PO Review Dialog opens with pre-populated data
5. **Warning Alert** appears showing:
   - Line Items Total: LSL 1,500.00
   - Final Price: LSL 1,650.00
   - Discrepancy: LSL 150.00 (+10.00%)
6. **Required Text Field** appears for justification
7. User enters justification (e.g., "Shipping costs of LSL 150 added by vendor, not included in line items")
8. User clicks "Generate & Download PO"
9. Justification is stored in PR document
10. PO is generated successfully

### Validation Error
If user tries to generate without providing justification:
- Alert message: "Please provide a justification for the price discrepancy between the line items total and the final price before generating the PO."
- Generate button remains functional but operation is blocked

## Common Reasons for Discrepancies
- Shipping/freight charges
- Handling fees
- Currency conversion differences
- Discounts applied
- Tax calculation differences
- Additional services (installation, training, etc.)
- Banking/payment processing fees

## Data Storage
The justification is stored in the PR document under `poLineItemDiscrepancyJustification` and persists with the PR for audit and reference purposes.

## Testing Checklist
- [ ] **Scenario 1: Line items with pricing that match**
  - Create PR with lineItemsWithSKU totaling LSL 1,000 (with tax/duty)
  - Enter final price of LSL 1,000
  - Should generate without warning (matches line items)
  
- [ ] **Scenario 2: Line items with pricing that don't match**
  - Create PR with lineItemsWithSKU totaling LSL 1,000
  - Enter final price of LSL 1,100
  - Should show discrepancy warning with LSL 100 difference (+10%)
  - Try to generate without justification - should be blocked
  - Enter justification and generate - should succeed
  
- [ ] **Scenario 3: Final price but NO line item pricing (CRITICAL)**
  - Create PR with line items but no pricing (lineItemsWithSKU empty or totaling 0)
  - Enter final price of LSL 2,000
  - Should show discrepancy warning: "No pricing" vs LSL 2,000
  - Should require justification explaining why PO has no itemized breakdown
  - Should be blocked without justification
  
- [ ] **Scenario 4: Edge cases**
  - Test with negative discrepancy (final price lower than line items)
  - Test with very small discrepancy (< 0.01%) - should not trigger warning
  - Test with no final price entered - should skip validation gracefully
  
- [ ] **Verification**
  - Verify justification is saved under `poLineItemDiscrepancyJustification`
  - Check console logging shows correct validation reason
  - Confirm this validation is independent from Final Price vs Approved Amount variance check

## Future Enhancements
1. Make threshold configurable per organization
2. Add ability to view historical justifications
3. Generate discrepancy report for audit purposes
4. Add role-based approval for large discrepancies
5. Track who provided the justification and when

