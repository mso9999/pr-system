import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
import { organizationService } from '@/services/organizationService';
import { User } from '@/types/user';
import {
  CloudUpload as UploadIcon,
  Download as DownloadIcon,
  CheckCircle as CheckIcon,
  PhotoCamera as PhotoIcon,
} from '@mui/icons-material';
import { FileUploadManager } from '@/components/common/FileUploadManager';
import { QuoteList } from './QuoteList';

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
  const { t } = useTranslation();
  
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
  
  // State for file preview
  const [previewFile, setPreviewFile] = useState<{ name: string; url: string } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

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

  // Helper: Normalize attachments to array (for backward compatibility)
  const normalizeAttachments = (attachments?: Attachment | Attachment[]): Attachment[] => {
    if (!attachments) return [];
    return Array.isArray(attachments) ? attachments : [attachments];
  };

  // Handle Delivery Note Upload (multiple files)
  const handleDeliveryNoteUpload = async (files: File[]) => {
    if (files.length === 0) return;

    try {
      setUploadingDeliveryNote(true);
      
      // Upload all files
      const uploadPromises = files.map(async (file) => {
        const result = await StorageService.uploadToTempStorage(file);
        return {
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
        } as Attachment;
      });

      const newAttachments = await Promise.all(uploadPromises);
      
      // Get existing attachments and merge
      const existingAttachments = normalizeAttachments(pr.deliveryNote);
      const allAttachments = [...existingAttachments, ...newAttachments];

      await prService.updatePR(pr.id, {
        deliveryNote: allAttachments,
        deliveryDocOverride: false, // Clear override if uploading actual document
        deliveryDocOverrideJustification: undefined,
        updatedAt: new Date().toISOString()
      });

      enqueueSnackbar(`${files.length} delivery note(s) uploaded successfully`, { variant: 'success' });
      onStatusChange();
    } catch (error) {
      console.error('Error uploading delivery note:', error);
      enqueueSnackbar('Failed to upload delivery note(s)', { variant: 'error' });
    } finally {
      setUploadingDeliveryNote(false);
    }
  };

  // Handle Delivery Note Delete
  const handleDeliveryNoteDelete = async (attachmentId: string) => {
    try {
      const existingAttachments = normalizeAttachments(pr.deliveryNote);
      const updatedAttachments = existingAttachments.filter(att => att.id !== attachmentId);

      await prService.updatePR(pr.id, {
        deliveryNote: updatedAttachments.length > 0 ? updatedAttachments : [],
        updatedAt: new Date().toISOString()
      });

      enqueueSnackbar('Delivery note deleted successfully', { variant: 'success' });
      onStatusChange();
    } catch (error) {
      console.error('Error deleting delivery note:', error);
      enqueueSnackbar('Failed to delete delivery note', { variant: 'error' });
      throw error;
    }
  };

  // Handle Delivery Photos Upload (multiple)
  const handleDeliveryPhotosUpload = async (files: File[]) => {
    if (files.length === 0) return;

    try {
      setUploadingPhotos(true);
      
      // Upload all files in parallel
      const uploadPromises = files.map(async (file) => {
        const result = await StorageService.uploadToTempStorage(file);
        return {
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
        } as Attachment;
      });

      const newPhotos = await Promise.all(uploadPromises);

      await prService.updatePR(pr.id, {
        deliveryPhotos: [...(pr.deliveryPhotos || []), ...newPhotos],
        deliveryDocOverride: false, // Clear override if uploading actual documents
        deliveryDocOverrideJustification: undefined,
        updatedAt: new Date().toISOString()
      });

      enqueueSnackbar(`${files.length} photo(s) uploaded successfully`, { variant: 'success' });
      onStatusChange();
    } catch (error) {
      console.error('Error uploading photos:', error);
      enqueueSnackbar('Failed to upload delivery photos', { variant: 'error' });
    } finally {
      setUploadingPhotos(false);
    }
  };

  // Handle Delivery Photo Delete
  const handleDeliveryPhotoDelete = async (attachmentId: string) => {
    try {
      const updatedPhotos = (pr.deliveryPhotos || []).filter(photo => photo.id !== attachmentId);

      await prService.updatePR(pr.id, {
        deliveryPhotos: updatedPhotos.length > 0 ? updatedPhotos : [],
        updatedAt: new Date().toISOString()
      });

      enqueueSnackbar('Delivery photo deleted successfully', { variant: 'success' });
      onStatusChange();
    } catch (error) {
      console.error('Error deleting delivery photo:', error);
      enqueueSnackbar('Failed to delete delivery photo', { variant: 'error' });
      throw error;
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

  // File preview handler
  const handleFilePreview = (attachment: { name: string; url: string }) => {
    setPreviewFile(attachment);
    setPreviewOpen(true);
  };

  // Download handler
  const handleDownloadQuoteAttachment = (attachment: { name: string; url: string }) => {
    const link = document.createElement('a');
    link.href = attachment.url;
    link.download = attachment.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    enqueueSnackbar('Downloading file...', { variant: 'info' });
  };

  // Move to COMPLETED with Vendor Performance Question
  const handleMoveToCompleted = async () => {
    // Validate delivery documentation
    const hasDeliveryNote = normalizeAttachments(pr.deliveryNote).length > 0;
    const hasDeliveryPhotos = (pr.deliveryPhotos && pr.deliveryPhotos.length > 0);
    const hasDeliveryDocs = hasDeliveryNote || hasDeliveryPhotos || pr.deliveryDocOverride;
    
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
      // Fetch organization config for vendor approval durations
      const orgId = pr.organization || currentUser.organization || '';
      const orgConfig = await organizationService.getOrganizationById(orgId);
      const vendor3QuoteDuration = orgConfig?.vendorApproval3QuoteDuration || 12;
      const vendorCompletedDuration = orgConfig?.vendorApprovalCompletedDuration || 6;
      const vendorManualDuration = orgConfig?.vendorApprovalManualDuration || 12;

      // Process vendor approval based on response
      let vendorApprovalUpdates = {};
      
      // Use selectedVendor if available, otherwise fall back to preferredVendor
      const vendorId = pr.selectedVendor || pr.preferredVendor;
      
      if (vendorId) {
        const vendor = await referenceDataService.getItemsByType('vendors').then(vendors => 
          vendors.find(v => v.id === vendorId)
        );

        if (vendor && orderSatisfactory === 'yes') {
          // Auto-approve vendor on successful order completion
          const was3QuoteProcess = (pr.quotes?.length || 0) >= 3;
          const approvalDuration = was3QuoteProcess ? vendor3QuoteDuration : vendorCompletedDuration;
          
          const approvalExpiryDate = new Date();
          approvalExpiryDate.setMonth(approvalExpiryDate.getMonth() + approvalDuration);

          vendorApprovalUpdates = {
            isApproved: true,
            procurementApproved: true,
            financeApproved: true,
            procurementApprovalDate: new Date().toISOString(),
            financeApprovalDate: new Date().toISOString(),
            approvalDate: new Date().toISOString(),
            approvalExpiryDate: approvalExpiryDate.toISOString(),
            approvalReason: was3QuoteProcess ? 'auto_3quote' : 'auto_completed',
            approvedBy: currentUser.id,
            procurementApprovedBy: currentUser.id,
            financeApprovedBy: currentUser.id,
            approvalNote: `Satisfactory order completion - PO ${pr.prNumber}`,
            procurementApprovalNote: `Auto-approved via successful order completion - PO ${pr.prNumber}`,
            financeApprovalNote: `Auto-approved via successful order completion - PO ${pr.prNumber}`,
            associatedPONumber: pr.prNumber,
            lastCompletedOrderDate: new Date().toISOString()
          };

          console.log(`Auto-approving vendor ${vendor.name} for ${approvalDuration} months (${was3QuoteProcess ? '3-quote process' : 'completed order'})`);
          
          // Update vendor in database
          await referenceDataAdminService.updateItem('vendors', vendorId, vendorApprovalUpdates);
          
          enqueueSnackbar(`Vendor "${vendor.name}" automatically approved for ${approvalDuration} months`, { variant: 'success' });
          
        } else if (vendor && orderSatisfactory === 'no' && approveVendorDespiteIssues) {
          // Manual approval despite issues
          const approvalExpiryDate = new Date();
          approvalExpiryDate.setMonth(approvalExpiryDate.getMonth() + vendorManualDuration);

          vendorApprovalUpdates = {
            isApproved: true,
            procurementApproved: true,
            financeApproved: true,
            procurementApprovalDate: new Date().toISOString(),
            financeApprovalDate: new Date().toISOString(),
            approvalDate: new Date().toISOString(),
            approvalExpiryDate: approvalExpiryDate.toISOString(),
            approvalReason: 'manual',
            approvedBy: currentUser.id,
            procurementApprovedBy: currentUser.id,
            financeApprovedBy: currentUser.id,
            approvalNote: `Manual override despite issues: ${overrideJustification}`,
            procurementApprovalNote: `Manual override despite issues: ${overrideJustification}`,
            financeApprovalNote: `Manual override despite issues: ${overrideJustification}`,
            associatedPONumber: pr.prNumber,
            lastCompletedOrderDate: new Date().toISOString()
          };

          console.log(`Manually approving vendor ${vendor.name} for ${vendorManualDuration} months despite issues`);
          
          // Update vendor in database
          await referenceDataAdminService.updateItem('vendors', vendorId, vendorApprovalUpdates);
          
          enqueueSnackbar(`Vendor "${vendor.name}" manually approved for ${vendorManualDuration} months`, { variant: 'info' });
        }
        // If NO without override, vendor remains non-approved (no action needed)
      }

      // Update PR to COMPLETED
      // FIRST: Update status using updatePRStatus (handles status history properly)
      const statusNotes = orderSatisfactory === 'yes' 
        ? 'Order completed successfully' 
        : `Order issues: ${issueNote}`;
      
      await prService.updatePRStatus(
        pr.id,
        PRStatus.COMPLETED,
        statusNotes,
        {
          id: currentUser.id,
          email: currentUser.email,
          name: currentUser.name || currentUser.email
        }
      );

      // SECOND: Update additional fields like completedAt
      await prService.updatePR(pr.id, {
        completedAt: new Date().toISOString(),
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
      {/* Previous Status Documents - Read Only */}
      <Paper sx={{ p: 3, mb: 3, bgcolor: 'info.50' }}>
        <Typography variant="h6" gutterBottom>
          📋 {t('pr.previousDocuments')}
        </Typography>
        <Typography variant="body2" color="textSecondary" paragraph>
          {t('pr.previousDocumentsDesc')}
        </Typography>

        <Grid container spacing={2}>
          {/* Proforma Invoice */}
          <Grid item xs={12} md={4}>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
              {t('pr.proformaInvoice')}
            </Typography>
            <FileUploadManager
              label={t('pr.proformaInvoice')}
              files={normalizeAttachments(pr.proformaInvoice)}
              onUpload={async () => {}}
              onDelete={async () => {}}
              readOnly={true}
              maxFiles={10}
            />
          </Grid>

          {/* Proof of Payment */}
          <Grid item xs={12} md={4}>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
              {t('pr.proofOfPayment')}
            </Typography>
            <FileUploadManager
              label={t('pr.proofOfPayment')}
              files={normalizeAttachments(pr.proofOfPayment)}
              onUpload={async () => {}}
              onDelete={async () => {}}
              readOnly={true}
              maxFiles={10}
            />
          </Grid>

          {/* PO Document */}
          <Grid item xs={12} md={4}>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
              {t('pr.poDocument')}
            </Typography>
            <FileUploadManager
              label={t('pr.poDocument')}
              files={normalizeAttachments(pr.poDocument)}
              onUpload={async () => {}}
              onDelete={async () => {}}
              readOnly={true}
              maxFiles={1}
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Quotes Section - Read Only */}
      {pr.quotes && pr.quotes.length > 0 && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            💰 {t('pr.quotes')}
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
            {t('pr.quotesFromPreApprovedStages')}
          </Typography>
          <QuoteList
            quotes={pr.quotes}
            onEdit={() => {}} // Read-only, no edit
            onDelete={() => {}} // Read-only, no delete
            handleFilePreview={handleFilePreview}
            handleDownloadQuoteAttachment={handleDownloadQuoteAttachment}
            isEditing={false}
          />
        </Paper>
      )}

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
              
              <FileUploadManager
                label="Delivery Note"
                files={normalizeAttachments(pr.deliveryNote)}
                onUpload={handleDeliveryNoteUpload}
                onDelete={handleDeliveryNoteDelete}
                uploading={uploadingDeliveryNote}
                accept=".pdf,.jpg,.jpeg,.png"
                helperText="PDF, JPG, or PNG files (multiple files allowed)"
                multiple
              />
            </Paper>
          </Grid>

          {/* Delivery Photos Section */}
          <Grid item xs={12} md={6}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Delivery Photos
              </Typography>
              
              <FileUploadManager
                label="Delivery Photos"
                files={pr.deliveryPhotos || []}
                onUpload={handleDeliveryPhotosUpload}
                onDelete={handleDeliveryPhotoDelete}
                uploading={uploadingPhotos}
                accept="image/*"
                helperText="Image files (multiple photos allowed)"
                multiple
              />
            </Paper>
          </Grid>

          {/* Delivery Documentation Override */}
          {normalizeAttachments(pr.deliveryNote).length === 0 && (!pr.deliveryPhotos || pr.deliveryPhotos.length === 0) && !pr.deliveryDocOverride && (
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
              {t('pr.moveToCompleted')} Status
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
        <DialogTitle>{t('pr.completePO')}</DialogTitle>
        <DialogContent>
          {/* Validation Check Display */}
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              {t('pr.deliveryDocStatus')}
            </Typography>
            {normalizeAttachments(pr.deliveryNote).length > 0 && (
              <Typography variant="body2">✓ Delivery Note: {normalizeAttachments(pr.deliveryNote).length} file(s)</Typography>
            )}
            {pr.deliveryPhotos && pr.deliveryPhotos.length > 0 && (
              <Typography variant="body2">✓ Photos: {pr.deliveryPhotos.length} uploaded</Typography>
            )}
            {pr.deliveryDocOverride && (
              <Typography variant="body2">✓ Override: {pr.deliveryDocOverrideJustification}</Typography>
            )}
            {normalizeAttachments(pr.deliveryNote).length === 0 && (!pr.deliveryPhotos || pr.deliveryPhotos.length === 0) && !pr.deliveryDocOverride && (
              <Typography variant="body2" color="error">❌ No delivery documentation provided</Typography>
            )}
          </Alert>

          <Divider sx={{ mb: 3 }} />

          {/* Vendor Performance Question */}
          <FormControl component="fieldset" fullWidth>
            <FormLabel component="legend">
              <Typography variant="h6" gutterBottom>
                {t('pr.vendorPerformanceQuestion')} *
              </Typography>
            </FormLabel>
            <Typography variant="body2" color="textSecondary" paragraph>
              {t('pr.vendorPerformanceRequired')}
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
                    <Typography variant="body1">{t('pr.orderClosedWithoutIssues')}</Typography>
                    <Typography variant="caption" color="textSecondary">
                      {t('pr.vendorAutoApprovedDesc')}
                    </Typography>
                  </Box>
                }
              />
              <FormControlLabel
                value="no"
                control={<Radio />}
                label={
                  <Box>
                    <Typography variant="body1">{t('pr.issuesEncountered')}</Typography>
                    <Typography variant="caption" color="textSecondary">
                      {t('pr.vendorRemainNonApproved')}
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
                {t('pr.describeIssues')} *
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={3}
                value={issueNote}
                onChange={(e) => setIssueNote(e.target.value)}
                placeholder={t('pr.describeIssuesPlaceholder')}
                sx={{ mb: 2, bgcolor: 'white' }}
              />

              <FormControlLabel
                control={
                  <Checkbox
                    checked={approveVendorDespiteIssues}
                    onChange={(e) => setApproveVendorDespiteIssues(e.target.checked)}
                  />
                }
                label={t('pr.approveVendorDespiteIssues')}
              />

              {approveVendorDespiteIssues && (
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  label={`${t('pr.overrideJustificationRequired')} *`}
                  value={overrideJustification}
                  onChange={(e) => setOverrideJustification(e.target.value)}
                  placeholder={t('pr.overrideJustificationPlaceholder')}
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
          <Button onClick={() => setCompletionDialog(false)}>{t('common.cancel')}</Button>
          <Button 
            onClick={handleMoveToCompleted} 
            variant="contained" 
            color="success"
            disabled={!orderSatisfactory}
          >
            {t('pr.confirmCompletion')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* File Preview Dialog */}
      <Dialog 
        open={previewOpen} 
        onClose={() => setPreviewOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>{previewFile?.name}</DialogTitle>
        <DialogContent>
          {previewFile && (
            previewFile.url.toLowerCase().endsWith('.pdf') ? (
              <embed src={previewFile.url} type="application/pdf" width="100%" height="600px" />
            ) : (
              <img src={previewFile.url} alt={previewFile.name} style={{ width: '100%', height: 'auto' }} />
            )
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewOpen(false)}>{t('common.close')}</Button>
          <Button 
            variant="contained" 
            startIcon={<DownloadIcon />}
            onClick={() => previewFile && handleDownloadQuoteAttachment(previewFile)}
          >
            {t('common.download')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

