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
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { PRStatus } from '@/types/pr';
import { prService } from '@/services/pr';
import { notificationService } from '@/services/notification';
import { User } from '@/types/user';

interface ProcurementActionsProps {
  prId: string;
  currentStatus: PRStatus;
  requestorEmail: string;
  currentUser: User;
  onStatusChange: () => void;
}

export function ProcurementActions({ prId, currentStatus, requestorEmail, currentUser, onStatusChange }: ProcurementActionsProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<'approve' | 'reject' | 'revise' | 'cancel' | 'queue' | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();

  const handleActionClick = (action: 'approve' | 'reject' | 'revise' | 'cancel' | 'queue') => {
    setSelectedAction(action);
    setIsDialogOpen(true);
    setNotes('');
    setError(null);
  };

  const handleClose = () => {
    setIsDialogOpen(false);
    setSelectedAction(null);
    setNotes('');
    setError(null);
  };

  const handleSubmit = async () => {
    try {
      // Validate notes for reject and revise actions
      if ((selectedAction === 'reject' || selectedAction === 'revise') && !notes.trim()) {
        setError('Notes are required when rejecting or requesting revision');
        return;
      }

      let newStatus: PRStatus;
      switch (selectedAction) {
        case 'approve':
          newStatus = PRStatus.PENDING_APPROVAL;
          break;
        case 'reject':
          newStatus = PRStatus.REJECTED;
          break;
        case 'revise':
          newStatus = PRStatus.REVISION_REQUIRED;
          break;
        case 'cancel':
          newStatus = PRStatus.CANCELED;
          break;
        case 'queue':
          newStatus = PRStatus.IN_QUEUE;
          break;
        default:
          return;
      }

      // Get PR details first to prepare notifications
      const pr = await prService.getPR(prId);
      if (!pr) throw new Error('PR not found');

      // For push to approver, ensure we have approvers
      if (selectedAction === 'approve' && (!pr.approvers || pr.approvers.length === 0)) {
        setError('Cannot push to approval - no approvers assigned');
        return;
      }

      // Update PR status with notes
      await prService.updatePRStatus(
        prId,
        newStatus,
        notes || (selectedAction === 'approve' ? 'PR pushed to approver' : undefined),
        currentUser
      );

      enqueueSnackbar('PR status updated successfully', { variant: 'success' });
      handleClose();
      onStatusChange(); // Trigger parent refresh

      // Navigate to dashboard after any successful status change
      navigate('/dashboard');
    } catch (error) {
      console.error('Error updating PR status:', error);
      enqueueSnackbar('Failed to update PR status', { variant: 'error' });
    }
  };

  // Show different actions based on user role and PR status
  const isProcurement = currentUser.permissionLevel === 2 || currentUser.permissionLevel === 3;
  const isRequestor = currentUser.email.toLowerCase() === requestorEmail.toLowerCase();

  if (!isProcurement && !isRequestor) {
    return null;
  }

  // Show cancel button for requestor in appropriate statuses
  if (isRequestor && (
    currentStatus === PRStatus.SUBMITTED ||
    currentStatus === PRStatus.RESUBMITTED ||
    currentStatus === PRStatus.IN_QUEUE ||
    currentStatus === PRStatus.REVISION_REQUIRED
  )) {
    return (
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <Button
          variant="contained"
          color="error"
          onClick={() => handleActionClick('cancel')}
        >
          Cancel PR
        </Button>
        <Dialog 
          open={isDialogOpen} 
          onClose={handleClose} 
          maxWidth="sm" 
          fullWidth
        >
          <DialogTitle>Cancel PR</DialogTitle>
          <DialogContent>
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                Are you sure you want to cancel this PR? This action cannot be undone.
              </Typography>
              <TextField
                autoFocus
                multiline
                rows={4}
                label="Notes (Optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                fullWidth
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose}>No, Keep PR</Button>
            <Button onClick={handleSubmit} variant="contained" color="error">
              Yes, Cancel PR
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    );
  }

  // For IN_QUEUE status - Procurement actions
  if (currentStatus === PRStatus.IN_QUEUE && isProcurement) {
    return (
      <>
        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          <Button
            variant="contained"
            color="primary"
            onClick={() => handleActionClick('approve')}
          >
            Push to Approver
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => handleActionClick('reject')}
          >
            Reject
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={() => handleActionClick('revise')}
          >
            Revise & Resubmit
          </Button>
        </Box>
        <Dialog 
          open={isDialogOpen} 
          onClose={handleClose} 
          maxWidth="sm" 
          fullWidth
        >
          <DialogTitle>
            {selectedAction === 'approve' && 'Push to Approver'}
            {selectedAction === 'reject' && 'Reject PR'}
            {selectedAction === 'revise' && 'Request Revision'}
          </DialogTitle>
          <DialogContent>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                {selectedAction === 'approve' && 'Add optional notes before pushing this PR to the approver.'}
                {selectedAction === 'reject' && 'Please provide a reason for rejecting this PR.'}
                {selectedAction === 'revise' && 'Please specify what changes are needed for this PR.'}
              </Typography>
              <TextField
                autoFocus
                multiline
                rows={4}
                label="Notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                required={selectedAction === 'reject' || selectedAction === 'revise'}
                error={!!error}
                fullWidth
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose}>Cancel</Button>
            <Button onClick={handleSubmit} variant="contained" color="primary">
              Confirm
            </Button>
          </DialogActions>
        </Dialog>
      </>
    );
  }

  // For REVISION_REQUIRED status - Procurement actions
  if (currentStatus === PRStatus.REVISION_REQUIRED && isProcurement) {
    return (
      <>
        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          <Button
            variant="contained"
            color="primary"
            onClick={() => handleActionClick('approve')}
          >
            Push to Approver
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={() => handleActionClick('revise')}
          >
            Revise & Resubmit
          </Button>
        </Box>
        <Dialog 
          open={isDialogOpen} 
          onClose={handleClose} 
          maxWidth="sm" 
          fullWidth
        >
          <DialogTitle>
            {selectedAction === 'approve' && 'Push to Approver'}
            {selectedAction === 'revise' && 'Request Revision'}
          </DialogTitle>
          <DialogContent>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                {selectedAction === 'approve' && 'Add optional notes before pushing this PR to the approver.'}
                {selectedAction === 'revise' && 'Please specify what changes are needed for this PR.'}
              </Typography>
              <TextField
                autoFocus
                multiline
                rows={4}
                label="Notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                required={selectedAction === 'revise'}
                error={!!error}
                fullWidth
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose}>Cancel</Button>
            <Button onClick={handleSubmit} variant="contained" color="primary">
              Confirm
            </Button>
          </DialogActions>
        </Dialog>
      </>
    );
  }

  // For SUBMITTED or RESUBMITTED status - Procurement actions
  if (isProcurement && (currentStatus === PRStatus.SUBMITTED || currentStatus === PRStatus.RESUBMITTED)) {
    return (
      <>
        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          <Button
            variant="contained"
            color="primary"
            onClick={() => handleActionClick('queue' as const)}
          >
            Move to Queue
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => handleActionClick('reject')}
          >
            Reject
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={() => handleActionClick('revise')}
          >
            Revise & Resubmit
          </Button>
        </Box>
        <Dialog 
          open={isDialogOpen} 
          onClose={handleClose} 
          maxWidth="sm" 
          fullWidth
        >
          <DialogTitle>
            {selectedAction === 'queue' && 'Move to Queue'}
            {selectedAction === 'reject' && 'Reject PR'}
            {selectedAction === 'revise' && 'Request Revision'}
          </DialogTitle>
          <DialogContent>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                {selectedAction === 'queue' && 'Add optional notes about moving this PR to the procurement queue.'}
                {selectedAction === 'reject' && 'Please provide a reason for rejecting this PR.'}
                {selectedAction === 'revise' && 'Please specify what changes are needed for this PR.'}
              </Typography>
              <TextField
                autoFocus
                multiline
                rows={4}
                label="Notes"
                fullWidth
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                error={!!error}
                required={selectedAction === 'reject' || selectedAction === 'revise'}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose}>Cancel</Button>
            <Button onClick={handleSubmit} variant="contained" color="primary">
              Confirm
            </Button>
          </DialogActions>
        </Dialog>
      </>
    );
  }

  return null;
}
