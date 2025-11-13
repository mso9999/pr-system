import React, { useState } from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  Tabs,
  Tab,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  List,
  ListItem,
  ListItemText,
  Alert,
  Button,
  IconButton,
  Tooltip,
  TextField,
  InputAdornment,
} from '@mui/material';
import {
  ExpandMore as ExpandIcon,
  Person as RequestorIcon,
  CheckCircle as ApproverIcon,
  ShoppingCart as ProcurementIcon,
  AccountBalance as FinanceIcon,
  AdminPanelSettings as AdminIcon,
  Search as SearchIcon,
  Print as PrintIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { RootState } from '@/store';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`manual-tabpanel-${index}`}
      aria-labelledby={`manual-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

export const UserManual: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const { user } = useSelector((state: RootState) => state.auth);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    window.open('/USER_MANUAL.md', '_blank');
  };

  // Auto-select tab based on user role
  React.useEffect(() => {
    if (user?.permissionLevel === 5) setTabValue(1); // Requestor
    else if (user?.permissionLevel === 2) setTabValue(2); // Approver
    else if (user?.permissionLevel === 3) setTabValue(3); // Procurement
    else if (user?.permissionLevel === 4) setTabValue(4); // Finance
    else if (user?.permissionLevel === 1) setTabValue(5); // Superadmin
  }, [user]);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Paper sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h4" gutterBottom>
              PR System User Manual
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Version 1.0 | Last Updated: November 2025
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Print Manual">
              <IconButton onClick={handlePrint}>
                <PrintIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Download Full Manual">
              <IconButton onClick={handleDownload}>
                <DownloadIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Search */}
        <TextField
          fullWidth
          size="small"
          placeholder="Search manual..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 3 }}
        />

        <Divider sx={{ mb: 3 }} />

        {/* Role-based Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange} variant="scrollable" scrollButtons="auto">
            <Tab label="Getting Started" />
            <Tab icon={<RequestorIcon />} label="Requestor" iconPosition="start" />
            <Tab icon={<ApproverIcon />} label="Approver" iconPosition="start" />
            <Tab icon={<ProcurementIcon />} label="Procurement" iconPosition="start" />
            <Tab icon={<FinanceIcon />} label="Finance/Admin" iconPosition="start" />
            <Tab icon={<AdminIcon />} label="Superadmin" iconPosition="start" />
            <Tab label="FAQs" />
          </Tabs>
        </Box>

        {/* Getting Started */}
        <TabPanel value={tabValue} index={0}>
          <Typography variant="h5" gutterBottom>
            Getting Started with PR System
          </Typography>

          <Alert severity="info" sx={{ mb: 3 }}>
            Welcome to the PR System! This guide will help you get started quickly.
          </Alert>

          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography variant="h6">Logging In</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <List>
                <ListItem>
                  <ListItemText
                    primary="1. Navigate to the PR System URL"
                    secondary="Use the link provided by your administrator"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="2. Click 'Sign in with Google'"
                    secondary="Use your organization Google account"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="3. Wait for account activation"
                    secondary="An administrator will assign your permission level"
                  />
                </ListItem>
              </List>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography variant="h6">User Roles</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box>
                  <Chip icon={<RequestorIcon />} label="Requestor (Level 5)" color="default" sx={{ mr: 1 }} />
                  <Typography variant="body2" display="inline">
                    Create and track purchase requests
                  </Typography>
                </Box>
                <Box>
                  <Chip icon={<ApproverIcon />} label="Approver (Level 2)" color="primary" sx={{ mr: 1 }} />
                  <Typography variant="body2" display="inline">
                    Review and approve/reject purchase requests
                  </Typography>
                </Box>
                <Box>
                  <Chip icon={<ProcurementIcon />} label="Procurement (Level 3)" color="info" sx={{ mr: 1 }} />
                  <Typography variant="body2" display="inline">
                    Manage quotes, vendors, and order processing
                  </Typography>
                </Box>
                <Box>
                  <Chip icon={<FinanceIcon />} label="Finance/Admin (Level 4)" color="success" sx={{ mr: 1 }} />
                  <Typography variant="body2" display="inline">
                    Handle payments and financial compliance
                  </Typography>
                </Box>
                <Box>
                  <Chip icon={<AdminIcon />} label="Superadmin (Level 1)" color="error" sx={{ mr: 1 }} />
                  <Typography variant="body2" display="inline">
                    Full system access and configuration
                  </Typography>
                </Box>
              </Box>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography variant="h6">Dashboard Overview</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <List>
                <ListItem>
                  <ListItemText
                    primary="Key Metrics"
                    secondary="Total PRs, Urgent PRs, Average Days Open, Overdue PRs"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="My PRs Toggle"
                    secondary="Filter to see only PRs relevant to you (sidebar)"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="PR/PO Table"
                    secondary="List of all purchase requests and orders with filters"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Search & Filters"
                    secondary="Find PRs by number, vendor, status, date, and more"
                  />
                </ListItem>
              </List>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography variant="h6">PR Status Flow</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Alert severity="success" sx={{ mb: 2 }}>
                <Typography variant="body2" component="pre" sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
{`SUBMITTED → IN_QUEUE → PENDING_APPROVAL → 
APPROVED → ORDERED → COMPLETED`}
                </Typography>
              </Alert>
              <List dense>
                <ListItem>
                  <ListItemText primary="SUBMITTED" secondary="PR created by requestor" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="IN_QUEUE" secondary="Procurement adding quotes" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="PENDING_APPROVAL" secondary="Waiting for approver" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="APPROVED" secondary="Approved, ready for ordering" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="ORDERED" secondary="Order placed with vendor" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="COMPLETED" secondary="Items delivered and order closed" />
                </ListItem>
              </List>
            </AccordionDetails>
          </Accordion>
        </TabPanel>

        {/* Requestor Guide */}
        <TabPanel value={tabValue} index={1}>
          <Typography variant="h5" gutterBottom>
            Requestor Guide
          </Typography>
          <Typography variant="body1" paragraph color="textSecondary">
            As a Requestor, you create Purchase Requests when your department needs to buy goods or services.
          </Typography>

          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography variant="h6">Creating a New PR</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <List>
                <ListItem>
                  <ListItemText
                    primary="Step 1: Click 'NEW PR' button"
                    secondary="Located in top right corner of dashboard"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Step 2: Fill Basic Information"
                    secondary="Organization, Department, Category, Description, Amount, Currency, Required Date"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Step 3: Add Line Items"
                    secondary="Click 'Add Line Item' for each product/service needed"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Step 4: Upload Documents"
                    secondary="Supporting documents like specs, drawings, or existing quotes"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Step 5: Review and Submit"
                    secondary="Double-check all information and click 'Submit PR'"
                  />
                </ListItem>
              </List>
              <Alert severity="warning" sx={{ mt: 2 }}>
                <strong>Important:</strong> All fields marked with * are required. PRs cannot be edited after submission.
              </Alert>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography variant="h6">Tracking Your PRs</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" paragraph>
                To view your PRs:
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemText primary="1. Enable 'My PRs' toggle in sidebar" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="2. PRs you created will be shown" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="3. Check Status column to see progress" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="4. Click PR number to view full details" />
                </ListItem>
              </List>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography variant="h6">Responding to Revision Requests</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Alert severity="info" sx={{ mb: 2 }}>
                When status is REVISION_REQUIRED, action is needed from you!
              </Alert>
              <List dense>
                <ListItem>
                  <ListItemText primary="1. Click on your PR to open it" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="2. Read the Revision Notes carefully" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="3. Click 'Edit' button" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="4. Make requested changes" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="5. Add note explaining changes" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="6. Click 'Resubmit'" />
                </ListItem>
              </List>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography variant="h6">Tips for Requestors</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Alert severity="success">
                  <strong>DO:</strong>
                  <ul>
                    <li>Provide detailed descriptions</li>
                    <li>Upload supporting documents</li>
                    <li>Respond quickly to revision requests</li>
                    <li>Include technical specifications</li>
                  </ul>
                </Alert>
                <Alert severity="error">
                  <strong>DON'T:</strong>
                  <ul>
                    <li>Mark everything as urgent</li>
                    <li>Submit incomplete information</li>
                    <li>Split purchases to avoid approval thresholds</li>
                    <li>Ignore email notifications</li>
                  </ul>
                </Alert>
              </Box>
            </AccordionDetails>
          </Accordion>
        </TabPanel>

        {/* Approver Guide */}
        <TabPanel value={tabValue} index={2}>
          <Typography variant="h5" gutterBottom>
            Approver Guide
          </Typography>
          <Typography variant="body1" paragraph color="textSecondary">
            As an Approver, you review PRs to ensure they're necessary, properly justified, and follow company policies.
          </Typography>

          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography variant="h6">Finding PRs to Approve</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <List>
                <ListItem>
                  <ListItemText
                    primary="Enable 'My PRs' toggle"
                    secondary="Shows PRs where you're the assigned approver"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Filter by PENDING_APPROVAL status"
                    secondary="Click Status dropdown and select PENDING_APPROVAL"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Check email notifications"
                    secondary="You receive emails when PRs are assigned to you"
                  />
                </ListItem>
              </List>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography variant="h6">What to Check Before Approving</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <List dense>
                <ListItem>
                  <ListItemText primary="✓ Description is clear and justified" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="✓ Amount is reasonable" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="✓ Quantities make sense" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="✓ Required quotes are attached" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="✓ Prices are competitive" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="✓ Within budget expectations" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="✓ Urgency is justified (if marked urgent)" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="✓ Vendor selection is appropriate" />
                </ListItem>
              </List>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography variant="h6">Approval Actions</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle1" color="success.main" gutterBottom>
                    <strong>Approve</strong>
                  </Typography>
                  <Typography variant="body2">
                    1. Scroll to "Approver Actions" section<br />
                    2. Click "Approve" button<br />
                    3. Add notes (optional but recommended)<br />
                    4. Click "Confirm Approval"<br />
                    5. PR moves to next stage
                  </Typography>
                </Paper>

                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle1" color="warning.main" gutterBottom>
                    <strong>Request Revision</strong>
                  </Typography>
                  <Typography variant="body2">
                    1. Click "Request Revision" button<br />
                    2. Enter detailed notes explaining what needs to change<br />
                    3. Click "Confirm"<br />
                    4. PR goes back to requestor<br />
                    5. Status becomes REVISION_REQUIRED
                  </Typography>
                </Paper>

                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle1" color="error.main" gutterBottom>
                    <strong>Reject</strong>
                  </Typography>
                  <Typography variant="body2">
                    1. Click "Reject" button<br />
                    2. <strong>MUST provide justification</strong><br />
                    3. Click "Confirm Rejection"<br />
                    4. PR status becomes REJECTED (terminal)<br />
                    5. All stakeholders notified
                  </Typography>
                </Paper>
              </Box>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography variant="h6">Quote Requirements</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Alert severity="info" sx={{ mb: 2 }}>
                The system automatically enforces quote rules based on the PR amount
              </Alert>
              <List dense>
                <ListItem>
                  <ListItemText
                    primary="Below Rule 1 threshold"
                    secondary="1 quote required"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Above Rule 1, below Rule 2"
                    secondary="3 quotes required (or 1 from approved vendor)"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Above Rule 2 threshold"
                    secondary="3 quotes + second approver required"
                  />
                </ListItem>
              </List>
              <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                * Thresholds are organization-specific. Contact your administrator for details.
              </Typography>
            </AccordionDetails>
          </Accordion>
        </TabPanel>

        {/* Procurement Guide */}
        <TabPanel value={tabValue} index={3}>
          <Typography variant="h5" gutterBottom>
            Procurement Guide
          </Typography>
          <Typography variant="body1" paragraph color="textSecondary">
            As Procurement, you're the hub of the PR process. You manage quotes, vendors, and ensure smooth workflow.
          </Typography>

          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography variant="h6">Processing New PRs (SUBMITTED)</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <List>
                <ListItem>
                  <ListItemText
                    primary="1. Review for completeness"
                    secondary="Check all required fields, documents, and clarity"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="2. Click 'Move to In Queue'"
                    secondary="Status changes to IN_QUEUE"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="3. Add notes (optional)"
                    secondary="'Working on obtaining quotes' or 'Contacting vendors'"
                  />
                </ListItem>
              </List>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography variant="h6">Adding Quotes (IN_QUEUE)</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Alert severity="warning" sx={{ mb: 2 }}>
                Check "Quote Requirements" section to see how many quotes are needed
              </Alert>
              <List dense>
                <ListItem>
                  <ListItemText primary="1. Scroll to 'Quotes' section" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="2. Click 'Add Quote'" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="3. Fill in: Vendor, Amount, Currency, Valid Until, Lead Time" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="4. Upload quote document (usually required)" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="5. Click 'Save Quote'" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="6. Repeat for additional vendors" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="7. Mark preferred quote" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="8. Click 'Submit for Approval'" />
                </ListItem>
              </List>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography variant="h6">3-Quote Override</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" paragraph>
                If you can't get 3 quotes (vendor monopoly, urgent need, etc.):
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemText primary="1. Add the quotes you have (at least 1)" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="2. Check 'Override Quote Requirement' checkbox" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="3. MUST provide detailed justification" />
                </ListItem>
              </List>
              <Alert severity="info" sx={{ mt: 2 }}>
                Approver will review your justification before deciding
              </Alert>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography variant="h6">✨ Generating RFQs (Request for Quotation)</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" paragraph>
                Generate professional RFQ PDFs to send to vendors when PR is in <Chip label="IN_QUEUE" size="small" color="warning" /> status.
              </Typography>
              
              <Alert severity="success" icon={<DownloadIcon />} sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom><strong>Two Ways to Add Line Items:</strong></Typography>
                <Typography variant="body2">• Manual Entry - Best for small orders (1-5 items)</Typography>
                <Typography variant="body2">• Bulk Upload (CSV/Excel) - Best for large orders (dozens/hundreds of items)</Typography>
              </Alert>

              <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}><strong>Bulk Upload Process:</strong></Typography>
              <List dense>
                <ListItem>
                  <ListItemText 
                    primary="1. Download Template" 
                    secondary="Click 'Download Template' → Choose Excel (.xlsx) or CSV format"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="2. Fill Template"
                    secondary="Columns: Description, Quantity, UOM, Notes, Est. Price, File/Folder Link (optional)"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="3. Add File Links (Optional)"
                    secondary="Paste Dropbox/Google Drive/OneDrive 'Copy Link' URLs - System auto-converts them!"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="4. Upload File"
                    secondary="Click 'Upload Line Items' → Select your filled template"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="5. Choose Mode"
                    secondary="Overwrite (replace all) OR Add (append to existing)"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="6. Apply & Generate"
                    secondary="Click 'Apply' → Then 'Generate RFQ' → Professional PDF downloads"
                  />
                </ListItem>
              </List>

              <Alert severity="info" icon={<SearchIcon />} sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom><strong>🔗 Automatic URL Conversion:</strong></Typography>
                <Typography variant="body2">Dropbox: www.dropbox.com → dl.dropboxusercontent.com ✓</Typography>
                <Typography variant="body2">Google Drive: drive.google.com/file/d/ID/view → direct download ✓</Typography>
                <Typography variant="body2">OneDrive: Adds download parameter automatically ✓</Typography>
                <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
                  Just paste "Copy Link" URLs - no manual conversion needed!
                </Typography>
              </Alert>

              <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}><strong>Troubleshooting:</strong></Typography>
              <List dense>
                <ListItem>
                  <ListItemText 
                    primary="File download fails?" 
                    secondary="Ensure files don't require login. Links are preserved as clickable URLs if download fails."
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="UOM invalid?" 
                    secondary="Use standard UOMs from Reference Data (M, KG, UNIT, L, etc.)"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="Template parsing error?" 
                    secondary="Don't change column headers. Instruction/example rows are auto-skipped."
                  />
                </ListItem>
              </List>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography variant="h6">Managing Vendors</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" paragraph>
                Access: Admin → Reference Data → Vendors
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemText primary="Add new vendors" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="View vendor details (click vendor row)" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="Upload vendor documents (incorporation, tax cert, etc.)" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="View all PRs associated with vendor" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="Manually approve/de-approve vendors" />
                </ListItem>
              </List>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography variant="h6">Placing Orders (APPROVED)</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <List dense>
                <ListItem>
                  <ListItemText primary="1. Filter by status: APPROVED" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="2. Open PR and review approved quote" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="3. Create PO with selected vendor" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="4. Click 'Move to Ordered'" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="5. Enter: Selected Vendor, Final Amount, PO Number, Delivery Date" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="6. Upload proforma invoice (required)" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="7. Click 'Confirm'" />
                </ListItem>
              </List>
            </AccordionDetails>
          </Accordion>
        </TabPanel>

        {/* Finance/Admin Guide */}
        <TabPanel value={tabValue} index={4}>
          <Typography variant="h5" gutterBottom>
            Finance/Admin Guide
          </Typography>
          <Typography variant="body1" paragraph color="textSecondary">
            Finance/Admin handles payments and closes completed orders.
          </Typography>

          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography variant="h6">Reviewing Approved PRs</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <List dense>
                <ListItem>
                  <ListItemText primary="Filter by status: APPROVED" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="Verify budget allocation" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="Check amount within limits" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="Review vendor payment terms" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="Add notes if financial concerns" />
                </ListItem>
              </List>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography variant="h6">Closing Completed Orders</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" paragraph>
                When items are delivered and verified:
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemText primary="1. Filter by status: ORDERED" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="2. Open the PR" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="3. Verify delivery documentation uploaded" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="4. Answer: 'Order closed without issues?'" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="5. Click 'Move to Completed'" />
                </ListItem>
              </List>

              <Alert severity="success" sx={{ mt: 2 }}>
                <Typography variant="body2" fontWeight="bold">If NO issues (YES selected):</Typography>
                <Typography variant="body2">
                  • Vendor automatically approved for 6-12 months<br />
                  • Status changes to COMPLETED<br />
                  • All stakeholders notified
                </Typography>
              </Alert>

              <Alert severity="warning" sx={{ mt: 2 }}>
                <Typography variant="body2" fontWeight="bold">If issues occurred (NO selected):</Typography>
                <Typography variant="body2">
                  • MUST enter issue notes<br />
                  • Optional: Check "Approve vendor despite issues"<br />
                  • Issue logged to vendor record<br />
                  • Can still close order
                </Typography>
              </Alert>
            </AccordionDetails>
          </Accordion>
        </TabPanel>

        {/* Superadmin Guide */}
        <TabPanel value={tabValue} index={5}>
          <Typography variant="h5" gutterBottom>
            Superadmin Guide
          </Typography>
          <Typography variant="body1" paragraph color="textSecondary">
            As Superadmin, you have full system access and configuration capabilities.
          </Typography>

          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography variant="h6">User Management</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" paragraph>
                Access: Admin → User Management
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemText primary="Add new users (must use Google account email)" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="Assign permission levels (1-5)" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="Update user organizations/departments" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="Activate/deactivate user accounts" />
                </ListItem>
              </List>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography variant="h6">Organization Configuration</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" paragraph>
                Access: Admin → Organization Settings
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemText primary="Set Rule 1 & Rule 2 thresholds" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="Configure quote requirements" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="Set vendor approval durations" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="Define high-value vendor thresholds" />
                </ListItem>
              </List>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography variant="h6">Reference Data Management</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" paragraph>
                Access: Admin → Reference Data
              </Typography>
              <Typography variant="body2" paragraph>
                Manage:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                <Chip label="Departments" size="small" />
                <Chip label="Project Categories" size="small" />
                <Chip label="Sites" size="small" />
                <Chip label="Expense Types" size="small" />
                <Chip label="Vehicles" size="small" />
                <Chip label="Vendors" size="small" />
                <Chip label="Currencies" size="small" />
                <Chip label="Units of Measure" size="small" />
              </Box>
            </AccordionDetails>
          </Accordion>
        </TabPanel>

        {/* FAQs */}
        <TabPanel value={tabValue} index={6}>
          <Typography variant="h5" gutterBottom>
            Frequently Asked Questions
          </Typography>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography>Who can create a PR?</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2">
                Any user with Requestor level (5) or higher permissions can create a PR.
              </Typography>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography>Can I edit a PR after submitting?</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2">
                No, PRs cannot be edited after submission. If changes are needed, the approver must request revision,
                which sends the PR back to you for editing. Alternatively, you can cancel and create a new PR.
              </Typography>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography>How long does approval take?</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2">
                Typically 1-3 business days depending on the complexity and amount. Urgent PRs may be processed faster.
                You'll receive email notifications when status changes.
              </Typography>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography>When should I mark a PR as urgent?</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2">
                Only when there's a genuine urgent need such as equipment breakdown, critical deadline, or safety issue.
                Don't mark everything urgent as it reduces the priority of truly urgent requests.
              </Typography>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography>What file types can I upload?</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2">
                Images (JPG, PNG, GIF), Documents (PDF, DOC, DOCX), Spreadsheets (XLS, XLSX).
                Maximum file size is 10MB per file.
              </Typography>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography>How do I check PR status?</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2">
                Enable "My PRs" toggle in the sidebar to see your PRs. Check the Status column, or click on the PR
                number to see full details including complete status history.
              </Typography>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography>What if I can't login?</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2">
                Verify you're using your organization Google account. Contact your administrator to ensure your account
                exists in the system and is activated. Try clearing browser cache or using incognito mode.
              </Typography>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography>Where can I get more help?</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2">
                Contact your IT support team or system administrator. Have your name, email, PR number (if applicable),
                and description of the issue ready.
              </Typography>
            </AccordionDetails>
          </Accordion>
        </TabPanel>

        {/* Footer */}
        <Divider sx={{ my: 3 }} />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="caption" color="textSecondary">
            Need more help? Contact your system administrator
          </Typography>
          <Button
            variant="outlined"
            size="small"
            onClick={handleDownload}
            startIcon={<DownloadIcon />}
          >
            Download Full Manual
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};

