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
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { PRRequest, PRStatus, Attachment } from '@/types/pr';
import { prService } from '@/services/pr';
import { notificationService } from '@/services/notification';
import { StorageService } from '@/services/storage';
import { User } from '@/types/user';
import {
  CloudUpload as UploadIcon,
  Download as DownloadIcon,
  Send as SendIcon,
  CheckCircle as CheckIcon,
} from '@mui/icons-material';

interface ApprovedStatusActionsProps {
  pr: PRRequest;
  currentUser: User;
  onStatusChange: () => void;
}

export const ApprovedStatusActions: React.FC<ApprovedStatusActionsProps> = ({
  pr,
  currentUser,
  onStatusChange,
}) => {
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();
  
  // State for document uploads
  const [uploadingProforma, setUploadingProforma] = useState(false);
  const [uploadingPoP, setUploadingPoP] = useState(false);
  const [proformaOverride, setProformaOverride] = useState(pr.proformaOverride || false);
  const [proformaJustification, setProformaJustification] = useState(pr.proformaOverrideJustification || '');
  const [popOverride, setPopOverride] = useState(pr.popOverride || false);
  const [popJustification, setPopJustification] = useState(pr.popOverrideJustification || '');
  const [etd, setEtd] = useState(pr.estimatedDeliveryDate || '');
  
  // Dialog state
  const [notifyDialog, setNotifyDialog] = useState<'finance' | 'procurement' | null>(null);
  const [notifyMessage, setNotifyMessage] = useState('');
  const [moveToOrderedDialog, setMoveToOrderedDialog] = useState(false);

  // Permission checks
  const isProcurement = currentUser.permissionLevel === 3;
  const isFinanceAdmin = currentUser.permissionLevel === 4;
  const isAdmin = currentUser.permissionLevel === 1;
  const canTakeAction = isProcurement || isFinanceAdmin || isAdmin;

  // Get rule thresholds from organization (will need to fetch from org config)
  // For now, using a placeholder - should fetch from organization settings
  const rule1Threshold = pr.organization ? 5000 : 5000; // TODO: Fetch from org config

  // Check if proforma and PoP are required
  const proformaRequired = (pr.estimatedAmount || 0) > rule1Threshold;
  const popRequired = (pr.estimatedAmount || 0) > rule1Threshold;

  if (!canTakeAction) {
    return null;
  }

  // Handle Proforma Invoice Upload
  const handleProformaUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploadingProforma(true);
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
        proformaInvoice: attachment,
        proformaOverride: false, // Clear override if uploading actual document
        proformaOverrideJustification: undefined,
        updatedAt: new Date().toISOString()
      });

      enqueueSnackbar('Proforma invoice uploaded successfully', { variant: 'success' });
      onStatusChange();
    } catch (error) {
      console.error('Error uploading proforma:', error);
      enqueueSnackbar('Failed to upload proforma invoice', { variant: 'error' });
    } finally {
      setUploadingProforma(false);
    }
  };

  // Handle Proof of Payment Upload
  const handlePoPUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploadingPoP(true);
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
        proofOfPayment: attachment,
        popOverride: false, // Clear override if uploading actual document
        popOverrideJustification: undefined,
        updatedAt: new Date().toISOString()
      });

      enqueueSnackbar('Proof of payment uploaded successfully', { variant: 'success' });
      onStatusChange();
    } catch (error) {
      console.error('Error uploading PoP:', error);
      enqueueSnackbar('Failed to upload proof of payment', { variant: 'error' });
    } finally {
      setUploadingPoP(false);
    }
  };

  // Handle Proforma Override
  const handleProformaOverride = async () => {
    if (!proformaJustification.trim()) {
      enqueueSnackbar('Justification required for override', { variant: 'error' });
      return;
    }

    try {
      await prService.updatePR(pr.id, {
        proformaOverride: true,
        proformaOverrideJustification: proformaJustification,
        updatedAt: new Date().toISOString()
      });

      enqueueSnackbar('Proforma override set successfully', { variant: 'success' });
      setProformaOverride(true);
      onStatusChange();
    } catch (error) {
      console.error('Error setting proforma override:', error);
      enqueueSnackbar('Failed to set proforma override', { variant: 'error' });
    }
  };

  // Handle PoP Override
  const handlePoPOverride = async () => {
    if (!popJustification.trim()) {
      enqueueSnackbar('Justification required for override', { variant: 'error' });
      return;
    }

    try {
      await prService.updatePR(pr.id, {
        popOverride: true,
        popOverrideJustification: popJustification,
        updatedAt: new Date().toISOString()
      });

      enqueueSnackbar('PoP override set successfully', { variant: 'success' });
      setPopOverride(true);
      onStatusChange();
    } catch (error) {
      console.error('Error setting PoP override:', error);
      enqueueSnackbar('Failed to set PoP override', { variant: 'error' });
    }
  };

  // Handle ETD Update
  const handleEtdUpdate = async () => {
    if (!etd) {
      enqueueSnackbar('Please select an estimated delivery date', { variant: 'error' });
      return;
    }

    try {
      await prService.updatePR(pr.id, {
        estimatedDeliveryDate: etd,
        updatedAt: new Date().toISOString()
      });

      enqueueSnackbar('Estimated delivery date saved', { variant: 'success' });
      onStatusChange();
    } catch (error) {
      console.error('Error updating ETD:', error);
      enqueueSnackbar('Failed to update ETD', { variant: 'error' });
    }
  };

  // Notify Finance Team
  const handleNotifyFinance = async () => {
    // Validate proforma is uploaded or override is set
    if (proformaRequired && !pr.proformaInvoice && !pr.proformaOverride) {
      enqueueSnackbar('Cannot notify Finance: Proforma invoice required (upload or set override)', { variant: 'error' });
      return;
    }

    try {
      // Send notification to finance team
      await notificationService.handleStatusChange(
        pr.id,
        pr.status,
        pr.status, // Status doesn't change
        currentUser,
        `Procurement requesting payment execution: ${notifyMessage || 'Please process payment for this PO'}`
      );

      enqueueSnackbar('Finance team notified successfully', { variant: 'success' });
      setNotifyDialog(null);
      setNotifyMessage('');
    } catch (error) {
      console.error('Error notifying finance:', error);
      enqueueSnackbar('Failed to notify finance team', { variant: 'error' });
    }
  };

  // Notify Procurement Team
  const handleNotifyProcurement = async () => {
    try {
      // Send notification to procurement team
      await notificationService.handleStatusChange(
        pr.id,
        pr.status,
        pr.status, // Status doesn't change
        currentUser,
        `Finance requesting file uploads: ${notifyMessage || 'Please upload required documents for this PO'}`
      );

      enqueueSnackbar('Procurement team notified successfully', { variant: 'success' });
      setNotifyDialog(null);
      setNotifyMessage('');
    } catch (error) {
      console.error('Error notifying procurement:', error);
      enqueueSnackbar('Failed to notify procurement team', { variant: 'error' });
    }
  };

  // Move to ORDERED Status
  const handleMoveToOrdered = async () => {
    // Validate requirements
    const errors: string[] = [];

    // ETD is REQUIRED for all POs
    if (!pr.estimatedDeliveryDate && !etd) {
      errors.push('Estimated Delivery Date (ETD) is required');
    }

    // Proforma required if above Rule 1
    if (proformaRequired && !pr.proformaInvoice && !pr.proformaOverride) {
      errors.push('Proforma invoice required (upload document or set override with justification)');
    }

    // PoP required if above Rule 1
    if (popRequired && !pr.proofOfPayment && !pr.popOverride) {
      errors.push('Proof of Payment required (upload document or set override with justification)');
    }

    if (errors.length > 0) {
      enqueueSnackbar(`Cannot move to ORDERED: ${errors.join('; ')}`, { variant: 'error' });
      return;
    }

    try {
      // Update ETD if changed but not saved
      const updates: any = {
        status: PRStatus.ORDERED,
        updatedAt: new Date().toISOString(),
        orderedAt: new Date().toISOString()
      };

      if (etd && etd !== pr.estimatedDeliveryDate) {
        updates.estimatedDeliveryDate = etd;
      }

      await prService.updatePR(pr.id, updates);

      // Send notification
      await notificationService.handleStatusChange(
        pr.id,
        pr.status,
        PRStatus.ORDERED,
        currentUser,
        'PO has been ordered and is awaiting delivery'
      );

      enqueueSnackbar('PO moved to ORDERED status successfully', { variant: 'success' });
      setMoveToOrderedDialog(false);
      onStatusChange();
      navigate('/dashboard');
    } catch (error) {
      console.error('Error moving to ORDERED:', error);
      enqueueSnackbar('Failed to move PO to ORDERED status', { variant: 'error' });
    }
  };

  return (
    <Box>
      <Paper sx={{ p: 3, mb: 3, bgcolor: 'primary.50' }}>
        <Typography variant="h6" gutterBottom>
          PO Document Management (APPROVED Status)
        </Typography>
        <Typography variant="body2" color="textSecondary" paragraph>
          Upload required documents or set overrides to move this PO to ORDERED status
        </Typography>

        <Grid container spacing={3}>
          {/* Proforma Invoice Section */}
          <Grid item xs={12} md={6}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Proforma Invoice {proformaRequired && <Chip label="Required" size="small" color="error" />}
              </Typography>
              
              {pr.proformaInvoice ? (
                <Box>
                  <Alert severity="success" sx={{ mb: 2 }}>
                    <Typography variant="body2">
                      ✓ Uploaded: {pr.proformaInvoice.name}
                    </Typography>
                    <Typography variant="caption">
                      By: {pr.proformaInvoice.uploadedBy.name || pr.proformaInvoice.uploadedBy.email}
                    </Typography>
                  </Alert>
                  <Button
                    variant="outlined"
                    startIcon={<DownloadIcon />}
                    href={pr.proformaInvoice.url}
                    target="_blank"
                    fullWidth
                  >
                    View Document
                  </Button>
                </Box>
              ) : pr.proformaOverride ? (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  <Typography variant="body2" gutterBottom>
                    Override Set
                  </Typography>
                  <Typography variant="caption">
                    Justification: {pr.proformaOverrideJustification}
                  </Typography>
                </Alert>
              ) : (
                <Stack spacing={2}>
                  <input
                    type="file"
                    id="proforma-upload"
                    style={{ display: 'none' }}
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleProformaUpload}
                  />
                  <Button
                    variant="contained"
                    startIcon={<UploadIcon />}
                    onClick={() => document.getElementById('proforma-upload')?.click()}
                    disabled={uploadingProforma}
                  >
                    {uploadingProforma ? 'Uploading...' : 'Upload Proforma'}
                  </Button>

                  <Divider>OR</Divider>

                  <TextField
                    fullWidth
                    label="Override Justification"
                    multiline
                    rows={2}
                    value={proformaJustification}
                    onChange={(e) => setProformaJustification(e.target.value)}
                    placeholder="E.g., Vendor doesn't provide proforma, urgent order, standing agreement"
                    helperText="Required if setting override"
                  />
                  <Button
                    variant="outlined"
                    onClick={handleProformaOverride}
                    disabled={!proformaJustification.trim()}
                  >
                    Set Override
                  </Button>
                </Stack>
              )}
            </Paper>
          </Grid>

          {/* Proof of Payment Section */}
          <Grid item xs={12} md={6}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Proof of Payment {popRequired && <Chip label="Required" size="small" color="error" />}
              </Typography>
              
              {pr.proofOfPayment ? (
                <Box>
                  <Alert severity="success" sx={{ mb: 2 }}>
                    <Typography variant="body2">
                      ✓ Uploaded: {pr.proofOfPayment.name}
                    </Typography>
                    <Typography variant="caption">
                      By: {pr.proofOfPayment.uploadedBy.name || pr.proofOfPayment.uploadedBy.email}
                    </Typography>
                  </Alert>
                  <Button
                    variant="outlined"
                    startIcon={<DownloadIcon />}
                    href={pr.proofOfPayment.url}
                    target="_blank"
                    fullWidth
                  >
                    View Document
                  </Button>
                </Box>
              ) : pr.popOverride ? (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  <Typography variant="body2" gutterBottom>
                    Override Set
                  </Typography>
                  <Typography variant="caption">
                    Justification: {pr.popOverrideJustification}
                  </Typography>
                </Alert>
              ) : (
                <Stack spacing={2}>
                  <input
                    type="file"
                    id="pop-upload"
                    style={{ display: 'none' }}
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handlePoPUpload}
                  />
                  <Button
                    variant="contained"
                    startIcon={<UploadIcon />}
                    onClick={() => document.getElementById('pop-upload')?.click()}
                    disabled={uploadingPoP}
                  >
                    {uploadingPoP ? 'Uploading...' : 'Upload Proof of Payment'}
                  </Button>

                  <Divider>OR</Divider>

                  <TextField
                    fullWidth
                    label="Override Justification"
                    multiline
                    rows={2}
                    value={popJustification}
                    onChange={(e) => setPopJustification(e.target.value)}
                    placeholder="E.g., Payment pending, emergency purchase, prepaid arrangement"
                    helperText="Required if setting override"
                  />
                  <Button
                    variant="outlined"
                    onClick={handlePoPOverride}
                    disabled={!popJustification.trim()}
                  >
                    Set Override
                  </Button>
                </Stack>
              )}
            </Paper>
          </Grid>

          {/* Estimated Delivery Date */}
          <Grid item xs={12}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Estimated Delivery Date (ETD) <Chip label="Required" size="small" color="error" />
              </Typography>
              <Stack direction="row" spacing={2} alignItems="center">
                <TextField
                  type="date"
                  value={etd}
                  onChange={(e) => setEtd(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  label="Expected Delivery Date"
                  sx={{ flexGrow: 1 }}
                />
                <Button
                  variant="contained"
                  onClick={handleEtdUpdate}
                  disabled={!etd || etd === pr.estimatedDeliveryDate}
                >
                  Save ETD
                </Button>
              </Stack>
              {pr.estimatedDeliveryDate && (
                <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                  Current ETD: {new Date(pr.estimatedDeliveryDate).toLocaleDateString()}
                </Typography>
              )}
            </Paper>
          </Grid>

          {/* Inter-team Notifications */}
          <Grid item xs={12}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Inter-team Notifications
              </Typography>
              <Stack direction="row" spacing={2}>
                {isProcurement && (
                  <Button
                    variant="outlined"
                    startIcon={<SendIcon />}
                    onClick={() => setNotifyDialog('finance')}
                  >
                    Notify Finance for Payment
                  </Button>
                )}
                {isFinanceAdmin && (
                  <Button
                    variant="outlined"
                    startIcon={<SendIcon />}
                    onClick={() => setNotifyDialog('procurement')}
                  >
                    Notify Procurement for Uploads
                  </Button>
                )}
              </Stack>
            </Paper>
          </Grid>

          {/* Move to ORDERED Action */}
          <Grid item xs={12}>
            <Button
              variant="contained"
              color="success"
              size="large"
              fullWidth
              startIcon={<CheckIcon />}
              onClick={() => setMoveToOrderedDialog(true)}
            >
              Move to ORDERED Status
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Notify Finance Dialog */}
      <Dialog open={notifyDialog === 'finance'} onClose={() => setNotifyDialog(null)}>
        <DialogTitle>Notify Finance Team</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" paragraph>
            Send notification to Finance team to execute payment
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Message (Optional)"
            value={notifyMessage}
            onChange={(e) => setNotifyMessage(e.target.value)}
            placeholder="Additional instructions or notes for Finance team..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNotifyDialog(null)}>Cancel</Button>
          <Button onClick={handleNotifyFinance} variant="contained">
            Send Notification
          </Button>
        </DialogActions>
      </Dialog>

      {/* Notify Procurement Dialog */}
      <Dialog open={notifyDialog === 'procurement'} onClose={() => setNotifyDialog(null)}>
        <DialogTitle>Notify Procurement Team</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" paragraph>
            Send notification to Procurement team for file uploads
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Message (Optional)"
            value={notifyMessage}
            onChange={(e) => setNotifyMessage(e.target.value)}
            placeholder="Additional instructions or notes for Procurement team..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNotifyDialog(null)}>Cancel</Button>
          <Button onClick={handleNotifyProcurement} variant="contained">
            Send Notification
          </Button>
        </DialogActions>
      </Dialog>

      {/* Move to ORDERED Confirmation Dialog */}
      <Dialog open={moveToOrderedDialog} onClose={() => setMoveToOrderedDialog(false)}>
        <DialogTitle>Move to ORDERED Status</DialogTitle>
        <DialogContent>
          <Typography variant="body2" paragraph>
            Please confirm all requirements are met:
          </Typography>
          <Stack spacing={1}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {pr.estimatedDeliveryDate || etd ? (
                <>
                  <CheckIcon color="success" fontSize="small" />
                  <Typography variant="body2">ETD: {pr.estimatedDeliveryDate || etd}</Typography>
                </>
              ) : (
                <>
                  <Typography variant="body2" color="error">❌ ETD not set</Typography>
                </>
              )}
            </Box>
            {proformaRequired && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {pr.proformaInvoice || pr.proformaOverride ? (
                  <>
                    <CheckIcon color="success" fontSize="small" />
                    <Typography variant="body2">
                      Proforma: {pr.proformaInvoice ? 'Uploaded' : 'Override Set'}
                    </Typography>
                  </>
                ) : (
                  <Typography variant="body2" color="error">❌ Proforma not provided</Typography>
                )}
              </Box>
            )}
            {popRequired && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {pr.proofOfPayment || pr.popOverride ? (
                  <>
                    <CheckIcon color="success" fontSize="small" />
                    <Typography variant="body2">
                      PoP: {pr.proofOfPayment ? 'Uploaded' : 'Override Set'}
                    </Typography>
                  </>
                ) : (
                  <Typography variant="body2" color="error">❌ PoP not provided</Typography>
                )}
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMoveToOrderedDialog(false)}>Cancel</Button>
          <Button onClick={handleMoveToOrdered} variant="contained" color="success">
            Confirm & Move to ORDERED
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

