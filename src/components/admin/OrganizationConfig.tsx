import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  CircularProgress,
  Divider,
  FormHelperText,
  SelectChangeEvent
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { useSelector } from 'react-redux';
import { RootState } from '@/store';
import { organizationService } from '@/services/organizationService';
import { Organization } from '@/types/organization';

const CURRENCY_OPTIONS = ['LSL', 'USD', 'ZAR', 'EUR', 'GBP'];

export const OrganizationConfig: React.FC = () => {
  const { enqueueSnackbar } = useSnackbar();
  const currentUser = useSelector((state: RootState) => state.auth.user);
  
  // Only Superadmin (Level 1) can access Organization Settings
  const isSuperadmin = currentUser?.permissionLevel === 1;
  
  if (!isSuperadmin) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          <Typography variant="h6">Access Denied</Typography>
          <Typography>
            Only Superadmin users can access Organization Settings. Your current permission level does not allow you to view or modify these settings.
          </Typography>
        </Alert>
      </Box>
    );
  }
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  
  // Form state
  const [formData, setFormData] = useState<Partial<Organization>>({
    name: '',
    code: '',
    active: true,
    procurementEmail: '',
    assetManagementEmail: '',
    adminEmail: '',
    baseCurrency: 'LSL',
    allowedCurrencies: ['LSL', 'USD', 'ZAR'],
    rule1ThresholdAmount: 0,
    rule2ThresholdAmount: 0,
    vendorApproval3QuoteDuration: 12,
    vendorApprovalCompletedDuration: 6,
    vendorApprovalManualDuration: 12,
    highValueVendorMultiplier: 10,
    highValueVendorMaxDuration: 24
  });

  // Load organizations on mount
  useEffect(() => {
    loadOrganizations();
  }, []);

  // Load selected organization data
  useEffect(() => {
    if (selectedOrgId) {
      loadOrganizationData(selectedOrgId);
    }
  }, [selectedOrgId]);

  const loadOrganizations = async () => {
    try {
      setLoading(true);
      const orgs = await organizationService.getOrganizations();
      setOrganizations(orgs);
      
      // Select first org if available
      if (orgs.length > 0 && !selectedOrgId) {
        setSelectedOrgId(orgs[0].id);
      }
    } catch (error: any) {
      console.error('Error loading organizations:', error);
      enqueueSnackbar('Failed to load organizations', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const loadOrganizationData = async (orgId: string) => {
    try {
      setLoading(true);
      const org = await organizationService.getOrganizationById(orgId);
      if (org) {
        setSelectedOrg(org);
        setFormData({
          name: org.name || '',
          code: org.code || '',
          active: org.active ?? true,
          procurementEmail: org.procurementEmail || '',
          assetManagementEmail: org.assetManagementEmail || '',
          adminEmail: org.adminEmail || '',
          baseCurrency: org.baseCurrency || 'LSL',
          allowedCurrencies: org.allowedCurrencies || ['LSL', 'USD', 'ZAR'],
          rule1ThresholdAmount: org.rule1ThresholdAmount || 0,
          rule2ThresholdAmount: org.rule2ThresholdAmount || 0,
          vendorApproval3QuoteDuration: org.vendorApproval3QuoteDuration || 12,
          vendorApprovalCompletedDuration: org.vendorApprovalCompletedDuration || 6,
          vendorApprovalManualDuration: org.vendorApprovalManualDuration || 12,
          highValueVendorMultiplier: org.highValueVendorMultiplier || 10,
          highValueVendorMaxDuration: org.highValueVendorMaxDuration || 24,
          timeZone: org.timeZone || ''
        });
      }
    } catch (error: any) {
      console.error('Error loading organization data:', error);
      enqueueSnackbar('Failed to load organization data', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (field: keyof Organization, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setErrors([]); // Clear errors when user makes changes
  };

  const handleCurrencyChange = (event: SelectChangeEvent<string[]>) => {
    const value = event.target.value;
    handleFieldChange('allowedCurrencies', typeof value === 'string' ? value.split(',') : value);
  };

  const handleSave = async () => {
    if (!selectedOrgId) {
      enqueueSnackbar('No organization selected', { variant: 'error' });
      return;
    }

    // Validate
    const validation = organizationService.validateOrganizationConfig(formData);
    if (!validation.valid) {
      setErrors(validation.errors);
      enqueueSnackbar('Please fix validation errors', { variant: 'error' });
      return;
    }

    try {
      setSaving(true);
      await organizationService.updateOrganization(selectedOrgId, formData);
      enqueueSnackbar('Organization configuration saved successfully', { variant: 'success' });
      await loadOrganizationData(selectedOrgId);
    } catch (error: any) {
      console.error('Error saving organization:', error);
      enqueueSnackbar('Failed to save organization configuration', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (selectedOrg) {
      setFormData({
        name: selectedOrg.name || '',
        code: selectedOrg.code || '',
        active: selectedOrg.active ?? true,
        procurementEmail: selectedOrg.procurementEmail || '',
        assetManagementEmail: selectedOrg.assetManagementEmail || '',
        adminEmail: selectedOrg.adminEmail || '',
        baseCurrency: selectedOrg.baseCurrency || 'LSL',
        allowedCurrencies: selectedOrg.allowedCurrencies || ['LSL', 'USD', 'ZAR'],
        rule1ThresholdAmount: selectedOrg.rule1ThresholdAmount || 0,
        rule2ThresholdAmount: selectedOrg.rule2ThresholdAmount || 0,
        vendorApproval3QuoteDuration: selectedOrg.vendorApproval3QuoteDuration || 12,
        vendorApprovalCompletedDuration: selectedOrg.vendorApprovalCompletedDuration || 6,
        vendorApprovalManualDuration: selectedOrg.vendorApprovalManualDuration || 12,
        highValueVendorMultiplier: selectedOrg.highValueVendorMultiplier || 10,
        highValueVendorMaxDuration: selectedOrg.highValueVendorMaxDuration || 24,
        timeZone: selectedOrg.timeZone || ''
      });
      setErrors([]);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Organization Configuration
      </Typography>
      <Typography variant="body2" color="textSecondary" paragraph>
        Configure organization settings, email addresses, and business rules
      </Typography>

      {errors.length > 0 && (
        <Alert severity="error" sx={{ mb: 2 }}>
          <Typography variant="subtitle2">Please fix the following errors:</Typography>
          <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
            {errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </Alert>
      )}

      {/* Organization Selector */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <FormControl fullWidth>
          <InputLabel>Select Organization</InputLabel>
          <Select
            value={selectedOrgId}
            onChange={(e) => setSelectedOrgId(e.target.value)}
            label="Select Organization"
          >
            {organizations.map((org) => (
              <MenuItem key={org.id} value={org.id}>
                {org.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Paper>

      {selectedOrg && (
        <Paper sx={{ p: 3 }}>
          <Grid container spacing={3}>
            {/* Basic Information */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Basic Information
              </Typography>
              <Divider sx={{ mb: 2 }} />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Organization Name"
                value={formData.name}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                helperText="Display name of the organization"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Organization Code"
                value={formData.code}
                onChange={(e) => handleFieldChange('code', e.target.value)}
                helperText="Short code for the organization"
              />
            </Grid>

            {/* Email Configuration */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                Email Configuration
              </Typography>
              <Divider sx={{ mb: 2 }} />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Procurement Email"
                type="email"
                value={formData.procurementEmail}
                onChange={(e) => handleFieldChange('procurementEmail', e.target.value)}
                helperText="Email for procurement team notifications"
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Asset Management Email"
                type="email"
                value={formData.assetManagementEmail}
                onChange={(e) => handleFieldChange('assetManagementEmail', e.target.value)}
                helperText="Email for asset management notifications"
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Admin Email"
                type="email"
                value={formData.adminEmail}
                onChange={(e) => handleFieldChange('adminEmail', e.target.value)}
                helperText="Primary administrative contact email"
              />
            </Grid>

            {/* Currency Configuration */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                Currency Configuration
              </Typography>
              <Divider sx={{ mb: 2 }} />
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Base Currency</InputLabel>
                <Select
                  value={formData.baseCurrency}
                  onChange={(e) => handleFieldChange('baseCurrency', e.target.value)}
                  label="Base Currency"
                >
                  {CURRENCY_OPTIONS.map((currency) => (
                    <MenuItem key={currency} value={currency}>
                      {currency}
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>Default currency for the organization</FormHelperText>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Allowed Currencies</InputLabel>
                <Select
                  multiple
                  value={formData.allowedCurrencies || []}
                  onChange={handleCurrencyChange}
                  label="Allowed Currencies"
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {(selected as string[]).map((value) => (
                        <Chip key={value} label={value} size="small" />
                      ))}
                    </Box>
                  )}
                >
                  {CURRENCY_OPTIONS.map((currency) => (
                    <MenuItem key={currency} value={currency}>
                      {currency}
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>Currencies accepted for transactions</FormHelperText>
              </FormControl>
            </Grid>

            {/* Business Rules */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                Business Rules (Approval Thresholds)
              </Typography>
              <Divider sx={{ mb: 2 }} />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Rule 1 Threshold Amount"
                type="number"
                value={formData.rule1ThresholdAmount}
                onChange={(e) => handleFieldChange('rule1ThresholdAmount', parseFloat(e.target.value))}
                helperText="Lower threshold for approval requirements"
                InputProps={{ inputProps: { min: 0 } }}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Rule 2 Threshold Amount"
                type="number"
                value={formData.rule2ThresholdAmount}
                onChange={(e) => handleFieldChange('rule2ThresholdAmount', parseFloat(e.target.value))}
                helperText="Higher threshold (requires dual approval)"
                InputProps={{ inputProps: { min: 0 } }}
              />
            </Grid>

            {/* Vendor Approval Settings */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                Vendor Approval Duration Settings (months)
              </Typography>
              <Divider sx={{ mb: 2 }} />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="3-Quote Process Duration"
                type="number"
                value={formData.vendorApproval3QuoteDuration}
                onChange={(e) => handleFieldChange('vendorApproval3QuoteDuration', parseInt(e.target.value))}
                helperText="Approval duration after 3-quote process"
                InputProps={{ inputProps: { min: 1 } }}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Completed Order Duration"
                type="number"
                value={formData.vendorApprovalCompletedDuration}
                onChange={(e) => handleFieldChange('vendorApprovalCompletedDuration', parseInt(e.target.value))}
                helperText="Approval duration after satisfactory order"
                InputProps={{ inputProps: { min: 1 } }}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Manual Approval Duration"
                type="number"
                value={formData.vendorApprovalManualDuration}
                onChange={(e) => handleFieldChange('vendorApprovalManualDuration', parseInt(e.target.value))}
                helperText="Duration for manual vendor approval"
                InputProps={{ inputProps: { min: 1 } }}
              />
            </Grid>

            {/* High-Value Vendor Rules */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                High-Value Vendor Rules
              </Typography>
              <Divider sx={{ mb: 2 }} />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="High-Value Vendor Multiplier"
                type="number"
                value={formData.highValueVendorMultiplier}
                onChange={(e) => handleFieldChange('highValueVendorMultiplier', parseInt(e.target.value))}
                helperText="Multiplier of Rule 2 threshold for high-value classification"
                InputProps={{ inputProps: { min: 1 } }}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="High-Value Max Duration (months)"
                type="number"
                value={formData.highValueVendorMaxDuration}
                onChange={(e) => handleFieldChange('highValueVendorMaxDuration', parseInt(e.target.value))}
                helperText="Maximum approval duration for high-value vendors"
                InputProps={{ inputProps: { min: 1 } }}
              />
            </Grid>

            {/* Other Settings */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                Other Settings
              </Typography>
              <Divider sx={{ mb: 2 }} />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Time Zone"
                value={formData.timeZone}
                onChange={(e) => handleFieldChange('timeZone', e.target.value)}
                helperText="Organization time zone (e.g., Africa/Maseru)"
              />
            </Grid>

            {/* Action Buttons */}
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? <CircularProgress size={24} /> : 'Save Configuration'}
                </Button>
                <Button
                  variant="outlined"
                  onClick={handleReset}
                  disabled={saving}
                >
                  Reset
                </Button>
              </Box>
            </Grid>
          </Grid>
        </Paper>
      )}
    </Box>
  );
};

