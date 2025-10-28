/**
 * @fileoverview Basic Information Step Component
 * @version 1.0.0
 * 
 * Description:
 * First step in the PR creation process. Collects basic information
 * about the purchase request including organization, department,
 * project category, and initial approvers.
 */

import React, { useState } from 'react';
import {
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Autocomplete,
  Chip,
  Box,
  Typography,
  SelectChangeEvent,
  CircularProgress,
  Alert,
  Paper,
} from '@mui/material';
import { FormState } from '../NewPRForm';
import { ReferenceDataItem } from '../../../types/referenceData';
import { organizations } from '../../../services/localReferenceData';
import { OrganizationSelector } from '../../common/OrganizationSelector';

interface BasicInformationStepProps {
  formState: FormState;
  setFormState: React.Dispatch<React.SetStateAction<FormState>>;
  departments: ReferenceDataItem[];
  projectCategories: ReferenceDataItem[];
  sites: ReferenceDataItem[];
  expenseTypes: ReferenceDataItem[];
  vehicles: ReferenceDataItem[];
  vendors: ReferenceDataItem[];
  approvers: Array<{
    id: string;
    name: string;
    email: string;
    permissionLevel: string;  // "Level 1" or "Level 2"
    organizationId?: string;
  }>;
  currencies: ReferenceDataItem[];
  rules: any[];
  loading: boolean;
  isSubmitted?: boolean;
  validationErrors?: string[];
}

export const BasicInformationStep: React.FC<BasicInformationStepProps> = ({
  formState,
  setFormState,
  departments,
  projectCategories,
  sites,
  expenseTypes,
  vehicles,
  vendors,
  approvers,
  currencies,
  rules,
  loading,
  isSubmitted = false,
  validationErrors = [],
}) => {
  const [approverAmountError, setApproverAmountError] = useState<string | null>(null);
  const handleChange = (field: keyof FormState) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | SelectChangeEvent<any>
  ) => {
    const value = event.target.value;
    setFormState(prev => {
      // Handle expense type changes
      if (field === 'expenseType') {
        const selectedType = expenseTypes.find(type => type.id === value);
        const previousType = expenseTypes.find(type => type.id === prev.expenseType);
        const isVehicleExpense = selectedType?.code === '4';
        const wasVehicleExpense = previousType?.code === '4';
        
        if (isVehicleExpense) {
          // When switching to vehicle expense type
          return {
            ...prev,
            [field]: value,
            // Don't auto-select vehicle - user must explicitly choose
            vehicle: undefined
          };
        } else if (wasVehicleExpense) {
          // When switching from vehicle expense type, clear vehicle
          return {
            ...prev,
            [field]: value,
            vehicle: undefined
          };
        }
      }
      return { ...prev, [field]: value };
    });
    
    // Trigger validation if amount changes
    if (field === 'estimatedAmount') {
      setTimeout(() => {
        const error = validateApproverAmount();
        setApproverAmountError(error);
        if (error) {
          console.log('Approver amount validation error:', error);
        }
      }, 100);
    }
  };

  const handleApproverChange = (_event: any, value: any) => {
    setFormState(prev => ({
      ...prev,
      approvers: value.map((approver: any) => approver.id)
    }));
    
    // Trigger validation after approver change
    setTimeout(() => {
      const error = validateApproverAmount();
      setApproverAmountError(error);
      if (error) {
        console.log('Approver amount validation error:', error);
      }
    }, 100);
  };

  // Validation function to check if selected approvers can approve the amount
  const validateApproverAmount = (): string | null => {
    console.log('validateApproverAmount called:', {
      estimatedAmount: formState.estimatedAmount,
      approvers: formState.approvers,
      rules: rules,
      rulesLength: rules?.length
    });
    
    if (!formState.estimatedAmount || !formState.approvers || formState.approvers.length === 0 || !rules || rules.length === 0) {
      console.log('Validation skipped - missing data');
      return null;
    }

    const amount = typeof formState.estimatedAmount === 'string' 
      ? parseFloat(formState.estimatedAmount) 
      : formState.estimatedAmount;

    if (isNaN(amount) || amount <= 0) {
      return null;
    }

    // Find rules based on actual rule structure
    // Rule 1: Finance admin approvers can approve low value PRs (threshold for Finance Approvers)
    // Rule 3: High value threshold (requires dual approval above this amount)
    const rule1 = rules.find((rule: any) => 
      rule.number === 1 || rule.number === '1' || 
      rule.description?.toLowerCase().includes('finance admin approvers can approve low value')
    );
    const rule3 = rules.find((rule: any) => 
      rule.number === 3 || rule.number === '3' || 
      rule.description?.toLowerCase().includes('high value threshold') ||
      rule.description?.toLowerCase().includes('3 quotes and adjudication')
    );
    
    console.log('Rules found:', { rule1, rule3, allRules: rules });
    
    // If no rules are found, skip validation
    if (!rule1 && !rule3) {
      console.log('No rules found - skipping validation');
      return null;
    }
    
    const effectiveRule1 = rule1;
    const effectiveRule3 = rule3;
    
    console.log('Effective rules:', { effectiveRule1, effectiveRule3, amount });

    // Check if amount is above Rule 1 threshold (Finance Approver limit)
    const isAboveRule1Threshold = effectiveRule1 ? amount > effectiveRule1.threshold : false;
    // Rule 3 is the high-value threshold for dual approval
    const isAboveRule3Threshold = effectiveRule3 ? amount > effectiveRule3.threshold : false;

    // Check if any selected approver cannot approve this amount
    const invalidApprovers = formState.approvers.filter(approverId => {
      const approver = approvers.find(a => a.id === approverId);
      if (!approver) return false;

      const permissionLevel = parseInt(approver.permissionLevel);
      
      // Level 1 and 2 can approve any amount
      if (permissionLevel === 1 || permissionLevel === 2) {
        return false;
      }
      
      // Level 6 (Finance Approvers) and Level 4 (Finance Admin) can only approve within Rule 1 threshold
      if (permissionLevel === 6 || permissionLevel === 4) {
        if (isAboveRule1Threshold) {
          return true; // Cannot approve above rule 1 threshold
        }
        return false; // Can approve within Rule 1 threshold
      }
      
      // Levels 3 and 5 should not be approvers at all
      if (permissionLevel === 3 || permissionLevel === 5) {
        return true; // Invalid approver
      }
      
      return false;
    });

    if (invalidApprovers.length > 0) {
      const invalidApproverNames = invalidApprovers.map(approverId => {
        const approver = approvers.find(a => a.id === approverId);
        return approver ? approver.name : 'Unknown';
      });

      if (isAboveRule1Threshold && effectiveRule1) {
        console.log('Rule 1 error:', { effectiveRule1, amount, isAboveRule1Threshold });
        return `Selected approver(s) (${invalidApproverNames.join(', ')}) cannot approve amounts above ${effectiveRule1.threshold} ${effectiveRule1.currency}. Only Level 1 or 2 approvers can approve this amount.`;
      }
      
      // Generic error for invalid approvers (Level 3, 5)
      return `Selected user(s) (${invalidApproverNames.join(', ')}) cannot be assigned as approvers. Only Level 1, 2, 4, or 6 users can approve PRs.`;
    }

    return null;
  };

  // Auto-validate whenever approver or amount changes
  React.useEffect(() => {
    // Only validate when rules are loaded and we have approvers or amount
    if (rules.length > 0 && (formState.approvers.length > 0 || formState.estimatedAmount)) {
      const error = validateApproverAmount();
      setApproverAmountError(error);
      
      if (error) {
        console.log('Approver-amount validation error detected:', error);
      }
    }
  }, [formState.approvers, formState.estimatedAmount, rules.length]);

  // Show vehicle field only for vehicle expense type
  const showVehicleField = expenseTypes.find(type => type.id === formState.expenseType)?.code === '4';

  // Filter vehicles by organization
  const filteredVehicles = vehicles.filter(vehicle => 
    vehicle.active && vehicle.organizationId === formState.organization?.id
  );

  // Validate that vehicle is selected if expense type is vehicle
  React.useEffect(() => {
    if (showVehicleField && !formState.vehicle && filteredVehicles.length > 0) {
      setFormState(prev => ({
        ...prev,
        vehicle: undefined
      }));
    }
  }, [showVehicleField, filteredVehicles]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress data-testid="loading-indicator" />
      </Box>
    );
  }

  return (
    <Grid container spacing={3}>
      {/* Validation Summary */}
      {validationErrors.length > 0 && (
        <Grid item xs={12}>
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="subtitle1" fontWeight="bold">
              Please correct the following issues:
            </Typography>
            <ul style={{ margin: '8px 0', paddingLeft: '24px' }}>
              {validationErrors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </Alert>
        </Grid>
      )}

      {/* Organization */}
      <Grid item xs={12}>
        <OrganizationSelector
          value={formState.organization}
          onChange={(org) => {
            setFormState(prev => ({
              ...prev,
              organization: org
            }));
          }}
          error={isSubmitted && !formState.organization}
          helperText={isSubmitted && !formState.organization ? "Organization is required" : ""}
        />
      </Grid>

      {/* Requestor */}
      <Grid item xs={12} md={6}>
        <TextField
          fullWidth
          id="requestor-input"
          label="Requestor"
          value={formState.requestor}
          onChange={handleChange('requestor')}
          required
          error={isSubmitted && formState.requestor === ''}
          helperText={isSubmitted && formState.requestor === '' ? 'Requestor is required' : ''}
          disabled={loading}
        />
      </Grid>

      {/* Email */}
      <Grid item xs={12} md={6}>
        <TextField
          fullWidth
          id="email-input"
          label="Email"
          type="email"
          value={formState.email}
          onChange={handleChange('email')}
          required
          error={isSubmitted && formState.email === ''}
          helperText={isSubmitted && formState.email === '' ? 'Email is required' : ''}
          disabled={loading}
        />
      </Grid>

      {/* Department */}
      <Grid item xs={12} md={6}>
        <FormControl fullWidth required error={isSubmitted && !formState.department}>
          <InputLabel id="department-label">Department</InputLabel>
          <Select
            labelId="department-label"
            id="department-select"
            value={formState.department || ''}
            onChange={handleChange('department')}
            label="Department"
            disabled={loading}
          >
            <MenuItem value="">
              <em>Select a department</em>
            </MenuItem>
            {departments.map(dept => (
              <MenuItem key={dept.id} value={dept.id}>
                {dept.name}
              </MenuItem>
            ))}
          </Select>
          <FormHelperText>{isSubmitted && !formState.department ? 'Department is required' : 'Please select your department'}</FormHelperText>
        </FormControl>
      </Grid>

      {/* Project Category */}
      <Grid item xs={12} md={6}>
        <FormControl fullWidth required error={isSubmitted && !formState.projectCategory}>
          <InputLabel id="project-category-label">Project Category</InputLabel>
          <Select
            labelId="project-category-label"
            id="project-category-select"
            value={formState.projectCategory || ''}
            onChange={handleChange('projectCategory')}
            label="Project Category"
            disabled={loading}
          >
            <MenuItem value="">
              <em>Select a project category</em>
            </MenuItem>
            {projectCategories.map(cat => (
              <MenuItem key={cat.id} value={cat.id}>
                {cat.name}
              </MenuItem>
            ))}
          </Select>
          <FormHelperText>{isSubmitted && !formState.projectCategory ? 'Project category is required' : 'Please select a project category'}</FormHelperText>
        </FormControl>
      </Grid>

      {/* Description */}
      <Grid item xs={12}>
        <TextField
          fullWidth
          id="description-input"
          label="Description"
          multiline
          rows={3}
          value={formState.description}
          onChange={handleChange('description')}
          required
          error={isSubmitted && !formState.description}
          helperText={
            isSubmitted && !formState.description 
              ? 'Description is required' 
              : 'Provide a detailed description of the purchase request'
          }
          disabled={loading}
        />
      </Grid>

      {/* Site */}
      <Grid item xs={12} md={6}>
        <FormControl fullWidth required error={isSubmitted && !formState.site}>
          <InputLabel id="site-label">Site</InputLabel>
          <Select
            labelId="site-label"
            id="site-select"
            value={formState.site || ''}
            onChange={handleChange('site')}
            label="Site"
            disabled={loading}
          >
            <MenuItem value="">
              <em>Select a site</em>
            </MenuItem>
            {sites.map(site => (
              <MenuItem key={site.id} value={site.id}>
                {site.name}
              </MenuItem>
            ))}
          </Select>
          <FormHelperText>{isSubmitted && !formState.site ? 'Site is required' : 'Please select a site'}</FormHelperText>
        </FormControl>
      </Grid>

      {/* Expense Type */}
      <Grid item xs={12} md={6}>
        <FormControl fullWidth required error={isSubmitted && !formState.expenseType}>
          <InputLabel id="expense-type-label">Expense Type</InputLabel>
          <Select
            labelId="expense-type-label"
            id="expense-type-select"
            value={formState.expenseType || ''}
            onChange={handleChange('expenseType')}
            label="Expense Type"
            disabled={loading}
          >
            <MenuItem value="">
              <em>Select an expense type</em>
            </MenuItem>
            {expenseTypes.map(type => (
              <MenuItem key={type.id} value={type.id}>
                {type.name}
              </MenuItem>
            ))}
          </Select>
          <FormHelperText>{isSubmitted && !formState.expenseType ? 'Expense type is required' : 'Please select an expense type'}</FormHelperText>
        </FormControl>
      </Grid>

      {/* Vehicle Selection - Only shown for vehicle-related expenses */}
      {showVehicleField && (
        <Grid item xs={12} md={6}>
          <FormControl 
            fullWidth 
            required
            error={isSubmitted && showVehicleField && !formState.vehicle}
          >
            <InputLabel id="vehicle-label">Vehicle</InputLabel>
            <Select
              labelId="vehicle-label"
              id="vehicle-select"
              value={formState.vehicle || ''}
              onChange={handleChange('vehicle')}
              label="Vehicle"
              disabled={loading}
            >
              <MenuItem value="">
                <em>Select a vehicle</em>
              </MenuItem>
              {filteredVehicles.map(v => (
                <MenuItem key={v.id} value={v.id}>
                  {v.code || v.registrationNumber || v.name || `Vehicle ${v.id}`}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>
              {isSubmitted && showVehicleField && !formState.vehicle 
                ? 'Vehicle is required for vehicle expense' 
                : 'Please select a vehicle'}
            </FormHelperText>
          </FormControl>
        </Grid>
      )}

      {/* Amount */}
      <Grid item xs={12} md={6}>
        <TextField
          fullWidth
          id="amount-input"
          label="Estimated Amount"
          type="number"
          inputProps={{ step: '0.01', min: '0' }}
          value={formState.estimatedAmount || ''}
          onChange={handleChange('estimatedAmount')}
          required
          error={isSubmitted && (!formState.estimatedAmount || formState.estimatedAmount <= 0) || !!approverAmountError}
          helperText={
            approverAmountError
              ? approverAmountError
              : isSubmitted && (!formState.estimatedAmount || formState.estimatedAmount <= 0)
                ? 'Amount must be greater than 0'
                : 'Estimated total amount'
          }
          disabled={loading}
        />
      </Grid>

      {/* Required Date */}
      <Grid item xs={12} md={6}>
        <TextField
          fullWidth
          id="date-input"
          label="Required Date"
          type="date"
          value={formState.requiredDate || ''}
          onChange={handleChange('requiredDate')}
          InputLabelProps={{
            shrink: true,
          }}
          required
          error={isSubmitted && !formState.requiredDate}
          helperText={
            isSubmitted && !formState.requiredDate
              ? 'Required date is required'
              : 'When do you need this by?'
          }
          disabled={loading}
        />
      </Grid>

      {/* Preferred Vendor */}
      <Grid item xs={12} md={6}>
        <FormControl fullWidth>
          <InputLabel id="vendor-label">Preferred Vendor</InputLabel>
          <Select
            labelId="vendor-label"
            id="vendor-select"
            value={formState.preferredVendor || ''}
            onChange={handleChange('preferredVendor')}
            label="Preferred Vendor"
            disabled={loading}
          >
            <MenuItem value="">
              <em>None</em>
            </MenuItem>
            {vendors
              .filter(vendor => vendor.active)
              .map(vendor => (
                <MenuItem key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </MenuItem>
              ))}
            <MenuItem value="other">Other - I will write in</MenuItem>
          </Select>
          <FormHelperText>Optional - Select if you have a preferred vendor</FormHelperText>
        </FormControl>
      </Grid>

      {/* Custom Vendor Name - Only shown when "Other" is selected */}
      {formState.preferredVendor === 'other' && (
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            id="custom-vendor-input"
            label="Custom Vendor Name"
            value={formState.customVendorName || ''}
            onChange={handleChange('customVendorName')}
            required
            error={!formState.customVendorName}
            helperText={!formState.customVendorName ? 'Please enter the vendor name' : ''}
            disabled={loading}
          />
        </Grid>
      )}

      {/* Currency */}
      <Grid item xs={12} md={6}>
        <FormControl fullWidth required error={isSubmitted && !formState.currency}>
          <InputLabel id="currency-label">Currency</InputLabel>
          <Select
            labelId="currency-label"
            id="currency-select"
            value={formState.currency || ''}
            onChange={handleChange('currency')}
            label="Currency"
            disabled={loading}
          >
            {currencies
              .filter(currency => currency.active)
              .map(currency => (
                <MenuItem key={currency.id} value={currency.code}>
                  {currency.code} - {currency.name}
                </MenuItem>
            ))}
          </Select>
          <FormHelperText>{isSubmitted && !formState.currency ? 'Currency is required' : 'Please select a currency'}</FormHelperText>
        </FormControl>
      </Grid>

      {/* Urgency Level */}
      <Grid item xs={12} md={6}>
        <FormControl fullWidth required error={isSubmitted && formState.isUrgent === undefined}>
          <InputLabel id="urgency-label">Urgency Level</InputLabel>
          <Select
            labelId="urgency-label"
            id="urgency-select"
            value={formState.isUrgent ? 'true' : 'false'}
            onChange={(e) => {
              const isUrgent = e.target.value === 'true';
              setFormState(prev => ({ ...prev, isUrgent }));
            }}
            label="Urgency"
            disabled={loading}
          >
            <MenuItem value="false">Normal</MenuItem>
            <MenuItem value="true">Urgent</MenuItem>
          </Select>
          <FormHelperText>{isSubmitted && formState.isUrgent === undefined ? 'Urgency level is required' : 'Select \'Urgent\' only if this request requires immediate attention'}</FormHelperText>
        </FormControl>
      </Grid>

      {/* Approvers */}
      <Grid item xs={12}>
        <Autocomplete
          multiple
          id="approvers-select"
          options={approvers}
          getOptionLabel={(option) => {
            const level = parseInt(option.permissionLevel);
            if (level === 1) return `${option.name} (Global Approver)`;
            if (level === 2) return `${option.name} (Senior Approver)`;
            if (level === 6) return `${option.name} (Finance Approver)`;
            return `${option.name} (Level ${level} Approver)`;
          }}
          value={approvers.filter(a => (formState.approvers || []).includes(a.id))}
          onChange={handleApproverChange}
          disabled={loading}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Approvers"
              required
              error={isSubmitted && (formState.approvers || []).length === 0 || !!approverAmountError}
              helperText={
                approverAmountError 
                  ? approverAmountError
                  : isSubmitted && (formState.approvers || []).length === 0 
                    ? 'Please select at least one approver' 
                    : 'Select at least one approver'
              }
            />
          )}
          renderTags={(tagValue, getTagProps) =>
            tagValue.map((option, index) => {
              const { key, ...otherProps } = getTagProps({ index });
              return (
                <Chip
                  key={key}
                  label={(() => {
                    const level = parseInt(option.permissionLevel);
                    if (level === 1) return `${option.name} (Global)`;
                    if (level === 2) return `${option.name} (Senior)`;
                    if (level === 6) return `${option.name} (Finance)`;
                    return `${option.name} (Level ${level})`;
                  })()}
                  {...otherProps}
                />
              );
            })
          }
        />
      </Grid>
    </Grid>
  );
};

export default BasicInformationStep;
