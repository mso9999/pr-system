# Approved Status UI Guide

## What You Should See in APPROVED Status

### 1. Page Title
✅ **Shows:** "**PO Details:** 251028-0008-1PL-LS"  
(Not "PR Details" - it changes to "PO" in APPROVED status)

---

### 2. Proforma Invoice Section

**BEFORE Upload/Override:**
- Upload button
- "OR" divider  
- Justification text field
- "Set Override" button

**AFTER Upload:**
```
✓ Uploaded: proforma_invoice.pdf
By: Phoka Raphoka
[View Document] button
```

**AFTER Override:**
```
⚠ Override Set
Justification: reasons
```

---

### 3. Proof of Payment Section

**BEFORE Upload/Override:**
- Upload button
- "OR" divider
- Justification text field
- "Set Override" button

**AFTER Upload:**
```
✓ Uploaded: proof_of_payment.pdf
By: Phoka Raphoka
[View Document] button
```

**AFTER Override:**
```
⚠ Override Set
Justification: reasons
```

---

### 4. Estimated Delivery Date (ETD) Section

**BEFORE Save:**
- Date picker field
- [Save ETD] button

**AFTER Save:**
```
✓ ETD Set: Thu, Nov 7, 2025
━━━━━━━━━━━━━━━━━━━━━━━━━━
[Date picker] - "Update to a new date if needed"
[Update ETD] button (disabled if no changes)
```

---

### 5. Final Price from Proforma Invoice Section

**BEFORE Save:**
- Number input: "Final Price Amount"
- Multi-line text: "Variance Notes (if applicable)"
- [Save Final Price] button

**AFTER Save:**
```
[Input fields as above]

ℹ Current Final Price: LSL 575,755.00
   Notes: Price adjusted due to currency fluctuation
```

---

### 6. Inter-team Notifications Section

**For Procurement:**
- [Notify Finance for Payment] button

**For Finance/Admin:**
- [Notify Procurement for Uploads] button

---

### 7. Move to ORDERED Button

**At the bottom - full width, large, green:**
```
✓ [Move to ORDERED Status]
```

---

## Visual Indicators

### Success Alerts (Green)
- ETD Set
- Document Uploaded
- Final Price Saved

### Warning Alerts (Yellow/Orange)
- Override Set (with justification)

### Error Alerts (Red)
- Missing required fields
- Validation failures

---

## Expected Flow

1. **Open APPROVED PO**
   - Title shows "PO Details"
   
2. **Set ETD**
   - Select date → Click "Save ETD"
   - ✅ Green alert appears: "ETD Set: [date]"
   - Success notification: "Estimated delivery date saved successfully"
   
3. **Handle Proforma**
   - Upload file OR set override with justification
   - ✅ Green/Yellow alert appears
   - Success notification appears
   
4. **Handle PoP**
   - Upload file OR set override with justification
   - ✅ Green/Yellow alert appears
   - Success notification appears
   
5. **Enter Final Price (Optional)**
   - Enter amount and notes
   - Click "Save Final Price"
   - ✅ Blue info alert appears with saved price
   - Success notification appears
   
6. **Move to ORDERED**
   - Scroll to bottom
   - Click green "Move to ORDERED Status" button
   - Review checklist in dialog:
     ```
     ✓ ETD: 2025-11-07
     ✓ Proforma: Override Set
     ✓ PoP: Override Set
     ```
   - Click "Confirm & Move to ORDERED"
   - Success notification appears
   - Redirected to dashboard

---

## Common Issues

### "I don't see the green success alerts"
- **Solution:** The page should auto-refresh after each save. If not, try pressing F5.

### "The save button is disabled"
- **ETD:** Date must be selected and different from current ETD
- **Final Price:** Amount must be > 0
- **Overrides:** Justification text must be entered

### "I can't find the Move to ORDERED button"
- **Solution:** Scroll down to the very bottom of the PO Document Management section. It's a full-width green button.

### "Move to ORDERED shows validation errors"
- **Check:**
  1. ETD is set (green alert visible)
  2. Proforma uploaded or override set (for amounts > Rule 1)
  3. PoP uploaded or override set (for amounts > Rule 1)
- The confirmation dialog will show ✓ or ❌ for each requirement

---

## Browser Developer Console

**Success messages you should see:**
```
pr.ts:331 Successfully updated PR kqC0SifTPKPX4xcCtXpL
```

**After saves:**
```
pr.ts:178 Successfully fetched PR with ID: kqC0SifTPKPX4xcCtXpL
```

**If you see errors:**
- Red text in console
- Copy the error message
- Report to system administrator

---

## Support

If issues persist:
1. Clear browser cache (Ctrl+Shift+Delete)
2. Log out and log back in
3. Try a different browser
4. Check with system administrator





