import React from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  FormHelperText,
  Grid,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  Link,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Select,
  MenuItem,
  Typography,
  Radio,
  Tooltip
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { StorageService } from '../../../services/storage';
import { Quote, ReferenceDataItem, PRStatus } from '../../../types/pr';
import { auth } from '../../../config/firebase';

interface QuotesStepProps {
  formState: {
    quotes?: Quote[];
    preferredQuoteId?: string;
    status?: PRStatus;
    [key: string]: any;
  };
  setFormState: (state: any) => void;
  vendors: ReferenceDataItem[];
  currencies: ReferenceDataItem[];
  loading?: boolean;
  isEditing?: boolean;
  onSave?: () => Promise<void>;
  isProcurement?: boolean;
  onPreferredQuoteChange?: (quoteId: string) => void;
}

const emptyQuote: Quote = {
  id: crypto.randomUUID(),
  vendorId: '',
  vendorName: '',
  quoteDate: new Date().toISOString().split('T')[0],
  amount: 0,
  currency: '',
  notes: '',
  attachments: [],
  submittedBy: undefined,
  submittedAt: undefined
};

export function QuotesStep({
  formState,
  setFormState,
  vendors,
  currencies,
  loading,
  isEditing = false,
  onSave,
  isProcurement = false,
  onPreferredQuoteChange
}: QuotesStepProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [deleteIndex, setDeleteIndex] = React.useState<number | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const quotes = formState.quotes || [];
  const readOnly = !isEditing;
  const preferredQuoteId = formState.preferredQuoteId;
  const isInQueue = formState.status === PRStatus.IN_QUEUE;
  const canSelectPreferred = isProcurement && isInQueue && quotes.length > 1;

  console.log('QuotesStep: isEditing=', isEditing, 'readOnly=', readOnly);
  console.log('Current quotes:', quotes);
  console.log('Can select preferred:', canSelectPreferred, { isProcurement, isInQueue, quotesCount: quotes.length });

  const handleAddQuote = () => {
    if (!readOnly) {
      const currentQuotes = formState.quotes || [];
      const newQuote = {
        ...emptyQuote,
        id: crypto.randomUUID(),
        currency: currencies[0]?.id || '',
        quoteDate: new Date().toISOString().split('T')[0]
      };
      console.log('Adding new quote:', newQuote);
      console.log('Current quotes:', currentQuotes);
      const updatedQuotes = [...currentQuotes, newQuote];
      console.log('Updated quotes:', updatedQuotes);
      setFormState({
        ...formState,
        quotes: updatedQuotes
      });
    }
  };

  const handleRemoveQuote = (index: number) => {
    if (!readOnly) {
      setDeleteIndex(index);
      setDeleteDialogOpen(true);
    }
  };

  const handleConfirmDelete = () => {
    if (!readOnly && deleteIndex !== null) {
      const currentQuotes = formState.quotes || [];
      const updatedQuotes = [
        ...currentQuotes.slice(0, deleteIndex),
        ...currentQuotes.slice(deleteIndex + 1)
      ];
      setFormState({
        ...formState,
        quotes: updatedQuotes
      });
      setDeleteDialogOpen(false);
      setDeleteIndex(null);
    }
  };

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
    setDeleteIndex(null);
  };

  const handleQuoteChange = (index: number, field: keyof Quote) => (
    event: React.ChangeEvent<HTMLInputElement | { name?: string; value: unknown }>
  ) => {
    if (!readOnly) {
      console.log('Quote change:', { index, field, value: event.target.value });
      
      const currentQuotes = formState.quotes || [];
      const value = field === 'amount' ? Number(event.target.value) : event.target.value;
      
      const updatedQuotes = currentQuotes.map((quote, i) => {
        if (i === index) {
          if (field === 'vendorId' && typeof value === 'string') {
            const vendor = vendors.find(v => v.id === value);
            console.log('Selected vendor:', vendor);
            return {
              ...quote,
              vendorId: value,
              vendorName: vendor?.name || '',
              currency: quote.currency || currencies[0]?.id || '',
              quoteDate: quote.quoteDate || new Date().toISOString().split('T')[0],
              amount: quote.amount || 0,
              notes: quote.notes || '',
              attachments: quote.attachments || []
            };
          }
          return {
            ...quote,
            [field]: value
          };
        }
        return quote;
      });
      
      console.log('Updated quotes:', updatedQuotes);
      setFormState({
        ...formState,
        quotes: updatedQuotes
      });
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, quoteIndex: number) => {
    if (!event.target.files?.length) return;
    
    try {
      console.log('Uploading files:', event.target.files);
      const uploadedFiles = await Promise.all(
        Array.from(event.target.files).map(async (file) => {
          const result = await StorageService.uploadToTempStorage(file);
          console.log('File uploaded:', result);
          return {
            id: crypto.randomUUID(),
            name: result.name,
            url: result.url,
            path: result.path,
            type: result.type,
            size: result.size,
            uploadedAt: new Date().toISOString(),
            uploadedBy: {
              id: auth.currentUser?.uid || '',
              email: auth.currentUser?.email || '',
              name: auth.currentUser?.displayName || '',
              organization: formState.organization || '',
              isActive: true,
              role: 'USER'
            }
          };
        })
      );
      console.log('All files uploaded:', uploadedFiles);

      // Update the quote's attachments
      const currentQuotes = formState.quotes || [];
      const updatedQuotes = currentQuotes.map((quote, index) => {
        if (index === quoteIndex) {
          return {
            ...quote,
            attachments: [...(quote.attachments || []), ...uploadedFiles]
          };
        }
        return quote;
      });

      // Update form state with new quotes
      setFormState({
        ...formState,
        quotes: updatedQuotes
      });
    } catch (error) {
      console.error('Error uploading files:', error);
    }
  };

  const handleDeleteAttachment = (quoteId: string, attachmentId: string) => {
    if (!readOnly) {
      const currentQuotes = formState.quotes || [];
      const updatedQuotes = currentQuotes.map(quote => {
        if (quote.id === quoteId) {
          return {
            ...quote,
            attachments: (quote.attachments || []).filter(a => a.id !== attachmentId)
          };
        }
        return quote;
      });
      
      setFormState({
        ...formState,
        quotes: updatedQuotes
      });
    }
  };

  const validateQuote = (quote: Quote): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!quote.vendorName) {
      newErrors[`vendor-${quote.id}`] = 'Vendor is required';
    }
    if (!quote.amount || quote.amount <= 0) {
      newErrors[`amount-${quote.id}`] = 'Amount must be greater than 0';
    }
    if (!quote.currency) {
      newErrors[`currency-${quote.id}`] = 'Currency is required';
    }
    if (!quote.quoteDate) {
      newErrors[`quoteDate-${quote.id}`] = 'Quote date is required';
    }

    setErrors(prev => ({ ...prev, ...newErrors }));
    return Object.keys(newErrors).length === 0;
  };

  const handlePreferredQuoteSelection = (quoteId: string) => {
    console.log('Selecting preferred quote:', quoteId);
    if (onPreferredQuoteChange) {
      onPreferredQuoteChange(quoteId);
    }
  };

  const handleSave = async () => {
    if (!onSave || readOnly) return;
    
    // Validate all quotes
    const isValid = quotes.every(validateQuote);
    if (!isValid) {
      return;
    }

    try {
      setIsSaving(true);
      await onSave();
    } catch (error) {
      console.error('Error saving quotes:', error);
      // Error handling is done in parent component
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Box>
      {canSelectPreferred && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Select the preferred quote to use for approval. The PR amount will be updated automatically.
        </Typography>
      )}
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              {canSelectPreferred && (
                <TableCell width="8%" align="center">Preferred</TableCell>
              )}
              <TableCell width="20%">Vendor</TableCell>
              <TableCell width="15%">Date</TableCell>
              <TableCell width="15%">Amount</TableCell>
              <TableCell width="10%">Currency</TableCell>
              <TableCell width="20%">Notes</TableCell>
              <TableCell width="15%">Attachments</TableCell>
              <TableCell width="5%">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {quotes.map((quote, index) => (
              <TableRow 
                key={quote.id}
                sx={{
                  backgroundColor: preferredQuoteId === quote.id ? 'rgba(76, 175, 80, 0.08)' : 'inherit'
                }}
              >
                {canSelectPreferred && (
                  <TableCell align="center">
                    <Tooltip title={preferredQuoteId === quote.id ? "Selected as preferred quote" : "Select as preferred quote"}>
                      <Radio
                        checked={preferredQuoteId === quote.id}
                        onChange={() => handlePreferredQuoteSelection(quote.id || '')}
                        value={quote.id}
                        name="preferred-quote"
                        color="success"
                      />
                    </Tooltip>
                  </TableCell>
                )}
                <TableCell>
                  <FormControl fullWidth error={!quote.vendorId && !readOnly}>
                    <InputLabel>Vendor</InputLabel>
                    <Select
                      value={quote.vendorId}
                      onChange={(event) => {
                        const value = event.target.value;
                        if (typeof value === 'string') {
                          handleQuoteChange(index, 'vendorId')({
                            target: { value }
                          });
                        }
                      }}
                      label="Vendor"
                      disabled={readOnly}
                      sx={{ 
                        '& .MuiSelect-select.Mui-disabled': {
                          WebkitTextFillColor: 'rgba(0, 0, 0, 0.6)',
                        }
                      }}
                    >
                      <MenuItem value="">Select Vendor</MenuItem>
                      {vendors.map((vendor) => (
                        <MenuItem key={vendor.id} value={vendor.id}>
                          {vendor.name}
                        </MenuItem>
                      ))}
                    </Select>
                    {!quote.vendorId && !readOnly && (
                      <FormHelperText error>Vendor is required</FormHelperText>
                    )}
                  </FormControl>
                </TableCell>
                <TableCell>
                  <TextField
                    type="date"
                    value={quote.quoteDate}
                    onChange={handleQuoteChange(index, 'quoteDate')}
                    disabled={readOnly}
                    error={!quote.quoteDate && !readOnly}
                    helperText={!quote.quoteDate && !readOnly ? 'Date is required' : ''}
                    sx={{ 
                      '& .MuiInputBase-input.Mui-disabled': {
                        WebkitTextFillColor: 'rgba(0, 0, 0, 0.6)',
                      }
                    }}
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    type="number"
                    value={quote.amount}
                    onChange={handleQuoteChange(index, 'amount')}
                    disabled={readOnly}
                    error={(!quote.amount || quote.amount <= 0) && !readOnly}
                    helperText={(!quote.amount || quote.amount <= 0) && !readOnly ? 'Amount must be greater than 0' : ''}
                    fullWidth
                    sx={{ 
                      minWidth: '120px',
                      '& .MuiInputBase-input.Mui-disabled': {
                        WebkitTextFillColor: 'rgba(0, 0, 0, 0.6)',
                      }
                    }}
                    inputProps={{
                      step: '0.01',
                      min: '0'
                    }}
                  />
                </TableCell>
                <TableCell>
                  <FormControl fullWidth error={!quote.currency && !readOnly}>
                    <InputLabel>Currency</InputLabel>
                    <Select
                      value={quote.currency}
                      onChange={handleQuoteChange(index, 'currency')}
                      disabled={readOnly}
                      error={!quote.currency && !readOnly}
                      sx={{ 
                        '& .MuiSelect-select.Mui-disabled': {
                          WebkitTextFillColor: 'rgba(0, 0, 0, 0.6)',
                        }
                      }}
                    >
                      <MenuItem value="">Select Currency</MenuItem>
                      {currencies.map((currency) => (
                        <MenuItem key={currency.id} value={currency.id}>
                          {currency.name}
                        </MenuItem>
                      ))}
                    </Select>
                    {!quote.currency && !readOnly && (
                      <FormHelperText error>Currency is required</FormHelperText>
                    )}
                  </FormControl>
                </TableCell>
                <TableCell>
                  <TextField
                    multiline
                    rows={3}
                    value={quote.notes}
                    onChange={handleQuoteChange(index, 'notes')}
                    disabled={readOnly}
                    fullWidth
                    placeholder="Enter any additional notes about the quote"
                    sx={{ 
                      minWidth: '200px',
                      '& .MuiInputBase-input.Mui-disabled': {
                        WebkitTextFillColor: 'rgba(0, 0, 0, 0.6)',
                      },
                      '& .MuiInputBase-root': {
                        height: 'auto',
                      },
                      '& .MuiInputBase-input': {
                        overflow: 'auto',
                        whiteSpace: 'pre-wrap',
                        wordWrap: 'break-word'
                      }
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <input
                      type="file"
                      onChange={(e) => handleFileUpload(e, index)}
                      multiple
                      style={{ display: 'none' }}
                      id={`file-upload-${index}`}
                      disabled={readOnly}
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                    />
                    <label htmlFor={`file-upload-${index}`}>
                      <Button
                        component="span"
                        variant="outlined"
                        startIcon={<AttachFileIcon />}
                        disabled={readOnly}
                        title="Upload quote attachments (PDF, DOC, XLS, Images)"
                      >
                        Upload Files
                      </Button>
                    </label>
                    {quote.attachments && quote.attachments.length > 0 && (
                      <List dense sx={{ maxHeight: '100px', overflow: 'auto' }}>
                        {quote.attachments.map((file) => (
                          <ListItem key={file.id}>
                            <ListItemText
                              primary={
                                <Link href={file.url} target="_blank" rel="noopener noreferrer">
                                  {file.name}
                                </Link>
                              }
                            />
                            <IconButton 
                              onClick={() => handleDeleteAttachment(quote.id, file.id)} 
                              color="error"
                              title="Delete attachment"
                            >
                              <DeleteIcon />
                            </IconButton>
                          </ListItem>
                        ))}
                      </List>
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    {!readOnly && (
                      <IconButton 
                        onClick={() => handleRemoveQuote(index)} 
                        color="error"
                        title="Delete quote"
                      >
                        <DeleteIcon />
                      </IconButton>
                    )}
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {!readOnly && (
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={handleAddQuote}
            disabled={isSaving}
          >
            Add Quote
          </Button>
        )}
        {!readOnly && onSave && (
          <Button
            variant="contained"
            color="primary"
            startIcon={isSaving ? <CircularProgress size={20} /> : <SaveIcon />}
            onClick={handleSave}
            disabled={isSaving || Object.keys(errors).length > 0}
          >
            {isSaving ? 'Saving...' : 'Save Quotes'}
          </Button>
        )}
      </Box>

      <Dialog open={deleteDialogOpen} onClose={handleCancelDelete}>
        <DialogTitle>Delete Quote</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this quote?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelDelete}>Cancel</Button>
          <Button onClick={handleConfirmDelete} color="error">Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
