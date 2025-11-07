# PO Line Item vs Final Price Validation - November 7, 2025

## Overview
Implemented validation to cross-check the sum of line item prices against the final price entered from the proforma invoice. If there's a discrepancy, the system requires a justification before allowing PO generation.

## Business Logic

### Price Calculation
1. **Line Item Total**: Sum of all line items' `totalAmount` + tax + duty
2. **Final Price**: The price entered from the proforma invoice (stored in `pr.finalPrice`)
3. **Discrepancy**: Difference between Final Price and Line Item Total

### Validation Rules
- **Threshold**: 0.01% (to account for minor rounding differences)
- **Trigger**: If `|discrepancy percentage| > 0.01%`, justification is required
- **Enforcement**: PO cannot be generated without justification when discrepancy exists

## Implementation Details

### 1. Price Discrepancy Detection
**File**: `src/components/pr/POReviewDialog.tsx`

```typescript
// Calculate totals
const subtotal = lineItems.reduce((sum, item) => sum + (item.totalAmount || 0), 0);
const taxAmount = pr.taxPercentage ? (subtotal * pr.taxPercentage / 100) : 0;
const dutyAmount = pr.dutyPercentage ? (subtotal * pr.dutyPercentage / 100) : 0;
const grandTotal = subtotal + taxAmount + dutyAmount;

// Check for discrepancy
const finalPrice = pr.finalPrice || 0;
const lineItemTotal = grandTotal;
const discrepancyAmount = finalPrice - lineItemTotal;
const discrepancyPercentage = lineItemTotal > 0 ? (discrepancyAmount / lineItemTotal) * 100 : 0;
const DISCREPANCY_THRESHOLD = 0.01; // 0.01%
const hasDiscrepancy = Math.abs(discrepancyPercentage) > DISCREPANCY_THRESHOLD;
```

### 2. UI Warning Component
When a discrepancy is detected, an Alert is displayed showing:
- Line Item Total (with tax/duty)
- Final Price (from proforma)
- Discrepancy Amount and Percentage
- Required justification text field

The justification field:
- Is required when there's a discrepancy
- Shows error state if empty
- Provides placeholder examples (shipping costs, fees, discounts, etc.)

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
1. User enters final price in Approved Status (differs from line items)
2. User clicks "Generate PO"
3. PO Review Dialog opens with pre-populated data
4. **Warning Alert** appears showing:
   - Line Item Total: LSL 1,500.00
   - Final Price: LSL 1,650.00
   - Discrepancy: LSL 150.00 (+10.00%)
5. **Required Text Field** appears for justification
6. User enters justification (e.g., "Shipping costs of LSL 150 added by vendor")
7. User clicks "Generate & Download PO"
8. Justification is stored in PR document
9. PO is generated successfully

### Validation Error
If user tries to generate without providing justification:
- Alert message: "Please provide a justification for the price discrepancy between line items and final price before generating the PO."
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
- [ ] Create PR with line items totaling LSL 1,000
- [ ] Enter final price of LSL 1,000 - should generate without warning
- [ ] Enter final price of LSL 1,100 - should show discrepancy warning
- [ ] Try to generate without justification - should be blocked
- [ ] Enter justification and generate - should succeed
- [ ] Verify justification is saved in PR document
- [ ] Check that discrepancy warning shows correct amounts and percentage
- [ ] Test with negative discrepancy (final price lower than line items)
- [ ] Test with very small discrepancy (< 0.01%) - should not trigger warning
- [ ] Test with no line items - should handle gracefully
- [ ] Test with no final price - should handle gracefully

## Future Enhancements
1. Make threshold configurable per organization
2. Add ability to view historical justifications
3. Generate discrepancy report for audit purposes
4. Add role-based approval for large discrepancies
5. Track who provided the justification and when

