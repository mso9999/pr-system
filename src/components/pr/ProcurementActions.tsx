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
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { PRStatus } from '@/types/pr';
import { prService } from '@/services/pr';
import { notificationService } from '@/services/notification';
import { User } from '@/types/user';
import { validatePRForApproval } from '@/utils/prValidation';
import { referenceDataService } from '@/services/referenceData';
import { Rule } from '@/types/referenceData';
import { convertAmountWithMetadata, getRuleCurrency, ConversionResult } from '@/utils/currencyConverter';

interface ProcurementActionsProps {
  prId: string;
  currentStatus: PRStatus;
  requestorEmail: string;
  currentUser: User;
  onStatusChange: () => void;
}

export function ProcurementActions({ prId, currentStatus, requestorEmail, currentUser, onStatusChange }: ProcurementActionsProps) {
  const { t } = useTranslation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<'approve' | 'reject' | 'revise' | 'cancel' | 'queue' | 'revert' | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();

  // Quote requirement override state
  const [showQuoteOverrideDialog, setShowQuoteOverrideDialog] = useState(false);
  const [quoteOverrideJustification, setQuoteOverrideJustification] = useState('');
  const [quoteErrorMessage, setQuoteErrorMessage] = useState('');

  const handleActionClick = (action: 'approve' | 'reject' | 'revise' | 'cancel' | 'queue' | 'revert') => {
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

  const handleQuoteOverrideConfirm = async () => {
    if (!quoteOverrideJustification.trim()) {
      enqueueSnackbar('Justification is required for override', { variant: 'error' });
      return;
    }

    try {
      // Save the override to the PR
      await prService.updatePR(prId, {
        quoteRequirementOverride: true,
        quoteRequirementOverrideJustification: quoteOverrideJustification,
        quoteRequirementOverrideBy: currentUser.id,
        quoteRequirementOverrideAt: new Date().toISOString(),
      });

      enqueueSnackbar('Quote requirement override applied', { variant: 'success' });
      setShowQuoteOverrideDialog(false);
      setQuoteOverrideJustification('');
      
      // Re-trigger the submit to proceed with the override
      handleSubmit();
    } catch (error) {
      console.error('Error applying quote override:', error);
      enqueueSnackbar('Failed to apply override', { variant: 'error' });
    }
  };

  const handleSubmit = async () => {
    console.log('[ProcurementActions] handleSubmit called:', {
      selectedAction,
      prId,
      notesLength: notes?.length || 0
    });
    try {
      // Validate notes for reject and revise actions
      if ((selectedAction === 'reject' || selectedAction === 'revise') && !notes.trim()) {
        setError('Notes are required when rejecting or requesting revision');
        return;
      }

      console.log('[ProcurementActions] Fetching PR data...');
      // Get the PR data
      const pr = await prService.getPR(prId);
      if (!pr) {
        setError('PR not found');
        return;
      }
      console.log('[ProcurementActions] PR data fetched:', {
        id: pr.id,
        status: pr.status,
        paymentType: pr.paymentType,
        quoteRequirementOverride: pr.quoteRequirementOverride,
        approver: pr.approver
      });

      let newStatus: PRStatus;
      switch (selectedAction) {
        case 'approve':
          console.log('[ProcurementActions] Processing approve action...');
          // Get the rules for this organization from referenceData
          const rulesData = await referenceDataService.getItemsByType('rules', pr.organization);
          const rules = rulesData as unknown as Rule[];
          
          console.log('Retrieved rules:', {
            organization: pr.organization,
            estimatedAmount: pr.estimatedAmount,
            rulesCount: rules?.length || 0,
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
              // Check if the errors are quote-related and if override is not already set
              const hasQuoteErrors = validation.errors.some(err => 
                err.includes('QUOTE REQUIREMENTS:') || 
                err.includes('quote') || 
                err.includes('quotes')
              );
              
              const hasNonQuoteErrors = validation.errors.some(err => 
                !err.includes('QUOTE REQUIREMENTS:') && 
                !err.includes('quote') && 
                !err.includes('quotes') &&
                err.trim() !== '' &&
                err !== '•' // Filter out bullet points
              );
              
              // If there are quote errors and override exists, filter them out
              if (hasQuoteErrors && pr.quoteRequirementOverride) {
                console.log('Quote override exists, filtering out quote errors');
                
                // If there are other non-quote errors, show those
                if (hasNonQuoteErrors) {
                  const nonQuoteErrors = validation.errors.filter(err => 
                    !err.includes('QUOTE REQUIREMENTS:') && 
                    !err.includes('quote') && 
                    !err.includes('quotes') &&
                    err.trim() !== '' &&
                    err !== '•'
                  );
                  setError(nonQuoteErrors.join('\n\n'));
                  return;
                }
                // Otherwise, validation passes (quote errors are overridden)
                console.log('Only quote errors present and override exists - proceeding');
                // Continue to next validation steps
              } else if (hasQuoteErrors && !pr.quoteRequirementOverride) {
                // Show override dialog for quote requirements
                setQuoteErrorMessage(validation.errors.join('\n\n'));
                setShowQuoteOverrideDialog(true);
                return;
              } else {
                // For other errors, show regular error
                setError(validation.errors.join('\n\n')); // Add double newline for better separation
                return;
              }
            }

            // Additional validation: Check if notes are required for non-lowest quote selection
            // This applies only in dual approval scenarios (amount > Rule 3)
            const rule3 = rules.find(r => (r as any).number === 3 || (r as any).number === '3');
            const rule5 = rules.find(r => (r as any).number === 5 || (r as any).number === '5');
            
            if (rule3 && rule5 && pr.estimatedAmount >= rule3.threshold) {
              // This is a dual approval scenario (requires 2 approvers)
              const quotes = pr.quotes || [];
              
              if (quotes.length > 1) {
                // Multiple quotes exist - check if lowest was selected
                const lowestQuote = quotes.reduce((lowest, quote) => {
                  return (quote.amount < lowest.amount) ? quote : lowest;
                });
                
                const preferredQuote = quotes.find(q => q.id === pr.preferredQuoteId);
                
                console.log('Non-lowest quote check:', {
                  quotesCount: quotes.length,
                  lowestQuoteAmount: lowestQuote.amount,
                  lowestQuoteId: lowestQuote.id,
                  preferredQuoteId: pr.preferredQuoteId,
                  preferredQuoteAmount: preferredQuote?.amount,
                  notesProvided: !!notes.trim(),
                  isDualApproval: true,
                  rule3Threshold: rule3.threshold
                });
                
                // If a preferred quote is selected and it's NOT the lowest
                if (preferredQuote && preferredQuote.id !== lowestQuote.id) {
                  if (!notes.trim()) {
                    setError(
                      `JUSTIFICATION REQUIRED:\n\n` +
                      `You have selected a quote (${preferredQuote.amount.toLocaleString()} ${pr.currency}) that is NOT the lowest quote (${lowestQuote.amount.toLocaleString()} ${pr.currency}).\n\n` +
                      `For high-value PRs requiring dual approval, you must provide notes explaining why a more expensive quote was selected.`
                    );
                    return;
                  }
                }
              }
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

          // Validate Payment Type is set before moving to PENDING_APPROVAL
          console.log('[ProcurementActions] Checking Payment Type:', {
            paymentType: pr.paymentType,
            isEmpty: !pr.paymentType || pr.paymentType.trim() === '',
            prId: pr.id,
            prNumber: pr.prNumber
          });
          if (!pr.paymentType || pr.paymentType.trim() === '') {
            const errorMsg = 'Payment Type is required before moving to PENDING_APPROVAL. Please set the Payment Type field in the PR details.';
            console.error('[ProcurementActions] Payment Type validation failed:', errorMsg);
            setError(errorMsg);
            return;
          }
          console.log('[ProcurementActions] Payment Type validation passed, proceeding to status update');

          // Determine if dual approval is required (above Rule 3 threshold - high-value PRs)
          // Rule 3 is the high-value threshold that triggers dual approval requirement (Rule 5)
          const rule3 = rules?.find((r: Rule) => (r as any).number === 3 || (r as any).number === '3');
          const rule5 = rules?.find((r: Rule) => (r as any).number === 5 || (r as any).number === '5');
          
          // Convert PR amount to rule currency for proper threshold comparison
          let requiresDualApproval = false;
          let conversionResult: ConversionResult | null = null;
          const rule3Currency = rule3 ? getRuleCurrency(rule3) : 'LSL';
          
          if (rule3 && rule5) {
            conversionResult = await convertAmountWithMetadata(
              pr.estimatedAmount || 0,
              pr.currency || 'LSL',
              rule3Currency
            );
            requiresDualApproval = conversionResult.convertedAmount >= rule3.threshold;
            
            console.log('[ProcurementActions] Dual approval threshold check with currency conversion:', {
              originalAmount: conversionResult.originalAmount,
              originalCurrency: conversionResult.originalCurrency,
              convertedAmount: conversionResult.convertedAmount,
              ruleCurrency: conversionResult.targetCurrency,
              exchangeRate: conversionResult.exchangeRate,
              rateSource: conversionResult.rateSource,
              apiProvider: conversionResult.apiProvider,
              rule3Threshold: rule3.threshold,
              requiresDualApproval
            });
          }

          // Helper to check if an approver value is valid (not null, undefined, empty, or placeholder)
          const isValidApprover = (approverId: string | null | undefined): boolean => {
            if (!approverId) return false;
            const trimmed = approverId.trim().toLowerCase();
            return trimmed !== '' && 
                   trimmed !== '(not set)' && 
                   trimmed !== 'not set' && 
                   trimmed !== 'none' &&
                   trimmed !== 'null' &&
                   trimmed !== 'undefined';
          };

          // Validate second approver is set for dual approval PRs
          if (requiresDualApproval) {
            const hasValidApprover1 = isValidApprover(pr.approver);
            const hasValidApprover2 = isValidApprover(pr.approver2);
            
            console.log('[ProcurementActions] Dual approval validation:', {
              requiresDualApproval,
              approver: pr.approver,
              approver2: pr.approver2,
              hasValidApprover1,
              hasValidApprover2,
              rule3Threshold: rule3?.threshold,
              rule3Currency,
              estimatedAmount: pr.estimatedAmount,
              convertedAmount: conversionResult?.convertedAmount
            });

            if (!hasValidApprover1) {
              setError('A primary approver must be assigned before pushing to approval.');
              return;
            }

            if (!hasValidApprover2) {
              // Show both original and converted amounts if currencies differ
              const prCurrency = pr.currency || 'LSL';
              const convertedAmount = conversionResult?.convertedAmount || pr.estimatedAmount || 0;
              const amountDisplay = prCurrency !== rule3Currency 
                ? `${pr.estimatedAmount?.toLocaleString()} ${prCurrency} (${convertedAmount.toLocaleString()} ${rule3Currency})`
                : `${pr.estimatedAmount?.toLocaleString()} ${rule3Currency}`;
              setError(
                `SECOND APPROVER REQUIRED:\n\n` +
                `This PR amount (${amountDisplay}) exceeds the dual approval threshold (${rule3?.threshold?.toLocaleString()} ${rule3Currency}).\n\n` +
                `Please assign a second approver before pushing to approval. You can do this by editing the PR and selecting a second approver from the dropdown.`
              );
              return;
            }
          }

          // Change designation from PR to PO
          const poNumber = pr.prNumber.replace('PR', 'PO');
          newStatus = PRStatus.PENDING_APPROVAL;
          
          console.log('[ProcurementActions] Updating PR with:', {
            poNumber,
            newStatus,
            requiresDualApproval,
            currentUser: { id: currentUser.id, email: currentUser.email },
            prId: pr.id
          });

          console.log('[ProcurementActions] Calling prService.updatePR...');
          // Update PR with PO number, dual approval settings, approver information, and exchange rate audit trail
          // This must happen BEFORE sending notifications so handlers can fetch the updated PR
          const updateData: any = {
            prNumber: poNumber,
            status: newStatus,
            approver: pr.approver || null,  // Top-level approver field for notification handler
            approver2: pr.approver2 || null,  // Top-level approver2 field for notification handler
            requiresDualApproval: requiresDualApproval || false,
            updatedAt: new Date().toISOString(),
            approvalWorkflow: {
              currentApprover: pr.approver || null,
              secondApprover: pr.approver2 || null,
              requiresDualApproval: requiresDualApproval || false,
              firstApprovalComplete: false,
              secondApprovalComplete: false,
              approvalHistory: [],
              lastUpdated: new Date().toISOString()
            }
          };
          
          // Add exchange rate audit trail if currency conversion was performed
          if (conversionResult && conversionResult.originalCurrency !== conversionResult.targetCurrency) {
            updateData.thresholdExchangeRate = {
              fromCurrency: conversionResult.originalCurrency,
              toCurrency: conversionResult.targetCurrency,
              rate: conversionResult.exchangeRate,
              source: conversionResult.rateSource,
              apiProvider: conversionResult.apiProvider || undefined,
              fetchedAt: conversionResult.rateTimestamp,
              originalAmount: conversionResult.originalAmount,
              convertedAmount: conversionResult.convertedAmount
            };
            console.log('[ProcurementActions] Recording exchange rate for audit trail:', updateData.thresholdExchangeRate);
          }
          
          await prService.updatePR(prId, updateData);
          console.log('[ProcurementActions] PR updated successfully, now updating status history...');

          // Update status history separately
          await prService.updatePRStatus(prId, newStatus, notes, currentUser);
          console.log('[ProcurementActions] Status history updated successfully');

          // Send notification to approver(s)
          // This happens AFTER the PR is fully updated in Firestore
          if (requiresDualApproval) {
            // Notify both approvers simultaneously
            await notificationService.handleStatusChange(
              pr.id || prId,
              pr.status,
              newStatus,
              currentUser,
              notes || `PR ${pr.prNumber} has been converted to PO ${poNumber} and requires dual approval. Both approvers will be notified.`
            );
          } else {
            // Notify single approver
            await notificationService.handleStatusChange(
              pr.id || prId,
              pr.status,
              newStatus,
              currentUser,
              notes || `PR ${pr.prNumber} has been converted to PO ${poNumber} and is pending your approval.`
            );
          }
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

        case 'revert':
          // Get the previous status from statusHistory
          if (!pr.statusHistory || pr.statusHistory.length < 2) {
            setError('Cannot determine previous status. Status history is insufficient.');
            return;
          }
          
          // statusHistory is ordered chronologically, most recent first
          // Current status is at index 0, so previous status is at index 1
          const sortedHistory = [...pr.statusHistory].sort((a, b) => 
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
          
          const previousStatus = sortedHistory[1]?.status;
          
          if (!previousStatus || previousStatus === PRStatus.REVISION_REQUIRED) {
            setError('Cannot revert: No valid previous status found.');
            return;
          }
          
          console.log('Reverting from REVISION_REQUIRED to:', previousStatus);
          newStatus = previousStatus;
          break;

        default:
          return;
      }

      // For push to approver, ensure we have an approver
      if (selectedAction === 'approve' && !pr.approver) {
        setError('Cannot push to approval - no approver assigned');
        return;
      }

      // Update PR status in Firestore FIRST (skip for 'approve' as it's already done in the switch case)
      if (selectedAction !== 'approve') {
        await prService.updatePRStatus(prId, newStatus, notes, currentUser);
      }

      // Send notifications AFTER the status is updated in Firestore
      // This ensures handlers can fetch the updated PR data
      if (selectedAction !== 'approve') {
        // Determine the appropriate message based on action
        let notificationMessage = notes || '';
        switch (selectedAction) {
          case 'reject':
            notificationMessage = notes || 'PR rejected';
            break;
          case 'revise':
            notificationMessage = notes || 'PR requires revision';
            break;
          case 'cancel':
            notificationMessage = notes || 'PR canceled by requestor';
            break;
          case 'queue':
            notificationMessage = notes || 'PR moved to queue';
            break;
          case 'revert':
            notificationMessage = notes || `PR reverted to ${newStatus} from revision required`;
            break;
        }

        await notificationService.handleStatusChange(
          pr.id || prId,
          pr.status,
          newStatus,
          currentUser,
          notificationMessage
        );
      }

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
  // Normalize permission level to number (Firestore may return string)
  const permissionLevel = typeof currentUser.permissionLevel === 'number' 
    ? currentUser.permissionLevel 
    : Number(currentUser.permissionLevel) || 0;
  const isProcurement = permissionLevel === 3; // Level 3 = Procurement Officer
  const isAdmin = permissionLevel === 1; // Level 1 = Superadmin
  const isRequestor = currentUser.email.toLowerCase() === requestorEmail.toLowerCase();

  if (!isProcurement && !isRequestor && !isAdmin) {
    return null;
  }

  // For SUBMITTED or RESUBMITTED status - Procurement and Admin actions (check this FIRST)
  if ((isProcurement || isAdmin) && (currentStatus === PRStatus.SUBMITTED || currentStatus === PRStatus.RESUBMITTED)) {
    return (
      <>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: { xs: 1, sm: 2 }, mb: 3 }}>
          <Button
            variant="contained"
            color="primary"
            onClick={() => handleActionClick('queue' as const)}
            fullWidth
            sx={{ minHeight: '44px' }}
          >
            Move to Queue
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => handleActionClick('reject')}
            fullWidth
            sx={{ minHeight: '44px' }}
          >
            Reject
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={() => handleActionClick('revise')}
            fullWidth
            sx={{ minHeight: '44px' }}
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
              <Alert severity="error" sx={{ mb: 2, whiteSpace: 'pre-line' }}>
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

  // For IN_QUEUE status - Procurement and Admin actions
  if (currentStatus === PRStatus.IN_QUEUE && (isProcurement || isAdmin)) {
    return (
      <>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: { xs: 1, sm: 2 }, mb: 3 }}>
          <Button
            variant="contained"
            color="primary"
            onClick={() => handleActionClick('approve')}
            fullWidth
            sx={{ minHeight: '44px' }}
          >
            {t('pr.pushToApprover')}
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => handleActionClick('reject')}
            fullWidth
            sx={{ minHeight: '44px' }}
          >
            {t('pr.rejectPR')}
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={() => handleActionClick('revise')}
            fullWidth
            sx={{ minHeight: '44px' }}
          >
            {t('pr.reviseAndResubmit')}
          </Button>
        </Box>
        <Dialog 
          open={isDialogOpen} 
          onClose={handleClose} 
          maxWidth="sm" 
          fullWidth
        >
          <DialogTitle>
            {selectedAction === 'approve' && t('pr.pushToApprover')}
            {selectedAction === 'reject' && t('pr.rejectPR')}
            {selectedAction === 'revise' && t('pr.revisionRequired')}
          </DialogTitle>
          <DialogContent>
            {error && (
              <Alert severity="error" sx={{ mb: 2, whiteSpace: 'pre-line' }}>
                {error}
              </Alert>
            )}
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                {selectedAction === 'approve' && t('pr.addNotes')}
                {selectedAction === 'reject' && 'Please provide a reason for rejecting this PR.'}
                {selectedAction === 'revise' && 'Please specify what changes are needed for this PR.'}
              </Typography>
              <TextField
                autoFocus
                multiline
                rows={4}
                label={t('pr.notes')}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                required={selectedAction === 'reject' || selectedAction === 'revise'}
                error={!!error}
                fullWidth
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose}>{t('common.cancel')}</Button>
            <Button onClick={handleSubmit} variant="contained" color="primary">
              {t('common.confirm')}
            </Button>
          </DialogActions>
        </Dialog>
        
        {/* Quote Requirement Override Dialog */}
        <Dialog
          open={showQuoteOverrideDialog}
          onClose={() => {
            setShowQuoteOverrideDialog(false);
            setQuoteOverrideJustification('');
          }}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle sx={{ bgcolor: 'warning.light' }}>
            ⚠️ {t('pr.quoteRequirementOverrideTitle')}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 2 }}>
              <Alert severity="error" sx={{ mb: 2, whiteSpace: 'pre-line' }}>
                <strong>Validation Issue:</strong>
                <br />
                {quoteErrorMessage}
              </Alert>
              
              <Typography variant="body2" sx={{ mb: 2 }}>
                {t('pr.quoteRequirementOverrideDesc')}
              </Typography>
              
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                <strong>Note:</strong> This override will be logged and visible in the PR audit trail.
                Only authorized users (Admin, Procurement) should approve quote overrides.
              </Typography>

              <TextField
                label={t('pr.justification')}
                multiline
                rows={4}
                fullWidth
                value={quoteOverrideJustification}
                onChange={(e) => setQuoteOverrideJustification(e.target.value)}
                placeholder="Explain why this PR should be allowed to proceed despite not meeting the standard quote requirements (e.g., single source supplier, emergency procurement, time-sensitive requirement, vendor exclusivity)..."
                required
                sx={{ mt: 1 }}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setShowQuoteOverrideDialog(false);
                setQuoteOverrideJustification('');
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleQuoteOverrideConfirm}
              variant="contained"
              color="warning"
              disabled={!quoteOverrideJustification.trim()}
            >
              Apply Override
            </Button>
          </DialogActions>
        </Dialog>
      </>
    );
  }

  // For REVISION_REQUIRED status - Procurement and Admin actions
  // Procurement/Admin can only: 1) Revert to previous status, or 2) Reject
  if (currentStatus === PRStatus.REVISION_REQUIRED && (isProcurement || isAdmin)) {
    return (
      <>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: { xs: 1, sm: 2 }, mb: 3 }}>
          <Button
            variant="contained"
            color="primary"
            onClick={() => handleActionClick('revert')}
            fullWidth
            sx={{ minHeight: '44px' }}
          >
            Revert to Previous Status
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => handleActionClick('reject')}
            fullWidth
            sx={{ minHeight: '44px' }}
          >
            Reject PR
          </Button>
        </Box>
        <Dialog 
          open={isDialogOpen} 
          onClose={handleClose} 
          maxWidth="sm" 
          fullWidth
        >
          <DialogTitle>
            {selectedAction === 'revert' && 'Revert to Previous Status'}
            {selectedAction === 'reject' && 'Reject Purchase Request'}
          </DialogTitle>
          <DialogContent>
            {error && (
              <Alert severity="error" sx={{ mb: 2, whiteSpace: 'pre-line' }}>
                {error}
              </Alert>
            )}
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                {selectedAction === 'revert' && 'The PR will be moved back to its previous status before it was marked for revision. Please add notes explaining why the revision is no longer needed.'}
                {selectedAction === 'reject' && 'This PR will be permanently rejected. Please provide a reason for rejection.'}
              </Typography>
              <TextField
                autoFocus
                multiline
                rows={4}
                label="Notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                required
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

  // Show cancel button for requestor in appropriate statuses (only if NOT procurement/admin)
  if (isRequestor && !isProcurement && !isAdmin && (
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

  return null;
}
