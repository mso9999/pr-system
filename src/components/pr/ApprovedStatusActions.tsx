import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Alert,
  Stack,
  Grid,
  Paper,
  Checkbox,
  FormControlLabel,
  Divider,
  Chip,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { PRRequest, PRStatus, Attachment } from '@/types/pr';
import { prService } from '@/services/pr';
import { notificationService } from '@/services/notification';
import { StorageService } from '@/services/storage';
import { User } from '@/types/user';
import { formatCurrency } from '@/utils/formatters';
import {
  CloudUpload as UploadIcon,
  Download as DownloadIcon,
  Send as SendIcon,
  CheckCircle as CheckIcon,
  Description as DocumentIcon,
} from '@mui/icons-material';
import { pdf } from '@react-pdf/renderer';
import { PODocument } from './PODocument';
import { POReviewDialog } from './POReviewDialog';
import { organizationService } from '@/services/organizationService';
import { referenceDataService } from '@/services/referenceData';
import { imageUrlToBase64, imageUrlToBase64ViaImage } from '@/utils/imageUtils';
import { FileUploadManager } from '@/components/common/FileUploadManager';

interface ApprovedStatusActionsProps {
  pr: PRRequest;
  currentUser: User;
  onStatusChange: () => void;
}

export const ApprovedStatusActions: React.FC<ApprovedStatusActionsProps> = ({
  pr,
  currentUser,
  onStatusChange,
}) => {
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();
  const { t } = useTranslation();
  
  // State for document uploads
  const [uploadingProforma, setUploadingProforma] = useState(false);
  const [uploadingPoP, setUploadingPoP] = useState(false);
  const [proformaOverride, setProformaOverride] = useState(pr.proformaOverride || false);
  const [proformaJustification, setProformaJustification] = useState(pr.proformaOverrideJustification || '');
  const [popOverride, setPopOverride] = useState(pr.popOverride || false);
  const [popJustification, setPopJustification] = useState(pr.popOverrideJustification || '');
  const [etd, setEtd] = useState(pr.estimatedDeliveryDate || '');
  
  // State for final price entry
  const [finalPrice, setFinalPrice] = useState(pr.finalPrice?.toString() || '');
  const [finalPriceNotes, setFinalPriceNotes] = useState(pr.finalPriceVarianceNotes || '');
  const [showFinalPriceDialog, setShowFinalPriceDialog] = useState(false);
  
  // Dialog state
  const [notifyDialog, setNotifyDialog] = useState<'finance' | 'procurement' | null>(null);
  const [notifyMessage, setNotifyMessage] = useState('');
  const [moveToOrderedDialog, setMoveToOrderedDialog] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelJustification, setCancelJustification] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);
  
  // Final price variance override dialog
  const [finalPriceVarianceDialog, setFinalPriceVarianceDialog] = useState(false);
  const [finalPriceVarianceJustification, setFinalPriceVarianceJustification] = useState('');
  const [finalPriceVarianceData, setFinalPriceVarianceData] = useState<{
    approvedAmount: number;
    finalPrice: number;
    variancePercentage: number;
    exceedsUpward: boolean;
    exceedsDownward: boolean;
  } | null>(null);
  
  // PO Document generation state
  const [generatingPO, setGeneratingPO] = useState(false);
  const [poDocOverride, setPoDocOverride] = useState(pr.poDocumentOverride || false);
  const [poDocJustification, setPoDocJustification] = useState(pr.poDocumentOverrideJustification || '');
  const [poReviewDialogOpen, setPoReviewDialogOpen] = useState(false);
  const [organizationDetails, setOrganizationDetails] = useState<any>(null);
  const [vendorDetails, setVendorDetails] = useState<any>(null);
  const [logoBase64, setLogoBase64] = useState<string>('');
  const [loadingOrgDetails, setLoadingOrgDetails] = useState(false);

  // Sync local state with PR prop changes (when data refreshes)
  useEffect(() => {
    console.log('ApprovedStatusActions: Syncing state with PR prop', {
      prId: pr.id,
      estimatedDeliveryDate: pr.estimatedDeliveryDate,
      proformaOverride: pr.proformaOverride,
      proformaOverrideJustification: pr.proformaOverrideJustification,
      popOverride: pr.popOverride,
      popOverrideJustification: pr.popOverrideJustification,
      finalPrice: pr.finalPrice
    });
    
    setProformaOverride(pr.proformaOverride || false);
    setProformaJustification(pr.proformaOverrideJustification || '');
    setPopOverride(pr.popOverride || false);
    setPopJustification(pr.popOverrideJustification || '');
    setPoDocOverride(pr.poDocumentOverride || false);
    setPoDocJustification(pr.poDocumentOverrideJustification || '');
    
    // Format date to YYYY-MM-DD for date input
    if (pr.estimatedDeliveryDate) {
      const date = new Date(pr.estimatedDeliveryDate);
      const formatted = date.toISOString().split('T')[0];
      console.log('ApprovedStatusActions: Setting ETD', { original: pr.estimatedDeliveryDate, formatted });
      setEtd(formatted);
    } else {
      setEtd('');
    }
    
    setFinalPrice(pr.finalPrice?.toString() || '');
    setFinalPriceNotes(pr.finalPriceVarianceNotes || '');
  }, [pr]);

  // Permission checks
  const isProcurement = currentUser.permissionLevel === 3;
  const isFinanceAdmin = currentUser.permissionLevel === 4;
  const isFinanceApprover = currentUser.permissionLevel === 6;
  const isAdmin = currentUser.permissionLevel === 1;
  const canCancelPO = isAdmin || isFinanceAdmin || isFinanceApprover;
  const canTakeAction = isProcurement || isFinanceAdmin || isFinanceApprover || isAdmin;

  // Get rule thresholds from organization (will need to fetch from org config)
  // For now, using a placeholder - should fetch from organization settings
  const rule1Threshold = pr.organization ? 5000 : 5000; // TODO: Fetch from org config
  const rule3Threshold = pr.organization ? 50000 : 50000; // TODO: Fetch from org config (high-value threshold for PO doc requirement)

  // Check if proforma and PoP are required
  const proformaRequired = (pr.estimatedAmount || 0) > rule1Threshold;
  const popRequired = (pr.estimatedAmount || 0) > rule1Threshold;
  
  // Check if PO document is required (high-value PRs above Rule 3)
  const poDocRequired = (pr.estimatedAmount || 0) > rule3Threshold;

  if (!canTakeAction) {
    return null;
  }

  // Helper: Normalize attachments to array (for backward compatibility)
  const normalizeAttachments = (attachments?: Attachment | Attachment[]): Attachment[] => {
    if (!attachments) return [];
    return Array.isArray(attachments) ? attachments : [attachments];
  };

  // Handle Proforma Invoice Upload (multiple files)
  const handleProformaUpload = async (files: File[]) => {
    if (files.length === 0) return;

    try {
      setUploadingProforma(true);
      
      // Upload all files
      const uploadPromises = files.map(async (file) => {
        const result = await StorageService.uploadToTempStorage(file);
        return {
          id: crypto.randomUUID(),
          name: file.name,
          url: result.url,
          path: result.path,
          type: file.type,
          size: file.size,
          uploadedAt: new Date().toISOString(),
          uploadedBy: {
            id: currentUser.id,
            email: currentUser.email,
            name: currentUser.name || currentUser.email
          }
        } as Attachment;
      });

      const newAttachments = await Promise.all(uploadPromises);
      
      // Get existing attachments and merge
      const existingAttachments = normalizeAttachments(pr.proformaInvoice);
      const allAttachments = [...existingAttachments, ...newAttachments];

      await prService.updatePR(pr.id, {
        proformaInvoice: allAttachments,
        proformaOverride: false, // Clear override if uploading actual document
        proformaOverrideJustification: undefined,
        updatedAt: new Date().toISOString()
      });

      enqueueSnackbar(`${files.length} proforma invoice(s) uploaded successfully`, { variant: 'success' });
      onStatusChange();
    } catch (error) {
      console.error('Error uploading proforma:', error);
      enqueueSnackbar('Failed to upload proforma invoice(s)', { variant: 'error' });
    } finally {
      setUploadingProforma(false);
    }
  };

  // Handle Proforma Invoice Delete
  const handleProformaDelete = async (attachmentId: string) => {
    try {
      const existingAttachments = normalizeAttachments(pr.proformaInvoice);
      const updatedAttachments = existingAttachments.filter(att => att.id !== attachmentId);

      await prService.updatePR(pr.id, {
        proformaInvoice: updatedAttachments.length > 0 ? updatedAttachments : [],
        updatedAt: new Date().toISOString()
      });

      enqueueSnackbar('Proforma invoice deleted successfully', { variant: 'success' });
      onStatusChange();
    } catch (error) {
      console.error('Error deleting proforma:', error);
      enqueueSnackbar('Failed to delete proforma invoice', { variant: 'error' });
      throw error; // Re-throw for FileUploadManager to handle
    }
  };

  // Handle Proof of Payment Upload (multiple files)
  const handlePoPUpload = async (files: File[]) => {
    if (files.length === 0) return;

    try {
      setUploadingPoP(true);
      
      // Upload all files
      const uploadPromises = files.map(async (file) => {
        const result = await StorageService.uploadToTempStorage(file);
        return {
          id: crypto.randomUUID(),
          name: file.name,
          url: result.url,
          path: result.path,
          type: file.type,
          size: file.size,
          uploadedAt: new Date().toISOString(),
          uploadedBy: {
            id: currentUser.id,
            email: currentUser.email,
            name: currentUser.name || currentUser.email
          }
        } as Attachment;
      });

      const newAttachments = await Promise.all(uploadPromises);
      
      // Get existing attachments and merge
      const existingAttachments = normalizeAttachments(pr.proofOfPayment);
      const allAttachments = [...existingAttachments, ...newAttachments];

      await prService.updatePR(pr.id, {
        proofOfPayment: allAttachments,
        popOverride: false, // Clear override if uploading actual document
        popOverrideJustification: undefined,
        updatedAt: new Date().toISOString()
      });

      enqueueSnackbar(`${files.length} proof of payment(s) uploaded successfully`, { variant: 'success' });
      onStatusChange();
    } catch (error) {
      console.error('Error uploading PoP:', error);
      enqueueSnackbar('Failed to upload proof of payment(s)', { variant: 'error' });
    } finally {
      setUploadingPoP(false);
    }
  };

  // Handle Proof of Payment Delete
  const handlePoPDelete = async (attachmentId: string) => {
    try {
      const existingAttachments = normalizeAttachments(pr.proofOfPayment);
      const updatedAttachments = existingAttachments.filter(att => att.id !== attachmentId);

      await prService.updatePR(pr.id, {
        proofOfPayment: updatedAttachments.length > 0 ? updatedAttachments : [],
        updatedAt: new Date().toISOString()
      });

      enqueueSnackbar('Proof of payment deleted successfully', { variant: 'success' });
      onStatusChange();
    } catch (error) {
      console.error('Error deleting PoP:', error);
      enqueueSnackbar('Failed to delete proof of payment', { variant: 'error' });
      throw error; // Re-throw for FileUploadManager to handle
    }
  };

  // Handle Proforma Override
  const handleProformaOverride = async () => {
    if (!proformaJustification.trim()) {
      enqueueSnackbar('Justification required for override', { variant: 'error' });
      return;
    }

    try {
      await prService.updatePR(pr.id, {
        proformaOverride: true,
        proformaOverrideJustification: proformaJustification,
        updatedAt: new Date().toISOString()
      });

      enqueueSnackbar('Proforma override set successfully', { variant: 'success' });
      setProformaOverride(true);
      onStatusChange();
    } catch (error) {
      console.error('Error setting proforma override:', error);
      enqueueSnackbar('Failed to set proforma override', { variant: 'error' });
    }
  };

  // Handle PoP Override
  const handlePoPOverride = async () => {
    if (!popJustification.trim()) {
      enqueueSnackbar('Justification required for override', { variant: 'error' });
      return;
    }

    try {
      await prService.updatePR(pr.id, {
        popOverride: true,
        popOverrideJustification: popJustification,
        updatedAt: new Date().toISOString()
      });

      enqueueSnackbar('PoP override set successfully', { variant: 'success' });
      setPopOverride(true);
      onStatusChange();
    } catch (error) {
      console.error('Error setting PoP override:', error);
      enqueueSnackbar('Failed to set PoP override', { variant: 'error' });
    }
  };

  // Handle ETD Update
  const handleEtdUpdate = async () => {
    if (!etd) {
      enqueueSnackbar('Please select an estimated delivery date', { variant: 'error' });
      return;
    }

    console.log('ApprovedStatusActions: Saving ETD', { etd, prId: pr.id });

    try {
      await prService.updatePR(pr.id, {
        estimatedDeliveryDate: etd,
        updatedAt: new Date().toISOString()
      });

      console.log('ApprovedStatusActions: ETD saved, calling onStatusChange to refresh');
      enqueueSnackbar('Estimated delivery date saved successfully', { variant: 'success' });
      
      // Refresh the PR data to show updated ETD
      await onStatusChange();
      
      console.log('ApprovedStatusActions: onStatusChange completed');
    } catch (error) {
      console.error('Error updating ETD:', error);
      enqueueSnackbar('Failed to update ETD', { variant: 'error' });
    }
  };

  // Handle Final Price Update
  const handleFinalPriceUpdate = async () => {
    if (!finalPrice || parseFloat(finalPrice) <= 0) {
      enqueueSnackbar('Please enter a valid final price', { variant: 'error' });
      return;
    }

    try {
      const finalPriceAmount = parseFloat(finalPrice);
      
      await prService.updatePR(pr.id, {
        finalPrice: finalPriceAmount,
        finalPriceCurrency: pr.currency || 'LSL',
        finalPriceVarianceNotes: finalPriceNotes || undefined,
        finalPriceEnteredBy: {
          id: currentUser.id,
          email: currentUser.email,
          name: currentUser.name || currentUser.email
        },
        finalPriceEnteredAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      enqueueSnackbar('Final price saved successfully', { variant: 'success' });
      // Refresh the PR data to show updated final price
      await onStatusChange();
    } catch (error) {
      console.error('Error updating final price:', error);
      enqueueSnackbar('Failed to save final price', { variant: 'error' });
    }
  };

  // Open PO Review Dialog (fetch org and vendor details first)
  const handleGeneratePO = async () => {
    try {
      setLoadingOrgDetails(true);
      
      // Fetch organization details
      let orgId = pr.organization;
      if (!orgId) {
        enqueueSnackbar('Organization not found', { variant: 'error' });
        return;
      }
      
      // Normalize organization ID (convert to lowercase with underscores)
      // e.g., "1PWR LESOTHO" -> "1pwr_lesotho"
      const normalizedOrgId = orgId.toLowerCase().replace(/[^a-z0-9]/g, '_');
      console.log('Fetching organization details for:', { original: orgId, normalized: normalizedOrgId });
      
      const orgDetails = await organizationService.getOrganizationById(normalizedOrgId);
      console.log('Organization details fetched:', orgDetails);
      
      if (!orgDetails) {
        enqueueSnackbar('Failed to load organization details. Please check organization configuration.', { variant: 'error' });
        return;
      }
      
      // Fetch vendor details
      let vendorData = null;
      const vendorId = pr.selectedVendor || pr.preferredVendor;
      if (vendorId) {
        console.log('Fetching vendor details for:', vendorId);
        vendorData = await referenceDataService.getVendorById(vendorId);
        console.log('Vendor details fetched:', vendorData);
      }
      
      // Fetch and convert logo to base64 for PDF embedding
      try {
        console.log('[PO Generation] Starting logo fetch process...');
        // Use local logo file from public folder (no CORS issues)
        const logoUrl = window.location.origin + '/logo.png';
        
        let base64Logo = '';
        
        // Try fetch method first
        try {
          console.log('[PO Generation] Trying fetch method for local logo...');
          base64Logo = await imageUrlToBase64(logoUrl);
          console.log('[PO Generation] Fetch method succeeded! Base64 length:', base64Logo?.length);
        } catch (fetchError) {
          console.warn('[PO Generation] Fetch method failed, trying Image element method...', fetchError);
          
          // Try Image element method as fallback
          try {
            base64Logo = await imageUrlToBase64ViaImage(logoUrl);
            console.log('[PO Generation] Image element method succeeded! Base64 length:', base64Logo?.length);
          } catch (imageError) {
            console.error('[PO Generation] Image element method also failed:', imageError);
            throw imageError;
          }
        }
        
        if (base64Logo && base64Logo.length > 100) {
          console.log('[PO Generation] Logo successfully converted to base64');
          setLogoBase64(base64Logo);
        } else {
          console.error('[PO Generation] Logo conversion resulted in invalid data');
        }
      } catch (logoError) {
        console.error('[PO Generation] All logo fetch methods failed, will proceed without it:', logoError);
        enqueueSnackbar('Could not load logo for PO, continuing without it', { variant: 'warning' });
        // Don't block PO generation if logo fails
      }
      
      setOrganizationDetails(orgDetails);
      setVendorDetails(vendorData);
      setPoReviewDialogOpen(true);
    } catch (error) {
      console.error('Error loading details:', error);
      enqueueSnackbar('Failed to load organization/vendor details', { variant: 'error' });
    } finally {
      setLoadingOrgDetails(false);
    }
  };

  // Handle actual PO generation after review
  const handlePOGeneration = async (updatedPR: Partial<PRRequest>) => {
    try {
      setGeneratingPO(true);
      enqueueSnackbar('Generating PO document...', { variant: 'info' });

      // Update PR with edited data
      await prService.updatePR(pr.id, {
        ...updatedPR,
        poIssueDate: updatedPR.poIssueDate || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // Merge updated data with existing PR for PDF generation
      const mergedPR = { ...pr, ...updatedPR };

      // Log logo status before PDF generation
      console.log('[PO Generation] Creating PDF with logo:', {
        hasLogo: !!logoBase64,
        logoLength: logoBase64?.length,
        logoPreview: logoBase64?.substring(0, 50)
      });

      // Create the PDF document with organization and vendor details
      const doc = <PODocument pr={mergedPR} organizationDetails={organizationDetails} vendorDetails={vendorDetails} logoBase64={logoBase64} />;
      const asPdf = pdf(doc);
      const blob = await asPdf.toBlob();

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `PO-${mergedPR.prNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      enqueueSnackbar('PO document downloaded successfully', { variant: 'success' });
      setPoReviewDialogOpen(false);
      await onStatusChange();
    } catch (error) {
      console.error('Error generating PO:', error);
      enqueueSnackbar('Failed to generate PO document', { variant: 'error' });
    } finally {
      setGeneratingPO(false);
    }
  };

  // Handle PO Document Override
  const handlePoDocOverride = async () => {
    if (!poDocJustification.trim()) {
      enqueueSnackbar('Justification required for PO document override', { variant: 'error' });
      return;
    }

    try {
      await prService.updatePR(pr.id, {
        poDocumentOverride: true,
        poDocumentOverrideJustification: poDocJustification,
        updatedAt: new Date().toISOString()
      });

      enqueueSnackbar('PO document override set successfully', { variant: 'success' });
      setPoDocOverride(true);
      onStatusChange();
    } catch (error) {
      console.error('Error setting PO document override:', error);
      enqueueSnackbar('Failed to set PO document override', { variant: 'error' });
    }
  };

  // Notify Finance Team
  const handleNotifyFinance = async () => {
    // Validate proforma is uploaded or override is set
    const hasProforma = normalizeAttachments(pr.proformaInvoice).length > 0;
    if (proformaRequired && !hasProforma && !pr.proformaOverride) {
      enqueueSnackbar('Cannot notify Finance: Proforma invoice required (upload or set override)', { variant: 'error' });
      return;
    }

    try {
      // Send notification to finance team
      await notificationService.handleStatusChange(
        pr.id,
        pr.status,
        pr.status, // Status doesn't change
        currentUser,
        `Procurement requesting payment execution: ${notifyMessage || 'Please process payment for this PO'}`
      );

      enqueueSnackbar('Finance team notified successfully', { variant: 'success' });
      setNotifyDialog(null);
      setNotifyMessage('');
    } catch (error) {
      console.error('Error notifying finance:', error);
      enqueueSnackbar('Failed to notify finance team', { variant: 'error' });
    }
  };

  // Notify Procurement Team
  const handleNotifyProcurement = async () => {
    try {
      // Send notification to procurement team
      await notificationService.handleStatusChange(
        pr.id,
        pr.status,
        pr.status, // Status doesn't change
        currentUser,
        `Finance requesting file uploads: ${notifyMessage || 'Please upload required documents for this PO'}`
      );

      enqueueSnackbar('Procurement team notified successfully', { variant: 'success' });
      setNotifyDialog(null);
      setNotifyMessage('');
    } catch (error) {
      console.error('Error notifying procurement:', error);
      enqueueSnackbar('Failed to notify procurement team', { variant: 'error' });
    }
  };

  // Move to ORDERED Status (with validation)
  const handleMoveToOrdered = async () => {
    // Validate requirements
    const errors: string[] = [];

    // ETD is REQUIRED for all POs
    if (!pr.estimatedDeliveryDate && !etd) {
      errors.push('Estimated Delivery Date (ETD) is required');
    }

    // Proforma required if above Rule 1
    const hasProforma = normalizeAttachments(pr.proformaInvoice).length > 0;
    if (proformaRequired && !hasProforma && !pr.proformaOverride) {
      errors.push('Proforma invoice required (upload document or set override with justification)');
    }

    // PoP required if above Rule 1
    const hasPoP = normalizeAttachments(pr.proofOfPayment).length > 0;
    if (popRequired && !hasPoP && !pr.popOverride) {
      errors.push('Proof of Payment required (upload document or set override with justification)');
    }

    // PO Document required for high-value PRs (above Rule 3)
    if (poDocRequired && !pr.poIssueDate && !pr.poDocumentOverride) {
      errors.push('PO Document required for high-value purchase orders (generate PO or set override with justification)');
    }

    if (errors.length > 0) {
      enqueueSnackbar(`Cannot move to ORDERED: ${errors.join('; ')}`, { variant: 'error', autoHideDuration: 10000 });
      return;
    }

    // Final Price Variance Check (Rule 6 & 7) - Show warning dialog if needed
    if (pr.finalPrice && pr.lastApprovedAmount) {
      const approvedAmount = pr.lastApprovedAmount;
      const finalPriceAmount = pr.finalPrice;
      const variancePercentage = ((finalPriceAmount - approvedAmount) / approvedAmount) * 100;
      
      // Get thresholds from organization (TODO: fetch from org settings)
      const upwardThreshold = 5; // Rule 6: default 5%
      const downwardThreshold = 20; // Rule 7: default 20%
      
      const exceedsUpward = variancePercentage > upwardThreshold;
      const exceedsDownward = variancePercentage < -downwardThreshold;
      
      console.log('Final price variance check:', {
        approvedAmount,
        finalPrice: finalPriceAmount,
        variancePercentage: variancePercentage.toFixed(2),
        upwardThreshold,
        downwardThreshold,
        exceedsUpward,
        exceedsDownward,
        requiresApproval: pr.finalPriceRequiresApproval,
        isApproved: pr.finalPriceApproved
      });
      
      if (exceedsUpward || exceedsDownward) {
        // Variance exceeds thresholds - show warning dialog
        if (!pr.finalPriceApproved) {
          console.log('Final price variance exceeds threshold - showing override dialog');
          setFinalPriceVarianceData({
            approvedAmount,
            finalPrice: finalPriceAmount,
            variancePercentage,
            exceedsUpward,
            exceedsDownward
          });
          setMoveToOrderedDialog(false); // Close the move dialog
          setFinalPriceVarianceDialog(true); // Show variance warning dialog
          return; // Don't proceed yet - wait for user decision
        }
      }
    }

    // All validations passed - proceed with move
    await performMoveToOrdered();
  };

  // Actually perform the move to ORDERED (called after all validations/overrides)
  const performMoveToOrdered = async () => {
    try {
      console.log('Moving PO to ORDERED status:', { prId: pr.id, prNumber: pr.prNumber });
      
      // AUTO-GENERATE PO PDF if not already generated
      // This ensures the PO document is available in all subsequent statuses
      if (!pr.poIssueDate && !pr.poDocumentOverride) {
        console.log('Auto-generating PO document during APPROVED -> ORDERED transition...');
        try {
          await autoGeneratePODocument();
          console.log('PO document auto-generated successfully');
        } catch (poError) {
          console.error('Failed to auto-generate PO document:', poError);
          enqueueSnackbar('Warning: Failed to auto-generate PO document, but continuing with status change', { 
            variant: 'warning',
            autoHideDuration: 6000 
          });
          // Don't block the status change if PO generation fails
        }
      }
      
      // FIRST: Update status using updatePRStatus (doesn't strip status field)
      console.log('Updating status to ORDERED');
      await prService.updatePRStatus(
        pr.id, 
        PRStatus.ORDERED, 
        'PO moved to ORDERED status', // notes parameter (3rd)
        {  // user parameter (4th)
          id: currentUser.id,
          email: currentUser.email,
          name: currentUser.name || currentUser.email
        }
      );

      // SECOND: Update additional fields like orderedAt and ETD
      const additionalUpdates: any = {
        orderedAt: new Date().toISOString()
      };

      if (etd && etd !== pr.estimatedDeliveryDate) {
        additionalUpdates.estimatedDeliveryDate = etd;
      }

      console.log('Updating additional fields:', additionalUpdates);
      await prService.updatePR(pr.id, additionalUpdates);

      console.log('PR updated successfully, sending notification');
      // Send notification
      await notificationService.handleStatusChange(
        pr.id,
        pr.status,
        PRStatus.ORDERED,
        currentUser,
        'PO has been ordered and is awaiting delivery'
      );

      console.log('Notification sent, showing success message');
      enqueueSnackbar('PO moved to ORDERED status successfully', { variant: 'success' });
      setMoveToOrderedDialog(false);
      
      console.log('Calling onStatusChange to refresh data');
      await onStatusChange();
      
      console.log('Navigating to dashboard');
      // Add a small delay to ensure state updates propagate
      setTimeout(() => {
        navigate('/dashboard');
      }, 500);
    } catch (error) {
      console.error('Error moving to ORDERED:', error);
      enqueueSnackbar('Failed to move PO to ORDERED status', { variant: 'error' });
    }
  };

  const handleCancelPO = async () => {
    if (!cancelJustification.trim()) {
      enqueueSnackbar('Cancellation justification is required.', { variant: 'error' });
      return;
    }

    try {
      setCancelLoading(true);
      await prService.updatePRStatus(
        pr.id,
        PRStatus.CANCELED,
        `PO canceled: ${cancelJustification.trim()}`,
        {
          id: currentUser.id,
          email: currentUser.email,
          name: currentUser.name || currentUser.email,
        }
      );

      await notificationService.handleStatusChange(
        pr.id,
        pr.status,
        PRStatus.CANCELED,
        currentUser,
        `PO canceled with justification: ${cancelJustification.trim()}`
      );

      enqueueSnackbar('PO canceled successfully.', { variant: 'success' });
      setCancelDialogOpen(false);
      setCancelJustification('');
      await onStatusChange();
    } catch (error) {
      console.error('Error canceling PO:', error);
      enqueueSnackbar('Failed to cancel PO.', { variant: 'error' });
    } finally {
      setCancelLoading(false);
    }
  };

  // Auto-generate PO document and save as file (called during APPROVED -> ORDERED transition)
  const autoGeneratePODocument = async () => {
    console.log('[Auto PO Generation] Starting automatic PO document generation...');
    
    // Fetch organization details
    let orgId = pr.organization;
    if (!orgId) {
      throw new Error('Organization not found');
    }
    
    // Normalize organization ID
    const normalizedOrgId = orgId.toLowerCase().replace(/[^a-z0-9]/g, '_');
    console.log('[Auto PO Generation] Fetching organization details for:', { original: orgId, normalized: normalizedOrgId });
    
    const orgDetails = await organizationService.getOrganizationById(normalizedOrgId);
    console.log('[Auto PO Generation] Organization details fetched:', orgDetails);
    
    if (!orgDetails) {
      throw new Error('Failed to load organization details');
    }
    
    // Fetch vendor details
    let vendorData = null;
    const vendorId = pr.selectedVendor || pr.preferredVendor;
    if (vendorId) {
      console.log('[Auto PO Generation] Fetching vendor details for:', vendorId);
      vendorData = await referenceDataService.getVendorById(vendorId);
      console.log('[Auto PO Generation] Vendor details fetched:', vendorData);
    }
    
    // Fetch and convert logo to base64
    let base64Logo = '';
    try {
      console.log('[Auto PO Generation] Fetching logo...');
      const logoUrl = window.location.origin + '/logo.png';
      
      try {
        base64Logo = await imageUrlToBase64(logoUrl);
        console.log('[Auto PO Generation] Logo fetched successfully');
      } catch (fetchError) {
        console.warn('[Auto PO Generation] Fetch method failed, trying Image element method...', fetchError);
        base64Logo = await imageUrlToBase64ViaImage(logoUrl);
        console.log('[Auto PO Generation] Logo fetched via Image element method');
      }
    } catch (logoError) {
      console.warn('[Auto PO Generation] Could not load logo, continuing without it:', logoError);
    }
    
    // Update PR with PO issue date
    const poIssueDate = new Date().toISOString();
    await prService.updatePR(pr.id, {
      poIssueDate,
      updatedAt: new Date().toISOString()
    });
    
    // Create PR data with PO issue date
    const prWithPODate = { ...pr, poIssueDate };
    
    console.log('[Auto PO Generation] Creating PDF document...');
    
    // Generate the PDF
    const doc = <PODocument pr={prWithPODate} organizationDetails={orgDetails} vendorDetails={vendorData} logoBase64={base64Logo} />;
    const asPdf = pdf(doc);
    const blob = await asPdf.toBlob();
    
    console.log('[Auto PO Generation] PDF generated, uploading to storage...');
    
    // Upload PDF as a file to storage
    const fileName = `PO-${pr.prNumber}.pdf`;
    const file = new File([blob], fileName, { type: 'application/pdf' });
    
    const uploadResult = await StorageService.uploadToTempStorage(file);
    const uploadedFile: Attachment = {
      id: crypto.randomUUID(),
      name: fileName,
      url: uploadResult.url,
      path: uploadResult.path,
      type: file.type,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      uploadedBy: {
        id: currentUser.id,
        email: currentUser.email,
        name: currentUser.name || currentUser.email
      }
    };
    
    console.log('[Auto PO Generation] PDF uploaded successfully:', uploadedFile);
    
    // Save the uploaded PDF file reference to PR
    await prService.updatePR(pr.id, {
      poDocument: uploadedFile,
      updatedAt: new Date().toISOString()
    });
    
    console.log('[Auto PO Generation] PO document saved to PR');
    enqueueSnackbar('PO document automatically generated and saved', { variant: 'success' });
  };

  // Handle final price variance override
  const handleFinalPriceVarianceOverride = async () => {
    if (!finalPriceVarianceJustification.trim()) {
      enqueueSnackbar('Justification is required to override final price variance', { variant: 'error' });
      return;
    }

    try {
      console.log('Applying final price variance override with justification');
      
      // Save the override justification
      await prService.updatePR(pr.id, {
        finalPriceVarianceOverride: true,
        finalPriceVarianceOverrideJustification: finalPriceVarianceJustification,
        finalPriceRequiresApproval: true,
        updatedAt: new Date().toISOString()
      });

      enqueueSnackbar('Final price variance override recorded', { variant: 'info' });
      setFinalPriceVarianceDialog(false);
      setFinalPriceVarianceJustification('');
      
      // Refresh to get updated PR data
      await onStatusChange();
      
      // Now proceed with move to ORDERED
      await performMoveToOrdered();
    } catch (error) {
      console.error('Error setting final price variance override:', error);
      enqueueSnackbar('Failed to set variance override', { variant: 'error' });
    }
  };

  return (
    <Box>
      <Paper sx={{ p: 3, mb: 3, bgcolor: 'primary.50' }}>
        <Typography variant="h6" gutterBottom>
          PO Document Management (APPROVED Status)
        </Typography>
        <Typography variant="body2" color="textSecondary" paragraph>
          Upload required documents or set overrides to move this PO to ORDERED status
        </Typography>

        <Grid container spacing={3}>
          {/* Proforma Invoice Section */}
          <Grid item xs={12} md={6}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Proforma Invoice {proformaRequired && <Chip label="Required" size="small" color="error" />}
              </Typography>
              
              {pr.proformaOverride ? (
                <Box>
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    <Typography variant="body2" gutterBottom>
                      ✓ Override Active
                    </Typography>
                  </Alert>
                  <TextField
                    fullWidth
                    label="Override Justification"
                    multiline
                    rows={2}
                    value={proformaJustification}
                    onChange={(e) => setProformaJustification(e.target.value)}
                    helperText="Override is active - you can update justification if needed"
                    disabled
                    sx={{ mb: 2 }}
                  />
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={async () => {
                      await prService.updatePR(pr.id, {
                        proformaOverride: false,
                        proformaOverrideJustification: undefined,
                        updatedAt: new Date().toISOString()
                      });
                      enqueueSnackbar('Proforma override removed', { variant: 'info' });
                      onStatusChange();
                    }}
                  >
                    Remove Override
                  </Button>
                </Box>
              ) : (
                <Stack spacing={2}>
                  <FileUploadManager
                    label="Proforma Invoice"
                    files={normalizeAttachments(pr.proformaInvoice)}
                    onUpload={handleProformaUpload}
                    onDelete={handleProformaDelete}
                    uploading={uploadingProforma}
                    accept=".pdf,.jpg,.jpeg,.png"
                    helperText="PDF, JPG, or PNG files (multiple files allowed)"
                    multiple
                  />

                  <Divider>OR</Divider>

                  <TextField
                    fullWidth
                    label="Override Justification"
                    multiline
                    rows={2}
                    value={proformaJustification}
                    onChange={(e) => setProformaJustification(e.target.value)}
                    placeholder="E.g., Vendor doesn't provide proforma, urgent order, standing agreement"
                    helperText="Required if setting override"
                  />
                  <Button
                    variant="outlined"
                    onClick={handleProformaOverride}
                    disabled={!proformaJustification.trim()}
                  >
                    Set Override
                  </Button>
                </Stack>
              )}
            </Paper>
          </Grid>

          {/* Proof of Payment Section */}
          <Grid item xs={12} md={6}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Proof of Payment {popRequired && <Chip label="Required" size="small" color="error" />}
              </Typography>
              
              {pr.popOverride ? (
                <Box>
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    <Typography variant="body2" gutterBottom>
                      ✓ Override Active
                    </Typography>
                  </Alert>
                  <TextField
                    fullWidth
                    label="Override Justification"
                    multiline
                    rows={2}
                    value={popJustification}
                    onChange={(e) => setPopJustification(e.target.value)}
                    helperText="Override is active - you can update justification if needed"
                    disabled
                    sx={{ mb: 2 }}
                  />
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={async () => {
                      await prService.updatePR(pr.id, {
                        popOverride: false,
                        popOverrideJustification: undefined,
                        updatedAt: new Date().toISOString()
                      });
                      enqueueSnackbar('PoP override removed', { variant: 'info' });
                      onStatusChange();
                    }}
                  >
                    Remove Override
                  </Button>
                </Box>
              ) : (
                <Stack spacing={2}>
                  <FileUploadManager
                    label="Proof of Payment"
                    files={normalizeAttachments(pr.proofOfPayment)}
                    onUpload={handlePoPUpload}
                    onDelete={handlePoPDelete}
                    uploading={uploadingPoP}
                    accept=".pdf,.jpg,.jpeg,.png"
                    helperText="PDF, JPG, or PNG files (multiple files allowed)"
                    multiple
                  />

                  <Divider>OR</Divider>

                  <TextField
                    fullWidth
                    label="Override Justification"
                    multiline
                    rows={2}
                    value={popJustification}
                    onChange={(e) => setPopJustification(e.target.value)}
                    placeholder="E.g., Payment pending, emergency purchase, prepaid arrangement"
                    helperText="Required if setting override"
                  />
                  <Button
                    variant="outlined"
                    onClick={handlePoPOverride}
                    disabled={!popJustification.trim()}
                  >
                    Set Override
                  </Button>
                </Stack>
              )}
            </Paper>
          </Grid>

          {/* Estimated Delivery Date */}
          <Grid item xs={12}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Estimated Delivery Date (ETD) <Chip label="Required" size="small" color="error" />
              </Typography>
              
              {pr.estimatedDeliveryDate && (
                <Alert severity="success" sx={{ mb: 2 }}>
                  <Typography variant="body2">
                    ✓ ETD Set: <strong>{new Date(pr.estimatedDeliveryDate).toLocaleDateString('en-US', { 
                      weekday: 'short', 
                      year: 'numeric', 
                      month: 'short', 
                      day: 'numeric' 
                    })}</strong>
                  </Typography>
                </Alert>
              )}
              
              <Stack direction="row" spacing={2} alignItems="center">
                <TextField
                  type="date"
                  value={etd}
                  onChange={(e) => setEtd(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  label="Expected Delivery Date"
                  sx={{ flexGrow: 1 }}
                  helperText={pr.estimatedDeliveryDate ? "Update to a new date if needed" : "Select the expected delivery date"}
                />
                <Button
                  variant="contained"
                  onClick={handleEtdUpdate}
                  disabled={!etd || etd === pr.estimatedDeliveryDate}
                >
                  {pr.estimatedDeliveryDate ? 'Update ETD' : 'Save ETD'}
                </Button>
              </Stack>
            </Paper>
          </Grid>

          {/* Final Price from Proforma Invoice */}
          <Grid item xs={12}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Final Price from Proforma Invoice
              </Typography>
              <Stack direction="row" spacing={2} alignItems="flex-start">
                <TextField
                  type="number"
                  value={finalPrice}
                  onChange={(e) => setFinalPrice(e.target.value)}
                  label="Final Price Amount"
                  InputProps={{
                    startAdornment: pr.currency || 'LSL',
                  }}
                  sx={{ flexGrow: 1 }}
                  helperText="Enter the final price from the proforma invoice"
                />
                <TextField
                  multiline
                  rows={2}
                  value={finalPriceNotes}
                  onChange={(e) => setFinalPriceNotes(e.target.value)}
                  label="Variance Notes (if applicable)"
                  placeholder="Explain any significant price variance..."
                  sx={{ flexGrow: 2 }}
                />
                <Button
                  variant="contained"
                  onClick={handleFinalPriceUpdate}
                  disabled={!finalPrice || parseFloat(finalPrice) <= 0}
                >
                  Save Final Price
                </Button>
              </Stack>
              {pr.finalPrice && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  <Typography variant="body2">
                    Current Final Price: {formatCurrency(pr.finalPrice, pr.finalPriceCurrency || pr.currency || 'LSL')}
                  </Typography>
                  {pr.finalPriceVarianceNotes && (
                    <Typography variant="caption" display="block">
                      Notes: {pr.finalPriceVarianceNotes}
                    </Typography>
                  )}
                </Alert>
              )}
            </Paper>
          </Grid>

          {/* PO Document Generation */}
          <Grid item xs={12}>
            <Paper variant="outlined" sx={{ p: 2, bgcolor: poDocRequired ? 'info.50' : 'background.paper' }}>
              <Typography variant="subtitle1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <DocumentIcon />
                Purchase Order Document
                {poDocRequired && <Chip label="Required for High-Value PO" size="small" color="warning" />}
                {!poDocRequired && <Chip label="Optional" size="small" color="default" />}
              </Typography>
              
              <Typography variant="body2" color="textSecondary" paragraph>
                {poDocRequired 
                  ? 'This is a high-value purchase order. A formal PO document must be generated OR override with justification.'
                  : 'Generate a professional PO document to send to your supplier (optional for this PO value).'}
              </Typography>

              {pr.poDocumentOverride ? (
                <Box>
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    <Typography variant="body2" gutterBottom>
                      ✓ PO Document Override Active
                    </Typography>
                  </Alert>
                  <TextField
                    fullWidth
                    label="Override Justification"
                    multiline
                    rows={2}
                    value={poDocJustification}
                    disabled
                    sx={{ mb: 2 }}
                  />
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={async () => {
                      await prService.updatePR(pr.id, {
                        poDocumentOverride: false,
                        poDocumentOverrideJustification: undefined,
                        updatedAt: new Date().toISOString()
                      });
                      enqueueSnackbar('PO document override removed', { variant: 'info' });
                      onStatusChange();
                    }}
                  >
                    Remove Override
                  </Button>
                </Box>
              ) : pr.poIssueDate ? (
                <Box>
                  <Alert severity="success" sx={{ mb: 2 }}>
                    <Typography variant="body2">
                      ✓ PO Document Generated
                    </Typography>
                    <Typography variant="caption">
                      Issue Date: {new Date(pr.poIssueDate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </Typography>
                  </Alert>
                  <Stack direction="row" spacing={2}>
                    <Button
                      variant="contained"
                      startIcon={<DownloadIcon />}
                      onClick={handleGeneratePO}
                      disabled={generatingPO || loadingOrgDetails}
                    >
                      {loadingOrgDetails ? 'Loading...' : generatingPO ? 'Generating...' : 'Review & Download PO'}
                    </Button>
                    {poDocRequired && (
                      <>
                        <Divider orientation="vertical" flexItem />
                        <Typography variant="caption" color="textSecondary" sx={{ alignSelf: 'center' }}>
                          Or set override if PO document not needed
                        </Typography>
                      </>
                    )}
                  </Stack>
                </Box>
              ) : (
                <Stack spacing={2}>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<DocumentIcon />}
                    onClick={handleGeneratePO}
                    disabled={generatingPO || loadingOrgDetails}
                    size="large"
                  >
                    {loadingOrgDetails ? 'Loading...' : generatingPO ? t('pr.generatingPO') : t('pr.generatePO')}
                  </Button>

                  {poDocRequired && (
                    <>
                      <Divider>OR (FOR HIGH-VALUE POs ONLY)</Divider>

                      <TextField
                        fullWidth
                        label="Override Justification"
                        multiline
                        rows={2}
                        value={poDocJustification}
                        onChange={(e) => setPoDocJustification(e.target.value)}
                        placeholder="E.g., Supplier doesn't require formal PO document, existing framework agreement, urgent procurement"
                        helperText="Required if setting override for high-value PO"
                      />
                      <Button
                        variant="outlined"
                        onClick={handlePoDocOverride}
                        disabled={!poDocJustification.trim()}
                      >
                        Set Override (Skip PO Document)
                      </Button>
                    </>
                  )}
                </Stack>
              )}
            </Paper>
          </Grid>

          {/* Inter-team Notifications */}
          <Grid item xs={12}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Inter-team Notifications
              </Typography>
              <Stack direction="row" spacing={2}>
                {isProcurement && (
                  <Button
                    variant="outlined"
                    startIcon={<SendIcon />}
                    onClick={() => setNotifyDialog('finance')}
                  >
                    Notify Finance for Payment
                  </Button>
                )}
                {(isFinanceAdmin || isFinanceApprover) && (
                  <Button
                    variant="outlined"
                    startIcon={<SendIcon />}
                    onClick={() => setNotifyDialog('procurement')}
                  >
                    Notify Procurement for Uploads
                  </Button>
                )}
              </Stack>
            </Paper>
          </Grid>

          {/* Actions */}
          <Grid item xs={12}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <Button
                variant="contained"
                color="success"
                size="large"
                fullWidth
                startIcon={<CheckIcon />}
                onClick={() => setMoveToOrderedDialog(true)}
              >
                {t('pr.moveToOrdered')}
              </Button>
              {canCancelPO && (
                <Button
                  variant="outlined"
                  color="error"
                  size="large"
                  fullWidth
                  onClick={() => setCancelDialogOpen(true)}
                >
                  {t('pr.cancelPO', 'Cancel PO')}
                </Button>
              )}
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      {/* Notify Finance Dialog */}
      <Dialog open={notifyDialog === 'finance'} onClose={() => setNotifyDialog(null)}>
        <DialogTitle>{t('pr.notifyFinanceTeam')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" paragraph>
            {t('pr.notifyFinanceDesc')}
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={3}
            label={t('pr.messageOptional')}
            value={notifyMessage}
            onChange={(e) => setNotifyMessage(e.target.value)}
            placeholder={t('pr.additionalInstructions')}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNotifyDialog(null)}>{t('common.cancel')}</Button>
          <Button onClick={handleNotifyFinance} variant="contained">
            {t('pr.sendNotification')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Notify Procurement Dialog */}
      <Dialog open={notifyDialog === 'procurement'} onClose={() => setNotifyDialog(null)}>
        <DialogTitle>{t('pr.notifyProcurementTeam')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" paragraph>
            {t('pr.notifyProcurementDesc')}
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={3}
            label={t('pr.messageOptional')}
            value={notifyMessage}
            onChange={(e) => setNotifyMessage(e.target.value)}
            placeholder={t('pr.additionalInstructions')}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNotifyDialog(null)}>{t('common.cancel')}</Button>
          <Button onClick={handleNotifyProcurement} variant="contained">
            {t('pr.sendNotification')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Move to ORDERED Confirmation Dialog */}
      <Dialog open={moveToOrderedDialog} onClose={() => setMoveToOrderedDialog(false)}>
        <DialogTitle>{t('pr.moveToOrdered')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" paragraph>
            {t('pr.confirmAllRequirements')}
          </Typography>
          <Stack spacing={1}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {pr.estimatedDeliveryDate || etd ? (
                <>
                  <CheckIcon color="success" fontSize="small" />
                  <Typography variant="body2">ETD: {pr.estimatedDeliveryDate || etd}</Typography>
                </>
              ) : (
                <>
                  <Typography variant="body2" color="error">❌ {t('pr.etdNotSet')}</Typography>
                </>
              )}
            </Box>
            {proformaRequired && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {(normalizeAttachments(pr.proformaInvoice).length > 0 || pr.proformaOverride) ? (
                  <>
                    <CheckIcon color="success" fontSize="small" />
                    <Typography variant="body2">
                      Proforma: {normalizeAttachments(pr.proformaInvoice).length > 0 
                        ? `${normalizeAttachments(pr.proformaInvoice).length} ${t('pr.files')}` 
                        : t('pr.overrideSet')}
                    </Typography>
                  </>
                ) : (
                  <Typography variant="body2" color="error">❌ {t('pr.proformaNotProvided')}</Typography>
                )}
              </Box>
            )}
            {popRequired && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {(normalizeAttachments(pr.proofOfPayment).length > 0 || pr.popOverride) ? (
                  <>
                    <CheckIcon color="success" fontSize="small" />
                    <Typography variant="body2">
                      PoP: {normalizeAttachments(pr.proofOfPayment).length > 0 
                        ? `${normalizeAttachments(pr.proofOfPayment).length} ${t('pr.files')}` 
                        : t('pr.overrideSet')}
                    </Typography>
                  </>
                ) : (
                  <Typography variant="body2" color="error">❌ {t('pr.popNotProvided')}</Typography>
                )}
              </Box>
            )}
            {poDocRequired && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {pr.poIssueDate || pr.poDocumentOverride ? (
                  <>
                    <CheckIcon color="success" fontSize="small" />
                    <Typography variant="body2">
                      PO Document: {pr.poIssueDate ? t('pr.generated') : t('pr.overrideSet')}
                    </Typography>
                  </>
                ) : (
                  <Typography variant="body2" color="error">❌ {t('pr.poDocNotProvided')}</Typography>
                )}
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMoveToOrderedDialog(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleMoveToOrdered} variant="contained" color="success">
            {t('pr.confirmMoveToOrdered')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Cancel PO Dialog */}
      <Dialog open={cancelDialogOpen} onClose={() => setCancelDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('pr.cancelPO', 'Cancel Purchase Order')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" paragraph>
            {t(
              'pr.cancelPONote',
              'Provide a justification to cancel this PO. This will move the request to CANCELED status.'
            )}
          </Typography>
          <TextField
            fullWidth
            multiline
            minRows={4}
            label={t('pr.cancellationReason', 'Cancellation Justification')}
            value={cancelJustification}
            onChange={(e) => setCancelJustification(e.target.value)}
            placeholder={t('pr.cancellationReasonPlaceholder', 'Explain why this PO should be canceled.')}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelDialogOpen(false)} disabled={cancelLoading}>
            {t('common.keepOpen', 'Keep PO Open')}
          </Button>
          <Button
            onClick={handleCancelPO}
            variant="contained"
            color="error"
            disabled={cancelLoading || !cancelJustification.trim()}
          >
            {cancelLoading ? t('common.processing', 'Processing...') : t('pr.confirmCancelPO', 'Cancel PO')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Final Price Variance Warning Dialog */}
      <Dialog 
        open={finalPriceVarianceDialog} 
        onClose={() => {
          setFinalPriceVarianceDialog(false);
          setFinalPriceVarianceJustification('');
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ bgcolor: 'warning.light', color: 'warning.contrastText' }}>
          ⚠️ {t('pr.priceVarianceTitle')}
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {finalPriceVarianceData && (
            <>
              <Alert severity="warning" sx={{ mb: 3 }}>
                <Typography variant="body1" gutterBottom fontWeight="bold">
                  {t('pr.priceVarianceDetected')}
                </Typography>
                <Typography variant="body2" paragraph>
                  {t('pr.priceVarianceDesc')}
                </Typography>
                <Box sx={{ pl: 2, mb: 2 }}>
                  <Typography variant="body2">
                    • <strong>{t('pr.approvedAmount')}:</strong> {formatCurrency(finalPriceVarianceData.approvedAmount, pr.currency || 'LSL')}
                  </Typography>
                  <Typography variant="body2">
                    • <strong>{t('pr.finalPrice')}:</strong> {formatCurrency(finalPriceVarianceData.finalPrice, pr.currency || 'LSL')}
                  </Typography>
                  <Typography variant="body2" color={finalPriceVarianceData.variancePercentage > 0 ? 'error.main' : 'warning.main'} fontWeight="bold">
                    • <strong>{t('pr.variance')}:</strong> {finalPriceVarianceData.variancePercentage > 0 ? '+' : ''}{finalPriceVarianceData.variancePercentage.toFixed(2)}%
                  </Typography>
                </Box>
                <Typography variant="body2">
                  {finalPriceVarianceData.exceedsUpward && t('pr.exceedsUpwardThreshold')}
                  {finalPriceVarianceData.exceedsDownward && t('pr.exceedsDownwardThreshold')}
                </Typography>
              </Alert>

              <Typography variant="body2" paragraph>
                {t('pr.priceVarianceJustificationRequired')}
              </Typography>

              <TextField
                fullWidth
                multiline
                rows={4}
                label={t('pr.justificationForPriceVariance')}
                placeholder={t('pr.priceVariancePlaceholder')}
                value={finalPriceVarianceJustification}
                onChange={(e) => setFinalPriceVarianceJustification(e.target.value)}
                required
                helperText={`${finalPriceVarianceJustification.length}/500 characters`}
                inputProps={{ maxLength: 500 }}
                sx={{ mt: 2 }}
              />
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button 
            onClick={() => {
              setFinalPriceVarianceDialog(false);
              setFinalPriceVarianceJustification('');
              setFinalPriceVarianceData(null);
            }}
            variant="outlined"
          >
            {t('common.cancel')}
          </Button>
          <Button 
            onClick={handleFinalPriceVarianceOverride}
            variant="contained"
            color="warning"
            disabled={!finalPriceVarianceJustification.trim()}
          >
            {t('pr.proceedWithOverride')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* PO Review & Edit Dialog */}
      {poReviewDialogOpen && organizationDetails && (
        <POReviewDialog
          open={poReviewDialogOpen}
          pr={pr}
          organizationDetails={organizationDetails}
          vendorDetails={vendorDetails}
          onClose={() => setPoReviewDialogOpen(false)}
          onGenerate={handlePOGeneration}
        />
      )}
    </Box>
  );
};

