import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TablePagination,
  InputAdornment,
  IconButton,
  Box,
  Typography,
} from '@mui/material';
import { Search as SearchIcon, Clear as ClearIcon } from '@mui/icons-material';
import { ReferenceDataItem } from '@/types/referenceData';

interface VendorSelectionDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (vendorId: string) => void;
  vendors: ReferenceDataItem[];
  selectedVendorId?: string;
}

const ROWS_PER_PAGE = 10;

export const VendorSelectionDialog: React.FC<VendorSelectionDialogProps> = ({
  open,
  onClose,
  onSelect,
  vendors,
  selectedVendorId,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);

  // Filter and sort vendors
  const filteredVendors = useMemo(() => {
    if (!searchTerm.trim()) {
      return [...vendors].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }

    const searchLower = searchTerm.toLowerCase();
    return vendors
      .filter((vendor) => {
        // Search in company name
        const nameMatch = vendor.name?.toLowerCase().includes(searchLower);
        
        // Search in contact person name
        const contactMatch = vendor.contactName?.toLowerCase().includes(searchLower);
        
        // Search in phone number (including country codes like +266)
        const phoneMatch = vendor.contactPhone?.includes(searchTerm) || 
                          vendor.contactPhone?.includes(searchLower);
        
        // Search in country
        const countryMatch = vendor.country?.toLowerCase().includes(searchLower);
        
        // Search in email
        const emailMatch = vendor.contactEmail?.toLowerCase().includes(searchLower);
        
        // Search in address
        const addressMatch = vendor.address?.toLowerCase().includes(searchLower);
        
        // Search in city
        const cityMatch = vendor.city?.toLowerCase().includes(searchLower);
        
        return nameMatch || contactMatch || phoneMatch || countryMatch || emailMatch || addressMatch || cityMatch;
      })
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [vendors, searchTerm]);

  // Pagination
  const paginatedVendors = useMemo(() => {
    const startIndex = page * ROWS_PER_PAGE;
    return filteredVendors.slice(startIndex, startIndex + ROWS_PER_PAGE);
  }, [filteredVendors, page]);

  const handlePageChange = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
    setPage(0); // Reset to first page when search changes
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setPage(0);
  };

  const handleSelectVendor = (vendorId: string) => {
    onSelect(vendorId);
    onClose();
    // Reset search and page when closing
    setSearchTerm('');
    setPage(0);
  };

  const handleClose = () => {
    onClose();
    // Reset search and page when closing
    setSearchTerm('');
    setPage(0);
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Select Vendor</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <TextField
            fullWidth
            placeholder="Search by company name, contact person, phone (+266), country, email, address, or city..."
            value={searchTerm}
            onChange={handleSearchChange}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
              endAdornment: searchTerm && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={handleClearSearch} edge="end">
                    <ClearIcon />
                  </IconButton>
                </InputAdornment>
              ),
            }}
            sx={{ mb: 2 }}
          />
          <Typography variant="body2" color="text.secondary">
            {filteredVendors.length} vendor{filteredVendors.length !== 1 ? 's' : ''} found
          </Typography>
        </Box>

        <TableContainer component={Paper} sx={{ maxHeight: 500 }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>Company Name</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Contact Person</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Phone</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Email</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Country</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedVendors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      {searchTerm ? 'No vendors found matching your search' : 'No vendors available'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedVendors.map((vendor) => (
                  <TableRow
                    key={vendor.id}
                    hover
                    selected={selectedVendorId === vendor.id}
                    sx={{
                      cursor: 'pointer',
                      '&:hover': { backgroundColor: 'action.hover' },
                      ...(selectedVendorId === vendor.id && {
                        backgroundColor: 'action.selected',
                      }),
                    }}
                    onClick={() => handleSelectVendor(vendor.id)}
                  >
                    <TableCell>{vendor.name || '-'}</TableCell>
                    <TableCell>{vendor.contactName || '-'}</TableCell>
                    <TableCell>{vendor.contactPhone || '-'}</TableCell>
                    <TableCell>{vendor.contactEmail || '-'}</TableCell>
                    <TableCell>{vendor.country || '-'}</TableCell>
                    <TableCell>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectVendor(vendor.id);
                        }}
                      >
                        Select
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={filteredVendors.length}
          page={page}
          onPageChange={handlePageChange}
          rowsPerPage={ROWS_PER_PAGE}
          rowsPerPageOptions={[]} // Disable rows per page selector, always 10
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
};

