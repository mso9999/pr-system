# Organizational Rules - Single Source of Truth

**Date:** November 4, 2025  
**Status:** ✅ IMPLEMENTED

## Problem

Previously, organizational rules were stored in **two separate locations**, creating data duplication and inconsistency risk:

1. **`referenceData_rules` collection** (Reference Data Management UI)
   - 7 rules per organization
   - Full structure with thresholds, UOM, descriptions

2. **`organizations` collection** (Organization Settings UI)
   - `rule1ThresholdAmount`, `rule2ThresholdAmount`
   - `finalPriceUpwardVarianceThreshold` (Rule 6)
   - `finalPriceDownwardVarianceThreshold` (Rule 7)

❌ **Issue:** Two places to update the same data → out of sync → bugs

---

## Solution: Single Source of Truth

### ✅ **Rules NOW live ONLY in `referenceData_rules` collection**

```
referenceData_rules/
  ├── 1pwr_lesotho_rule_1
  ├── 1pwr_lesotho_rule_2
  ├── 1pwr_lesotho_rule_3
  ├── 1pwr_lesotho_rule_4
  ├── 1pwr_lesotho_rule_5
  ├── 1pwr_lesotho_rule_6
  └── 1pwr_lesotho_rule_7
```

### 📋 **Rule Document Structure**

```typescript
{
  id: "1pwr_lesotho_rule_1",
  organizationId: "1pwr_lesotho",
  organization: "1PWR LESOTHO",
  number: 1,
  name: "Rule 1",
  description: "Finance admin approvers can approve low value PRs",
  threshold: 1500,
  uom: "LSL",
  active: true,
  createdAt: "2025-11-04...",
  updatedAt: "2025-11-04..."
}
```

---

## Architecture

### **New Service: `rulesService.ts`**

Provides unified interface for managing rules:

```typescript
// Get all rules for an organization
getOrganizationRules(organizationId: string): Promise<OrganizationRules>

// Get quick summary of key thresholds
getRuleThresholds(organizationId: string): Promise<{
  rule1Threshold: number;
  rule2Multiplier: number;
  rule3Threshold: number;
  rule6UpwardVariance: number;
  rule7DownwardVariance: number;
}>

// Update specific rule
updateOrganizationRule(
  organizationId: string,
  ruleNumber: number,
  updates: { threshold?, uom?, description?, active? }
)

// Batch update multiple rules
updateOrganizationRules(organizationId: string, updates: {...})
```

---

## UI Integration

### **1. Organization Settings** (`OrganizationConfig.tsx`)

**Before:**
```typescript
// ❌ Stored in organization object
formData.rule1ThresholdAmount
formData.rule2ThresholdAmount
formData.finalPriceUpwardVarianceThreshold
formData.finalPriceDownwardVarianceThreshold
```

**After:**
```typescript
// ✅ Loaded from rulesService
const thresholds = await getRuleThresholds(orgId);
rulesData.rule1Threshold = thresholds.rule1Threshold;
rulesData.rule2Multiplier = thresholds.rule2Multiplier;
rulesData.rule3Threshold = thresholds.rule3Threshold;
rulesData.rule6UpwardVariance = thresholds.rule6UpwardVariance;
rulesData.rule7DownwardVariance = thresholds.rule7DownwardVariance;

// On save: Updates referenceData_rules collection
await updateOrganizationRules(orgId, rulesData);
```

### **2. Reference Data Management** (Already integrated)

- Rules can be edited directly in Reference Data Management → Rules
- Changes sync automatically across the system

---

## Benefits

✅ **Single Source of Truth**: Rules exist in ONE place only  
✅ **Consistency**: No data duplication or sync issues  
✅ **Flexibility**: Can edit rules from either UI (Organization Settings or Reference Data Management)  
✅ **Maintainability**: Easier to understand and debug  
✅ **Scalability**: Easy to add more rules in the future  

---

## Migration Notes

### **Organization Type**

Fields marked as **deprecated** (kept for backwards compatibility):

```typescript
export interface Organization {
  // ...
  
  /**
   * @deprecated Use rulesService.getOrganizationRules() instead
   * SINGLE SOURCE OF TRUTH: referenceData_rules collection
   */
  rule1ThresholdAmount?: number;
  rule2ThresholdAmount?: number;
  finalPriceUpwardVarianceThreshold?: number;
  finalPriceDownwardVarianceThreshold?: number;
}
```

### **No Breaking Changes**

- Old organization fields still exist (won't break existing code)
- They're just not used anymore in the UI
- Future: Can be removed in a major version bump

---

## Usage Examples

### **Get Rules for an Organization**

```typescript
import { getRuleThresholds } from '@/services/rulesService';

const thresholds = await getRuleThresholds('1pwr_lesotho');
console.log(thresholds.rule1Threshold); // 1500
console.log(thresholds.rule3Threshold); // 50000
```

### **Update a Rule**

```typescript
import { updateOrganizationRule } from '@/services/rulesService';

await updateOrganizationRule('1pwr_lesotho', 1, {
  threshold: 2000  // Update Rule 1 threshold to 2000
});
```

### **Batch Update Multiple Rules**

```typescript
import { updateOrganizationRules } from '@/services/rulesService';

await updateOrganizationRules('1pwr_lesotho', {
  rule1Threshold: 2000,
  rule3Threshold: 60000,
  rule6UpwardVariance: 10,
  rule7DownwardVariance: 15
});
```

---

## Testing

### **Test Scenario 1: Update in Organization Settings**

1. Go to **Admin → Organization Settings**
2. Change **Rule 1 Threshold** from 1500 to 2000
3. Click **Save Configuration**
4. Go to **Reference Data Management → Rules**
5. ✅ **Expected:** Rule 1 threshold shows 2000 (synced!)

### **Test Scenario 2: Update in Reference Data Management**

1. Go to **Reference Data Management → Rules**
2. Edit **Rule 3 threshold** from 50000 to 60000
3. Save
4. Go to **Admin → Organization Settings**
5. ✅ **Expected:** Rule 3 shows 60000 (synced!)

---

## Future Enhancements

### **Phase 1 (Current)**
- ✅ Single source of truth implemented
- ✅ Organization Settings reads/writes to rules collection
- ✅ Reference Data Management already integrated

### **Phase 2 (Planned)**
- [ ] Remove deprecated organization fields (major version bump)
- [ ] Add rule validation logic
- [ ] Add rule change history/audit trail
- [ ] Add rule templates for common setups

---

## Conclusion

The rules architecture now follows the **Single Source of Truth** principle. Both Organization Settings and Reference Data Management are simply different **views/interfaces** to the same underlying `referenceData_rules` collection.

**Key Takeaway:** 
> 📋 **Rules live in `referenceData_rules` collection**  
> 🔄 **Both UIs read/write to the same place**  
> ✅ **No more data duplication!**




