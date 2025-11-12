import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Divider,
  IconButton,
  Tooltip,
  TextField,
  Button,
  Chip,
  Alert,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormHelperText,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  CheckCircle as ApprovedIcon,
  Cancel as NotApprovedIcon,
  Star as HighValueIcon,
  Description as DocumentIcon,
} from '@mui/icons-material';
import { RootState } from '@/store';
import { referenceDataService } from '@/services/referenceData';
import { referenceDataAdminService } from '@/services/referenceDataAdmin';
import { prService } from '@/services/pr';
import { StorageService } from '@/services/storage';
import { ReferenceDataItem, VendorDocument } from '@/types/referenceData';
import { PRWithVendorRelationship } from '@/services/pr';
import { FileUploadManager } from '@/components/common/FileUploadManager';
import { formatCurrency } from '@/utils/formatters';

export const VendorView: React.FC = () => {
  const { vendorId } = useParams<{ vendorId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { enqueueSnackbar } = useSnackbar();
  const { t } = useTranslation();
  const currentUser = useSelector((state: RootState) => state.auth.user);

  const [vendor, setVendor] = useState<ReferenceDataItem | null>(null);
  const [editedVendor, setEditedVendor] = useState<Partial<ReferenceDataItem>>({});
  const [associatedPRs, setAssociatedPRs] = useState<PRWithVendorRelationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  // Approval dialogs
  const [approvalDialog, setApprovalDialog] = useState(false);
  const [deApprovalDialog, setDeApprovalDialog] = useState(false);
  const [justification, setJustification] = useState('');

  // Document category for new uploads
  const [selectedDocCategory, setSelectedDocCategory] = useState<VendorDocument['category']>('other');

  // Permission checks
  const canEdit = 
    currentUser?.permissionLevel === 1 || // Superadmin
    currentUser?.permissionLevel === 3 || // Procurement
    currentUser?.permissionLevel === 4;   // Finance/Admin
  
  const canView = 
    canEdit || 
    currentUser?.permissionLevel === 2;    // Approvers can view

  useEffect(() => {
    const isEditPath = location.pathname.endsWith('/edit');
    setIsEditMode(isEditPath && canEdit);
  }, [location.pathname, canEdit]);

  useEffect(() => {
    if (vendorId) {
      loadVendorData();
    }
  }, [vendorId]);

  const loadVendorData = async () => {
    if (!vendorId) return;

    try {
      setLoading(true);
      
      // Load vendor data
      const vendors = await referenceDataService.getItemsByType('vendors');
      const vendorData = vendors.find(v => v.id === vendorId);
      
      if (vendorData) {
        setVendor(vendorData);
        setEditedVendor(vendorData);
        
        // Load associated PRs/POs (includes all relationships: preferred, selected, quotes)
        try {
          const prs = await prService.getPRsByVendor(vendorId, vendorData.name);
          setAssociatedPRs(prs);
        } catch (error) {
          console.error('Error loading associated PRs:', error);
        }
      }
    } catch (error) {
      console.error('Error loading vendor data:', error);
      enqueueSnackbar('Failed to load vendor data', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    if (!canEdit) {
      enqueueSnackbar('You do not have permission to edit vendors', { variant: 'error' });
      return;
    }
    navigate(`/vendor/${vendorId}/edit`);
  };

  const handleCancelEdit = () => {
    navigate(`/vendor/${vendorId}`);
    setEditedVendor(vendor || {});
  };

  const handleSave = async () => {
    if (!vendor || !vendorId) return;

    // Validation
    if (!editedVendor.name?.trim()) {
      enqueueSnackbar('Vendor name is required', { variant: 'error' });
      return;
    }

    try {
      setSaving(true);
      await referenceDataAdminService.updateItem('vendors', vendorId, editedVendor);
      enqueueSnackbar('Vendor updated successfully', { variant: 'success' });
      navigate(`/vendor/${vendorId}`);
      await loadVendorData();
    } catch (error) {
      console.error('Error saving vendor:', error);
      enqueueSnackbar('Failed to save vendor', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleFieldChange = (field: string, value: any) => {
    setEditedVendor(prev => ({ ...prev, [field]: value }));
  };

  const handleDocumentUpload = async (files: File[]) => {
    if (!vendor || !vendorId || !currentUser) return;

    try {
      const uploadedDocs: VendorDocument[] = [];

      for (const file of files) {
        // Upload to Firebase Storage
        const uploadResult = await StorageService.uploadToTempStorage(file);
        
        // Move to permanent storage
        const permanentUrl = await StorageService.moveToPermanentStorage(
          uploadResult.path,
          `vendors/${vendorId}`,
          file.name
        );

        const newDoc: VendorDocument = {
          id: `${Date.now()}_${file.name}`,
          name: file.name,
          url: permanentUrl,
          size: file.size,
          type: file.type,
          category: selectedDocCategory,
          uploadedBy: currentUser.id,
          uploadedAt: new Date().toISOString(),
        };

        uploadedDocs.push(newDoc);
      }

      // Update vendor with new documents
      const existingDocs = vendor.documents || [];
      const updatedDocs = [...existingDocs, ...uploadedDocs];

      await referenceDataAdminService.updateItem('vendors', vendorId, {
        documents: updatedDocs,
      });

      enqueueSnackbar(`${uploadedDocs.length} document(s) uploaded successfully`, { variant: 'success' });
      await loadVendorData();
    } catch (error) {
      console.error('Error uploading documents:', error);
      enqueueSnackbar('Failed to upload documents', { variant: 'error' });
    }
  };

  const handleDocumentDelete = async (documentId: string) => {
    if (!vendor || !vendorId) return;

    try {
      const updatedDocs = (vendor.documents || []).filter(doc => doc.id !== documentId);
      
      await referenceDataAdminService.updateItem('vendors', vendorId, {
        documents: updatedDocs,
      });

      enqueueSnackbar('Document deleted successfully', { variant: 'success' });
      await loadVendorData();
    } catch (error) {
      console.error('Error deleting document:', error);
      enqueueSnackbar('Failed to delete document', { variant: 'error' });
    }
  };

  const handleApprove = async () => {
    if (!vendor || !vendorId) return;

    const needsJustification = !vendor.lastCompletedOrderDate || !vendor.last3QuoteProcessDate;

    if (needsJustification && !justification.trim()) {
      enqueueSnackbar('Justification required for manual vendor approval', { variant: 'error' });
      return;
    }

    try {
      const approvalExpiryDate = new Date();
      approvalExpiryDate.setMonth(approvalExpiryDate.getMonth() + 12);

      await referenceDataAdminService.updateItem('vendors', vendorId, {
        isApproved: true,
        approvalDate: new Date().toISOString(),
        approvalExpiryDate: approvalExpiryDate.toISOString(),
        approvalReason: 'manual',
        approvedBy: currentUser?.id,
        approvalNote: justification || 'Manually approved',
      });

      enqueueSnackbar('Vendor approved successfully', { variant: 'success' });
      setApprovalDialog(false);
      setJustification('');
      await loadVendorData();
    } catch (error) {
      console.error('Error approving vendor:', error);
      enqueueSnackbar('Failed to approve vendor', { variant: 'error' });
    }
  };

  const handleDeApprove = async () => {
    if (!vendor || !vendorId) return;

    if (!justification.trim()) {
      enqueueSnackbar('Justification required for de-approval', { variant: 'error' });
      return;
    }

    try {
      await referenceDataAdminService.updateItem('vendors', vendorId, {
        isApproved: false,
        approvalDate: undefined,
        approvalExpiryDate: undefined,
        approvalNote: `De-approved: ${justification}`,
      });

      enqueueSnackbar('Vendor de-approved successfully', { variant: 'success' });
      setDeApprovalDialog(false);
      setJustification('');
      await loadVendorData();
    } catch (error) {
      console.error('Error de-approving vendor:', error);
      enqueueSnackbar('Failed to de-approve vendor', { variant: 'error' });
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (!vendor) {
    return (
      <Box p={3}>
        <Typography color="error">Vendor not found</Typography>
        <Button startIcon={<BackIcon />} onClick={() => navigate('/admin')} sx={{ mt: 2 }}>
          Back to Admin
        </Button>
      </Box>
    );
  }

  if (!canView) {
    return (
      <Box p={3}>
        <Typography color="error">You do not have permission to view vendor details</Typography>
        <Button startIcon={<BackIcon />} onClick={() => navigate('/admin')} sx={{ mt: 2 }}>
          Back to Admin
        </Button>
      </Box>
    );
  }

  const displayVendor = isEditMode ? editedVendor : vendor;

  return (
    <Box p={3}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" gutterBottom>
            {vendor.name}
          </Typography>
          <Box display="flex" gap={1} alignItems="center">
            <Chip
              icon={vendor.isApproved ? <ApprovedIcon /> : <NotApprovedIcon />}
              label={vendor.isApproved ? t('pr.approved') : t('pr.notApproved')}
              color={vendor.isApproved ? 'success' : 'default'}
              size="small"
            />
            {vendor.isHighValue && (
              <Chip
                icon={<HighValueIcon />}
                label="High-Value Vendor"
                color="warning"
                size="small"
              />
            )}
          </Box>
        </Box>
        <Box display="flex" gap={1}>
          {isEditMode ? (
            <>
              <Button
                startIcon={<CancelIcon />}
                variant="outlined"
                onClick={handleCancelEdit}
                disabled={saving}
              >
                {t('common.cancel')}
              </Button>
              <Button
                startIcon={<SaveIcon />}
                variant="contained"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? t('common.saving') : t('common.save')}
              </Button>
            </>
          ) : (
            <>
              <Button
                startIcon={<BackIcon />}
                variant="outlined"
                onClick={() => navigate('/admin')}
              >
                {t('common.back')}
              </Button>
              {canEdit && (
                <Button
                  startIcon={<EditIcon />}
                  variant="contained"
                  onClick={handleEdit}
                >
                  {t('common.edit')}
                </Button>
              )}
            </>
          )}
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Vendor Information */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              {t('common.vendorInformation')}
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography variant="caption" color="textSecondary">
                  {t('common.name')} *
                </Typography>
                {isEditMode ? (
                  <TextField
                    fullWidth
                    value={displayVendor.name || ''}
                    onChange={(e) => handleFieldChange('name', e.target.value)}
                    required
                    size="small"
                  />
                ) : (
                  <Typography variant="body1">{vendor.name}</Typography>
                )}
              </Grid>

              <Grid item xs={12}>
                <Typography variant="caption" color="textSecondary">
                  {t('common.code')}
                </Typography>
                {isEditMode ? (
                  <TextField
                    fullWidth
                    value={displayVendor.code || ''}
                    onChange={(e) => handleFieldChange('code', e.target.value)}
                    size="small"
                  />
                ) : (
                  <Typography variant="body1">{vendor.code || 'N/A'}</Typography>
                )}
              </Grid>

              <Grid item xs={12}>
                <Typography variant="caption" color="textSecondary">
                  {t('common.email')}
                </Typography>
                {isEditMode ? (
                  <TextField
                    fullWidth
                    type="email"
                    value={displayVendor.contactEmail || ''}
                    onChange={(e) => handleFieldChange('contactEmail', e.target.value)}
                    size="small"
                  />
                ) : (
                  <Typography variant="body1">{vendor.contactEmail || 'N/A'}</Typography>
                )}
              </Grid>

              <Grid item xs={12}>
                <Typography variant="caption" color="textSecondary">
                  {t('common.phone')}
                </Typography>
                {isEditMode ? (
                  <TextField
                    fullWidth
                    value={displayVendor.contactPhone || ''}
                    onChange={(e) => handleFieldChange('contactPhone', e.target.value)}
                    size="small"
                  />
                ) : (
                  <Typography variant="body1">{vendor.contactPhone || 'N/A'}</Typography>
                )}
              </Grid>

              <Grid item xs={12}>
                <Typography variant="caption" color="textSecondary">
                  {t('common.website')}
                </Typography>
                {isEditMode ? (
                  <TextField
                    fullWidth
                    value={displayVendor.url || ''}
                    onChange={(e) => handleFieldChange('url', e.target.value)}
                    size="small"
                  />
                ) : (
                  <Typography variant="body1">{vendor.url || 'N/A'}</Typography>
                )}
              </Grid>

              <Grid item xs={12}>
                <Typography variant="caption" color="textSecondary">
                  {t('common.address')}
                </Typography>
                {isEditMode ? (
                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                    value={displayVendor.address || ''}
                    onChange={(e) => handleFieldChange('address', e.target.value)}
                    size="small"
                  />
                ) : (
                  <Typography variant="body1">{vendor.address || 'N/A'}</Typography>
                )}
              </Grid>

              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="textSecondary">
                  {t('common.city')}
                </Typography>
                {isEditMode ? (
                  <TextField
                    fullWidth
                    value={displayVendor.city || ''}
                    onChange={(e) => handleFieldChange('city', e.target.value)}
                    size="small"
                  />
                ) : (
                  <Typography variant="body1">{vendor.city || 'N/A'}</Typography>
                )}
              </Grid>

              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="textSecondary">
                  {t('common.country')}
                </Typography>
                {isEditMode ? (
                  <TextField
                    fullWidth
                    value={displayVendor.country || ''}
                    onChange={(e) => handleFieldChange('country', e.target.value)}
                    size="small"
                  />
                ) : (
                  <Typography variant="body1">{vendor.country || 'N/A'}</Typography>
                )}
              </Grid>

              <Grid item xs={12}>
                <Typography variant="caption" color="textSecondary">
                  {t('common.productsServices')}
                </Typography>
                {isEditMode ? (
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    value={displayVendor.productsServices || ''}
                    onChange={(e) => handleFieldChange('productsServices', e.target.value)}
                    size="small"
                  />
                ) : (
                  <Typography variant="body1">{vendor.productsServices || 'N/A'}</Typography>
                )}
              </Grid>

              <Grid item xs={12}>
                <Typography variant="caption" color="textSecondary">
                  {t('common.notes')}
                </Typography>
                {isEditMode ? (
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    value={displayVendor.notes || ''}
                    onChange={(e) => handleFieldChange('notes', e.target.value)}
                    size="small"
                  />
                ) : (
                  <Typography variant="body1">{vendor.notes || 'N/A'}</Typography>
                )}
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* Approval Status */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              {t('common.approvalStatus')}
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Box>
              {vendor.isApproved ? (
                <>
                  <Alert severity="success" sx={{ mb: 2 }}>
                    <Typography variant="body2" gutterBottom>
                      Vendor is currently approved
                    </Typography>
                    {vendor.approvalExpiryDate && (
                      <Typography variant="caption">
                        Expires: {new Date(vendor.approvalExpiryDate).toLocaleDateString()}
                      </Typography>
                    )}
                  </Alert>
                  
                  {vendor.approvalReason && (
                    <Box mb={2}>
                      <Typography variant="caption" color="textSecondary">Approval Type</Typography>
                      <Typography variant="body2">
                        {vendor.approvalReason === 'auto_3quote' ? '3-Quote Process Auto-Approval' :
                         vendor.approvalReason === 'auto_completed' ? 'Completed Order Auto-Approval' :
                         'Manual Approval'}
                      </Typography>
                    </Box>
                  )}
                  
                  {vendor.associatedPONumber && (
                    <Box mb={2}>
                      <Typography variant="caption" color="textSecondary">Associated PO</Typography>
                      <Typography variant="body2">{vendor.associatedPONumber}</Typography>
                    </Box>
                  )}
                  
                  {vendor.approvalNote && (
                    <Box mb={2}>
                      <Typography variant="caption" color="textSecondary">Notes</Typography>
                      <Typography variant="body2">{vendor.approvalNote}</Typography>
                    </Box>
                  )}

                  {canEdit && (
                    <Button
                      variant="outlined"
                      color="error"
                      onClick={() => setDeApprovalDialog(true)}
                      fullWidth
                    >
                      De-Approve Vendor
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    Vendor is not currently approved
                  </Alert>
                  
                  {canEdit && (
                    <Button
                      variant="contained"
                      color="success"
                      onClick={() => setApprovalDialog(true)}
                      fullWidth
                    >
                      Approve Vendor
                    </Button>
                  )}
                </>
              )}

              {vendor.lastCompletedOrderDate && (
                <Box mt={2}>
                  <Typography variant="caption" color="textSecondary">Last Completed Order</Typography>
                  <Typography variant="body2">
                    {new Date(vendor.lastCompletedOrderDate).toLocaleDateString()}
                  </Typography>
                </Box>
              )}

              {vendor.isHighValue && (
                <Alert severity="warning" icon={<HighValueIcon />} sx={{ mt: 2 }}>
                  <Typography variant="body2">
                    High-Value Vendor: Cumulative order value exceeds threshold
                  </Typography>
                  {vendor.cumulativeOrderValue && (
                    <Typography variant="caption">
                      Total: {formatCurrency(vendor.cumulativeOrderValue, 'USD')}
                    </Typography>
                  )}
                </Alert>
              )}
            </Box>
          </Paper>

          {/* Documents Section */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              <DocumentIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              {t('common.documents')}
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            {canEdit && (
              <Box mb={2}>
                <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                  <InputLabel>Document Category</InputLabel>
                  <Select
                    value={selectedDocCategory}
                    label="Document Category"
                    onChange={(e) => setSelectedDocCategory(e.target.value as VendorDocument['category'])}
                  >
                    <MenuItem value="incorporation">Incorporation Documents</MenuItem>
                    <MenuItem value="tax_certificate">Tax Certificate</MenuItem>
                    <MenuItem value="bank_letter">Bank Letter</MenuItem>
                    <MenuItem value="insurance">Insurance</MenuItem>
                    <MenuItem value="license">License/Permit</MenuItem>
                    <MenuItem value="other">Other</MenuItem>
                  </Select>
                  <FormHelperText>Select category before uploading</FormHelperText>
                </FormControl>

                <FileUploadManager
                  label="Upload Documents"
                  files={[]}
                  onUpload={handleDocumentUpload}
                  onDelete={async () => {}}
                  readOnly={false}
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                  helperText="Select a category above before uploading"
                />
              </Box>
            )}

            {vendor.documents && vendor.documents.length > 0 ? (
              <Box>
                {vendor.documents.map((doc) => (
                  <Card key={doc.id} variant="outlined" sx={{ mb: 1 }}>
                    <CardContent sx={{ py: 1.5 }}>
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Box flex={1}>
                          <Typography variant="body2" fontWeight="bold">
                            {doc.name}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            Category: {doc.category.replace('_', ' ')} | 
                            Uploaded: {new Date(doc.uploadedAt).toLocaleDateString()}
                          </Typography>
                        </Box>
                        <Box display="flex" gap={1}>
                          <Button
                            size="small"
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            View
                          </Button>
                          {canEdit && (
                            <Button
                              size="small"
                              color="error"
                              onClick={() => handleDocumentDelete(doc.id)}
                            >
                              Delete
                            </Button>
                          )}
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            ) : (
              <Typography variant="body2" color="textSecondary">
                No documents uploaded
              </Typography>
            )}
          </Paper>
        </Grid>

        {/* Associated PRs/POs Section */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Associated Purchase Requests/Orders
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            {associatedPRs.length > 0 ? (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>PR/PO Number</TableCell>
                      <TableCell>Organization</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Vendor Relationship</TableCell>
                      <TableCell align="right">Amount</TableCell>
                      <TableCell>Created Date</TableCell>
                      <TableCell>Requestor</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {associatedPRs.map((pr) => (
                      <TableRow 
                        key={pr.id} 
                        hover 
                        sx={{ cursor: 'pointer' }}
                        onClick={() => navigate(`/pr/${pr.id}`)}
                      >
                        <TableCell>{pr.prNumber}</TableCell>
                        <TableCell>{pr.organization}</TableCell>
                        <TableCell>{pr.description}</TableCell>
                        <TableCell>
                          <Chip label={pr.status} size="small" />
                        </TableCell>
                        <TableCell>
                          <Box display="flex" gap={0.5} flexWrap="wrap">
                            {pr.vendorRelationship.map((rel, idx) => (
                              <Chip
                                key={idx}
                                label={rel}
                                size="small"
                                color={
                                  rel === 'Selected Vendor' ? 'success' :
                                  rel === 'Preferred Vendor' ? 'primary' :
                                  'default'
                                }
                                variant="outlined"
                              />
                            ))}
                          </Box>
                        </TableCell>
                        <TableCell align="right">
                          {formatCurrency(pr.estimatedAmount || 0, pr.currency || 'USD')}
                        </TableCell>
                        <TableCell>
                          {new Date(pr.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {pr.requestor?.name || pr.requestor?.email || 'Unknown'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography variant="body2" color="textSecondary">
                No associated PRs/POs found for this vendor
              </Typography>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Approve Vendor Dialog */}
      <Dialog open={approvalDialog} onClose={() => setApprovalDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Approve Vendor</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" paragraph>
            Manually approve this vendor for 12 months
          </Typography>
          
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Justification"
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            placeholder="Provide justification for manual approval..."
            helperText="Required if vendor doesn't have recent successful order history"
            sx={{ mt: 2 }}
          />

          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="caption">
              Vendor will be approved for 12 months from today. Expiry will be tracked automatically.
            </Typography>
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApprovalDialog(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleApprove} variant="contained" color="success">
            Approve Vendor
          </Button>
        </DialogActions>
      </Dialog>

      {/* De-Approve Vendor Dialog */}
      <Dialog open={deApprovalDialog} onClose={() => setDeApprovalDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>De-Approve Vendor</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body2">
              This will remove the vendor's approved status. Justification is REQUIRED.
            </Typography>
          </Alert>
          
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Justification (Required)"
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            placeholder="E.g., Quality issues, compliance problems, better alternatives available..."
            required
            sx={{ mt: 2 }}
          />

          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="caption">
              This action will be permanently recorded in the vendor's audit trail.
            </Typography>
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeApprovalDialog(false)}>{t('common.cancel')}</Button>
          <Button 
            onClick={handleDeApprove} 
            variant="contained" 
            color="error"
            disabled={!justification.trim()}
          >
            De-Approve Vendor
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

