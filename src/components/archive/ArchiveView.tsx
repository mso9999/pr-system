/**
 * Archive PR View Component
 * Read-only view of an archived/legacy purchase request
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Divider,
  IconButton,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Link,
  Stack,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArchiveIcon from '@mui/icons-material/Archive';
import { ArchivePR } from '@/types/archive';
import { archiveService } from '@/services/archive';
import { formatCurrency } from '@/utils/formatters';
import { format } from 'date-fns';

export const ArchiveView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [archivePR, setArchivePR] = useState<ArchivePR | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadArchivePR = async () => {
      if (!id) {
        setError('No archive PR ID provided');
        setLoading(false);
        return;
      }

      console.log('[ArchiveView] Loading archive PR with ID:', id);
      setLoading(true);
      setError(null);
      try {
        console.log('[ArchiveView] Calling getArchivePRById...');
        const pr = await archiveService.getArchivePRById(id);
        console.log('[ArchiveView] Received PR data:', pr ? 'Found' : 'Not found');
        if (pr) {
          console.log('[ArchiveView] Setting archive PR, legacyResponses count:', pr.legacyResponses?.length || 0);
          setArchivePR(pr);
        } else {
          setError('Archive PR not found');
        }
      } catch (err) {
        console.error('[ArchiveView] Error loading archive PR:', err);
        setError(err instanceof Error ? err.message : 'Failed to load archive PR');
      } finally {
        console.log('[ArchiveView] Setting loading to false');
        setLoading(false);
      }
    };

    loadArchivePR();
  }, [id]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return format(date, 'MMM dd, yyyy HH:mm');
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
        <Typography variant="body2" sx={{ mt: 2 }}>
          Loading archive PR...
        </Typography>
      </Box>
    );
  }

  if (error || !archivePR) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          {error || 'Archive PR not found'}
          {id && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              ID: {id}
            </Typography>
          )}
        </Alert>
        <Box sx={{ mt: 2 }}>
          <IconButton onClick={() => navigate('/archive')}>
            <ArrowBackIcon /> Back to Archive
          </IconButton>
        </Box>
      </Box>
    );
  }

  const hasOperationalDetails = Boolean(
    archivePR.urgent ||
    archivePR.budgetApproval ||
    (archivePR.attachments && archivePR.attachments.length > 0) ||
    archivePR.otherInfo
  );

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <IconButton onClick={() => navigate('/archive')} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <ArchiveIcon sx={{ fontSize: 32, color: 'primary.main', mr: 2 }} />
          <Box>
            <Typography variant="h4" component="h1">
              Archived Purchase Request
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Read-only view of legacy purchase request
            </Typography>
          </Box>
        </Box>
        <Divider />
      </Paper>

      {/* Basic Information */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Basic Information
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">
                  Submitted Date
                </Typography>
                <Typography variant="body1">
                  {formatDate(archivePR.submittedDate)}
                </Typography>
              </Grid>
              
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">
                  Requestor
                </Typography>
                <Typography variant="body1">
                  {archivePR.requestorName || 'N/A'}
                </Typography>
                {archivePR.requestorEmail && (
                  <Typography variant="body2" color="text.secondary">
                    {archivePR.requestorEmail}
                  </Typography>
                )}
              </Grid>

              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">
                  Description
                </Typography>
                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                  {archivePR.description || 'N/A'}
                </Typography>
              </Grid>

              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">
                  Reason / Context
                </Typography>
                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                  {archivePR.reason || 'N/A'}
                </Typography>
              </Grid>

              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">
                  Organization
                </Typography>
                <Typography variant="body1">
                  1PWR LESOTHO
                </Typography>
              </Grid>

              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">
                  Department
                </Typography>
                <Typography variant="body1">
                  {archivePR.department || 'N/A'}
                </Typography>
              </Grid>

              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">
                  Site
                </Typography>
                <Typography variant="body1">
                  {archivePR.site || 'N/A'}
                </Typography>
              </Grid>

              {archivePR.entity && (
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Paying Entity
                  </Typography>
                  <Typography variant="body1">
                    {archivePR.entity}
                  </Typography>
                </Grid>
              )}

              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">
                  Project Category
                </Typography>
                <Typography variant="body1">
                  {archivePR.projectCategory || 'N/A'}
                </Typography>
              </Grid>

              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">
                  Expense Type
                </Typography>
                <Typography variant="body1">
                  {archivePR.expenseType || 'N/A'}
                </Typography>
              </Grid>

              {archivePR.vehicle && (
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Vehicle
                  </Typography>
                  <Typography variant="body1">
                    {archivePR.vehicle}
                  </Typography>
                </Grid>
              )}
            </Grid>
          </Paper>
        </Grid>

        {/* Financial Information */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Financial Information
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">
                  Amount
                </Typography>
                <Typography variant="h5" color="primary">
                  {archivePR.amount
                    ? formatCurrency(archivePR.amount, archivePR.currency || 'LSL')
                    : 'N/A'}
                </Typography>
              </Grid>

              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">
                  Currency
                </Typography>
                <Typography variant="body1">
                  {archivePR.currency || 'N/A'}
                </Typography>
              </Grid>

              {archivePR.requiredDate && (
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Required Date
                  </Typography>
                  <Typography variant="body1">
                    {formatDate(archivePR.requiredDate)}
                  </Typography>
                </Grid>
              )}

              {archivePR.paymentType && (
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">
                    Payment Type
                  </Typography>
                  <Typography variant="body1">
                    {archivePR.paymentType}
                  </Typography>
                </Grid>
              )}
            </Grid>
          </Paper>
        </Grid>

        {/* Vendor Information */}
        {(archivePR.vendorName || archivePR.vendor) && (
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Vendor Information
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="body1">
                {archivePR.vendorName || archivePR.vendor}
              </Typography>
              {archivePR.vendorCode && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  Vendor Code: {archivePR.vendorCode}
                </Typography>
              )}
            </Paper>
          </Grid>
        )}

        {/* Operational Details */}
        {hasOperationalDetails && (
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Operational Details
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={2}>
                {archivePR.urgent && (
                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" color="text.secondary">
                      Urgent Issue
                    </Typography>
                    <Typography variant="body1">
                      {archivePR.urgent}
                    </Typography>
                  </Grid>
                )}

                {archivePR.budgetApproval && (
                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" color="text.secondary">
                      Monthly Budget Approval
                    </Typography>
                    <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                      {archivePR.budgetApproval}
                    </Typography>
                  </Grid>
                )}

                {archivePR.otherInfo && (
                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary">
                      Additional Information
                    </Typography>
                    <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                      {archivePR.otherInfo}
                    </Typography>
                  </Grid>
                )}

                {archivePR.attachments?.length ? (
                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary">
                      Attachments / References
                    </Typography>
                    <Stack spacing={1} sx={{ mt: 1 }}>
                      {archivePR.attachments.map((attachment, index) => {
                        const isUrl = /^https?:\/\//i.test(attachment);
                        const label = attachment || `Attachment ${index + 1}`;
                        return isUrl ? (
                          <Link
                            key={`${attachment}-${index}`}
                            href={attachment}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {label}
                          </Link>
                        ) : (
                          <Typography
                            key={`${attachment}-${index}`}
                            variant="body1"
                            sx={{ wordBreak: 'break-word' }}
                          >
                            {label}
                          </Typography>
                        );
                      })}
                    </Stack>
                  </Grid>
                ) : null}
              </Grid>
            </Paper>
          </Grid>
        )}

        {/* Approver Information */}
        {archivePR.approver && (
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Approver
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="body1">
                {archivePR.approver}
              </Typography>
            </Paper>
          </Grid>
        )}


        {/* Import Metadata */}
        <Grid item xs={12}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="caption" color="text.secondary">
                Import Information
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                Imported: {formatDate(archivePR.importedAt)}
              </Typography>
              {archivePR.sourceFile && (
                <Typography variant="body2" color="text.secondary">
                  Source: {archivePR.sourceFile}
                </Typography>
              )}
              {archivePR.rowNumber && (
                <Typography variant="body2" color="text.secondary">
                  Original Row: {archivePR.rowNumber}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

