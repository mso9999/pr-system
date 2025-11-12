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
} from '@mui/material';
import { useSnackbar } from 'notistack';
import {
  Description as RFQIcon,
  Download as DownloadIcon,
  CloudUpload as UploadIcon,
  TableChart as ExcelIcon,
  InsertDriveFile as CSVIcon,
  Send as SendIcon,
} from '@mui/icons-material';
import { PRRequest, LineItem } from '@/types/pr';
import { User } from '@/types/user';
import { RFQDocument } from './RFQDocument';
import { pdf } from '@react-pdf/renderer';
import { downloadRFQTemplateExcel, downloadRFQTemplateCSV, parseRFQFile } from '@/utils/rfqTemplateUtils';
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

  // Permission check - Procurement and Superadmin can generate RFQ
  const canGenerateRFQ = currentUser.permissionLevel === 1 || currentUser.permissionLevel === 3;

  const handleGenerateRFQ = async () => {
    // Validate that we have line items
    if (!pr.lineItems || pr.lineItems.length === 0) {
      enqueueSnackbar('Please add line items before generating RFQ', { variant: 'warning' });
      return;
    }

    try {
      setGeneratingRFQ(true);

      // Fetch organization data
      const orgData = await organizationService.getOrganization(pr.organization || '');
      
      // Convert logo to base64 if available
      let logoBase64: string | undefined;
      if (orgData?.logoUrl) {
        try {
          logoBase64 = await imageUrlToBase64ViaImage(orgData.logoUrl);
        } catch (error) {
          console.warn('Failed to load organization logo:', error);
        }
      }

      // Generate PDF
      const rfqDoc = (
        <RFQDocument
          pr={pr}
          orgLogo={logoBase64}
          orgName={orgData?.name || pr.organization || 'Organization'}
          orgAddress={orgData?.address}
        />
      );

      const blob = await pdf(rfqDoc).toBlob();
      
      // Download the PDF
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `RFQ_${pr.prNumber}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      enqueueSnackbar('RFQ generated and downloaded successfully', { variant: 'success' });
    } catch (error) {
      console.error('Error generating RFQ:', error);
      enqueueSnackbar('Failed to generate RFQ', { variant: 'error' });
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
      // Convert parsed items to full LineItem format
      const lineItems: LineItem[] = parsedItems.map((item, index) => ({
        description: item.description || '',
        quantity: item.quantity || 1,
        uom: item.uom || 'UNIT',
        notes: item.notes || '',
        estimatedUnitPrice: item.estimatedUnitPrice,
        estimatedTotal: item.estimatedTotal,
        attachments: [],
      }));

      // Update PR with new line items
      await prService.updatePR(pr.id, {
        lineItems,
      });

      enqueueSnackbar('Line items updated successfully', { variant: 'success' });
      setUploadDialogOpen(false);
      setParsedItems([]);
      onStatusChange();
    } catch (error) {
      console.error('Error updating line items:', error);
      enqueueSnackbar('Failed to update line items', { variant: 'error' });
    }
  };

  if (!canGenerateRFQ) {
    return null;
  }

  return (
    <>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <RFQIcon />
          Request for Quotation (RFQ)
        </Typography>
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
            The following {parsedItems.length} line items will be added to this PR. Review them before applying.
          </Alert>

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
              </Paper>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadDialogOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleApplyLineItems} variant="contained" color="primary">
            Apply Line Items
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

