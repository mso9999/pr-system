import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Checkbox,
  FormControlLabel,
  TextField,
  Button,
  Alert,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Chip,
  Stack,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { 
  CheckCircle as CheckCircleIcon, 
  Warning as WarningIcon,
  CloudUpload as UploadIcon,
  AttachFile as AttachFileIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { PRRequest, PRStatus, Attachment } from '@/types/pr';
import { User } from '@/types/user';
import { prService } from '@/services/pr';
import { notificationService } from '@/services/notification';
import { StorageService } from '@/services/storage';

interface ExternalApprovalBypassProps {
  pr: PRRequest;
  currentUser: User;
  onStatusChange: () => void;
}

export const ExternalApprovalBypass: React.FC<ExternalApprovalBypassProps> = ({
  pr,
  currentUser,
  onStatusChange,
}) => {
  const [bypassEnabled, setBypassEnabled] = useState(false);
  const [justification, setJustification] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [uploadedDocument, setUploadedDocument] = useState<Attachment | null>(null);
  const { enqueueSnackbar } = useSnackbar();

  // Only Finance Admin (level 4) and Superuser (level 1) can use this feature
  const canBypassApproval = currentUser.permissionLevel === 1 || currentUser.permissionLevel === 4;

  // Only show in PENDING_APPROVAL status
  if (pr.status !== PRStatus.PENDING_APPROVAL || !canBypassApproval) {
    return null;
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'image/jpeg',
      'image/png',
    ];

    if (!allowedTypes.includes(file.type)) {
      enqueueSnackbar('Please upload a PDF, Word, Excel, or image file', { variant: 'error' });
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      enqueueSnackbar('File size must be less than 10MB', { variant: 'error' });
      return;
    }

    try {
      setUploadingDocument(true);
      
      // Upload to temporary storage first
      const tempPath = await StorageService.uploadToTempStorage(file, 'external-approval-docs');
      
      // Create attachment object
      const attachment: Attachment = {
        id: crypto.randomUUID(),
        name: file.name,
        url: tempPath,
        path: tempPath,
        size: file.size,
        type: file.type,
        uploadedAt: new Date().toISOString(),
        uploadedBy: currentUser.id,
      };

      setUploadedDocument(attachment);
      enqueueSnackbar('Approved budget document uploaded successfully', { variant: 'success' });
    } catch (error) {
      console.error('Error uploading document:', error);
      enqueueSnackbar('Failed to upload document', { variant: 'error' });
    } finally {
      setUploadingDocument(false);
      // Reset file input
      event.target.value = '';
    }
  };

  const handleRemoveDocument = async () => {
    if (!uploadedDocument) return;

    try {
      // Delete from storage
      await StorageService.deleteFile(uploadedDocument.path);
      setUploadedDocument(null);
      enqueueSnackbar('Document removed', { variant: 'info' });
    } catch (error) {
      console.error('Error removing document:', error);
      enqueueSnackbar('Failed to remove document', { variant: 'error' });
    }
  };

  const handleBypassClick = () => {
    if (!bypassEnabled) {
      enqueueSnackbar('Please enable the bypass checkbox first', { variant: 'warning' });
      return;
    }

    // Either document upload OR justification is required
    const hasDocument = !!uploadedDocument;
    const hasJustification = justification.trim().length >= 20;

    if (!hasDocument && !hasJustification) {
      enqueueSnackbar(
        'Please either upload the approved budget document OR provide a detailed justification (min 20 characters)',
        { variant: 'error' }
      );
      return;
    }

    // Open confirmation dialog
    setConfirmDialogOpen(true);
  };

  const handleConfirmBypass = async () => {
    try {
      setLoading(true);
      setConfirmDialogOpen(false);

      // Move uploaded document to permanent storage if present
      let permanentDocument = uploadedDocument;
      if (uploadedDocument) {
        try {
          const permanentPath = await StorageService.moveToPermanentStorage(
            uploadedDocument.path,
            `prs/${pr.id}/external-approval/${uploadedDocument.name}`
          );
          permanentDocument = {
            ...uploadedDocument,
            path: permanentPath,
            url: permanentPath,
          };
        } catch (error) {
          console.error('Error moving document to permanent storage:', error);
          // Continue anyway, document is still accessible in temp storage
        }
      }

      const bypassNote = uploadedDocument 
        ? `External Approval Bypass (Document: ${uploadedDocument.name})${justification.trim() ? `: ${justification.trim()}` : ''}`
        : `External Approval Bypass: ${justification.trim()}`;

      // Update PR with external approval bypass information and change status to APPROVED
      await prService.updatePR(pr.id, {
        status: PRStatus.APPROVED,
        externalApprovalBypass: true,
        externalApprovalJustification: justification.trim() || `Approved budget document uploaded: ${uploadedDocument?.name}`,
        externalApprovalBy: currentUser.id,
        externalApprovalDate: new Date().toISOString(),
        externalApprovalDocument: permanentDocument || undefined,
        // Update approval workflow to mark as externally approved
        approvalWorkflow: {
          ...pr.approvalWorkflow,
          firstApprovalComplete: true,
          secondApprovalComplete: pr.requiresDualApproval ? true : pr.approvalWorkflow?.secondApprovalComplete,
          firstApproverJustification: bypassNote,
          secondApproverJustification: pr.requiresDualApproval 
            ? bypassNote
            : pr.approvalWorkflow?.secondApproverJustification,
          approvalHistory: [
            ...(pr.approvalWorkflow?.approvalHistory || []),
            {
              approverId: currentUser.id,
              timestamp: new Date().toISOString(),
              approved: true,
              notes: `${bypassNote} by ${currentUser.firstName} ${currentUser.lastName}`,
            },
          ],
        },
      });

      // Send notification about the status change
      const notificationNote = uploadedDocument
        ? `External approval bypass with budget document: ${uploadedDocument.name}${justification.trim() ? ` - ${justification.trim()}` : ''}`
        : `External approval bypass: ${justification.trim()}`;

      await notificationService.sendStatusChangeNotification(
        pr.id,
        pr.prNumber,
        PRStatus.PENDING_APPROVAL,
        PRStatus.APPROVED,
        currentUser,
        notificationNote
      );

      enqueueSnackbar('PR approved via external approval bypass', { variant: 'success' });
      onStatusChange();
    } catch (error) {
      console.error('Error processing external approval bypass:', error);
      enqueueSnackbar(
        `Failed to process external approval bypass: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { variant: 'error' }
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Paper 
        sx={{ 
          p: 3, 
          mb: 3, 
          border: '2px solid',
          borderColor: bypassEnabled ? 'warning.main' : 'divider',
          bgcolor: bypassEnabled ? 'warning.50' : 'background.paper'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <WarningIcon sx={{ mr: 1, color: 'warning.main' }} />
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            External Approval Bypass
          </Typography>
        </Box>

        <Divider sx={{ mb: 2 }} />

        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>Use this feature when:</strong> Approval has already been obtained externally 
            (e.g., bulk budget approval, board meeting, executive directive). This will skip the 
            normal approver endorsement process and move the PR directly to APPROVED status.
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            <strong>Requirements:</strong> Upload the approved budget document OR provide detailed justification (minimum 20 characters).
          </Typography>
        </Alert>

        <FormControlLabel
          control={
            <Checkbox
              checked={bypassEnabled}
              onChange={(e) => setBypassEnabled(e.target.checked)}
              color="warning"
            />
          }
          label={
            <Typography variant="body1" sx={{ fontWeight: bypassEnabled ? 'bold' : 'normal' }}>
              Enable External Approval Bypass
            </Typography>
          }
          sx={{ mb: 2 }}
        />

        {bypassEnabled && (
          <>
            {/* File Upload Section */}
            <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
                Option 1: Upload Approved Budget Document
              </Typography>
              
              {!uploadedDocument ? (
                <Box>
                  <Button
                    variant="outlined"
                    component="label"
                    startIcon={<UploadIcon />}
                    disabled={uploadingDocument}
                    sx={{ mb: 1 }}
                  >
                    {uploadingDocument ? 'Uploading...' : 'Upload Budget Document'}
                    <input
                      type="file"
                      hidden
                      accept=".pdf,.doc,.docx,.xls,.xlsx,image/*"
                      onChange={handleFileUpload}
                    />
                  </Button>
                  <Typography variant="caption" display="block" color="text.secondary">
                    Accepted: PDF, Word, Excel, or Image files (max 10MB)
                  </Typography>
                </Box>
              ) : (
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip
                    icon={<AttachFileIcon />}
                    label={uploadedDocument.name}
                    color="success"
                    onDelete={handleRemoveDocument}
                    deleteIcon={<DeleteIcon />}
                  />
                  <Typography variant="caption" color="text.secondary">
                    ({(uploadedDocument.size / 1024).toFixed(1)} KB)
                  </Typography>
                </Stack>
              )}
            </Paper>

            {/* Justification Section */}
            <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
                {uploadedDocument ? 'Option 2: Additional Context (Optional)' : 'Option 2: Provide Justification (Required if no document)'}
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={4}
                label={uploadedDocument ? "Additional Notes (Optional)" : "Justification (Required)"}
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Explain where and how the approval was obtained (e.g., 'Approved in FY2025 Budget Board Meeting on 2025-01-15, minute #7.3')"
                required={!uploadedDocument}
                error={!uploadedDocument && bypassEnabled && justification.trim().length > 0 && justification.trim().length < 20}
                helperText={
                  uploadedDocument
                    ? 'Optional: Add context about the approval process'
                    : (bypassEnabled && justification.trim().length > 0 && justification.trim().length < 20
                      ? 'Please provide more detail (minimum 20 characters)'
                      : 'Required if no document uploaded (minimum 20 characters)')
                }
              />
            </Paper>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="contained"
                color="warning"
                startIcon={<CheckCircleIcon />}
                onClick={handleBypassClick}
                disabled={
                  loading || 
                  (!uploadedDocument && (!justification.trim() || justification.trim().length < 20))
                }
              >
                {loading ? 'Processing...' : 'Approve via External Bypass'}
              </Button>

              <Button
                variant="outlined"
                onClick={() => {
                  setBypassEnabled(false);
                  setJustification('');
                  if (uploadedDocument) {
                    handleRemoveDocument();
                  }
                }}
                disabled={loading}
              >
                Cancel
              </Button>
            </Box>
          </>
        )}

        {!bypassEnabled && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            ✓ Available to Finance Admin and Superusers only
          </Typography>
        )}
      </Paper>

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialogOpen}
        onClose={() => !loading && setConfirmDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <WarningIcon sx={{ mr: 1, color: 'warning.main' }} />
            Confirm External Approval Bypass
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
              This action will:
            </Typography>
            <Typography variant="body2" component="ul" sx={{ pl: 2 }}>
              <li>Skip the normal approver endorsement process</li>
              <li>Mark the PR as APPROVED immediately</li>
              <li>Record your justification in the PR history</li>
              <li>Send notifications to relevant stakeholders</li>
            </Typography>
          </Alert>

          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>PR Number:</strong> {pr.prNumber}
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>Description:</strong> {pr.description}
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>Amount:</strong> {pr.currency} {pr.estimatedAmount?.toLocaleString()}
          </Typography>
          
          {uploadedDocument && (
            <>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>Approved Budget Document:</strong>
              </Typography>
              <Chip
                icon={<AttachFileIcon />}
                label={uploadedDocument.name}
                color="success"
                sx={{ mb: 2 }}
              />
            </>
          )}
          
          {justification.trim() && (
            <>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>{uploadedDocument ? 'Additional Notes:' : 'Justification:'}</strong>
              </Typography>
              <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50', mb: 1 }}>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {justification}
                </Typography>
              </Paper>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialogOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirmBypass}
            variant="contained"
            color="warning"
            disabled={loading}
            autoFocus
          >
            {loading ? 'Processing...' : 'Confirm Bypass'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

