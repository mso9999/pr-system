/**
 * @fileoverview Review Step Component
 * @version 1.0.0
 * 
 * Description:
 * Final step in the PR creation process. Shows a summary of the PR
 * and allows for quote management and final approver selection.
 */

import React from 'react';
import {
  Grid,
  Typography,
  Paper,
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  Link,
  FormControlLabel,
  Checkbox,
  Alert,
} from '@mui/material';
import { FormState } from '../NewPRForm';
import { ReferenceDataItem } from '../../../types/referenceData';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DownloadIcon from '@mui/icons-material/Download';
import AttachFileIcon from '@mui/icons-material/AttachFile';

// Define the Approver interface since it's not exported from NewPRForm
interface Approver {
  id: string;
  name: string;
  department?: string;
  email?: string;
}

interface ReviewStepProps {
  formState: FormState;
  setFormState?: React.Dispatch<React.SetStateAction<FormState>>;
  vendors: ReferenceDataItem[];
  projectCategories: ReferenceDataItem[];
  sites: ReferenceDataItem[];
  approvers: Approver[];
  loading: boolean;
  onSubmit: () => void;
  rules?: any[]; // Rules for validation
}

export const ReviewStep: React.FC<ReviewStepProps> = ({
  formState,
  setFormState,
  vendors,
  projectCategories,
  sites,
  approvers,
  loading,
  onSubmit,
  rules = []
}) => {
  // Get approver names for display
  const getApproverNames = () => {
    if (!formState.approvers || formState.approvers.length === 0) return "Not specified";
    
    // Map through the approver IDs and find the corresponding approver objects
    const approverNames = formState.approvers.map(approverId => {
      const approverObj = approvers.find(a => a.id === approverId);
      return approverObj ? `${approverObj.name}${approverObj.department ? ` (${approverObj.department})` : ''}` : approverId;
    });
    
    return approverNames.join(', ');
  };

  // Get vendor name for display
  const getVendorName = () => {
    if (!formState.preferredVendor) {
      return formState.customVendorName || "Not specified";
    }
    
    const vendorObj = vendors.find(v => v.id === formState.preferredVendor);
    return vendorObj ? vendorObj.name : "Not specified";
  };

  // Get project category name for display
  const getProjectCategoryName = () => {
    if (!formState.projectCategory) return 'Not specified';
    
    const categoryObj = projectCategories.find(pc => pc.id === formState.projectCategory);
    return categoryObj ? categoryObj.name : formState.projectCategory;
  };

  // Get site name for display
  const getSiteName = () => {
    if (!formState.site) return 'Not specified';
    
    const siteObj = sites.find(s => s.id === formState.site);
    return siteObj ? siteObj.name : formState.site;
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Helper functions to format display values
  const formatDisplayValue = (value: any): string => {
    if (!value) return 'Not specified';
    
    if (typeof value === 'object' && value !== null && 'name' in value) {
      return value.name || 'Not specified';
    }
    
    if (typeof value !== 'string') return String(value);
    
    // Convert snake_case or lowercase to Title Case
    return value
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const getDisplayName = (item: any): string => {
    if (!item) return 'Not specified';
    
    if (typeof item === 'object' && item !== null && 'name' in item) {
      return item.name;
    }
    
    if (typeof item === 'string') return item;
    
    return 'Not specified';
  };

  const handleViewFile = (file: any) => {
    if (file && file.url) {
      window.open(file.url, '_blank');
    }
  };

  // Get user name from the form state
  const getUserName = () => {
    return formState.requestor || 'Current User';
  };

  return (
    <Grid container spacing={3}>
      {/* PR Header */}
      <Grid item xs={12}>
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h5" gutterBottom>
            Review Purchase Request
          </Typography>
          <Typography color="textSecondary" gutterBottom>
            Please review all information before submitting
          </Typography>
        </Paper>
      </Grid>

      {/* Requestor Information */}
      <Grid item xs={12} md={6}>
        <Paper sx={{ p: 3, height: '100%' }}>
          <Typography variant="h6" gutterBottom>
            Requestor Information
          </Typography>
          <Box sx={{ mt: 2 }}>
            <Typography variant="body1">
              <strong>Name:</strong> {getUserName()}
            </Typography>
            <Typography variant="body1">
              <strong>Email:</strong> {formState.email || 'Not specified'}
            </Typography>
            <Typography variant="body1">
              <strong>Department:</strong> {formatDisplayValue(formState.department)}
            </Typography>
            <Typography variant="body1">
              <strong>Project Category:</strong> {getProjectCategoryName()}
            </Typography>
            <Typography variant="body1">
              <strong>Site:</strong> {getSiteName()}
            </Typography>
            {formState.isUrgent && (
              <Box sx={{ mt: 1 }}>
                <Chip 
                  label="URGENT" 
                  color="error" 
                  size="small" 
                  sx={{ fontWeight: 'bold' }}
                />
              </Box>
            )}
          </Box>
        </Paper>
      </Grid>

      {/* Financial Details */}
      <Grid item xs={12} md={6}>
        <Paper sx={{ p: 3, height: '100%' }}>
          <Typography variant="h6" gutterBottom>
            Financial Details
          </Typography>
          <Box sx={{ mt: 2 }}>
            <Typography variant="body1">
              <strong>Estimated Amount:</strong> {formState.estimatedAmount} {formatDisplayValue(formState.currency)}
            </Typography>
            <Typography variant="body1">
              <strong>Expense Type:</strong> {formatDisplayValue(formState.expenseType)}
            </Typography>
            {formState.expenseType === '4' && (
              <Typography variant="body1">
                <strong>Vehicle:</strong> {getDisplayName(formState.vehicle)}
              </Typography>
            )}
            <Typography variant="body1">
              <strong>Preferred Vendor:</strong> {getVendorName()}
            </Typography>
            <Typography variant="body1">
              <strong>Currency:</strong> {formatDisplayValue(formState.currency)}
            </Typography>
          </Box>
        </Paper>
      </Grid>

      {/* Approval Details */}
      <Grid item xs={12} md={6}>
        <Paper sx={{ p: 3, height: '100%' }}>
          <Typography variant="h6" gutterBottom>
            Approval Details
          </Typography>
          <Box sx={{ mt: 2 }}>
            <Typography variant="body1">
              <strong>Approvers:</strong> {getApproverNames()}
            </Typography>
          </Box>
        </Paper>
      </Grid>

      {/* Line Items */}
      <Grid item xs={12}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Line Items
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Description</TableCell>
                  <TableCell>Quantity</TableCell>
                  <TableCell>Unit of Measure</TableCell>
                  <TableCell>Notes</TableCell>
                  <TableCell>Attachments</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {formState.lineItems.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>{item.description}</TableCell>
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell>{item.uom}</TableCell>
                    <TableCell>{item.notes}</TableCell>
                    <TableCell>
                      {item.attachments && item.attachments.length > 0 ? (
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          {item.attachments.map((file, fileIndex) => (
                            <Tooltip key={fileIndex} title={file.name}>
                              <IconButton size="small" onClick={() => handleViewFile(file)}>
                                <AttachFileIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          ))}
                        </Box>
                      ) : (
                        'None'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Grid>

      {/* Skip Queue Option */}
      <Grid item xs={12}>
        <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={formState.skipQueue || false}
                onChange={(e) => {
                  if (setFormState) {
                    setFormState(prev => ({ ...prev, skipQueue: e.target.checked }));
                  }
                }}
              />
            }
            label="Skip Queue - Push directly to Pending Approval"
          />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, ml: 4 }}>
            This option allows you to skip the IN_QUEUE status and send the PR directly to approvers.
            Only available for PRs below Rule 1 threshold.
          </Typography>
          {formState.skipQueue && (() => {
            // Check if amount is below Rule 1 threshold
            const rule1 = rules.find((rule: any) => 
              rule.number === 1 || rule.number === '1' || 
              rule.description?.toLowerCase().includes('finance admin approvers can approve low value')
            );
            const amount = typeof formState.estimatedAmount === 'number' 
              ? formState.estimatedAmount 
              : parseFloat(formState.estimatedAmount) || 0;
            const isAboveThreshold = rule1 && amount > rule1.threshold;
            
            if (isAboveThreshold) {
              return (
                <Alert severity="error" sx={{ mt: 2, ml: 4 }}>
                  Cannot skip queue: Amount ({amount} {formState.currency}) exceeds Rule 1 threshold ({rule1.threshold} {rule1.currency}).
                  Only PRs below this threshold can skip the queue.
                </Alert>
              );
            }
            return (
              <Alert severity="info" sx={{ mt: 2, ml: 4 }}>
                This PR will be sent directly to approvers, skipping the procurement queue.
              </Alert>
            );
          })()}
        </Paper>
      </Grid>

      {/* Submit Button */}
      <Grid item xs={12}>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
          <Button
            variant="contained"
            color="primary"
            onClick={onSubmit}
            disabled={loading}
            size="large"
          >
            Submit Purchase Request
          </Button>
        </Box>
      </Grid>
    </Grid>
  );
};
