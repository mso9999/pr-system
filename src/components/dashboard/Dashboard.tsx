import { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  Badge,
  Card,
  CardContent,
  CardActions,
  Divider,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, PriorityHigh as PriorityHighIcon, Assignment as AssignmentIcon, Archive as ArchiveIcon } from '@mui/icons-material';
import { RootState } from '../../store';
import { getUserPRs, deletePR } from '@/services/pr';
import { setUserPRs, setPendingApprovals, setLoading, removePR, setMyActionsFilter } from '../../store/slices/prSlice';
import { PRStatus, PRRequest, StatusHistoryItem } from '../../types/pr';
import { OrganizationSelector, ALL_ORGANIZATIONS_OPTION } from '../common/OrganizationSelector';
import { MetricsPanel } from './MetricsPanel';
import { ConfirmationDialog } from '../common/ConfirmationDialog';
import { AdvancedFilterPanel, FilterCriteria } from './AdvancedFilterPanel';
import { SearchResultsAnalytics } from './SearchResultsAnalytics';
import { exportPRsToCSV } from '@/utils/exportUtils';
import { Link } from 'react-router-dom';
import { referenceDataService } from '../../services/referenceData';
import { normalizeOrganizationId } from '@/utils/organization';
import { useResponsive } from '../../hooks/useResponsive';

interface StatusHistoryEntry {
  status: PRStatus;
  timestamp: string | number | Date | { seconds: number; nanoseconds?: number };
  updatedBy: {
    id: string;
    name: string;
    email: string;
  };
}

// Extend the PRRequest interface for our component
interface PRWithHistory extends PRRequest {
  statusHistory?: StatusHistoryItem[];
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
  const { t } = useTranslation();
  const { isMobile, isTablet } = useResponsive();
  const { user } = useSelector((state: RootState) => state.auth);
  const { userPRs, pendingApprovals, loading, showOnlyMyPRs, myActionsFilter } = useSelector(
    (state: RootState) => state.pr
  );
  const [selectedOrg, setSelectedOrg] = useState<{ id: string; name: string } | null>(ALL_ORGANIZATIONS_OPTION);
  const [availableOrgs, setAvailableOrgs] = useState<{ id: string; name: string }[]>([]);
  const handleOrganizationChange = useCallback((org: { id: string; name: string }) => {
    console.log('Organization selected:', org);
    setSelectedOrg(org);
  }, []);

  const handleOrganizationsLoaded = useCallback((orgs: { id: string; name: string }[]) => {
    setAvailableOrgs(orgs);
  }, []);
  const [selectedStatus, setSelectedStatus] = useState<PRStatus>(PRStatus.SUBMITTED);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [prToDelete, setPrToDelete] = useState<PRRequest | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [filteredPRs, setFilteredPRs] = useState<PRRequest[]>([]);
  const [filterCriteria, setFilterCriteria] = useState<FilterCriteria>({});
  const [hasAdvancedFilters, setHasAdvancedFilters] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [allReferenceData, setAllReferenceData] = useState<{
    departments: ReferenceDataItem[];
    sites: ReferenceDataItem[];
    vehicles: ReferenceDataItem[];
    projectCategories: ReferenceDataItem[];
    expenseTypes: ReferenceDataItem[];
    vendors: ReferenceDataItem[];
  }>({
    departments: [],
    sites: [],
    vehicles: [],
    projectCategories: [],
    expenseTypes: [],
    vendors: []
  });

  useEffect(() => {
    setUserId(user?.id || null);
  }, [user]);

  // Load reference data for filters
  useEffect(() => {
    const loadReferenceData = async () => {
      if (!selectedOrg?.name || selectedOrg.id === ALL_ORGANIZATIONS_OPTION.id) return;

      try {
        const [depts, sites, vehs, projCats, expTypes, vends] = await Promise.all([
          referenceDataService.getDepartments(selectedOrg.name),
          referenceDataService.getItemsByType('sites', selectedOrg.name),
          referenceDataService.getItemsByType('vehicles', selectedOrg.name),
          referenceDataService.getItemsByType('projectCategories', selectedOrg.name),
          referenceDataService.getItemsByType('expenseTypes', selectedOrg.name),
          referenceDataService.getItemsByType('vendors'),
        ]);

        setAllReferenceData({
          departments: depts,
          sites,
          vehicles: vehs,
          projectCategories: projCats,
          expenseTypes: expTypes,
          vendors: vends
        });
      } catch (error) {
        console.error('Error loading reference data:', error);
      }
    };

    loadReferenceData();
  }, [selectedOrg?.name]);

  // Load PRs when organization is selected or filter changes
  useEffect(() => {
    const loadPRs = async () => {
      if (!userId || !selectedOrg) {
        console.log('Dashboard: No user ID or organization available', { userId, selectedOrg, userOrg: user?.organization });
        return;
      }

      const isAllOrganizations = selectedOrg.id === ALL_ORGANIZATIONS_OPTION.id;

      console.log('Dashboard: Loading data for user:', { userId, organization: selectedOrg, showOnlyMyPRs, isAllOrganizations });
      try {
        setIsLoading(true);
        let combinedPRs: PRRequest[] = [];

        if (isAllOrganizations) {
          // Get user's assigned organizations (primary + additional)
          // Need to resolve normalized IDs to actual organization names for PR queries
          const userAssignedOrgIds: string[] = [];
          
          console.log('Dashboard: User organization data:', {
            primaryOrg: user?.organization,
            additionalOrgs: user?.additionalOrganizations,
            userPermissionLevel: user?.permissionLevel
          });

          // Collect normalized organization IDs from user
          if (user?.organization) {
            const orgStr = typeof user.organization === 'string' ? user.organization : (user.organization as any)?.name || (user.organization as any)?.id || '';
            if (orgStr && 
                orgStr !== 'All Organizations' && 
                orgStr !== 'ALL_ORGS' &&
                orgStr.trim() !== '') {
              const normalizedId = normalizeOrganizationId(orgStr);
              if (normalizedId && !userAssignedOrgIds.includes(normalizedId)) {
                userAssignedOrgIds.push(normalizedId);
              }
            }
          }
          
          if (user?.additionalOrganizations && Array.isArray(user.additionalOrganizations)) {
            user.additionalOrganizations.forEach(org => {
              const orgStr = typeof org === 'string' ? org : (org as any)?.name || (org as any)?.id || '';
              if (orgStr && 
                  orgStr !== 'All Organizations' && 
                  orgStr !== 'ALL_ORGS' &&
                  orgStr.trim() !== '') {
                const normalizedId = normalizeOrganizationId(orgStr);
                if (normalizedId && !userAssignedOrgIds.includes(normalizedId)) {
                  userAssignedOrgIds.push(normalizedId);
                }
              }
            });
          }

          if (userAssignedOrgIds.length === 0) {
            console.log('Dashboard: User has no assigned organizations');
            setIsLoading(false);
            return;
          }

          // Load organization reference data to get actual names
          // PRs are stored with organization names (e.g., "1PWR LESOTHO"), not normalized IDs
          let organizationNames: string[] = [];
          try {
            const allOrgs = await referenceDataService.getOrganizations();
            const orgMap = new Map<string, string>(); // normalizedId -> name
            
            allOrgs.forEach(org => {
              const normalizedId = normalizeOrganizationId(org);
              if (normalizedId) {
                orgMap.set(normalizedId, org.name);
              }
            });

            console.log('Dashboard: Organization name mapping:', {
              userAssignedOrgIds,
              orgMapEntries: Array.from(orgMap.entries())
            });

            // Get organization names for user's assigned org IDs (PRIMARY - use names)
            userAssignedOrgIds.forEach(normalizedId => {
              const orgName = orgMap.get(normalizedId);
              if (orgName && !organizationNames.includes(orgName)) {
                organizationNames.push(orgName);
              } else if (!orgName) {
                console.warn(`Dashboard: Could not find organization name for normalized ID: ${normalizedId}`);
              }
            });

            // Only add normalized IDs as fallback if we didn't get names (shouldn't happen normally)
            if (organizationNames.length === 0) {
              console.warn('Dashboard: No organization names found, falling back to normalized IDs');
              userAssignedOrgIds.forEach(normalizedId => {
                if (!organizationNames.includes(normalizedId)) {
                  organizationNames.push(normalizedId);
                }
              });
            }
          } catch (orgLoadError) {
            console.error('Error loading organizations for name resolution:', orgLoadError);
            // Fallback to using normalized IDs directly
            organizationNames = [...userAssignedOrgIds];
          }

          console.log('Dashboard: Loading PRs for user assigned organizations:', {
            normalizedIds: userAssignedOrgIds,
            organizationNames: organizationNames
          });

          if (!showOnlyMyPRs) {
            // Fetch PRs for each organization (try both name and normalized ID)
            const orgFetches = organizationNames.map(async (orgIdentifier) => {
              const orgPRs = await getUserPRs(userId, orgIdentifier, showOnlyMyPRs);
              let merged = [...orgPRs];
              
              // Also try the normalized ID if we're using a name, or vice versa
              const normalizedId = normalizeOrganizationId(orgIdentifier);
              const alternateIdentifier = normalizedId !== orgIdentifier ? normalizedId : null;
              
              if (alternateIdentifier) {
                try {
                  const altPRs = await getUserPRs(userId, alternateIdentifier, showOnlyMyPRs);
                  const existingIds = new Set(merged.map(pr => pr.id));
                  altPRs.forEach(pr => {
                    if (!existingIds.has(pr.id)) {
                      merged.push(pr);
                    }
                  });
                } catch (altError) {
                  console.error(`Error loading PRs by alternate identifier (${alternateIdentifier})`, altError);
                }
              }
              
              return merged;
            });

            const results = await Promise.all(orgFetches);
            const dedupedMap = new Map<string, PRRequest>();
            results.flat().forEach(pr => {
              if (!dedupedMap.has(pr.id)) {
                dedupedMap.set(pr.id, pr);
              }
            });
            combinedPRs = Array.from(dedupedMap.values());
          } else {
            // When showing only my PRs, fetch without organization filter
            // This will get PRs where user is requestor or approver across all their orgs
            combinedPRs = await getUserPRs(userId, undefined, showOnlyMyPRs);
          }
        } else {
          const primaryPRs = await getUserPRs(userId, selectedOrg.name, showOnlyMyPRs);
          combinedPRs = [...primaryPRs];

          if (selectedOrg.id && selectedOrg.id !== selectedOrg.name) {
            try {
              const secondaryPRs = await getUserPRs(userId, selectedOrg.id, showOnlyMyPRs);
              if (secondaryPRs.length > 0) {
                const existingIds = new Set(primaryPRs.map(pr => pr.id));
                secondaryPRs.forEach(pr => {
                  if (!existingIds.has(pr.id)) {
                    combinedPRs.push(pr);
                  }
                });
              }
            } catch (secondaryError) {
              console.error('Error loading PRs by organization ID, continuing with primary results:', secondaryError);
            }
          }
        }

        // Normalize ordering so merged lists remain consistent
        combinedPRs = combinedPRs.sort((a, b) => {
          const aDate = new Date(a.createdAt || a.updatedAt || 0).getTime();
          const bDate = new Date(b.createdAt || b.updatedAt || 0).getTime();
          return bDate - aDate;
        });

        dispatch(setUserPRs(combinedPRs));
      } catch (error) {
        console.error('Error loading PRs:', error);
        setError('Failed to load purchase requests. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    loadPRs();
  }, [userId, selectedOrg, showOnlyMyPRs, user, dispatch]);

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
    const counts: { [key in PRStatus]?: number } = {
      [PRStatus.SUBMITTED]: 0,
      [PRStatus.RESUBMITTED]: 0,
      [PRStatus.IN_QUEUE]: 0,
      [PRStatus.PENDING_APPROVAL]: 0,
      [PRStatus.APPROVED]: 0,
      [PRStatus.ORDERED]: 0,
      [PRStatus.COMPLETED]: 0,
      [PRStatus.REVISION_REQUIRED]: 0,
      [PRStatus.CANCELED]: 0,
      [PRStatus.REJECTED]: 0,
      [PRStatus.DRAFT]: 0
    };

    userPRs.forEach(pr => {
      if (pr.status in counts && counts[pr.status] !== undefined) {
        counts[pr.status]!++;
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
        PRStatus.ORDERED
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

  // Status display names and colors (translated)
  const statusConfig: { [key in PRStatus]?: { label: string; color: string } } = {
    [PRStatus.DRAFT]: { label: t('status.DRAFT'), color: '#9E9E9E' },
    [PRStatus.SUBMITTED]: { label: t('status.SUBMITTED'), color: '#4CAF50' },
    [PRStatus.RESUBMITTED]: { label: t('status.RESUBMITTED'), color: '#8BC34A' },
    [PRStatus.IN_QUEUE]: { label: t('status.IN_QUEUE'), color: '#2196F3' },
    [PRStatus.PENDING_APPROVAL]: { label: t('status.PENDING_APPROVAL'), color: '#FF9800' },
    [PRStatus.APPROVED]: { label: t('status.APPROVED'), color: '#4CAF50' },
    [PRStatus.ORDERED]: { label: t('status.ORDERED'), color: '#9C27B0' },
    [PRStatus.COMPLETED]: { label: t('status.COMPLETED'), color: '#009688' },
    [PRStatus.REVISION_REQUIRED]: { label: t('status.REVISION_REQUIRED'), color: '#F44336' },
    [PRStatus.CANCELED]: { label: t('status.CANCELED'), color: '#9E9E9E' },
    [PRStatus.REJECTED]: { label: t('status.REJECTED'), color: '#E91E63' }
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
        if (typeof timestamp === 'object' && timestamp !== null) {
          if ('getTime' in timestamp) {
            // It's a Date object
            endDate = timestamp as Date;
          } else if ('seconds' in timestamp) {
            // It's a Firestore Timestamp-like object
            endDate = new Date((timestamp as any).seconds * 1000);
          } else {
            // Default fallback
            endDate = new Date();
          }
        } else if (typeof timestamp === 'string') {
          endDate = new Date(timestamp);
        } else {
          // Default fallback
          endDate = new Date();
        }
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
      return '-';
    }

    try {
      // Handle different timestamp formats
      const timestamp = statusChange.timestamp;
      if (typeof timestamp === 'object' && timestamp !== null) {
        if ('getTime' in timestamp) {
          // It's a Date object
          return (timestamp as Date).toLocaleDateString();
        } else if ('seconds' in timestamp) {
          // It's a Firestore Timestamp-like object
          return new Date((timestamp as any).seconds * 1000).toLocaleDateString();
        }
      } else if (typeof timestamp === 'string') {
        return new Date(timestamp).toLocaleDateString();
      }
      return '-';
    } catch (error) {
      console.error('Error formatting status change date:', error);
      return '-';
    }
  };

  // Filter PRs for MY ACTIONS based on user role
  const getMyActionsPRs = (): PRRequest[] => {
    if (!user) return [];

    return userPRs.filter(pr => {
      // Requestors: Own PRs in REVISION_REQUIRED
      if (user.permissionLevel === 5) {
        return pr.status === PRStatus.REVISION_REQUIRED && 
               pr.requestorEmail?.toLowerCase() === user.email?.toLowerCase();
      }

      // Approvers (Level 2, 4): PRs in PENDING_APPROVAL assigned to them
      if (user.permissionLevel === 2 || user.permissionLevel === 4) {
        return pr.status === PRStatus.PENDING_APPROVAL && 
               (pr.approver === user.id || pr.approver2 === user.id);
      }

      // Finance/Admin (Level 4): POs in APPROVED status needing documents
      if (user.permissionLevel === 4) {
        return pr.status === PRStatus.APPROVED;
      }

      // Asset Management Department: POs in ORDERED needing delivery docs
      if (user.department?.toLowerCase().includes('asset')) {
        return pr.status === PRStatus.ORDERED;
      }

      return false;
    });
  };

  // Calculate MY ACTIONS count
  const myActionsCount = getMyActionsPRs().length;

  // Toggle MY ACTIONS filter
  const handleMyActionsToggle = () => {
    dispatch(setMyActionsFilter(!myActionsFilter));
  };

  // Check if user should see MY ACTIONS button (not Procurement Level 3)
  const showMyActionsButton = user?.permissionLevel !== 3;

  // Determine which PRs to display based on active filters
  let statusPRs: PRRequest[];
  if (hasAdvancedFilters) {
    // Use advanced filtered results
    statusPRs = filteredPRs.filter(pr => pr.status === selectedStatus);
  } else if (myActionsFilter) {
    // Use MY ACTIONS filter
    statusPRs = getMyActionsPRs().filter(pr => pr.status === selectedStatus);
  } else {
    // Use default status filter
    statusPRs = getStatusPRs(selectedStatus);
  }

  const handleDeleteClick = (event: React.MouseEvent, pr: PRRequest) => {
    event.preventDefault();
    event.stopPropagation();
    setPrToDelete(pr);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!prToDelete) return;

    try {
      await deletePR(prToDelete.id);
      dispatch(removePR(prToDelete.id));
      setDeleteDialogOpen(false);
      setPrToDelete(null);
      console.log(`PR ${prToDelete.prNumber || prToDelete.id} deleted successfully.`);
    } catch (error) {
      console.error('Error deleting PR:', error);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setPrToDelete(null);
  };

  // Handle advanced filter change
  const handleAdvancedFilterChange = (filtered: PRRequest[], criteria: FilterCriteria) => {
    setFilteredPRs(filtered);
    setFilterCriteria(criteria);
    setHasAdvancedFilters(Object.keys(criteria).some(key => {
      const value = criteria[key as keyof FilterCriteria];
      return value !== undefined && value !== '' && value !== 'all' && 
             !(Array.isArray(value) && value.length === 0);
    }));
  };

  // Handle export to CSV
  const handleExport = () => {
    const dataToExport = hasAdvancedFilters ? filteredPRs : statusPRs;
    const baseCurrency = selectedOrg?.id ? 'LSL' : 'LSL'; // TODO: Get from org config
    exportPRsToCSV(dataToExport, filterCriteria, baseCurrency);
  };

  // PR Card Component for Mobile
  const PRCard = ({ pr }: { pr: PRWithHistory }) => {
    const isUrgent = Boolean(pr.isUrgent);
    const requestorName = pr.requestor 
      ? (typeof pr.requestor === 'string' 
          ? pr.requestor
          : pr.requestor.name 
            ? pr.requestor.name
            : pr.requestor.firstName && pr.requestor.lastName
              ? `${pr.requestor.firstName} ${pr.requestor.lastName}`
              : pr.requestor.name || pr.requestor.email || 'Unknown')
      : 'Unknown';

    return (
      <Card 
        sx={{ 
          mb: 2,
          border: isUrgent ? '2px solid' : '1px solid',
          borderColor: isUrgent ? 'error.main' : 'divider',
          backgroundColor: isUrgent ? 'error.light' : 'background.paper',
          '&:hover': {
            boxShadow: 3,
            cursor: 'pointer'
          }
        }}
        onClick={() => navigate(`/pr/${pr.id}`)}
      >
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
            <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
              {pr.prNumber}
              {isUrgent && (
                <Tooltip title="Urgent PR">
                  <PriorityHighIcon
                    color="error"
                    sx={{ ml: 1, verticalAlign: 'middle', fontSize: '1.2rem' }}
                  />
                </Tooltip>
              )}
            </Typography>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteClick(e, pr);
              }}
              sx={{ minWidth: '44px', minHeight: '44px' }}
            >
              <DeleteIcon />
            </IconButton>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            {pr.description}
          </Typography>
          <Divider sx={{ my: 1 }} />
          <Grid container spacing={1}>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">
                {t('pr.submittedBy')}
              </Typography>
              <Typography variant="body2">
                {requestorName}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">
                {t('dashboard.dateCreated')}
              </Typography>
              <Typography variant="body2">
                {pr.createdAt 
                  ? new Date(pr.createdAt).toLocaleDateString()
                  : 'N/A'}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">
                {t('dashboard.daysOpen')}
              </Typography>
              <Typography variant="body2">
                {calculateDaysOpen(pr)}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">
                {t('dashboard.urgency')}
              </Typography>
              <Chip
                label={isUrgent ? 'URGENT' : 'NORMAL'}
                color={isUrgent ? 'error' : 'default'}
                size="small"
                icon={isUrgent ? <PriorityHighIcon /> : undefined}
              />
            </Grid>
            {selectedStatus === PRStatus.RESUBMITTED && (
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">
                  {t('dashboard.resubmittedDate')}
                </Typography>
                <Typography variant="body2">
                  {pr.resubmittedAt 
                    ? new Date(pr.resubmittedAt).toLocaleDateString()
                    : '-'}
                </Typography>
              </Grid>
            )}
            {selectedStatus !== PRStatus.SUBMITTED && selectedStatus !== PRStatus.RESUBMITTED && (
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">
                  {t('dashboard.statusChangeDate')}
                </Typography>
                <Typography variant="body2">
                  {getStatusChangeDate(pr)}
                </Typography>
              </Grid>
            )}
          </Grid>
        </CardContent>
      </Card>
    );
  };

  return (
    <Box sx={{ 
      p: { xs: 1, sm: 2, md: 3 },
      width: '100%',
      maxWidth: '100%',
      overflowX: 'hidden'
    }}>
      <Grid container spacing={{ xs: 2, sm: 3 }}>
        <Grid item xs={12}>
          <Paper sx={{ p: { xs: 1.5, sm: 2 }, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: { xs: 'stretch', md: 'center' }, gap: 2 }}>
            <Box sx={{ width: { xs: '100%', md: 'auto' }, minWidth: { md: 200 } }}>
              <OrganizationSelector
                value={selectedOrg || ''}
                includeAllOption
                onOrganizationsLoaded={handleOrganizationsLoaded}
                onChange={handleOrganizationChange}
              />
            </Box>
            <Box sx={{ flexGrow: 1, display: { xs: 'none', md: 'block' } }} />
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1, width: { xs: '100%', md: 'auto' } }}>
              {showMyActionsButton && (
                <Button
                  variant={myActionsFilter ? "contained" : "outlined"}
                  color="secondary"
                  startIcon={<AssignmentIcon />}
                  onClick={handleMyActionsToggle}
                  fullWidth={isMobile}
                  sx={{ minHeight: '44px' }}
                >
                  <Badge badgeContent={myActionsCount} color="error" max={99}>
                    <Box sx={{ pr: myActionsCount > 0 ? 2 : 0 }}>
                      {t('dashboard.needsMyApproval')}
                    </Box>
                  </Badge>
                </Button>
              )}
              <Button
                variant="outlined"
                color="primary"
                startIcon={<ArchiveIcon />}
                onClick={() => navigate('/archive')}
                fullWidth={isMobile}
                sx={{ minHeight: '44px' }}
              >
                Archive Dataroom
              </Button>
              <Button
                variant="contained"
                color="primary"
                startIcon={<AddIcon />}
                onClick={() => navigate('/pr/new')}
                fullWidth={isMobile}
                sx={{ minHeight: '44px' }}
              >
                {t('nav.newPR')}
              </Button>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <MetricsPanel prs={userPRs} />
        </Grid>

        {/* Advanced Filter Panel */}
        <Grid item xs={12}>
          <AdvancedFilterPanel
            prs={userPRs}
            onFilterChange={handleAdvancedFilterChange}
            organizations={[]}
            users={users}
            vendors={allReferenceData.vendors}
            departments={allReferenceData.departments}
            sites={allReferenceData.sites}
            vehicles={allReferenceData.vehicles}
            projectCategories={allReferenceData.projectCategories}
            expenseTypes={allReferenceData.expenseTypes}
          />
        </Grid>

        {/* Search Results Analytics */}
        {hasAdvancedFilters && filteredPRs.length >= 0 && (
          <Grid item xs={12}>
            <SearchResultsAnalytics
              filteredPRs={filteredPRs}
              baseCurrency={selectedOrg?.id ? 'LSL' : 'LSL'}
              onExport={handleExport}
            />
          </Grid>
        )}

        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="h5" component="h1">
                  {t('dashboard.title')}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  {myActionsFilter 
                    ? t('dashboard.needsMyApproval')
                    : showOnlyMyPRs 
                      ? t('dashboard.myRequests')
                      : t('dashboard.all')}
                </Typography>
              </Box>
            </Box>

            <Box sx={{ mb: 2 }}>
              <Box sx={{ 
                display: 'flex', 
                flexDirection: { xs: 'column', sm: 'row' },
                gap: 1,
                flexWrap: 'wrap'
              }}>
                {Object.values(PRStatus)
                  .filter(status => status !== PRStatus.DRAFT) // Filter out DRAFT status
                  .map((status) => {
                  const statusCount = getStatusCounts()[status];
                  return (
                    <Chip
                      key={status}
                      label={`${statusConfig[status]?.label} (${statusCount})`}
                      color={selectedStatus === status ? 'primary' : 'default'}
                      onClick={() => setSelectedStatus(status)}
                      sx={{ 
                        cursor: 'pointer',
                        minHeight: '44px',
                        fontSize: { xs: '0.75rem', sm: '0.875rem' }
                      }}
                    />
                  );
                })}
              </Box>
            </Box>

            {isLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
              </Box>
            ) : isMobile ? (
              // Mobile Card Layout
              <Box>
                {statusPRs.length === 0 ? (
                  <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', p: 3 }}>
                    {t('dashboard.noPRs')}
                  </Typography>
                ) : (
                  statusPRs.map((pr: PRWithHistory) => (
                    <PRCard key={pr.id} pr={pr} />
                  ))
                )}
              </Box>
            ) : (
              // Desktop Table Layout
              <Box sx={{ overflowX: 'auto' }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>{t('pr.prNumber')}</TableCell>
                      <TableCell>{t('pr.description')}</TableCell>
                      <TableCell>{t('pr.submittedBy')}</TableCell>
                      <TableCell>{t('dashboard.dateCreated')}</TableCell>
                      <TableCell>{t('dashboard.daysOpen')}</TableCell>
                      <TableCell>{t('dashboard.urgency')}</TableCell>
                      {selectedStatus === PRStatus.RESUBMITTED && (
                        <TableCell>{t('dashboard.resubmittedDate')}</TableCell>
                      )}
                      {selectedStatus !== PRStatus.SUBMITTED && selectedStatus !== PRStatus.RESUBMITTED && (
                        <TableCell>{t('dashboard.statusChangeDate')}</TableCell>
                      )}
                      <TableCell>{t('common.actions')}</TableCell>
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
                                : pr.requestor.name 
                                  ? pr.requestor.name
                                  : pr.requestor.firstName && pr.requestor.lastName
                                    ? `${pr.requestor.firstName} ${pr.requestor.lastName}`
                                    : pr.requestor.name || pr.requestor.email || 'Unknown'
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
                          <TableCell>
                            <Chip
                              label={isUrgent ? 'URGENT' : 'NORMAL'}
                              color={isUrgent ? 'error' : 'default'}
                              size="small"
                              icon={isUrgent ? <PriorityHighIcon /> : undefined}
                            />
                          </TableCell>
                          {selectedStatus === PRStatus.RESUBMITTED && (
                            <TableCell>
                              {pr.resubmittedAt 
                                ? new Date(pr.resubmittedAt).toLocaleDateString()
                                : '-'}
                            </TableCell>
                          )}
                          {selectedStatus !== PRStatus.SUBMITTED && selectedStatus !== PRStatus.RESUBMITTED && (
                            <TableCell>
                              {getStatusChangeDate(pr)}
                            </TableCell>
                          )}
                          <TableCell>
                            <IconButton
                              onClick={(e) => handleDeleteClick(e, pr)}
                              size="small"
                              sx={{ minWidth: '44px', minHeight: '44px' }}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </TableCell>
                        </RowComponent>
                      );
                    })}
                  </TableBody>
                </Table>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      <ConfirmationDialog
        open={deleteDialogOpen}
        title="Delete PR"
        message="Are you sure you want to delete this PR? This action cannot be undone."
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </Box>
  );
};
