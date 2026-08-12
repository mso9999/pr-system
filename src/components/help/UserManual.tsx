import React, { useState, useMemo } from 'react';
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
  Clear as ClearIcon,
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { RootState } from '@/store';
import { useTranslation } from 'react-i18next';

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

interface SearchSection {
  tabId: number;
  tabLabelKey: string;
  sectionTitleKey: string;
  contentKeys: string[];
}

const SEARCH_INDEX: SearchSection[] = [
  // Getting Started
  { tabId: 0, tabLabelKey: 'manual.tabs.gettingStarted', sectionTitleKey: 'manual.gettingStarted.loggingIn',
    contentKeys: ['manual.gettingStarted.loginStep1', 'manual.gettingStarted.loginStep1Desc', 'manual.gettingStarted.loginStep2', 'manual.gettingStarted.loginStep2Desc', 'manual.gettingStarted.loginStep3', 'manual.gettingStarted.loginStep3Desc'] },
  { tabId: 0, tabLabelKey: 'manual.tabs.gettingStarted', sectionTitleKey: 'manual.gettingStarted.userRoles',
    contentKeys: ['manual.gettingStarted.roleRequestor', 'manual.gettingStarted.roleRequestorDesc', 'manual.gettingStarted.roleApprover', 'manual.gettingStarted.roleApproverDesc', 'manual.gettingStarted.roleProcurement', 'manual.gettingStarted.roleProcurementDesc', 'manual.gettingStarted.roleFinance', 'manual.gettingStarted.roleFinanceDesc', 'manual.gettingStarted.roleSuperadmin', 'manual.gettingStarted.roleSuperadminDesc'] },
  { tabId: 0, tabLabelKey: 'manual.tabs.gettingStarted', sectionTitleKey: 'manual.gettingStarted.dashboardOverview',
    contentKeys: ['manual.gettingStarted.dashboardMetrics', 'manual.gettingStarted.dashboardMetricsDesc', 'manual.gettingStarted.dashboardMyPRs', 'manual.gettingStarted.dashboardMyPRsDesc', 'manual.gettingStarted.dashboardTable', 'manual.gettingStarted.dashboardTableDesc', 'manual.gettingStarted.dashboardSearch', 'manual.gettingStarted.dashboardSearchDesc'] },
  { tabId: 0, tabLabelKey: 'manual.tabs.gettingStarted', sectionTitleKey: 'manual.gettingStarted.prStatusFlow',
    contentKeys: ['manual.gettingStarted.statusSubmitted', 'manual.gettingStarted.statusSubmittedDesc', 'manual.gettingStarted.statusInQueue', 'manual.gettingStarted.statusInQueueDesc', 'manual.gettingStarted.statusPendingApproval', 'manual.gettingStarted.statusPendingApprovalDesc', 'manual.gettingStarted.statusApproved', 'manual.gettingStarted.statusApprovedDesc', 'manual.gettingStarted.statusOrdered', 'manual.gettingStarted.statusOrderedDesc', 'manual.gettingStarted.statusCompleted', 'manual.gettingStarted.statusCompletedDesc'] },
  // Requestor
  { tabId: 1, tabLabelKey: 'manual.tabs.requestor', sectionTitleKey: 'manual.requestor.creatingPR',
    contentKeys: ['manual.requestor.step1', 'manual.requestor.step1Desc', 'manual.requestor.step2', 'manual.requestor.step2Desc', 'manual.requestor.step3', 'manual.requestor.step3Desc', 'manual.requestor.step4', 'manual.requestor.step4Desc', 'manual.requestor.step5', 'manual.requestor.step5Desc', 'manual.requestor.important', 'manual.requestor.importantNote'] },
  { tabId: 1, tabLabelKey: 'manual.tabs.requestor', sectionTitleKey: 'manual.requestor.trackingPRs',
    contentKeys: ['manual.requestor.trackingDesc', 'manual.requestor.trackingStep1', 'manual.requestor.trackingStep2', 'manual.requestor.trackingStep3', 'manual.requestor.trackingStep4'] },
  { tabId: 1, tabLabelKey: 'manual.tabs.requestor', sectionTitleKey: 'manual.requestor.revisionRequests',
    contentKeys: ['manual.requestor.revisionAlert', 'manual.requestor.revisionStep1', 'manual.requestor.revisionStep2', 'manual.requestor.revisionStep3', 'manual.requestor.revisionStep4', 'manual.requestor.revisionStep5', 'manual.requestor.revisionStep6'] },
  { tabId: 1, tabLabelKey: 'manual.tabs.requestor', sectionTitleKey: 'manual.requestor.tips',
    contentKeys: ['manual.requestor.do', 'manual.requestor.do1', 'manual.requestor.do2', 'manual.requestor.do3', 'manual.requestor.do4', 'manual.requestor.dont', 'manual.requestor.dont1', 'manual.requestor.dont2', 'manual.requestor.dont3', 'manual.requestor.dont4'] },
  // Approver
  { tabId: 2, tabLabelKey: 'manual.tabs.approver', sectionTitleKey: 'manual.approver.findingPRs',
    contentKeys: ['manual.approver.findingStep1', 'manual.approver.findingStep1Desc', 'manual.approver.findingStep2', 'manual.approver.findingStep2Desc', 'manual.approver.findingStep3', 'manual.approver.findingStep3Desc'] },
  { tabId: 2, tabLabelKey: 'manual.tabs.approver', sectionTitleKey: 'manual.approver.checkBeforeApproving',
    contentKeys: ['manual.approver.check1', 'manual.approver.check2', 'manual.approver.check3', 'manual.approver.check4', 'manual.approver.check5', 'manual.approver.check6', 'manual.approver.check7', 'manual.approver.check8'] },
  { tabId: 2, tabLabelKey: 'manual.tabs.approver', sectionTitleKey: 'manual.approver.approvalActions',
    contentKeys: ['manual.approver.approve', 'manual.approver.approveSteps', 'manual.approver.requestRevision', 'manual.approver.revisionSteps', 'manual.approver.reject', 'manual.approver.rejectSteps'] },
  { tabId: 2, tabLabelKey: 'manual.tabs.approver', sectionTitleKey: 'manual.approver.quoteRequirements',
    contentKeys: ['manual.approver.quoteInfo', 'manual.approver.quoteBelowRule1', 'manual.approver.quoteBelowRule1Desc', 'manual.approver.quoteBetweenRules', 'manual.approver.quoteBetweenRulesDesc', 'manual.approver.quoteAboveRule2', 'manual.approver.quoteAboveRule2Desc', 'manual.approver.quoteNote'] },
  { tabId: 2, tabLabelKey: 'manual.tabs.approver', sectionTitleKey: 'manual.approver.amendmentTitle',
    contentKeys: ['manual.approver.amendmentDesc', 'manual.approver.amendReviewStep1', 'manual.approver.amendReviewStep1Desc', 'manual.approver.amendReviewStep2', 'manual.approver.amendReviewStep2Desc', 'manual.approver.amendReviewStep3', 'manual.approver.amendReviewStep3Desc', 'manual.approver.amendDualNote'] },
  // Procurement
  { tabId: 3, tabLabelKey: 'manual.tabs.procurement', sectionTitleKey: 'manual.procurement.processingNewPRs',
    contentKeys: ['manual.procurement.processStep1', 'manual.procurement.processStep1Desc', 'manual.procurement.processStep2', 'manual.procurement.processStep2Desc', 'manual.procurement.processStep3', 'manual.procurement.processStep3Desc'] },
  { tabId: 3, tabLabelKey: 'manual.tabs.procurement', sectionTitleKey: 'manual.procurement.addingQuotes',
    contentKeys: ['manual.procurement.quoteWarning', 'manual.procurement.quoteStep1', 'manual.procurement.quoteStep2', 'manual.procurement.quoteStep3', 'manual.procurement.quoteStep4', 'manual.procurement.quoteStep5', 'manual.procurement.quoteStep6', 'manual.procurement.quoteStep7', 'manual.procurement.quoteStep8'] },
  { tabId: 3, tabLabelKey: 'manual.tabs.procurement', sectionTitleKey: 'manual.procurement.quoteOverride',
    contentKeys: ['manual.procurement.overrideDesc', 'manual.procurement.overrideStep1', 'manual.procurement.overrideStep2', 'manual.procurement.overrideStep3', 'manual.procurement.overrideNote'] },
  { tabId: 3, tabLabelKey: 'manual.tabs.procurement', sectionTitleKey: 'manual.procurement.generatingRFQs',
    contentKeys: ['manual.procurement.rfqDesc', 'manual.procurement.rfqTwoWays', 'manual.procurement.rfqManual', 'manual.procurement.rfqBulk', 'manual.procurement.rfqBulkProcess', 'manual.procurement.rfqStep1', 'manual.procurement.rfqStep1Desc', 'manual.procurement.rfqStep2', 'manual.procurement.rfqStep2Desc', 'manual.procurement.rfqStep3', 'manual.procurement.rfqStep3Desc', 'manual.procurement.rfqStep4', 'manual.procurement.rfqStep4Desc', 'manual.procurement.rfqStep5', 'manual.procurement.rfqStep5Desc', 'manual.procurement.rfqStep6', 'manual.procurement.rfqStep6Desc', 'manual.procurement.rfqAutoConversion', 'manual.procurement.rfqDropbox', 'manual.procurement.rfqGoogleDrive', 'manual.procurement.rfqOneDrive', 'manual.procurement.rfqAutoNote', 'manual.procurement.rfqTroubleshooting', 'manual.procurement.rfqTrouble1', 'manual.procurement.rfqTrouble1Desc', 'manual.procurement.rfqTrouble2', 'manual.procurement.rfqTrouble2Desc', 'manual.procurement.rfqTrouble3', 'manual.procurement.rfqTrouble3Desc'] },
  { tabId: 3, tabLabelKey: 'manual.tabs.procurement', sectionTitleKey: 'manual.procurement.managingVendors',
    contentKeys: ['manual.procurement.vendorAccess', 'manual.procurement.vendorStep1', 'manual.procurement.vendorStep2', 'manual.procurement.vendorStep3', 'manual.procurement.vendorStep4', 'manual.procurement.vendorStep5'] },
  { tabId: 3, tabLabelKey: 'manual.tabs.procurement', sectionTitleKey: 'manual.procurement.placingOrders',
    contentKeys: ['manual.procurement.orderStep1', 'manual.procurement.orderStep2', 'manual.procurement.orderStep3', 'manual.procurement.orderStep4', 'manual.procurement.orderStep5', 'manual.procurement.orderStep6', 'manual.procurement.orderStep7'] },
  { tabId: 3, tabLabelKey: 'manual.tabs.procurement', sectionTitleKey: 'manual.procurement.amendmentTitle',
    contentKeys: ['manual.procurement.amendmentInfo', 'manual.procurement.amendmentDesc', 'manual.procurement.amendStep1', 'manual.procurement.amendStep1Desc', 'manual.procurement.amendStep2', 'manual.procurement.amendStep2Desc', 'manual.procurement.amendStep3', 'manual.procurement.amendStep3Desc', 'manual.procurement.amendStep4', 'manual.procurement.amendStep4Desc', 'manual.procurement.amendStep5', 'manual.procurement.amendStep5Desc', 'manual.procurement.amendNote'] },
  // Finance/Admin
  { tabId: 4, tabLabelKey: 'manual.tabs.financeAdmin', sectionTitleKey: 'manual.finance.reviewingApproved',
    contentKeys: ['manual.finance.reviewStep1', 'manual.finance.reviewStep2', 'manual.finance.reviewStep3', 'manual.finance.reviewStep4', 'manual.finance.reviewStep5'] },
  { tabId: 4, tabLabelKey: 'manual.tabs.financeAdmin', sectionTitleKey: 'manual.finance.uploadingPoP',
    contentKeys: ['manual.finance.uploadingPoPDesc', 'manual.finance.popStep1', 'manual.finance.popStep2', 'manual.finance.popStep3', 'manual.finance.popStep4', 'manual.finance.popStep5', 'manual.finance.popStep6', 'manual.finance.popNote'] },
  { tabId: 4, tabLabelKey: 'manual.tabs.financeAdmin', sectionTitleKey: 'manual.finance.closingCompleted',
    contentKeys: ['manual.finance.closingDesc', 'manual.finance.closingStep1', 'manual.finance.closingStep2', 'manual.finance.closingStep3', 'manual.finance.closingStep4', 'manual.finance.closingStep5', 'manual.finance.closingSuccess', 'manual.finance.closingSuccess1', 'manual.finance.closingSuccess2', 'manual.finance.closingSuccess3', 'manual.finance.closingWarning', 'manual.finance.closingWarning1', 'manual.finance.closingWarning2', 'manual.finance.closingWarning3', 'manual.finance.closingWarning4'] },
  // Superadmin
  { tabId: 5, tabLabelKey: 'manual.tabs.superadmin', sectionTitleKey: 'manual.superadmin.userManagement',
    contentKeys: ['manual.superadmin.userAccess', 'manual.superadmin.userStep1', 'manual.superadmin.userStep2', 'manual.superadmin.userStep3', 'manual.superadmin.userStep4'] },
  { tabId: 5, tabLabelKey: 'manual.tabs.superadmin', sectionTitleKey: 'manual.superadmin.orgConfig',
    contentKeys: ['manual.superadmin.orgAccess', 'manual.superadmin.orgStep1', 'manual.superadmin.orgStep2', 'manual.superadmin.orgStep3', 'manual.superadmin.orgStep4'] },
  { tabId: 5, tabLabelKey: 'manual.tabs.superadmin', sectionTitleKey: 'manual.superadmin.referenceData',
    contentKeys: ['manual.superadmin.refAccess', 'manual.superadmin.refManage', 'manual.superadmin.refDept', 'manual.superadmin.refCategory', 'manual.superadmin.refSite', 'manual.superadmin.refExpense', 'manual.superadmin.refVehicle', 'manual.superadmin.refVendor', 'manual.superadmin.refCurrency', 'manual.superadmin.refUOM'] },
  { tabId: 5, tabLabelKey: 'manual.tabs.superadmin', sectionTitleKey: 'manual.superadmin.siteManagement',
    contentKeys: ['manual.superadmin.siteAccess', 'manual.superadmin.siteWhoCanManage', 'manual.superadmin.siteDesc', 'manual.superadmin.siteStep1', 'manual.superadmin.siteStep1Desc', 'manual.superadmin.siteStep2', 'manual.superadmin.siteStep2Desc', 'manual.superadmin.siteStep3', 'manual.superadmin.siteStep3Desc', 'manual.superadmin.siteStep4', 'manual.superadmin.siteStep4Desc', 'manual.superadmin.siteStep5', 'manual.superadmin.siteStep5Desc', 'manual.superadmin.siteStep6', 'manual.superadmin.siteStep6Desc', 'manual.superadmin.siteStep7', 'manual.superadmin.siteStep7Desc', 'manual.superadmin.siteNote'] },
  // FAQs
  { tabId: 6, tabLabelKey: 'manual.tabs.faqs', sectionTitleKey: 'manual.faqs.title',
    contentKeys: ['manual.faqs.q1', 'manual.faqs.a1', 'manual.faqs.q2', 'manual.faqs.a2', 'manual.faqs.q3', 'manual.faqs.a3', 'manual.faqs.q4', 'manual.faqs.a4', 'manual.faqs.q5', 'manual.faqs.a5', 'manual.faqs.q6', 'manual.faqs.a6', 'manual.faqs.q7', 'manual.faqs.a7', 'manual.faqs.q8', 'manual.faqs.a8'] },
];

function findMatchingSnippet(term: string, contentKeys: string[], t: (key: string) => string): string | null {
  const lowerTerm = term.toLowerCase();
  for (const key of contentKeys) {
    const text = t(key);
    if (text && text.toLowerCase().includes(lowerTerm)) {
      return text;
    }
  }
  return null;
}

export const UserManual: React.FC = () => {
  const { t } = useTranslation();
  const [tabValue, setTabValue] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const { user } = useSelector((state: RootState) => state.auth);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const isSearching = searchTerm.trim().length >= 2;

  const searchResults = useMemo(() => {
    if (!isSearching) return [];
    const term = searchTerm.trim().toLowerCase();
    return SEARCH_INDEX
      .map((section) => {
        const titleText = t(section.sectionTitleKey);
        const titleMatch = titleText.toLowerCase().includes(term);
        const snippet = findMatchingSnippet(searchTerm.trim(), section.contentKeys, t);
        if (titleMatch || snippet) {
          return { section, titleText, snippet, tabLabel: t(section.tabLabelKey) };
        }
        return null;
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
  }, [searchTerm, isSearching, t]);

  const handleSearchResultClick = (tabId: number) => {
    setTabValue(tabId);
    setSearchTerm('');
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
              {t('manual.title')}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {t('manual.version')}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title={t('manual.printManual')}>
              <IconButton onClick={handlePrint}>
                <PrintIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title={t('manual.downloadFullManual')}>
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
          placeholder={t('manual.searchPlaceholder')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
            endAdornment: searchTerm && (
              <InputAdornment position="end" sx={{ cursor: 'pointer' }} onClick={() => setSearchTerm('')}>
                <ClearIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 3 }}
        />

        <Divider sx={{ mb: 3 }} />

        {/* Search Results */}
        {isSearching && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              {searchResults.length > 0
                ? `${searchResults.length} ${t('manual.searchResultsFound')}`
                : t('manual.searchNoResults')}
            </Typography>
            {searchResults.map((result, idx) => (
              <Paper
                key={idx}
                variant="outlined"
                sx={{ p: 2, mb: 1, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                onClick={() => handleSearchResultClick(result.section.tabId)}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Chip label={result.tabLabel} size="small" color="primary" variant="outlined" />
                  <Typography variant="subtitle1" fontWeight="bold">
                    {result.titleText}
                  </Typography>
                </Box>
                {result.snippet && (
                  <Typography variant="body2" color="textSecondary" sx={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  }}>
                    {result.snippet}
                  </Typography>
                )}
              </Paper>
            ))}
          </Box>
        )}

        {/* Role-based Tabs — hidden during search */}
        {!isSearching && (
        <>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange} variant="scrollable" scrollButtons="auto">
            <Tab label={t('manual.tabs.gettingStarted')} />
            <Tab icon={<RequestorIcon />} label={t('manual.tabs.requestor')} iconPosition="start" />
            <Tab icon={<ApproverIcon />} label={t('manual.tabs.approver')} iconPosition="start" />
            <Tab icon={<ProcurementIcon />} label={t('manual.tabs.procurement')} iconPosition="start" />
            <Tab icon={<FinanceIcon />} label={t('manual.tabs.financeAdmin')} iconPosition="start" />
            <Tab icon={<AdminIcon />} label={t('manual.tabs.superadmin')} iconPosition="start" />
            <Tab label={t('manual.tabs.faqs')} />
          </Tabs>
        </Box>

        {/* Getting Started */}
        <TabPanel value={tabValue} index={0}>
          <Typography variant="h5" gutterBottom>
            {t('manual.gettingStarted.title')}
          </Typography>

          <Alert severity="info" sx={{ mb: 3 }}>
            {t('manual.gettingStarted.welcome')}
          </Alert>

          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography variant="h6">{t('manual.gettingStarted.loggingIn')}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <List>
                <ListItem>
                  <ListItemText
                    primary={t('manual.gettingStarted.loginStep1')}
                    secondary={t('manual.gettingStarted.loginStep1Desc')}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={t('manual.gettingStarted.loginStep2')}
                    secondary={t('manual.gettingStarted.loginStep2Desc')}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={t('manual.gettingStarted.loginStep3')}
                    secondary={t('manual.gettingStarted.loginStep3Desc')}
                  />
                </ListItem>
              </List>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography variant="h6">{t('manual.gettingStarted.userRoles')}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box>
                  <Chip icon={<RequestorIcon />} label={t('manual.gettingStarted.roleRequestor')} color="default" sx={{ mr: 1 }} />
                  <Typography variant="body2" display="inline">
                    {t('manual.gettingStarted.roleRequestorDesc')}
                  </Typography>
                </Box>
                <Box>
                  <Chip icon={<ApproverIcon />} label={t('manual.gettingStarted.roleApprover')} color="primary" sx={{ mr: 1 }} />
                  <Typography variant="body2" display="inline">
                    {t('manual.gettingStarted.roleApproverDesc')}
                  </Typography>
                </Box>
                <Box>
                  <Chip icon={<ProcurementIcon />} label={t('manual.gettingStarted.roleProcurement')} color="info" sx={{ mr: 1 }} />
                  <Typography variant="body2" display="inline">
                    {t('manual.gettingStarted.roleProcurementDesc')}
                  </Typography>
                </Box>
                <Box>
                  <Chip icon={<FinanceIcon />} label={t('manual.gettingStarted.roleFinance')} color="success" sx={{ mr: 1 }} />
                  <Typography variant="body2" display="inline">
                    {t('manual.gettingStarted.roleFinanceDesc')}
                  </Typography>
                </Box>
                <Box>
                  <Chip icon={<AdminIcon />} label={t('manual.gettingStarted.roleSuperadmin')} color="error" sx={{ mr: 1 }} />
                  <Typography variant="body2" display="inline">
                    {t('manual.gettingStarted.roleSuperadminDesc')}
                  </Typography>
                </Box>
              </Box>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography variant="h6">{t('manual.gettingStarted.dashboardOverview')}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <List>
                <ListItem>
                  <ListItemText
                    primary={t('manual.gettingStarted.dashboardMetrics')}
                    secondary={t('manual.gettingStarted.dashboardMetricsDesc')}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={t('manual.gettingStarted.dashboardMyPRs')}
                    secondary={t('manual.gettingStarted.dashboardMyPRsDesc')}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={t('manual.gettingStarted.dashboardTable')}
                    secondary={t('manual.gettingStarted.dashboardTableDesc')}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={t('manual.gettingStarted.dashboardSearch')}
                    secondary={t('manual.gettingStarted.dashboardSearchDesc')}
                  />
                </ListItem>
              </List>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography variant="h6">{t('manual.gettingStarted.prStatusFlow')}</Typography>
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
                  <ListItemText primary={t('manual.gettingStarted.statusSubmitted')} secondary={t('manual.gettingStarted.statusSubmittedDesc')} />
                </ListItem>
                <ListItem>
                  <ListItemText primary={t('manual.gettingStarted.statusInQueue')} secondary={t('manual.gettingStarted.statusInQueueDesc')} />
                </ListItem>
                <ListItem>
                  <ListItemText primary={t('manual.gettingStarted.statusPendingApproval')} secondary={t('manual.gettingStarted.statusPendingApprovalDesc')} />
                </ListItem>
                <ListItem>
                  <ListItemText primary={t('manual.gettingStarted.statusApproved')} secondary={t('manual.gettingStarted.statusApprovedDesc')} />
                </ListItem>
                <ListItem>
                  <ListItemText primary={t('manual.gettingStarted.statusOrdered')} secondary={t('manual.gettingStarted.statusOrderedDesc')} />
                </ListItem>
                <ListItem>
                  <ListItemText primary={t('manual.gettingStarted.statusCompleted')} secondary={t('manual.gettingStarted.statusCompletedDesc')} />
                </ListItem>
              </List>
            </AccordionDetails>
          </Accordion>
        </TabPanel>

        {/* Requestor Guide */}
        <TabPanel value={tabValue} index={1}>
          <Typography variant="h5" gutterBottom>
            {t('manual.requestor.title')}
          </Typography>
          <Typography variant="body1" paragraph color="textSecondary">
            {t('manual.requestor.description')}
          </Typography>

          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography variant="h6">{t('manual.requestor.creatingPR')}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <List>
                <ListItem>
                  <ListItemText
                    primary={t('manual.requestor.step1')}
                    secondary={t('manual.requestor.step1Desc')}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={t('manual.requestor.step2')}
                    secondary={t('manual.requestor.step2Desc')}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={t('manual.requestor.step3')}
                    secondary={t('manual.requestor.step3Desc')}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={t('manual.requestor.step4')}
                    secondary={t('manual.requestor.step4Desc')}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={t('manual.requestor.step5')}
                    secondary={t('manual.requestor.step5Desc')}
                  />
                </ListItem>
              </List>
              <Alert severity="warning" sx={{ mt: 2 }}>
                <strong>{t('manual.requestor.important')}</strong> {t('manual.requestor.importantNote')}
              </Alert>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography variant="h6">{t('manual.requestor.trackingPRs')}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" paragraph>
                {t('manual.requestor.trackingDesc')}
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemText primary={t('manual.requestor.trackingStep1')} />
                </ListItem>
                <ListItem>
                  <ListItemText primary={t('manual.requestor.trackingStep2')} />
                </ListItem>
                <ListItem>
                  <ListItemText primary={t('manual.requestor.trackingStep3')} />
                </ListItem>
                <ListItem>
                  <ListItemText primary={t('manual.requestor.trackingStep4')} />
                </ListItem>
              </List>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography variant="h6">{t('manual.requestor.revisionRequests')}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Alert severity="info" sx={{ mb: 2 }}>
                {t('manual.requestor.revisionAlert')}
              </Alert>
              <List dense>
                <ListItem>
                  <ListItemText primary={t('manual.requestor.revisionStep1')} />
                </ListItem>
                <ListItem>
                  <ListItemText primary={t('manual.requestor.revisionStep2')} />
                </ListItem>
                <ListItem>
                  <ListItemText primary={t('manual.requestor.revisionStep3')} />
                </ListItem>
                <ListItem>
                  <ListItemText primary={t('manual.requestor.revisionStep4')} />
                </ListItem>
                <ListItem>
                  <ListItemText primary={t('manual.requestor.revisionStep5')} />
                </ListItem>
                <ListItem>
                  <ListItemText primary={t('manual.requestor.revisionStep6')} />
                </ListItem>
              </List>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography variant="h6">{t('manual.requestor.tips')}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Alert severity="success">
                  <strong>{t('manual.requestor.do')}</strong>
                  <ul>
                    <li>{t('manual.requestor.do1')}</li>
                    <li>{t('manual.requestor.do2')}</li>
                    <li>{t('manual.requestor.do3')}</li>
                    <li>{t('manual.requestor.do4')}</li>
                  </ul>
                </Alert>
                <Alert severity="error">
                  <strong>{t('manual.requestor.dont')}</strong>
                  <ul>
                    <li>{t('manual.requestor.dont1')}</li>
                    <li>{t('manual.requestor.dont2')}</li>
                    <li>{t('manual.requestor.dont3')}</li>
                    <li>{t('manual.requestor.dont4')}</li>
                  </ul>
                </Alert>
              </Box>
            </AccordionDetails>
          </Accordion>
        </TabPanel>

        {/* Approver Guide */}
        <TabPanel value={tabValue} index={2}>
          <Typography variant="h5" gutterBottom>
            {t('manual.approver.title')}
          </Typography>
          <Typography variant="body1" paragraph color="textSecondary">
            {t('manual.approver.description')}
          </Typography>

          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography variant="h6">{t('manual.approver.findingPRs')}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <List>
                <ListItem>
                  <ListItemText
                    primary={t('manual.approver.findingStep1')}
                    secondary={t('manual.approver.findingStep1Desc')}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={t('manual.approver.findingStep2')}
                    secondary={t('manual.approver.findingStep2Desc')}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={t('manual.approver.findingStep3')}
                    secondary={t('manual.approver.findingStep3Desc')}
                  />
                </ListItem>
              </List>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography variant="h6">{t('manual.approver.checkBeforeApproving')}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <List dense>
                <ListItem>
                  <ListItemText primary={t('manual.approver.check1')} />
                </ListItem>
                <ListItem>
                  <ListItemText primary={t('manual.approver.check2')} />
                </ListItem>
                <ListItem>
                  <ListItemText primary={t('manual.approver.check3')} />
                </ListItem>
                <ListItem>
                  <ListItemText primary={t('manual.approver.check4')} />
                </ListItem>
                <ListItem>
                  <ListItemText primary={t('manual.approver.check5')} />
                </ListItem>
                <ListItem>
                  <ListItemText primary={t('manual.approver.check6')} />
                </ListItem>
                <ListItem>
                  <ListItemText primary={t('manual.approver.check7')} />
                </ListItem>
                <ListItem>
                  <ListItemText primary={t('manual.approver.check8')} />
                </ListItem>
              </List>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography variant="h6">{t('manual.approver.approvalActions')}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle1" color="success.main" gutterBottom>
                    <strong>{t('manual.approver.approve')}</strong>
                  </Typography>
                  <Typography variant="body2" component="div" dangerouslySetInnerHTML={{ __html: t('manual.approver.approveSteps').replace(/\n/g, '<br />') }} />
                </Paper>

                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle1" color="warning.main" gutterBottom>
                    <strong>{t('manual.approver.requestRevision')}</strong>
                  </Typography>
                  <Typography variant="body2" component="div" dangerouslySetInnerHTML={{ __html: t('manual.approver.revisionSteps').replace(/\n/g, '<br />') }} />
                </Paper>

                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle1" color="error.main" gutterBottom>
                    <strong>{t('manual.approver.reject')}</strong>
                  </Typography>
                  <Typography variant="body2" component="div" dangerouslySetInnerHTML={{ __html: t('manual.approver.rejectSteps').replace(/\n/g, '<br />') }} />
                </Paper>
              </Box>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography variant="h6">{t('manual.approver.quoteRequirements')}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Alert severity="info" sx={{ mb: 2 }}>
                {t('manual.approver.quoteInfo')}
              </Alert>
              <List dense>
                <ListItem>
                  <ListItemText
                    primary={t('manual.approver.quoteBelowRule1')}
                    secondary={t('manual.approver.quoteBelowRule1Desc')}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={t('manual.approver.quoteBetweenRules')}
                    secondary={t('manual.approver.quoteBetweenRulesDesc')}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={t('manual.approver.quoteAboveRule2')}
                    secondary={t('manual.approver.quoteAboveRule2Desc')}
                  />
                </ListItem>
              </List>
              <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                {t('manual.approver.quoteNote')}
              </Typography>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography variant="h6">{t('manual.approver.amendmentTitle')}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" paragraph>
                {t('manual.approver.amendmentDesc')}
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemText
                    primary={t('manual.approver.amendReviewStep1')}
                    secondary={t('manual.approver.amendReviewStep1Desc')}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={t('manual.approver.amendReviewStep2')}
                    secondary={t('manual.approver.amendReviewStep2Desc')}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={t('manual.approver.amendReviewStep3')}
                    secondary={t('manual.approver.amendReviewStep3Desc')}
                  />
                </ListItem>
              </List>
              <Alert severity="info" sx={{ mt: 2 }}>
                {t('manual.approver.amendDualNote')}
              </Alert>
            </AccordionDetails>
          </Accordion>
        </TabPanel>

        {/* Procurement Guide */}
        <TabPanel value={tabValue} index={3}>
          <Typography variant="h5" gutterBottom>
            {t('manual.procurement.title')}
          </Typography>
          <Typography variant="body1" paragraph color="textSecondary">
            {t('manual.procurement.description')}
          </Typography>

          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography variant="h6">{t('manual.procurement.processingNewPRs')}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <List>
                <ListItem>
                  <ListItemText
                    primary={t('manual.procurement.processStep1')}
                    secondary={t('manual.procurement.processStep1Desc')}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={t('manual.procurement.processStep2')}
                    secondary={t('manual.procurement.processStep2Desc')}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={t('manual.procurement.processStep3')}
                    secondary={t('manual.procurement.processStep3Desc')}
                  />
                </ListItem>
              </List>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography variant="h6">{t('manual.procurement.addingQuotes')}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Alert severity="warning" sx={{ mb: 2 }}>
                {t('manual.procurement.quoteWarning')}
              </Alert>
              <List dense>
                <ListItem>
                  <ListItemText primary={t('manual.procurement.quoteStep1')} />
                </ListItem>
                <ListItem>
                  <ListItemText primary={t('manual.procurement.quoteStep2')} />
                </ListItem>
                <ListItem>
                  <ListItemText primary={t('manual.procurement.quoteStep3')} />
                </ListItem>
                <ListItem>
                  <ListItemText primary={t('manual.procurement.quoteStep4')} />
                </ListItem>
                <ListItem>
                  <ListItemText primary={t('manual.procurement.quoteStep5')} />
                </ListItem>
                <ListItem>
                  <ListItemText primary={t('manual.procurement.quoteStep6')} />
                </ListItem>
                <ListItem>
                  <ListItemText primary={t('manual.procurement.quoteStep7')} />
                </ListItem>
                <ListItem>
                  <ListItemText primary={t('manual.procurement.quoteStep8')} />
                </ListItem>
              </List>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography variant="h6">{t('manual.procurement.quoteOverride')}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" paragraph>
                {t('manual.procurement.overrideDesc')}
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemText primary={t('manual.procurement.overrideStep1')} />
                </ListItem>
                <ListItem>
                  <ListItemText primary={t('manual.procurement.overrideStep2')} />
                </ListItem>
                <ListItem>
                  <ListItemText primary={t('manual.procurement.overrideStep3')} />
                </ListItem>
              </List>
              <Alert severity="info" sx={{ mt: 2 }}>
                {t('manual.procurement.overrideNote')}
              </Alert>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography variant="h6">{t('manual.procurement.generatingRFQs')}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" paragraph>
                {t('manual.procurement.rfqDesc')}
              </Typography>
              
              <Alert severity="success" icon={<DownloadIcon />} sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom><strong>{t('manual.procurement.rfqTwoWays')}</strong></Typography>
                <Typography variant="body2">{t('manual.procurement.rfqManual')}</Typography>
                <Typography variant="body2">{t('manual.procurement.rfqBulk')}</Typography>
              </Alert>

              <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}><strong>{t('manual.procurement.rfqBulkProcess')}</strong></Typography>
              <List dense>
                <ListItem>
                  <ListItemText 
                    primary={t('manual.procurement.rfqStep1')} 
                    secondary={t('manual.procurement.rfqStep1Desc')}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary={t('manual.procurement.rfqStep2')}
                    secondary={t('manual.procurement.rfqStep2Desc')}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary={t('manual.procurement.rfqStep3')}
                    secondary={t('manual.procurement.rfqStep3Desc')}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary={t('manual.procurement.rfqStep4')}
                    secondary={t('manual.procurement.rfqStep4Desc')}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary={t('manual.procurement.rfqStep5')}
                    secondary={t('manual.procurement.rfqStep5Desc')}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary={t('manual.procurement.rfqStep6')}
                    secondary={t('manual.procurement.rfqStep6Desc')}
                  />
                </ListItem>
              </List>

              <Alert severity="info" icon={<SearchIcon />} sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom><strong>{t('manual.procurement.rfqAutoConversion')}</strong></Typography>
                <Typography variant="body2">{t('manual.procurement.rfqDropbox')}</Typography>
                <Typography variant="body2">{t('manual.procurement.rfqGoogleDrive')}</Typography>
                <Typography variant="body2">{t('manual.procurement.rfqOneDrive')}</Typography>
                <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
                  {t('manual.procurement.rfqAutoNote')}
                </Typography>
              </Alert>

              <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}><strong>{t('manual.procurement.rfqTroubleshooting')}</strong></Typography>
              <List dense>
                <ListItem>
                  <ListItemText 
                    primary={t('manual.procurement.rfqTrouble1')} 
                    secondary={t('manual.procurement.rfqTrouble1Desc')}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary={t('manual.procurement.rfqTrouble2')} 
                    secondary={t('manual.procurement.rfqTrouble2Desc')}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary={t('manual.procurement.rfqTrouble3')} 
                    secondary={t('manual.procurement.rfqTrouble3Desc')}
                  />
                </ListItem>
              </List>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography variant="h6">{t('manual.procurement.managingVendors')}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" paragraph>
                {t('manual.procurement.vendorAccess')}
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemText primary={t('manual.procurement.vendorStep1')} />
                </ListItem>
                <ListItem>
                  <ListItemText primary={t('manual.procurement.vendorStep2')} />
                </ListItem>
                <ListItem>
                  <ListItemText primary={t('manual.procurement.vendorStep3')} />
                </ListItem>
                <ListItem>
                  <ListItemText primary={t('manual.procurement.vendorStep4')} />
                </ListItem>
                <ListItem>
                  <ListItemText primary={t('manual.procurement.vendorStep5')} />
                </ListItem>
              </List>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography variant="h6">{t('manual.procurement.placingOrders')}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <List dense>
                <ListItem>
                  <ListItemText primary={t('manual.procurement.orderStep1')} />
                </ListItem>
                <ListItem>
                  <ListItemText primary={t('manual.procurement.orderStep2')} />
                </ListItem>
                <ListItem>
                  <ListItemText primary={t('manual.procurement.orderStep3')} />
                </ListItem>
                <ListItem>
                  <ListItemText primary={t('manual.procurement.orderStep4')} />
                </ListItem>
                <ListItem>
                  <ListItemText primary={t('manual.procurement.orderStep5')} />
                </ListItem>
                <ListItem>
                  <ListItemText primary={t('manual.procurement.orderStep6')} />
                </ListItem>
                <ListItem>
                  <ListItemText primary={t('manual.procurement.orderStep7')} />
                </ListItem>
              </List>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography variant="h6">{t('manual.procurement.amendmentTitle')}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Alert severity="info" sx={{ mb: 2 }}>
                {t('manual.procurement.amendmentInfo')}
              </Alert>
              <Typography variant="body2" paragraph>
                {t('manual.procurement.amendmentDesc')}
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemText
                    primary={t('manual.procurement.amendStep1')}
                    secondary={t('manual.procurement.amendStep1Desc')}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={t('manual.procurement.amendStep2')}
                    secondary={t('manual.procurement.amendStep2Desc')}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={t('manual.procurement.amendStep3')}
                    secondary={t('manual.procurement.amendStep3Desc')}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={t('manual.procurement.amendStep4')}
                    secondary={t('manual.procurement.amendStep4Desc')}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={t('manual.procurement.amendStep5')}
                    secondary={t('manual.procurement.amendStep5Desc')}
                  />
                </ListItem>
              </List>
              <Alert severity="warning" sx={{ mt: 2 }}>
                {t('manual.procurement.amendNote')}
              </Alert>
            </AccordionDetails>
          </Accordion>
        </TabPanel>

        {/* Finance/Admin Guide */}
        <TabPanel value={tabValue} index={4}>
          <Typography variant="h5" gutterBottom>
            {t('manual.finance.title')}
          </Typography>
          <Typography variant="body1" paragraph color="textSecondary">
            {t('manual.finance.description')}
          </Typography>

          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography variant="h6">{t('manual.finance.reviewingApproved')}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <List dense>
                <ListItem>
                  <ListItemText primary={t('manual.finance.reviewStep1')} />
                </ListItem>
                <ListItem>
                  <ListItemText primary={t('manual.finance.reviewStep2')} />
                </ListItem>
                <ListItem>
                  <ListItemText primary={t('manual.finance.reviewStep3')} />
                </ListItem>
                <ListItem>
                  <ListItemText primary={t('manual.finance.reviewStep4')} />
                </ListItem>
                <ListItem>
                  <ListItemText primary={t('manual.finance.reviewStep5')} />
                </ListItem>
              </List>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography variant="h6">{t('manual.finance.uploadingPoP')}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" paragraph>
                {t('manual.finance.uploadingPoPDesc')}
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemText primary={t('manual.finance.popStep1')} />
                </ListItem>
                <ListItem>
                  <ListItemText primary={t('manual.finance.popStep2')} />
                </ListItem>
                <ListItem>
                  <ListItemText primary={t('manual.finance.popStep3')} />
                </ListItem>
                <ListItem>
                  <ListItemText primary={t('manual.finance.popStep4')} />
                </ListItem>
                <ListItem>
                  <ListItemText primary={t('manual.finance.popStep5')} />
                </ListItem>
                <ListItem>
                  <ListItemText primary={t('manual.finance.popStep6')} />
                </ListItem>
              </List>
              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  {t('manual.finance.popNote')}
                </Typography>
              </Alert>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography variant="h6">{t('manual.finance.closingCompleted')}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" paragraph>
                {t('manual.finance.closingDesc')}
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemText primary={t('manual.finance.closingStep1')} />
                </ListItem>
                <ListItem>
                  <ListItemText primary={t('manual.finance.closingStep2')} />
                </ListItem>
                <ListItem>
                  <ListItemText primary={t('manual.finance.closingStep3')} />
                </ListItem>
                <ListItem>
                  <ListItemText primary={t('manual.finance.closingStep4')} />
                </ListItem>
                <ListItem>
                  <ListItemText primary={t('manual.finance.closingStep5')} />
                </ListItem>
              </List>

              <Alert severity="success" sx={{ mt: 2 }}>
                <Typography variant="body2" fontWeight="bold">{t('manual.finance.closingSuccess')}</Typography>
                <Typography variant="body2">
                  • {t('manual.finance.closingSuccess1')}<br />
                  • {t('manual.finance.closingSuccess2')}<br />
                  • {t('manual.finance.closingSuccess3')}
                </Typography>
              </Alert>

              <Alert severity="warning" sx={{ mt: 2 }}>
                <Typography variant="body2" fontWeight="bold">{t('manual.finance.closingWarning')}</Typography>
                <Typography variant="body2">
                  • {t('manual.finance.closingWarning1')}<br />
                  • {t('manual.finance.closingWarning2')}<br />
                  • {t('manual.finance.closingWarning3')}<br />
                  • {t('manual.finance.closingWarning4')}
                </Typography>
              </Alert>
            </AccordionDetails>
          </Accordion>
        </TabPanel>

        {/* Superadmin Guide */}
        <TabPanel value={tabValue} index={5}>
          <Typography variant="h5" gutterBottom>
            {t('manual.superadmin.title')}
          </Typography>
          <Typography variant="body1" paragraph color="textSecondary">
            {t('manual.superadmin.description')}
          </Typography>

          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography variant="h6">{t('manual.superadmin.userManagement')}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" paragraph>
                {t('manual.superadmin.userAccess')}
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemText primary={t('manual.superadmin.userStep1')} />
                </ListItem>
                <ListItem>
                  <ListItemText primary={t('manual.superadmin.userStep2')} />
                </ListItem>
                <ListItem>
                  <ListItemText primary={t('manual.superadmin.userStep3')} />
                </ListItem>
                <ListItem>
                  <ListItemText primary={t('manual.superadmin.userStep4')} />
                </ListItem>
              </List>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography variant="h6">{t('manual.superadmin.orgConfig')}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" paragraph>
                {t('manual.superadmin.orgAccess')}
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemText primary={t('manual.superadmin.orgStep1')} />
                </ListItem>
                <ListItem>
                  <ListItemText primary={t('manual.superadmin.orgStep2')} />
                </ListItem>
                <ListItem>
                  <ListItemText primary={t('manual.superadmin.orgStep3')} />
                </ListItem>
                <ListItem>
                  <ListItemText primary={t('manual.superadmin.orgStep4')} />
                </ListItem>
              </List>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography variant="h6">{t('manual.superadmin.referenceData')}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" paragraph>
                {t('manual.superadmin.refAccess')}
              </Typography>
              <Typography variant="body2" paragraph>
                {t('manual.superadmin.refManage')}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                <Chip label={t('manual.superadmin.refDept')} size="small" />
                <Chip label={t('manual.superadmin.refCategory')} size="small" />
                <Chip label={t('manual.superadmin.refSite')} size="small" />
                <Chip label={t('manual.superadmin.refExpense')} size="small" />
                <Chip label={t('manual.superadmin.refVehicle')} size="small" />
                <Chip label={t('manual.superadmin.refVendor')} size="small" />
                <Chip label={t('manual.superadmin.refCurrency')} size="small" />
                <Chip label={t('manual.superadmin.refUOM')} size="small" />
              </Box>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography variant="h6">{t('manual.superadmin.siteManagement')}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" paragraph>
                {t('manual.superadmin.siteAccess')}
              </Typography>
              <Alert severity="info" sx={{ mb: 2 }}>
                {t('manual.superadmin.siteWhoCanManage')}
              </Alert>
              <Typography variant="body2" paragraph>
                {t('manual.superadmin.siteDesc')}
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemText
                    primary={t('manual.superadmin.siteStep1')}
                    secondary={t('manual.superadmin.siteStep1Desc')}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={t('manual.superadmin.siteStep2')}
                    secondary={t('manual.superadmin.siteStep2Desc')}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={t('manual.superadmin.siteStep3')}
                    secondary={t('manual.superadmin.siteStep3Desc')}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={t('manual.superadmin.siteStep4')}
                    secondary={t('manual.superadmin.siteStep4Desc')}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={t('manual.superadmin.siteStep5')}
                    secondary={t('manual.superadmin.siteStep5Desc')}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={t('manual.superadmin.siteStep6')}
                    secondary={t('manual.superadmin.siteStep6Desc')}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={t('manual.superadmin.siteStep7')}
                    secondary={t('manual.superadmin.siteStep7Desc')}
                  />
                </ListItem>
              </List>
              <Alert severity="warning" sx={{ mt: 2 }}>
                {t('manual.superadmin.siteNote')}
              </Alert>
            </AccordionDetails>
          </Accordion>
        </TabPanel>

        {/* FAQs */}
        <TabPanel value={tabValue} index={6}>
          <Typography variant="h5" gutterBottom>
            {t('manual.faqs.title')}
          </Typography>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography>{t('manual.faqs.q1')}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2">
                {t('manual.faqs.a1')}
              </Typography>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography>{t('manual.faqs.q2')}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2">
                {t('manual.faqs.a2')}
              </Typography>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography>{t('manual.faqs.q3')}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2">
                {t('manual.faqs.a3')}
              </Typography>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography>{t('manual.faqs.q4')}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2">
                {t('manual.faqs.a4')}
              </Typography>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography>{t('manual.faqs.q5')}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2">
                {t('manual.faqs.a5')}
              </Typography>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography>{t('manual.faqs.q6')}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2">
                {t('manual.faqs.a6')}
              </Typography>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography>{t('manual.faqs.q7')}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2">
                {t('manual.faqs.a7')}
              </Typography>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography>{t('manual.faqs.q8')}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2">
                {t('manual.faqs.a8')}
              </Typography>
            </AccordionDetails>
          </Accordion>
        </TabPanel>
        </>
        )}

        {/* Footer */}
        <Divider sx={{ my: 3 }} />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="caption" color="textSecondary">
            {t('manual.footer.needHelp')}
          </Typography>
          <Button
            variant="outlined"
            size="small"
            onClick={handleDownload}
            startIcon={<DownloadIcon />}
          >
            {t('manual.downloadFullManual')}
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};

