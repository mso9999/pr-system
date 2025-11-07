/**
 * @fileoverview PO Review & Edit Dialog
 * @description Allows users to review and edit PO details before final PDF generation
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
  FormControlLabel,
  Checkbox,
  CircularProgress,
  Stack,
} from '@mui/material';
import { PRRequest } from '@/types/pr';
import { formatCurrency } from '@/utils/formatters';
import {
  Download as DownloadIcon,
  Edit as EditIcon,
} from '@mui/icons-material';

interface POReviewDialogProps {
  open: boolean;
  pr: PRRequest;
  organizationDetails: {
    companyLegalName?: string;
    companyAddress?: {
      street?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
    };
    companyPhone?: string;
    companyWebsite?: string;
    companyRegistrationNumber?: string;
    companyTaxId?: string;
    logoUrl?: string;
    defaultDeliveryAddress?: {
      street?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
      recipientName?: string;
      contactPerson?: string;
      contactPhone?: string;
    };
    defaultBillingAddress?: {
      street?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
      recipientName?: string;
    };
  };
  vendorDetails?: {
    name?: string;
    contactName?: string;
    contactEmail?: string;
    contactPhone?: string;
    address?: string;
    city?: string;
    country?: string;
  } | null;
  onClose: () => void;
  onGenerate: (updatedPR: Partial<PRRequest>) => Promise<void>;
}

export const POReviewDialog: React.FC<POReviewDialogProps> = ({
  open,
  pr,
  organizationDetails,
  vendorDetails,
  onClose,
  onGenerate,
}) => {
  const [generating, setGenerating] = useState(false);
  
  // Price discrepancy state
  const [priceDiscrepancyJustification, setPriceDiscrepancyJustification] = useState(
    pr.poLineItemDiscrepancyJustification || ''
  );
  
  // Editable PO fields
  const [poNumber, setPoNumber] = useState(pr.prNumber);
  const [poIssueDate, setPoIssueDate] = useState(
    pr.poIssueDate ? new Date(pr.poIssueDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
  );
  const [supplierName, setSupplierName] = useState('');
  const [buyerRepName, setBuyerRepName] = useState(pr.buyerRepresentativeName || '');
  const [buyerRepTitle, setBuyerRepTitle] = useState(pr.buyerRepresentativeTitle || '');
  const [buyerRepEmail, setBuyerRepEmail] = useState(pr.buyerRepresentativeEmail || '');
  const [buyerRepPhone, setBuyerRepPhone] = useState(pr.buyerRepresentativePhone || '');
  
  const [supplierRepName, setSupplierRepName] = useState(pr.supplierRepresentativeName || '');
  const [supplierRepTitle, setSupplierRepTitle] = useState(pr.supplierRepresentativeTitle || '');
  const [supplierRepEmail, setSupplierRepEmail] = useState(pr.supplierRepresentativeEmail || '');
  const [supplierRepPhone, setSupplierRepPhone] = useState(pr.supplierRepresentativePhone || '');
  
  const [deliveryDate, setDeliveryDate] = useState(
    pr.estimatedDeliveryDate ? new Date(pr.estimatedDeliveryDate).toISOString().split('T')[0] : ''
  );
  const [modeOfDelivery, setModeOfDelivery] = useState(pr.modeOfDelivery || 'Courier');
  const [packingInstructions, setPackingInstructions] = useState(pr.packingInstructions || '');
  
  const [paymentMethod, setPaymentMethod] = useState(pr.paymentMethod || 'Bank Transfer');
  const [paymentTerms, setPaymentTerms] = useState(pr.paymentTerms || 'Net 30');
  const [poRemarks, setPoRemarks] = useState(pr.poRemarks || '');
  
  // Delivery and billing address toggles
  const [deliveryAddressDifferent, setDeliveryAddressDifferent] = useState(pr.deliveryAddressDifferent || false);
  const [billingAddressDifferent, setBillingAddressDifferent] = useState(pr.billingAddressDifferent || false);
  
  // Delivery address fields
  const [deliveryRecipientName, setDeliveryRecipientName] = useState(pr.deliveryAddress?.recipientName || '');
  const [deliveryStreet, setDeliveryStreet] = useState(pr.deliveryAddress?.street || '');
  const [deliveryCity, setDeliveryCity] = useState(pr.deliveryAddress?.city || '');
  const [deliveryState, setDeliveryState] = useState(pr.deliveryAddress?.state || '');
  const [deliveryPostalCode, setDeliveryPostalCode] = useState(pr.deliveryAddress?.postalCode || '');
  const [deliveryCountry, setDeliveryCountry] = useState(pr.deliveryAddress?.country || '');
  const [deliveryContactPerson, setDeliveryContactPerson] = useState(pr.deliveryAddress?.contactPerson || '');
  const [deliveryContactPhone, setDeliveryContactPhone] = useState(pr.deliveryAddress?.contactPhone || '');
  
  // Billing address fields
  const [billingRecipientName, setBillingRecipientName] = useState(pr.billingAddress?.recipientName || '');
  const [billingStreet, setBillingStreet] = useState(pr.billingAddress?.street || '');
  const [billingCity, setBillingCity] = useState(pr.billingAddress?.city || '');
  const [billingState, setBillingState] = useState(pr.billingAddress?.state || '');
  const [billingPostalCode, setBillingPostalCode] = useState(pr.billingAddress?.postalCode || '');
  const [billingCountry, setBillingCountry] = useState(pr.billingAddress?.country || '');

  // Initialize supplier name from vendor details or PR
  useEffect(() => {
    if (vendorDetails?.name) {
      setSupplierName(vendorDetails.name);
    } else {
      const name = pr.selectedVendor || pr.preferredVendor || pr.supplierName || 'Vendor Name';
      setSupplierName(name);
    }
  }, [pr, vendorDetails]);

  // Prepopulate supplier contact details from vendor data
  useEffect(() => {
    if (vendorDetails) {
      if (vendorDetails.contactName) setSupplierRepName(vendorDetails.contactName);
      if (vendorDetails.contactEmail) setSupplierRepEmail(vendorDetails.contactEmail);
      if (vendorDetails.contactPhone) setSupplierRepPhone(vendorDetails.contactPhone);
    }
  }, [vendorDetails]);

  // Prepopulate buyer details from organization data
  useEffect(() => {
    if (organizationDetails) {
      if (!buyerRepName && organizationDetails.companyLegalName) {
        setBuyerRepName(organizationDetails.companyLegalName);
      }
      if (!buyerRepPhone && organizationDetails.companyPhone) {
        setBuyerRepPhone(organizationDetails.companyPhone);
      }
    }
  }, [organizationDetails]);

  // Initialize delivery address from org defaults if not set
  useEffect(() => {
    if (!pr.deliveryAddress && organizationDetails.defaultDeliveryAddress) {
      setDeliveryStreet(organizationDetails.defaultDeliveryAddress.street || '');
      setDeliveryCity(organizationDetails.defaultDeliveryAddress.city || '');
      setDeliveryState(organizationDetails.defaultDeliveryAddress.state || '');
      setDeliveryPostalCode(organizationDetails.defaultDeliveryAddress.postalCode || '');
      setDeliveryCountry(organizationDetails.defaultDeliveryAddress.country || '');
      setDeliveryRecipientName(organizationDetails.defaultDeliveryAddress.recipientName || '');
      setDeliveryContactPerson(organizationDetails.defaultDeliveryAddress.contactPerson || '');
      setDeliveryContactPhone(organizationDetails.defaultDeliveryAddress.contactPhone || '');
    }
  }, [pr, organizationDetails]);

  // Initialize billing address from org defaults if not set
  useEffect(() => {
    if (!pr.billingAddress && organizationDetails.defaultBillingAddress) {
      setBillingStreet(organizationDetails.defaultBillingAddress.street || '');
      setBillingCity(organizationDetails.defaultBillingAddress.city || '');
      setBillingState(organizationDetails.defaultBillingAddress.state || '');
      setBillingPostalCode(organizationDetails.defaultBillingAddress.postalCode || '');
      setBillingCountry(organizationDetails.defaultBillingAddress.country || '');
      setBillingRecipientName(organizationDetails.defaultBillingAddress.recipientName || '');
    }
  }, [pr, organizationDetails]);

  const handleGenerate = async () => {
    // Validate price discrepancy justification if needed
    if (hasDiscrepancy && !priceDiscrepancyJustification.trim()) {
      alert('Please provide a justification for the price discrepancy between line items and final price before generating the PO.');
      return;
    }

    try {
      setGenerating(true);
      
      const updatedPR: Partial<PRRequest> = {
        prNumber: poNumber,
        poIssueDate: new Date(poIssueDate).toISOString(),
        selectedVendor: supplierName,
        supplierName: supplierName,
        
        buyerRepresentativeName: buyerRepName,
        buyerRepresentativeTitle: buyerRepTitle,
        buyerRepresentativeEmail: buyerRepEmail,
        buyerRepresentativePhone: buyerRepPhone,
        
        supplierRepresentativeName: supplierRepName,
        supplierRepresentativeTitle: supplierRepTitle,
        supplierRepresentativeEmail: supplierRepEmail,
        supplierRepresentativePhone: supplierRepPhone,
        
        estimatedDeliveryDate: deliveryDate ? new Date(deliveryDate).toISOString() : undefined,
        modeOfDelivery,
        packingInstructions,
        
        paymentMethod,
        paymentTerms,
        poRemarks,
        
        deliveryAddressDifferent,
        deliveryAddress: deliveryAddressDifferent ? {
          recipientName: deliveryRecipientName,
          street: deliveryStreet,
          city: deliveryCity,
          state: deliveryState,
          postalCode: deliveryPostalCode,
          country: deliveryCountry,
          contactPerson: deliveryContactPerson,
          contactPhone: deliveryContactPhone,
        } : undefined,
        
        billingAddressDifferent,
        billingAddress: billingAddressDifferent ? {
          recipientName: billingRecipientName,
          street: billingStreet,
          city: billingCity,
          state: billingState,
          postalCode: billingPostalCode,
          country: billingCountry,
        } : undefined,

        // Store price discrepancy justification if provided
        poLineItemDiscrepancyJustification: hasDiscrepancy ? priceDiscrepancyJustification : undefined,
      };
      
      await onGenerate(updatedPR);
    } finally {
      setGenerating(false);
    }
  };

  // Calculate totals for display (for lineItemsWithSKU if available)
  const lineItems = pr.lineItemsWithSKU && pr.lineItemsWithSKU.length > 0 
    ? pr.lineItemsWithSKU 
    : pr.lineItems || [];
  const subtotal = lineItems.reduce((sum: number, item: any) => sum + (item.totalAmount || 0), 0);
  const taxAmount = pr.taxPercentage ? (subtotal * pr.taxPercentage / 100) : 0;
  const dutyAmount = pr.dutyPercentage ? (subtotal * pr.dutyPercentage / 100) : 0;
  const lineItemGrandTotal = subtotal + taxAmount + dutyAmount;

  // Check for price discrepancy between approved amount and final price
  // Use lastApprovedAmount (the amount actually approved) as the baseline for comparison
  // If lineItemsWithSKU exists and has totals, use that instead
  const approvedAmount = lineItemGrandTotal > 0 ? lineItemGrandTotal : (pr.lastApprovedAmount || pr.estimatedAmount || 0);
  const finalPrice = pr.finalPrice || 0;
  const discrepancyAmount = finalPrice - approvedAmount;
  const discrepancyPercentage = approvedAmount > 0 ? (discrepancyAmount / approvedAmount) * 100 : 0;
  const DISCREPANCY_THRESHOLD = 0.01; // 0.01% threshold to account for rounding
  const hasDiscrepancy = finalPrice > 0 && approvedAmount > 0 && Math.abs(discrepancyPercentage) > DISCREPANCY_THRESHOLD;

  // Debug logging
  console.log('[PO Price Validation] Price Discrepancy Check:', {
    lineItemsWithSKU: pr.lineItemsWithSKU?.length || 0,
    lineItems: pr.lineItems?.length || 0,
    lineItemGrandTotal,
    lastApprovedAmount: pr.lastApprovedAmount,
    estimatedAmount: pr.estimatedAmount,
    approvedAmountUsed: approvedAmount,
    finalPrice,
    discrepancyAmount,
    discrepancyPercentage: discrepancyPercentage.toFixed(4) + '%',
    hasDiscrepancy,
    validationTrigger: finalPrice > 0 && approvedAmount > 0 ? 'yes' : 'no - missing prices'
  });

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="lg" 
      fullWidth
      PaperProps={{
        sx: { height: '90vh' }
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <EditIcon />
          <Typography variant="h6">Review & Edit Purchase Order</Typography>
        </Box>
        <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
          Review and edit PO details before generating the PDF document
        </Typography>
      </DialogTitle>
      
      <DialogContent dividers>
        <Stack spacing={3}>
          {/* PO Header Info */}
          <Box>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              PO Header Information
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="PO Number"
                  value={poNumber}
                  onChange={(e) => setPoNumber(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="PO Issue Date"
                  type="date"
                  value={poIssueDate}
                  onChange={(e) => setPoIssueDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
            </Grid>
          </Box>

          <Divider />

          {/* Supplier Information */}
          <Box>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              Supplier Information
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Supplier Name"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Contact Person Name"
                  value={supplierRepName}
                  onChange={(e) => setSupplierRepName(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Contact Person Title"
                  value={supplierRepTitle}
                  onChange={(e) => setSupplierRepTitle(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Contact Email"
                  type="email"
                  value={supplierRepEmail}
                  onChange={(e) => setSupplierRepEmail(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Contact Phone"
                  value={supplierRepPhone}
                  onChange={(e) => setSupplierRepPhone(e.target.value)}
                />
              </Grid>
            </Grid>
          </Box>

          <Divider />

          {/* Buyer Representative */}
          <Box>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              Buyer Representative
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Representative Name"
                  value={buyerRepName}
                  onChange={(e) => setBuyerRepName(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Representative Title"
                  value={buyerRepTitle}
                  onChange={(e) => setBuyerRepTitle(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Representative Email"
                  type="email"
                  value={buyerRepEmail}
                  onChange={(e) => setBuyerRepEmail(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Representative Phone"
                  value={buyerRepPhone}
                  onChange={(e) => setBuyerRepPhone(e.target.value)}
                />
              </Grid>
            </Grid>
          </Box>

          <Divider />

          {/* Delivery Address */}
          <Box>
            <FormControlLabel
              control={
                <Checkbox
                  checked={deliveryAddressDifferent}
                  onChange={(e) => setDeliveryAddressDifferent(e.target.checked)}
                />
              }
              label={<Typography variant="subtitle1" fontWeight="bold">Delivery Address Different from Company Address</Typography>}
            />
            
            {deliveryAddressDifferent && (
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Recipient Name"
                    value={deliveryRecipientName}
                    onChange={(e) => setDeliveryRecipientName(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Street Address"
                    value={deliveryStreet}
                    onChange={(e) => setDeliveryStreet(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="City"
                    value={deliveryCity}
                    onChange={(e) => setDeliveryCity(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="State/Province"
                    value={deliveryState}
                    onChange={(e) => setDeliveryState(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Postal Code"
                    value={deliveryPostalCode}
                    onChange={(e) => setDeliveryPostalCode(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Country"
                    value={deliveryCountry}
                    onChange={(e) => setDeliveryCountry(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Contact Person"
                    value={deliveryContactPerson}
                    onChange={(e) => setDeliveryContactPerson(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Contact Phone"
                    value={deliveryContactPhone}
                    onChange={(e) => setDeliveryContactPhone(e.target.value)}
                  />
                </Grid>
              </Grid>
            )}
          </Box>

          <Divider />

          {/* Billing Address */}
          <Box>
            <FormControlLabel
              control={
                <Checkbox
                  checked={billingAddressDifferent}
                  onChange={(e) => setBillingAddressDifferent(e.target.checked)}
                />
              }
              label={<Typography variant="subtitle1" fontWeight="bold">Billing Address Different from Company Address</Typography>}
            />
            
            {billingAddressDifferent && (
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Recipient Name"
                    value={billingRecipientName}
                    onChange={(e) => setBillingRecipientName(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Street Address"
                    value={billingStreet}
                    onChange={(e) => setBillingStreet(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="City"
                    value={billingCity}
                    onChange={(e) => setBillingCity(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="State/Province"
                    value={billingState}
                    onChange={(e) => setBillingState(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Postal Code"
                    value={billingPostalCode}
                    onChange={(e) => setBillingPostalCode(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Country"
                    value={billingCountry}
                    onChange={(e) => setBillingCountry(e.target.value)}
                  />
                </Grid>
              </Grid>
            )}
          </Box>

          <Divider />

          {/* Delivery Information */}
          <Box>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              Delivery Information
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Expected Delivery Date"
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Mode of Delivery"
                  value={modeOfDelivery}
                  onChange={(e) => setModeOfDelivery(e.target.value)}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Packing/Labeling Instructions"
                  multiline
                  rows={2}
                  value={packingInstructions}
                  onChange={(e) => setPackingInstructions(e.target.value)}
                />
              </Grid>
            </Grid>
          </Box>

          <Divider />

          {/* Payment Information */}
          <Box>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              Payment Information
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Payment Method"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Payment Terms"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                />
              </Grid>
            </Grid>
          </Box>

          <Divider />

          {/* PO Remarks */}
          <Box>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              Remarks
            </Typography>
            <TextField
              fullWidth
              label="PO Remarks/Special Instructions"
              multiline
              rows={3}
              value={poRemarks}
              onChange={(e) => setPoRemarks(e.target.value)}
              placeholder="Any additional instructions or remarks for the supplier"
            />
          </Box>

          <Divider />

          {/* Order Summary */}
          <Box>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              Order Summary
            </Typography>
            <Alert severity="info">
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <Typography variant="body2">Line Items:</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" align="right">{lineItems.length}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2">Subtotal:</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" align="right">
                    {formatCurrency(subtotal, pr.currency || 'LSL')}
                  </Typography>
                </Grid>
                {taxAmount > 0 && (
                  <>
                    <Grid item xs={6}>
                      <Typography variant="body2">Tax ({pr.taxPercentage}%):</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" align="right">
                        {formatCurrency(taxAmount, pr.currency || 'LSL')}
                      </Typography>
                    </Grid>
                  </>
                )}
                {dutyAmount > 0 && (
                  <>
                    <Grid item xs={6}>
                      <Typography variant="body2">Duty ({pr.dutyPercentage}%):</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" align="right">
                        {formatCurrency(dutyAmount, pr.currency || 'LSL')}
                      </Typography>
                    </Grid>
                  </>
                )}
                <Grid item xs={6}>
                  <Typography variant="body2" fontWeight="bold">Grand Total:</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" align="right" fontWeight="bold">
                    {formatCurrency(grandTotal, pr.currency || 'LSL')}
                  </Typography>
                </Grid>
              </Grid>
            </Alert>
          </Box>

          {/* Price Discrepancy Warning and Justification */}
          {hasDiscrepancy && (
            <Box>
              <Alert severity="warning" sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom fontWeight="bold">
                  ⚠️ Price Discrepancy Detected
                </Typography>
                <Typography variant="body2" paragraph>
                  There is a difference between the approved amount and the final price from proforma:
                </Typography>
                <Grid container spacing={1} sx={{ pl: 2 }}>
                  <Grid item xs={6}>
                    <Typography variant="body2">Approved Amount:</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" align="right" fontWeight="bold">
                      {formatCurrency(approvedAmount, pr.currency || 'LSL')}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2">Final Price (from proforma):</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" align="right" fontWeight="bold">
                      {formatCurrency(finalPrice, pr.currency || 'LSL')}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="error">Discrepancy:</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" align="right" color="error" fontWeight="bold">
                      {formatCurrency(Math.abs(discrepancyAmount), pr.currency || 'LSL')} 
                      ({discrepancyAmount > 0 ? '+' : '-'}{Math.abs(discrepancyPercentage).toFixed(2)}%)
                    </Typography>
                  </Grid>
                </Grid>
                <Typography variant="body2" sx={{ mt: 2 }} fontWeight="bold">
                  Please provide a justification for this discrepancy before generating the PO:
                </Typography>
              </Alert>
              
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Price Discrepancy Justification (Required)"
                value={priceDiscrepancyJustification}
                onChange={(e) => setPriceDiscrepancyJustification(e.target.value)}
                placeholder="Explain why the final price differs from the approved amount (e.g., shipping costs, handling fees, additional services, taxes, discounts applied, exchange rate differences, etc.)"
                required
                error={!priceDiscrepancyJustification.trim()}
                helperText={!priceDiscrepancyJustification.trim() ? "Justification is required to proceed" : ""}
              />
            </Box>
          )}
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
          disabled={generating || !supplierName.trim()}
        >
          {generating ? 'Generating PO...' : 'Generate & Download PO'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};


