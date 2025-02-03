import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Grid,
  Paper,
  Typography,
  Button,
  Box,
  CircularProgress,
  IconButton,
  Tooltip,
  TableRow,
  styled,
  Chip,
  Table,
  TableHead,
  TableBody,
  TableCell,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, PriorityHigh as PriorityHighIcon } from '@mui/icons-material';
import { RootState } from '../../store';
import { prService } from '../../services/pr';
import { setUserPRs, setPendingApprovals, setLoading, removePR } from '../../store/slices/prSlice';
import { UserRole, PRStatus } from '../../types/pr';
import { OrganizationSelector } from '../common/OrganizationSelector';
import { MetricsPanel } from './MetricsPanel';
import { ConfirmationDialog } from '../common/ConfirmationDialog';
import { Link } from 'react-router-dom';
import { referenceDataService } from '../../services/referenceData';

interface StatusHistoryEntry {
  status: PRStatus;
  timestamp: string | number | Date;
  updatedBy: {
    id: string;
    name: string;
    email: string;
  };
}

interface PRWithHistory extends PRRequest {
  statusHistory?: StatusHistoryEntry[];
}

const UrgentTableRow = styled(TableRow)(({ theme }) => ({
  backgroundColor: `${theme.palette.error.main}15`,
  '&:hover': {
    backgroundColor: `${theme.palette.error.main}25 !important`,
  },
}));

export const Dashboard = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const location = useLocation();
  const { user } = useSelector((state: RootState) => state.auth);
  const { userPRs, pendingApprovals, loading } = useSelector(
    (state: RootState) => state.pr
  );
  const [selectedOrg, setSelectedOrg] = useState<{ id: string; name: string } | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<PRStatus>(PRStatus.SUBMITTED);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [prToDelete, setPrToDelete] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setUserId(user?.id);
  }, [user]);

  // Load PRs when organization is selected
  useEffect(() => {
    const loadPRs = async () => {
      if (!userId || !selectedOrg?.name) {
        console.log('Dashboard: No user ID or organization available', { userId, selectedOrg, userOrg: user?.organization });
        return;
      }

      console.log('Dashboard: Loading data for user:', { userId, organization: selectedOrg, role: user?.role });
      try {
        setIsLoading(true);
        const prs = await prService.getUserPRs(userId, selectedOrg.name);
        dispatch(setUserPRs(prs));
      } catch (error) {
        console.error('Error loading PRs:', error);
        setError('Failed to load purchase requests. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    loadPRs();
  }, [userId, selectedOrg?.name, dispatch]);

  // Set initial organization from user data
  useEffect(() => {
    if (!user?.organization) return;

    console.log('Setting organization from user:', { 
      organization: user.organization,
      additionalOrgs: user.additionalOrganizations || []
    });

    // Load available organizations
    const loadOrganizations = async () => {
      try {
        const orgs = await referenceDataService.getOrganizations();
        console.log('Available organizations:', orgs);

        // Find matching organization
        const matchingOrg = orgs.find(org => {
          const orgId = org.id.toLowerCase();
          const orgCode = org.code.toLowerCase();
          const orgName = org.name.toLowerCase();
          const userOrgId = user.organization.toLowerCase();

          console.log('Comparing organization:', { orgId, orgCode, orgName, userOrgId });

          return orgId === userOrgId || 
                 orgCode === userOrgId || 
                 orgName === userOrgId;
        });

        if (matchingOrg) {
          console.log('Found matching organization:', {
            id: matchingOrg.id,
            name: matchingOrg.name,
            code: matchingOrg.code,
            userOrg: user.organization
          });
          setSelectedOrg(matchingOrg);
        }
      } catch (error) {
        console.error('Error loading organizations:', error);
        setError('Failed to load organizations. Please try again.');
      }
    };

    loadOrganizations();
  }, [user?.organization]);

  // Get PRs for the selected status
  const getStatusPRs = (status: PRStatus) => {
    console.log('Getting status PRs:', {
      selectedStatus,
      userPRs: userPRs.map(pr => ({
        id: pr.id,
        prNumber: pr.prNumber,
        isUrgent: pr.isUrgent,
        status: pr.status,
        organization: pr.organization
      }))
    });
    
    // Add default createdAt if missing
    const prs = userPRs.map(pr => ({
      ...pr,
      createdAt: pr.createdAt || pr.updatedAt || new Date().toISOString()
    }));

    const statusPRs = prs.filter(pr => {
      console.log('Filtering PR:', {
        id: pr.id,
        status: pr.status,
        selectedStatus,
        matches: pr.status === selectedStatus
      });
      return pr.status === selectedStatus;
    });
    
    // Log PRs before sorting
    console.log('Status PRs before sorting:', statusPRs.map(pr => ({
      id: pr.id,
      prNumber: pr.prNumber,
      isUrgent: pr.isUrgent,
      status: pr.status,
      organization: pr.organization
    })));
    
    const sortedPRs = statusPRs.sort((a, b) => {
      // First sort by urgency
      if (Boolean(a.isUrgent) !== Boolean(b.isUrgent)) {
        console.log('Sorting by urgency:', {
          a: { id: a.id, prNumber: a.prNumber, isUrgent: a.isUrgent },
          b: { id: b.id, prNumber: b.prNumber, isUrgent: b.isUrgent },
          result: Boolean(a.isUrgent) ? -1 : 1
        });
        return Boolean(a.isUrgent) ? -1 : 1;
      }
      
      // Then sort based on status
      switch (selectedStatus) {
        case PRStatus.SUBMITTED:
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        case PRStatus.IN_QUEUE:
          const aPos = a.metrics?.queuePosition ?? Number.MAX_SAFE_INTEGER;
          const bPos = b.metrics?.queuePosition ?? Number.MAX_SAFE_INTEGER;
          return aPos - bPos;
        default:
          return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
      }
    });

    // Log PRs after sorting
    console.log('Status PRs after sorting:', sortedPRs.map(pr => ({
      id: pr.id,
      prNumber: pr.prNumber,
      isUrgent: pr.isUrgent,
      status: pr.status,
      organization: pr.organization
    })));

    return sortedPRs;
  };

  // Get status counts for the sidebar
  const getStatusCounts = () => {
    const counts: { [key in PRStatus]: number } = {
      [PRStatus.SUBMITTED]: 0,
      [PRStatus.RESUBMITTED]: 0,
      [PRStatus.IN_QUEUE]: 0,
      [PRStatus.PENDING_APPROVAL]: 0,
      [PRStatus.APPROVED]: 0,
      [PRStatus.ORDERED]: 0,
      [PRStatus.PARTIALLY_RECEIVED]: 0,
      [PRStatus.COMPLETED]: 0,
      [PRStatus.REVISION_REQUIRED]: 0,
      [PRStatus.CANCELED]: 0,
      [PRStatus.REJECTED]: 0
    };

    userPRs.forEach(pr => {
      if (pr.status in counts) {
        counts[pr.status]++;
      }
    });

    return counts;
  };

  // Status groups for the dashboard
  const statusGroups = [
    {
      title: 'Active PRs',
      statuses: [
        PRStatus.SUBMITTED,
        PRStatus.RESUBMITTED,
        PRStatus.IN_QUEUE,
        PRStatus.PENDING_APPROVAL,
        PRStatus.APPROVED,
        PRStatus.ORDERED,
        PRStatus.PARTIALLY_RECEIVED
      ]
    },
    {
      title: 'Completed PRs',
      statuses: [PRStatus.COMPLETED]
    },
    {
      title: 'Other',
      statuses: [PRStatus.REVISION_REQUIRED, PRStatus.CANCELED, PRStatus.REJECTED]
    }
  ];

  // Status display names and colors
  const statusConfig: { [key in PRStatus]: { label: string; color: string } } = {
    [PRStatus.SUBMITTED]: { label: 'Submitted', color: '#4CAF50' },
    [PRStatus.RESUBMITTED]: { label: 'Resubmitted', color: '#8BC34A' },
    [PRStatus.IN_QUEUE]: { label: 'In Queue', color: '#2196F3' },
    [PRStatus.PENDING_APPROVAL]: { label: 'Pending Approval', color: '#FF9800' },
    [PRStatus.APPROVED]: { label: 'Approved', color: '#4CAF50' },
    [PRStatus.ORDERED]: { label: 'Ordered', color: '#9C27B0' },
    [PRStatus.PARTIALLY_RECEIVED]: { label: 'Partially Received', color: '#673AB7' },
    [PRStatus.COMPLETED]: { label: 'Completed', color: '#009688' },
    [PRStatus.REVISION_REQUIRED]: { label: 'Revision Required', color: '#F44336' },
    [PRStatus.CANCELED]: { label: 'Canceled', color: '#9E9E9E' },
    [PRStatus.REJECTED]: { label: 'Rejected', color: '#E91E63' }
  };

  const calculateDaysOpen = (pr: PRWithHistory): number => {
    if (!pr.createdAt) return 0;

    const createdDate = new Date(pr.createdAt);
    let endDate: Date;

    // For closed PRs (completed, canceled, rejected), use the status change date
    const closedStatuses = [PRStatus.COMPLETED, PRStatus.CANCELED, PRStatus.REJECTED];
    if (closedStatuses.includes(pr.status)) {
      // Find the latest status history entry for the current status
      const statusChange = pr.statusHistory?.find(history => history.status === pr.status);
      if (statusChange?.timestamp) {
        // Handle both Date objects and Firestore Timestamps
        const timestamp = statusChange.timestamp;
        endDate = timestamp instanceof Date ? timestamp : new Date(timestamp.seconds * 1000);
      } else {
        endDate = new Date();
      }
    } else {
      // For open PRs, use current date
      endDate = new Date();
    }

    const diffTime = Math.abs(endDate.getTime() - createdDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getStatusChangeDate = (pr: PRWithHistory): string => {
    console.log('Getting status change date:', {
      prNumber: pr.prNumber,
      status: pr.status,
      statusHistory: pr.statusHistory,
      hasHistory: Boolean(pr.statusHistory?.length)
    });

    if (pr.status === PRStatus.SUBMITTED) return '';
    
    // Get the latest status history entry for the current status
    const statusChange = pr.statusHistory?.find(history => history.status === pr.status);
    console.log('Found status change:', {
      prNumber: pr.prNumber,
      status: pr.status,
      statusChange,
      timestamp: statusChange?.timestamp
    });

    if (!statusChange?.timestamp) {
      // Fallback to updatedAt if no status history
      if (pr.updatedAt) {
        console.log('Using updatedAt as fallback:', {
          prNumber: pr.prNumber,
          updatedAt: pr.updatedAt
        });
        return new Date(pr.updatedAt).toLocaleDateString();
      }
      // Fallback to workflowHistory if available
      const workflowEntry = pr.workflowHistory?.find(entry => entry.step === pr.status);
      if (workflowEntry?.timestamp) {
        console.log('Using workflow history as fallback:', {
          prNumber: pr.prNumber,
          workflowEntry
        });
        const timestamp = workflowEntry.timestamp;
        const date = timestamp instanceof Date ? timestamp : new Date(timestamp.seconds * 1000);
        return date.toLocaleDateString();
      }
      return '-';
    }

    try {
      // Handle both Date objects and Firestore Timestamps
      const timestamp = statusChange.timestamp;
      const date = timestamp instanceof Date ? timestamp : new Date(timestamp.seconds * 1000);
      return date.toLocaleDateString();
    } catch (error) {
      console.error('Error formatting status change date:', {
        error,
        statusChange,
        prNumber: pr.prNumber
      });
      return '-';
    }
  };

  const statusPRs = getStatusPRs(selectedStatus);

  const handleDeleteClick = (event: React.MouseEvent, prId: string) => {
    event.preventDefault();
    event.stopPropagation();
    setPrToDelete(prId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!prToDelete) return;

    try {
      await prService.deletePR(prToDelete);
      dispatch(removePR(prToDelete));
      setDeleteDialogOpen(false);
      setPrToDelete(null);
    } catch (error) {
      console.error('Error deleting PR:', error);
      // You might want to show an error message to the user here
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setPrToDelete(null);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
            <Grid item xs={12} md={4}>
              <OrganizationSelector
                value={selectedOrg || ''}
                onChange={(org) => {
                  console.log('Organization selected:', org);
                  setSelectedOrg(org);
                }}
              />
            </Grid>
            <Box sx={{ flexGrow: 1 }} />
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={() => navigate('/pr/new')}
            >
              New PR
            </Button>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <MetricsPanel prs={userPRs} />
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Box sx={{ mb: 2 }}>
              <Typography variant="h6" gutterBottom>
                Purchase Requests
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {Object.values(PRStatus).map((status) => {
                  const statusCount = getStatusCounts()[status];
                  return (
                    <Chip
                      key={status}
                      label={`${statusConfig[status].label} (${statusCount})`}
                      color={selectedStatus === status ? 'primary' : 'default'}
                      onClick={() => setSelectedStatus(status)}
                      sx={{ cursor: 'pointer' }}
                    />
                  );
                })}
              </Box>
            </Box>

            {isLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
              </Box>
            ) : (
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>PR Number</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Submitted By</TableCell>
                    <TableCell>Created Date</TableCell>
                    <TableCell>Days Open</TableCell>
                    {selectedStatus !== PRStatus.SUBMITTED && (
                      <TableCell>Status Change Date</TableCell>
                    )}
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {statusPRs.map((pr: PRWithHistory) => {
                    const isUrgent = Boolean(pr.isUrgent);
                    const RowComponent = isUrgent ? UrgentTableRow : TableRow;
                    return (
                      <RowComponent
                        key={pr.id}
                        hover
                        onClick={() => navigate(`/pr/${pr.id}`)}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell>
                          {pr.prNumber}
                          {isUrgent && (
                            <Tooltip title="Urgent PR">
                              <PriorityHighIcon
                                color="error"
                                sx={{ ml: 1, verticalAlign: 'middle' }}
                              />
                            </Tooltip>
                          )}
                        </TableCell>
                        <TableCell>{pr.description}</TableCell>
                        <TableCell>
                          {pr.requestor ? (
                            typeof pr.requestor === 'string' 
                              ? pr.requestor
                              : pr.requestor.firstName && pr.requestor.lastName
                                ? `${pr.requestor.firstName} ${pr.requestor.lastName}`
                                : pr.requestor.email || 'Unknown'
                          ) : 'Unknown'}
                        </TableCell>
                        <TableCell>
                          {pr.createdAt 
                            ? new Date(pr.createdAt).toLocaleDateString()
                            : 'Date not available'}
                        </TableCell>
                        <TableCell>
                          {calculateDaysOpen(pr)}
                        </TableCell>
                        {selectedStatus !== PRStatus.SUBMITTED && (
                          <TableCell>
                            {getStatusChangeDate(pr)}
                          </TableCell>
                        )}
                        <TableCell>
                          <IconButton
                            onClick={(e) => handleDeleteClick(e, pr.id)}
                            size="small"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </TableCell>
                      </RowComponent>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Paper>
        </Grid>
      </Grid>

      <ConfirmationDialog
        open={deleteDialogOpen}
        title="Delete PR"
        content="Are you sure you want to delete this PR? This action cannot be undone."
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </Box>
  );
};
