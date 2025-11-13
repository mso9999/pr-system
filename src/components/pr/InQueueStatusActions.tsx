import React, { useState } from 'react';
import {
  Box,
  Button,
  Paper,
  Typography,
  Alert,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Chip,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormControl,
  FormLabel,
  LinearProgress,
  Collapse,
  IconButton,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import {
  Description as RFQIcon,
  Download as DownloadIcon,
  CloudUpload as UploadIcon,
  TableChart as ExcelIcon,
  InsertDriveFile as CSVIcon,
  Send as SendIcon,
  ExpandMore as ExpandMoreIcon,
  Link as LinkIcon,
  Folder as FolderIcon,
} from '@mui/icons-material';
import { PRRequest, LineItem } from '@/types/pr';
import { User } from '@/types/user';
import { RFQDocument } from './RFQDocument';
import { pdf } from '@react-pdf/renderer';
import { 
  downloadRFQTemplateExcel, 
  downloadRFQTemplateCSV, 
  parseRFQFile,
  processLineItemFileLinks 
} from '@/utils/rfqTemplateUtils';
import { organizationService } from '@/services/organizationService';
import { imageUrlToBase64ViaImage } from '@/utils/imageUtils';
import { prService } from '@/services/pr';

interface InQueueStatusActionsProps {
  pr: PRRequest;
  currentUser: User;
  onStatusChange: () => void;
}

export const InQueueStatusActions: React.FC<InQueueStatusActionsProps> = ({
  pr,
  currentUser,
  onStatusChange,
}) => {
  const { enqueueSnackbar } = useSnackbar();
  const [generatingRFQ, setGeneratingRFQ] = useState(false);
  const [templateMenuAnchor, setTemplateMenuAnchor] = useState<null | HTMLElement>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [parsedItems, setParsedItems] = useState<Partial<LineItem>[]>([]);
  const [importMode, setImportMode] = useState<'overwrite' | 'append'>('overwrite');
  const [processingLinks, setProcessingLinks] = useState(false);
  const [linkProgress, setLinkProgress] = useState({ current: 0, total: 0, fileName: '' });
  const [expanded, setExpanded] = useState(false); // Collapsed by default

  // Permission check - Procurement and Superadmin can generate RFQ
  const canGenerateRFQ = currentUser.permissionLevel === 1 || currentUser.permissionLevel === 3;

  const handleGenerateRFQ = async () => {
    console.log('🎯 RFQ Generation started', {
      prNumber: pr.prNumber,
      prId: pr.id,
      lineItemCount: pr.lineItems?.length || 0,
      organization: pr.organization
    });

    // Validate that we have line items
    if (!pr.lineItems || pr.lineItems.length === 0) {
      console.warn('⚠️ RFQ Generation failed: No line items');
      enqueueSnackbar('Please add line items before generating RFQ', { variant: 'warning' });
      return;
    }

    try {
      setGeneratingRFQ(true);
      console.log('📦 Step 1: Fetching organization data...', {
        prOrganization: pr.organization,
        type: typeof pr.organization
      });

      // Fetch organization data - try by name first (as PRs store organization names)
      let orgData = await organizationService.getOrganizationByName(pr.organization || '');
      
      // Fallback: try by ID if name lookup failed
      if (!orgData) {
        console.log('⚠️ Organization not found by name, trying ID lookup...');
        orgData = await organizationService.getOrganizationById(pr.organization || '');
      }
      
      console.log('✓ Organization data loaded:', {
        id: orgData?.id,
        name: orgData?.name,
        hasLogo: !!orgData?.logoUrl,
        found: !!orgData
      });
      
      // Convert logo to base64 if available
      let logoBase64: string | undefined;
      if (orgData?.logoUrl) {
        try {
          console.log('🖼️ Step 2: Converting logo to base64...');
          logoBase64 = await imageUrlToBase64ViaImage(orgData.logoUrl);
          console.log('✓ Logo converted successfully');
        } catch (error) {
          console.warn('⚠️ Failed to load organization logo:', error);
        }
      } else {
        console.log('ℹ️ No logo URL provided, skipping logo conversion');
      }

      console.log('📄 Step 3: Creating RFQ document component...');
      
      // If organization data not found, create fallback with PR's organization name
      const organizationData = orgData || { 
        id: pr.organization || '',
        name: pr.organization || 'Organization',
        active: true,
        // Add minimal required fields for RFQ
        companyLegalName: pr.organization || 'Organization',
        companyPhone: '',
        companyWebsite: '',
        procurementEmail: '',
        baseCurrency: pr.currency || 'LSL',
        allowedCurrencies: [pr.currency || 'LSL']
      };
      
      console.log('📋 Using organization data:', {
        id: organizationData.id,
        name: organizationData.name,
        companyLegalName: organizationData.companyLegalName
      });
      
      // Generate PDF
      const rfqDoc = (
        <RFQDocument
          pr={pr}
          orgLogo={logoBase64}
          organization={organizationData}
        />
      );

      console.log('🔄 Step 4: Generating PDF blob...');
      const blob = await pdf(rfqDoc).toBlob();
      console.log('✓ PDF blob created:', {
        size: blob.size,
        type: blob.type
      });
      
      console.log('💾 Step 5: Triggering download...');
      // Download the PDF
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `RFQ_${pr.prNumber}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log('✅ RFQ generated and downloaded successfully');
      enqueueSnackbar('RFQ generated and downloaded successfully', { variant: 'success' });
    } catch (error) {
      console.error('❌ Error generating RFQ:', {
        error: error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        prNumber: pr.prNumber,
        organization: pr.organization
      });
      enqueueSnackbar(`Failed to generate RFQ: ${error instanceof Error ? error.message : 'Unknown error'}`, { variant: 'error' });
    } finally {
      setGeneratingRFQ(false);
    }
  };

  const handleDownloadTemplate = (format: 'excel' | 'csv') => {
    try {
      if (format === 'excel') {
        downloadRFQTemplateExcel(pr.prNumber);
      } else {
        downloadRFQTemplateCSV(pr.prNumber);
      }
      enqueueSnackbar(`${format.toUpperCase()} template downloaded`, { variant: 'success' });
    } catch (error) {
      console.error('Error downloading template:', error);
      enqueueSnackbar('Failed to download template', { variant: 'error' });
    }
    setTemplateMenuAnchor(null);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    
    if (!validExtensions.includes(fileExtension)) {
      enqueueSnackbar('Please upload an Excel (.xlsx, .xls) or CSV file', { variant: 'error' });
      return;
    }

    try {
      setUploadingFile(true);
      const items = await parseRFQFile(file);
      setParsedItems(items);
      setUploadDialogOpen(true);
      enqueueSnackbar(`Successfully parsed ${items.length} line items`, { variant: 'success' });
    } catch (error) {
      console.error('Error parsing file:', error);
      enqueueSnackbar(
        `Failed to parse file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { variant: 'error' }
      );
    } finally {
      setUploadingFile(false);
      // Reset file input
      event.target.value = '';
    }
  };

  const handleApplyLineItems = async () => {
    try {
      setProcessingLinks(true);

      // Process file links (download files from URLs if they're not folders)
      const processedItems = await processLineItemFileLinks(
        parsedItems,
        (current, total, fileName) => {
          setLinkProgress({ current, total, fileName });
        }
      );

      // Convert parsed items to full LineItem format
      const newLineItems: LineItem[] = processedItems.map((item) => ({
        id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
        description: item.description || '',
        quantity: item.quantity || 1,
        uom: item.uom || 'UNIT',
        notes: item.notes || '',
        estimatedUnitPrice: item.estimatedUnitPrice,
        estimatedTotal: item.estimatedTotal,
        attachments: item.attachments || [],
        fileLink: item.fileLink,
        isFolder: item.isFolder,
      }));

      // Determine final line items based on import mode
      const finalLineItems = importMode === 'overwrite'
        ? newLineItems
        : [...(pr.lineItems || []), ...newLineItems];

      // Log what we're about to save
      console.log(`💾 Saving ${finalLineItems.length} line items to PR ${pr.id}:`, {
        itemsWithAttachments: finalLineItems.filter(i => i.attachments && i.attachments.length > 0).length,
        itemsWithFileLinks: finalLineItems.filter(i => i.fileLink).length,
        sampleItem: finalLineItems[0]
      });

      // Update PR with new line items
      await prService.updatePR(pr.id, {
        lineItems: finalLineItems,
      });

      const action = importMode === 'overwrite' ? 'replaced' : 'added';
      enqueueSnackbar(`Line items ${action} successfully`, { variant: 'success' });
      setUploadDialogOpen(false);
      setParsedItems([]);
      setImportMode('overwrite');
      onStatusChange();
    } catch (error) {
      console.error('Error updating line items:', error);
      enqueueSnackbar('Failed to update line items', { variant: 'error' });
    } finally {
      setProcessingLinks(false);
      setLinkProgress({ current: 0, total: 0, fileName: '' });
    }
  };

  if (!canGenerateRFQ) {
    return null;
  }

  return (
    <>
      <Paper 
        sx={{ 
          mb: 3,
          overflow: 'hidden',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        {/* Collapsible Header */}
        <Box
          onClick={() => setExpanded(!expanded)}
          sx={{
            p: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            bgcolor: expanded ? 'primary.50' : 'background.paper',
            '&:hover': { bgcolor: 'action.hover' },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <RFQIcon />
            <Typography variant="h6">
              Request for Quotation (RFQ)
            </Typography>
          </Box>
          <IconButton
            size="small"
            sx={{
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.3s',
            }}
          >
            <ExpandMoreIcon />
          </IconButton>
        </Box>

        {/* Collapsible Content */}
        <Collapse in={expanded}>
          <Box sx={{ p: 3, pt: 2 }}>
            <Divider sx={{ mb: 2 }} />

            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2" gutterBottom>
                <strong>Generate RFQ from:</strong>
              </Typography>
              <Typography variant="body2" component="div">
                • Line items entered directly in the PR system, OR
              </Typography>
              <Typography variant="body2" component="div">
                • Line items uploaded from an Excel/CSV file (must match template format)
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                Download the template, fill it with your line items, then upload and apply before generating the RFQ.
              </Typography>
            </Alert>
            <Alert severity="info" icon={<LinkIcon />} sx={{ mb: 2 }}>
              <Typography variant="body2" gutterBottom>
                <strong>🔗 File Links - Auto-Conversion:</strong>
              </Typography>
              <Typography variant="body2">
                If your CSV includes file links, the system will:
              </Typography>
              <Typography variant="body2" component="div" sx={{ ml: 2, mt: 0.5 }}>
                • <strong>Automatically convert</strong> Dropbox, Google Drive, and OneDrive sharing links to direct downloads
              </Typography>
              <Typography variant="body2" component="div" sx={{ ml: 2 }}>
                • <strong>Download files</strong> and upload them to secure storage
              </Typography>
              <Typography variant="body2" component="div" sx={{ ml: 2 }}>
                • <strong>Preserve folder links</strong> as clickable references
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                ✨ Just paste your "Copy Link" URLs from Dropbox/Google Drive - no manual conversion needed!
              </Typography>
            </Alert>

            <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
              {/* Generate RFQ Button */}
              <Button
                variant="contained"
                startIcon={<SendIcon />}
                onClick={handleGenerateRFQ}
                disabled={generatingRFQ}
              >
                {generatingRFQ ? 'Generating...' : 'Generate RFQ'}
              </Button>

              {/* Download Template Button */}
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={(e) => setTemplateMenuAnchor(e.currentTarget)}
              >
                Download Template
              </Button>

              {/* Upload File Button */}
              <Button
                variant="outlined"
                component="label"
                startIcon={<UploadIcon />}
                disabled={uploadingFile}
              >
                {uploadingFile ? 'Uploading...' : 'Upload Line Items'}
                <input
                  type="file"
                  hidden
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                />
              </Button>
            </Stack>

            <Box sx={{ mt: 2 }}>
              {!pr.lineItems || pr.lineItems.length === 0 ? (
                <Alert severity="warning" icon={<UploadIcon />}>
                  <Typography variant="body2" fontWeight="bold" gutterBottom>
                    No line items yet
                  </Typography>
                  <Typography variant="body2">
                    To generate an RFQ, you must first add line items by either:
                  </Typography>
                  <Typography variant="body2" component="div" sx={{ ml: 2, mt: 0.5 }}>
                    1. Downloading the template, filling it, and uploading it, OR
                  </Typography>
                  <Typography variant="body2" component="div" sx={{ ml: 2 }}>
                    2. Adding line items manually in the PR form
                  </Typography>
                </Alert>
              ) : (
                <Alert severity="success" sx={{ display: 'flex', alignItems: 'center' }}>
                  <Typography variant="body2">
                    ✓ Ready to generate RFQ with <strong>{pr.lineItems.length}</strong> line item{pr.lineItems.length !== 1 ? 's' : ''}
                  </Typography>
                </Alert>
              )}
            </Box>
          </Box>
        </Collapse>
      </Paper>

      {/* Template Download Menu */}
      <Menu
        anchorEl={templateMenuAnchor}
        open={Boolean(templateMenuAnchor)}
        onClose={() => setTemplateMenuAnchor(null)}
      >
        <MenuItem onClick={() => handleDownloadTemplate('excel')}>
          <ListItemIcon>
            <ExcelIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Excel Template (.xlsx)" />
        </MenuItem>
        <MenuItem onClick={() => handleDownloadTemplate('csv')}>
          <ListItemIcon>
            <CSVIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="CSV Template (.csv)" />
        </MenuItem>
      </Menu>

      {/* Line Items Upload Confirmation Dialog */}
      <Dialog
        open={uploadDialogOpen}
        onClose={() => setUploadDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Confirm Line Items Import
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            The following {parsedItems.length} line items will be {importMode === 'overwrite' ? 'replaced' : 'added'}. Review them before applying.
          </Alert>

          {/* Import Mode Selection */}
          <FormControl component="fieldset" sx={{ mb: 2 }}>
            <FormLabel component="legend">Import Mode</FormLabel>
            <RadioGroup
              row
              value={importMode}
              onChange={(e) => setImportMode(e.target.value as 'overwrite' | 'append')}
            >
              <FormControlLabel
                value="overwrite"
                control={<Radio />}
                label="Overwrite existing line items"
              />
              <FormControlLabel
                value="append"
                control={<Radio />}
                label="Add to existing line items"
              />
            </RadioGroup>
          </FormControl>

          {/* Processing Progress */}
          {processingLinks && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" gutterBottom>
                Downloading files from URLs... ({linkProgress.current} / {linkProgress.total})
              </Typography>
              <Typography variant="caption" color="text.secondary" gutterBottom>
                {linkProgress.fileName}
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={linkProgress.total > 0 ? (linkProgress.current / linkProgress.total) * 100 : 0} 
              />
            </Box>
          )}

          <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
            {parsedItems.map((item, index) => (
              <Paper key={index} sx={{ p: 2, mb: 1, bgcolor: 'grey.50' }}>
                <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                  <Chip label={`#${index + 1}`} size="small" />
                  <Typography variant="body2" fontWeight="bold">
                    {item.description}
                  </Typography>
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  Quantity: {item.quantity} {item.uom}
                  {item.estimatedUnitPrice && ` | Unit Price: ${item.estimatedUnitPrice}`}
                  {item.estimatedTotal && ` | Total: ${item.estimatedTotal}`}
                </Typography>
                {item.notes && (
                  <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                    Notes: {item.notes}
                  </Typography>
                )}
                {item.fileLink && (
                  <Stack direction="row" spacing={0.5} alignItems="center" mt={0.5}>
                    {item.isFolder ? <FolderIcon fontSize="small" color="primary" /> : <LinkIcon fontSize="small" color="primary" />}
                    <Typography variant="caption" color="primary" sx={{ wordBreak: 'break-all' }}>
                      {item.isFolder ? 'Folder: ' : 'File: '}{item.fileLink}
                    </Typography>
                  </Stack>
                )}
                {item.attachments && item.attachments.length > 0 && (
                  <Typography variant="caption" color="success.main" display="block" mt={0.5}>
                    ✓ {item.attachments.length} attachment(s) uploaded
                  </Typography>
                )}
              </Paper>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadDialogOpen(false)} disabled={processingLinks}>
            Cancel
          </Button>
          <Button 
            onClick={handleApplyLineItems} 
            variant="contained" 
            color="primary"
            disabled={processingLinks}
          >
            {processingLinks ? 'Processing...' : importMode === 'overwrite' ? 'Overwrite Line Items' : 'Add Line Items'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

