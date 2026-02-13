import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Chip,
  Button,
  Divider,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Stack,
  Alert,
} from '@mui/material';
import {
  Edit as EditIcon,
  Check as ApproveIcon,
  Close as RejectIcon,
  ArrowBack as BackIcon,
} from '@mui/icons-material';
import { format, parseISO } from 'date-fns';
import { RootState } from '../../store';
import { prService } from '../../services/pr';
import { setCurrentPR } from '../../store/slices/prSlice';
import { PRRequest, PRStatus, UserRole } from '../../types/pr';

const statusColors: Record<PRStatus, 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'> = {
  [PRStatus.DRAFT]: 'default',
  [PRStatus.PENDING_APPROVAL]: 'warning',
  [PRStatus.APPROVED]: 'success',
  [PRStatus.ORDERED]: 'info',
  [PRStatus.PARTIALLY_RECEIVED]: 'secondary',
  [PRStatus.RECEIVED]: 'primary',
  [PRStatus.CANCELLED]: 'error',
  [PRStatus.REJECTED]: 'error',
};

const formatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return 'N/A';
  try {
    return format(parseISO(dateStr), 'MMM dd, yyyy');
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid Date';
  }
};

export const PRDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user } = useSelector((state: RootState) => state.auth);
  const { currentPR } = useSelector((state: RootState) => state.pr);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [rejectionDialogOpen, setRejectionDialogOpen] = useState(false);
  const [comments, setComments] = useState('');

  useEffect(() => {
    const loadPR = async () => {
      if (!id) return;
      
      setLoading(true);
      try {
        const pr = await prService.getPR(id);
        if (pr) {
          dispatch(setCurrentPR(pr));
        } else {
          setError('PR not found');
        }
      } catch (err) {
        setError('Error loading PR details');
        console.error('Error loading PR:', err);
      } finally {
        setLoading(false);
      }
    };

    loadPR();
  }, [id, dispatch]);

  const handleApprove = async () => {
    if (!currentPR || !user) return;

    try {
      await prService.updateStatus(currentPR.id, PRStatus.APPROVED, user);
      const updatedPR = await prService.getPR(currentPR.id);
      if (updatedPR) {
        dispatch(setCurrentPR(updatedPR));
      }
      setApprovalDialogOpen(false);
    } catch (err) {
      console.error('Error approving PR:', err);
      setError('Failed to approve PR');
    }
  };

  const handleReject = async () => {
    if (!currentPR || !user || !comments) return;

    try {
      await prService.updateStatus(currentPR.id, PRStatus.REJECTED, user);
      const updatedPR = await prService.getPR(currentPR.id);
      if (updatedPR) {
        dispatch(setCurrentPR(updatedPR));
      }
      setRejectionDialogOpen(false);
    } catch (err) {
      console.error('Error rejecting PR:', err);
      setError('Failed to reject PR');
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error || !currentPR) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {error || 'PR not found'}
      </Alert>
    );
  }

  const canApprove = user?.role === UserRole.APPROVER || user?.role === UserRole.ADMIN;
  const isPendingApproval = currentPR.status === PRStatus.PENDING_APPROVAL;

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <Button
          startIcon={<BackIcon />}
          onClick={() => navigate('/pr/list')}
        >
          Back to List
        </Button>
        <Typography variant="h4" component="h1">
          PR #{currentPR.id.slice(-6)}
        </Typography>
        <Chip
          label={currentPR.status.replace(/_/g, ' ')}
          color={statusColors[currentPR.status]}
        />
      </Stack>

      {/* Basic Information */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Basic Information
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={4}>
            <Typography variant="subtitle2" color="text.secondary">
              Department
            </Typography>
            <Typography variant="body1">{currentPR.department}</Typography>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <Typography variant="subtitle2" color="text.secondary">
              Project Category
            </Typography>
            <Typography variant="body1">{currentPR.projectCategory}</Typography>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <Typography variant="subtitle2" color="text.secondary">
              Site
            </Typography>
            <Typography variant="body1">{currentPR.site}</Typography>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <Typography variant="subtitle2" color="text.secondary">
              Requestor
            </Typography>
            <Typography variant="body1">{currentPR.requestor.name}</Typography>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <Typography variant="subtitle2" color="text.secondary">
              Created Date
            </Typography>
            <Typography variant="body1">
              {formatDate(currentPR.createdAt)}
            </Typography>
          </Grid>
          {currentPR.expectedLandingDate && (
            <Grid item xs={12} sm={6} md={4}>
              <Typography variant="subtitle2" color="text.secondary">
                Expected Landing Date
              </Typography>
              <Typography variant="body1">
                {formatDate(currentPR.expectedLandingDate)}
              </Typography>
            </Grid>
          )}
          {currentPR.purchaseOrderNumber && (
            <Grid item xs={12} sm={6} md={4}>
              <Typography variant="subtitle2" color="text.secondary">
                Purchase Order Number
              </Typography>
              <Typography variant="body1" fontWeight="bold">
                {currentPR.purchaseOrderNumber}
              </Typography>
            </Grid>
          )}
        </Grid>
      </Paper>

      {/* Items */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Items
        </Typography>
        {currentPR.lineItems.map((item, index) => (
          <Box key={item.id} sx={{ mb: 2 }}>
            {index > 0 && <Divider sx={{ my: 2 }} />}
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography variant="subtitle1">{item.description}</Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="subtitle2" color="text.secondary">
                  Quantity
                </Typography>
                <Typography variant="body1">{item.quantity}</Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="subtitle2" color="text.secondary">
                  Unit Price
                </Typography>
                <Typography variant="body1">
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: item.currency,
                  }).format(item.unitPrice)}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="subtitle2" color="text.secondary">
                  Total Price
                </Typography>
                <Typography variant="body1">
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: item.currency,
                  }).format(item.totalPrice)}
                </Typography>
              </Grid>
              {item.vendor && (
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Vendor
                  </Typography>
                  <Typography variant="body1">{item.vendor}</Typography>
                </Grid>
              )}
              {item.notes && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Notes
                  </Typography>
                  <Typography variant="body1">{item.notes}</Typography>
                </Grid>
              )}
            </Grid>
          </Box>
        ))}
        <Divider sx={{ my: 3 }} />
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          p: 2,
          backgroundColor: 'grey.50',
          borderRadius: 1
        }}>
          <Typography variant="h6" color="text.secondary">
            Total Amount:
          </Typography>
          <Typography variant="h5" fontWeight="bold" color="primary.main">
            {new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: currentPR.currency,
            }).format(currentPR.totalAmount)}
          </Typography>
        </Box>
      </Paper>

      {/* Action Buttons */}
      {canApprove && isPendingApproval && (
        <Paper sx={{ p: 3 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} flexWrap="wrap" useFlexGap>
            <Button
              variant="contained"
              color="success"
              startIcon={<ApproveIcon />}
              onClick={() => setApprovalDialogOpen(true)}
            >
              Approve
            </Button>
            <Button
              variant="contained"
              color="error"
              startIcon={<RejectIcon />}
              onClick={() => setRejectionDialogOpen(true)}
            >
              Reject
            </Button>
          </Stack>
        </Paper>
      )}

      {/* Approval Dialog */}
      <Dialog open={approvalDialogOpen} onClose={() => setApprovalDialogOpen(false)}>
        <DialogTitle>Approve Purchase Request</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to approve PR #{currentPR.id.slice(-6)}?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApprovalDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleApprove} variant="contained" color="success">
            Approve
          </Button>
        </DialogActions>
      </Dialog>

      {/* Rejection Dialog */}
      <Dialog open={rejectionDialogOpen} onClose={() => setRejectionDialogOpen(false)}>
        <DialogTitle>Reject Purchase Request</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Please provide a reason for rejecting PR #{currentPR.id.slice(-6)}
          </Typography>
          <TextField
            autoFocus
            margin="dense"
            label="Comments"
            fullWidth
            multiline
            rows={4}
            value={comments}
            onChange={(e) => setComments(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectionDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleReject}
            variant="contained"
            color="error"
            disabled={!comments}
          >
            Reject
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
