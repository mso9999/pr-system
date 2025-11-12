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
  const { user } = useSelector((state: RootState) => state.auth);
  const { userPRs, loading } = useSelector((state: RootState) => state.pr);

  // Local state for filtering and pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<PRStatus | 'ALL'>('ALL');
  const [dateFilter, setDateFilter] = useState<'all' | '7days' | '30days' | '90days'>('all');

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

  // Filter PRs based on search term, status, and date
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

    return matchesSearch && matchesStatus && matchesDate;
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
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            size="small"
            label="Search"
            variant="outlined"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon color="action" />,
            }}
            sx={{ minWidth: 200 }}
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
      </Paper>

      {/* PR Table */}
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
                console.log('Processing PR:', {
                  id: pr.id,
                  prNumber: pr.prNumber,
                  createdAt: pr.createdAt,
                  createdAtType: typeof pr.createdAt,
                  completedAt: pr.completedAt,
                  completedAtType: typeof pr.completedAt,
                  status: pr.status
                });
                
                let daysOpen;
                try {
                  daysOpen = calculateDaysOpen(pr.createdAt);
                  console.log('Calculated days open:', {
                    id: pr.id,
                    daysOpen,
                    createdAt: new Date(pr.createdAt).toISOString(),
                  });
                } catch (error) {
                  console.error('Error calculating days open:', error);
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
                      {format(
                        new Date(pr.createdAt),
                        'MM/dd/yyyy'
                      )}
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
    </Box>
  );
};
