import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  IconButton,
  Typography,
  Chip,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Stack,
  Tooltip,
  Card,
  CardContent,
  Grid,
  Divider,
} from '@mui/material';
import {
  Search as SearchIcon,
  Visibility as ViewIcon,
  FilterList as FilterIcon,
} from '@mui/icons-material';
import { RootState } from '../../store';
import { prService } from '../../services/pr';
import { setUserPRs, setLoading } from '../../store/slices/prSlice';
import { PRRequest, PRStatus } from '../../types/pr';
import { format } from 'date-fns';
import { formatCurrency, calculateDaysOpen } from '../../utils/formatters';
import { useResponsive } from '../../hooks/useResponsive';

const statusColors: Record<PRStatus, 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'> = {
  [PRStatus.SUBMITTED]: 'warning',
  [PRStatus.IN_QUEUE]: 'info',
  [PRStatus.ORDERED]: 'primary',
  [PRStatus.COMPLETED]: 'success',
  [PRStatus.REVISION_REQUIRED]: 'warning',
  [PRStatus.REJECTED]: 'error',
  [PRStatus.CANCELED]: 'error',
};

export const PRList = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { isMobile } = useResponsive();
  const { user } = useSelector((state: RootState) => state.auth);
  const { userPRs, loading } = useSelector((state: RootState) => state.pr);

  // Local state for filtering and pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [vendorSearch, setVendorSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PRStatus | 'ALL'>('ALL');
  const [dateFilter, setDateFilter] = useState<'all' | '7days' | '30days' | '90days'>('all');
  const [vendorRelationshipFilter, setVendorRelationshipFilter] = useState<'ALL' | 'TRANSACTED' | 'QUOTED'>('ALL');

  useEffect(() => {
    const loadPRs = async () => {
      if (!user) return;
      
      dispatch(setLoading(true));
      try {
        const prs = await prService.getUserPRs(user.id);
        dispatch(setUserPRs(prs));
      } catch (error) {
        console.error('Error loading PRs:', error);
      } finally {
        dispatch(setLoading(false));
      }
    };

    loadPRs();
  }, [dispatch, user]);

  // Helper function to check if vendor is associated with PR and how
  const getVendorRelationships = (pr: PRRequest, vendorSearchTerm: string): { 
    isAssociated: boolean; 
    isTransacted: boolean; 
    isQuoted: boolean;
  } => {
    if (!vendorSearchTerm) {
      return { isAssociated: true, isTransacted: false, isQuoted: false };
    }

    const searchLower = vendorSearchTerm.toLowerCase();
    let isTransacted = false;
    let isQuoted = false;

    // Check preferred vendor
    if (pr.preferredVendor?.toLowerCase().includes(searchLower)) {
      isTransacted = true;
    }

    // Check selected vendor
    if (pr.selectedVendor?.toLowerCase().includes(searchLower)) {
      isTransacted = true;
    }

    // Check vendor name (if stored as string)
    if (pr.vendorName?.toLowerCase().includes(searchLower)) {
      isTransacted = true;
    }

    // Check quotes
    if (pr.quotes && pr.quotes.length > 0) {
      const hasQuote = pr.quotes.some(quote => 
        (quote.vendorName && quote.vendorName.toLowerCase().includes(searchLower)) ||
        (quote.vendorId && quote.vendorId.toLowerCase().includes(searchLower)) ||
        (quote.vendor && typeof quote.vendor === 'string' && quote.vendor.toLowerCase().includes(searchLower))
      );
      if (hasQuote) {
        isQuoted = true;
      }
    }

    return {
      isAssociated: isTransacted || isQuoted,
      isTransacted,
      isQuoted
    };
  };

  // Filter PRs based on search term, status, date, vendor, and relationship
  const filteredPRs = userPRs.filter((pr) => {
    const matchesSearch = 
      searchTerm === '' ||
      (pr.prNumber && pr.prNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
      pr.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pr.projectCategory.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || pr.status === statusFilter;

    const prDate = pr.createdAt instanceof Date ? pr.createdAt : new Date(pr.createdAt);
    const now = new Date();
    const daysDiff = Math.floor((now.getTime() - prDate.getTime()) / (1000 * 60 * 60 * 24));

    const matchesDate =
      dateFilter === 'all' ||
      (dateFilter === '7days' && daysDiff <= 7) ||
      (dateFilter === '30days' && daysDiff <= 30) ||
      (dateFilter === '90days' && daysDiff <= 90);

    // Vendor filtering
    const vendorRelationships = getVendorRelationships(pr, vendorSearch);
    const matchesVendor = vendorRelationships.isAssociated;

    // Relationship type filtering
    const matchesRelationship = 
      vendorRelationshipFilter === 'ALL' ||
      (vendorRelationshipFilter === 'TRANSACTED' && vendorRelationships.isTransacted) ||
      (vendorRelationshipFilter === 'QUOTED' && vendorRelationships.isQuoted && !vendorRelationships.isTransacted);

    return matchesSearch && matchesStatus && matchesDate && matchesVendor && matchesRelationship;
  });

  // Pagination handlers
  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Format currency with proper symbol and decimals
  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Purchase Requests
      </Typography>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack spacing={2}>
          {/* Row 1: General Search, Status, Time Period */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              size="small"
              label="Search PR/PO"
              variant="outlined"
              placeholder="PR number, dept, category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon color="action" />,
              }}
              sx={{ minWidth: 200, flex: 1 }}
            />

            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                label="Status"
                onChange={(e) => setStatusFilter(e.target.value as PRStatus | 'ALL')}
              >
                <MenuItem value="ALL">All Statuses</MenuItem>
                {Object.values(PRStatus).map((status) => (
                  <MenuItem key={status} value={status}>
                    {status.replace(/_/g, ' ')}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Time Period</InputLabel>
              <Select
                value={dateFilter}
                label="Time Period"
                onChange={(e) => setDateFilter(e.target.value as 'all' | '7days' | '30days' | '90days')}
              >
                <MenuItem value="all">All Time</MenuItem>
                <MenuItem value="7days">Last 7 Days</MenuItem>
                <MenuItem value="30days">Last 30 Days</MenuItem>
                <MenuItem value="90days">Last 90 Days</MenuItem>
              </Select>
            </FormControl>
          </Stack>

          {/* Row 2: Vendor Search and Relationship Filter */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              size="small"
              label="Search by Vendor"
              variant="outlined"
              placeholder="Vendor name or ID..."
              value={vendorSearch}
              onChange={(e) => setVendorSearch(e.target.value)}
              InputProps={{
                startAdornment: <FilterIcon color="action" />,
              }}
              helperText="Searches in preferred, selected, and quoted vendors"
              sx={{ minWidth: 200, flex: 1 }}
            />

            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Vendor Relationship</InputLabel>
              <Select
                value={vendorRelationshipFilter}
                label="Vendor Relationship"
                onChange={(e) => setVendorRelationshipFilter(e.target.value as 'ALL' | 'TRANSACTED' | 'QUOTED')}
                disabled={!vendorSearch}
              >
                <MenuItem value="ALL">All Relationships</MenuItem>
                <MenuItem value="TRANSACTED">Transacted (Preferred/Selected)</MenuItem>
                <MenuItem value="QUOTED">Quoted Only (Not Selected)</MenuItem>
              </Select>
            </FormControl>
          </Stack>

          {/* Results count */}
          {(vendorSearch || searchTerm || statusFilter !== 'ALL' || dateFilter !== 'all' || vendorRelationshipFilter !== 'ALL') && (
            <Typography variant="body2" color="textSecondary">
              Showing {filteredPRs.length} of {userPRs.length} PR/POs
            </Typography>
          )}
        </Stack>
      </Paper>

      {/* PR Table/Cards */}
      {isMobile ? (
        // Mobile Card Layout
        <Box>
          {filteredPRs
            .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
            .map((pr) => {
              let daysOpen;
              try {
                daysOpen = calculateDaysOpen(pr.createdAt);
              } catch (error) {
                daysOpen = 0;
              }
              
              return (
                <Card 
                  key={pr.id}
                  sx={{ 
                    mb: 2,
                    '&:hover': { boxShadow: 3, cursor: 'pointer' }
                  }}
                  onClick={() => navigate(`/pr/${pr.id}`)}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                      <Typography variant="h6" component="div" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                        {pr.prNumber || `#${pr.id.slice(-6)}`}
                      </Typography>
                      <Chip
                        label={pr.status.replace(/_/g, ' ')}
                        color={statusColors[pr.status]}
                        size="small"
                      />
                    </Box>
                    <Divider sx={{ my: 1 }} />
                    <Grid container spacing={1}>
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary">
                          Created Date
                        </Typography>
                        <Typography variant="body2">
                          {format(new Date(pr.createdAt), 'MM/dd/yyyy')}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary">
                          Days Open
                        </Typography>
                        <Typography variant="body2">
                          {daysOpen} days
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary">
                          Requestor
                        </Typography>
                        <Typography variant="body2">
                          {pr.requestor?.name || 'Unknown'}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary">
                          Department
                        </Typography>
                        <Typography variant="body2">
                          {pr.department}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary">
                          Category
                        </Typography>
                        <Typography variant="body2">
                          {pr.projectCategory}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary">
                          Total Amount
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {formatCurrency(pr.totalAmount, pr.currency)}
                        </Typography>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              );
            })}
          {filteredPRs.length === 0 && (
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="textSecondary">
                No purchase requests found
              </Typography>
            </Paper>
          )}
          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={filteredPRs.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </Box>
      ) : (
        // Desktop Table Layout
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>PR ID</TableCell>
                <TableCell>Created Date</TableCell>
                <TableCell>Days Open</TableCell>
                <TableCell>Requestor</TableCell>
                <TableCell>Department</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Total Amount</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredPRs
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((pr) => {
                  let daysOpen;
                  try {
                    daysOpen = calculateDaysOpen(pr.createdAt);
                  } catch (error) {
                    daysOpen = 0;
                  }
                  
                  return (
                    <TableRow key={pr.id} hover>
                      <TableCell 
                        sx={{ 
                          color: 'primary.main', 
                          cursor: 'pointer',
                          '&:hover': { textDecoration: 'underline' }
                        }}
                        onClick={() => navigate(`/pr/${pr.id}`)}
                      >
                        {pr.prNumber || `#${pr.id.slice(-6)}`}
                      </TableCell>
                      <TableCell>
                        {format(new Date(pr.createdAt), 'MM/dd/yyyy')}
                      </TableCell>
                      <TableCell>
                        {daysOpen} days
                      </TableCell>
                      <TableCell>{pr.requestor?.name || 'Unknown'}</TableCell>
                      <TableCell>{pr.department}</TableCell>
                      <TableCell>{pr.projectCategory}</TableCell>
                      <TableCell>
                        <Chip
                          label={pr.status.replace(/_/g, ' ')}
                          color={statusColors[pr.status]}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(pr.totalAmount, pr.currency)}
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="View Details">
                          <IconButton
                            size="small"
                            onClick={() => navigate(`/pr/${pr.id}`)}
                            sx={{ minWidth: '44px', minHeight: '44px' }}
                          >
                            <ViewIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              {filteredPRs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    No purchase requests found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={filteredPRs.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </TableContainer>
      )}
    </Box>
  );
};
