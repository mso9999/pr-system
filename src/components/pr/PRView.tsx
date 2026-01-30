import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useSnackbar } from "notistack";
import { useTranslation } from 'react-i18next';
import { useDropzone } from 'react-dropzone';
import { referenceDataService } from '@/services/referenceData';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Divider,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Button,
  Card,
  CardContent,
  CardHeader,
  Step,
  StepLabel,
  Stepper,
  Autocomplete,
  Chip,
} from '@mui/material';
import {
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableCell,
  TableRow,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import SaveIcon from '@mui/icons-material/Save';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import SendIcon from '@mui/icons-material/Send';
import StoreIcon from '@mui/icons-material/Store';
import { RootState } from '@/store';
import { prService } from '@/services/pr';
import { PRRequest, PRStatus, LineItem, Quote, Attachment, ApprovalHistoryItem, WorkflowHistoryItem, UserReference as User, PRUpdateParams } from '@/types/pr';
import { ReferenceDataItem } from '@/types/referenceData';
import { formatCurrency } from '@/utils/formatters';

// Helper to check if a string looks like a Firebase UID (should not be displayed)
const isUidLike = (value: string | undefined): boolean => {
  if (!value) return false;
  // Firebase UIDs are typically 20-28 alphanumeric characters with no spaces
  return /^[A-Za-z0-9]{20,28}$/.test(value);
};

// Helper to get displayable department (filters out UID-like values)
const getDisplayDepartment = (department: string | undefined): string => {
  if (!department || isUidLike(department)) return '';
  return department;
};
import mammoth from 'mammoth';
import { ProcurementActions } from './ProcurementActions';
import { QuoteForm } from './QuoteForm';
import { QuoteList } from './QuoteList';
// import { UserDebug } from '../debug/UserDebug';
// import { ForceUserRefresh } from '../debug/ForceUserRefresh';
import { Button as CustomButton } from '@/components/ui/button';
import { Card as CustomCard, CardContent as CustomCardContent, CardDescription, CardFooter, CardHeader as CustomCardHeader, CardTitle } from "@/components/ui/card";
import { PlusIcon, EyeIcon, FileIcon } from 'lucide-react';
import { QuoteCard } from './QuoteCard';
import { StorageService } from "@/services/storage";
import { CircularProgress, Chip, Alert, Accordion, AccordionSummary, AccordionDetails } from "@mui/material";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { db } from "@/config/firebase";
import { collection, doc, getDoc, query, where, getDocs, updateDoc } from "firebase/firestore";
import { QuotesStep } from './steps/QuotesStep';
import { notificationService } from '@/services/notification';
import { approverService } from '@/services/approver';
import * as auth from '@/services/auth';
import { ApproverActions } from './ApproverActions';
import { ApprovedStatusActions } from './ApprovedStatusActions';
import { OrderedStatusActions } from './OrderedStatusActions';
import { CompletedStatusView } from './CompletedStatusView';
import { ResurrectionActions } from './ResurrectionActions';
import { UrgencyControl } from './UrgencyControl';
import { ExternalApprovalBypass } from './ExternalApprovalBypass';
import { lazy, Suspense } from 'react';

const StatusProgressStepper = lazy(() => import('./StatusProgressStepper').then(module => ({ default: module.StatusProgressStepper })));
import { InQueueStatusActions } from './InQueueStatusActions';
import { VendorSelectionDialog } from '../common/VendorSelectionDialog';
import { useTheme } from '@mui/material/styles';
import { useMediaQuery } from '@mui/material';

interface EditablePRFields {
  department?: string;
  projectCategory?: string;
  sites?: string[];
  site?: string; // Legacy field for backward compatibility
  expenseType?: string;
  vehicle?: string;
  preferredVendor?: string;
  estimatedAmount?: number;
  currency?: string;
  requiredDate?: string;
  description?: string;
  approver?: string;
  paymentType?: string;
}

interface FileUploadProps {
  onFileSelect: (files: File[]) => void;
  maxFiles?: number;
}

interface UomOption {
  code: string;
  label: string;
}

interface ExtendedLineItem extends LineItem {
  unitPrice: number;
}

const FileUpload: React.FC<FileUploadProps> = ({ 
  onFileSelect,
  maxFiles = 5 
}) => {
  const acceptedTypes = {
    'application/pdf': ['.pdf'],
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'application/vnd.ms-excel': ['.xls'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
  };

  const { getRootProps, getInputProps, fileRejections } = useDropzone({
    onDrop: onFileSelect,
    accept: acceptedTypes,
    maxFiles,
    maxSize: 10485760, // 10MB
    validator: (file: File) => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      const validExts = Object.values(acceptedTypes).flat();
      if (!ext || !validExts.includes(`.${ext}`)) {
        return {
          code: 'invalid-file-type',
          message: `File type .${ext} is not supported`
        }
      }
      return null;
    }
  });

  return (
    <Box>
      <Box {...getRootProps()} sx={{
        border: '2px dashed #ccc',
        borderRadius: 2,
        p: 2,
        textAlign: 'center',
        cursor: 'pointer',
        '&:hover': {
          borderColor: 'primary.main'
        }
      }}>
        <input {...getInputProps()} />
        <Typography>
          Drag & drop files here, or click to select files
        </Typography>
        <Typography variant="caption" color="textSecondary">
          Supported formats: PDF, JPG, PNG, DOC, DOCX, XLS, XLSX (max 10MB)
        </Typography>
      </Box>
      {fileRejections.length > 0 && (
        <Box sx={{ mt: 1, color: 'error.main' }}>
        {fileRejections.map(({ file, errors }) => (
          <Typography key={file.name} variant="caption" component="div">
            {errors.map(e => e.message).join(', ')}
          </Typography>
        ))}
      </Box>
      )}
    </Box>
  );
};

const FilePreviewDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  file: { name: string; url: string; type: string };
}> = ({ open, onClose, file }) => {
  const { enqueueSnackbar } = useSnackbar();
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getFileType = (fileName: string): 'image' | 'pdf' | 'docx' | 'rtf' | 'text' | 'unsupported' => {
    const lowerFileName = fileName.toLowerCase();
    if (lowerFileName.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/)) return 'image';
    if (lowerFileName.endsWith('.pdf')) return 'pdf';
    if (lowerFileName.endsWith('.docx')) return 'docx';
    if (lowerFileName.endsWith('.rtf')) return 'rtf';
    if (lowerFileName.match(/\.(txt|md|log)$/)) return 'text';
    return 'unsupported';
  };

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);

    const fileType = getFileType(file.name);
    
    const fetchAndProcess = async () => {
      try {
        const response = await fetch(file.url);
        const blob = await response.blob();

        switch (fileType) {
          case 'text':
          case 'rtf':  
            const text = await blob.text();
            // For RTF, do thorough cleanup of RTF markup
            const cleanedText = fileType === 'rtf' 
              ? text
                  // Remove RTF header
                  .replace(/^[{]\\rtf[^}]+[}]/g, '')
                  // Remove font tables
                  .replace(/[{]\\fonttbl[^}]+[}]/g, '')
                  // Remove color tables
                  .replace(/[{]\\colortbl[^}]+[}]/g, '')
                  // Remove style sheets
                  .replace(/[{]\\stylesheet[^}]+[}]/g, '')
                  // Remove info groups
                  .replace(/[{]\\info[^}]+[}]/g, '')
                  // Remove Unicode character escapes
                  .replace(/\\u[0-9]+\s?/g, '')
                  // Remove special characters and control words
                  .replace(/\\[a-z]+[0-9]*/g, '')
                  // Remove numeric control sequences
                  .replace(/\\[0-9]+/g, '')
                  // Remove remaining braces
                  .replace(/[{}]/g, '')
                  // Fix line endings
                  .replace(/\\par\s*/g, '\n')
                  // Remove any remaining backslashes
                  .replace(/\\/g, '')
                  // Remove multiple spaces
                  .replace(/\s+/g, ' ')
                  // Remove multiple newlines
                  .replace(/\n+/g, '\n')
                  // Trim whitespace
                  .trim()
              : text;
            setContent(cleanedText);
            break;
          case 'docx':
            const arrayBuffer = await blob.arrayBuffer();
            const result = await mammoth.convertToHtml({ arrayBuffer });
            setContent(result.value);
            break;
        }
      } catch (err) {
        console.error('Error processing file:', err);
        setError('Failed to process file. You can try downloading it instead.');
        enqueueSnackbar('Error previewing file. You can try downloading it instead.', { 
          variant: 'error',
        });
      } finally {
        setLoading(false);
      }
    };

    if (['text', 'docx', 'rtf'].includes(fileType)) {
      fetchAndProcess();
    } else {
      setLoading(false);
    }
  }, [open, file.url]);

  const renderContent = () => {
    const fileType = getFileType(file.name);

    if (error) {
      return (
        <Box p={3} textAlign="center">
          <Typography color="error" gutterBottom>
            {error}
          </Typography>
          <Button
            variant="contained"
            onClick={() => {
              const link = document.createElement('a');
              link.href = file.url;
              link.setAttribute('download', file.name);
              document.body.appendChild(link);
              link.click();
              link.parentNode?.removeChild(link);
            }}
          >
            Download Instead
          </Button>
        </Box>
      );
    }

    switch (fileType) {
      case 'image':
        return (
          <Box display="flex" justifyContent="center" alignItems="center" p={2}>
            <img 
              src={file.url} 
              alt={file.name} 
              style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }}
            />
          </Box>
        );
      case 'pdf':
        return (
          <Box height="70vh" width="100%">
            <embed
              src={file.url}
              type="application/pdf"
              style={{ width: '100%', height: '100%' }}
              title="PDF Preview"
            />
          </Box>
        );
      case 'docx':
        return (
          <Box 
            sx={{ 
              p: 2,
              maxHeight: '70vh',
              overflow: 'auto',
              '& img': { maxWidth: '100%' }
            }}
            dangerouslySetInnerHTML={{ __html: content }}
          />
        );
      case 'rtf':
      case 'text':
        return (
          <Box 
            component="pre"
            sx={{ 
              p: 2,
              maxHeight: '70vh',
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              wordWrap: 'break-word',
              fontFamily: 'monospace'
            }}
          >
            {content}
          </Box>
        );
      default:
        return (
          <Box p={3} textAlign="center">
            <Typography gutterBottom>
              This file type cannot be previewed directly.
            </Typography>
            <Button
              variant="contained"
              onClick={() => {
                const link = document.createElement('a');
                link.href = file.url;
                link.setAttribute('download', file.name);
                document.body.appendChild(link);
                link.click();
                link.parentNode?.removeChild(link);
              }}
            >
              Download File
            </Button>
          </Box>
        );
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { minHeight: '80vh' }
      }}
    >
      <DialogTitle>
        {file.name}
      </DialogTitle>
      <DialogContent>
        {loading ? (
          <Box display="flex" justifyContent="center" p={3}>
            <CircularProgress />
          </Box>
        ) : (
          renderContent()
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <Button
          variant="contained"
          onClick={() => {
            const link = document.createElement('a');
            link.href = file.url;
            link.setAttribute('download', file.name);
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);
          }}
        >
          Download
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const UOM_MAPPING = {
  'EA': 'Each',
  'PCS': 'Pieces',
  'KG': 'Kilogram',
  'BOX': 'Box',
  'PK': 'Pack',
  'SET': 'Set',
  'M': 'Meter',
  'L': 'Liter',
  'HR': 'Hour',
  'DAY': 'Day',
  'WK': 'Week',
  'MTH': 'Month',
  'YR': 'Year',
  'SVC': 'Service',
  'JOB': 'Job',
  'UNIT': 'Unit',
  'OTH': 'Other'
} as const;

const UOM_OPTIONS: UomOption[] = Object.entries(UOM_MAPPING).map(([code, label]) => ({
  code,
  label
}));

export function PRView() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));
  const isEditMode = location.pathname.endsWith('/edit');
  const [pr, setPr] = useState<PRRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editedPR, setEditedPR] = useState<Partial<PRRequest>>({});
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [lineItems, setLineItems] = useState<Array<ExtendedLineItem>>([]);
  const currentUser = useSelector((state: RootState) => state.auth.user);
  const isProcurement = currentUser?.permissionLevel === 3; // Level 3 = Procurement Officer
  const isAdmin = currentUser?.permissionLevel === 1 || currentUser?.role === 'admin'; // Level 1 = Admin
  const isRequestor = pr?.requestorEmail?.toLowerCase() === currentUser?.email?.toLowerCase();
  const isDesignatedApprover = currentUser?.id === pr?.approver || currentUser?.id === pr?.approvalWorkflow?.currentApprover;
  const bulkImportAllowedStatuses = new Set<PRStatus>([
    PRStatus.IN_QUEUE,
    PRStatus.PENDING_APPROVAL,
    PRStatus.APPROVED,
  ]);
  const canShowBulkImportTools =
    Boolean((isProcurement || isAdmin) && pr?.status && bulkImportAllowedStatuses.has(pr.status as PRStatus));
  const canProcessPR = isProcurement || isAdmin || (isRequestor && (
    pr?.status === PRStatus.IN_QUEUE ||
    pr?.status === PRStatus.SUBMITTED ||
    pr?.status === PRStatus.RESUBMITTED ||
    pr?.status === PRStatus.REVISION_REQUIRED
  ));
  const canEditInCurrentStatus = pr?.status === PRStatus.SUBMITTED || 
    pr?.status === PRStatus.RESUBMITTED ||
    (isRequestor && pr?.status === PRStatus.REVISION_REQUIRED);
  const [previewFile, setPreviewFile] = useState<{ name: string; url: string; type: string } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [departments, setDepartments] = useState<ReferenceDataItem[]>([]);
  const [paymentTypes, setPaymentTypes] = useState<ReferenceDataItem[]>([]);
  const [projectCategories, setProjectCategories] = useState<ReferenceDataItem[]>([]);
  const [sites, setSites] = useState<ReferenceDataItem[]>([]);
  const [expenseTypes, setExpenseTypes] = useState<ReferenceDataItem[]>([]);
  const [vehicles, setVehicles] = useState<ReferenceDataItem[]>([]);
  const [vendors, setVendors] = useState<ReferenceDataItem[]>([]);
  const [currencies, setCurrencies] = useState<ReferenceDataItem[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [loadingReference, setLoadingReference] = useState(true);
  const [approvers, setApprovers] = useState<User[]>([]);
  const [selectedApprover, setSelectedApprover] = useState<string | undefined>(
    pr?.approver || pr?.approvalWorkflow?.currentApprover || undefined
  );
  const [selectedApprover2, setSelectedApprover2] = useState<string | undefined>(
    pr?.approver2 || pr?.approvalWorkflow?.secondApprover || undefined
  );
  const [vendorDialogOpen, setVendorDialogOpen] = useState(false);
  const [loadingApprovers, setLoadingApprovers] = useState(false);
  const [currentApprover, setCurrentApprover] = useState<User | null>(null);
  const [isLoadingApprover, setIsLoadingApprover] = useState(false);
  const [assignedApprover, setAssignedApprover] = useState<User | null>(null);
  const { enqueueSnackbar } = useSnackbar();
  const [isExitingEditMode, setIsExitingEditMode] = React.useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);
  const [approverAmountError, setApproverAmountError] = React.useState<string | null>(null);
  const [showRuleOverrideDialog, setShowRuleOverrideDialog] = React.useState(false);
  const [ruleOverrideJustification, setRuleOverrideJustification] = React.useState('');
  const [currentTime, setCurrentTime] = React.useState(Date.now());
  const [userNameCache, setUserNameCache] = React.useState<Record<string, string>>({});

  // Fetch PR data
  const fetchPR = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const prData = await prService.getPR(id);

      if (!prData) {
        setError('PR not found');
        return;
      }

      // Initialize approval workflow if missing
      if (!prData.approvalWorkflow) {
        prData.approvalWorkflow = {
          currentApprover: prData.approver || prData.approvers?.[0] || undefined,
          approvalHistory: [],
          lastUpdated: new Date().toISOString()
        }
      }

      setPr(prData);

      // Load requestor details if not already loaded
      if (prData.requestorId && (!prData.requestor || !prData.requestor.organization)) {
        try {
          const requestorData = await auth.getUserDetails(prData.requestorId);
          
          // Update PR with requestor data
          setPr(prev => prev ? ({
            ...prev,
            requestor: requestorData,
            // Preserve existing organization label; only fall back to requestor data if missing
            organization: prev.organization || requestorData.organization || prev.organization
          }) : prev);
        } catch (error) {
          console.error('Error loading requestor details:', error);
        }
      }

      try {
        // Get organization from PR or requestor
        const organization = prData.organization || prData.requestor?.organization;

        if (!organization) {
          console.error('No organization found in PR data or requestor data');
          throw new Error('No organization found');
        }

        // Load approvers first
        const approverList = await approverService.getApprovers(organization);
        setApprovers(approverList);

        // Set initial selected approver if present
        if (prData.approvalWorkflow?.currentApprover) {
          const currentApprover = approverList.find(a => a.id === prData.approvalWorkflow?.currentApprover);
          if (currentApprover) {
            setSelectedApprover(currentApprover.id);
          }
        }

        // Load reference data
        const [
          depts,
          categories,
          siteList,
          expenses,
          vehicleList,
          vendorList,
          currencyList,
          paymentTypeList,
          rulesList,
        ] = await Promise.all([
          referenceDataService.getDepartments(organization),
          referenceDataService.getItemsByType('projectCategories', organization),
          referenceDataService.getItemsByType('sites', organization),
          referenceDataService.getItemsByType('expenseTypes', organization),
          referenceDataService.getItemsByType('vehicles', organization),
          referenceDataService.getItemsByType('vendors'),
          referenceDataService.getItemsByType('currencies'),
          referenceDataService.getItemsByType('paymentTypes'),
          referenceDataService.getItemsByType('rules', organization),
        ]);

        setDepartments(depts);
        setProjectCategories(categories);
        setSites(siteList);
        setExpenseTypes(expenses);
        setVehicles(vehicleList);
        setVendors(vendorList);
        setCurrencies(currencyList);
        setPaymentTypes(paymentTypeList);
        setRules(rulesList);
        
        console.log('💳 Payment Types loaded from reference data:', {
          count: paymentTypeList.length,
          items: paymentTypeList.map(pt => ({ id: pt.id, name: pt.name, code: pt.code, active: pt.isActive }))
        });
      } catch (error) {
        console.error('Error loading reference data:', error);
        enqueueSnackbar('Error loading reference data', { variant: 'error' });
      }
    } catch (error) {
      console.error('Error fetching PR:', error);
      setError('Error fetching PR');
    } finally {
      setLoading(false);
      setLoadingReference(false);
    }
  };

  // Helper function to get user name from user ID
  const getUserName = React.useCallback(async (userId: string | undefined): Promise<string> => {
    if (!userId) return 'Unknown User';
    
    // Check cache first
    if (userNameCache[userId]) {
      return userNameCache[userId];
    }
    
    try {
      const userData = await auth.getUserDetails(userId);
      const userName = userData?.name || `${userData?.firstName || ''} ${userData?.lastName || ''}`.trim() || userData?.email || userId;
      setUserNameCache(prev => ({ ...prev, [userId]: userName }));
      return userName;
    } catch (error) {
      console.error('Error fetching user details:', error);
      return userId; // Fallback to user ID if fetch fails
    }
  }, []);

  // Load user names for all override fields when PR is loaded
  React.useEffect(() => {
    if (!pr) return;
    
    const loadOverrideUserNames = async () => {
      const userIds = [
        pr.quoteRequirementOverrideBy,
        pr.proformaOverrideBy,
        pr.popOverrideBy,
        pr.poDocumentOverrideBy,
        pr.finalPriceVarianceOverrideBy
      ].filter(Boolean) as string[];
      
      for (const userId of userIds) {
        if (!userNameCache[userId]) {
          await getUserName(userId);
        }
      }
    };
    
    loadOverrideUserNames();
  }, [pr, getUserName]);

  // Function to refresh PR data
  const refreshPR = async () => {
    try {
      setLoading(true);
      await fetchPR();
    } catch (error) {
      console.error('Error refreshing PR:', error);
      enqueueSnackbar('Error refreshing PR data', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchPR();
  }, [id]);

  useEffect(() => {
    if (pr?.lineItems) {
      // Ensure each line item has an ID
      const itemsWithIds = pr.lineItems.map(item => ({
        ...item,
        id: item.id || crypto.randomUUID(),
        unitPrice: item.unitPrice || 0
      }));
      
      // Log line items with attachment info for debugging
      console.log(`📋 Loaded ${itemsWithIds.length} line items for PR ${pr.id}:`, {
        itemsWithAttachments: itemsWithIds.filter(i => i.attachments && i.attachments.length > 0).length,
        itemsWithFileLinks: itemsWithIds.filter(i => i.fileLink).length,
        sampleItemWithAttachments: itemsWithIds.find(i => i.attachments && i.attachments.length > 0),
        allItems: itemsWithIds.map(i => ({
          description: i.description,
          attachmentCount: i.attachments?.length || 0,
          fileLink: i.fileLink,
          isFolder: i.isFolder
        }))
      });
      
      setLineItems(itemsWithIds);
    }
  }, [pr?.lineItems]);

  // Update current time every minute for elapsed time clock
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!pr?.organization) {
      return;
    }

    let mounted = true;
    const loadApprovers = async () => {
      try {
        setLoadingApprovers(true);
        const approverList = await approverService.getApprovers(pr.organization);
        
        if (!mounted) return;

        setApprovers(approverList);

        // Set initial selected approver if present
        if (pr.approvalWorkflow?.currentApprover) {
          const currentApprover = approverList.find(a => a.id === pr.approvalWorkflow?.currentApprover);
          if (currentApprover) {
            setSelectedApprover(currentApprover.id);
          }
        }
      } catch (error) {
        console.error('Error loading approvers:', error);
        if (mounted) {
          setApprovers([]);
        }
      } finally {
        if (mounted) {
          setLoadingApprovers(false);
        }
      }
    };

    loadApprovers();
    return () => {
      mounted = false;
    };
  }, [pr?.organization, pr?.approver, pr?.approvalWorkflow]);

  useEffect(() => {
    const loadCurrentApprover = async () => {
      // Check pr.approver first, then legacy approvers array, then workflow
      const approverId = pr?.approver || pr?.approvers?.[0] || pr?.approvalWorkflow?.currentApprover;
      const approver2Id = pr?.approver2 || pr?.approvers?.[1] || pr?.approvalWorkflow?.secondApprover;
      
      // Update selectedApprover state for the edit form
      setSelectedApprover(approverId || undefined);
      setSelectedApprover2(approver2Id || undefined);
      
      if (approverId) {
        try {
          setIsLoadingApprover(true);
          const user = await auth.getUserDetails(approverId);
          if (user) {
            setAssignedApprover(user);
            // Also set currentApprover for consistency
            setCurrentApprover(user);
          }
          setIsLoadingApprover(false);
        } catch (error) {
          console.error('Error fetching approver details:', error);
          setIsLoadingApprover(false);
        }
      } else {
        setIsLoadingApprover(false);
      }
    };

    loadCurrentApprover();
  }, [pr?.approvalWorkflow?.currentApprover, pr?.approvalWorkflow?.secondApprover, pr?.approver, pr?.approver2]);

  const handleAddLineItem = (): void => {
    const newItem: ExtendedLineItem = {
      id: crypto.randomUUID(),
      description: '',
      quantity: 1,
      uom: '',
      unitPrice: 0,
      notes: '',
      attachments: []
    };

    setLineItems(prevItems => [...prevItems, newItem]);
  };

  const handleUpdateLineItem = (index: number, updatedItem: ExtendedLineItem): void => {
    setLineItems(prevItems => 
      prevItems.map((item, i) => 
        i === index ? { 
          ...item, 
          ...updatedItem
        } : item
      )
    );
  };

  const handleDeleteLineItem = (index: number): void => {
    setLineItems(prevItems => prevItems.filter((_, i) => i !== index));
  };

  // Add file upload handler for line items
  const handleLineItemFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, index: number) => {
    if (!event.target.files || event.target.files.length === 0) return;
    
    const file = event.target.files[0];
    setLoading(true);
    
    try {
      // Use the available uploadToTempStorage method instead of uploadFile
      const result = await StorageService.uploadToTempStorage(file);
      
      setLineItems(prevItems => prevItems.map((item, i) => {
        if (i === index) {
          return {
            ...item,
            attachments: [
              ...(item.attachments || []),
              {
                id: crypto.randomUUID(),
                name: file.name,
                url: result.url,
                path: result.path,
                type: file.type,
                size: file.size,
                uploadedAt: new Date().toISOString(),
                uploadedBy: currentUser ? { ...currentUser } as User : { 
                  id: 'unknown',
                  email: 'unknown',
                  displayName: 'Unknown User',
                  permissionLevel: 1
                }
              }
            ]
          };
        }
        return item;
      }));
      
      enqueueSnackbar('File uploaded successfully', { variant: 'success' });
    } catch (error) {
      console.error('Error uploading file:', error);
      enqueueSnackbar('Failed to upload file', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Remove attachment from line item
  const handleRemoveLineItemAttachment = (lineItemIndex: number, attachmentIndex: number) => {
    setLineItems(prev => prev.map((item, i) => 
      i === lineItemIndex ? {
        ...item,
        attachments: (item.attachments || []).filter((_, j) => j !== attachmentIndex)
      } : item
    ));
  };

  // Helper function to normalize sites (handle backward compatibility)
  const normalizeSites = (pr: PRRequest | null): string[] => {
    if (!pr) return [];
    if (pr.sites && pr.sites.length > 0) return pr.sites;
    if (pr.site) return [pr.site];
    return [];
  };

  // Initialize editedPR when entering edit mode
  useEffect(() => {
    if (isEditMode && pr) {
      setEditedPR({
        description: pr.description,
        department: pr.department,
        projectCategory: pr.projectCategory,
        sites: normalizeSites(pr),
        expenseType: pr.expenseType,
        vehicle: pr.vehicle,
        estimatedAmount: pr.estimatedAmount,
        currency: pr.currency,
        requiredDate: pr.requiredDate,
        preferredVendor: pr.preferredVendor,
        comments: pr.comments,
        approver: pr.approver,
        paymentType: pr.paymentType,
      });
    } else {
      setEditedPR({});
    }
  }, [isEditMode, pr]);

  const canEdit = currentUser?.permissionLevel === 1 || // Admin
    (pr?.status === PRStatus.REVISION_REQUIRED && pr?.requestor?.id === currentUser?.id) || // Requestor in REVISION_REQUIRED
    (pr?.status !== PRStatus.REVISION_REQUIRED && currentUser?.permissionLevel <= 3); // Others for non-REVISION_REQUIRED
  const canEditInQueue = pr?.status === PRStatus.IN_QUEUE && (currentUser?.permissionLevel === 1 || currentUser?.permissionLevel === 3);
  
  // Determine who can edit Project Category and Expense Type based on status
  const canEditFinancialFields = (() => {
    // In REVISION_REQUIRED status: ONLY requestor (or superadmin) can edit
    if (pr?.status === 'REVISION_REQUIRED') {
      return currentUser?.permissionLevel === 1 || currentUser?.id === pr?.requestorId;
    }
    // In COMPLETED status: Only Finance/Admin (Level 4) or Admin (Level 1) - finalization phase
    if (pr?.status === 'COMPLETED') {
      return currentUser?.permissionLevel === 1 || currentUser?.permissionLevel === 4;
    }
    // In all other statuses (SUBMITTED through ORDERED): Procurement (L3), Finance/Admin (L4), or Admin (L1)
    return currentUser?.permissionLevel === 1 || currentUser?.permissionLevel === 3 || currentUser?.permissionLevel === 4;
  })();
  
  const isReadOnlyField = (fieldName: string) => {
    if (!canEditInQueue) return true;
    // Canonical fields that cannot be edited by procurement
    if (['urgency', 'requestor', 'requiredDate'].includes(fieldName)) return true;
    // Financial fields permission depends on status (see canEditFinancialFields logic above)
    if (['projectCategory', 'expenseType'].includes(fieldName) && !canEditFinancialFields) return true;
    return false;
  };

  // Fields that are locked once PR reaches APPROVED status (PO phase)
  const isLockedInApprovedStatus = (fieldName: string) => {
    // Only lock these fields in APPROVED and later statuses (not in PENDING_APPROVAL)
    if (!pr?.status || !['APPROVED', 'ORDERED', 'COMPLETED'].includes(pr.status)) {
      return false;
    }
    // Vendor, amount, and approver cannot be changed in APPROVED/ORDERED/COMPLETED
    return ['preferredVendor', 'estimatedAmount', 'currency', 'approver'].includes(fieldName);
  };

  const handleQuoteSubmit = async (quoteData: Quote) => {
    try {
      const updatedQuotes = selectedQuote
        ? pr?.quotes?.map(q => q.id === selectedQuote.id ? quoteData : q) || []
        : [...(pr?.quotes || []), quoteData];

      await prService.updatePR(id!, { quotes: updatedQuotes });
      
      setPr(prev => prev ? {
        ...prev,
        quotes: updatedQuotes
      } : null);
      
      setSelectedQuote(null);
      enqueueSnackbar('Quote saved successfully', { variant: 'success' });
    } catch (error) {
      console.error('Error saving quote:', error);
      enqueueSnackbar('Failed to save quote', { variant: 'error' });
    }
  };

  const handleEditQuote = (quote: Quote) => {
    setSelectedQuote(quote);
  };

  const handleDeleteQuote = async (quoteId: string) => {
    try {
      const updatedQuotes = pr?.quotes?.filter(q => q.id !== quoteId) || [];
      await prService.updatePR(id!, { quotes: updatedQuotes });
      
      setPr(prev => prev ? {
        ...prev,
        quotes: updatedQuotes
      } : null);
      
      enqueueSnackbar('Quote deleted successfully', { variant: 'success' });
    } catch (error) {
      console.error('Error deleting quote:', error);
      enqueueSnackbar('Failed to delete quote', { variant: 'error' });
    }
  };

  const handleFieldChange = (field: keyof EditablePRFields, value: string | number | string[]) => {
    // Special handling for expense type changes
    if (field === 'expenseType') {
      const selectedType = expenseTypes.find(type => type.id === value);
      const isVehicleExpense = selectedType?.name.toLowerCase() === 'vehicle';

      setEditedPR(prev => {
        if (!isVehicleExpense) {
          // Remove vehicle field for non-vehicle expense types
          const { vehicle, ...rest } = prev;
          return { ...rest, [field]: value };
        } else {
          // Keep vehicle field for vehicle expense type
          return {
            ...prev,
            [field]: value,
            vehicle: prev.vehicle || pr?.vehicle
          };
        }
      });
    } else {
      setEditedPR(prev => ({
        ...prev,
        [field]: value
      }));
    }

    setHasUnsavedChanges(true);
    
    // Trigger validation if amount changes
    // Note: Don't validate on 'approver' change here because handleApproverChange already does it
    if (field === 'estimatedAmount') {
      setTimeout(() => {
        const error = validateApproverAmount();
        setApproverAmountError(error);
      }, 100);
    }
  };

  const validateApproverAmount = (): string | null => {
    // Don't validate if rules haven't loaded yet - show warning instead
    if (!rules || rules.length === 0) {
      console.warn('Rules not loaded yet - validation skipped');
      return null;
    }

    const currentAmount = editedPR.estimatedAmount || pr?.estimatedAmount;
    const currentApprover = selectedApprover || editedPR.approver || pr?.approver;

    // If we have both amount and approver, we MUST validate
    if (!currentAmount || !currentApprover) {
      return null;
    }

    const amount = typeof currentAmount === 'string' 
      ? parseFloat(currentAmount) 
      : currentAmount;

    if (isNaN(amount) || amount <= 0) {
      return null;
    }
    
    console.log('Validating approver-amount combination:', { 
      amount, 
      approverId: currentApprover, 
      rulesCount: rules.length,
      approversCount: approvers.length
    });

    // Debug: Log all rules to see their structure
    console.log('All rules in array:', rules.map(r => ({ 
      id: r.id, 
      name: r.name, 
      number: r.number, 
      ruleNumber: r.ruleNumber,
      threshold: r.threshold,
      currency: r.currency,
      description: r.description,
      allFields: Object.keys(r)
    })));
    
    // Try multiple ways to find Rule 1 (flexible lookup)
    const rule1 = rules.find((rule: any) => 
      rule.number === 1 || 
      rule.number === '1' ||
      rule.ruleNumber === 1 ||
      rule.ruleNumber === '1' ||
      rule.name === 'Rule 1' ||
      rule.id === 'rule_1' ||
      rule.description?.toLowerCase().includes('first approval threshold')
    );
    
    // Try multiple ways to find Rule 2 (flexible lookup)
    const rule2 = rules.find((rule: any) => 
      rule.number === 2 || 
      rule.number === '2' ||
      rule.ruleNumber === 2 ||
      rule.ruleNumber === '2' ||
      rule.name === 'Rule 2' ||
      rule.id === 'rule_2' ||
      rule.description?.toLowerCase().includes('second approval threshold')
    );

    console.log('Rules found:', { 
      rule1: rule1 ? { name: rule1.name, threshold: rule1.threshold, currency: rule1.currency } : null,
      rule2: rule2 ? { name: rule2.name, threshold: rule2.threshold, currency: rule2.currency } : null
    });

    // CRITICAL: If Rule 1 is not found, we CANNOT validate - must fail
    if (!rule1) {
      console.error('VALIDATION ERROR: Rule 1 not found in rules list. Cannot validate approver-amount combination.', {
        rulesCount: rules.length,
        rulesInList: rules.map(r => r.name || r.id)
      });
      return 'Cannot validate approver permissions. Approval rules not properly configured. Please contact system administrator.';
    }

    const isAboveRule1Threshold = rule1 && amount > rule1.threshold;
    
    console.log('Threshold checks:', { 
      isAboveRule1Threshold,
      rule1Threshold: rule1?.threshold,
      note: 'Rule 2 is a multiplier, not a threshold'
    });

    // Find the approver in the approvers list
    const approver = approvers.find(a => a.id === currentApprover);
    
    console.log('Approver lookup:', {
      searchingFor: currentApprover,
      found: !!approver,
      approverName: approver?.name,
      approverPermissionLevel: approver?.permissionLevel,
      totalApproversInList: approvers.length
    });
    
    if (!approver) {
      console.error('VALIDATION ERROR: Approver not found in approvers list', {
        approverId: currentApprover,
        availableApprovers: approvers.map(a => ({ id: a.id, name: a.name, level: a.permissionLevel }))
      });
      return `Cannot validate approver. The selected approver may have been removed or permissions changed. Please select a valid approver.`;
    }

    const permissionLevel = parseInt(approver.permissionLevel);
    console.log('Approver permission level:', { 
      approverName: approver.name, 
      permissionLevel,
      permissionLevelType: typeof approver.permissionLevel
    });
    
    // Level 1 and 2 can approve any amount
    if (permissionLevel === 1 || permissionLevel === 2) {
      console.log('Validation PASSED: Level 1 or 2 approver can approve any amount');
      return null;
    }
    
    // Level 6 (Finance Approvers) and Level 4 (Finance Admin) can only approve up to Rule 1 threshold
    if (permissionLevel === 6 || permissionLevel === 4) {
      console.log(`Checking Level ${permissionLevel} approver against Rule 1 threshold`);
      if (isAboveRule1Threshold && rule1) {
        console.error(`Validation FAILED: Level ${permissionLevel} cannot approve above Rule 1 threshold`, {
          amount,
          rule1Threshold: rule1.threshold,
          approverName: approver.name
        });
        return `Selected approver (${approver.name}) cannot approve amounts above ${rule1.threshold} ${rule1.currency}. Only Level 1 or 2 approvers can approve this amount.`;
      }
      console.log(`Validation PASSED: Level ${permissionLevel} approver within Rule 1 threshold`);
      return null;
    }
    
    // Levels 3 and 5 should not be approvers at all
    if (permissionLevel === 3 || permissionLevel === 5) {
      console.error(`Validation FAILED: Level ${permissionLevel} cannot be an approver`, {
        approverName: approver.name,
        permissionLevel
      });
      return `User ${approver.name} (Permission Level ${permissionLevel}) cannot be assigned as an approver. Only Level 1, 2, 4, or 6 users can approve PRs.`;
    }
    
    // If we get here, it's an unknown permission level - fail validation
    console.warn('Validation: Unknown permission level', { permissionLevel, approverName: approver.name });
    console.log('Validation PASSED by default (unknown permission level)');
    return null;
  };

  const handleApproverChange = (approverId: string) => {
    console.log('Approver changed to:', approverId);
    setSelectedApprover(approverId || undefined);
    handleFieldChange('approver', approverId);
    
    // Note: Validation is handled by useEffect when selectedApprover changes
    // No need to manually trigger validation here
  };

  const handleApprover2Change = (approverId: string) => {
    console.log('Second approver changed to:', approverId);
    setSelectedApprover2(approverId || undefined);
    handleFieldChange('approver2', approverId);
  };
  
  // Auto-validate whenever approver or amount changes
  useEffect(() => {
    // Only validate when rules are loaded and we're in edit mode
    if (rules.length > 0 && (selectedApprover || editedPR.estimatedAmount)) {
      const error = validateApproverAmount();
      setApproverAmountError(error);
      
      if (error) {
        console.log('Approver-amount validation error detected:', error);
      }
    }
  }, [selectedApprover, editedPR.estimatedAmount, rules.length]);

  const handleCancel = (): void => {
    handleExitEditMode();
  };

  const handleRuleOverrideConfirm = async () => {
    if (!ruleOverrideJustification.trim()) {
      enqueueSnackbar('Justification is required to override rule validation', { variant: 'error' });
      return;
    }

    try {
      // Save the override to the PR
      await prService.updatePR(id!, {
        ruleValidationOverride: true,
        ruleValidationOverrideJustification: ruleOverrideJustification,
        ruleValidationOverrideBy: currentUser?.id,
        ruleValidationOverrideAt: new Date().toISOString()
      });

      // Update local PR state
      setPr(prev => prev ? {
        ...prev,
        ruleValidationOverride: true,
        ruleValidationOverrideJustification: ruleOverrideJustification,
        ruleValidationOverrideBy: currentUser?.id,
        ruleValidationOverrideAt: new Date().toISOString()
      } : null);

      // Close dialog and proceed with save
      setShowRuleOverrideDialog(false);
      setRuleOverrideJustification('');
      
      enqueueSnackbar('Rule validation override applied. You can now save.', { variant: 'success' });
    } catch (error) {
      console.error('Error applying rule override:', error);
      enqueueSnackbar('Failed to apply override', { variant: 'error' });
    }
  };

  const handleSave = async () => {
    if (!pr) {
      enqueueSnackbar('No PR data to save', { variant: 'error' });
      return;
    }
    
    // Validate approver vs amount before saving (unless override is in place)
    const approverAmountError = validateApproverAmount();
    if (approverAmountError && !pr.ruleValidationOverride) {
      // Show override dialog instead of blocking immediately
      setApproverAmountError(approverAmountError);
      setShowRuleOverrideDialog(true);
      return;
    }
    
    setLoading(true);
    
    try {
      // Debug: Log approver states before save
      console.log('PRView handleSave - Approver states:', {
        selectedApprover,
        selectedApprover2,
        'editedPR.approver': editedPR.approver,
        'editedPR.approver2': editedPR.approver2,
        'pr.approver': pr.approver,
        'pr.approver2': pr.approver2
      });
      
      // Check if amount has changed significantly and approvals should be rescinded
      const newAmount = editedPR.estimatedAmount ?? pr.estimatedAmount;
      const oldApprovedAmount = pr.lastApprovedAmount;
      const hasApprovals = pr.approvalWorkflow?.firstApprovalComplete || pr.approvalWorkflow?.secondApprovalComplete;
      
      if (hasApprovals && oldApprovedAmount && newAmount !== oldApprovedAmount) {
        const amountChangeCheck = prService.shouldRescindApprovalsForAmountChange(oldApprovedAmount, newAmount);
        
        if (amountChangeCheck.shouldRescind) {
          console.log('Amount change exceeds threshold. Rescinding approvals...', amountChangeCheck);
          await prService.rescindApprovals(
            pr.id,
            amountChangeCheck.reason || 'Amount changed significantly',
            user || undefined
          );
          enqueueSnackbar(
            `Approvals have been rescinded due to significant amount change (${amountChangeCheck.percentChange?.toFixed(2)}%)`,
            { variant: 'warning', autoHideDuration: 8000 }
          );
        }
      }
      
      // Prepare the PR data for update
      const updatedPR: PRUpdateParams = {
        ...pr,
        ...editedPR,
        // Explicitly preserve approver fields
        approver: selectedApprover || editedPR.approver || pr.approver,
        approver2: selectedApprover2 || editedPR.approver2 || pr.approver2,
        lineItems: lineItems.map(item => ({
          id: item.id,
          description: item.description,
          quantity: item.quantity,
          uom: item.uom,
          notes: item.notes || '',
          unitPrice: item.unitPrice,
          attachments: item.attachments || []
        })),
        quotes: pr.quotes || [],
        updatedAt: new Date().toISOString(),
        approvalWorkflow: {
          currentApprover: selectedApprover || pr.approvalWorkflow?.currentApprover || null,
          secondApprover: selectedApprover2 || pr.approvalWorkflow?.secondApprover || null,
          approvalHistory: pr.approvalWorkflow?.approvalHistory || [],
          lastUpdated: new Date().toISOString()
        }
      };
      
      console.log('PRView handleSave - Computed approver fields:', {
        approver: updatedPR.approver,
        approver2: updatedPR.approver2,
        'approvalWorkflow.secondApprover': updatedPR.approvalWorkflow?.secondApprover
      });
      
      // Update the PR
      await prService.updatePR(pr.id, updatedPR);
      
      // Refresh the PR data
      await fetchPR();
      
      enqueueSnackbar('PR saved successfully', { variant: 'success' });
      
      // Return to the PR detail view after save so editors can keep context
      navigate(`/pr/${pr.id}`);
    } catch (error) {
      console.error('Error saving PR:', error);
      enqueueSnackbar('Failed to save PR', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Step management
  const [activeStep, setActiveStep] = useState(0);
  const steps = ['Basic Information', 'Line Items', 'Quotes'];

  const handleNext = () => {
    setActiveStep((prevStep) => prevStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };

  const renderBasicInformation = () => {
    return (
      <Grid container spacing={{ xs: 1.5, sm: 2 }}>
        {/* Validation Error Alert */}
        {approverAmountError && (
          <Grid item xs={12}>
            <Alert severity="error" sx={{ mb: 2 }}>
              <strong>Invalid Approver-Amount Combination:</strong> {approverAmountError}
            </Alert>
          </Grid>
        )}
        
        {/* Editable Information - Left Side */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: { xs: 1.5, sm: 2, md: 3 }, overflowX: 'hidden' }}>
            <Typography variant="h6" gutterBottom>
              {t('pr.basicInformation')}
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={{ xs: 1.5, sm: 2 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label={t('pr.description')}
                  value={isEditMode ? editedPR.description || pr?.description : pr?.description}
                  onChange={(e) => handleFieldChange('description', e.target.value)}
                  disabled={!isEditMode}
                  multiline
                  rows={3}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth disabled={!isEditMode}>
                  <InputLabel>{t('pr.department')}</InputLabel>
                  <Select
                    value={isEditMode ? (editedPR.department || pr?.department || '') : (pr?.department || '')}
                    onChange={(e) => handleFieldChange('department', e.target.value)}
                    label={t('pr.department')}
                    renderValue={(value) => {
                      const dept = departments.find(d => d.id === value);
                      return dept ? dept.name : value;
                    }}
                  >
                    {departments.map((dept) => (
                      <MenuItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth disabled={!isEditMode || !canEditFinancialFields}>
                  <InputLabel>{t('pr.category')}</InputLabel>
                  <Select
                    value={isEditMode ? (editedPR.projectCategory || pr?.projectCategory || '') : (pr?.projectCategory || '')}
                    onChange={(e) => handleFieldChange('projectCategory', e.target.value)}
                    label={t('pr.category')}
                    renderValue={(value) => {
                      const category = projectCategories.find(c => c.id === value);
                      return category ? category.name : value;
                    }}
                  >
                    {projectCategories.map((category) => (
                      <MenuItem key={category.id} value={category.id}>
                        {category.name}
                      </MenuItem>
                    ))}
                  </Select>
                  {isEditMode && !canEditFinancialFields && (
                    <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                      {pr?.status === 'REVISION_REQUIRED' 
                        ? 'Only requestor can edit in Revision Required status'
                        : pr?.status === 'COMPLETED'
                        ? 'Only Finance/Admin can edit in Completed status'
                        : 'You do not have permission to edit this field'}
                    </Typography>
                  )}
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                {isEditMode ? (
                  <Autocomplete
                    multiple
                    id="sites-select"
                    options={sites}
                    getOptionLabel={(option) => typeof option === 'string' ? sites.find(s => s.id === option)?.name || option : option.name}
                    value={sites.filter(site => {
                      const currentSites = editedPR.sites || normalizeSites(pr);
                      return currentSites.includes(site.id);
                    })}
                    onChange={(event, newValue) => {
                      handleFieldChange('sites', newValue.map(site => site.id));
                    }}
                    disabled={!isEditMode}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label={t('pr.site')}
                      />
                    )}
                    renderTags={(value, getTagProps) =>
                      value.map((option, index) => (
                        <Chip
                          label={option.name}
                          {...getTagProps({ index })}
                          key={option.id}
                        />
                      ))
                    }
                  />
                ) : (
                  <TextField
                    fullWidth
                    label={t('pr.site')}
                    value={normalizeSites(pr).map(siteId => {
                      const site = sites.find(s => s.id === siteId);
                      return site ? site.name : siteId;
                    }).join(', ') || 'Not specified'}
                    disabled
                  />
                )}
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth disabled={!isEditMode || !canEditFinancialFields}>
                  <InputLabel>{t('pr.expenseType')}</InputLabel>
                  <Select
                    value={isEditMode ? (editedPR.expenseType || pr?.expenseType || '') : (pr?.expenseType || '')}
                    onChange={(e) => handleFieldChange('expenseType', e.target.value)}
                    label={t('pr.expenseType')}
                    renderValue={(value) => {
                      const expenseType = expenseTypes.find(t => t.id === value);
                      return expenseType ? expenseType.name : value;
                    }}
                  >
                    {expenseTypes.map((type) => (
                      <MenuItem key={type.id} value={type.id}>
                        {type.name}
                      </MenuItem>
                    ))}
                  </Select>
                  {isEditMode && !canEditFinancialFields && (
                    <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                      {pr?.status === 'REVISION_REQUIRED' 
                        ? 'Only requestor can edit in Revision Required status'
                        : pr?.status === 'COMPLETED'
                        ? 'Only Finance/Admin can edit in Completed status'
                        : 'You do not have permission to edit this field'}
                    </Typography>
                  )}
                </FormControl>
              </Grid>
              {(isEditMode ? editedPR.expenseType || pr?.expenseType : pr?.expenseType) && (
                <Grid item xs={12} sm={6}>
                  {(() => {
                    const currentExpenseType = isEditMode 
                      ? expenseTypes.find(t => t.id === (editedPR.expenseType || pr?.expenseType))
                      : expenseTypes.find(t => t.id === pr?.expenseType);
                    
                    const isVehicleExpense = currentExpenseType?.name.toLowerCase() === 'vehicle';
                    
                    return isVehicleExpense ? (
                      <FormControl fullWidth disabled={!isEditMode}>
                        <InputLabel>{t('pr.vehicle')}</InputLabel>
                        <Select
                          value={isEditMode ? (editedPR.vehicle || pr?.vehicle || '') : (pr?.vehicle || '')}
                          onChange={(e) => handleFieldChange('vehicle', e.target.value)}
                          label={t('pr.vehicle')}
                          renderValue={(value) => {
                            const vehicle = vehicles.find(v => v.id === value);
                            return vehicle ? (vehicle.registrationNumber || vehicle.name || vehicle.code) : value;
                          }}
                        >
                          {vehicles.map((vehicle) => {
                            const displayName = vehicle.registrationNumber || vehicle.name || vehicle.code;
                            return (
                              <MenuItem key={vehicle.id} value={vehicle.id}>
                                {displayName}
                              </MenuItem>
                            );
                          })}
                        </Select>
                      </FormControl>
                    ) : null;
                  })()}
                </Grid>
              )}
              <Grid item xs={12} sm={6}>
                {isEditMode && !isLockedInApprovedStatus('preferredVendor') ? (
                  <Box>
                    <Button
                      variant="outlined"
                      fullWidth
                      startIcon={<StoreIcon />}
                      onClick={() => setVendorDialogOpen(true)}
                      disabled={isLockedInApprovedStatus('preferredVendor')}
                      sx={{
                        justifyContent: 'flex-start',
                        textTransform: 'none',
                        height: '56px',
                        ...((editedPR.preferredVendor || pr?.preferredVendor) && {
                          color: 'text.primary',
                          fontWeight: 'normal',
                        }),
                      }}
                    >
                      {(editedPR.preferredVendor || pr?.preferredVendor)
                        ? vendors.find(v => v.id === (editedPR.preferredVendor || pr?.preferredVendor))?.name || 'Select Vendor'
                        : 'Select Preferred Vendor (Optional)'}
                    </Button>
                    {(editedPR.preferredVendor || pr?.preferredVendor) && (
                      <Button
                        size="small"
                        onClick={() => handleFieldChange('preferredVendor', '')}
                        sx={{ mt: 0.5 }}
                      >
                        Clear Selection
                      </Button>
                    )}
                    <FormHelperText sx={{ mt: 0.5 }}>
                      Optional - Select if you have a preferred vendor
                    </FormHelperText>
                    <VendorSelectionDialog
                      open={vendorDialogOpen}
                      onClose={() => setVendorDialogOpen(false)}
                      onSelect={(vendorId) => {
                        handleFieldChange('preferredVendor', vendorId);
                        setVendorDialogOpen(false);
                      }}
                      vendors={vendors.filter(vendor => vendor.active)}
                      selectedVendorId={editedPR.preferredVendor || pr?.preferredVendor || undefined}
                    />
                  </Box>
                ) : (
                  <FormControl fullWidth disabled>
                    <InputLabel>{t('pr.preferredVendor')}</InputLabel>
                    <Select
                      value={pr?.preferredVendor || ''}
                      label={t('pr.preferredVendor')}
                      renderValue={(value) => {
                        const vendor = vendors.find(v => v.id === value);
                        return vendor ? vendor.name : value || '';
                      }}
                    >
                      {vendors
                        .filter(vendor => vendor.active)
                        .map((vendor) => (
                          <MenuItem key={vendor.id} value={vendor.id}>
                            {vendor.name}
                          </MenuItem>
                        ))}
                    </Select>
                    {isEditMode && isLockedInApprovedStatus('preferredVendor') && (
                      <FormHelperText>Vendor cannot be changed after approval</FormHelperText>
                    )}
                  </FormControl>
                )}
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label={t('pr.estimatedAmount')}
                  type="number"
                  value={isEditMode ? editedPR.estimatedAmount || pr?.estimatedAmount || '' : pr?.estimatedAmount || ''}
                  onChange={(e) => handleFieldChange('estimatedAmount', parseFloat(e.target.value))}
                  disabled={!isEditMode || isLockedInApprovedStatus('estimatedAmount')}
                  error={!!approverAmountError}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        {pr?.currency}
                      </InputAdornment>
                    ),
                  }}
                  helperText={
                    approverAmountError 
                      ? approverAmountError
                      : isEditMode && isLockedInApprovedStatus('estimatedAmount') 
                        ? 'Amount cannot be changed after approval' 
                        : ''
                  }
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label={t('pr.requiredDate')}
                  type="date"
                  value={isEditMode ? editedPR.requiredDate || pr?.requiredDate || '' : pr?.requiredDate || ''}
                  onChange={(e) => handleFieldChange('requiredDate', e.target.value)}
                  disabled={!isEditMode || !canEditRequiredDate}
                  InputLabelProps={{
                    shrink: true,
                  }}
                />
              </Grid>
              
              {/* Payment Type (available from IN_QUEUE onwards, including REVISION_REQUIRED) */}
              {pr && (pr.status === PRStatus.IN_QUEUE || 
                      pr.status === PRStatus.PENDING_APPROVAL || 
                      pr.status === PRStatus.APPROVED || 
                      pr.status === PRStatus.ORDERED || 
                      pr.status === PRStatus.COMPLETED || 
                      pr.status === PRStatus.CANCELED ||
                      pr.status === PRStatus.REVISION_REQUIRED) && (
                <Grid item xs={12} sm={6}>
                  <FormControl 
                    fullWidth 
                    disabled={!isEditMode || (
                      pr.status === PRStatus.REVISION_REQUIRED
                        ? (!isProcurement && !isAdmin) // In R&R: only procurement and admin can edit
                        : (!isProcurement && !isAdmin && pr.status !== PRStatus.PENDING_APPROVAL) // Other statuses: procurement/admin can edit, or anyone in PENDING_APPROVAL
                    )}
                  >
                    <InputLabel>Payment Type</InputLabel>
                    <Select
                      value={isEditMode ? (editedPR.paymentType || pr?.paymentType || '') : (pr?.paymentType || '')}
                      onChange={(e) => handleFieldChange('paymentType', e.target.value)}
                      label="Payment Type"
                      renderValue={(value) => {
                        const paymentType = paymentTypes.find(pt => pt.id === value);
                        return paymentType ? paymentType.name : value || '';
                      }}
                    >
                      <MenuItem value="">
                        <em>None</em>
                      </MenuItem>
                      {paymentTypes
                        .filter(pt => pt.isActive !== false)
                        .map((paymentType) => (
                          <MenuItem key={paymentType.id} value={paymentType.id}>
                            {paymentType.name}
                          </MenuItem>
                        ))}
                    </Select>
                    {!pr?.paymentType && (
                      <FormHelperText>Please select payment type</FormHelperText>
                    )}
                  </FormControl>
                </Grid>
              )}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label={t('pr.comments')}
                  value={isEditMode ? editedPR.comments || pr?.comments : pr?.comments}
                  onChange={(e) => handleFieldChange('comments', e.target.value)}
                  disabled={!isEditMode}
                  multiline
                  rows={2}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl 
                  fullWidth 
                  disabled={!isEditMode || (
                    pr?.status === PRStatus.REVISION_REQUIRED 
                      ? (!isProcurement && !isAdmin) // In R&R: only procurement and admin can edit
                      : (!isProcurement && !isRequestor && !isAdmin) // Other statuses: procurement, requestor, or admin
                  ) || isLockedInApprovedStatus('approver')}
                  error={!!approverAmountError}
                >
                  <InputLabel>{t('pr.approver')}</InputLabel>
                  <Select
                    value={selectedApprover || ''}
                    onChange={(e) => handleApproverChange(e.target.value)}
                    label={t('pr.approver')}
                  >
                    <MenuItem value="">
                      <em>None</em>
                    </MenuItem>
                    {approvers.map((approver) => (
                      <MenuItem key={approver.id} value={approver.id}>
                        {(() => {
                          const level = parseInt(approver.permissionLevel);
                          if (level === 1) return `${approver.name} (Global Approver)`;
                          if (level === 2) return `${approver.name} (Senior Approver)`;
                          if (level === 6) return `${approver.name} (Finance Approver)`;
                          return `${approver.name} (Level ${level} Approver)`;
                        })()}{getDisplayDepartment(approver.department) ? ` (${getDisplayDepartment(approver.department)})` : ''}
                      </MenuItem>
                    ))}
                  </Select>
                  {approverAmountError ? (
                    <FormHelperText>{approverAmountError}</FormHelperText>
                  ) : isEditMode && isLockedInApprovedStatus('approver') ? (
                    <FormHelperText>Approver cannot be changed after approval</FormHelperText>
                  ) : null}
                </FormControl>
              </Grid>

              {/* Second Approver (for dual approval on high-value PRs) */}
              {(() => {
                // Check if dual approval is required based on Rule 3 and Rule 5
                const rule3 = rules.find(r => r.number === 3 || r.number === '3');
                const rule5 = rules.find(r => r.number === 5 || r.number === '5');
                const requiresDualApproval = rule3 && rule5 && 
                  (pr?.estimatedAmount || editedPR.estimatedAmount || 0) >= rule3.threshold;

                if (!requiresDualApproval) return null;

                return (
                  <Grid item xs={12} sm={6}>
                    <FormControl 
                      fullWidth 
                      disabled={!isEditMode || (
                        pr?.status === PRStatus.REVISION_REQUIRED 
                          ? (!isProcurement && !isAdmin) // In R&R: only procurement and admin can edit
                          : (!isProcurement && !isRequestor && !isAdmin && !(isDesignatedApprover && pr?.status === PRStatus.PENDING_APPROVAL)) // Other statuses: procurement, requestor, admin, or designated approver in PENDING_APPROVAL
                      ) || isLockedInApprovedStatus('approver2')}
                    >
                      <InputLabel>{t('pr.secondApprover')}</InputLabel>
                      <Select
                        value={selectedApprover2 || ''}
                        onChange={(e) => handleApprover2Change(e.target.value)}
                        label={t('pr.secondApprover')}
                      >
                        <MenuItem value="">
                          <em>None</em>
                        </MenuItem>
                        {approvers
                          .filter(approver => approver.id !== selectedApprover) // Don't show same approver
                          .map((approver) => (
                          <MenuItem key={approver.id} value={approver.id}>
                            {(() => {
                              const level = parseInt(approver.permissionLevel);
                              if (level === 1) return `${approver.name} (Global Approver)`;
                              if (level === 2) return `${approver.name} (Senior Approver)`;
                              if (level === 6) return `${approver.name} (Finance Approver)`;
                              return `${approver.name} (Level ${level} Approver)`;
                            })()}{getDisplayDepartment(approver.department) ? ` (${getDisplayDepartment(approver.department)})` : ''}
                          </MenuItem>
                        ))}
                      </Select>
                      {isEditMode && isLockedInApprovedStatus('approver2') ? (
                        <FormHelperText>Second approver cannot be changed after approval</FormHelperText>
                      ) : (
                        <FormHelperText>
                          Required for amounts above {rule3.threshold.toLocaleString()} {rule3.currency}
                        </FormHelperText>
                      )}
                    </FormControl>
                  </Grid>
                );
              })()}
            </Grid>
          </Paper>
        </Grid>

        {/* Additional Information - Right Side */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: { xs: 1.5, sm: 2, md: 3 }, height: '100%', overflowX: 'hidden' }}>
            <Typography variant="h6" gutterBottom>
              {t('pr.additionalInformation')}
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={{ xs: 1.5, sm: 2 }}>
              <Grid item xs={12} sm={6}>
                <Typography color="textSecondary">{t('pr.createdBy')}</Typography>
                <Typography>
                  {pr?.requestor?.firstName && pr?.requestor?.lastName 
                    ? `${pr.requestor.firstName} ${pr.requestor.lastName}`
                    : <span style={{ color: 'red' }}>Error loading user details</span>
                  }
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography color="textSecondary">{t('pr.createdDate')}</Typography>
                <Typography>
                  {pr?.createdAt ? new Date(pr.createdAt).toLocaleDateString() : 'N/A'}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography color="textSecondary">Time Since Submitted [DD_HH_MM]</Typography>
                <Typography sx={{ fontFamily: 'monospace', fontSize: '1.1rem', fontWeight: 'bold', color: 'primary.main' }}>
                  {pr?.createdAt ? (() => {
                    const now = currentTime;
                    const created = new Date(pr.createdAt);
                    const diff = now - created.getTime();
                    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                    return `${String(days).padStart(2, '0')}_${String(hours).padStart(2, '0')}_${String(minutes).padStart(2, '0')}`;
                  })() : 'N/A'}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography color="textSecondary">{t('pr.lastUpdated')}</Typography>
                <Typography>
                  {pr?.updatedAt ? new Date(pr.updatedAt).toLocaleDateString() : 'N/A'}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography color="textSecondary">{t('pr.organization')}</Typography>
                <Typography>{pr?.organization || 'N/A'}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                {currentUser && pr ? (
                  <UrgencyControl
                    pr={pr}
                    currentUser={currentUser}
                    onUpdate={refreshPR}
                  />
                ) : (
                  <Box>
                    <Typography color="textSecondary">{t('pr.urgencyLevel')}</Typography>
                    <Chip
                      label={pr?.isUrgent || pr?.metrics?.isUrgent ? 'Urgent' : 'Normal'}
                      color={pr?.isUrgent || pr?.metrics?.isUrgent ? 'error' : 'default'}
                      size="small"
                      sx={{ mt: 1 }}
                    />
                  </Box>
                )}
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography color="textSecondary">{t('pr.requiredDate')}</Typography>
                <Typography>
                  {pr?.requiredDate ? new Date(pr.requiredDate).toLocaleDateString() : t('pr.notSpecified')}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography color="textSecondary">{t('pr.estimatedAmount')}</Typography>
                <Typography>
                  {pr?.currency} {pr?.estimatedAmount?.toLocaleString() || t('pr.notSpecified')}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography color="textSecondary">{t('pr.preferredVendor')}</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography>
                    {(() => {
                      if (!pr?.preferredVendor) return t('pr.notSpecified');
                      const vendor = vendors.find(v => v.id === pr.preferredVendor);
                      return vendor ? vendor.name : pr.preferredVendor;
                    })()}
                  </Typography>
                  {(() => {
                    if (!pr?.preferredVendor) return null;
                    const vendor = vendors.find(v => v.id === pr.preferredVendor);
                    if (!vendor) return null;
                    
                    // Check if vendor is approved
                    const isApproved = vendor.isApproved === true;
                    const isExpired = vendor.approvalExpiryDate && new Date(vendor.approvalExpiryDate) < new Date();
                    
                    if (isApproved && !isExpired) {
                      return (
                        <Chip 
                          label={t('pr.approved')} 
                          size="small" 
                          color="success"
                          sx={{ height: 20, fontSize: '0.7rem' }}
                        />
                      );
                    } else if (isApproved && isExpired) {
                      return (
                        <Chip 
                          label={t('pr.approvalExpired')} 
                          size="small" 
                          color="warning"
                          sx={{ height: 20, fontSize: '0.7rem' }}
                        />
                      );
                    } else {
                      return (
                        <Chip 
                          label={t('pr.notApproved')} 
                          size="small" 
                          color="error"
                          sx={{ height: 20, fontSize: '0.7rem' }}
                        />
                      );
                    }
                  })()}
                </Box>
                {(() => {
                  if (!pr?.preferredVendor) return null;
                  const vendor = vendors.find(v => v.id === pr.preferredVendor);
                  if (!vendor || !vendor.isApproved) return null;
                  
                  // Show approval details
                  return (
                    <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 0.5 }}>
                      {vendor.approvalDate && `Approved: ${new Date(vendor.approvalDate).toLocaleDateString()}`}
                      {vendor.approvalExpiryDate && ` • Expires: ${new Date(vendor.approvalExpiryDate).toLocaleDateString()}`}
                    </Typography>
                  );
                })()}
              </Grid>
              <Grid item xs={12}>
                <Typography color="textSecondary">{t('pr.currentApprover')}</Typography>
                <div className="flex flex-wrap gap-2 mt-1">
                  {(() => {
                    // Check pr.approver first as it's the single source of truth
                    const approverId = pr?.approver || pr?.approvalWorkflow?.currentApprover;
                    
                    if (!approverId) {
                      return (
                        <Typography variant="body2" color="warning.main">
                          No approver assigned (legacy PR - please edit and save to update)
                        </Typography>
                      );
                    }

                    if (approvers.length === 0) {
                      return (
                        <Typography variant="body2" color="textSecondary">
                          {t('common.loading')}
                        </Typography>
                      );
                    }

                    const approver = approvers.find(a => a.id === approverId);

                    if (!approver) {
                      return (
                        <Typography variant="body2" color="error">
                          Approver not found or inactive (ID: {approverId})
                        </Typography>
                      );
                    }

                    return (
                      <Chip
                        label={`${approver.name}${getDisplayDepartment(approver.department) ? ` (${getDisplayDepartment(approver.department)})` : ''}`}
                        color="primary"
                        size="small"
                        sx={{ mt: 1 }}
                      />
                    );
                  })()}
                </div>
              </Grid>
              <Grid item xs={12}>
                <Typography color="textSecondary">{t('pr.approvalHistory')}</Typography>
                <div className="flex flex-col gap-2 mt-1">
                  {pr?.approvalWorkflow?.approvalHistory && pr.approvalWorkflow.approvalHistory.length > 0 ? (
                    pr.approvalWorkflow.approvalHistory.map((history, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Chip
                          label={(() => {
                            const approver = approvers.find(a => a.id === history.approverId);
                            return approver ? 
                              `${approver.name}${getDisplayDepartment(approver.department) ? ` (${getDisplayDepartment(approver.department)})` : ''}` : 
                              t('common.loading');
                          })()}
                          color={history.approved ? "success" : "error"}
                          size="small"
                        />
                        <Typography variant="caption" color="textSecondary">
                          {new Date(history.timestamp).toLocaleString()}
                        </Typography>
                        <Typography variant="body2">
                          {history.approved ? 'Approved' : 'Rejected'}
                        </Typography>
                      </div>
                    ))
                  ) : (
                    <Typography variant="body2" color="textSecondary">
                      {t('pr.noApprovalHistory')}
                    </Typography>
                  )}
                </div>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, fontStyle: 'italic' }}>
                  ℹ️ {t('pr.seeStatusHistoryForNotes')}
                </Typography>
              </Grid>
              
              {/* Approver Justifications (3-Quote Scenario) */}
              {(pr?.approvalWorkflow?.firstApproverJustification || pr?.approvalWorkflow?.secondApproverJustification) && (
                <Grid item xs={12}>
                  <Typography color="textSecondary">{t('pr.approverJustifications')}</Typography>
                  <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {pr.approvalWorkflow.firstApproverJustification && (
                      <Paper variant="outlined" sx={{ p: 2, bgcolor: 'info.50' }}>
                        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
                          First Approver Justification:
                        </Typography>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                          {pr.approvalWorkflow.firstApproverJustification}
                        </Typography>
                        {pr.approvalWorkflow.firstApproverSelectedQuoteId && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                            Selected Quote: {(() => {
                              const quote = pr.quotes?.find(q => q.id === pr.approvalWorkflow?.firstApproverSelectedQuoteId);
                              return quote ? `${quote.vendorName} - ${formatCurrency(quote.amount, quote.currency)}` : 'Unknown';
                            })()}
                          </Typography>
                        )}
                      </Paper>
                    )}
                    {pr.approvalWorkflow.secondApproverJustification && (
                      <Paper variant="outlined" sx={{ p: 2, bgcolor: 'success.50' }}>
                        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
                          Second Approver Justification:
                        </Typography>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                          {pr.approvalWorkflow.secondApproverJustification}
                        </Typography>
                        {pr.approvalWorkflow.secondApproverSelectedQuoteId && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                            Selected Quote: {(() => {
                              const quote = pr.quotes?.find(q => q.id === pr.approvalWorkflow?.secondApproverSelectedQuoteId);
                              return quote ? `${quote.vendorName} - ${formatCurrency(quote.amount, quote.currency)}` : 'Unknown';
                            })()}
                          </Typography>
                        )}
                      </Paper>
                    )}
                  </Box>
                </Grid>
              )}
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    );
  };

  const renderLineItems = () => {
    return (
      <Grid container spacing={{ xs: 1.5, sm: 2 }}>
        <Grid item xs={12}>
          <Paper sx={{ p: { xs: 1.5, sm: 2 }, overflowX: 'hidden' }}>
            <Box sx={{ 
              mb: 2, 
              display: 'flex', 
              flexDirection: { xs: 'column', sm: 'row' },
              justifyContent: 'space-between', 
              alignItems: { xs: 'flex-start', sm: 'center' },
              gap: 1
            }}>
              <Typography variant="h6">{t('pr.lineItems')}</Typography>
              {isEditMode && (
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={handleAddLineItem}
                  fullWidth={isMobile}
                  sx={{ minHeight: '44px' }}
                >
                  {t('pr.addLineItem')}
                </Button>
              )}
            </Box>
            <Divider sx={{ mb: 2 }} />
            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table sx={{ minWidth: isMobile ? 800 : 'auto' }}>
                <TableHead>
                  <TableRow>
                    <TableCell>{t('pr.description')}</TableCell>
                    <TableCell align="right">{t('pr.quantity')}</TableCell>
                    <TableCell>{t('pr.uom')}</TableCell>
                    <TableCell>{t('pr.notes')}</TableCell>
                    <TableCell>{t('pr.attachments')}</TableCell>
                    <TableCell align="right">{t('pr.actions')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {lineItems.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <TextField
                          fullWidth
                          value={item.description}
                          onChange={(e) => handleUpdateLineItem(index, { ...item, description: e.target.value })}
                          disabled={!isEditMode}
                          sx={{ 
                            '& .MuiInputBase-input.Mui-disabled': {
                              WebkitTextFillColor: 'rgba(0, 0, 0, 0.6)',
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <TextField
                          type="number"
                          value={item.quantity}
                          onChange={(e) => handleUpdateLineItem(index, { ...item, quantity: parseFloat(e.target.value) })}
                          disabled={!isEditMode}
                          sx={{ 
                            '& .MuiInputBase-input.Mui-disabled': {
                              WebkitTextFillColor: 'rgba(0, 0, 0, 0.6)',
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={item.uom}
                          onChange={(e) => handleUpdateLineItem(index, { ...item, uom: e.target.value })}
                          disabled={!isEditMode}
                          renderValue={(value) => {
                            const uomOption = UOM_OPTIONS.find(opt => opt.code === value);
                            return uomOption ? uomOption.label : value || '';
                          }}
                          sx={{ 
                            '& .MuiSelect-select.Mui-disabled': {
                              WebkitTextFillColor: 'rgba(0, 0, 0, 0.6)',
                            }
                          }}
                        >
                          {UOM_OPTIONS.map((option) => (
                            <MenuItem key={option.code} value={option.code}>
                              {option.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </TableCell>
                      <TableCell>
                        <TextField
                          fullWidth
                          value={item.notes}
                          onChange={(e) => handleUpdateLineItem(index, { ...item, notes: e.target.value })}
                          disabled={!isEditMode}
                          sx={{ 
                            '& .MuiInputBase-input.Mui-disabled': {
                              WebkitTextFillColor: 'rgba(0, 0, 0, 0.6)',
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-2">
                          {item.attachments?.map((file, fileIndex) => (
                            <div key={fileIndex} className="flex items-center gap-2">
                              <span className="flex-1 truncate text-sm">{file.name}</span>
                              <IconButton 
                                size="small"
                                onClick={() => handleFilePreview(file)}
                                title="Preview"
                              >
                                <VisibilityIcon />
                              </IconButton>
                              <IconButton 
                                size="small"
                                onClick={() => handleDownloadQuoteAttachment(file)}
                                title="Download"
                              >
                                <DownloadIcon />
                              </IconButton>
                              {isEditMode && (
                                <IconButton 
                                  size="small"
                                  onClick={() => handleRemoveLineItemAttachment(index, fileIndex)}
                                  color="error"
                                  title="Delete"
                                >
                                  <DeleteIcon />
                                </IconButton>
                              )}
                            </div>
                          ))}
                          {isEditMode && (
                            <div>
                              <input
                                type="file"
                                id={`line-item-file-${index}`}
                                onChange={(e) => handleLineItemFileUpload(e, index)}
                                style={{ display: 'none' }}
                                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                              />
                              <Button
                                variant="outlined"
                                size="small"
                                startIcon={<AttachFileIcon />}
                                onClick={() => document.getElementById(`line-item-file-${index}`)?.click()}
                              >
                                Attach File
                              </Button>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell align="right">
                        {(isEditMode || pr?.status === 'SUBMITTED' || pr?.status === 'RESUBMITTED') && (
                          <IconButton onClick={() => handleDeleteLineItem(index)} color="error">
                            <DeleteIcon />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>
    );
  };

  const handlePreferredQuoteChange = async (quoteId: string) => {
    if (!pr) return;
    
    try {
      const selectedQuote = pr.quotes?.find(q => q.id === quoteId);
      if (!selectedQuote) {
        console.error('Selected quote not found:', quoteId);
        return;
      }

      console.log('Setting preferred quote:', {
        quoteId,
        amount: selectedQuote.amount,
        vendor: selectedQuote.vendorName
      });

      // Update both preferredQuoteId and estimatedAmount
      const updates = {
        preferredQuoteId: quoteId,
        estimatedAmount: selectedQuote.amount,
        updatedAt: new Date().toISOString()
      };

      await prService.updatePR(pr.id, updates);
      
      // Update local state
      setPr(prev => prev ? {
        ...prev,
        preferredQuoteId: quoteId,
        estimatedAmount: selectedQuote.amount,
        updatedAt: new Date().toISOString()
      } : null);

      enqueueSnackbar(`Preferred quote selected. PR amount updated to ${selectedQuote.amount} ${selectedQuote.currency}`, { 
        variant: 'success' 
      });
    } catch (error) {
      console.error('Error setting preferred quote:', error);
      enqueueSnackbar('Failed to set preferred quote', { variant: 'error' });
    }
  };

  const renderQuotes = () => {
    if (!pr) return null;

    // Allow editing quotes in edit mode for appropriate statuses
    // Procurement (level 3) and admins (level 1) can edit in SUBMITTED, IN_QUEUE
    // Requestors (level 5) can edit in SUBMITTED, REVISION_REQUIRED (their own PRs)
    const canEditQuotes = isEditMode && (
      (isProcurement && (pr.status === PRStatus.SUBMITTED || pr.status === PRStatus.IN_QUEUE)) ||
      (isAdmin) ||
      (isRequestor && pr.requestorId === currentUser?.id && 
        (pr.status === PRStatus.SUBMITTED || pr.status === PRStatus.REVISION_REQUIRED))
    );

    return (
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <Typography variant="h6">{t('pr.quotes')}</Typography>
          <QuotesStep
            formState={pr || { quotes: [] }}
            setFormState={(newState) => {
              if (!canEditQuotes) {
                enqueueSnackbar('You cannot edit quotes in the current state', { variant: 'error' });
                return;
              }
              
              // Just update the local state without saving to Firebase
              setPr(prev => prev ? { ...prev, quotes: newState.quotes } : null);
            }}
            vendors={vendors}
            currencies={currencies}
            loading={loading}
            isEditing={canEditQuotes}
            isProcurement={isProcurement}
            onPreferredQuoteChange={handlePreferredQuoteChange}
            onSave={async () => {
              if (!pr || !canEditQuotes) return;
              
              try {
                setLoading(true);
                const quotes = (pr.quotes || []).map(quote => ({
                  id: quote.id || crypto.randomUUID(),
                  vendorId: quote.vendorId || '',
                  vendorName: quote.vendorName || '',
                  quoteDate: quote.quoteDate || new Date().toISOString().split('T')[0],
                  amount: quote.amount || 0,
                  currency: quote.currency || '',
                  notes: quote.notes || '',
                  attachments: quote.attachments || [],
                  submittedBy: quote.submittedBy || currentUser?.id,
                  submittedAt: quote.submittedAt || new Date().toISOString(),
                  deliveryDate: quote.deliveryDate || '',
                  deliveryAddress: quote.deliveryAddress || '',
                  paymentTerms: quote.paymentTerms || ''
                }));
                
                const updates = { quotes };
                await prService.updatePR(pr.id, updates);
                enqueueSnackbar('Quotes saved successfully', { variant: 'success' });
                setHasUnsavedChanges(false);
                navigate(`/pr/${pr.id}`); // Exit edit mode by navigating to view mode
              } catch (error) {
                console.error('Error saving quotes:', error);
                enqueueSnackbar('Failed to save quotes', { variant: 'error' });
              } finally {
                setLoading(false);
              }
            }}
          />
        </Grid>
      </Grid>
    );
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return renderBasicInformation();
      case 1:
        return renderLineItems();
      case 2:
        return renderQuotes();
      default:
        return null;
    }
  };

  // Load approvers
  const loadApprovers = async () => {
    try {
      if (!pr?.organization) {
        return;
      }

      const approverList = await approverService.getApprovers(pr.organization);
      setApprovers(approverList);

      // Set initial selected approver if present
      if (pr?.approvalWorkflow?.currentApprover) {
        const currentApprover = approverList.find(a => a.id === pr.approvalWorkflow?.currentApprover);
        if (currentApprover) {
          setSelectedApprover(currentApprover.id);
        }
      }
    } catch (error) {
      console.error('Error loading approvers:', error);
      enqueueSnackbar('Error loading approvers', { variant: 'error' });
    }
  };

  // Load reference data
  useEffect(() => {
    if (!pr?.organization) return;

    Promise.all([
      referenceDataService.getDepartments(pr.organization),
      referenceDataService.getItemsByType('projectCategories', pr.organization),
      referenceDataService.getItemsByType('sites', pr.organization),
      referenceDataService.getItemsByType('expenseTypes', pr.organization),
      referenceDataService.getItemsByType('vehicles', pr.organization),  // Pass organization here
      referenceDataService.getItemsByType('vendors'),  // This is org-independent
      referenceDataService.getItemsByType('currencies'),  // This is org-independent
    ]).then(([depts, projCats, sites, expTypes, vehs, vends, currList]) => {
      setDepartments(depts.filter(d => d.active));
      setProjectCategories(projCats.filter(c => c.active));
      setSites(sites.filter(s => s.active));
      setExpenseTypes(expTypes.filter(e => e.active));
      setVehicles(vehs.filter(v => v.active));
      setVendors(vends.filter(v => v.active));
      setCurrencies(currList.filter(c => c.active));
    });
  }, [pr?.organization]);

  // Show loading state while reference data is loading
  if (loadingReference || loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !pr) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="error">{error || 'PR not found'}</Typography>
      </Box>
    );
  }

  const handleResubmit = async () => {
    if (!pr || !currentUser) return;

    try {
      setLoading(true);
      await prService.updatePRStatus(pr.id, PRStatus.RESUBMITTED, 'PR resubmitted after revisions', currentUser);
      enqueueSnackbar('PR resubmitted successfully', { variant: 'success' });
      navigate('/dashboard');
    } catch (error) {
      console.error('Error resubmitting PR:', error);
      enqueueSnackbar('Failed to resubmit PR', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleExitEditMode = () => {
    if (hasUnsavedChanges) {
      setIsExitingEditMode(true);
    } else {
      navigate(`/pr/${pr.id}`);
    }
  };

  const confirmExitEditMode = () => {
    setIsExitingEditMode(false);
    navigate(`/pr/${pr.id}`);
  };

  const cancelExitEditMode = () => {
    setIsExitingEditMode(false);
  };

  const handleFilePreview = (file: { name: string; url: string }) => {
    setPreviewFile({
      name: file.name,
      url: file.url,
      type: file.name.split('.').pop()?.toLowerCase() || ''
    });
    setPreviewOpen(true);
  };

  const handleClosePreview = () => {
    setPreviewOpen(false);
    setPreviewFile(null);
  };

  // Function to handle downloading quote attachments
  const handleDownloadQuoteAttachment = async (attachment: { name: string; url: string }) => {
    try {
      const response = await fetch(attachment.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading file:', error);
      enqueueSnackbar('Error downloading file', { variant: 'error' });
    }
  };

  // Procurement (Level 3) cannot edit Required Date in any status
  // Requestor can edit in REVISION_REQUIRED, others with appropriate permissions can edit in other statuses
  const canEditRequiredDate = (() => {
    // Admin can always edit
    if (currentUser?.permissionLevel === 1) return true;
    // Requestor can edit in REVISION_REQUIRED
    if (pr?.status === 'REVISION_REQUIRED' && currentUser?.id === pr?.requestorId) return true;
    // Procurement (Level 3) CANNOT edit Required Date
    if (currentUser?.permissionLevel === 3) return false;
    // Finance/Admin and Senior Approvers can edit (Levels 2, 4)
    return currentUser?.permissionLevel && [2, 4].includes(currentUser.permissionLevel);
  })();

  return (
    <Box sx={{ 
      p: { xs: 1, sm: 2, md: 3 },
      width: '100%',
      maxWidth: '100vw',
      boxSizing: 'border-box',
      overflowX: 'hidden',
      ml: 0,
      mr: 0,
    }}>
      {/* Debug Information - Commented out after fixing procurement workflow */}
      {/* <UserDebug />
      <ForceUserRefresh /> */}
      
      {/* Header with Title and Actions */}
      <Box sx={{ 
        display: 'flex', 
        flexDirection: { xs: 'column', sm: 'row' },
        justifyContent: 'space-between', 
        alignItems: { xs: 'flex-start', sm: 'center' }, 
        mb: 3,
        gap: 2
      }}>
        <Typography variant="h4" component="h1" sx={{ fontSize: { xs: '1.5rem', sm: '2.125rem' } }}>
          {pr?.status === PRStatus.APPROVED || pr?.status === PRStatus.ORDERED || pr?.status === PRStatus.DELIVERED ? 'PO' : 'PR'} Details: {pr?.prNumber}
        </Typography>
        <Box sx={{ 
          display: 'flex', 
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 1,
          width: { xs: '100%', sm: 'auto' }
        }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/dashboard')}
            variant="outlined"
            fullWidth={isMobile}
            sx={{ minHeight: '44px' }}
          >
            Back to Dashboard
          </Button>
          {canEdit && !isEditMode && (
            <Button
              startIcon={<EditIcon />}
              onClick={() => navigate(`/pr/${id}/edit`)}
              variant="contained"
              fullWidth={isMobile}
              sx={{ minHeight: '44px' }}
            >
              Edit PR
            </Button>
          )}
          {pr?.status === PRStatus.REVISION_REQUIRED && pr?.requestor?.id === currentUser?.id && (
            <Button
              startIcon={<SendIcon />}
              onClick={handleResubmit}
              variant="contained"
              color="primary"
              disabled={loading}
              fullWidth={isMobile}
              sx={{ minHeight: '44px' }}
            >
              Resubmit PR
            </Button>
          )}
        </Box>
      </Box>

      {/* Status Progress Stepper */}
      {pr && pr.status !== PRStatus.DRAFT && (
        <Suspense fallback={<CircularProgress />}>
          <StatusProgressStepper pr={pr} />
        </Suspense>
      )}

      {/* Procurement Actions */}
      {canProcessPR && (
        <Box sx={{ mb: 3 }}>
          <ProcurementActions
            prId={pr?.id}
            currentStatus={pr?.status}
            requestorEmail={pr?.requestorEmail}
            currentUser={currentUser}
            onStatusChange={refreshPR}
          />
        </Box>
      )}

      {/* Procurement line item tools (bulk import / RFQ) */}
      {canShowBulkImportTools && currentUser && pr && (
        <Box sx={{ mb: 3 }}>
          <InQueueStatusActions
            pr={pr}
            currentUser={currentUser}
            onStatusChange={refreshPR}
          />
        </Box>
      )}

      {/* External Approval Bypass (Finance/Admin only) */}
      {pr?.status === PRStatus.PENDING_APPROVAL && currentUser && (
        <ExternalApprovalBypass
          pr={pr}
          currentUser={currentUser}
          onStatusChange={refreshPR}
        />
      )}

      {/* Approver Actions */}
      {pr?.status === PRStatus.PENDING_APPROVAL && (
        <Box sx={{ mb: 3 }}>
          <ApproverActions
            pr={pr}
            currentUser={currentUser}
            assignedApprover={currentApprover}
            onStatusChange={refreshPR}
          />
        </Box>
      )}

      {/* APPROVED Status Actions (PO Document Management) */}
      {pr?.status === PRStatus.APPROVED && currentUser && (
        <Box sx={{ mb: 3 }}>
          <ApprovedStatusActions
            pr={pr}
            currentUser={currentUser}
            onStatusChange={refreshPR}
          />
        </Box>
      )}

      {/* ORDERED Status Actions (Delivery Documentation) */}
      {pr?.status === PRStatus.ORDERED && currentUser && (
        <Box sx={{ mb: 3 }}>
          <OrderedStatusActions
            pr={pr}
            currentUser={currentUser}
            onStatusChange={refreshPR}
          />
        </Box>
      )}

      {/* COMPLETED Status View (Read-only document archive) */}
      {pr?.status === PRStatus.COMPLETED && (
        <Box sx={{ mb: 3 }}>
          <CompletedStatusView pr={pr} />
        </Box>
      )}

      {/* Resurrection Actions for REJECTED and CANCELED PRs */}
      {currentUser && (pr?.status === PRStatus.REJECTED || pr?.status === PRStatus.CANCELED) && (
        <Box sx={{ mb: 3 }}>
          <ResurrectionActions
            pr={pr}
            currentUser={currentUser}
            onStatusChange={refreshPR}
          />
        </Box>
      )}

      {/* PR Status */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Status
        </Typography>
        <Chip
          label={PRStatus[pr?.status]}
          color={
            pr?.status === PRStatus.REJECTED
              ? 'error'
              : pr?.status === PRStatus.REVISION_REQUIRED
              ? 'warning'
              : 'primary'
          }
          sx={{ fontWeight: 'bold' }}
        />
      </Box>

      {/* Workflow History */}
      {pr?.workflowHistory && pr.workflowHistory.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Workflow History
          </Typography>
          <Paper sx={{ p: { xs: 1.5, sm: 2 }, overflowX: 'hidden' }}>
            {pr.workflowHistory.map((history, index) => (
              <Box key={index} sx={{ mb: index !== pr.workflowHistory.length - 1 ? 2 : 0 }}>
                <Typography variant="subtitle2" color="primary">
                  {(() => {
                    const timestamp = history.timestamp;
                    if (!timestamp) return 'Unknown Date';
                    if (typeof timestamp === 'string') return new Date(timestamp).toLocaleString();
                    if (typeof timestamp.toDate === 'function') return timestamp.toDate().toLocaleString();
                    return 'Invalid Date';
                  })()} - {history.toStatus || PRStatus.IN_QUEUE}
                </Typography>
                {history.notes && (
                  <Typography variant="body2" sx={{ mt: 0.5, ml: 2 }}>
                    {history.notes}
                  </Typography>
                )}
                {history.user && (
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
                    By: {history.user.email}
                  </Typography>
                )}
                {index !== pr.workflowHistory.length - 1 && <Divider sx={{ mt: 2 }} />}
              </Box>
            ))}
          </Paper>
        </Box>
      )}

      {/* Status History & Notes */}
      {pr?.statusHistory && pr.statusHistory.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Accordion defaultExpanded={false}>
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              aria-controls="status-history-content"
              id="status-history-header"
              sx={{
                backgroundColor: 'action.hover',
                '&:hover': { backgroundColor: 'action.selected' }
              }}
            >
              <Typography variant="h6">
                {t('pr.statusHistory')} ({pr.statusHistory.length})
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <TableContainer sx={{ overflowX: 'auto' }}>
                <Table size="small" sx={{ minWidth: isMobile ? 600 : 'auto' }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>{t('pr.dateTime')}</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>{t('pr.status')}</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>{t('pr.user')}</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>{t('pr.notes')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pr.statusHistory
                      .slice()
                      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                      .map((historyItem, index) => (
                        <TableRow key={index} hover>
                          <TableCell sx={{ verticalAlign: 'top', whiteSpace: isMobile ? 'normal' : 'nowrap' }}>
                            <Typography variant="body2">
                              {new Date(historyItem.timestamp).toLocaleString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ verticalAlign: 'top' }}>
                            <Chip
                              label={historyItem.status}
                              size="small"
                              color={
                                historyItem.status === 'REJECTED'
                                  ? 'error'
                                  : historyItem.status === 'APPROVED'
                                  ? 'success'
                                  : historyItem.status === 'REVISION_REQUIRED'
                                  ? 'warning'
                                  : 'default'
                              }
                            />
                          </TableCell>
                          <TableCell sx={{ verticalAlign: 'top' }}>
                            <Typography variant="body2">
                              {historyItem.user?.email || 'System'}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ verticalAlign: 'top' }}>
                            {historyItem.notes ? (
                              <Typography 
                                variant="body2" 
                                sx={{ 
                                  whiteSpace: 'pre-wrap',
                                  wordBreak: 'break-word',
                                  maxWidth: '400px'
                                }}
                              >
                                {typeof historyItem.notes === 'string' 
                                  ? historyItem.notes 
                                  : typeof historyItem.notes === 'object' && 'email' in historyItem.notes
                                    ? `By: ${(historyItem.notes as any).email || (historyItem.notes as any).name || 'User'}`
                                    : 'Status changed'}
                              </Typography>
                            ) : (
                              <Typography variant="body2" color="text.secondary" fontStyle="italic">
                                No notes
                              </Typography>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </AccordionDetails>
          </Accordion>
        </Box>
      )}

      {/* Overrides & Exceptions Section */}
      {(pr?.proformaOverride || pr?.popOverride || pr?.poDocumentOverride || pr?.finalPriceVarianceOverride || pr?.poLineItemDiscrepancyJustification || pr?.ruleValidationOverride || pr?.quoteRequirementOverride) && (
        <Box sx={{ mb: 3 }}>
          <Accordion defaultExpanded={false}>
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              aria-controls="overrides-content"
              id="overrides-header"
              sx={{
                backgroundColor: 'warning.light',
                '&:hover': { backgroundColor: 'warning.main', '& .MuiTypography-root': { color: 'warning.contrastText' } }
              }}
            >
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                ⚠️ {t('pr.overridesExceptions')} ({[
                  pr?.proformaOverride,
                  pr?.popOverride,
                  pr?.poDocumentOverride,
                  pr?.finalPriceVarianceOverride,
                  pr?.poLineItemDiscrepancyJustification,
                  pr?.ruleValidationOverride,
                  pr?.quoteRequirementOverride
                ].filter(Boolean).length})
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ bgcolor: 'warning.lighter', p: 2 }}>
            <Grid container spacing={{ xs: 1.5, sm: 2 }}>
              {pr.ruleValidationOverride && (
                <Grid item xs={12}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle2" color="warning.main" gutterBottom>
                        🔓 {t('pr.ruleValidationOverrideTitle')}
                      </Typography>
                      <Typography variant="body2" gutterBottom>
                        {t('pr.ruleValidationOverrideDesc')}
                      </Typography>
                      <Box sx={{ mt: 1, p: 1, bgcolor: 'background.paper', borderRadius: 1 }}>
                        <Typography variant="caption" color="text.secondary" display="block">
                          <strong>{t('pr.justification')}:</strong>
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 0.5 }}>
                          {pr.ruleValidationOverrideJustification}
                        </Typography>
                      </Box>
                      {pr.ruleValidationOverrideAt && (
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                          {t('pr.overrideApplied', { date: new Date(pr.ruleValidationOverrideAt).toLocaleString() })}
                          {pr.ruleValidationOverrideBy && ` ${t('pr.overrideAppliedBy', { user: pr.ruleValidationOverrideBy })}`}
                        </Typography>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              )}
              {pr.quoteRequirementOverride && (
                <Grid item xs={12}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle2" color="warning.main" gutterBottom>
                        📋 {t('pr.quoteRequirementOverrideTitle')}
                      </Typography>
                      <Typography variant="body2" gutterBottom>
                        {t('pr.quoteRequirementOverrideDesc')}
                      </Typography>
                      <Box sx={{ mt: 1, p: 1, bgcolor: 'background.paper', borderRadius: 1 }}>
                        <Typography variant="caption" color="text.secondary" display="block">
                          <strong>{t('pr.justification')}:</strong>
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 0.5 }}>
                          {pr.quoteRequirementOverrideJustification}
                        </Typography>
                      </Box>
                      {(pr.quoteRequirementOverrideAt || pr.quoteRequirementOverrideBy) && (
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                          Override applied on {pr.quoteRequirementOverrideAt ? new Date(pr.quoteRequirementOverrideAt).toLocaleString() : 'unknown date'}
                          {pr.quoteRequirementOverrideBy && ` by ${userNameCache[pr.quoteRequirementOverrideBy] || pr.quoteRequirementOverrideBy}`}
                        </Typography>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              )}
              {pr.proformaOverride && (
                <Grid item xs={12}>
                  <Card sx={{ bgcolor: 'background.paper' }}>
                    <CardContent>
                      <Typography variant="subtitle2" color="warning.dark" gutterBottom sx={{ fontWeight: 'bold' }}>
                        📄 Proforma Invoice Override
                      </Typography>
                      <Box sx={{ mt: 1, p: 1, bgcolor: 'background.paper', borderRadius: 1 }}>
                        <Typography variant="caption" color="text.secondary" display="block">
                          <strong>Justification:</strong>
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>
                          {pr.proformaOverrideJustification || 'No justification provided'}
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                        {pr.proformaOverrideAt || pr.proformaOverrideBy ? (
                          <>
                            Override applied on {pr.proformaOverrideAt ? new Date(pr.proformaOverrideAt).toLocaleString() : 'unknown date'}
                            {pr.proformaOverrideBy && ` by ${userNameCache[pr.proformaOverrideBy] || pr.proformaOverrideBy}`}
                          </>
                        ) : (
                          'Override applied (date and user not recorded)'
                        )}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              )}

              {pr.popOverride && (
                <Grid item xs={12}>
                  <Card sx={{ bgcolor: 'background.paper' }}>
                    <CardContent>
                      <Typography variant="subtitle2" color="warning.dark" gutterBottom sx={{ fontWeight: 'bold' }}>
                        💰 Proof of Payment Override
                      </Typography>
                      <Box sx={{ mt: 1, p: 1, bgcolor: 'background.paper', borderRadius: 1 }}>
                        <Typography variant="caption" color="text.secondary" display="block">
                          <strong>Justification:</strong>
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>
                          {pr.popOverrideJustification || 'No justification provided'}
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                        {pr.popOverrideAt || pr.popOverrideBy ? (
                          <>
                            Override applied on {pr.popOverrideAt ? new Date(pr.popOverrideAt).toLocaleString() : 'unknown date'}
                            {pr.popOverrideBy && ` by ${userNameCache[pr.popOverrideBy] || pr.popOverrideBy}`}
                          </>
                        ) : (
                          'Override applied (date and user not recorded)'
                        )}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              )}

              {pr.poDocumentOverride && (
                <Grid item xs={12}>
                  <Card sx={{ bgcolor: 'background.paper' }}>
                    <CardContent>
                      <Typography variant="subtitle2" color="warning.dark" gutterBottom sx={{ fontWeight: 'bold' }}>
                        📋 PO Document Override (High-Value PR)
                      </Typography>
                      <Box sx={{ mt: 1, p: 1, bgcolor: 'background.paper', borderRadius: 1 }}>
                        <Typography variant="caption" color="text.secondary" display="block">
                          <strong>Justification:</strong>
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>
                          {pr.poDocumentOverrideJustification || 'No justification provided'}
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                        {pr.poDocumentOverrideAt || pr.poDocumentOverrideBy ? (
                          <>
                            Override applied on {pr.poDocumentOverrideAt ? new Date(pr.poDocumentOverrideAt).toLocaleString() : 'unknown date'}
                            {pr.poDocumentOverrideBy && ` by ${userNameCache[pr.poDocumentOverrideBy] || pr.poDocumentOverrideBy}`}
                          </>
                        ) : (
                          'Override applied (date and user not recorded)'
                        )}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              )}

              {pr.finalPriceVarianceOverride && (
                <Grid item xs={12}>
                  <Card sx={{ bgcolor: 'background.paper' }}>
                    <CardContent>
                      <Typography variant="subtitle2" color="error.dark" gutterBottom sx={{ fontWeight: 'bold' }}>
                        💲 Final Price Variance Override
                      </Typography>
                      {pr.finalPriceVariancePercentage && (
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          <strong>Variance:</strong> {pr.finalPriceVariancePercentage > 0 ? '+' : ''}{pr.finalPriceVariancePercentage.toFixed(2)}%
                          {' '}(Approved: {formatCurrency(pr.approvalWorkflow?.approvedAmount || pr.estimatedAmount, pr.currency || 'LSL')} 
                          → Final: {formatCurrency(pr.finalPrice || 0, pr.finalPriceCurrency || pr.currency || 'LSL')})
                        </Typography>
                      )}
                      <Box sx={{ mt: 1, p: 1, bgcolor: 'background.paper', borderRadius: 1 }}>
                        <Typography variant="caption" color="text.secondary" display="block">
                          <strong>Justification:</strong>
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>
                          {pr.finalPriceVarianceOverrideJustification || 'No justification provided'}
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                        {pr.finalPriceVarianceOverrideAt || pr.finalPriceVarianceOverrideBy ? (
                          <>
                            Override applied on {pr.finalPriceVarianceOverrideAt ? new Date(pr.finalPriceVarianceOverrideAt).toLocaleString() : 'unknown date'}
                            {pr.finalPriceVarianceOverrideBy && ` by ${userNameCache[pr.finalPriceVarianceOverrideBy] || pr.finalPriceVarianceOverrideBy}`}
                          </>
                        ) : (
                          'Override applied (date and user not recorded)'
                        )}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                        ⚠️ This override has been flagged for management review (finalPriceRequiresApproval: {pr.finalPriceRequiresApproval ? 'Yes' : 'No'})
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              )}

              {pr.poLineItemDiscrepancyJustification && (
                <Grid item xs={12}>
                  <Card sx={{ bgcolor: 'background.paper' }}>
                    <CardContent>
                      <Typography variant="subtitle2" color="warning.dark" gutterBottom sx={{ fontWeight: 'bold' }}>
                        🧾 PO Line Items Price Discrepancy
                      </Typography>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        The final price from the proforma invoice did not match the sum of line items (with tax/duty).
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>
                        <strong>Justification:</strong> {pr.poLineItemDiscrepancyJustification}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                        ℹ️ This justification was provided when the PO was generated and has been saved for audit purposes.
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              )}
              
              {/* Debug logging for justification display */}
              {console.log('[PRView] PO Line Item Discrepancy Justification Check:', {
                hasJustification: !!pr.poLineItemDiscrepancyJustification,
                justificationLength: pr.poLineItemDiscrepancyJustification?.length || 0,
                justificationPreview: pr.poLineItemDiscrepancyJustification?.substring(0, 100) || '(none)',
                prId: pr.id,
                allPRFields: Object.keys(pr).sort()
              })}
            </Grid>
            </AccordionDetails>
          </Accordion>
        </Box>
      )}

      {/* Stepper */}
      {isEditMode && (
        <Box sx={{ width: '100%', mb: 4, overflowX: 'auto' }}>
          <Stepper 
            activeStep={activeStep} 
            orientation={isMobile ? 'vertical' : 'horizontal'}
            alternativeLabel={!isMobile}
          >
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </Box>
      )}

      {/* Main Content */}
      <Box sx={{ mb: 4 }}>
        {isEditMode ? (
          <>
            {renderStepContent()}
          </>
        ) : (
          <>
            <Box sx={{ mb: 4 }}>
              {renderBasicInformation()}
            </Box>
            <Box sx={{ mb: 4 }}>
              {renderLineItems()}
            </Box>
            <Box sx={{ mb: 4 }}>
              {renderQuotes()}
            </Box>
          </>
        )}
      </Box>

      {/* Navigation Buttons */}
      {isEditMode && (
        <Box sx={{ 
          display: 'flex', 
          flexDirection: { xs: 'column-reverse', sm: 'row' }, 
          pt: 2,
          gap: 1
        }}>
          <Button
            color="inherit"
            onClick={handleCancel}
            fullWidth={isMobile}
            sx={{ 
              mr: { xs: 0, sm: 1 },
              minHeight: '44px'
            }}
          >
            Cancel
          </Button>
          <Box sx={{ flex: { xs: 'none', sm: '1 1 auto' } }} />
          <Button
            color="inherit"
            disabled={activeStep === 0}
            onClick={handleBack}
            fullWidth={isMobile}
            sx={{ 
              mr: { xs: 0, sm: 1 },
              minHeight: '44px'
            }}
          >
            Back
          </Button>
          {activeStep === steps.length - 1 ? (
            <Tooltip 
              title={approverAmountError || ''} 
              arrow
              placement="top"
            >
              <span>
                <Button 
                  onClick={handleSave} 
                  disabled={loading || !!approverAmountError}
                  variant="contained"
                  color="primary"
                >
                  {loading ? <CircularProgress size={24} /> : 'Save'}
                </Button>
              </span>
            </Tooltip>
          ) : (
            <Button 
              onClick={handleNext} 
              variant="contained" 
              color="primary"
              fullWidth={isMobile}
              sx={{ minHeight: '44px' }}
            >
              Next
            </Button>
          )}
        </Box>
      )}
      <Dialog
        open={isExitingEditMode}
        onClose={cancelExitEditMode}
        aria-labelledby="exit-edit-mode-dialog-title"
      >
        <DialogTitle id="exit-edit-mode-dialog-title">
          {t('pr.unsavedChangesTitle')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('pr.unsavedChangesDesc')}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={cancelExitEditMode} color="primary">
            {t('common.cancel')}
          </Button>
          <Button onClick={confirmExitEditMode} color="error">
            {t('pr.exitWithoutSaving')}
          </Button>
        </DialogActions>
      </Dialog>
      <FilePreviewDialog
        open={previewOpen}
        onClose={handleClosePreview}
        file={previewFile || { name: '', url: '', type: '' }}
      />

      {/* Rule Validation Override Dialog */}
      <Dialog
        open={showRuleOverrideDialog}
        onClose={() => {
          setShowRuleOverrideDialog(false);
          setRuleOverrideJustification('');
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ bgcolor: 'warning.light' }}>
          ⚠️ {t('pr.ruleOverrideRequired')}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Alert severity="error" sx={{ mb: 2 }}>
              <strong>{t('pr.validationIssue')}</strong>
              <br />
              {approverAmountError}
            </Alert>
            
            <Typography variant="body2" sx={{ mb: 2 }}>
              {t('pr.ruleOverrideDesc')}
            </Typography>
            
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t('pr.ruleOverrideNote')}
            </Typography>

            <TextField
              label={`${t('pr.justification')} *`}
              multiline
              rows={4}
              fullWidth
              value={ruleOverrideJustification}
              onChange={(e) => setRuleOverrideJustification(e.target.value)}
              placeholder={t('pr.ruleOverridePlaceholder')}
              required
              sx={{ mt: 1 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setShowRuleOverrideDialog(false);
              setRuleOverrideJustification('');
            }}
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleRuleOverrideConfirm}
            variant="contained"
            color="warning"
            disabled={!ruleOverrideJustification.trim()}
          >
            {t('pr.applyOverride')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
