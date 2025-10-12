import React, { useState, useMemo } from 'react';
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
  Chip,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { PRStatus, PRRequest } from '@/types/pr';
import { prService } from '@/services/pr';
import { notificationService } from '@/services/notification';
import { User } from '@/types/user';
import { validatePRForApproval } from '@/utils/prValidation';

interface ApproverActionsProps {
  pr: PRRequest;
  currentUser: User;
  assignedApprover?: User;
  onStatusChange?: () => void;
}

export function ApproverActions({ pr, currentUser, assignedApprover, onStatusChange }: ApproverActionsProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<'approve' | 'reject' | 'revise' | 'queue' | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();

  // Dual approval detection
  const isDualApproval = pr.requiresDualApproval || pr.approvalWorkflow?.requiresDualApproval;
  const isFirstApprover = currentUser.id === pr.approver;
  const isSecondApprover = currentUser.id === pr.approver2;
  const hasFirstApproved = pr.approvalWorkflow?.firstApprovalComplete || false;
  const hasSecondApproved = pr.approvalWorkflow?.secondApprovalComplete || false;

  // Check if user has permission to take actions
  const canTakeAction = useMemo(() => {
    const isProcurement = currentUser.permissionLevel === 2 || currentUser.permissionLevel === 3;
    const isApprover = currentUser.id === pr.approver || currentUser.id === pr.approver2;

    console.log('Permission check:', {
      userId: currentUser.id,
      assignedApproverId: assignedApprover?.id,
      prApprover: pr.approver,
      prApprover2: pr.approver2,
      isDualApproval,
      isFirstApprover,
      isSecondApprover,
      hasFirstApproved,
      hasSecondApproved,
      isProcurement,
      isApprover,
      status: pr.status
    });

    // In PENDING_APPROVAL, only assigned approvers can act
    if (pr.status === PRStatus.PENDING_APPROVAL) {
      // For dual approval, check if this approver hasn't already acted
      if (isDualApproval) {
        if (isFirstApprover && hasFirstApproved) return false; // Already approved
        if (isSecondApprover && hasSecondApproved) return false; // Already approved
      }
      return isApprover;
    }

    return isProcurement || isApprover;
  }, [currentUser, pr.approver, pr.approver2, pr.status, isDualApproval, isFirstApprover, isSecondApprover, hasFirstApproved, hasSecondApproved]);

  if (!canTakeAction) {
    return null;
  }

  const getAvailableActions = () => {
    const isProcurement = currentUser.permissionLevel === 2 || currentUser.permissionLevel === 3;
    const isApprover = currentUser.id === assignedApprover?.id || currentUser.id === pr.approver;
    
    // If PO is in PENDING_APPROVAL
    if (pr.status === PRStatus.PENDING_APPROVAL && pr.type === 'PO') {
      // Only approvers can see actions, and they can't push to queue
      if (isApprover) {
        return ['approve', 'reject', 'revise'];
      }
      return [];
    }

    // For other statuses, show all actions if user has permission
    if (isProcurement || isApprover) {
      return ['approve', 'reject', 'revise', 'queue'];
    }

    return [];
  };

  const actions = getAvailableActions();

  const handleActionClick = (action: 'approve' | 'reject' | 'revise' | 'queue') => {
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

  const handleStatusUpdate = async (newStatus: PRStatus, notes?: string) => {
    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      try {
        setLoading(true);
        await prService.updatePRStatus(pr.id, newStatus, notes);
        enqueueSnackbar(`PR status successfully updated to ${newStatus}`, { variant: 'success' });
        onStatusChange(); // Trigger parent refresh
        return;
      } catch (error) {
        retryCount++;
        if (retryCount === maxRetries) {
          console.error('Failed to update PR status:', error);
          enqueueSnackbar('Failed to update PR status. Please check your network connection and try again.', { 
            variant: 'error',
            autoHideDuration: 5000
          });
        } else {
          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
        }
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSubmit = async () => {
    try {
      // Validate notes for reject and revise actions
      if ((selectedAction === 'reject' || selectedAction === 'revise') && !notes.trim()) {
        setError('Notes are required when rejecting or requesting revision');
        return;
      }

      // Get the PR data
      const prData = await prService.getPR(pr.id);
      if (!prData) {
        setError('PR not found');
        return;
      }

      let newStatus: PRStatus;
      switch (selectedAction) {
        case 'approve':
          // Get the rules for this organization
          const rules = await prService.getRuleForOrganization(prData.organization, prData.estimatedAmount);
          if (!rules || rules.length === 0) {
            setError('No approval rules found for this organization');
            return;
          }

          // Determine if this is dual approval
          const requiresDual = prData.requiresDualApproval || prData.approvalWorkflow?.requiresDualApproval;
          const isFirstAppr = currentUser.id === prData.approver;
          const isSecondAppr = currentUser.id === prData.approver2;
          
          console.log('Approval action:', {
            requiresDual,
            isFirstAppr,
            isSecondAppr,
            currentUserId: currentUser.id,
            approver: prData.approver,
            approver2: prData.approver2
          });

          // For dual approval, update the appropriate approval flag
          if (requiresDual) {
            const firstComplete = isFirstAppr ? true : (prData.approvalWorkflow?.firstApprovalComplete || false);
            const secondComplete = isSecondAppr ? true : (prData.approvalWorkflow?.secondApprovalComplete || false);

            // Update approval workflow
            const updatedWorkflow = {
              ...prData.approvalWorkflow,
              currentApprover: prData.approver,
              secondApprover: prData.approver2,
              requiresDualApproval: true,
              firstApprovalComplete: firstComplete,
              secondApprovalComplete: secondComplete,
              approvalHistory: [
                ...(prData.approvalWorkflow?.approvalHistory || []),
                {
                  approverId: currentUser.id,
                  timestamp: new Date().toISOString(),
                  approved: true,
                  notes: notes || 'Approved'
                }
              ],
              lastUpdated: new Date().toISOString()
            };

            // If both have approved, move to APPROVED
            if (firstComplete && secondComplete) {
              newStatus = PRStatus.APPROVED;
              
              // Update to APPROVED and set object type to PO
              await prService.updatePR(pr.id, {
                status: newStatus,
                objectType: 'PO',
                approvalWorkflow: updatedWorkflow,
                updatedAt: new Date().toISOString()
              });

              // Notify stakeholders
              await notificationService.handleStatusChange(
                pr.id,
                pr.status,
                newStatus,
                currentUser,
                `Both approvers have approved. PR ${prData.prNumber} is now approved.`
              );
            } else {
              // One approver has approved, waiting for the other
              newStatus = PRStatus.PENDING_APPROVAL; // Status stays the same
              
              await prService.updatePR(pr.id, {
                approvalWorkflow: updatedWorkflow,
                updatedAt: new Date().toISOString()
              });

              // Notify the other approver that 1 of 2 has approved
              const otherApproverId = isFirstAppr ? prData.approver2 : prData.approver;
              if (otherApproverId) {
                await notificationService.handleStatusChange(
                  pr.id,
                  pr.status,
                  newStatus,
                  currentUser,
                  `1 of 2 approvals complete. Waiting for second approver.`
                );
              }
            }
          } else {
            // Single approval - move directly to APPROVED
            newStatus = PRStatus.APPROVED;
            
            // Update to APPROVED and set object type to PO
            await prService.updatePR(pr.id, {
              status: newStatus,
              objectType: 'PO',
              approvalWorkflow: {
                ...prData.approvalWorkflow,
                currentApprover: prData.approver || null,
                secondApprover: null,
                requiresDualApproval: false,
                firstApprovalComplete: true,
                secondApprovalComplete: false,
                approvalHistory: [
                  ...(prData.approvalWorkflow?.approvalHistory || []),
                  {
                    approverId: currentUser.id,
                    timestamp: new Date().toISOString(),
                    approved: true,
                    notes: notes || 'Approved'
                  }
                ],
                lastUpdated: new Date().toISOString()
              },
              updatedAt: new Date().toISOString()
            });

            // Send notification
            await notificationService.handleStatusChange(
              pr.id,
              pr.status,
              newStatus,
              currentUser,
              `PR ${prData.prNumber} has been approved.`
            );
          }
          break;

        case 'reject':
          newStatus = PRStatus.REJECTED;
          break;

        case 'revise':
          newStatus = PRStatus.REVISION_REQUIRED;
          break;

        case 'queue':
          newStatus = PRStatus.IN_QUEUE;
          break;

        default:
          return;
      }

      // Update PR status
      await handleStatusUpdate(newStatus, notes);

      // Navigate to dashboard after any successful status change
      navigate('/dashboard');
    } catch (error) {
      console.error('Error updating PR status:', error);
      setError(error instanceof Error ? error.message : 'Failed to update PR status');
      enqueueSnackbar(error instanceof Error ? error.message : 'Failed to update PR status', { 
        variant: 'error',
        autoHideDuration: 5000
      });
    }
  };

  const getDialogTitle = () => {
    switch (selectedAction) {
      case 'revise':
        return 'Revise & Resubmit';
      case 'queue':
        return 'Return to Queue';
      case 'reject':
        return 'Reject PR';
      case 'approve':
        return 'Approve PR';
      default:
        return '';
    }
  };

  return (
    <Box>
      {/* Dual Approval Status Display */}
      {isDualApproval && pr.status === PRStatus.PENDING_APPROVAL && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            This PR requires dual approval (above Rule 2 threshold)
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
            <Chip
              label={`Approver 1: ${hasFirstApproved ? 'Approved ✓' : 'Pending'}`}
              color={hasFirstApproved ? 'success' : 'default'}
              size="small"
            />
            <Chip
              label={`Approver 2: ${hasSecondApproved ? 'Approved ✓' : 'Pending'}`}
              color={hasSecondApproved ? 'success' : 'default'}
              size="small"
            />
          </Box>
          {hasFirstApproved && !hasSecondApproved && (
            <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
              Waiting for second approver to approve
            </Typography>
          )}
          {!hasFirstApproved && hasSecondApproved && (
            <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
              Waiting for first approver to approve
            </Typography>
          )}
        </Alert>
      )}

      {/* Action buttons */}
      <Stack direction="row" spacing={2} mb={2}>
        {actions.includes('approve') && (
          <Button
            variant="contained"
            color="primary"
            onClick={() => handleActionClick('approve')}
          >
            Approve
          </Button>
        )}
        {actions.includes('reject') && (
          <Button
            variant="contained"
            color="error"
            onClick={() => handleActionClick('reject')}
          >
            Reject
          </Button>
        )}
        {actions.includes('revise') && (
          <Button
            variant="contained"
            color="warning"
            onClick={() => handleActionClick('revise')}
          >
            Revise & Resubmit
          </Button>
        )}
        {actions.includes('queue') && (
          <Button
            variant="contained"
            color="info"
            onClick={() => handleActionClick('queue')}
          >
            Return to Queue
          </Button>
        )}
      </Stack>

      {/* Action dialog */}
      <Dialog open={isDialogOpen} onClose={handleClose}>
        <DialogTitle>{getDialogTitle()}</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <TextField
            autoFocus
            margin="dense"
            label="Notes"
            fullWidth
            multiline
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            required={selectedAction === 'reject' || selectedAction === 'revise'}
            error={!notes.trim() && (selectedAction === 'reject' || selectedAction === 'revise')}
            helperText={
              !notes.trim() && (selectedAction === 'reject' || selectedAction === 'revise')
                ? 'Notes are required'
                : ''
            }
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" color="primary" disabled={loading}>
            Submit
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
