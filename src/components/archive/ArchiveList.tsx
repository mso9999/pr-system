/**
 * Archive PR List Component
 * Displays all archived/legacy purchase requests in a searchable, filterable table
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Stack,
  Chip,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Search as SearchIcon,
  Visibility as ViewIcon,
  Archive as ArchiveIcon,
} from '@mui/icons-material';
import { ArchivePR } from '@/types/archive';
import { archiveService } from '@/services/archive';
import { formatCurrency } from '@/utils/formatters';
import { format } from 'date-fns';

export const ArchiveList = () => {
  console.log('[ArchiveList] Component rendering');
  const navigate = useNavigate();
  const [archivePRs, setArchivePRs] = useState<ArchivePR[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtering and pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('');
  const [vendorFilter, setVendorFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<'submittedDate' | 'requestorName' | 'amount'>('submittedDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Filter options (populated from actual archive data)
  const [filterOptions, setFilterOptions] = useState<{
    departments: string[];
    vendors: string[];
  }>({
    departments: [],
    vendors: [],
  });

  // Load archive PRs
  useEffect(() => {
    const loadArchivePRs = async () => {
      console.log('[ArchiveList] Starting to load archive PRs...');
      setLoading(true);
      setError(null);
      try {
        const filters = {
          searchTerm: searchTerm || undefined,
          department: departmentFilter || undefined,
          vendor: vendorFilter || undefined,
        };
        
        console.log('[ArchiveList] Calling getArchivePRs with filters:', filters);
        const prs = await archiveService.getArchivePRs(filters, sortBy, sortOrder, 500);
        console.log('[ArchiveList] Received', prs.length, 'archive PRs');
        setArchivePRs(prs);
      } catch (err) {
        console.error('[ArchiveList] Error loading archive PRs:', err);
        setError(err instanceof Error ? err.message : 'Failed to load archive PRs');
      } finally {
        console.log('[ArchiveList] Setting loading to false');
        setLoading(false);
      }
    };

    loadArchivePRs();
  }, [searchTerm, departmentFilter, vendorFilter, sortBy, sortOrder]);

  // Load filter options
  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        const options = await archiveService.getArchiveFilterOptions();
        setFilterOptions(options);
      } catch (err) {
        console.error('Error loading filter options:', err);
      }
    };

    loadFilterOptions();
  }, []);

  // Pagination
  const paginatedPRs = archivePRs.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return format(date, 'MMM dd, yyyy');
    } catch {
      return dateString;
    }
  };

  if (loading && archivePRs.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
          <ArchiveIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          <Typography variant="h4" component="h1">
            Archive Dataroom
          </Typography>
        </Stack>
        
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          View-only access to legacy purchase requests from the previous system (1PWR LESOTHO). 
          These records are archived and cannot be edited.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Search and Filters */}
        <Stack direction="row" spacing={2} sx={{ mb: 3, flexWrap: 'wrap' }}>
          <TextField
            placeholder="Search by requestor, description, vendor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
            }}
            sx={{ flexGrow: 1, minWidth: 250 }}
          />
          
          <FormControl sx={{ minWidth: 150 }}>
            <InputLabel>Department</InputLabel>
            <Select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              label="Department"
            >
              <MenuItem value="">All</MenuItem>
              {filterOptions.departments.map((dept) => (
                <MenuItem key={dept} value={dept}>
                  {dept}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl sx={{ minWidth: 150 }}>
            <InputLabel>Vendor</InputLabel>
            <Select
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value)}
              label="Vendor"
            >
              <MenuItem value="">All</MenuItem>
              {filterOptions.vendors.map((vendor) => (
                <MenuItem key={vendor} value={vendor}>
                  {vendor}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl sx={{ minWidth: 150 }}>
            <InputLabel>Sort By</InputLabel>
            <Select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              label="Sort By"
            >
              <MenuItem value="submittedDate">Date</MenuItem>
              <MenuItem value="requestorName">Requestor</MenuItem>
              <MenuItem value="amount">Amount</MenuItem>
            </Select>
          </FormControl>
        </Stack>

        {/* Results count */}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Showing {archivePRs.length} archived request{archivePRs.length !== 1 ? 's' : ''}
        </Typography>
      </Paper>

      {/* Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Requestor</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Department</TableCell>
              <TableCell>Vendor</TableCell>
              <TableCell align="right">Amount</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedPRs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">
                    No archived requests found
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              paginatedPRs.map((pr) => (
                <TableRow key={pr.id} hover>
                  <TableCell>{formatDate(pr.submittedDate)}</TableCell>
                  <TableCell>
                    <Box>
                      <Typography variant="body2">{pr.requestorName || 'N/A'}</Typography>
                      {pr.requestorEmail && (
                        <Typography variant="caption" color="text.secondary">
                          {pr.requestorEmail}
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      sx={{
                        maxWidth: 300,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={pr.description}
                    >
                      {pr.description || 'N/A'}
                    </Typography>
                  </TableCell>
                  <TableCell>{pr.department || 'N/A'}</TableCell>
                  <TableCell>{pr.vendorName || pr.vendor || 'N/A'}</TableCell>
                  <TableCell align="right">
                    {pr.amount
                      ? formatCurrency(pr.amount, pr.currency || 'LSL')
                      : 'N/A'}
                  </TableCell>
                  <TableCell align="center">
                    <IconButton
                      size="small"
                      onClick={() => navigate(`/archive/${pr.id}`)}
                      title="View details"
                    >
                      <ViewIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={archivePRs.length}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[10, 25, 50, 100]}
        />
      </TableContainer>
    </Box>
  );
};

