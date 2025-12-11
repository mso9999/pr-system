import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Box,
  Button,
  FormControl,
  FormHelperText,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import StoreIcon from '@mui/icons-material/Store';
import { Quote, ReferenceDataItem } from '@/types/pr';
import { StorageService } from '@/services/storage';
import { VendorSelectionDialog } from '../common/VendorSelectionDialog';

const formSchema = z.object({
  vendorId: z.string().min(1, { message: 'Vendor is required' }),
  quoteDate: z.string().min(1, { message: 'Quote date is required' }),
  amount: z.number().min(0.01, { message: 'Amount must be greater than 0' }),
  currency: z.string().min(1, { message: 'Currency is required' }),
  notes: z.string().optional(),
});

interface QuoteFormProps {
  onSubmit: (data: Quote) => void;
  onCancel: () => void;
  initialData?: Quote;
  vendors: ReferenceDataItem[];
  currencies: ReferenceDataItem[];
  isEditing: boolean;
}

export function QuoteForm({
  onSubmit,
  onCancel,
  initialData,
  vendors = [],
  currencies = [],
  isEditing,
}: QuoteFormProps) {
  const [attachments, setAttachments] = useState<Array<{
    id: string;
    name: string;
    url: string;
  }>>(initialData?.attachments || []);
  const [vendorDialogOpen, setVendorDialogOpen] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      vendorId: initialData?.vendorId || '',
      quoteDate: initialData?.quoteDate || new Date().toISOString().split('T')[0],
      amount: initialData?.amount || 0,
      currency: initialData?.currency || (currencies[0]?.id || 'LSL'),
      notes: initialData?.notes || '',
    },
  });

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    try {
      const result = await StorageService.uploadToTempStorage(file);
      setAttachments(prev => [...prev, {
        id: crypto.randomUUID(),
        name: file.name,
        url: result.url,
      }]);
    } catch (error) {
      console.error('Error uploading file:', error);
    }
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments(prev => prev.filter(attachment => attachment.id !== id));
  };

  const onSubmitForm = (values: z.infer<typeof formSchema>) => {
    const vendor = vendors.find(v => v.id === values.vendorId);
    onSubmit({
      ...values,
      id: initialData?.id || crypto.randomUUID(),
      vendorName: vendor?.name || '',
      attachments,
    });
  };

  return (
    <Box component="form" onSubmit={handleSubmit(onSubmitForm)} sx={{ mt: 2 }}>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Box>
            <Button
              variant="outlined"
              fullWidth
              startIcon={<StoreIcon />}
              onClick={() => setVendorDialogOpen(true)}
              sx={{
                justifyContent: 'flex-start',
                textTransform: 'none',
                height: '56px',
                ...(watch('vendorId') && {
                  color: 'text.primary',
                  fontWeight: 'normal',
                }),
              }}
            >
              {watch('vendorId')
                ? vendors.find(v => v.id === watch('vendorId'))?.name || 'Select Vendor'
                : 'Select Vendor'}
            </Button>
            {errors.vendorId && (
              <FormHelperText error sx={{ mt: 0.5 }}>{errors.vendorId.message}</FormHelperText>
            )}
            <VendorSelectionDialog
              open={vendorDialogOpen}
              onClose={() => setVendorDialogOpen(false)}
              onSelect={(vendorId) => {
                setValue('vendorId', vendorId, { shouldValidate: true });
                setVendorDialogOpen(false);
              }}
              vendors={vendors.filter(vendor => vendor.active)}
              selectedVendorId={watch('vendorId') || undefined}
            />
          </Box>
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            {...register('quoteDate')}
            fullWidth
            type="date"
            label="Quote Date"
            error={!!errors.quoteDate}
            helperText={errors.quoteDate?.message}
            InputLabelProps={{ shrink: true }}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            {...register('amount', { valueAsNumber: true })}
            fullWidth
            type="number"
            label="Amount"
            error={!!errors.amount}
            helperText={errors.amount?.message}
            InputProps={{ inputProps: { min: 0, step: 0.01 } }}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <FormControl fullWidth error={!!errors.currency}>
            <InputLabel>Currency</InputLabel>
            <Select
              {...register('currency')}
              label="Currency"
              defaultValue={initialData?.currency || currencies[0]?.id || 'LSL'}
            >
              {currencies.map((currency) => (
                <MenuItem key={currency.id} value={currency.id}>
                  {currency.name}
                </MenuItem>
              ))}
            </Select>
            {errors.currency && (
              <FormHelperText>{errors.currency.message}</FormHelperText>
            )}
          </FormControl>
        </Grid>

        <Grid item xs={12}>
          <TextField
            {...register('notes')}
            fullWidth
            label="Notes"
            multiline
            rows={4}
            error={!!errors.notes}
            helperText={errors.notes?.message}
          />
        </Grid>

        <Grid item xs={12}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <input
              type="file"
              id="file-upload"
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />
            <label htmlFor="file-upload">
              <Button variant="outlined" component="span">
                Upload Files
              </Button>
            </label>
          </Box>
          {attachments.map((attachment) => (
            <Box
              key={attachment.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                mt: 1,
              }}
            >
              <Typography variant="body2">{attachment.name}</Typography>
              <Button
                size="small"
                color="error"
                onClick={() => handleRemoveAttachment(attachment.id)}
              >
                Remove
              </Button>
            </Box>
          ))}
        </Grid>

        <Grid item xs={12}>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
            <Button variant="outlined" onClick={onCancel}>
              Cancel
            </Button>
            <Button variant="contained" type="submit">
              {isEditing ? 'Update' : 'Add'} Quote
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}
