import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Paper,
  Typography,
  Box,
  Chip,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import { PRRequest, PRStatus } from '@/types/pr';

interface StatusProgressStepperProps {
  pr: PRRequest;
}

export const StatusProgressStepper: React.FC<StatusProgressStepperProps> = ({ pr }) => {
  const { t } = useTranslation();

  // Standard workflow sequence
  const standardSequence: PRStatus[] = [
    PRStatus.SUBMITTED,
    PRStatus.IN_QUEUE,
    PRStatus.PENDING_APPROVAL,
    PRStatus.APPROVED,
    PRStatus.ORDERED,
    PRStatus.COMPLETED,
  ];

  // Determine which steps have been achieved based on status history
  const getAchievedStatuses = (): Set<PRStatus> => {
    const achieved = new Set<PRStatus>();
    
    if (pr.statusHistory && pr.statusHistory.length > 0) {
      pr.statusHistory.forEach(entry => {
        if (entry.status) {
          achieved.add(entry.status as PRStatus);
        }
      });
    }
    
    // Always include current status
    if (pr.status) {
      achieved.add(pr.status as PRStatus);
    }
    
    return achieved;
  };

  const achievedStatuses = getAchievedStatuses();

  // Find the highest standard sequence status that was achieved
  const getLastStandardStatus = (): PRStatus | null => {
    for (let i = standardSequence.length - 1; i >= 0; i--) {
      if (achievedStatuses.has(standardSequence[i])) {
        return standardSequence[i];
      }
    }
    return null;
  };

  const lastStandardStatus = getLastStandardStatus();

  // Build the steps array (standard + out-of-sequence if needed)
  const buildSteps = (): { status: PRStatus; label: string; isStandard: boolean }[] => {
    const steps = standardSequence.map(status => ({
      status,
      label: t(`status.${status}`),
      isStandard: true,
    }));

    // If current status is not in standard sequence, add it after last achieved standard status
    const currentStatus = pr.status as PRStatus;
    if (!standardSequence.includes(currentStatus)) {
      const lastStandardIndex = lastStandardStatus 
        ? standardSequence.indexOf(lastStandardStatus)
        : -1;

      const outOfSequenceStep = {
        status: currentStatus,
        label: t(`status.${currentStatus}`),
        isStandard: false,
      };

      // Insert after last standard status achieved
      steps.splice(lastStandardIndex + 1, 0, outOfSequenceStep);
    }

    return steps;
  };

  const steps = buildSteps();

  // Determine active step index
  const getActiveStep = (): number => {
    const currentStatus = pr.status as PRStatus;
    return steps.findIndex(step => step.status === currentStatus);
  };

  const activeStep = getActiveStep();

  // Check if a step is completed
  const isStepCompleted = (stepStatus: PRStatus, stepIndex: number): boolean => {
    // A step is completed if it's been achieved and we're past it
    return achievedStatuses.has(stepStatus) && stepIndex < activeStep;
  };

  // Get step icon based on status
  const getStepIcon = (stepStatus: PRStatus, stepIndex: number) => {
    const currentStatus = pr.status as PRStatus;
    
    if (stepStatus === currentStatus) {
      // Current status - show hourglass for in-progress
      if ([PRStatus.REJECTED, PRStatus.REVISION_REQUIRED, PRStatus.CANCELED].includes(currentStatus)) {
        return <ErrorIcon color="error" />;
      }
      return <HourglassEmptyIcon color="primary" />;
    } else if (isStepCompleted(stepStatus, stepIndex)) {
      return <CheckCircleIcon color="success" />;
    }
    
    return undefined; // Use default MUI icon
  };

  // Get the date when this status was achieved
  const getStatusDate = (status: PRStatus): string | null => {
    if (!pr.statusHistory) return null;
    
    // Find the most recent entry for this status
    const entry = [...pr.statusHistory]
      .reverse()
      .find(h => h.status === status);
    
    if (entry?.timestamp) {
      return new Date(entry.timestamp).toLocaleString();
    }
    
    return null;
  };

  // Don't show stepper if PR is still in DRAFT
  if (pr.status === PRStatus.DRAFT) {
    return null;
  }

  return (
    <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          {t('pr.orderProgress')}
        </Typography>
        <Chip 
          label={t(`status.${pr.status}`)}
          color={
            pr.status === PRStatus.COMPLETED ? 'success' :
            pr.status === PRStatus.REJECTED || pr.status === PRStatus.CANCELED ? 'error' :
            pr.status === PRStatus.REVISION_REQUIRED ? 'warning' :
            'primary'
          }
          size="small"
        />
      </Box>
      
      <Stepper activeStep={activeStep} orientation="vertical">
        {steps.map((step, index) => {
          const isCompleted = isStepCompleted(step.status, index);
          const isCurrent = step.status === pr.status;
          const statusDate = getStatusDate(step.status);
          
          return (
            <Step key={step.status} completed={isCompleted}>
              <StepLabel
                optional={
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 0.5 }}>
                    {!step.isStandard && (
                      <Chip 
                        label={t('pr.outOfSequence')}
                        size="small"
                        color="warning"
                        sx={{ height: 20, fontSize: '0.65rem', width: 'fit-content' }}
                      />
                    )}
                    {statusDate && (
                      <Typography 
                        variant="caption" 
                        color="text.secondary"
                        sx={{ fontWeight: 'normal' }}
                      >
                        📅 {statusDate}
                      </Typography>
                    )}
                  </Box>
                }
                StepIconComponent={() => getStepIcon(step.status, index) || <div />}
                sx={{
                  '& .MuiStepLabel-label': {
                    fontWeight: isCurrent ? 'bold' : 'normal',
                    fontSize: isCurrent ? '1rem' : '0.95rem',
                    color: isCurrent ? 'primary.main' : undefined,
                  }
                }}
              >
                {step.label}
              </StepLabel>
              <StepContent>
                {isCurrent && pr.notes && (
                  <Box sx={{ mt: 1, mb: 1, p: 1.5, bgcolor: 'action.hover', borderRadius: 1, borderLeft: 3, borderColor: 'primary.main' }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontWeight: 'bold' }}>
                      Notes:
                    </Typography>
                    <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                      {pr.notes}
                    </Typography>
                  </Box>
                )}
              </StepContent>
            </Step>
          );
        })}
      </Stepper>
    </Paper>
  );
};


