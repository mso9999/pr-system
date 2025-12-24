/**
 * @fileoverview Line Items Step Component
 * @version 1.0.0
 * 
 * Description:
 * Second step in the PR creation process. Manages line items
 * including descriptions, quantities, and unit of measure.
 */

import React from 'react';
import {
  Grid,
  TextField,
  IconButton,
  Button,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Box,
  Tooltip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import DownloadIcon from '@mui/icons-material/Download';
import VisibilityIcon from '@mui/icons-material/Visibility';
import LinkIcon from '@mui/icons-material/Link';
import FolderIcon from '@mui/icons-material/Folder';
import { FormState } from '../NewPRForm';
import { StorageService } from '../../../services/storage';
import { Attachment } from '../../../types/pr';
import { referenceDataService } from '../../../services/referenceData';
import { useResponsive } from '../../../hooks/useResponsive';
import { Card, CardContent, Divider } from '@mui/material';

interface LineItemsStepProps {
  formState: FormState;
  setFormState: React.Dispatch<React.SetStateAction<FormState>>;
  loading: boolean;
}

const emptyLineItem = {
  description: '',
  quantity: 0,
  uom: '',
  notes: '',
  attachments: []
};

export const LineItemsStep: React.FC<LineItemsStepProps> = ({
  formState,
  setFormState,
  loading
}) => {
  const { isMobile } = useResponsive();
  const [deleteIndex, setDeleteIndex] = React.useState<number | null>(null);
  const [uomOptions, setUomOptions] = React.useState<string[]>([]);

  // Load UOM options from reference data
  React.useEffect(() => {
    const loadUomOptions = async () => {
      try {
        console.log('📏 Loading UOM options from reference data...');
        const uomData = await referenceDataService.getItemsByType('uom');
        console.log(`📏 Loaded ${uomData.length} UOM items from reference data:`, uomData);
        const options = uomData
          .filter(item => item.active)
          .map(item => item.code || '');
        console.log(`📏 Filtered to ${options.length} active UOM options:`, options);
        setUomOptions(options);
      } catch (error) {
        console.error('❌ Error loading UOM options:', error);
      }
    };
    loadUomOptions();
  }, []);

  // Add new line item
  const handleAddLineItem = () => {
    setFormState(prev => ({
      ...prev,
      lineItems: [...prev.lineItems, { ...emptyLineItem }]
    }));
  };

  // Remove line item
  const handleRemoveLineItem = (index: number) => {
    setDeleteIndex(index);
  };

  const handleConfirmDelete = () => {
    if (deleteIndex !== null) {
      setFormState(prev => ({
        ...prev,
        lineItems: prev.lineItems.filter((_, i) => i !== deleteIndex)
      }));
      setDeleteIndex(null);
    }
  };

  const handleCancelDelete = () => {
    setDeleteIndex(null);
  };

  // Update line item
  const handleLineItemChange = (index: number, field: keyof typeof emptyLineItem) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = field === 'quantity' ? Number(event.target.value) : event.target.value;
    setFormState(prev => ({
      ...prev,
      lineItems: prev.lineItems.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    try {
      const result = await StorageService.uploadToTempStorage(file);
      
      setFormState(prev => ({
        ...prev,
        lineItems: prev.lineItems.map((item, i) => {
          if (i === index) {
            return {
              ...item,
              attachments: [
                ...item.attachments,
                {
                  name: file.name,
                  url: result.url,
                  path: result.path
                }
              ]
            };
          }
          return item;
        })
      }));
    } catch (error) {
      console.error('Error uploading file:', error);
    }
  };

  // Remove attachment
  const handleRemoveAttachment = (lineItemIndex: number, attachmentIndex: number) => {
    setFormState(prev => ({
      ...prev,
      lineItems: prev.lineItems.map((item, i) =>
        i === lineItemIndex ? {
          ...item,
          attachments: (item.attachments || []).filter((_, j) => j !== attachmentIndex)
        } : item
      )
    }));
  };

  return (
    <Grid container spacing={3}>
      {loading && (
        <Grid item xs={12} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <CircularProgress />
          <Typography>Loading...</Typography>
        </Grid>
      )}
      
      <Grid item xs={12}>
        <Typography variant="h6">
          Line Items
          {formState.lineItems.length > 0 && (
            <Typography component="span" sx={{ ml: 1 }}>
              (Total items: {formState.lineItems.length})
            </Typography>
          )}
        </Typography>
      </Grid>

      <Grid item xs={12}>
        <TableContainer 
          component={Paper}
          sx={{ 
            maxWidth: '100%',
            overflowX: isMobile ? 'auto' : 'visible'
          }}
        >
          <Table sx={{ minWidth: isMobile ? 800 : 'auto' }}>
            <TableHead>
              <TableRow>
                <TableCell>Description</TableCell>
                <TableCell align="right">Quantity</TableCell>
                <TableCell>UOM</TableCell>
                <TableCell>Notes</TableCell>
                <TableCell>Attachments</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {formState.lineItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography color="textSecondary">
                      No items added
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                formState.lineItems.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <TextField
                        fullWidth
                        required
                        value={item.description}
                        onChange={handleLineItemChange(index, 'description')}
                        disabled={loading}
                        placeholder="Item description"
                        label="Description"
                        error={!item.description}
                        helperText={!item.description ? "Description is required" : ""}
                        inputProps={{
                          'aria-label': 'description'
                        }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <TextField
                        type="number"
                        required
                        value={item.quantity}
                        onChange={handleLineItemChange(index, 'quantity')}
                        disabled={loading}
                        error={item.quantity <= 0}
                        helperText={item.quantity <= 0 ? "Quantity must be greater than 0" : ""}
                        inputProps={{ 
                          min: 0,
                          'aria-label': 'quantity'
                        }}
                        label="Quantity"
                      />
                    </TableCell>
                    <TableCell>
                      <FormControl fullWidth size="small">
                        <InputLabel>UOM</InputLabel>
                        <Select
                          value={item.uom}
                          onChange={handleLineItemChange(index, 'uom')}
                          label="UOM"
                          required
                        >
                          <MenuItem value="">
                            <em>Select UOM</em>
                          </MenuItem>
                          {uomOptions.map((option) => (
                            <MenuItem key={option} value={option}>
                              {option}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </TableCell>
                    <TableCell>
                      <TextField
                        fullWidth
                        value={item.notes}
                        onChange={handleLineItemChange(index, 'notes')}
                        disabled={loading}
                        placeholder="Additional notes"
                        label="Notes"
                        inputProps={{
                          'aria-label': 'notes'
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <input
                            type="file"
                            id={`file-upload-${index}`}
                            style={{ display: 'none' }}
                            onChange={(e) => handleFileUpload(e, index)}
                            multiple
                          />
                          <label htmlFor={`file-upload-${index}`}>
                            <Button
                              component="span"
                              startIcon={<AttachFileIcon />}
                              size="small"
                              variant="outlined"
                              sx={{ minHeight: '44px', minWidth: '44px' }}
                            >
                              Attach Files
                            </Button>
                          </label>
                        </Box>
                        {item.attachments?.map((file, fileIndex) => (
                          <Box key={fileIndex} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <AttachFileIcon fontSize="small" color="primary" />
                            <Typography variant="body2" sx={{ flex: 1 }}>
                              {file.name}
                            </Typography>
                            <IconButton
                              size="small"
                              onClick={() => handleRemoveAttachment(index, fileIndex)}
                              sx={{ minWidth: '44px', minHeight: '44px' }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        ))}
                        {(item as any).fileLink && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                            {(item as any).isFolder ? (
                              <FolderIcon fontSize="small" color="info" />
                            ) : (
                              <LinkIcon fontSize="small" color="info" />
                            )}
                            <Tooltip title={(item as any).fileLink}>
                              <Typography 
                                variant="caption" 
                                color="info.main"
                                sx={{ 
                                  flex: 1, 
                                  overflow: 'hidden', 
                                  textOverflow: 'ellipsis', 
                                  whiteSpace: 'nowrap',
                                  cursor: 'pointer',
                                  textDecoration: 'underline'
                                }}
                                onClick={() => window.open((item as any).fileLink, '_blank')}
                              >
                                {(item as any).isFolder ? 'Folder: ' : 'Link: '}
                                {(item as any).fileLink}
                              </Typography>
                            </Tooltip>
                          </Box>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        onClick={() => handleRemoveLineItem(index)}
                        disabled={loading}
                        aria-label="delete line item"
                        sx={{ minWidth: '44px', minHeight: '44px' }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Grid>

      <Grid item xs={12}>
        <Button
          variant="outlined"
          color="primary"
          onClick={handleAddLineItem}
          startIcon={<AddIcon />}
          disabled={loading}
          aria-label="add line item"
        >
          Add Line Item
        </Button>
      </Grid>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteIndex !== null}
        onClose={handleCancelDelete}
        aria-labelledby="delete-dialog-title"
      >
        <DialogTitle id="delete-dialog-title">
          Confirm Delete
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this line item?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelDelete}>Cancel</Button>
          <Button onClick={handleConfirmDelete} aria-label="confirm delete">
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </Grid>
  );
};
