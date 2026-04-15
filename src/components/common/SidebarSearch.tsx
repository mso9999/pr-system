import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '@/store';
import {
  Box,
  TextField,
  InputAdornment,
  Paper,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Chip,
  ClickAwayListener,
  Popper,
  CircularProgress,
} from '@mui/material';
import {
  Search as SearchIcon,
  Description as PRIcon,
  Business as SupplierIcon,
  Archive as ArchiveIcon,
  Dashboard as DashboardIcon,
  HelpOutline as HelpIcon,
  AdminPanelSettings as AdminIcon,
  Assignment as JobCardIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';
import { PRRequest, PRStatus } from '@/types/pr';
import { referenceDataService, ReferenceData } from '@/services/referenceData';

interface SearchResult {
  id: string;
  label: string;
  sublabel?: string;
  category: 'pr' | 'supplier' | 'vendor' | 'page';
  path: string;
  icon: React.ReactNode;
  chip?: { label: string; color: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' };
}

const STATUS_COLORS: Partial<Record<PRStatus, 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'>> = {
  [PRStatus.SUBMITTED]: 'warning',
  [PRStatus.RESUBMITTED]: 'warning',
  [PRStatus.IN_QUEUE]: 'info',
  [PRStatus.PENDING_APPROVAL]: 'info',
  [PRStatus.APPROVED]: 'success',
  [PRStatus.ORDERED]: 'primary',
  [PRStatus.COMPLETED]: 'success',
  [PRStatus.REVISION_REQUIRED]: 'warning',
  [PRStatus.REJECTED]: 'error',
  [PRStatus.CANCELED]: 'error',
};

const STATIC_PAGES: SearchResult[] = [
  { id: 'page-dashboard', label: 'Dashboard', category: 'page', path: '/dashboard', icon: <DashboardIcon fontSize="small" /> },
  { id: 'page-prlist', label: 'PR List', category: 'page', path: '/pr/list', icon: <PRIcon fontSize="small" /> },
  { id: 'page-suppliers', label: 'Suppliers', category: 'page', path: '/suppliers', icon: <SupplierIcon fontSize="small" /> },
  { id: 'page-archive', label: 'Archive Dataroom', category: 'page', path: '/archive', icon: <ArchiveIcon fontSize="small" /> },
  { id: 'page-help', label: 'Help / User Manual', category: 'page', path: '/help', icon: <HelpIcon fontSize="small" /> },
  { id: 'page-admin', label: 'Admin', category: 'page', path: '/admin', icon: <AdminIcon fontSize="small" /> },
];

const CATEGORY_LABELS: Record<string, string> = {
  page: 'Pages',
  pr: 'Purchase Requests',
  vendor: 'Vendors',
};

function matchesTerm(text: string | undefined | null, term: string): boolean {
  if (!text) return false;
  return text.toLowerCase().includes(term);
}

interface SidebarSearchProps {
  onNavigate?: () => void;
}

export const SidebarSearch = ({ onNavigate }: SidebarSearchProps) => {
  const navigate = useNavigate();
  const user = useSelector((state: RootState) => state.auth.user);
  const userPRs = useSelector((state: RootState) => state.pr.userPRs);

  const [searchText, setSearchText] = useState('');
  const [open, setOpen] = useState(false);
  const [vendors, setVendors] = useState<ReferenceData[]>([]);
  const [vendorsLoaded, setVendorsLoaded] = useState(false);
  const [vendorsLoading, setVendorsLoading] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasAdminAccess = user?.role === 'ADMIN' ||
    (user?.permissionLevel && (user.permissionLevel <= 4 || user.permissionLevel === 7));

  const loadVendors = useCallback(async () => {
    if (vendorsLoaded || vendorsLoading) return;
    setVendorsLoading(true);
    try {
      const data = await referenceDataService.getVendors();
      setVendors(data);
      setVendorsLoaded(true);
    } catch (err) {
      console.error('Failed to load vendors for search:', err);
    } finally {
      setVendorsLoading(false);
    }
  }, [vendorsLoaded, vendorsLoading]);

  useEffect(() => {
    if (searchText.length >= 2 && !vendorsLoaded) {
      loadVendors();
    }
  }, [searchText, vendorsLoaded, loadVendors]);

  const results = useMemo((): SearchResult[] => {
    const term = searchText.toLowerCase().trim();
    if (term.length < 2) return [];

    const matches: SearchResult[] = [];

    // Search static pages
    const pageMatches = STATIC_PAGES.filter(p => {
      if (p.id === 'page-admin' && !hasAdminAccess) return false;
      return matchesTerm(p.label, term);
    });
    matches.push(...pageMatches);

    // Search PRs/POs from Redux store
    const prMatches: SearchResult[] = [];
    for (const pr of userPRs) {
      if (prMatches.length >= 15) break;

      const hit =
        matchesTerm(pr.prNumber, term) ||
        matchesTerm(pr.description, term) ||
        matchesTerm(pr.preferredVendor, term) ||
        matchesTerm(pr.selectedVendor, term) ||
        matchesTerm(pr.vendor?.name, term) ||
        matchesTerm(pr.vendorName, term) ||
        matchesTerm(pr.supplierName, term) ||
        matchesTerm(pr.organization, term) ||
        matchesTerm(pr.department, term) ||
        pr.lineItems?.some(li => matchesTerm(li.description, term)) ||
        pr.quotes?.some(q => matchesTerm(q.vendorName, term));

      if (hit) {
        const objectType = pr.objectType || (
          [PRStatus.APPROVED, PRStatus.ORDERED, PRStatus.COMPLETED].includes(pr.status) ? 'PO' : 'PR'
        );
        prMatches.push({
          id: `pr-${pr.id}`,
          label: `${pr.prNumber}`,
          sublabel: pr.description?.substring(0, 60) || pr.preferredVendor || undefined,
          category: 'pr',
          path: `/pr/${pr.id}`,
          icon: <PRIcon fontSize="small" />,
          chip: {
            label: `${objectType} · ${pr.status.replace(/_/g, ' ')}`,
            color: STATUS_COLORS[pr.status] || 'default',
          },
        });
      }
    }
    matches.push(...prMatches);

    // Search vendors (from reference data) — link to admin vendor view if admin, otherwise to suppliers page
    if (vendors.length > 0) {
      let vendorMatches = 0;
      for (const v of vendors) {
        if (vendorMatches >= 8) break;
        const hit =
          matchesTerm(v.name, term) ||
          matchesTerm(v.code, term) ||
          matchesTerm(v.id, term);

        if (hit) {
          vendorMatches++;
          matches.push({
            id: `vendor-${v.id}`,
            label: v.name || v.id,
            sublabel: v.code ? `Code: ${v.code}` : undefined,
            category: 'vendor',
            path: hasAdminAccess ? `/vendor/${v.id}` : '/suppliers',
            icon: <SupplierIcon fontSize="small" />,
          });
        }
      }
    }

    return matches;
  }, [searchText, userPRs, vendors, hasAdminAccess]);

  const groupedResults = useMemo(() => {
    const groups: Record<string, SearchResult[]> = {};
    for (const r of results) {
      if (!groups[r.category]) groups[r.category] = [];
      groups[r.category].push(r);
    }
    return groups;
  }, [results]);

  const handleSelect = (result: SearchResult) => {
    setSearchText('');
    setOpen(false);
    navigate(result.path);
    onNavigate?.();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchText(value);
    setOpen(value.trim().length >= 2);
  };

  const handleClear = () => {
    setSearchText('');
    setOpen(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setSearchText('');
      setOpen(false);
    }
  };

  return (
    <ClickAwayListener onClickAway={() => setOpen(false)}>
      <Box ref={anchorRef} sx={{ px: 1.5, py: 1 }}>
        <TextField
          inputRef={inputRef}
          size="small"
          fullWidth
          placeholder="Search PRs, vendors…"
          value={searchText}
          onChange={handleInputChange}
          onFocus={() => { if (searchText.trim().length >= 2) setOpen(true); }}
          onKeyDown={handleKeyDown}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                </InputAdornment>
              ),
              endAdornment: searchText ? (
                <InputAdornment position="end" sx={{ cursor: 'pointer' }} onClick={handleClear}>
                  <ClearIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                </InputAdornment>
              ) : null,
              sx: { fontSize: '0.85rem', height: 36 },
            },
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
              bgcolor: 'action.hover',
              '& fieldset': { borderColor: 'transparent' },
              '&:hover fieldset': { borderColor: 'divider' },
              '&.Mui-focused fieldset': { borderColor: 'primary.main' },
            },
          }}
        />
        <Popper
          open={open && searchText.trim().length >= 2}
          anchorEl={anchorRef.current}
          placement="bottom-start"
          style={{ zIndex: 1300, width: anchorRef.current?.offsetWidth || 220 }}
          modifiers={[{ name: 'offset', options: { offset: [0, 4] } }]}
        >
          <Paper
            elevation={8}
            sx={{
              maxHeight: 380,
              overflow: 'auto',
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            {results.length === 0 ? (
              <Box sx={{ p: 2, textAlign: 'center' }}>
                {vendorsLoading ? (
                  <CircularProgress size={20} />
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No results for "{searchText}"
                  </Typography>
                )}
              </Box>
            ) : (
              <List dense disablePadding>
                {Object.entries(CATEGORY_LABELS).map(([catKey, catLabel]) => {
                  const items = groupedResults[catKey];
                  if (!items || items.length === 0) return null;
                  return (
                    <Box key={catKey}>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ px: 1.5, pt: 1, pb: 0.5, display: 'block', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}
                      >
                        {catLabel}
                      </Typography>
                      {items.map((item) => (
                        <ListItemButton
                          key={item.id}
                          onClick={() => handleSelect(item)}
                          sx={{ py: 0.5, px: 1.5, gap: 0.5 }}
                        >
                          <ListItemIcon sx={{ minWidth: 28, color: 'text.secondary' }}>
                            {item.icon}
                          </ListItemIcon>
                          <ListItemText
                            primary={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                                <Typography variant="body2" noWrap sx={{ fontWeight: 500, maxWidth: 120 }}>
                                  {item.label}
                                </Typography>
                                {item.chip && (
                                  <Chip
                                    label={item.chip.label}
                                    color={item.chip.color}
                                    size="small"
                                    sx={{ height: 18, fontSize: '0.65rem', '& .MuiChip-label': { px: 0.75 } }}
                                  />
                                )}
                              </Box>
                            }
                            secondary={item.sublabel}
                            secondaryTypographyProps={{ noWrap: true, sx: { fontSize: '0.75rem', maxWidth: 180 } }}
                          />
                        </ListItemButton>
                      ))}
                    </Box>
                  );
                })}
              </List>
            )}
          </Paper>
        </Popper>
      </Box>
    </ClickAwayListener>
  );
};
