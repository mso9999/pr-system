/**
 * @fileoverview Invoice Generation Dialog
 * @description Allows users to generate an invoice PDF from PR/PO data
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  Typography,
  Divider,
  Box,
  Alert,
  CircularProgress,
  Stack,
  IconButton,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { pdf } from '@react-pdf/renderer';
import { PRRequest } from '@/types/pr';
import { Invoice, InvoiceLineItem } from '@/types/invoice';
import { InvoiceDocument } from './InvoiceDocument';
import { formatCurrency } from '@/utils/formatters';
import { generateInvoiceNumber, computeInvoiceTotal } from '@/services/invoice';

interface InvoiceGenerationDialogProps {
  open: boolean;
  pr: PRRequest;
  organizationDetails?: {
    companyLegalName?: string;
    companyAddress?: {
      street?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
    };
    companyPhone?: string;
    companyRegistrationNumber?: string;
    companyTaxId?: string;
    bankName?: string;
    bankAccountName?: string;
    bankAccountNumber?: string;
    bankSwiftCode?: string;
    bankIban?: string;
    bankBranch?: string;
    logoUrl?: string;
  };
  vendorDetails?: {
    name?: string;
    address?: string;
    city?: string;
    country?: string;
    contactName?: string;
    contactPhone?: string;
    contactEmail?: string;
  } | null;
  logoBase64?: string;
  onClose: () => void;
}

export const InvoiceGenerationDialog: React.FC<InvoiceGenerationDialogProps> = ({
  open,
  pr,
  organizationDetails,
  vendorDetails,
  logoBase64,
  onClose,
}) => {
  const [generating, setGenerating] = useState(false);

  const [invoiceNumber, setInvoiceNumber] = useState(generateInvoiceNumber());
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [milestone, setMilestone] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('Payment due within 15 days of receipt of complete supporting documentation.');

  const [customerName, setCustomerName] = useState(vendorDetails?.name || pr.selectedVendor || pr.preferredVendor || '');
  const [customerAddress, setCustomerAddress] = useState(
    [vendorDetails?.address, vendorDetails?.city, vendorDetails?.country].filter(Boolean).join(', ')
  );
  const [customerContactPerson, setCustomerContactPerson] = useState(vendorDetails?.contactName || pr.supplierRepresentativeName || '');
  const [customerContactPhone, setCustomerContactPhone] = useState(vendorDetails?.contactPhone || pr.supplierRepresentativePhone || '');
  const [customerContactEmail, setCustomerContactEmail] = useState(vendorDetails?.contactEmail || pr.supplierRepresentativeEmail || '');

  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>(
    pr.lineItemsWithSKU?.length
      ? pr.lineItemsWithSKU.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.totalAmount,
        }))
      : pr.lineItems?.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice || 0,
          total: (item.quantity || 0) * (item.unitPrice || 0),
        })) || [{ description: '', quantity: 1, unitPrice: 0, total: 0 }]
  );

  const [supportingDocs, setSupportingDocs] = useState<string[]>(['']);

  useEffect(() => {
    if (!dueDate && issueDate) {
      const d = new Date(issueDate);
      d.setDate(d.getDate() + 15);
      setDueDate(d.toISOString().split('T')[0]);
    }
  }, [issueDate, dueDate]);

  const totalAmount = computeInvoiceTotal(lineItems);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const invoice: Invoice = {
        id: '',
        invoiceNumber,
        poReference: pr.prNumber,
        contractReference: pr.referenceContractNumber || '',
        issuer: {
          name: organizationDetails?.companyLegalName || pr.organization,
          address: [
            organizationDetails?.companyAddress?.street,
            organizationDetails?.companyAddress?.city,
            organizationDetails?.companyAddress?.country,
          ].filter(Boolean).join(', '),
          taxId: organizationDetails?.companyTaxId,
          registrationNumber: organizationDetails?.companyRegistrationNumber,
          banking: {
            bankName: organizationDetails?.bankName,
            accountName: organizationDetails?.bankAccountName,
            accountNumber: organizationDetails?.bankAccountNumber,
            swiftCode: organizationDetails?.bankSwiftCode,
            iban: organizationDetails?.bankIban,
            branch: organizationDetails?.bankBranch,
          },
        },
        customer: {
          name: customerName,
          address: customerAddress,
          contactPerson: customerContactPerson,
          contactPhone: customerContactPhone,
          contactEmail: customerContactEmail,
        },
        milestone,
        lineItems: lineItems.filter(li => li.description),
        totalAmount,
        currency: pr.currency || 'USD',
        issueDate: new Date(issueDate).toISOString(),
        dueDate: dueDate ? new Date(dueDate).toISOString() : new Date(issueDate).toISOString(),
        paymentTerms,
        supportingDocuments: supportingDocs.filter(d => d.trim()),
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const doc = <InvoiceDocument invoice={invoice} logoBase64={logoBase64} />;
      const asPdf = pdf(doc);
      const blob = await asPdf.toBlob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${invoice.invoiceNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      onClose();
    } catch (error) {
      console.error('Error generating invoice:', error);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{ sx: { height: '90vh' } }}
    >
      <DialogTitle>
        <Typography variant="h6">Generate Invoice</Typography>
        <Typography variant="body2" color="textSecondary">
          Create an invoice from PO {pr.prNumber}
        </Typography>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={3}>
          {/* Invoice Header */}
          <Box>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              Invoice Header
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Invoice Number"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Issue Date"
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Due Date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Milestone"
                  value={milestone}
                  onChange={(e) => setMilestone(e.target.value)}
                  placeholder="M1, M2, M3, etc."
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="PO Reference"
                  value={pr.prNumber}
                  disabled
                />
              </Grid>
            </Grid>
          </Box>

          <Divider />

          {/* Customer (Bill To) */}
          <Box>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              Bill To (Customer)
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Customer Name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Address"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  multiline
                  rows={2}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Contact Person"
                  value={customerContactPerson}
                  onChange={(e) => setCustomerContactPerson(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Contact Phone"
                  value={customerContactPhone}
                  onChange={(e) => setCustomerContactPhone(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Contact Email"
                  value={customerContactEmail}
                  onChange={(e) => setCustomerContactEmail(e.target.value)}
                />
              </Grid>
            </Grid>
          </Box>

          <Divider />

          {/* Line Items */}
          <Box>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              Invoice Line Items
            </Typography>
            {lineItems.map((item, idx) => (
              <Grid container spacing={1} key={idx} sx={{ mb: 1 }} alignItems="center">
                <Grid item xs={12} md={5}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Description"
                    value={item.description}
                    onChange={(e) => {
                      const updated = [...lineItems];
                      updated[idx] = { ...updated[idx], description: e.target.value };
                      setLineItems(updated);
                    }}
                  />
                </Grid>
                <Grid item xs={12} md={2}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Qty"
                    type="number"
                    value={item.quantity}
                    onChange={(e) => {
                      const updated = [...lineItems];
                      const qty = parseFloat(e.target.value) || 0;
                      updated[idx] = { ...updated[idx], quantity: qty, total: qty * updated[idx].unitPrice };
                      setLineItems(updated);
                    }}
                  />
                </Grid>
                <Grid item xs={12} md={2}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Unit Price"
                    type="number"
                    value={item.unitPrice}
                    onChange={(e) => {
                      const updated = [...lineItems];
                      const price = parseFloat(e.target.value) || 0;
                      updated[idx] = { ...updated[idx], unitPrice: price, total: updated[idx].quantity * price };
                      setLineItems(updated);
                    }}
                  />
                </Grid>
                <Grid item xs={12} md={2}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Total"
                    value={formatCurrency(item.total, pr.currency || 'USD', false)}
                    disabled
                  />
                </Grid>
                <Grid item xs={12} md={1}>
                  <IconButton
                    size="small"
                    onClick={() => {
                      const updated = lineItems.filter((_, i) => i !== idx);
                      setLineItems(updated.length ? updated : [{ description: '', quantity: 1, unitPrice: 0, total: 0 }]);
                    }}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Grid>
              </Grid>
            ))}
            <Button
              startIcon={<AddIcon />}
              size="small"
              onClick={() => setLineItems([...lineItems, { description: '', quantity: 1, unitPrice: 0, total: 0 }])}
            >
              Add Line Item
            </Button>
          </Box>

          <Divider />

          {/* Payment Terms */}
          <Box>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              Payment Terms
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={2}
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
            />
          </Box>

          <Divider />

          {/* Supporting Documents */}
          <Box>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              Supporting Documents
            </Typography>
            {supportingDocs.map((doc, idx) => (
              <Grid container spacing={1} key={idx} sx={{ mb: 1 }} alignItems="center">
                <Grid item xs={11}>
                  <TextField
                    fullWidth
                    size="small"
                    label={`Document ${idx + 1}`}
                    value={doc}
                    onChange={(e) => {
                      const updated = [...supportingDocs];
                      updated[idx] = e.target.value;
                      setSupportingDocs(updated);
                    }}
                    placeholder="e.g., Signed agreement, production completion certificate, packing list..."
                  />
                </Grid>
                <Grid item xs={1}>
                  <IconButton
                    size="small"
                    onClick={() => {
                      const updated = supportingDocs.filter((_, i) => i !== idx);
                      setSupportingDocs(updated.length ? updated : ['']);
                    }}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Grid>
              </Grid>
            ))}
            <Button
              startIcon={<AddIcon />}
              size="small"
              onClick={() => setSupportingDocs([...supportingDocs, ''])}
            >
              Add Document
            </Button>
          </Box>

          <Divider />

          {/* Summary */}
          <Box>
            <Alert severity="info">
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <Typography variant="body2" fontWeight="bold">Total Amount:</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" align="right" fontWeight="bold">
                    {formatCurrency(totalAmount, pr.currency || 'USD')}
                  </Typography>
                </Grid>
              </Grid>
            </Alert>
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={generating}>
          Cancel
        </Button>
        <Button
          onClick={handleGenerate}
          variant="contained"
          color="primary"
          startIcon={generating ? <CircularProgress size={20} /> : <DownloadIcon />}
          disabled={generating || !customerName.trim()}
        >
          {generating ? 'Generating Invoice...' : 'Generate & Download Invoice'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
