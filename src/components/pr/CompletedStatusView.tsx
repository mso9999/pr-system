import React, { useState } from 'react';
import { Box, Paper, Typography, Grid, Button, Chip } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { PRRequest, Attachment } from '@/types/pr';
import { FileUploadManager } from '@/components/common/FileUploadManager';

interface CompletedStatusViewProps {
  pr: PRRequest;
}

export const CompletedStatusView: React.FC<CompletedStatusViewProps> = ({ pr }) => {
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

  return (
    <Box>
      <Paper elevation={2} sx={{ p: 3, mb: 3, bgcolor: 'success.light' }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          ✅ Order Completed
        </Typography>
        
        {stats && (
          <Box sx={{ mt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Typography variant="body2" color="text.secondary">Created</Typography>
                <Typography variant="body1" fontWeight="bold">{stats.createdDate}</Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="body2" color="text.secondary">Completed</Typography>
                <Typography variant="body1" fontWeight="bold">{stats.completedDate}</Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="body2" color="text.secondary">Total Time</Typography>
                <Typography variant="body1" fontWeight="bold">{stats.totalDays} days</Typography>
              </Grid>
            </Grid>
          </Box>
        )}

        {pr.notes && (
          <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
            <Typography variant="subtitle2" gutterBottom>Completion Notes:</Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{pr.notes}</Typography>
          </Box>
        )}
      </Paper>

      {/* All Documents Section - Read Only */}
      <Paper elevation={2} sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          📎 All Documents (Read-Only)
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          All documents uploaded throughout the order lifecycle
        </Typography>

        <Grid container spacing={3}>
          {/* APPROVED Status Documents */}
          <Grid item xs={12}>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom sx={{ borderBottom: 1, borderColor: 'divider', pb: 1 }}>
              📋 Approval Stage Documents
            </Typography>
          </Grid>

          {/* Proforma Invoice */}
          {normalizeAttachments(pr.proformaInvoice).length > 0 && (
            <Grid item xs={12} md={4}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>Proforma Invoice</Typography>
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
                <Typography variant="subtitle2" gutterBottom>Proof of Payment</Typography>
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
                <Typography variant="subtitle2" gutterBottom>Purchase Order (Generated)</Typography>
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
                  🚚 Delivery Stage Documents
                </Typography>
              </Grid>

              {/* Delivery Note */}
              {normalizeAttachments(pr.deliveryNote).length > 0 && (
                <Grid item xs={12} md={6}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>Delivery Note</Typography>
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
                    <Typography variant="subtitle2" gutterBottom>Delivery Photos</Typography>
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
                <Typography variant="body2">No documents were uploaded for this order</Typography>
              </Box>
            </Grid>
          )}
        </Grid>
      </Paper>
    </Box>
  );
};

