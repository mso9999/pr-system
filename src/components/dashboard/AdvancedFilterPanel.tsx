import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Autocomplete,
  SelectChangeEvent,
  Card,
  CardContent,
  Divider,
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon, Clear as ClearIcon, FileDownload as DownloadIcon } from '@mui/icons-material';
import { PRRequest, PRStatus } from '@/types/pr';
import { ReferenceDataItem } from '@/types/referenceData';
import { User } from '@/types/user';

export interface FilterCriteria {
  searchText?: string;
  organizations?: string[];
  requestorId?: string;
  approverId?: string;
  vendorId?: string;
  departmentId?: string;
  siteId?: string;
  vehicleId?: string;
  projectCategoryId?: string;
  expenseTypeId?: string;
  createdDateFrom?: string;
  createdDateTo?: string;
  requiredDateFrom?: string;
  requiredDateTo?: string;
  lastUpdatedFrom?: string;
  lastUpdatedTo?: string;
  amountMin?: number;
  amountMax?: number;
  urgency?: 'all' | 'urgent' | 'normal';
}

interface AdvancedFilterPanelProps {
  prs: PRRequest[];
  onFilterChange: (filteredPRs: PRRequest[], criteria: FilterCriteria) => void;
  organizations: ReferenceDataItem[];
  users: User[];
  vendors: ReferenceDataItem[];
  departments: ReferenceDataItem[];
  sites: ReferenceDataItem[];
  vehicles: ReferenceDataItem[];
  projectCategories: ReferenceDataItem[];
  expenseTypes: ReferenceDataItem[];
}

export const AdvancedFilterPanel: React.FC<AdvancedFilterPanelProps> = ({
  prs,
  onFilterChange,
  organizations,
  users,
  vendors,
  departments,
  sites,
  vehicles,
  projectCategories,
  expenseTypes,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [filters, setFilters] = useState<FilterCriteria>({
    urgency: 'all'
  });

  // Apply filters whenever filters change
  useEffect(() => {
    applyFilters();
  }, [filters, prs]);

  const applyFilters = () => {
    let filtered = [...prs];

    // Search text filter (PR number, description, vendor name)
    if (filters.searchText) {
      const searchLower = filters.searchText.toLowerCase();
      filtered = filtered.filter(pr =>
        pr.prNumber?.toLowerCase().includes(searchLower) ||
        pr.description?.toLowerCase().includes(searchLower) ||
        pr.vendorName?.toLowerCase().includes(searchLower) ||
        pr.preferredVendor?.toLowerCase().includes(searchLower)
      );
    }

    // Organization filter
    if (filters.organizations && filters.organizations.length > 0) {
      filtered = filtered.filter(pr =>
        filters.organizations!.includes(pr.organization)
      );
    }

    // Requestor filter
    if (filters.requestorId) {
      filtered = filtered.filter(pr => pr.requestorId === filters.requestorId);
    }

    // Approver filter
    if (filters.approverId) {
      filtered = filtered.filter(pr =>
        pr.approver === filters.approverId || pr.approver2 === filters.approverId
      );
    }

    // Vendor filter
    if (filters.vendorId) {
      filtered = filtered.filter(pr =>
        pr.preferredVendor === filters.vendorId || pr.selectedVendor === filters.vendorId
      );
    }

    // Department filter
    if (filters.departmentId) {
      filtered = filtered.filter(pr => pr.department === filters.departmentId);
    }

    // Site filter - show PR if ANY selected site matches (or legacy site field matches)
    if (filters.siteId) {
      filtered = filtered.filter(pr => {
        if (pr.sites && pr.sites.length > 0) {
          return pr.sites.some(site => site === filters.siteId);
        }
        return pr.site === filters.siteId;
      });
    }

    // Vehicle filter
    if (filters.vehicleId) {
      filtered = filtered.filter(pr => pr.vehicle === filters.vehicleId);
    }

    // Project Category filter
    if (filters.projectCategoryId) {
      filtered = filtered.filter(pr => pr.projectCategory === filters.projectCategoryId);
    }

    // Expense Type filter
    if (filters.expenseTypeId) {
      filtered = filtered.filter(pr => pr.expenseType === filters.expenseTypeId);
    }

    // Date range filters
    if (filters.createdDateFrom) {
      filtered = filtered.filter(pr =>
        new Date(pr.createdAt) >= new Date(filters.createdDateFrom!)
      );
    }
    if (filters.createdDateTo) {
      filtered = filtered.filter(pr =>
        new Date(pr.createdAt) <= new Date(filters.createdDateTo!)
      );
    }

    if (filters.requiredDateFrom) {
      filtered = filtered.filter(pr =>
        new Date(pr.requiredDate) >= new Date(filters.requiredDateFrom!)
      );
    }
    if (filters.requiredDateTo) {
      filtered = filtered.filter(pr =>
        new Date(pr.requiredDate) <= new Date(filters.requiredDateTo!)
      );
    }

    if (filters.lastUpdatedFrom) {
      filtered = filtered.filter(pr =>
        new Date(pr.updatedAt) >= new Date(filters.lastUpdatedFrom!)
      );
    }
    if (filters.lastUpdatedTo) {
      filtered = filtered.filter(pr =>
        new Date(pr.updatedAt) <= new Date(filters.lastUpdatedTo!)
      );
    }

    // Amount range filter
    if (filters.amountMin !== undefined) {
      filtered = filtered.filter(pr => pr.estimatedAmount >= filters.amountMin!);
    }
    if (filters.amountMax !== undefined) {
      filtered = filtered.filter(pr => pr.estimatedAmount <= filters.amountMax!);
    }

    // Urgency filter
    if (filters.urgency === 'urgent') {
      filtered = filtered.filter(pr => pr.isUrgent === true);
    } else if (filters.urgency === 'normal') {
      filtered = filtered.filter(pr => !pr.isUrgent);
    }

    onFilterChange(filtered, filters);
  };

  const handleFilterChange = (field: keyof FilterCriteria, value: any) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleClearAllFilters = () => {
    setFilters({ urgency: 'all' });
  };

  const getActiveFilterCount = (): number => {
    let count = 0;
    if (filters.searchText) count++;
    if (filters.organizations && filters.organizations.length > 0) count++;
    if (filters.requestorId) count++;
    if (filters.approverId) count++;
    if (filters.vendorId) count++;
    if (filters.departmentId) count++;
    if (filters.siteId) count++;
    if (filters.vehicleId) count++;
    if (filters.projectCategoryId) count++;
    if (filters.expenseTypeId) count++;
    if (filters.createdDateFrom || filters.createdDateTo) count++;
    if (filters.requiredDateFrom || filters.requiredDateTo) count++;
    if (filters.lastUpdatedFrom || filters.lastUpdatedTo) count++;
    if (filters.amountMin !== undefined || filters.amountMax !== undefined) count++;
    if (filters.urgency !== 'all') count++;
    return count;
  };

  const activeFilterCount = getActiveFilterCount();

  // Get approvers (Level 2 and 4)
  const approvers = users.filter(u => u.permissionLevel === 2 || u.permissionLevel === 4);

  return (
    <Box sx={{ mb: 2 }}>
      <Accordion expanded={expanded} onChange={() => setExpanded(!expanded)}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
            <Typography variant="h6">Advanced Filters</Typography>
            {activeFilterCount > 0 && (
              <Chip
                label={`${activeFilterCount} active filter${activeFilterCount > 1 ? 's' : ''}`}
                color="primary"
                size="small"
              />
            )}
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            {/* Search Text */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Search"
                placeholder="Search by PR/PO number, description, or vendor name"
                value={filters.searchText || ''}
                onChange={(e) => handleFilterChange('searchText', e.target.value)}
              />
            </Grid>

            {/* Organization Multi-select */}
            <Grid item xs={12} md={6}>
              <Autocomplete
                multiple
                options={organizations}
                getOptionLabel={(option) => option.name}
                value={organizations.filter(org => filters.organizations?.includes(org.id))}
                onChange={(_, newValue) => {
                  handleFilterChange('organizations', newValue.map(v => v.id));
                }}
                renderInput={(params) => (
                  <TextField {...params} label="Organizations" placeholder="Select organizations" />
                )}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip label={option.name} {...getTagProps({ index })} size="small" />
                  ))
                }
              />
            </Grid>

            {/* Requestor */}
            <Grid item xs={12} md={6}>
              <Autocomplete
                options={users}
                getOptionLabel={(option) => option.name || option.email || 'Unknown'}
                value={users.find(u => u.id === filters.requestorId) || null}
                onChange={(_, newValue) => {
                  handleFilterChange('requestorId', newValue?.id || undefined);
                }}
                renderInput={(params) => (
                  <TextField {...params} label="Requestor" placeholder="Select requestor" />
                )}
              />
            </Grid>

            {/* Approver */}
            <Grid item xs={12} md={6}>
              <Autocomplete
                options={approvers}
                getOptionLabel={(option) => `${option.name || option.email} (${option.permissionLevel === 2 ? 'Senior' : 'Finance'})`}
                value={approvers.find(u => u.id === filters.approverId) || null}
                onChange={(_, newValue) => {
                  handleFilterChange('approverId', newValue?.id || undefined);
                }}
                renderInput={(params) => (
                  <TextField {...params} label="Approver" placeholder="Select approver" />
                )}
              />
            </Grid>

            {/* Vendor */}
            <Grid item xs={12} md={6}>
              <Autocomplete
                options={vendors}
                getOptionLabel={(option) => `${option.name}${option.isApproved ? ' ✓' : ''}`}
                value={vendors.find(v => v.id === filters.vendorId) || null}
                onChange={(_, newValue) => {
                  handleFilterChange('vendorId', newValue?.id || undefined);
                }}
                renderInput={(params) => (
                  <TextField {...params} label="Vendor" placeholder="Select vendor" />
                )}
              />
            </Grid>

            {/* Department */}
            <Grid item xs={12} md={4}>
              <Autocomplete
                options={departments}
                getOptionLabel={(option) => option.name}
                value={departments.find(d => d.id === filters.departmentId) || null}
                onChange={(_, newValue) => {
                  handleFilterChange('departmentId', newValue?.id || undefined);
                }}
                renderInput={(params) => (
                  <TextField {...params} label="Department" placeholder="Select department" />
                )}
              />
            </Grid>

            {/* Site */}
            <Grid item xs={12} md={4}>
              <Autocomplete
                options={sites}
                getOptionLabel={(option) => option.name}
                value={sites.find(s => s.id === filters.siteId) || null}
                onChange={(_, newValue) => {
                  handleFilterChange('siteId', newValue?.id || undefined);
                }}
                renderInput={(params) => (
                  <TextField {...params} label="Site" placeholder="Select site" />
                )}
              />
            </Grid>

            {/* Vehicle */}
            <Grid item xs={12} md={4}>
              <Autocomplete
                options={vehicles}
                getOptionLabel={(option) => option.registrationNumber || option.name || 'Unknown'}
                value={vehicles.find(v => v.id === filters.vehicleId) || null}
                onChange={(_, newValue) => {
                  handleFilterChange('vehicleId', newValue?.id || undefined);
                }}
                renderInput={(params) => (
                  <TextField {...params} label="Vehicle" placeholder="Select vehicle" />
                )}
              />
            </Grid>

            {/* Project Category */}
            <Grid item xs={12} md={6}>
              <Autocomplete
                options={projectCategories}
                getOptionLabel={(option) => option.name}
                value={projectCategories.find(c => c.id === filters.projectCategoryId) || null}
                onChange={(_, newValue) => {
                  handleFilterChange('projectCategoryId', newValue?.id || undefined);
                }}
                renderInput={(params) => (
                  <TextField {...params} label="Project Category" placeholder="Select category" />
                )}
              />
            </Grid>

            {/* Expense Type */}
            <Grid item xs={12} md={6}>
              <Autocomplete
                options={expenseTypes}
                getOptionLabel={(option) => option.name}
                value={expenseTypes.find(e => e.id === filters.expenseTypeId) || null}
                onChange={(_, newValue) => {
                  handleFilterChange('expenseTypeId', newValue?.id || undefined);
                }}
                renderInput={(params) => (
                  <TextField {...params} label="Expense Type" placeholder="Select expense type" />
                )}
              />
            </Grid>

            {/* Date Ranges */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Date Ranges
              </Typography>
            </Grid>

            {/* Created Date */}
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Created From"
                type="date"
                value={filters.createdDateFrom || ''}
                onChange={(e) => handleFilterChange('createdDateFrom', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Created To"
                type="date"
                value={filters.createdDateTo || ''}
                onChange={(e) => handleFilterChange('createdDateTo', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            {/* Required Date */}
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Required From"
                type="date"
                value={filters.requiredDateFrom || ''}
                onChange={(e) => handleFilterChange('requiredDateFrom', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Required To"
                type="date"
                value={filters.requiredDateTo || ''}
                onChange={(e) => handleFilterChange('requiredDateTo', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            {/* Last Updated */}
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Updated From"
                type="date"
                value={filters.lastUpdatedFrom || ''}
                onChange={(e) => handleFilterChange('lastUpdatedFrom', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Updated To"
                type="date"
                value={filters.lastUpdatedTo || ''}
                onChange={(e) => handleFilterChange('lastUpdatedTo', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            {/* Amount Range */}
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Min Amount"
                type="number"
                value={filters.amountMin || ''}
                onChange={(e) => handleFilterChange('amountMin', e.target.value ? parseFloat(e.target.value) : undefined)}
                InputProps={{ inputProps: { min: 0 } }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Max Amount"
                type="number"
                value={filters.amountMax || ''}
                onChange={(e) => handleFilterChange('amountMax', e.target.value ? parseFloat(e.target.value) : undefined)}
                InputProps={{ inputProps: { min: 0 } }}
              />
            </Grid>

            {/* Urgency Filter */}
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Urgency</InputLabel>
                <Select
                  value={filters.urgency || 'all'}
                  onChange={(e) => handleFilterChange('urgency', e.target.value)}
                  label="Urgency"
                >
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="urgent">Urgent Only</MenuItem>
                  <MenuItem value="normal">Normal Only</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Action Buttons */}
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                <Button
                  variant="outlined"
                  startIcon={<ClearIcon />}
                  onClick={handleClearAllFilters}
                  disabled={activeFilterCount === 0}
                >
                  Clear All Filters
                </Button>
              </Box>
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
};

