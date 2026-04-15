import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  TextField,
  Alert,
  Box,
  Chip,
  Divider,
  Paper,
  CircularProgress,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { PRRequest, PendingAmendment, UserReference, LineItem } from '@/types/pr';
import { prService } from '@/services/pr';
import { formatCurrency } from '@/utils/formatters';
import { User } from '@/types/user';

interface AmendmentReviewProps {
  open: boolean;
  onClose: () => void;
  pr: PRRequest;
  currentUser: User;
  onResolved: () => void;
}

const FIELD_LABELS: Record<string, string> = {
  description: 'Description',
  department: 'Department',
  projectCategory: 'Category',
  sites: 'Sites',
  expenseType: 'Expense Type',
  vehicle: 'Vehicle',
  estimatedAmount: 'Estimated Amount',
  currency: 'Currency',
  requiredDate: 'Required Date',
  preferredVendor: 'Preferred Vendor',
  selectedVendor: 'Selected Vendor',
  comments: 'Comments',
  paymentType: 'Payment Type',
  isUrgent: 'Urgent',
  incoterms: 'Incoterms',
  lineItems: 'Line Items',
  approver: 'Approver',
  approver2: 'Second Approver',
};

function formatValue(key: string, value: any, currency?: string): string {
  if (value === null || value === undefined) return '—';
  if (key === 'estimatedAmount' || key === 'totalAmount' || key === 'finalPrice') {
    return formatCurrency(value, currency || 'USD');
  }
  if (key === 'isUrgent') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) {
    if (key === 'sites') return value.join(', ');
    if (key === 'lineItems') return `${value.length} item(s)`;
    return JSON.stringify(value);
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function LineItemDiff({ oldItems, newItems }: { oldItems: LineItem[]; newItems: LineItem[] }) {
  const maxLen = Math.max(oldItems.length, newItems.length);
  if (maxLen === 0) return null;

  return (
    <TableContainer component={Paper} variant="outlined" sx={{ mt: 1 }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>#</TableCell>
            <TableCell>Description</TableCell>
            <TableCell align="right">Qty (Old)</TableCell>
            <TableCell align="right">Qty (New)</TableCell>
            <TableCell>Change</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {Array.from({ length: maxLen }).map((_, i) => {
            const oldItem = oldItems[i];
            const newItem = newItems[i];
            const descChanged = oldItem?.description !== newItem?.description;
            const qtyChanged = oldItem?.quantity !== newItem?.quantity;
            const isAdded = !oldItem && newItem;
            const isRemoved = oldItem && !newItem;

            return (
              <TableRow key={i} sx={{
                bgcolor: isAdded ? 'success.50' : isRemoved ? 'error.50' : qtyChanged || descChanged ? 'warning.50' : undefined,
              }}>
                <TableCell>{i + 1}</TableCell>
                <TableCell sx={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {newItem?.description || oldItem?.description || '—'}
                  {descChanged && !isAdded && !isRemoved && (
                    <Typography variant="caption" display="block" color="text.secondary" sx={{ textDecoration: 'line-through' }}>
                      {oldItem?.description}
                    </Typography>
                  )}
                </TableCell>
                <TableCell align="right">{oldItem?.quantity ?? '—'}</TableCell>
                <TableCell align="right" sx={{ fontWeight: qtyChanged ? 'bold' : 'normal' }}>
                  {newItem?.quantity ?? '—'}
                </TableCell>
                <TableCell>
                  {isAdded && <Chip label="Added" size="small" color="success" />}
                  {isRemoved && <Chip label="Removed" size="small" color="error" />}
                  {!isAdded && !isRemoved && (qtyChanged || descChanged) && <Chip label="Modified" size="small" color="warning" />}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export function AmendmentReview({ open, onClose, pr, currentUser, onResolved }: AmendmentReviewProps) {
  const { enqueueSnackbar } = useSnackbar();
  const [resolverNotes, setResolverNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const amendment = pr.pendingAmendment;
  if (!amendment || amendment.status !== 'PENDING') return null;

  const diff = prService.computeAmendmentDiff(pr, amendment.changes);
  const diffEntries = Object.entries(diff);
  const hasLineItemChanges = 'lineItems' in diff;

  const isDualApproval = pr.requiresDualApproval || pr.approvalWorkflow?.requiresDualApproval;
  const isApprover1 = currentUser.id === pr.approver || currentUser.id === pr.approvalWorkflow?.currentApprover;
  const isApprover2 = currentUser.id === pr.approver2 || currentUser.id === pr.approvalWorkflow?.secondApprover;
  const isAdmin = currentUser.permissionLevel === 1;
  const canResolve = isApprover1 || isApprover2 || isAdmin;

  const alreadyDecided = (
    (isApprover1 && amendment.firstApproverDecision) ||
    (isApprover2 && amendment.secondApproverDecision)
  );

  const handleResolve = async (approved: boolean) => {
    setLoading(true);
    try {
      await prService.resolveAmendment(
        pr.id,
        approved,
        resolverNotes,
        { id: currentUser.id, email: currentUser.email, firstName: currentUser.firstName, lastName: currentUser.lastName }
      );
      enqueueSnackbar(
        approved ? 'Amendment approved — changes applied to PO' : 'Amendment rejected',
        { variant: approved ? 'success' : 'info' }
      );
      onResolved();
      onClose();
    } catch (err) {
      console.error('Error resolving amendment:', err);
      enqueueSnackbar(err instanceof Error ? err.message : 'Failed to resolve amendment', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Review PO Amendment</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>{amendment.requestedBy.firstName} {amendment.requestedBy.lastName}</strong> requested this amendment on{' '}
              {new Date(amendment.requestedAt).toLocaleDateString()} at{' '}
              {new Date(amendment.requestedAt).toLocaleTimeString()}.
            </Typography>
            {amendment.notes && (
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                <strong>Reason:</strong> {amendment.notes}
              </Typography>
            )}
          </Alert>

          {isDualApproval && (
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <Chip
                label={`Approver 1: ${amendment.firstApproverDecision ? (amendment.firstApproverDecision.approved ? 'Approved' : 'Rejected') : 'Pending'}`}
                color={amendment.firstApproverDecision?.approved ? 'success' : amendment.firstApproverDecision ? 'error' : 'default'}
                variant="outlined"
              />
              <Chip
                label={`Approver 2: ${amendment.secondApproverDecision ? (amendment.secondApproverDecision.approved ? 'Approved' : 'Rejected') : 'Pending'}`}
                color={amendment.secondApproverDecision?.approved ? 'success' : amendment.secondApproverDecision ? 'error' : 'default'}
                variant="outlined"
              />
            </Box>
          )}

          <Typography variant="subtitle2" gutterBottom>Proposed Changes</Typography>
          <Divider sx={{ mb: 1 }} />

          {diffEntries.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No detectable changes.</Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Field</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Current Value</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Proposed Value</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {diffEntries
                    .filter(([key]) => key !== 'lineItems')
                    .map(([key, { from, to }]) => (
                      <TableRow key={key}>
                        <TableCell>{FIELD_LABELS[key] || key}</TableCell>
                        <TableCell sx={{ color: 'text.secondary' }}>
                          {formatValue(key, from, pr.currency)}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 500, color: 'primary.main' }}>
                          {formatValue(key, to, (amendment.changes as any).currency || pr.currency)}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {hasLineItemChanges && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>Line Item Changes</Typography>
              <LineItemDiff
                oldItems={pr.lineItems || []}
                newItems={(amendment.changes.lineItems as LineItem[]) || []}
              />
            </Box>
          )}
        </Box>

        {canResolve && !alreadyDecided && (
          <TextField
            label="Notes (optional)"
            multiline
            rows={2}
            fullWidth
            value={resolverNotes}
            onChange={(e) => setResolverNotes(e.target.value)}
            sx={{ mt: 1 }}
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        {canResolve && !alreadyDecided && (
          <>
            <Button
              onClick={() => handleResolve(false)}
              color="error"
              variant="outlined"
              disabled={loading}
            >
              {loading ? <CircularProgress size={20} /> : 'Reject Amendment'}
            </Button>
            <Button
              onClick={() => handleResolve(true)}
              color="success"
              variant="contained"
              disabled={loading}
            >
              {loading ? <CircularProgress size={20} /> : 'Approve Amendment'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
