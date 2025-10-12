import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useSnackbar } from "notistack";
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
import { RootState } from '@/store';
import { prService } from '@/services/pr';
import { PRRequest, PRStatus, LineItem, Quote, Attachment, ApprovalHistoryItem, WorkflowHistoryItem, UserReference as User, PRUpdateParams } from '@/types/pr';
import { ReferenceDataItem } from '@/types/referenceData';
import { formatCurrency } from '@/utils/formatters';
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
import { CircularProgress, Chip } from "@mui/material";
import { db } from "@/config/firebase";
import { collection, doc, getDoc, query, where, getDocs, updateDoc } from "firebase/firestore";
import { QuotesStep } from './steps/QuotesStep';
import { notificationService } from '@/services/notification';
import { approverService } from '@/services/approver';
import * as auth from '@/services/auth';
import { ApproverActions } from './ApproverActions';
import { ApprovedStatusActions } from './ApprovedStatusActions';
import { OrderedStatusActions } from './OrderedStatusActions';
import { ResurrectionActions } from './ResurrectionActions';
import { UrgencyControl } from './UrgencyControl';

interface EditablePRFields {
  department?: string;
  projectCategory?: string;
  site?: string;
  expenseType?: string;
  vehicle?: string;
  preferredVendor?: string;
  estimatedAmount?: number;
  currency?: string;
  requiredDate?: string;
  description?: string;
  approver?: string;
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
            <iframe
              src={`${file.url}#view=FitH`}
              style={{ width: '100%', height: '100%', border: 'none' }}
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
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isEditMode = location.pathname.endsWith('/edit');
  const [pr, setPr] = useState<PRRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editedPR, setEditedPR] = useState<Partial<PRRequest>>({});
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [lineItems, setLineItems] = useState<Array<ExtendedLineItem>>([]);
  const currentUser = useSelector((state: RootState) => state.auth.user);
  const isProcurement = currentUser?.permissionLevel === 2 || currentUser?.permissionLevel === 3;
  const isRequestor = pr?.requestorEmail?.toLowerCase() === currentUser?.email?.toLowerCase();
  const canProcessPR = isProcurement || (isRequestor && (
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
  const [projectCategories, setProjectCategories] = useState<ReferenceDataItem[]>([]);
  const [sites, setSites] = useState<ReferenceDataItem[]>([]);
  const [expenseTypes, setExpenseTypes] = useState<ReferenceDataItem[]>([]);
  const [vehicles, setVehicles] = useState<ReferenceDataItem[]>([]);
  const [vendors, setVendors] = useState<ReferenceDataItem[]>([]);
  const [currencies, setCurrencies] = useState<ReferenceDataItem[]>([]);
  const [loadingReference, setLoadingReference] = useState(true);
  const [approvers, setApprovers] = useState<User[]>([]);
  const [selectedApprover, setSelectedApprover] = useState<string | undefined>(
    pr?.approver || pr?.approvalWorkflow?.currentApprover || undefined
  );
  const [loadingApprovers, setLoadingApprovers] = useState(false);
  const [currentApprover, setCurrentApprover] = useState<User | null>(null);
  const [isLoadingApprover, setIsLoadingApprover] = useState(false);
  const [assignedApprover, setAssignedApprover] = useState<User | null>(null);
  const { enqueueSnackbar } = useSnackbar();
  const [isExitingEditMode, setIsExitingEditMode] = React.useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);

  // Fetch PR data
  const fetchPR = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const prData = await prService.getPR(id);
      console.log('PR data received:', {
        id: prData?.id,
        department: prData?.department,
        organization: prData?.organization,
        requestor: prData?.requestor,
        approvalWorkflow: prData?.approvalWorkflow,
        status: prData?.status
      });

      if (!prData) {
        setError('PR not found');
        return;
      }

      // Initialize approval workflow if missing
      if (!prData.approvalWorkflow) {
        console.log('Initializing missing approval workflow');
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
          console.log('Requestor data loaded:', requestorData);
          
          // Update PR with requestor data
          setPr(prev => ({
            ...prev,
            requestor: requestorData,
            organization: requestorData.organization || prev.organization
          }));
        } catch (error) {
          console.error('Error loading requestor details:', error);
        }
      }

      try {
        // Get organization from PR or requestor
        const organization = prData.organization || prData.requestor?.organization;
        console.log('Using organization for reference data:', {
          organization,
          fromPR: !!prData.organization,
          fromRequestor: !!prData.requestor?.organization,
          approvalWorkflow: prData.approvalWorkflow
        });

        if (!organization) {
          console.error('No organization found in PR data or requestor data');
          throw new Error('No organization found');
        }

        // Load approvers first
        console.log('Loading approvers for organization:', organization);
        const approverList = await approverService.getApprovers(organization);
        console.log('Loaded approvers:', {
          count: approverList.length,
          approvers: approverList.map(a => ({
            id: a.id,
            name: a.name,
            department: a.department,
            permissionLevel: a.permissionLevel,
            organization: a.organization
          }))
        });
        setApprovers(approverList);

        // Set initial selected approver if present
        if (prData.approvalWorkflow?.currentApprover) {
          const currentApprover = approverList.find(a => a.id === prData.approvalWorkflow?.currentApprover);
          console.log('Setting current approver:', {
            workflowApproverId: prData.approvalWorkflow.currentApprover,
            foundApprover: currentApprover,
            workflow: prData.approvalWorkflow
          });
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
        ] = await Promise.all([
          referenceDataService.getDepartments(organization),
          referenceDataService.getItemsByType('projectCategories', organization),
          referenceDataService.getItemsByType('sites', organization),
          referenceDataService.getItemsByType('expenseTypes', organization),
          referenceDataService.getItemsByType('vehicles', organization),
          referenceDataService.getItemsByType('vendors'),
          referenceDataService.getItemsByType('currencies'),
        ]);

        setDepartments(depts);
        setProjectCategories(categories);
        setSites(siteList);
        setExpenseTypes(expenses);
        setVehicles(vehicleList);
        setVendors(vendorList);
        setCurrencies(currencyList);
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
      setLineItems(itemsWithIds);
    }
  }, [pr?.lineItems]);

  useEffect(() => {
    if (!pr?.organization) {
      console.log('No organization available to load approvers');
      return;
    }

    let mounted = true;
    const loadApprovers = async () => {
      try {
        setLoadingApprovers(true);
        console.log('Loading approvers for organization:', pr.organization);
        const approverList = await approverService.getApprovers(pr.organization);
        
        if (!mounted) return;

        console.log('Loaded approvers:', {
          count: approverList.length,
          approvers: approverList.map(a => ({
            id: a.id,
            name: a.name,
            department: a.department,
            permissionLevel: a.permissionLevel
          }))
        });

        setApprovers(approverList);

        // Set initial selected approver if present
        if (pr.approvalWorkflow?.currentApprover) {
          const currentApprover = approverList.find(a => a.id === pr.approvalWorkflow?.currentApprover);
          console.log('Setting current approver:', {
            workflowApproverId: pr.approvalWorkflow.currentApprover,
            foundApprover: currentApprover,
            workflow: pr.approvalWorkflow
          });
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
      // Check pr.approver first as it's the single source of truth
      const approverId = pr?.approver || pr?.approvalWorkflow?.currentApprover;
      
      // Update selectedApprover state for the edit form
      setSelectedApprover(approverId || undefined);
      
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
  }, [pr?.approvalWorkflow?.currentApprover, pr?.approver]);

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

  // Initialize editedPR when entering edit mode
  useEffect(() => {
    if (isEditMode && pr) {
      setEditedPR({
        description: pr.description,
        department: pr.department,
        projectCategory: pr.projectCategory,
        site: pr.site,
        expenseType: pr.expenseType,
        vehicle: pr.vehicle,
        estimatedAmount: pr.estimatedAmount,
        currency: pr.currency,
        requiredDate: pr.requiredDate,
        preferredVendor: pr.preferredVendor,
        comments: pr.comments,
        approver: pr.approver,
      });
    } else {
      setEditedPR({});
    }
  }, [isEditMode, pr]);

  const canEdit = currentUser?.permissionLevel === 1 || // Admin
    (pr?.status === PRStatus.REVISION_REQUIRED && pr?.requestor?.id === currentUser?.id) || // Requestor in REVISION_REQUIRED
    (pr?.status !== PRStatus.REVISION_REQUIRED && currentUser?.permissionLevel <= 3); // Others for non-REVISION_REQUIRED
  const canEditInQueue = pr?.status === PRStatus.IN_QUEUE && (currentUser?.permissionLevel === 1 || currentUser?.permissionLevel === 3);
  
  // Finance/Admin (Level 4) can edit Project Category and Expense Type
  // Procurement (Level 3) CANNOT edit these fields
  const canEditFinancialFields = currentUser?.permissionLevel === 1 || currentUser?.permissionLevel === 4;
  
  const isReadOnlyField = (fieldName: string) => {
    if (!canEditInQueue) return true;
    // Canonical fields that cannot be edited by procurement
    if (['urgency', 'requestor', 'requiredDate'].includes(fieldName)) return true;
    // Financial fields that only Finance/Admin can edit
    if (['projectCategory', 'expenseType'].includes(fieldName) && !canEditFinancialFields) return true;
    return false;
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

  const handleFieldChange = (field: keyof EditablePRFields, value: string | number) => {
    console.log('Handling field change:', { field, value, currentEdits: editedPR });

    // Special handling for expense type changes
    if (field === 'expenseType') {
      const selectedType = expenseTypes.find(type => type.id === value);
      const isVehicleExpense = selectedType?.name.toLowerCase() === 'vehicle';
      
      console.log('Expense type change:', {
        selectedType,
        isVehicleExpense,
        value,
        currentVehicle: editedPR.vehicle
      });

      setEditedPR(prev => {
        if (!isVehicleExpense) {
          // Remove vehicle field for non-vehicle expense types
          const { vehicle, ...rest } = prev;
          console.log('Removing vehicle field:', { before: prev, after: { ...rest, [field]: value } });
          return { ...rest, [field]: value };
        } else {
          // Keep vehicle field for vehicle expense type
          const newState = {
            ...prev,
            [field]: value,
            vehicle: prev.vehicle || pr?.vehicle
          };
          console.log('Updating with vehicle:', { before: prev, after: newState });
          return newState;
        }
      });
    } else {
      setEditedPR(prev => ({
        ...prev,
        [field]: value
      }));
    }

    setHasUnsavedChanges(true);
  };

  const handleApproverChange = (approverId: string) => {
    console.log('Changing approver to:', approverId);
    setSelectedApprover(approverId || undefined);
    handleFieldChange('approver', approverId);
  };

  const handleCancel = (): void => {
    handleExitEditMode();
  };

  const handleSave = async () => {
    if (!pr) {
      enqueueSnackbar('No PR data to save', { variant: 'error' });
      return;
    }
    
    setLoading(true);
    
    try {
      // Prepare the PR data for update
      const updatedPR: PRUpdateParams = {
        ...pr,
        ...editedPR,
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
          currentApprover: pr.approvalWorkflow?.currentApprover || null,
          approvalHistory: pr.approvalWorkflow?.approvalHistory || [],
          lastUpdated: new Date().toISOString()
        }
      };
      
      // Update the PR
      await prService.updatePR(pr.id, updatedPR);
      
      // Refresh the PR data
      await fetchPR();
      
      enqueueSnackbar('PR saved successfully', { variant: 'success' });
      
      // Navigate back to view mode after successful save
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
      <Grid container spacing={2}>
        {/* Editable Information - Left Side */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Basic Information
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Description"
                  value={isEditMode ? editedPR.description || pr?.description : pr?.description}
                  onChange={(e) => handleFieldChange('description', e.target.value)}
                  disabled={!isEditMode}
                  multiline
                  rows={3}
                />
              </Grid>
              <Grid item xs={6}>
                <FormControl fullWidth disabled={!isEditMode}>
                  <InputLabel>Department</InputLabel>
                  <Select
                    value={isEditMode ? (editedPR.department || pr?.department || '') : (pr?.department || '')}
                    onChange={(e) => handleFieldChange('department', e.target.value)}
                    label="Department"
                    renderValue={(value) => {
                      console.log('Rendering department value:', {
                        value,
                        departments: departments,
                        departmentsLength: departments.length,
                        allDepartmentIds: departments.map(d => d.id),
                        matchingDept: departments.find(d => d.id === value),
                        exactMatch: departments.find(d => d.id === value)?.id === value
                      });
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
              <Grid item xs={6}>
                <FormControl fullWidth disabled={!isEditMode || !canEditFinancialFields}>
                  <InputLabel>Project Category</InputLabel>
                  <Select
                    value={isEditMode ? (editedPR.projectCategory || pr?.projectCategory || '') : (pr?.projectCategory || '')}
                    onChange={(e) => handleFieldChange('projectCategory', e.target.value)}
                    label="Project Category"
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
                      Only Finance/Admin can edit this field
                    </Typography>
                  )}
                </FormControl>
              </Grid>
              <Grid item xs={6}>
                <FormControl fullWidth disabled={!isEditMode}>
                  <InputLabel>Site</InputLabel>
                  <Select
                    value={isEditMode ? (editedPR.site || pr?.site || '') : (pr?.site || '')}
                    onChange={(e) => handleFieldChange('site', e.target.value)}
                    label="Site"
                    renderValue={(value) => {
                      const site = sites.find(s => s.id === value);
                      return site ? site.name : value;
                    }}
                  >
                    {sites.map((site) => (
                      <MenuItem key={site.id} value={site.id}>
                        {site.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6}>
                <FormControl fullWidth disabled={!isEditMode || !canEditFinancialFields}>
                  <InputLabel>Expense Type</InputLabel>
                  <Select
                    value={isEditMode ? (editedPR.expenseType || pr?.expenseType || '') : (pr?.expenseType || '')}
                    onChange={(e) => handleFieldChange('expenseType', e.target.value)}
                    label="Expense Type"
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
                      Only Finance/Admin can edit this field
                    </Typography>
                  )}
                </FormControl>
              </Grid>
              {(isEditMode ? editedPR.expenseType || pr?.expenseType : pr?.expenseType) && (
                <Grid item xs={6}>
                  {(() => {
                    const currentExpenseType = isEditMode 
                      ? expenseTypes.find(t => t.id === (editedPR.expenseType || pr?.expenseType))
                      : expenseTypes.find(t => t.id === pr?.expenseType);
                    
                    const isVehicleExpense = currentExpenseType?.name.toLowerCase() === 'vehicle';
                    
                    return isVehicleExpense ? (
                      <FormControl fullWidth disabled={!isEditMode}>
                        <InputLabel>Vehicle</InputLabel>
                        <Select
                          value={isEditMode ? (editedPR.vehicle || pr?.vehicle || '') : (pr?.vehicle || '')}
                          onChange={(e) => handleFieldChange('vehicle', e.target.value)}
                          label="Vehicle"
                          renderValue={(value) => {
                            console.log('Rendering vehicle value:', {
                              value,
                              vehicles,
                              vehiclesLength: vehicles.length,
                              allVehicleIds: vehicles.map(v => v.id),
                              matchingVehicle: vehicles.find(v => v.id === value),
                              exactMatch: vehicles.find(v => v.id === value)?.id === value
                            });
                            const vehicle = vehicles.find(v => v.id === value);
                            return vehicle ? (vehicle.registrationNumber || vehicle.name || vehicle.code) : value;
                          }}
                        >
                          {vehicles.map((vehicle) => {
                            console.log('Rendering vehicle option:', vehicle);
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
              <Grid item xs={6}>
                <FormControl fullWidth disabled={!isEditMode}>
                  <InputLabel>Preferred Vendor</InputLabel>
                  <Select
                    value={isEditMode ? (editedPR.preferredVendor || pr?.preferredVendor || '') : (pr?.preferredVendor || '')}
                    onChange={(e) => handleFieldChange('preferredVendor', e.target.value)}
                    label="Preferred Vendor"
                    renderValue={(value) => {
                      console.log('Rendering vendor value:', {
                        value,
                        vendors,
                        matchingVendor: vendors.find(v => v.id === value)
                      });
                      const vendor = vendors.find(v => v.id === value);
                      // If the value is not a valid vendor ID and not empty, show a warning
                      if (value && !vendor) {
                        console.warn(`Vendor with ID "${value}" not found in reference data`);
                        return `${value} (Vendor not found)`;
                      }
                      return vendor ? vendor.name : '';
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
                </FormControl>
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Estimated Amount"
                  type="number"
                  value={isEditMode ? editedPR.estimatedAmount || pr?.estimatedAmount || '' : pr?.estimatedAmount || ''}
                  onChange={(e) => handleFieldChange('estimatedAmount', parseFloat(e.target.value))}
                  disabled={!isEditMode}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        {pr?.currency}
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Required Date"
                  type="date"
                  value={isEditMode ? editedPR.requiredDate || pr?.requiredDate || '' : pr?.requiredDate || ''}
                  onChange={(e) => handleFieldChange('requiredDate', e.target.value)}
                  disabled={!isEditMode || !canEditRequiredDate}
                  InputLabelProps={{
                    shrink: true,
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Comments"
                  value={isEditMode ? editedPR.comments || pr?.comments : pr?.comments}
                  onChange={(e) => handleFieldChange('comments', e.target.value)}
                  disabled={!isEditMode}
                  multiline
                  rows={2}
                />
              </Grid>
              <Grid item xs={6}>
                <FormControl fullWidth disabled={!isEditMode || (!isProcurement && !isRequestor)}>
                  <InputLabel>Approver</InputLabel>
                  <Select
                    value={selectedApprover || ''}
                    onChange={(e) => handleApproverChange(e.target.value)}
                    label="Approver"
                  >
                    <MenuItem value="">
                      <em>None</em>
                    </MenuItem>
                    {approvers.map((approver) => (
                      <MenuItem key={approver.id} value={approver.id}>
                        {approver.name}{approver.department ? ` (${approver.department})` : ''}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* Additional Information - Right Side */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Additional Information
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography color="textSecondary">Created By</Typography>
                <Typography>
                  {pr?.requestor?.firstName && pr?.requestor?.lastName ? (
                    `${pr.requestor.firstName} ${pr.requestor.lastName}`
                  ) : (
                    console.error('PR requestor not found:', {
                      prId: pr?.id,
                      requestorId: pr?.requestorId,
                      requestorEmail: pr?.requestorEmail
                    }),
                    <span style={{ color: 'red' }}>Error loading user details</span>
                  )}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography color="textSecondary">Created Date</Typography>
                <Typography>
                  {pr?.createdAt ? new Date(pr.createdAt).toLocaleDateString() : 'N/A'}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography color="textSecondary">Last Updated</Typography>
                <Typography>
                  {pr?.updatedAt ? new Date(pr.updatedAt).toLocaleDateString() : 'N/A'}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography color="textSecondary">Organization</Typography>
                <Typography>{pr?.organization || 'N/A'}</Typography>
              </Grid>
              <Grid item xs={6}>
                {currentUser && pr ? (
                  <UrgencyControl
                    pr={pr}
                    currentUser={currentUser}
                    onUpdate={refreshPR}
                  />
                ) : (
                  <Box>
                    <Typography color="textSecondary">Urgency</Typography>
                    <Chip
                      label={pr?.isUrgent || pr?.metrics?.isUrgent ? 'Urgent' : 'Normal'}
                      color={pr?.isUrgent || pr?.metrics?.isUrgent ? 'error' : 'default'}
                      size="small"
                      sx={{ mt: 1 }}
                    />
                  </Box>
                )}
              </Grid>
              <Grid item xs={6}>
                <Typography color="textSecondary">Required Date</Typography>
                <Typography>
                  {pr?.requiredDate ? new Date(pr.requiredDate).toLocaleDateString() : 'Not specified'}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography color="textSecondary">Estimated Amount</Typography>
                <Typography>
                  {pr?.currency} {pr?.estimatedAmount?.toLocaleString() || 'Not specified'}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography color="textSecondary">Preferred Vendor</Typography>
                <Typography>
                  {(() => {
                    if (!pr?.preferredVendor) return 'Not specified';
                    const vendor = vendors.find(v => v.id === pr.preferredVendor);
                    return vendor ? vendor.name : pr.preferredVendor;
                  })()}
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography color="textSecondary">Current Approver</Typography>
                <div className="flex flex-wrap gap-2 mt-1">
                  {(() => {
                    // Check pr.approver first as it's the single source of truth
                    const approverId = pr?.approver || pr?.approvalWorkflow?.currentApprover;
                    console.log('Finding current approver:', { 
                      prApprover: pr?.approver,
                      workflowApprover: pr?.approvalWorkflow?.currentApprover,
                      approverId, 
                      approversCount: approvers.length,
                      approvers: approvers.map(a => ({ id: a.id, name: a.name }))
                    });
                    
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
                          Loading approver information...
                        </Typography>
                      );
                    }

                    const approver = approvers.find(a => a.id === approverId);
                    console.log('Found current approver:', approver);

                    if (!approver) {
                      return (
                        <Typography variant="body2" color="error">
                          Approver not found or inactive (ID: {approverId})
                        </Typography>
                      );
                    }

                    return (
                      <Chip
                        label={`${approver.name}${approver.department ? ` (${approver.department})` : ''}`}
                        color="primary"
                        size="small"
                        sx={{ mt: 1 }}
                      />
                    );
                  })()}
                </div>
              </Grid>
              <Grid item xs={12}>
                <Typography color="textSecondary">Approval History</Typography>
                <div className="flex flex-col gap-2 mt-1">
                  {pr?.approvalWorkflow?.approvalHistory?.length > 0 ? (
                    pr.approvalWorkflow.approvalHistory.map((history, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Chip
                          label={(() => {
                            const approver = approvers.find(a => a.id === history.approverId);
                            return approver ? 
                              `${approver.name}${approver.department ? ` (${approver.department})` : ''}` : 
                              'Loading approver...';
                          })()}
                          color={history.approved ? "success" : "error"}
                          size="small"
                        />
                        <Typography variant="caption" color="textSecondary">
                          {new Date(history.timestamp).toLocaleString()}
                        </Typography>
                        <Typography variant="body2">
                          {history.toStatus || history.step}
                        </Typography>
                      </div>
                    ))
                  ) : (
                    <Typography variant="body2" color="textSecondary">
                      No approval history
                    </Typography>
                  )}
                </div>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    );
  };

  const renderLineItems = () => {
    return (
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6">Line Items</Typography>
              {isEditMode && (
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={handleAddLineItem}
                >
                  Add Line Item
                </Button>
              )}
            </Box>
            <Divider sx={{ mb: 2 }} />
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Description</TableCell>
                    <TableCell align="right">Quantity</TableCell>
                    <TableCell>UOM</TableCell>
                    <TableCell>Notes</TableCell>
                    <TableCell>Attachments</TableCell>
                    <TableCell align="right">Actions</TableCell>
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

  const renderQuotes = () => {
    if (!pr) return null;

    // Allow procurement team to edit quotes in IN_QUEUE status
    const canEditQuotes = currentUser?.permissionLevel >= 2 && 
      pr.status === PRStatus.IN_QUEUE;

    return (
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <Typography variant="h6">Quotes</Typography>
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
      console.log('Loading approvers for organization:', pr?.organization);
      
      if (!pr?.organization) {
        console.log('No organization specified');
        return;
      }

      const approverList = await approverService.getApprovers(pr.organization);
      console.log('Loaded approvers:', {
        count: approverList.length,
        approvers: approverList.map(a => ({
          id: a.id,
          name: a.name,
          department: a.department,
          permissionLevel: a.permissionLevel
        }))
      });
      setApprovers(approverList);

      // Set initial selected approver if present
      if (pr?.approvalWorkflow?.currentApprover) {
        const currentApprover = approverList.find(a => a.id === pr.approvalWorkflow?.currentApprover);
        console.log('Setting current approver:', {
          workflowApproverId: pr.approvalWorkflow.currentApprover,
          foundApprover: currentApprover,
          workflow: pr.approvalWorkflow
        });
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

    console.log('Loading reference data with organization:', {
      organization: pr.organization,
      normalizedOrg: referenceDataService.normalizeOrganizationId(pr.organization)
    });

    Promise.all([
      referenceDataService.getDepartments(pr.organization),
      referenceDataService.getItemsByType('projectCategories', pr.organization),
      referenceDataService.getItemsByType('sites', pr.organization),
      referenceDataService.getItemsByType('expenseTypes', pr.organization),
      referenceDataService.getItemsByType('vehicles', pr.organization),  // Pass organization here
      referenceDataService.getItemsByType('vendors'),  // This is org-independent
      referenceDataService.getItemsByType('currencies'),  // This is org-independent
    ]).then(([depts, projCats, sites, expTypes, vehs, vends, currList]) => {
      console.log('Reference data loaded:', {
        departments: depts.map(d => ({ id: d.id, name: d.name })),
        vendors: vends.length,
        expenseTypes: expTypes.length,
        projectCategories: projCats.length,
        vehicles: vehs.length,
        sites: sites.length
      });

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

  const canEditRequiredDate = !(currentUser?.role === 'procurement' && pr?.status === PRStatus.IN_QUEUE);

  return (
    <Box sx={{ p: 3 }}>
      {/* Debug Information - Commented out after fixing procurement workflow */}
      {/* <UserDebug />
      <ForceUserRefresh /> */}
      
      {/* Header with Title and Actions */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          PR Details: {pr?.prNumber}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/dashboard')}
            variant="outlined"
          >
            Back to Dashboard
          </Button>
          {canEdit && !isEditMode && (
            <Button
              startIcon={<EditIcon />}
              onClick={() => navigate(`/pr/${id}/edit`)}
              variant="contained"
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
            >
              Resubmit PR
            </Button>
          )}
        </Box>
      </Box>

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
          <Paper sx={{ p: 2 }}>
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

      {/* Stepper */}
      {isEditMode && (
        <Box sx={{ width: '100%', mb: 4 }}>
          <Stepper activeStep={activeStep} alternativeLabel>
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
            {renderBasicInformation()}
            {renderLineItems()}
            {renderQuotes()}
          </>
        )}
      </Box>

      {/* Navigation Buttons */}
      {isEditMode && (
        <Box sx={{ display: 'flex', flexDirection: 'row', pt: 2 }}>
          <Button
            color="inherit"
            onClick={handleCancel}
            sx={{ mr: 1 }}
          >
            Cancel
          </Button>
          <Box sx={{ flex: '1 1 auto' }} />
          <Button
            color="inherit"
            disabled={activeStep === 0}
            onClick={handleBack}
            sx={{ mr: 1 }}
          >
            Back
          </Button>
          {activeStep === steps.length - 1 ? (
            <Button onClick={handleSave} disabled={loading}>
              {loading ? <CircularProgress size={24} /> : 'Save'}
            </Button>
          ) : (
            <Button onClick={handleNext}>Next</Button>
          )}
        </Box>
      )}
      <Dialog
        open={isExitingEditMode}
        onClose={cancelExitEditMode}
        aria-labelledby="exit-edit-mode-dialog-title"
      >
        <DialogTitle id="exit-edit-mode-dialog-title">
          Unsaved Changes
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            You have unsaved changes. Are you sure you want to exit edit mode? All changes will be lost.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={cancelExitEditMode} color="primary">
            Cancel
          </Button>
          <Button onClick={confirmExitEditMode} color="error">
            Exit Without Saving
          </Button>
        </DialogActions>
      </Dialog>
      <FilePreviewDialog
        open={previewOpen}
        onClose={handleClosePreview}
        file={previewFile || { name: '', url: '', type: '' }}
      />
    </Box>
  );
}
