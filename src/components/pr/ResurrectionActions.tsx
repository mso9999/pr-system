import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Alert,
  TextField,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { PRRequest, PRStatus } from '@/types/pr';
import { prService } from '@/services/pr';
import { notificationService } from '@/services/notification';
import { User } from '@/types/user';
import { RestoreFromTrash as ResurrectIcon } from '@mui/icons-material';

interface ResurrectionActionsProps {
  pr: PRRequest;
  currentUser: User;
  onStatusChange: () => void;
}

export const ResurrectionActions: React.FC<ResurrectionActionsProps> = ({
  pr,
  currentUser,
  onStatusChange,
}) => {
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();
  
  const [resurrectDialog, setResurrectDialog] = useState(false);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  // Permission checks
  const isProcurement = currentUser.permissionLevel === 3;
  const isAdmin = currentUser.permissionLevel === 1;
  const isOriginalRequestor = pr.requestorEmail?.toLowerCase() === currentUser.email?.toLowerCase();

  // Determine if user can resurrect
  const canResurrect = 
    (pr.status === PRStatus.REJECTED && (isProcurement || isAdmin)) ||
    (pr.status === PRStatus.CANCELED && (isOriginalRequestor || isAdmin));

  if (!canResurrect) {
    return null;
  }

  // Determine resurrection target status
  const getResurrectionStatus = (): PRStatus => {
    if (pr.status === PRStatus.REJECTED) {
      // Restore to highest previous status
      // Check status history to find highest non-terminal status
      if (pr.statusHistory && pr.statusHistory.length > 0) {
        // Find the last active status before rejection
        const activeStatuses = [PRStatus.SUBMITTED, PRStatus.IN_QUEUE, PRStatus.PENDING_APPROVAL];
        const previousStatus = pr.statusHistory
          .filter(h => activeStatuses.includes(h.status))
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
        
        if (previousStatus) {
          return previousStatus.status;
        }
      }
      // Default to SUBMITTED if no history
      return PRStatus.SUBMITTED;
    } else {
      // CANCELED always returns to SUBMITTED
      return PRStatus.SUBMITTED;
    }
  };

  const handleResurrect = async () => {
    try {
      setLoading(true);
      const targetStatus = getResurrectionStatus();

      await prService.updatePR(pr.id, {
        status: targetStatus,
        updatedAt: new Date().toISOString(),
        notes: `Resurrected from ${pr.status} by ${currentUser.email}. ${notes ? `Note: ${notes}` : ''}`
      });

      // Send notification
      await notificationService.handleStatusChange(
        pr.id,
        pr.status,
        targetStatus,
        currentUser,
        `PR ${pr.prNumber} has been resurrected from ${pr.status} to ${targetStatus}. ${notes || ''}`
      );

      enqueueSnackbar(`PR resurrected successfully to ${targetStatus}`, { variant: 'success' });
      setResurrectDialog(false);
      onStatusChange();
      navigate('/dashboard');
    } catch (error) {
      console.error('Error resurrecting PR:', error);
      enqueueSnackbar('Failed to resurrect PR', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Alert severity="info" sx={{ mb: 2 }}>
        <Typography variant="body2" gutterBottom>
          This PR is {pr.status === PRStatus.REJECTED ? 'REJECTED' : 'CANCELED'} and can be resurrected.
        </Typography>
        <Button
          variant="contained"
          color="info"
          startIcon={<ResurrectIcon />}
          onClick={() => setResurrectDialog(true)}
          sx={{ mt: 1 }}
        >
          Resurrect PR
        </Button>
      </Alert>

      {/* Resurrection Confirmation Dialog */}
      <Dialog open={resurrectDialog} onClose={() => setResurrectDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Resurrect Purchase Request</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body2">
              {pr.status === PRStatus.REJECTED && `This PR will be restored to ${getResurrectionStatus()} status.`}
              {pr.status === PRStatus.CANCELED && 'This PR will be restored to SUBMITTED status.'}
            </Typography>
          </Alert>

          <Typography variant="body2" color="textSecondary" paragraph>
            Provide optional notes about why this PR is being resurrected:
          </Typography>

          <TextField
            fullWidth
            multiline
            rows={4}
            label="Notes (Optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="E.g., Error in rejection, circumstances changed, requestor needs to proceed..."
          />

          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="caption">
              The resurrection will be logged in the PR history. All stakeholders will be notified.
            </Typography>
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResurrectDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleResurrect} 
            variant="contained" 
            color="info"
            disabled={loading}
            startIcon={<ResurrectIcon />}
          >
            Resurrect PR
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

