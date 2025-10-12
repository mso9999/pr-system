import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Alert,
  Stack,
  Grid,
  Paper,
  Checkbox,
  FormControlLabel,
  Divider,
  Chip,
  Radio,
  RadioGroup,
  FormControl,
  FormLabel,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { PRRequest, PRStatus, Attachment } from '@/types/pr';
import { prService } from '@/services/pr';
import { notificationService } from '@/services/notification';
import { StorageService } from '@/services/storage';
import { referenceDataService } from '@/services/referenceData';
import { referenceDataAdminService } from '@/services/referenceDataAdmin';
import { User } from '@/types/user';
import {
  CloudUpload as UploadIcon,
  Download as DownloadIcon,
  CheckCircle as CheckIcon,
  PhotoCamera as PhotoIcon,
} from '@mui/icons-material';

interface OrderedStatusActionsProps {
  pr: PRRequest;
  currentUser: User;
  onStatusChange: () => void;
}

export const OrderedStatusActions: React.FC<OrderedStatusActionsProps> = ({
  pr,
  currentUser,
  onStatusChange,
}) => {
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();
  
  // State for document uploads
  const [uploadingDeliveryNote, setUploadingDeliveryNote] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [deliveryOverride, setDeliveryOverride] = useState(pr.deliveryDocOverride || false);
  const [deliveryJustification, setDeliveryJustification] = useState(pr.deliveryDocOverrideJustification || '');
  
  // State for completion workflow
  const [completionDialog, setCompletionDialog] = useState(false);
  const [orderSatisfactory, setOrderSatisfactory] = useState<'yes' | 'no' | null>(null);
  const [issueNote, setIssueNote] = useState('');
  const [approveVendorDespiteIssues, setApproveVendorDespiteIssues] = useState(false);
  const [overrideJustification, setOverrideJustification] = useState('');

  // Permission checks
  const isProcurement = currentUser.permissionLevel === 3;
  const isFinanceAdmin = currentUser.permissionLevel === 4;
  const isAssetManagement = currentUser.department?.toLowerCase().includes('asset');
  const isAdmin = currentUser.permissionLevel === 1;
  
  // Finance can only complete below Rule 1 threshold
  const rule1Threshold = 5000; // TODO: Fetch from org config
  const financeCanComplete = isFinanceAdmin && (pr.estimatedAmount || 0) < rule1Threshold;
  
  const canTakeAction = isProcurement || isAssetManagement || financeCanComplete || isAdmin;

  if (!canTakeAction) {
    return null;
  }

  // Handle Delivery Note Upload
  const handleDeliveryNoteUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploadingDeliveryNote(true);
      const result = await StorageService.uploadToTempStorage(file);
      
      const attachment: Attachment = {
        id: crypto.randomUUID(),
        name: file.name,
        url: result.url,
        path: result.path,
        type: file.type,
        size: file.size,
        uploadedAt: new Date().toISOString(),
        uploadedBy: {
          id: currentUser.id,
          email: currentUser.email,
          name: currentUser.name || currentUser.email
        }
      };

      await prService.updatePR(pr.id, {
        deliveryNote: attachment,
        deliveryDocOverride: false, // Clear override if uploading actual document
        deliveryDocOverrideJustification: undefined,
        updatedAt: new Date().toISOString()
      });

      enqueueSnackbar('Delivery note uploaded successfully', { variant: 'success' });
      onStatusChange();
    } catch (error) {
      console.error('Error uploading delivery note:', error);
      enqueueSnackbar('Failed to upload delivery note', { variant: 'error' });
    } finally {
      setUploadingDeliveryNote(false);
    }
  };

  // Handle Delivery Photos Upload (multiple)
  const handleDeliveryPhotosUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    try {
      setUploadingPhotos(true);
      const uploadedPhotos: Attachment[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const result = await StorageService.uploadToTempStorage(file);
        
        uploadedPhotos.push({
          id: crypto.randomUUID(),
          name: file.name,
          url: result.url,
          path: result.path,
          type: file.type,
          size: file.size,
          uploadedAt: new Date().toISOString(),
          uploadedBy: {
            id: currentUser.id,
            email: currentUser.email,
            name: currentUser.name || currentUser.email
          }
        });
      }

      await prService.updatePR(pr.id, {
        deliveryPhotos: [...(pr.deliveryPhotos || []), ...uploadedPhotos],
        deliveryDocOverride: false, // Clear override if uploading actual documents
        deliveryDocOverrideJustification: undefined,
        updatedAt: new Date().toISOString()
      });

      enqueueSnackbar(`${uploadedPhotos.length} photo(s) uploaded successfully`, { variant: 'success' });
      onStatusChange();
    } catch (error) {
      console.error('Error uploading photos:', error);
      enqueueSnackbar('Failed to upload delivery photos', { variant: 'error' });
    } finally {
      setUploadingPhotos(false);
    }
  };

  // Handle Delivery Doc Override
  const handleDeliveryOverride = async () => {
    if (!deliveryJustification.trim()) {
      enqueueSnackbar('Justification required for override', { variant: 'error' });
      return;
    }

    try {
      await prService.updatePR(pr.id, {
        deliveryDocOverride: true,
        deliveryDocOverrideJustification: deliveryJustification,
        updatedAt: new Date().toISOString()
      });

      enqueueSnackbar('Delivery documentation override set successfully', { variant: 'success' });
      setDeliveryOverride(true);
      onStatusChange();
    } catch (error) {
      console.error('Error setting delivery override:', error);
      enqueueSnackbar('Failed to set delivery override', { variant: 'error' });
    }
  };

  // Move to COMPLETED with Vendor Performance Question
  const handleMoveToCompleted = async () => {
    // Validate delivery documentation
    const hasDeliveryDocs = pr.deliveryNote || (pr.deliveryPhotos && pr.deliveryPhotos.length > 0) || pr.deliveryDocOverride;
    
    if (!hasDeliveryDocs) {
      enqueueSnackbar('Delivery documentation required (upload note/photos or set override)', { variant: 'error' });
      return;
    }

    // Validate vendor performance question is answered
    if (!orderSatisfactory) {
      enqueueSnackbar('Please answer: Order closed without issues?', { variant: 'error' });
      return;
    }

    // If NO selected, require issue note
    if (orderSatisfactory === 'no' && !issueNote.trim()) {
      enqueueSnackbar('Please describe the issues encountered', { variant: 'error' });
      return;
    }

    // If NO with override, require justification
    if (orderSatisfactory === 'no' && approveVendorDespiteIssues && !overrideJustification.trim()) {
      enqueueSnackbar('Justification required to approve vendor despite issues', { variant: 'error' });
      return;
    }

    try {
      // Process vendor approval based on response
      let vendorApprovalUpdates = {};
      
      if (pr.selectedVendor) {
        const vendor = await referenceDataService.getItemsByType('vendors').then(vendors => 
          vendors.find(v => v.id === pr.selectedVendor)
        );

        if (vendor && orderSatisfactory === 'yes') {
          // Auto-approve vendor
          const was3QuoteProcess = (pr.quotes?.length || 0) >= 3;
          const approvalDuration = was3QuoteProcess ? 12 : 6; // months (should come from org config)
          
          const approvalExpiryDate = new Date();
          approvalExpiryDate.setMonth(approvalExpiryDate.getMonth() + approvalDuration);

          vendorApprovalUpdates = {
            isApproved: true,
            approvalDate: new Date().toISOString(),
            approvalExpiryDate: approvalExpiryDate.toISOString(),
            approvalReason: was3QuoteProcess ? 'auto_3quote' : 'auto_completed',
            approvedBy: currentUser.id,
            approvalNote: `Satisfactory order completion - PO ${pr.prNumber}`,
            associatedPONumber: pr.prNumber,
            lastCompletedOrderDate: new Date().toISOString()
          };

          // Update vendor in database
          await referenceDataAdminService.updateItem('vendors', pr.selectedVendor, vendorApprovalUpdates);
          
        } else if (vendor && orderSatisfactory === 'no' && approveVendorDespiteIssues) {
          // Manual approval despite issues
          const approvalExpiryDate = new Date();
          approvalExpiryDate.setMonth(approvalExpiryDate.getMonth() + 12); // Manual duration

          vendorApprovalUpdates = {
            isApproved: true,
            approvalDate: new Date().toISOString(),
            approvalExpiryDate: approvalExpiryDate.toISOString(),
            approvalReason: 'manual',
            approvedBy: currentUser.id,
            approvalNote: `Manual override despite issues: ${overrideJustification}`,
            associatedPONumber: pr.prNumber,
            lastCompletedOrderDate: new Date().toISOString()
          };

          // Update vendor in database
          await referenceDataAdminService.updateItem('vendors', pr.selectedVendor, vendorApprovalUpdates);
        }
        // If NO without override, vendor remains non-approved (no action needed)
      }

      // Update PR to COMPLETED
      await prService.updatePR(pr.id, {
        status: PRStatus.COMPLETED,
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        notes: orderSatisfactory === 'no' ? `Order issues: ${issueNote}` : pr.notes
      });

      // Send notification
      await notificationService.handleStatusChange(
        pr.id,
        pr.status,
        PRStatus.COMPLETED,
        currentUser,
        `PO ${pr.prNumber} has been completed. ${orderSatisfactory === 'yes' ? 'Order closed without issues.' : 'Issues noted.'}`
      );

      enqueueSnackbar('PO moved to COMPLETED successfully', { variant: 'success' });
      setCompletionDialog(false);
      onStatusChange();
      navigate('/dashboard');
    } catch (error) {
      console.error('Error completing PO:', error);
      enqueueSnackbar('Failed to complete PO', { variant: 'error' });
    }
  };

  return (
    <Box>
      <Paper sx={{ p: 3, mb: 3, bgcolor: 'success.50' }}>
        <Typography variant="h6" gutterBottom>
          Delivery Documentation (ORDERED Status)
        </Typography>
        <Typography variant="body2" color="textSecondary" paragraph>
          Upload delivery documentation to complete this PO
        </Typography>

        <Grid container spacing={3}>
          {/* Delivery Note Section */}
          <Grid item xs={12} md={6}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Delivery Note
              </Typography>
              
              {pr.deliveryNote ? (
                <Box>
                  <Alert severity="success" sx={{ mb: 2 }}>
                    <Typography variant="body2">
                      ✓ Uploaded: {pr.deliveryNote.name}
                    </Typography>
                    <Typography variant="caption">
                      By: {pr.deliveryNote.uploadedBy.name || pr.deliveryNote.uploadedBy.email}
                    </Typography>
                  </Alert>
                  <Button
                    variant="outlined"
                    startIcon={<DownloadIcon />}
                    href={pr.deliveryNote.url}
                    target="_blank"
                    fullWidth
                  >
                    View Document
                  </Button>
                </Box>
              ) : (
                <Stack spacing={2}>
                  <input
                    type="file"
                    id="delivery-note-upload"
                    style={{ display: 'none' }}
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleDeliveryNoteUpload}
                  />
                  <Button
                    variant="contained"
                    startIcon={<UploadIcon />}
                    onClick={() => document.getElementById('delivery-note-upload')?.click()}
                    disabled={uploadingDeliveryNote}
                  >
                    {uploadingDeliveryNote ? 'Uploading...' : 'Upload Delivery Note'}
                  </Button>
                </Stack>
              )}
            </Paper>
          </Grid>

          {/* Delivery Photos Section */}
          <Grid item xs={12} md={6}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Delivery Photos {pr.deliveryPhotos && pr.deliveryPhotos.length > 0 && (
                  <Chip label={`${pr.deliveryPhotos.length} photo(s)`} size="small" color="primary" />
                )}
              </Typography>
              
              {pr.deliveryPhotos && pr.deliveryPhotos.length > 0 ? (
                <Box>
                  <Alert severity="success" sx={{ mb: 2 }}>
                    <Typography variant="body2">
                      ✓ {pr.deliveryPhotos.length} photo(s) uploaded
                    </Typography>
                  </Alert>
                  <Stack spacing={1}>
                    {pr.deliveryPhotos.map((photo, index) => (
                      <Button
                        key={index}
                        variant="outlined"
                        size="small"
                        startIcon={<PhotoIcon />}
                        href={photo.url}
                        target="_blank"
                      >
                        Photo {index + 1}: {photo.name}
                      </Button>
                    ))}
                  </Stack>
                </Box>
              ) : (
                <Stack spacing={2}>
                  <input
                    type="file"
                    id="delivery-photos-upload"
                    style={{ display: 'none' }}
                    accept="image/*"
                    multiple
                    onChange={handleDeliveryPhotosUpload}
                  />
                  <Button
                    variant="contained"
                    startIcon={<PhotoIcon />}
                    onClick={() => document.getElementById('delivery-photos-upload')?.click()}
                    disabled={uploadingPhotos}
                  >
                    {uploadingPhotos ? 'Uploading...' : 'Upload Delivery Photos'}
                  </Button>
                  <Typography variant="caption" color="textSecondary">
                    Select multiple photos at once
                  </Typography>
                </Stack>
              )}
            </Paper>
          </Grid>

          {/* Delivery Documentation Override */}
          {!pr.deliveryNote && (!pr.deliveryPhotos || pr.deliveryPhotos.length === 0) && !pr.deliveryDocOverride && (
            <Grid item xs={12}>
              <Paper variant="outlined" sx={{ p: 2, bgcolor: 'warning.50' }}>
                <Typography variant="subtitle1" gutterBottom>
                  Override Delivery Documentation
                </Typography>
                <Typography variant="body2" color="textSecondary" paragraph>
                  Use override if vendor didn't provide documentation or items too large to photograph
                </Typography>
                <Stack spacing={2}>
                  <TextField
                    fullWidth
                    label="Override Justification"
                    multiline
                    rows={2}
                    value={deliveryJustification}
                    onChange={(e) => setDeliveryJustification(e.target.value)}
                    placeholder="E.g., Vendor didn't provide delivery note, emergency delivery, hand-delivered items"
                    helperText="Required if setting override"
                  />
                  <Button
                    variant="outlined"
                    onClick={handleDeliveryOverride}
                    disabled={!deliveryJustification.trim()}
                  >
                    Set Override
                  </Button>
                </Stack>
              </Paper>
            </Grid>
          )}

          {pr.deliveryDocOverride && (
            <Grid item xs={12}>
              <Alert severity="warning">
                <Typography variant="body2" gutterBottom>
                  Delivery Documentation Override Set
                </Typography>
                <Typography variant="caption">
                  Justification: {pr.deliveryDocOverrideJustification}
                </Typography>
              </Alert>
            </Grid>
          )}

          {/* Move to COMPLETED Action */}
          <Grid item xs={12}>
            <Button
              variant="contained"
              color="success"
              size="large"
              fullWidth
              startIcon={<CheckIcon />}
              onClick={() => setCompletionDialog(true)}
            >
              Move to COMPLETED Status
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Move to COMPLETED with Vendor Performance Question */}
      <Dialog 
        open={completionDialog} 
        onClose={() => setCompletionDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Complete Purchase Order</DialogTitle>
        <DialogContent>
          {/* Validation Check Display */}
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Delivery Documentation Status:
            </Typography>
            {pr.deliveryNote && (
              <Typography variant="body2">✓ Delivery Note: {pr.deliveryNote.name}</Typography>
            )}
            {pr.deliveryPhotos && pr.deliveryPhotos.length > 0 && (
              <Typography variant="body2">✓ Photos: {pr.deliveryPhotos.length} uploaded</Typography>
            )}
            {pr.deliveryDocOverride && (
              <Typography variant="body2">✓ Override: {pr.deliveryDocOverrideJustification}</Typography>
            )}
            {!pr.deliveryNote && (!pr.deliveryPhotos || pr.deliveryPhotos.length === 0) && !pr.deliveryDocOverride && (
              <Typography variant="body2" color="error">❌ No delivery documentation provided</Typography>
            )}
          </Alert>

          <Divider sx={{ mb: 3 }} />

          {/* Vendor Performance Question */}
          <FormControl component="fieldset" fullWidth>
            <FormLabel component="legend">
              <Typography variant="h6" gutterBottom>
                Vendor Performance Question *
              </Typography>
            </FormLabel>
            <Typography variant="body2" color="textSecondary" paragraph>
              This helps manage vendor approval status automatically
            </Typography>
            
            <RadioGroup
              value={orderSatisfactory}
              onChange={(e) => {
                setOrderSatisfactory(e.target.value as 'yes' | 'no');
                // Reset dependent fields
                if (e.target.value === 'yes') {
                  setIssueNote('');
                  setApproveVendorDespiteIssues(false);
                  setOverrideJustification('');
                }
              }}
            >
              <FormControlLabel
                value="yes"
                control={<Radio />}
                label={
                  <Box>
                    <Typography variant="body1">YES - Order closed without issues</Typography>
                    <Typography variant="caption" color="textSecondary">
                      Vendor will be automatically approved for future orders
                    </Typography>
                  </Box>
                }
              />
              <FormControlLabel
                value="no"
                control={<Radio />}
                label={
                  <Box>
                    <Typography variant="body1">NO - Issues encountered during this order</Typography>
                    <Typography variant="caption" color="textSecondary">
                      Vendor will remain non-approved unless you override
                    </Typography>
                  </Box>
                }
              />
            </RadioGroup>
          </FormControl>

          {/* Issue Note (if NO selected) */}
          {orderSatisfactory === 'no' && (
            <Box sx={{ mt: 3, p: 2, bgcolor: 'error.50', borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom color="error">
                Describe Issues Encountered *
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={3}
                value={issueNote}
                onChange={(e) => setIssueNote(e.target.value)}
                placeholder="Describe quality issues, delivery problems, or other concerns..."
                sx={{ mb: 2, bgcolor: 'white' }}
              />

              <FormControlLabel
                control={
                  <Checkbox
                    checked={approveVendorDespiteIssues}
                    onChange={(e) => setApproveVendorDespiteIssues(e.target.checked)}
                  />
                }
                label="Approve vendor despite issues (requires justification)"
              />

              {approveVendorDespiteIssues && (
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  label="Override Justification *"
                  value={overrideJustification}
                  onChange={(e) => setOverrideJustification(e.target.value)}
                  placeholder="Explain why vendor should be approved despite the issues..."
                  sx={{ mt: 2, bgcolor: 'white' }}
                />
              )}
            </Box>
          )}

          {/* Vendor Approval Preview */}
          {orderSatisfactory && (
            <Alert severity={orderSatisfactory === 'yes' ? 'success' : 'warning'} sx={{ mt: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Vendor Approval Action:
              </Typography>
              {orderSatisfactory === 'yes' && (
                <Typography variant="body2">
                  ✓ Vendor will be auto-approved for {(pr.quotes?.length || 0) >= 3 ? '12' : '6'} months
                </Typography>
              )}
              {orderSatisfactory === 'no' && !approveVendorDespiteIssues && (
                <Typography variant="body2">
                  Vendor will remain non-approved. Issue will be logged.
                </Typography>
              )}
              {orderSatisfactory === 'no' && approveVendorDespiteIssues && (
                <Typography variant="body2">
                  Vendor will be manually approved for 12 months with override justification.
                </Typography>
              )}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCompletionDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleMoveToCompleted} 
            variant="contained" 
            color="success"
            disabled={!orderSatisfactory}
          >
            Complete PO
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

