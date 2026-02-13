import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { Box, Paper, Typography, Grid, Button, Chip, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { PRRequest, Attachment } from '@/types/pr';
import { FileUploadManager } from '@/components/common/FileUploadManager';
import { QuoteList } from './QuoteList';

interface CompletedStatusViewProps {
  pr: PRRequest;
}

export const CompletedStatusView: React.FC<CompletedStatusViewProps> = ({ pr }) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  
  // State for file preview
  const [previewFile, setPreviewFile] = useState<{ name: string; url: string } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  
  // Helper: Normalize attachments to array
  const normalizeAttachments = (attachments?: Attachment | Attachment[]): Attachment[] => {
    if (!attachments) return [];
    return Array.isArray(attachments) ? attachments : [attachments];
  };

  // Calculate completion time
  const getCompletionStats = () => {
    if (!pr.createdAt || !pr.completedAt) return null;
    
    const created = new Date(pr.createdAt);
    const completed = new Date(pr.completedAt);
    const diffMs = completed.getTime() - created.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    return {
      createdDate: created.toLocaleDateString(),
      completedDate: completed.toLocaleDateString(),
      totalDays: diffDays
    };
  };

  const stats = getCompletionStats();
  
  // File preview handler
  const handleFilePreview = (attachment: { name: string; url: string }) => {
    setPreviewFile(attachment);
    setPreviewOpen(true);
  };

  // Download handler - opens in new tab to avoid CORS issues with Firebase Storage
  const handleDownloadQuoteAttachment = (attachment: { name: string; url: string }) => {
    const link = document.createElement('a');
    link.href = attachment.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.download = attachment.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    enqueueSnackbar('Downloading file...', { variant: 'info' });
  };

  return (
    <Box>
      <Paper elevation={2} sx={{ p: 3, mb: 3, bgcolor: 'success.light' }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          ✅ {t('pr.orderCompleted')}
        </Typography>
        
        {stats && (
          <Box sx={{ mt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Typography variant="body2" color="text.secondary">{t('pr.created')}</Typography>
                <Typography variant="body1" fontWeight="bold">{stats.createdDate}</Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="body2" color="text.secondary">{t('pr.completed')}</Typography>
                <Typography variant="body1" fontWeight="bold">{stats.completedDate}</Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="body2" color="text.secondary">{t('pr.totalTime')}</Typography>
                <Typography variant="body1" fontWeight="bold">{stats.totalDays} {t('pr.days')}</Typography>
              </Grid>
            </Grid>
          </Box>
        )}

        {pr.notes && (
          <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
            <Typography variant="subtitle2" gutterBottom>{t('pr.completionNotes')}:</Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{pr.notes}</Typography>
          </Box>
        )}
      </Paper>

      {/* Quotes Section - Read Only */}
      {pr.quotes && pr.quotes.length > 0 && (
        <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            💰 {t('pr.quotes')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {t('pr.quotesFromPreApprovedStages')}
          </Typography>
          <QuoteList
            quotes={pr.quotes}
            onEdit={() => {}} // Read-only, no edit
            onDelete={() => {}} // Read-only, no delete
            handleFilePreview={handleFilePreview}
            handleDownloadQuoteAttachment={handleDownloadQuoteAttachment}
            isEditing={false}
          />
        </Paper>
      )}

      {/* All Documents Section - Read Only */}
      <Paper elevation={2} sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          📎 {t('pr.allDocumentsReadOnly')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {t('pr.allDocumentsDesc')}
        </Typography>

        <Grid container spacing={3}>
          {/* APPROVED Status Documents */}
          <Grid item xs={12}>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom sx={{ borderBottom: 1, borderColor: 'divider', pb: 1 }}>
              📋 {t('pr.approvalStageDocuments')}
            </Typography>
          </Grid>

          {/* Proforma Invoice */}
          {normalizeAttachments(pr.proformaInvoice).length > 0 && (
            <Grid item xs={12} md={4}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>{t('pr.proformaInvoice')}</Typography>
                <FileUploadManager
                  label=""
                  files={normalizeAttachments(pr.proformaInvoice)}
                  onUpload={async () => {}} // Read-only
                  onDelete={async () => {}} // Read-only
                  uploading={false}
                  accept=""
                  helperText=""
                  disabled
                  readOnly
                />
              </Paper>
            </Grid>
          )}

          {/* Proof of Payment */}
          {normalizeAttachments(pr.proofOfPayment).length > 0 && (
            <Grid item xs={12} md={4}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>{t('pr.proofOfPayment')}</Typography>
                <FileUploadManager
                  label=""
                  files={normalizeAttachments(pr.proofOfPayment)}
                  onUpload={async () => {}} // Read-only
                  onDelete={async () => {}} // Read-only
                  uploading={false}
                  accept=""
                  helperText=""
                  disabled
                  readOnly
                />
              </Paper>
            </Grid>
          )}

          {/* PO Document */}
          {pr.poDocument && (
            <Grid item xs={12} md={4}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>{t('pr.purchaseOrderGenerated')}</Typography>
                <FileUploadManager
                  label=""
                  files={[pr.poDocument]}
                  onUpload={async () => {}} // Read-only
                  onDelete={async () => {}} // Read-only
                  uploading={false}
                  accept=""
                  helperText=""
                  disabled
                  readOnly
                />
              </Paper>
            </Grid>
          )}

          {/* ORDERED Status Documents */}
          {(normalizeAttachments(pr.deliveryNote).length > 0 || (pr.deliveryPhotos && pr.deliveryPhotos.length > 0)) && (
            <>
              <Grid item xs={12} sx={{ mt: 2 }}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom sx={{ borderBottom: 1, borderColor: 'divider', pb: 1 }}>
                  🚚 {t('pr.deliveryStageDocuments')}
                </Typography>
              </Grid>

              {/* Delivery Note */}
              {normalizeAttachments(pr.deliveryNote).length > 0 && (
                <Grid item xs={12} md={6}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>{t('pr.deliveryNote')}</Typography>
                    <FileUploadManager
                      label=""
                      files={normalizeAttachments(pr.deliveryNote)}
                      onUpload={async () => {}} // Read-only
                      onDelete={async () => {}} // Read-only
                      uploading={false}
                      accept=""
                      helperText=""
                      disabled
                      readOnly
                    />
                  </Paper>
                </Grid>
              )}

              {/* Delivery Photos */}
              {pr.deliveryPhotos && pr.deliveryPhotos.length > 0 && (
                <Grid item xs={12} md={6}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>{t('pr.deliveryPhotos')}</Typography>
                    <FileUploadManager
                      label=""
                      files={pr.deliveryPhotos}
                      onUpload={async () => {}} // Read-only
                      onDelete={async () => {}} // Read-only
                      uploading={false}
                      accept=""
                      helperText=""
                      disabled
                      readOnly
                    />
                  </Paper>
                </Grid>
              )}
            </>
          )}

          {/* No documents message */}
          {normalizeAttachments(pr.proformaInvoice).length === 0 &&
           normalizeAttachments(pr.proofOfPayment).length === 0 &&
           !pr.poDocument &&
           normalizeAttachments(pr.deliveryNote).length === 0 &&
           (!pr.deliveryPhotos || pr.deliveryPhotos.length === 0) && (
            <Grid item xs={12}>
              <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
                <Typography variant="body2">{t('pr.noDocumentsUploaded')}</Typography>
              </Box>
            </Grid>
          )}
        </Grid>
      </Paper>

      {/* File Preview Dialog */}
      <Dialog 
        open={previewOpen} 
        onClose={() => setPreviewOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>{previewFile?.name}</DialogTitle>
        <DialogContent>
          {previewFile && (
            previewFile.url.toLowerCase().endsWith('.pdf') ? (
              <embed src={previewFile.url} type="application/pdf" width="100%" height="600px" />
            ) : (
              <img src={previewFile.url} alt={previewFile.name} style={{ width: '100%', height: 'auto' }} />
            )
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewOpen(false)}>{t('common.close')}</Button>
          <Button 
            variant="contained" 
            startIcon={<DownloadIcon />}
            onClick={() => previewFile && handleDownloadQuoteAttachment(previewFile)}
          >
            {t('common.download')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

