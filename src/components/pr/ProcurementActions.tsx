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
import { validatePRForApproval } from '@/utils/prValidation';

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

      // Get the PR data
      const pr = await prService.getPR(prId);
      if (!pr) {
        setError('PR not found');
        return;
      }

      let newStatus: PRStatus;
      switch (selectedAction) {
        case 'approve':
          // Get the rules for this organization
          const rules = await prService.getRuleForOrganization(pr.organization, pr.estimatedAmount);
          console.log('Retrieved rules:', {
            organization: pr.organization,
            estimatedAmount: pr.estimatedAmount,
            rules
          });

          // Only validate if we have rules
          if (rules && rules.length > 0) {
            // Only validate for PENDING_APPROVAL when pushing from IN_QUEUE
            console.log('Starting validation with:', {
              pr,
              rules,
              currentUser,
              targetStatus: PRStatus.PENDING_APPROVAL
            });

            const validation = await validatePRForApproval(
              pr,
              rules,
              currentUser,
              PRStatus.PENDING_APPROVAL
            );

            console.log('Validation result:', validation);

            if (!validation.isValid) {
              setError(validation.errors.join('\n\n')); // Add double newline for better separation
              return;
            }
          } else {
            console.log('No rules found for organization, skipping validation');
          }

          // Only allow pushing to approver from IN_QUEUE
          if (pr.status !== PRStatus.IN_QUEUE) {
            console.log('Invalid status transition:', {
              currentStatus: pr.status,
              expectedStatus: PRStatus.IN_QUEUE
            });
            setError('Can only push to approver from IN_QUEUE status');
            return;
          }

          // Change designation from PR to PO
          const poNumber = pr.prNumber.replace('PR', 'PO');
          newStatus = PRStatus.PENDING_APPROVAL;
          
          console.log('Updating PR with:', {
            poNumber,
            newStatus,
            currentUser,
            prId: pr.id
          });

          // Update PR with PO number and approver information
          await prService.updatePR(prId, {
            prNumber: poNumber,
            status: newStatus,
            lastModifiedBy: currentUser.email,
            lastModifiedAt: new Date().toISOString(),
            approvalWorkflow: {
              currentApprover: pr.approver,
              approvalHistory: [],
              lastUpdated: new Date().toISOString()
            }
          });

          // Send notification to first approver
          await notificationService.handleStatusChange(
            pr.id || prId,
            pr.status,
            newStatus,
            currentUser,
            `PR ${pr.prNumber} has been converted to PO ${poNumber} and is pending your approval.`
          );
          break;

        case 'reject':
          newStatus = PRStatus.REJECTED;
          await notificationService.handleStatusChange(
            pr.id || prId,
            pr.status,
            newStatus,
            currentUser,
            notes || 'PR rejected'
          );
          break;

        case 'revise':
          newStatus = PRStatus.REVISION_REQUIRED;
          await notificationService.handleStatusChange(
            pr.id || prId,
            pr.status,
            newStatus,
            currentUser,
            notes || 'PR requires revision'
          );
          break;

        case 'cancel':
          newStatus = PRStatus.CANCELED;
          await notificationService.handleStatusChange(
            pr.id || prId,
            pr.status,
            newStatus,
            currentUser,
            notes || 'PR canceled by requestor'
          );
          break;

        case 'queue':
          newStatus = PRStatus.IN_QUEUE;
          await notificationService.handleStatusChange(
            pr.id || prId,
            pr.status,
            newStatus,
            currentUser,
            notes || 'PR moved to queue'
          );
          break;

        default:
          return;
      }

      // For push to approver, ensure we have an approver
      if (selectedAction === 'approve' && !pr.approver) {
        setError('Cannot push to approval - no approver assigned');
        return;
      }

      // Update PR status
      await prService.updatePRStatus(prId, newStatus, notes, currentUser);

      enqueueSnackbar(`PR status successfully updated to ${newStatus}`, { variant: 'success' });
      handleClose();
      onStatusChange(); // Trigger parent refresh

      // Navigate to dashboard after any successful status change
      navigate('/dashboard');
    } catch (error) {
      console.error('Error updating PR status:', error);
      setError(error instanceof Error ? error.message : 'Failed to update PR status');
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
