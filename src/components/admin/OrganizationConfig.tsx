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
  SelectChangeEvent,
  Checkbox,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormGroup
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useSnackbar } from 'notistack';
import { useSelector } from 'react-redux';
import { RootState } from '@/store';
import { organizationService } from '@/services/organizationService';
import { Organization } from '@/types/organization';
import { referenceDataAdminService } from '@/services/referenceDataAdmin';
import { ReferenceDataItem } from '@/types/referenceData';
import { getOrganizationRules, updateOrganizationRules, getRuleThresholds } from '@/services/rulesService';

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
  const [currencies, setCurrencies] = useState<ReferenceDataItem[]>([]);
  const [loadingCurrencies, setLoadingCurrencies] = useState(true);
  
  // Copy configuration dialog state
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [copyDialogSection, setCopyDialogSection] = useState<'all' | 'email' | 'currency' | 'rules'>('all');
  const [sourceOrgId, setSourceOrgId] = useState<string>('');
  const [copyOptions, setCopyOptions] = useState({
    emailConfig: true,
    currencyConfig: true,
    businessRules: true
  });
  const [copying, setCopying] = useState(false);

  // Helper to open copy dialog for a specific section
  const openCopyDialog = (section: 'all' | 'email' | 'currency' | 'rules') => {
    setCopyDialogSection(section);
    // Pre-select only the relevant option when opening for a specific section
    if (section === 'email') {
      setCopyOptions({ emailConfig: true, currencyConfig: false, businessRules: false });
    } else if (section === 'currency') {
      setCopyOptions({ emailConfig: false, currencyConfig: true, businessRules: false });
    } else if (section === 'rules') {
      setCopyOptions({ emailConfig: false, currencyConfig: false, businessRules: true });
    } else {
      setCopyOptions({ emailConfig: true, currencyConfig: true, businessRules: true });
    }
    setCopyDialogOpen(true);
  };

  // Get dialog title based on section
  const getCopyDialogTitle = (): string => {
    switch (copyDialogSection) {
      case 'email': return 'Copy Email Configuration';
      case 'currency': return 'Copy Currency Configuration';
      case 'rules': return 'Copy Business Rules';
      default: return 'Copy Configuration from Another Organization';
    }
  };
  
  // Rules state (single source of truth from referenceData_rules)
  const [rulesData, setRulesData] = useState<{
    rule1Threshold: number;
    rule2Multiplier: number;
    rule3Threshold: number;
    rule6UpwardVariance: number;
    rule7DownwardVariance: number;
  }>({
    rule1Threshold: 0,
    rule2Multiplier: 0,
    rule3Threshold: 0,
    rule6UpwardVariance: 5,
    rule7DownwardVariance: 20
  });
  
  // Form state
  const [formData, setFormData] = useState<Partial<Organization>>({
    name: '',
    code: '',
    country: '',
    active: true,
    procurementEmail: '',
    assetManagementEmail: '',
    adminEmail: '',
    baseCurrency: 'LSL',
    allowedCurrencies: ['LSL', 'USD', 'ZAR'],
    vendorApproval3QuoteDuration: 12,
    vendorApprovalCompletedDuration: 6,
    vendorApprovalManualDuration: 12,
    highValueVendorMultiplier: 10,
    highValueVendorMaxDuration: 24,
    timeZone: '',
    // Company details for PO documents
    companyLegalName: '',
    companyPhone: '',
    companyWebsite: '',
    companyRegistrationNumber: '',
    companyTaxId: '',
    companyAddress: {
      street: '',
      city: '',
      state: '',
      postalCode: '',
      country: ''
    },
    defaultDeliveryAddressSameAsCompany: true,
    defaultDeliveryAddress: undefined,
    defaultBillingAddressSameAsCompany: true,
    defaultBillingAddress: undefined
  });

  // Load organizations on mount
  useEffect(() => {
    loadOrganizations();
  }, []);

  // Load currencies from reference data
  useEffect(() => {
    const loadCurrencies = async () => {
      try {
        setLoadingCurrencies(true);
        const currencyItems = await referenceDataAdminService.getItems('currencies', '');
        // Sort currencies by code for consistent display
        const sortedCurrencies = [...currencyItems].sort((a, b) => 
          (a.code || '').localeCompare(b.code || '')
        );
        setCurrencies(sortedCurrencies);
      } catch (error) {
        console.error('Error loading currencies:', error);
        enqueueSnackbar('Failed to load currencies', { variant: 'error' });
      } finally {
        setLoadingCurrencies(false);
      }
    };
    loadCurrencies();
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
      
      // Load rules from single source of truth (referenceData_rules)
      const thresholds = await getRuleThresholds(orgId);
      
      if (org) {
        setSelectedOrg(org);
        setFormData({
          name: org.name || '',
          code: org.code || '',
          country: org.country || '',
          active: org.active ?? true,
          procurementEmail: org.procurementEmail || '',
          assetManagementEmail: org.assetManagementEmail || '',
          adminEmail: org.adminEmail || '',
          baseCurrency: org.baseCurrency || 'LSL',
          allowedCurrencies: org.allowedCurrencies || ['LSL', 'USD', 'ZAR'],
          vendorApproval3QuoteDuration: org.vendorApproval3QuoteDuration || 12,
          vendorApprovalCompletedDuration: org.vendorApprovalCompletedDuration || 6,
          vendorApprovalManualDuration: org.vendorApprovalManualDuration || 12,
          highValueVendorMultiplier: org.highValueVendorMultiplier || 10,
          highValueVendorMaxDuration: org.highValueVendorMaxDuration || 24,
          timeZone: org.timeZone || '',
          // Company details
          companyLegalName: org.companyLegalName || '',
          companyPhone: org.companyPhone || '',
          companyWebsite: org.companyWebsite || '',
          companyRegistrationNumber: org.companyRegistrationNumber || '',
          companyTaxId: org.companyTaxId || '',
          companyAddress: org.companyAddress || {
            street: '',
            city: '',
            state: '',
            postalCode: '',
            country: ''
          },
          defaultDeliveryAddressSameAsCompany: org.defaultDeliveryAddressSameAsCompany ?? true,
          defaultDeliveryAddress: org.defaultDeliveryAddress || undefined,
          defaultBillingAddressSameAsCompany: org.defaultBillingAddressSameAsCompany ?? true,
          defaultBillingAddress: org.defaultBillingAddress || undefined
        });
        
        // Load rules into separate state
        if (thresholds) {
          setRulesData({
            rule1Threshold: thresholds.rule1Threshold,
            rule2Multiplier: thresholds.rule2Multiplier,
            rule3Threshold: thresholds.rule3Threshold,
            rule6UpwardVariance: thresholds.rule6UpwardVariance,
            rule7DownwardVariance: thresholds.rule7DownwardVariance
          });
        }
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

  const handleRuleChange = (field: keyof typeof rulesData, value: number) => {
    setRulesData(prev => ({
      ...prev,
      [field]: value
    }));
    setErrors([]);
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
      
      // Save organization data (emails, vendor approvals, etc.)
      await organizationService.updateOrganization(selectedOrgId, formData);
      
      // Save rules to single source of truth (referenceData_rules collection)
      await updateOrganizationRules(selectedOrgId, {
        rule1Threshold: rulesData.rule1Threshold,
        rule2Multiplier: rulesData.rule2Multiplier,
        rule3Threshold: rulesData.rule3Threshold,
        rule6UpwardVariance: rulesData.rule6UpwardVariance,
        rule7DownwardVariance: rulesData.rule7DownwardVariance
      });
      
      enqueueSnackbar('Organization configuration and rules saved successfully', { variant: 'success' });
      await loadOrganizationData(selectedOrgId);
    } catch (error: any) {
      console.error('Error saving organization:', error);
      enqueueSnackbar('Failed to save organization configuration', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (selectedOrgId) {
      await loadOrganizationData(selectedOrgId);
      setErrors([]);
    }
  };

  // Copy configuration from another organization
  const handleCopyConfiguration = async () => {
    if (!sourceOrgId || !selectedOrgId) {
      enqueueSnackbar('Please select a source organization', { variant: 'error' });
      return;
    }

    if (sourceOrgId === selectedOrgId) {
      enqueueSnackbar('Cannot copy from the same organization', { variant: 'error' });
      return;
    }

    if (!copyOptions.emailConfig && !copyOptions.currencyConfig && !copyOptions.businessRules) {
      enqueueSnackbar('Please select at least one configuration to copy', { variant: 'error' });
      return;
    }

    try {
      setCopying(true);
      
      // Get source organization data
      const sourceOrg = await organizationService.getOrganizationById(sourceOrgId);
      const sourceRules = await getRuleThresholds(sourceOrgId);
      
      if (!sourceOrg) {
        enqueueSnackbar('Source organization not found', { variant: 'error' });
        return;
      }

      const updateData: Partial<Organization> = {};
      
      // Copy email configuration
      if (copyOptions.emailConfig) {
        updateData.procurementEmail = sourceOrg.procurementEmail || '';
        updateData.assetManagementEmail = sourceOrg.assetManagementEmail || '';
        updateData.adminEmail = sourceOrg.adminEmail || '';
      }
      
      // Copy currency configuration
      if (copyOptions.currencyConfig) {
        updateData.baseCurrency = sourceOrg.baseCurrency || 'LSL';
        updateData.allowedCurrencies = sourceOrg.allowedCurrencies || ['LSL', 'USD', 'ZAR'];
      }
      
      // Save organization updates
      if (Object.keys(updateData).length > 0) {
        await organizationService.updateOrganization(selectedOrgId, updateData);
      }
      
      // Copy business rules
      if (copyOptions.businessRules && sourceRules) {
        await updateOrganizationRules(selectedOrgId, {
          rule1Threshold: sourceRules.rule1Threshold,
          rule2Multiplier: sourceRules.rule2Multiplier,
          rule3Threshold: sourceRules.rule3Threshold,
          rule6UpwardVariance: sourceRules.rule6UpwardVariance,
          rule7DownwardVariance: sourceRules.rule7DownwardVariance
        });
      }
      
      // Reload the current organization data to reflect changes
      await loadOrganizationData(selectedOrgId);
      
      const copiedItems = [];
      if (copyOptions.emailConfig) copiedItems.push('Email Configuration');
      if (copyOptions.currencyConfig) copiedItems.push('Currency Configuration');
      if (copyOptions.businessRules) copiedItems.push('Business Rules');
      
      enqueueSnackbar(`Successfully copied: ${copiedItems.join(', ')}`, { variant: 'success' });
      setCopyDialogOpen(false);
      setSourceOrgId('');
    } catch (error: any) {
      console.error('Error copying configuration:', error);
      enqueueSnackbar('Failed to copy configuration', { variant: 'error' });
    } finally {
      setCopying(false);
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
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
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
          
          {selectedOrgId && (
            <Button
              variant="outlined"
              startIcon={<ContentCopyIcon />}
              onClick={() => openCopyDialog('all')}
              sx={{ minWidth: 200, height: 56 }}
            >
              Copy All Config From...
            </Button>
          )}
        </Box>
      </Paper>

      {/* Copy Configuration Dialog */}
      <Dialog 
        open={copyDialogOpen} 
        onClose={() => setCopyDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{getCopyDialogTitle()}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            Select a source organization and choose which configurations to copy to <strong>{selectedOrg?.name}</strong>.
          </Typography>
          
          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel>Source Organization</InputLabel>
            <Select
              value={sourceOrgId}
              onChange={(e) => setSourceOrgId(e.target.value)}
              label="Source Organization"
            >
              {organizations
                .filter(org => org.id !== selectedOrgId)
                .map((org) => (
                  <MenuItem key={org.id} value={org.id}>
                    {org.name}
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
          
          {copyDialogSection === 'all' && (
            <>
              <Typography variant="subtitle2" gutterBottom>
                Select configurations to copy:
              </Typography>
              
              <FormGroup>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={copyOptions.emailConfig}
                      onChange={(e) => setCopyOptions(prev => ({ ...prev, emailConfig: e.target.checked }))}
                    />
                  }
                  label="Email Configuration (Procurement, Asset Management, Admin emails)"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={copyOptions.currencyConfig}
                      onChange={(e) => setCopyOptions(prev => ({ ...prev, currencyConfig: e.target.checked }))}
                    />
                  }
                  label="Currency Configuration (Base currency, Allowed currencies)"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={copyOptions.businessRules}
                      onChange={(e) => setCopyOptions(prev => ({ ...prev, businessRules: e.target.checked }))}
                    />
                  }
                  label="Business Rules (Rule 1-3 thresholds, Rule 6-7 variance thresholds)"
                />
              </FormGroup>
            </>
          )}
          
          <Alert severity="warning" sx={{ mt: 2 }}>
            <Typography variant="body2">
              This will overwrite the selected configurations for <strong>{selectedOrg?.name}</strong>. 
              This action cannot be undone.
            </Typography>
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCopyDialogOpen(false)} disabled={copying}>
            Cancel
          </Button>
          <Button 
            onClick={handleCopyConfiguration} 
            variant="contained" 
            disabled={copying || !sourceOrgId}
            startIcon={copying ? <CircularProgress size={20} /> : <ContentCopyIcon />}
          >
            {copying ? 'Copying...' : 'Copy Configuration'}
          </Button>
        </DialogActions>
      </Dialog>

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
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                <Typography variant="h6" gutterBottom sx={{ mb: 0 }}>
                  Email Configuration
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<ContentCopyIcon />}
                  onClick={() => openCopyDialog('email')}
                >
                  Copy From...
                </Button>
              </Box>
              <Divider sx={{ mb: 2, mt: 1 }} />
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
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                <Typography variant="h6" gutterBottom sx={{ mb: 0 }}>
                  Currency Configuration
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<ContentCopyIcon />}
                  onClick={() => openCopyDialog('currency')}
                >
                  Copy From...
                </Button>
              </Box>
              <Divider sx={{ mb: 2, mt: 1 }} />
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth disabled={loadingCurrencies}>
                <InputLabel>Base Currency</InputLabel>
                <Select
                  value={formData.baseCurrency}
                  onChange={(e) => handleFieldChange('baseCurrency', e.target.value)}
                  label="Base Currency"
                >
                  {loadingCurrencies ? (
                    <MenuItem disabled>
                      <CircularProgress size={20} /> Loading currencies...
                    </MenuItem>
                  ) : (
                    currencies
                      .filter(currency => currency.isActive !== false)
                      .map((currency) => (
                        <MenuItem key={currency.id} value={currency.code}>
                          {currency.code} - {currency.name}
                        </MenuItem>
                      ))
                  )}
                </Select>
                <FormHelperText>Default currency for the organization</FormHelperText>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth disabled={loadingCurrencies}>
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
                  {loadingCurrencies ? (
                    <MenuItem disabled>
                      <CircularProgress size={20} /> Loading currencies...
                    </MenuItem>
                  ) : (
                    currencies
                      .filter(currency => currency.isActive !== false)
                      .map((currency) => (
                        <MenuItem key={currency.id} value={currency.code}>
                          {currency.code} - {currency.name}
                        </MenuItem>
                      ))
                  )}
                </Select>
                <FormHelperText>Currencies accepted for transactions</FormHelperText>
              </FormControl>
            </Grid>

            {/* Business Rules */}
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                <Typography variant="h6" gutterBottom sx={{ mb: 0 }}>
                  Business Rules (Approval Thresholds)
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<ContentCopyIcon />}
                  onClick={() => openCopyDialog('rules')}
                >
                  Copy From...
                </Button>
              </Box>
              <Alert severity="info" sx={{ mb: 2, mt: 1 }}>
                <Typography variant="body2">
                  📋 <strong>Single Source of Truth:</strong> These rules are stored in <code>referenceData_rules</code> collection.
                  Changes here also update Reference Data Management.
                </Typography>
              </Alert>
              <Divider sx={{ mb: 2 }} />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Rule 1 Threshold Amount"
                type="number"
                value={rulesData.rule1Threshold}
                onChange={(e) => handleRuleChange('rule1Threshold', parseFloat(e.target.value) || 0)}
                helperText="Lower threshold for approval requirements"
                InputProps={{ inputProps: { min: 0 } }}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Rule 2 Multiplier"
                type="number"
                value={rulesData.rule2Multiplier}
                onChange={(e) => handleRuleChange('rule2Multiplier', parseFloat(e.target.value) || 0)}
                helperText="Multiplier to calculate Rule 1 * Rule 2 threshold"
                InputProps={{ inputProps: { min: 0 } }}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Rule 3: High Value Threshold"
                type="number"
                value={rulesData.rule3Threshold}
                onChange={(e) => handleRuleChange('rule3Threshold', parseFloat(e.target.value) || 0)}
                helperText="Above this: 3 quotes + dual approval + adjudication always required"
                InputProps={{ inputProps: { min: 0 } }}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  💡 <strong>Rule 4</strong> (# quotes) and <strong>Rule 5</strong> (# approvers) 
                  can be edited in Reference Data Management → Rules
                </Typography>
              </Box>
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Rule 6: Final Price Upward Variance Threshold (%)"
                type="number"
                value={rulesData.rule6UpwardVariance}
                onChange={(e) => handleRuleChange('rule6UpwardVariance', parseFloat(e.target.value) || 5)}
                helperText="Max % increase from approved to final price (default: 5%)"
                InputProps={{ inputProps: { min: 0, max: 100, step: 0.1 } }}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Rule 7: Final Price Downward Variance Threshold (%)"
                type="number"
                value={rulesData.rule7DownwardVariance}
                onChange={(e) => handleRuleChange('rule7DownwardVariance', parseFloat(e.target.value) || 20)}
                helperText="Max % decrease from approved to final price (default: 20%)"
                InputProps={{ inputProps: { min: 0, max: 100, step: 0.1 } }}
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

            {/* Company Details for PO Documents */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                Company Details for PO Documents
              </Typography>
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  📄 These details will appear on generated Purchase Order (PO) documents sent to suppliers.
                </Typography>
              </Alert>
              <Divider sx={{ mb: 2 }} />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Company Legal Name"
                value={formData.companyLegalName}
                onChange={(e) => handleFieldChange('companyLegalName', e.target.value)}
                helperText="Full legal name for PO documents"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Company Phone"
                value={formData.companyPhone}
                onChange={(e) => handleFieldChange('companyPhone', e.target.value)}
                helperText="Main phone number"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Company Website"
                value={formData.companyWebsite}
                onChange={(e) => handleFieldChange('companyWebsite', e.target.value)}
                helperText="Company website URL"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Registration Number"
                value={formData.companyRegistrationNumber}
                onChange={(e) => handleFieldChange('companyRegistrationNumber', e.target.value)}
                helperText="Business registration number"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Tax ID / VAT Number"
                value={formData.companyTaxId}
                onChange={(e) => handleFieldChange('companyTaxId', e.target.value)}
                helperText="Tax identification number"
              />
            </Grid>

            {/* Company Address */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom sx={{ mt: 2, fontWeight: 'bold' }}>
                Company Address
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Street Address"
                value={formData.companyAddress?.street || ''}
                onChange={(e) => handleFieldChange('companyAddress', {
                  ...formData.companyAddress,
                  street: e.target.value
                })}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="City"
                value={formData.companyAddress?.city || ''}
                onChange={(e) => handleFieldChange('companyAddress', {
                  ...formData.companyAddress,
                  city: e.target.value
                })}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="State/Province"
                value={formData.companyAddress?.state || ''}
                onChange={(e) => handleFieldChange('companyAddress', {
                  ...formData.companyAddress,
                  state: e.target.value
                })}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Postal Code"
                value={formData.companyAddress?.postalCode || ''}
                onChange={(e) => handleFieldChange('companyAddress', {
                  ...formData.companyAddress,
                  postalCode: e.target.value
                })}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Country"
                value={formData.companyAddress?.country || ''}
                onChange={(e) => handleFieldChange('companyAddress', {
                  ...formData.companyAddress,
                  country: e.target.value
                })}
              />
            </Grid>

            {/* Company Logo - Note: Logo is hardcoded for entire 1PWR Africa group in src/components/common/CompanyLogo.tsx */}
            
            {/* Default Delivery Address */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom sx={{ mt: 3, fontWeight: 'bold' }}>
                Default Delivery Address
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.defaultDeliveryAddressSameAsCompany ?? true}
                    onChange={(e) => {
                      handleFieldChange('defaultDeliveryAddressSameAsCompany', e.target.checked);
                      if (e.target.checked) {
                        // Clear delivery address when using company address
                        handleFieldChange('defaultDeliveryAddress', undefined);
                      }
                    }}
                  />
                }
                label="Same as company address"
              />
            </Grid>

            {!formData.defaultDeliveryAddressSameAsCompany && (
              <>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Delivery Street Address"
                    value={formData.defaultDeliveryAddress?.street || ''}
                    onChange={(e) => handleFieldChange('defaultDeliveryAddress', {
                      ...formData.defaultDeliveryAddress,
                      street: e.target.value
                    })}
                  />
                </Grid>

                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="City"
                    value={formData.defaultDeliveryAddress?.city || ''}
                    onChange={(e) => handleFieldChange('defaultDeliveryAddress', {
                      ...formData.defaultDeliveryAddress,
                      city: e.target.value
                    })}
                  />
                </Grid>

                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="State/Province"
                    value={formData.defaultDeliveryAddress?.state || ''}
                    onChange={(e) => handleFieldChange('defaultDeliveryAddress', {
                      ...formData.defaultDeliveryAddress,
                      state: e.target.value
                    })}
                  />
                </Grid>

                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Postal Code"
                    value={formData.defaultDeliveryAddress?.postalCode || ''}
                    onChange={(e) => handleFieldChange('defaultDeliveryAddress', {
                      ...formData.defaultDeliveryAddress,
                      postalCode: e.target.value
                    })}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Country"
                    value={formData.defaultDeliveryAddress?.country || ''}
                    onChange={(e) => handleFieldChange('defaultDeliveryAddress', {
                      ...formData.defaultDeliveryAddress,
                      country: e.target.value
                    })}
                  />
                </Grid>
              </>
            )}

            {/* Default Billing Address */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom sx={{ mt: 3, fontWeight: 'bold' }}>
                Default Billing Address
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.defaultBillingAddressSameAsCompany ?? true}
                    onChange={(e) => {
                      handleFieldChange('defaultBillingAddressSameAsCompany', e.target.checked);
                      if (e.target.checked) {
                        // Clear billing address when using company address
                        handleFieldChange('defaultBillingAddress', undefined);
                      }
                    }}
                  />
                }
                label="Same as company address"
              />
            </Grid>

            {!formData.defaultBillingAddressSameAsCompany && (
              <>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Billing Street Address"
                    value={formData.defaultBillingAddress?.street || ''}
                    onChange={(e) => handleFieldChange('defaultBillingAddress', {
                      ...formData.defaultBillingAddress,
                      street: e.target.value
                    })}
                  />
                </Grid>

                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="City"
                    value={formData.defaultBillingAddress?.city || ''}
                    onChange={(e) => handleFieldChange('defaultBillingAddress', {
                      ...formData.defaultBillingAddress,
                      city: e.target.value
                    })}
                  />
                </Grid>

                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="State/Province"
                    value={formData.defaultBillingAddress?.state || ''}
                    onChange={(e) => handleFieldChange('defaultBillingAddress', {
                      ...formData.defaultBillingAddress,
                      state: e.target.value
                    })}
                  />
                </Grid>

                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Postal Code"
                    value={formData.defaultBillingAddress?.postalCode || ''}
                    onChange={(e) => handleFieldChange('defaultBillingAddress', {
                      ...formData.defaultBillingAddress,
                      postalCode: e.target.value
                    })}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Country"
                    value={formData.defaultBillingAddress?.country || ''}
                    onChange={(e) => handleFieldChange('defaultBillingAddress', {
                      ...formData.defaultBillingAddress,
                      country: e.target.value
                    })}
                  />
                </Grid>
              </>
            )}

            {/* Other Settings */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                Other Settings
              </Typography>
              <Divider sx={{ mb: 2 }} />
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Time Zone</InputLabel>
                <Select
                  value={formData.timeZone || ''}
                  onChange={(e) => handleFieldChange('timeZone', e.target.value)}
                  label="Time Zone"
                >
                  <MenuItem value="">
                    <em>Select a time zone</em>
                  </MenuItem>
                  <MenuItem value="Africa/Abidjan">GMT (West Africa - Ghana, Ivory Coast)</MenuItem>
                  <MenuItem value="Africa/Lagos">GMT+1 (West Africa - Nigeria, Benin)</MenuItem>
                  <MenuItem value="Africa/Johannesburg">GMT+2 (Southern Africa - South Africa, Lesotho)</MenuItem>
                  <MenuItem value="Africa/Nairobi">GMT+3 (East Africa - Kenya, Tanzania)</MenuItem>
                </Select>
              </FormControl>
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

