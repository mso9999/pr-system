import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  Chip,
  Divider,
  Alert,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  CircularProgress,
  Stack,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  CloudUpload as UploadIcon,
  Download as DownloadIcon,
  CheckCircle as ApprovedIcon,
  Cancel as NotApprovedIcon,
  Star as HighValueIcon,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { referenceDataService } from '@/services/referenceData';
import { referenceDataAdminService } from '@/services/referenceDataAdmin';
import { ReferenceDataItem, Vendor } from '@/types/referenceData';
import { PRRequest } from '@/types/pr';
import { StorageService } from '@/services/storage';
import { Attachment } from '@/types/pr';
import { User } from '@/types/user';
import { useSelector } from 'react-redux';
import { RootState } from '@/store';

export const VendorDetailsPage: React.FC = () => {
  const { vendorId } = useParams<{ vendorId: string }>();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const currentUser = useSelector((state: RootState) => state.auth.user);
  
  const [vendor, setVendor] = useState<ReferenceDataItem | null>(null);
  const [associatedPRs, setAssociatedPRs] = useState<PRRequest[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Dialog states
  const [approvalDialog, setApprovalDialog] = useState(false);
  const [deApprovalDialog, setDeApprovalDialog] = useState(false);
  const [approvalAction, setApprovalAction] = useState<'approve' | 'deapprove'>('approve');
  const [justification, setJustification] = useState('');
  const [justificationRequired, setJustificationRequired] = useState(false);

  // Permission checks
  const canManageVendors = 
    currentUser?.permissionLevel === 1 || // Admin
    currentUser?.permissionLevel === 3 || // Procurement
    currentUser?.permissionLevel === 4;   // Finance/Admin

  useEffect(() => {
    if (vendorId) {
      loadVendorData();
    }
  }, [vendorId]);

  const loadVendorData = async () => {
    if (!vendorId) return;

    try {
      setLoading(true);
      
      // Load vendor data
      const vendors = await referenceDataService.getItemsByType('vendors');
      const vendorData = vendors.find(v => v.id === vendorId);
      
      if (vendorData) {
        setVendor(vendorData);
        
        // TODO: Load associated PRs/POs
        // This would require querying purchaseRequests collection
        // where preferredVendor or selectedVendor equals vendorId
      }
    } catch (error) {
      console.error('Error loading vendor data:', error);
      enqueueSnackbar('Failed to load vendor data', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!vendor || !vendorId) return;

    // Check if justification is required
    // Justification required if vendor doesn't have recent successful order history
    const needsJustification = !vendor.lastCompletedOrderDate || 
      !vendor.last3QuoteProcessDate;

    if (needsJustification && !justification.trim()) {
      enqueueSnackbar('Justification required for manual vendor approval', { variant: 'error' });
      return;
    }

    try {
      const approvalExpiryDate = new Date();
      approvalExpiryDate.setMonth(approvalExpiryDate.getMonth() + 12); // Manual approval duration

      await referenceDataAdminService.updateItem('vendors', vendorId, {
        isApproved: true,
        approvalDate: new Date().toISOString(),
        approvalExpiryDate: approvalExpiryDate.toISOString(),
        approvalReason: 'manual',
        approvedBy: currentUser?.id,
        approvalNote: justification || 'Manually approved',
      });

      enqueueSnackbar('Vendor approved successfully', { variant: 'success' });
      setApprovalDialog(false);
      setJustification('');
      loadVendorData();
    } catch (error) {
      console.error('Error approving vendor:', error);
      enqueueSnackbar('Failed to approve vendor', { variant: 'error' });
    }
  };

  const handleDeApprove = async () => {
    if (!vendor || !vendorId) return;

    // Justification ALWAYS required for de-approval
    if (!justification.trim()) {
      enqueueSnackbar('Justification required for de-approval', { variant: 'error' });
      return;
    }

    try {
      await referenceDataAdminService.updateItem('vendors', vendorId, {
        isApproved: false,
        approvalDate: undefined,
        approvalExpiryDate: undefined,
        approvalNote: `De-approved: ${justification}`,
      });

      enqueueSnackbar('Vendor de-approved successfully', { variant: 'success' });
      setDeApprovalDialog(false);
      setJustification('');
      loadVendorData();
    } catch (error) {
      console.error('Error de-approving vendor:', error);
      enqueueSnackbar('Failed to de-approve vendor', { variant: 'error' });
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (!vendor) {
    return (
      <Box p={3}>
        <Typography color="error">Vendor not found</Typography>
        <Button startIcon={<BackIcon />} onClick={() => navigate('/admin')} sx={{ mt: 2 }}>
          Back to Admin
        </Button>
      </Box>
    );
  }

  return (
    <Box p={3}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" gutterBottom>
            {vendor.name}
          </Typography>
          <Box display="flex" gap={1} alignItems="center">
            <Chip
              icon={vendor.isApproved ? <ApprovedIcon /> : <NotApprovedIcon />}
              label={vendor.isApproved ? 'Approved' : 'Not Approved'}
              color={vendor.isApproved ? 'success' : 'default'}
            />
            {vendor.isHighValue && (
              <Chip
                icon={<HighValueIcon />}
                label="High-Value Vendor"
                color="warning"
              />
            )}
          </Box>
        </Box>
        <Button
          startIcon={<BackIcon />}
          variant="outlined"
          onClick={() => navigate('/admin')}
        >
          Back to Admin
        </Button>
      </Box>

      <Grid container spacing={3}>
        {/* Vendor Information */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Vendor Information
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Stack spacing={2}>
              <Box>
                <Typography variant="caption" color="textSecondary">Name</Typography>
                <Typography variant="body1">{vendor.name}</Typography>
              </Box>
              
              {vendor.contactEmail && (
                <Box>
                  <Typography variant="caption" color="textSecondary">Email</Typography>
                  <Typography variant="body1">{vendor.contactEmail}</Typography>
                </Box>
              )}
              
              {vendor.contactPhone && (
                <Box>
                  <Typography variant="caption" color="textSecondary">Phone</Typography>
                  <Typography variant="body1">{vendor.contactPhone}</Typography>
                </Box>
              )}
              
              {vendor.url && (
                <Box>
                  <Typography variant="caption" color="textSecondary">Website</Typography>
                  <Typography variant="body1">{vendor.url}</Typography>
                </Box>
              )}
              
              {vendor.address && (
                <Box>
                  <Typography variant="caption" color="textSecondary">Address</Typography>
                  <Typography variant="body1">{vendor.address}</Typography>
                </Box>
              )}
              
              {vendor.productsServices && (
                <Box>
                  <Typography variant="caption" color="textSecondary">Products/Services</Typography>
                  <Typography variant="body1">{vendor.productsServices}</Typography>
                </Box>
              )}
            </Stack>
          </Paper>
        </Grid>

        {/* Approval Status */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Approval Status
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Stack spacing={2}>
              {vendor.isApproved ? (
                <>
                  <Alert severity="success">
                    <Typography variant="body2" gutterBottom>
                      Vendor is currently approved
                    </Typography>
                    {vendor.approvalExpiryDate && (
                      <Typography variant="caption">
                        Expires: {new Date(vendor.approvalExpiryDate).toLocaleDateString()}
                      </Typography>
                    )}
                  </Alert>
                  
                  {vendor.approvalReason && (
                    <Box>
                      <Typography variant="caption" color="textSecondary">Approval Type</Typography>
                      <Typography variant="body2">
                        {vendor.approvalReason === 'auto_3quote' ? '3-Quote Process Auto-Approval' :
                         vendor.approvalReason === 'auto_completed' ? 'Completed Order Auto-Approval' :
                         'Manual Approval'}
                      </Typography>
                    </Box>
                  )}
                  
                  {vendor.associatedPONumber && (
                    <Box>
                      <Typography variant="caption" color="textSecondary">Associated PO</Typography>
                      <Typography variant="body2">{vendor.associatedPONumber}</Typography>
                    </Box>
                  )}
                  
                  {vendor.approvalNote && (
                    <Box>
                      <Typography variant="caption" color="textSecondary">Notes</Typography>
                      <Typography variant="body2">{vendor.approvalNote}</Typography>
                    </Box>
                  )}

                  {canManageVendors && (
                    <Button
                      variant="outlined"
                      color="error"
                      onClick={() => setDeApprovalDialog(true)}
                    >
                      De-Approve Vendor
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <Alert severity="warning">
                    Vendor is not currently approved
                  </Alert>
                  
                  {canManageVendors && (
                    <Button
                      variant="contained"
                      color="success"
                      onClick={() => setApprovalDialog(true)}
                    >
                      Approve Vendor
                    </Button>
                  )}
                </>
              )}

              {vendor.lastCompletedOrderDate && (
                <Box>
                  <Typography variant="caption" color="textSecondary">Last Completed Order</Typography>
                  <Typography variant="body2">
                    {new Date(vendor.lastCompletedOrderDate).toLocaleDateString()}
                  </Typography>
                </Box>
              )}

              {vendor.isHighValue && (
                <Alert severity="warning" icon={<HighValueIcon />}>
                  <Typography variant="body2">
                    High-Value Vendor: Cumulative order value exceeds threshold
                  </Typography>
                  {vendor.cumulativeOrderValue && (
                    <Typography variant="caption">
                      Total: ${vendor.cumulativeOrderValue.toLocaleString()}
                    </Typography>
                  )}
                </Alert>
              )}
            </Stack>
          </Paper>
        </Grid>

        {/* Associated PRs/POs Section */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Associated Purchase Requests/Orders
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            {associatedPRs.length > 0 ? (
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>PR/PO Number</TableCell>
                    <TableCell>Organization</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell>Created Date</TableCell>
                    <TableCell>Requestor</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {associatedPRs.map((pr) => (
                    <TableRow 
                      key={pr.id} 
                      hover 
                      sx={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/pr/${pr.id}`)}
                    >
                      <TableCell>{pr.prNumber}</TableCell>
                      <TableCell>{pr.organization}</TableCell>
                      <TableCell>{pr.description}</TableCell>
                      <TableCell>
                        <Chip label={pr.status} size="small" />
                      </TableCell>
                      <TableCell align="right">
                        {pr.currency} {pr.estimatedAmount?.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {new Date(pr.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {pr.requestor?.name || pr.requestor?.email}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Typography variant="body2" color="textSecondary">
                No associated PRs/POs found for this vendor
              </Typography>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Approve Vendor Dialog */}
      <Dialog open={approvalDialog} onClose={() => setApprovalDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Approve Vendor</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" paragraph>
            Manually approve this vendor for 12 months
          </Typography>
          
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Justification"
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            placeholder="Provide justification for manual approval..."
            helperText="Required if vendor doesn't have recent successful order history"
            sx={{ mt: 2 }}
          />

          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="caption">
              Vendor will be approved for 12 months from today. Expiry will be tracked automatically.
            </Typography>
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApprovalDialog(false)}>Cancel</Button>
          <Button onClick={handleApprove} variant="contained" color="success">
            Approve Vendor
          </Button>
        </DialogActions>
      </Dialog>

      {/* De-Approve Vendor Dialog */}
      <Dialog open={deApprovalDialog} onClose={() => setDeApprovalDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>De-Approve Vendor</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body2">
              This will remove the vendor's approved status. Justification is REQUIRED.
            </Typography>
          </Alert>
          
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Justification (Required)"
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            placeholder="E.g., Quality issues, compliance problems, better alternatives available, vendor out of business..."
            required
            sx={{ mt: 2 }}
          />

          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="caption">
              This action will be permanently recorded in the vendor's audit trail.
            </Typography>
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeApprovalDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleDeApprove} 
            variant="contained" 
            color="error"
            disabled={!justification.trim()}
          >
            De-Approve Vendor
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

