import React, { useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Alert,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Chip,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { PRRequest, PRStatus } from '@/types/pr';
import { prService } from '@/services/pr';
import { User } from '@/types/user';
import { PriorityHigh as UrgentIcon, Flag as FlagIcon } from '@mui/icons-material';

interface UrgencyControlProps {
  pr: PRRequest;
  currentUser: User;
  onUpdate: () => void;
}

export const UrgencyControl: React.FC<UrgencyControlProps> = ({
  pr,
  currentUser,
  onUpdate,
}) => {
  const { enqueueSnackbar } = useSnackbar();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newUrgency, setNewUrgency] = useState(pr.isUrgent ? 'urgent' : 'normal');

  // Permission checks based on status and role
  const canChangeUrgency = (): boolean => {
    // Administrator can always change
    if (currentUser.permissionLevel === 1) return true;

    // Check if current user is the requestor
    const isRequestor = currentUser.id === pr.requestorId || 
                        currentUser.email?.toLowerCase() === pr.requestorEmail?.toLowerCase();

    // REQUESTOR can edit urgency when in edit mode (DRAFT or REVISION_REQUIRED)
    if (isRequestor) {
      return pr.status === PRStatus.DRAFT || pr.status === PRStatus.REVISION_REQUIRED;
    }

    // SUBMITTED, IN_QUEUE: Locked (cannot be changed by non-requestors)
    if (pr.status === PRStatus.SUBMITTED || 
        pr.status === PRStatus.RESUBMITTED ||
        pr.status === PRStatus.IN_QUEUE) {
      return false;
    }

    // PENDING_APPROVAL onward: Procurement can change
    if (currentUser.permissionLevel === 3) {
      return [
        PRStatus.PENDING_APPROVAL,
        PRStatus.APPROVED,
        PRStatus.ORDERED,
        PRStatus.COMPLETED
      ].includes(pr.status);
    }

    // APPROVED onward (PO): Approvers (Level 2, 4) can change
    if (currentUser.permissionLevel === 2 || currentUser.permissionLevel === 4) {
      return [
        PRStatus.APPROVED,
        PRStatus.ORDERED,
        PRStatus.COMPLETED
      ].includes(pr.status);
    }

    return false;
  };

  const handleUrgencyChange = async () => {
    const isUrgent = newUrgency === 'urgent';

    try {
      await prService.updatePR(pr.id, {
        isUrgent,
        updatedAt: new Date().toISOString()
      });

      enqueueSnackbar(`Urgency updated to ${isUrgent ? 'URGENT' : 'NORMAL'}`, { variant: 'success' });
      setDialogOpen(false);
      onUpdate();
    } catch (error) {
      console.error('Error updating urgency:', error);
      enqueueSnackbar('Failed to update urgency', { variant: 'error' });
    }
  };

  if (!canChangeUrgency()) {
    const isRequestor = currentUser.id === pr.requestorId || 
                        currentUser.email?.toLowerCase() === pr.requestorEmail?.toLowerCase();
    
    let lockMessage = '(No permission to change)';
    if (isRequestor && (pr.status === PRStatus.SUBMITTED || pr.status === PRStatus.RESUBMITTED || pr.status === PRStatus.IN_QUEUE)) {
      lockMessage = '(Locked after submission - can be changed if returned for revision)';
    } else if (pr.status === PRStatus.SUBMITTED || pr.status === PRStatus.RESUBMITTED || pr.status === PRStatus.IN_QUEUE) {
      lockMessage = '(Locked at requestor\'s setting)';
    }

    return (
      <Box>
        <Typography variant="caption" color="textSecondary">
          Urgency Level:
        </Typography>
        <Chip
          label={pr.isUrgent ? 'URGENT' : 'NORMAL'}
          color={pr.isUrgent ? 'error' : 'default'}
          size="small"
          icon={pr.isUrgent ? <UrgentIcon /> : <FlagIcon />}
          sx={{ ml: 1 }}
        />
        <Typography variant="caption" color="textSecondary" display="block" sx={{ mt: 0.5 }}>
          {lockMessage}
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="caption" color="textSecondary">
          Urgency Level:
        </Typography>
        <Chip
          label={pr.isUrgent ? 'URGENT' : 'NORMAL'}
          color={pr.isUrgent ? 'error' : 'default'}
          size="small"
          icon={pr.isUrgent ? <UrgentIcon /> : <FlagIcon />}
        />
        <Button
          size="small"
          variant="outlined"
          onClick={() => setDialogOpen(true)}
        >
          Change
        </Button>
      </Box>

      {/* Change Urgency Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Change Urgency Level</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              Changing urgency level affects notification priority and display order
            </Typography>
          </Alert>

          <FormControl component="fieldset">
            <FormLabel component="legend">Select Urgency Level</FormLabel>
            <RadioGroup
              value={newUrgency}
              onChange={(e) => setNewUrgency(e.target.value)}
            >
              <FormControlLabel
                value="normal"
                control={<Radio />}
                label={
                  <Box>
                    <Typography>NORMAL</Typography>
                    <Typography variant="caption" color="textSecondary">
                      Standard processing priority
                    </Typography>
                  </Box>
                }
              />
              <FormControlLabel
                value="urgent"
                control={<Radio />}
                label={
                  <Box>
                    <Typography color="error">URGENT</Typography>
                    <Typography variant="caption" color="textSecondary">
                      High priority - appears at top of lists, urgent notifications
                    </Typography>
                  </Box>
                }
              />
            </RadioGroup>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleUrgencyChange} 
            variant="contained" 
            color="primary"
            disabled={newUrgency === (pr.isUrgent ? 'urgent' : 'normal')}
          >
            Update Urgency
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

