import React, { useState, useMemo } from 'react';
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
  Chip,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { PRStatus, PRRequest } from '@/types/pr';
import { prService } from '@/services/pr';
import { notificationService } from '@/services/notification';
import { referenceDataService } from '@/services/referenceData';
import { User } from '@/types/user';
import { Rule } from '@/types/referenceData';
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
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [showQuoteOverrideDialog, setShowQuoteOverrideDialog] = useState(false);
  const [quoteOverrideJustification, setQuoteOverrideJustification] = useState('');
  const [quoteErrorMessage, setQuoteErrorMessage] = useState('');
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Dual approval detection
  const isDualApproval = pr.requiresDualApproval || pr.approvalWorkflow?.requiresDualApproval;
  // Check both new field (approver), legacy array (approvers[0]), and email fallback via assignedApprover
  const isFirstApprover = currentUser.id === pr.approver || 
                          currentUser.id === pr.approvers?.[0] ||
                          (assignedApprover?.email && currentUser.email && 
                           assignedApprover.email.toLowerCase() === currentUser.email.toLowerCase());
  const isSecondApprover = currentUser.id === pr.approver2 || currentUser.id === pr.approvers?.[1];
  const hasFirstApproved = pr.approvalWorkflow?.firstApprovalComplete || false;
  const hasSecondApproved = pr.approvalWorkflow?.secondApprovalComplete || false;

  // 3-Quote scenario detection
  const requires3Quotes = useMemo(() => {
    // Above Rule 2 threshold: always requires 3 quotes
    if (isDualApproval) return true;
    
    // Above Rule 1 with non-approved vendor: requires 3 quotes
    // This would require checking vendor approval status
    // For now, check if there are 3 or more quotes
    return (pr.quotes?.length || 0) >= 3;
  }, [pr.quotes, isDualApproval]);

  // Find lowest quote
  const lowestQuote = useMemo(() => {
    if (!pr.quotes || pr.quotes.length === 0) return null;
    return pr.quotes.reduce((lowest, quote) => {
      if (!lowest || quote.amount < lowest.amount) {
        return quote;
      }
      return lowest;
    });
  }, [pr.quotes]);

  // Check if there are multiple quotes to choose from
  const hasMultipleQuotes = (pr.quotes?.length || 0) > 1;

  // Check if selected quote is the lowest
  const isSelectedQuoteLowest = useMemo(() => {
    if (!selectedQuoteId || !lowestQuote) return true;
    return selectedQuoteId === lowestQuote.id;
  }, [selectedQuoteId, lowestQuote]);

  // Check if this requires adjudication (dual approval scenario - over threshold)
  const requiresAdjudication = isDualApproval;

  // Check if non-lowest quote selected
  const isNonLowestQuote = hasMultipleQuotes && !isSelectedQuoteLowest;

  // Determine notes requirements
  const notesRequired = isNonLowestQuote || requiresAdjudication;

  // Generate dynamic notes field guidance
  const getNotesGuidance = () => {
    if (selectedAction !== 'approve') {
      // For reject/revise actions
      return {
        label: 'Notes',
        placeholder: 'Provide notes for this action...',
        helperText: 'Notes are required',
        required: true
      };
    }

    // For approval actions
    if (requiresAdjudication && isNonLowestQuote) {
      // Both: Over threshold AND non-lowest quote
      return {
        label: 'Adjudication & Justification Notes',
        placeholder: 'Provide adjudication notes for this high-value PR and explain why this quote was selected over the lowest quote (e.g., better quality, faster delivery, better warranty, proven track record)...',
        helperText: 'Required: Adjudication notes and justification for non-lowest quote selection',
        required: true
      };
    } else if (requiresAdjudication) {
      // Only adjudication needed (over threshold)
      return {
        label: 'Adjudication Notes',
        placeholder: 'Provide adjudication notes for this high-value PR approval...',
        helperText: 'Required: Adjudication notes for dual-approval PR',
        required: true
      };
    } else if (isNonLowestQuote) {
      // Only justification needed (non-lowest quote)
      return {
        label: 'Justification for Non-Lowest Quote',
        placeholder: 'Explain why this quote was selected over the lowest quote (e.g., better quality, faster delivery, better warranty, proven track record)...',
        helperText: 'Required: Justification for non-lowest quote selection',
        required: true
      };
    } else {
      // Optional notes
      return {
        label: 'Notes (Optional)',
        placeholder: 'Optional notes for approval...',
        helperText: 'Optional notes for approval',
        required: false
      };
    }
  };

  const notesGuidance = getNotesGuidance();

  // Check if user has permission to take actions
  const canTakeAction = useMemo(() => {
    const isProcurement = currentUser.permissionLevel === 3; // Level 3 = Procurement Officer
    // Check both new fields (approver, approver2), legacy array (approvers), and email match as fallback
    // Email matching handles cases where user document ID doesn't match Firebase Auth UID
    const isApproverById = currentUser.id === pr.approver || 
                           currentUser.id === pr.approver2 || 
                           pr.approvers?.includes(currentUser.id) ||
                           currentUser.id === assignedApprover?.id;
    // Fallback: Check if the assigned approver's email matches current user's email
    const isApproverByEmail = assignedApprover?.email && 
                              currentUser.email && 
                              assignedApprover.email.toLowerCase() === currentUser.email.toLowerCase();
    const isApprover = isApproverById || isApproverByEmail;
    const isAdmin = currentUser.permissionLevel === 1;
    const isFinanceApprover = currentUser.permissionLevel === 4 || currentUser.permissionLevel === 6; // Level 4 = Finance Admin, Level 6 = Finance Approver

    console.log('=== Permission check DEBUG ===', JSON.stringify({
      userId: currentUser.id,
      userEmail: currentUser.email,
      assignedApproverId: assignedApprover?.id || 'UNDEFINED',
      assignedApproverEmail: assignedApprover?.email || 'UNDEFINED',
      prApprover: pr.approver || 'UNDEFINED',
      prApprover2: pr.approver2 || 'UNDEFINED',
      prApproversArray: pr.approvers || 'UNDEFINED',
      isDualApproval,
      isFirstApprover,
      isSecondApprover,
      hasFirstApproved,
      hasSecondApproved,
      quoteConflict: pr.approvalWorkflow?.quoteConflict || false,
      isProcurement,
      isApproverById,
      isApproverByEmail,
      isApprover,
      isAdmin,
      canTakeAction: isApprover || isProcurement || isAdmin,
      status: pr.status
    }, null, 2));

    // In PENDING_APPROVAL, assigned approvers can approve, procurement can reject/R&R, finance approvers can approve
    if (pr.status === PRStatus.PENDING_APPROVAL) {
      // Special case: If there's a quote conflict, approvers MUST be able to take action to resolve it
      const hasQuoteConflict = pr.approvalWorkflow?.quoteConflict === true;
      
      // For dual approval, check if this approver hasn't already acted
      // UNLESS there's a quote conflict - then they need to be able to change their selection
      if (isDualApproval && !hasQuoteConflict) {
        if (isFirstApprover && hasFirstApproved) return false; // Already approved
        if (isSecondApprover && hasSecondApproved) return false; // Already approved
      }
      // Assigned approvers, Finance Approvers, or Admin can approve
      // Procurement can reject/request revision but NOT approve
      return isApprover || isFinanceApprover || isAdmin || isProcurement;
    }

    return isProcurement || isApprover || isFinanceApprover || isAdmin;
  }, [currentUser, pr.approver, pr.approver2, pr.approvers, pr.status, pr.approvalWorkflow?.quoteConflict, isDualApproval, isFirstApprover, isSecondApprover, hasFirstApproved, hasSecondApproved, assignedApprover?.id]);

  if (!canTakeAction) {
    return null;
  }

  const getAvailableActions = () => {
    const isProcurement = currentUser.permissionLevel === 3; // Level 3 = Procurement Officer
    // Check both new fields (approver, approver2), legacy array (approvers), and email match as fallback
    const isApproverById = currentUser.id === assignedApprover?.id || 
                           currentUser.id === pr.approver || 
                           currentUser.id === pr.approver2 ||
                           pr.approvers?.includes(currentUser.id);
    const isApproverByEmail = assignedApprover?.email && 
                              currentUser.email && 
                              assignedApprover.email.toLowerCase() === currentUser.email.toLowerCase();
    const isApprover = isApproverById || isApproverByEmail;
    const isAdmin = currentUser.permissionLevel === 1;
    const isFinanceApprover = currentUser.permissionLevel === 4 || currentUser.permissionLevel === 6; // Level 4 = Finance Admin, Level 6 = Finance Approver
    
    // In PENDING_APPROVAL status
    if (pr.status === PRStatus.PENDING_APPROVAL) {
      // Assigned approvers, Finance Approvers, and Admin can approve, reject, or request revision
      if (isApprover || isFinanceApprover || isAdmin) {
        return ['approve', 'reject', 'revise'];
      }
      // Procurement can reject, request revision, or return to queue (oversight role) but NOT approve
      if (isProcurement) {
        return ['reject', 'revise', 'queue'];
      }
      return [];
    }

    // For other statuses, show all actions if user has permission
    if (isProcurement || isApprover || isFinanceApprover || isAdmin) {
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
    
    // For approval action, initialize selected quote
    if (action === 'approve' && hasMultipleQuotes) {
      // In conflict scenario, pre-select the current approver's previous choice
      if (pr.status === PRStatus.PENDING_APPROVAL && pr.approvalWorkflow?.quoteConflict) {
        const myPreviousQuoteId = isFirstApprover 
          ? pr.approvalWorkflow.firstApproverSelectedQuoteId 
          : pr.approvalWorkflow.secondApproverSelectedQuoteId;
        setSelectedQuoteId(myPreviousQuoteId || pr.preferredQuoteId || lowestQuote?.id || pr.quotes?.[0]?.id || null);
      } else {
        // Normal approval: default to procurement's preferred quote if available, otherwise lowest quote
        const defaultQuoteId = pr.preferredQuoteId || lowestQuote?.id || pr.quotes?.[0]?.id;
        setSelectedQuoteId(defaultQuoteId || null);
      }
    } else {
      setSelectedQuoteId(null);
    }
  };

  const handleClose = () => {
    setIsDialogOpen(false);
    setSelectedAction(null);
    setNotes('');
    setError(null);
    setSelectedQuoteId(null);
  };

  const handleStatusUpdate = async (newStatus: PRStatus, notes?: string) => {
    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      try {
        setLoading(true);
        await prService.updatePRStatus(pr.id, newStatus, notes, currentUser);
        enqueueSnackbar(`PR status successfully updated to ${newStatus}`, { variant: 'success' });
        if (onStatusChange) onStatusChange(); // Trigger parent refresh
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

  const handleQuoteOverrideConfirm = async () => {
    if (!quoteOverrideJustification.trim()) {
      enqueueSnackbar('Justification is required to override quote requirements', { variant: 'error' });
      return;
    }

    try {
      setLoading(true);
      
      // Save the override to the PR
      await prService.updatePR(pr.id, {
        quoteRequirementOverride: true,
        quoteRequirementOverrideJustification: quoteOverrideJustification,
        quoteRequirementOverrideBy: currentUser.id,
        quoteRequirementOverrideAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      enqueueSnackbar('Quote requirement override applied successfully', { variant: 'success' });
      
      // Close the override dialog
      setShowQuoteOverrideDialog(false);
      setQuoteOverrideJustification('');
      setQuoteErrorMessage('');
      
      // Re-trigger the submit after override is saved
      setTimeout(() => {
        handleSubmit();
      }, 500);
    } catch (error) {
      console.error('Error applying quote override:', error);
      enqueueSnackbar('Failed to apply override', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      // Validate notes for reject and revise actions
      if ((selectedAction === 'reject' || selectedAction === 'revise') && !notes.trim()) {
        setError('Notes are required when rejecting or requesting revision');
        return;
      }

      // Validate quote selection for approval with multiple quotes
      if (selectedAction === 'approve' && hasMultipleQuotes) {
        if (!selectedQuoteId) {
          setError('Please select which quote you are approving.');
          return;
        }
      }

      // Validate notes based on requirements
      if (selectedAction === 'approve' && notesRequired && !notes.trim()) {
        if (requiresAdjudication && isNonLowestQuote) {
          setError('Adjudication notes and justification for non-lowest quote selection are required.');
        } else if (requiresAdjudication) {
          setError('Adjudication notes are required for dual-approval PRs.');
        } else if (isNonLowestQuote) {
          setError('Justification is required when approving a quote that is not the lowest.');
        }
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
          // Special handling for quote conflict resolution (quoteConflict flag set in PENDING_APPROVAL)
          if (prData.status === PRStatus.PENDING_APPROVAL && prData.approvalWorkflow?.quoteConflict) {
            const isFirstAppr = currentUser.id === prData.approver;
            const isSecondAppr = currentUser.id === prData.approver2;

            // Update the approver's selected quote
            const firstQuoteId = isFirstAppr ? selectedQuoteId : prData.approvalWorkflow?.firstApproverSelectedQuoteId;
            const secondQuoteId = isSecondAppr ? selectedQuoteId : prData.approvalWorkflow?.secondApproverSelectedQuoteId;

            // Check if conflict is now resolved (both selected the same quote)
            const conflictResolved = firstQuoteId && secondQuoteId && firstQuoteId === secondQuoteId;

            console.log('Quote conflict resolution - Update check:', {
              isFirstAppr,
              isSecondAppr,
              selectedQuoteId,
              firstQuoteId,
              secondQuoteId,
              conflictResolved
            });

            // Use notes as the justification/adjudication
            const approverNotes = notes.trim() || 'Quote selection updated';

            if (conflictResolved) {
              // Conflict resolved! Move to APPROVED
              newStatus = PRStatus.APPROVED;

              // First, update the PR workflow and object type (status is handled separately)
              await prService.updatePR(pr.id, {
                objectType: 'PO',
                approvalWorkflow: {
                  ...prData.approvalWorkflow,
                  firstApproverSelectedQuoteId: firstQuoteId,
                  secondApproverSelectedQuoteId: secondQuoteId,
                  firstApproverJustification: isFirstAppr ? approverNotes : prData.approvalWorkflow?.firstApproverJustification,
                  secondApproverJustification: isSecondAppr ? approverNotes : prData.approvalWorkflow?.secondApproverJustification,
                  quoteConflict: false,
                  lastUpdated: new Date().toISOString()
                },
                updatedAt: new Date().toISOString()
              });

              // Then update the status using updatePRStatus (which handles status history)
              await prService.updatePRStatus(
                pr.id,
                newStatus,
                approverNotes || 'Quote conflict resolved',
                currentUser
              );

              await notificationService.handleStatusChange(
                pr.id,
                pr.status,
                newStatus,
                currentUser,
                `Quote conflict resolved. PR ${prData.prNumber} is now approved.`
              );

              enqueueSnackbar(`Quote conflict resolved! PR ${prData.prNumber} has been approved.`, { variant: 'success' });
              handleClose();
              if (onStatusChange) onStatusChange();
              navigate('/dashboard');
              return;
            } else {
              // Still in conflict or waiting - just update the quote selection
              await prService.updatePR(pr.id, {
                approvalWorkflow: {
                  ...prData.approvalWorkflow,
                  firstApproverSelectedQuoteId: firstQuoteId || undefined,
                  secondApproverJustification: isSecondAppr ? approverNotes : prData.approvalWorkflow?.secondApproverJustification || undefined,
                  firstApproverJustification: isFirstAppr ? approverNotes : prData.approvalWorkflow?.firstApproverJustification || undefined,
                  secondApproverSelectedQuoteId: secondQuoteId || undefined,
                  quoteConflict: true, // Still in conflict
                  lastUpdated: new Date().toISOString()
                },
                updatedAt: new Date().toISOString()
              });

              enqueueSnackbar('Your quote selection has been updated. Waiting for other approver to agree.', { variant: 'info' });
              handleClose();
              if (onStatusChange) onStatusChange();
              navigate('/dashboard');
              return;
            }
          }

          // Normal approval flow continues...
          // Get the rules for this organization from referenceData
          const rulesData = await referenceDataService.getItemsByType('rules', prData.organization);
          const rules = rulesData as unknown as Rule[];
          
          console.log('Retrieved rules for approval:', {
            organization: prData.organization,
            estimatedAmount: prData.estimatedAmount,
            rulesCount: rules?.length || 0,
            rules
          });

          if (!rules || rules.length === 0) {
            setError('No approval rules found for this organization');
            return;
          }

          // Validate the PR for approval
          console.log('Starting validation for approval:', {
            pr: prData,
            rules,
            currentUser,
            targetStatus: PRStatus.APPROVED
          });

          const validation = await validatePRForApproval(
            prData,
            rules,
            currentUser,
            PRStatus.APPROVED
          );

          console.log('Validation result for approval:', validation);

          if (!validation.isValid) {
            // Check if errors are quote-related
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
              err !== '•'
            );
            
            // If quote override exists, filter out quote errors
            if (hasQuoteErrors && prData.quoteRequirementOverride) {
              console.log('Quote override exists, filtering out quote errors');
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
              console.log('Only quote errors present and override exists - proceeding');
            } else if (hasQuoteErrors && !prData.quoteRequirementOverride) {
              // Show quote override dialog
              console.error('Validation failed with quote errors:', validation.errors);
              setQuoteErrorMessage(validation.errors.join('\n\n'));
              setShowQuoteOverrideDialog(true);
              return;
            } else {
              // Non-quote errors
              console.error('Validation failed with errors:', validation.errors);
              setError(validation.errors.join('\n\n'));
              return;
            }
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

            // Use notes field for adjudication/justification
            const approverNotes = notes.trim() || 'Approved';

            // Save selected quote IDs
            const firstQuoteId = isFirstAppr ? selectedQuoteId : prData.approvalWorkflow?.firstApproverSelectedQuoteId;
            const secondQuoteId = isSecondAppr ? selectedQuoteId : prData.approvalWorkflow?.secondApproverSelectedQuoteId;

            // Detect quote conflict (both have approved but selected different quotes)
            const quoteConflict = firstComplete && secondComplete && 
                                  firstQuoteId && secondQuoteId && 
                                  firstQuoteId !== secondQuoteId;

            console.log('Dual approval - Quote selection check:', {
              isFirstAppr,
              isSecondAppr,
              selectedQuoteId,
              firstQuoteId,
              secondQuoteId,
              firstComplete,
              secondComplete,
              quoteConflict
            });

            // Update approval workflow
            const updatedWorkflow = {
              ...prData.approvalWorkflow,
              currentApprover: prData.approver || null,
              secondApprover: prData.approver2 || null,
              requiresDualApproval: true,
              firstApprovalComplete: firstComplete,
              firstApproverSelectedQuoteId: firstQuoteId || undefined,
              firstApproverJustification: isFirstAppr ? approverNotes : (prData.approvalWorkflow?.firstApproverJustification || undefined),
              secondApprovalComplete: secondComplete,
              secondApproverSelectedQuoteId: secondQuoteId || undefined,
              secondApproverJustification: isSecondAppr ? approverNotes : (prData.approvalWorkflow?.secondApproverJustification || undefined),
              quoteConflict: quoteConflict || false,
              approvalHistory: [
                ...(prData.approvalWorkflow?.approvalHistory || []),
                {
                  approverId: currentUser.id,
                  timestamp: new Date().toISOString(),
                  approved: true,
                  notes: approverNotes
                }
              ],
              lastUpdated: new Date().toISOString()
            };

            // If both have approved, check for quote conflicts
            if (firstComplete && secondComplete) {
              if (quoteConflict) {
                // Quote conflict detected - stay in PENDING_APPROVAL but flag it
                newStatus = PRStatus.PENDING_APPROVAL; // Status stays the same
                
                await prService.updatePR(pr.id, {
                  approvalWorkflow: updatedWorkflow, // Has quoteConflict: true
                  updatedAt: new Date().toISOString()
                });

                // Notify approvers and procurement of the conflict
                // Note: We pass the same status to indicate this is a special notification
                await notificationService.handleStatusChange(
                  pr.id,
                  pr.status,
                  newStatus,
                  currentUser,
                  `QUOTE_CONFLICT: Both approvers have approved PR ${prData.prNumber}, but selected different quotes. Agreement required.`
                );

                enqueueSnackbar(
                  'Both approvers have approved different quotes. Both must agree on the same quote to proceed.', 
                  { variant: 'warning', autoHideDuration: 8000 }
                );
                
                handleClose();
                if (onStatusChange) onStatusChange();
                navigate('/dashboard');
                return;
              } else {
                // No conflict - move to APPROVED
                newStatus = PRStatus.APPROVED;
                
                // First, update the PR workflow and object type (status is handled separately)
                await prService.updatePR(pr.id, {
                  objectType: 'PO',
                  lastApprovedAmount: prData.estimatedAmount,
                  approvalWorkflow: updatedWorkflow,
                  updatedAt: new Date().toISOString()
                });

                // Then update the status using updatePRStatus (which handles status history)
                await prService.updatePRStatus(
                  pr.id,
                  newStatus,
                  notes.trim() || 'Both approvers approved',
                  currentUser
                );

                // Notify stakeholders
                await notificationService.handleStatusChange(
                  pr.id,
                  pr.status,
                  newStatus,
                  currentUser,
                  `Both approvers have approved. PR ${prData.prNumber} is now approved.`
                );

                enqueueSnackbar(`PR ${prData.prNumber} has been fully approved!`, { variant: 'success' });
              }
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
            
            // Use notes field for justification/adjudication
            const approverNotes = notes.trim() || 'Approved';
            
            // First, update the PR workflow and object type (status is handled separately)
            await prService.updatePR(pr.id, {
              objectType: 'PO',
              lastApprovedAmount: prData.estimatedAmount,
              approvalWorkflow: {
                ...prData.approvalWorkflow,
                currentApprover: prData.approver || null,
                secondApprover: null,
                requiresDualApproval: false,
                firstApprovalComplete: true,
                firstApproverSelectedQuoteId: selectedQuoteId || undefined,
                firstApproverJustification: approverNotes,
                secondApprovalComplete: false,
                quoteConflict: false,
                approvalHistory: [
                  ...(prData.approvalWorkflow?.approvalHistory || []),
                  {
                    approverId: currentUser.id,
                    timestamp: new Date().toISOString(),
                    approved: true,
                    notes: approverNotes
                  }
                ],
                lastUpdated: new Date().toISOString()
              },
              updatedAt: new Date().toISOString()
            });

            // Then update the status using updatePRStatus (which handles status history)
            await prService.updatePRStatus(
              pr.id,
              newStatus,
              approverNotes,
              currentUser
            );

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
    // Special title for quote conflict resolution
    if (pr.status === PRStatus.PENDING_APPROVAL && pr.approvalWorkflow?.quoteConflict && selectedAction === 'approve') {
      return 'Resolve Quote Conflict - Change Your Selection';
    }
    
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
      {/* Quote Conflict Alert - RED FLAGGED */}
      {pr.status === PRStatus.PENDING_APPROVAL && pr.approvalWorkflow?.quoteConflict && (
        <Alert 
          severity="error" 
          icon={<span style={{ fontSize: '24px' }}>🚩</span>}
          sx={{ 
            mb: 2,
            border: '2px solid',
            borderColor: 'error.main',
            backgroundColor: 'error.light',
            '& .MuiAlert-message': {
              width: '100%'
            }
          }}
        >
          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold', color: 'error.dark' }}>
            ⚠️ QUOTE CONFLICT - RED FLAGGED
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Both approvers have approved this PR but selected different quotes:
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1, p: 1, bgcolor: 'background.paper', borderRadius: 1 }}>
            {pr.approvalWorkflow.firstApproverSelectedQuoteId && (
              <Box>
                <strong>Approver 1 selected:</strong>{' '}
                {pr.quotes?.find(q => q.id === pr.approvalWorkflow?.firstApproverSelectedQuoteId)?.vendorName || 'Unknown'} -{' '}
                {pr.quotes?.find(q => q.id === pr.approvalWorkflow?.firstApproverSelectedQuoteId)?.amount.toFixed(2)}{' '}
                {pr.quotes?.find(q => q.id === pr.approvalWorkflow?.firstApproverSelectedQuoteId)?.currency}
              </Box>
            )}
            {pr.approvalWorkflow.secondApproverSelectedQuoteId && (
              <Box>
                <strong>Approver 2 selected:</strong>{' '}
                {pr.quotes?.find(q => q.id === pr.approvalWorkflow?.secondApproverSelectedQuoteId)?.vendorName || 'Unknown'} -{' '}
                {pr.quotes?.find(q => q.id === pr.approvalWorkflow?.secondApproverSelectedQuoteId)?.amount.toFixed(2)}{' '}
                {pr.quotes?.find(q => q.id === pr.approvalWorkflow?.secondApproverSelectedQuoteId)?.currency}
              </Box>
            )}
          </Box>
          <Typography variant="body2" sx={{ mt: 2, fontWeight: 'bold', color: 'error.dark' }}>
            🔴 ACTION REQUIRED: One or both approvers must change their selection to the same quote to proceed.
          </Typography>
          <Typography variant="caption" display="block" sx={{ mt: 1, fontStyle: 'italic' }}>
            Daily reminder notifications will be sent until this conflict is resolved.
          </Typography>
        </Alert>
      )}

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
            {t('pr.approvePR')}
          </Button>
        )}
        {actions.includes('reject') && (
          <Button
            variant="contained"
            color="error"
            onClick={() => handleActionClick('reject')}
          >
            {t('pr.rejectPR')}
          </Button>
        )}
        {actions.includes('revise') && (
          <Button
            variant="contained"
            color="warning"
            onClick={() => handleActionClick('revise')}
          >
            {t('pr.reviseAndResubmit')}
          </Button>
        )}
        {actions.includes('queue') && (
          <Button
            variant="contained"
            color="info"
            onClick={() => handleActionClick('queue')}
          >
            {t('pr.returnToQueue')}
          </Button>
        )}
      </Stack>

      {/* Action dialog */}
      <Dialog open={isDialogOpen} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>{getDialogTitle()}</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2, whiteSpace: 'pre-line' }}>
              {error}
            </Alert>
          )}

          {/* Quote Selection UI (for approval with multiple quotes) */}
          {selectedAction === 'approve' && hasMultipleQuotes && (
            <Box sx={{ mb: 3 }}>
              {/* Show conflict context if in conflict mode */}
              {pr.status === PRStatus.PENDING_APPROVAL && pr.approvalWorkflow?.quoteConflict && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    You are resolving a quote conflict
                  </Typography>
                  <Typography variant="body2">
                    You and the other approver selected different quotes. Review the selections below and change your choice if needed to match.
                  </Typography>
                </Alert>
              )}
              
              <Typography variant="subtitle2" gutterBottom>
                Select Quote to Approve:
              </Typography>
              {pr.quotes.map((quote) => {
                const isLowest = quote.id === lowestQuote?.id;
                const isPreferred = quote.id === pr.preferredQuoteId;
                const isSelected = quote.id === selectedQuoteId;
                
                // Check if this quote was selected by approvers in conflict scenario
                const inConflictMode = pr.status === PRStatus.PENDING_APPROVAL && pr.approvalWorkflow?.quoteConflict;
                const isMyPreviousSelection = inConflictMode && (
                  (isFirstApprover && quote.id === pr.approvalWorkflow?.firstApproverSelectedQuoteId) ||
                  (isSecondApprover && quote.id === pr.approvalWorkflow?.secondApproverSelectedQuoteId)
                );
                const isOtherApproverSelection = inConflictMode && (
                  (isFirstApprover && quote.id === pr.approvalWorkflow?.secondApproverSelectedQuoteId) ||
                  (isSecondApprover && quote.id === pr.approvalWorkflow?.firstApproverSelectedQuoteId)
                );
                
                return (
                  <Box
                    key={quote.id}
                    sx={{
                      p: 2,
                      mb: 1,
                      border: isSelected ? 2 : 1,
                      borderColor: isSelected ? 'primary.main' : 'divider',
                      borderRadius: 1,
                      cursor: 'pointer',
                      bgcolor: isSelected ? 'action.selected' : 'background.paper',
                      '&:hover': { bgcolor: 'action.hover' }
                    }}
                    onClick={() => setSelectedQuoteId(quote.id || null)}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle2">
                          {quote.vendorName}
                        </Typography>
                        <Typography variant="body1" color="primary" sx={{ mb: 1 }}>
                          {quote.amount.toFixed(2)} {quote.currency}
                        </Typography>
                        <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ gap: 0.5 }}>
                          {isPreferred && (
                            <Chip label="Procurement Preferred" size="small" color="info" />
                          )}
                          {isLowest && (
                            <Chip label="Lowest Quote" size="small" color="success" />
                          )}
                          {isMyPreviousSelection && (
                            <Chip label="Your Previous Selection" size="small" color="warning" />
                          )}
                          {isOtherApproverSelection && (
                            <Chip label="Other Approver's Selection" size="small" color="error" />
                          )}
                        </Stack>
                      </Box>
                      {isSelected && (
                        <Chip label="✓ Current Selection" color="primary" size="small" />
                      )}
                    </Stack>
                  </Box>
                );
              })}
            </Box>
          )}

          {/* Alert for non-lowest quote or adjudication requirements */}
          {selectedAction === 'approve' && (isNonLowestQuote || requiresAdjudication) && (
            <Alert severity="info" sx={{ mb: 2 }}>
              {requiresAdjudication && isNonLowestQuote && (
                <>
                  <Typography variant="subtitle2" gutterBottom>
                    Adjudication & Justification Required
                  </Typography>
                  <Typography variant="body2">
                    This is a high-value PR requiring dual approval. Additionally, you have selected a quote that is NOT the lowest. 
                    Please provide comprehensive notes covering both adjudication reasoning and justification for the non-lowest quote selection.
                  </Typography>
                  {lowestQuote && (
                    <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                      Lowest quote: {lowestQuote.vendorName} - {lowestQuote.amount.toFixed(2)} {lowestQuote.currency}
                    </Typography>
                  )}
                </>
              )}
              {requiresAdjudication && !isNonLowestQuote && (
                <>
                  <Typography variant="subtitle2" gutterBottom>
                    Adjudication Notes Required
                  </Typography>
                  <Typography variant="body2">
                    This is a high-value PR requiring dual approval. Please provide adjudication notes explaining your approval decision.
                  </Typography>
                </>
              )}
              {!requiresAdjudication && isNonLowestQuote && (
                <>
                  <Typography variant="subtitle2" gutterBottom>
                    Justification Required
                  </Typography>
                  <Typography variant="body2">
                    You have selected a quote that is NOT the lowest. Please provide justification for selecting this quote.
                  </Typography>
                  {lowestQuote && (
                    <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                      Lowest quote: {lowestQuote.vendorName} - {lowestQuote.amount.toFixed(2)} {lowestQuote.currency}
                    </Typography>
                  )}
                </>
              )}
            </Alert>
          )}

          {/* Single unified notes field with dynamic guidance */}
          <TextField
            autoFocus
            margin="dense"
            label={notesGuidance.label}
            fullWidth
            multiline
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={notesGuidance.placeholder}
            required={notesGuidance.required}
            error={notesGuidance.required && !notes.trim()}
            helperText={notesGuidance.required && !notes.trim() ? notesGuidance.helperText : notesGuidance.helperText}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>{t('common.cancel')}</Button>
          <Button onClick={handleSubmit} variant="contained" color="primary" disabled={loading}>
            {t('common.submit')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Quote Requirement Override Dialog */}
      <Dialog
        open={showQuoteOverrideDialog}
        onClose={() => {
          setShowQuoteOverrideDialog(false);
          setQuoteOverrideJustification('');
          setQuoteErrorMessage('');
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ bgcolor: 'warning.light' }}>
          ⚠️ {t('pr.quoteRequirementOverrideTitle')}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Alert severity="error" sx={{ mb: 2 }}>
              <strong>{t('pr.validationIssue')}</strong>
              <br />
              <Typography variant="body2" component="div" sx={{ whiteSpace: 'pre-wrap', mt: 1 }}>
                {quoteErrorMessage}
              </Typography>
            </Alert>
            <Typography variant="body2" sx={{ mb: 2 }}>
              {t('pr.quoteRequirementOverrideApproverDesc')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t('pr.ruleOverrideNote')}
            </Typography>
            <TextField
              label={`${t('pr.justification')} *`}
              multiline
              rows={4}
              fullWidth
              value={quoteOverrideJustification}
              onChange={(e) => setQuoteOverrideJustification(e.target.value)}
              placeholder={t('pr.quoteOverridePlaceholder')}
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
              setQuoteErrorMessage('');
            }}
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleQuoteOverrideConfirm}
            variant="contained"
            color="warning"
            disabled={!quoteOverrideJustification.trim() || loading}
          >
            {t('pr.applyOverride')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
