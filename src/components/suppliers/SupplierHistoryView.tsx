/**
 * SupplierHistoryView
 *
 * User-facing, read-only supplier index built from actual purchase request
 * transaction history. Shows all vendors that have appeared in PRs, their
 * transaction counts, total values, and downloadable invoice/quote attachments.
 *
 * Separate from the admin vendor CRUD (ReferenceDataManagement).
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import {
  supplierHistoryService,
  SupplierIndex,
  SupplierSummary,
  SupplierTransaction,
  SupplierAttachment,
} from "@/services/supplierHistory";
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Chip,
  IconButton,
  Collapse,
  CircularProgress,
  Alert,
  Tooltip,
  Link,
  Stack,
  Divider,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import {
  Search,
  ExpandMore,
  ExpandLess,
  Download,
  Description,
  AttachFile,
  OpenInNew,
  Business,
  Receipt,
  TrendingUp,
} from "@mui/icons-material";

// ─── Helpers ─────────────────────────────────────────────────────────

function formatCurrency(amount: number, currency?: string): string {
  if (!amount && amount !== 0) return "—";
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
  return currency ? `${formatted} ${currency}` : formatted;
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso.substring(0, 10);
  }
}

function getStatusColor(status: string): "success" | "warning" | "error" | "info" | "default" {
  switch (status) {
    case "COMPLETED": return "success";
    case "APPROVED":
    case "ORDERED": return "info";
    case "PENDING_APPROVAL":
    case "IN_QUEUE":
    case "SUBMITTED": return "warning";
    case "REJECTED":
    case "CANCELED": return "error";
    default: return "default";
  }
}

// ─── Supplier Detail Row (Expandable) ────────────────────────────────

interface SupplierDetailRowProps {
  supplier: SupplierSummary;
  isExpanded: boolean;
  onToggle: () => void;
}

function SupplierDetailRow({ supplier, isExpanded, onToggle }: SupplierDetailRowProps) {
  return (
    <>
      <TableRow
        hover
        onClick={onToggle}
        sx={{ cursor: "pointer", "& > *": { borderBottom: "unset" } }}
      >
        <TableCell>
          <IconButton size="small">
            {isExpanded ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </TableCell>
        <TableCell>
          <Typography variant="body2" fontWeight={600}>
            {supplier.vendorName}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {supplier.organizations.join(", ")}
          </Typography>
        </TableCell>
        <TableCell align="center">
          <Chip
            label={supplier.transactionCount}
            size="small"
            color="primary"
            variant="outlined"
          />
        </TableCell>
        <TableCell align="right">
          <Typography variant="body2">
            {formatCurrency(supplier.totalValue, supplier.currencies[0])}
          </Typography>
          {supplier.currencies.length > 1 && (
            <Typography variant="caption" color="text.secondary">
              ({supplier.currencies.join(", ")})
            </Typography>
          )}
        </TableCell>
        <TableCell>
          <Typography variant="caption">
            {formatDate(supplier.firstTransaction)} — {formatDate(supplier.lastTransaction)}
          </Typography>
        </TableCell>
        <TableCell>
          {Object.entries(supplier.statuses).map(([status, count]) => (
            <Chip
              key={status}
              label={`${status} (${count})`}
              size="small"
              color={getStatusColor(status)}
              variant="outlined"
              sx={{ mr: 0.5, mb: 0.5, fontSize: "0.7rem" }}
            />
          ))}
        </TableCell>
        <TableCell align="center">
          {supplier.transactions.reduce((sum, t) => sum + t.attachments.length, 0) > 0 && (
            <Tooltip title="Has downloadable invoices/quotes">
              <AttachFile fontSize="small" color="action" />
            </Tooltip>
          )}
        </TableCell>
      </TableRow>

      {/* Expanded transaction detail */}
      <TableRow>
        <TableCell colSpan={7} sx={{ py: 0 }}>
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <Box sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Transaction History
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>PR Number</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Organization</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Items</TableCell>
                    <TableCell>Documents</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {supplier.transactions.map((tx) => (
                    <TransactionRow key={tx.prId} transaction={tx} />
                  ))}
                </TableBody>
              </Table>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

// ─── Individual Transaction Row ──────────────────────────────────────

function TransactionRow({ transaction: tx }: { transaction: SupplierTransaction }) {
  return (
    <TableRow hover>
      <TableCell>
        <Link
          href={`/pr/${tx.prId}`}
          underline="hover"
          color="primary"
          sx={{ fontWeight: 500 }}
        >
          {tx.prNumber}
        </Link>
      </TableCell>
      <TableCell>{formatDate(tx.date)}</TableCell>
      <TableCell>
        <Typography variant="caption">{tx.organization}</Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2" noWrap sx={{ maxWidth: 300 }}>
          {tx.description || "—"}
        </Typography>
      </TableCell>
      <TableCell align="right">
        {formatCurrency(tx.amount, tx.currency)}
      </TableCell>
      <TableCell>
        <Chip
          label={tx.status}
          size="small"
          color={getStatusColor(tx.status)}
          variant="outlined"
        />
      </TableCell>
      <TableCell>
        <Typography variant="caption">
          {tx.lineItemCount} items, {tx.quoteCount} quotes
        </Typography>
      </TableCell>
      <TableCell>
        <Stack direction="row" spacing={0.5}>
          {tx.attachments.slice(0, 3).map((att, i) => (
            <Tooltip key={i} title={`Download: ${att.name}`}>
              <IconButton
                size="small"
                component="a"
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {att.type?.includes("pdf") ? (
                  <Description fontSize="small" color="error" />
                ) : (
                  <Download fontSize="small" />
                )}
              </IconButton>
            </Tooltip>
          ))}
          {tx.attachments.length > 3 && (
            <Typography variant="caption" color="text.secondary" sx={{ alignSelf: "center" }}>
              +{tx.attachments.length - 3}
            </Typography>
          )}
        </Stack>
      </TableCell>
    </TableRow>
  );
}

// ─── Summary Stats Bar ───────────────────────────────────────────────

function StatsBar({ index }: { index: SupplierIndex }) {
  return (
    <Stack direction="row" spacing={3} sx={{ mb: 3 }}>
      <Paper sx={{ p: 2, flex: 1, textAlign: "center" }}>
        <Business color="primary" />
        <Typography variant="h5" fontWeight={700}>
          {index.totalSuppliers}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Suppliers
        </Typography>
      </Paper>
      <Paper sx={{ p: 2, flex: 1, textAlign: "center" }}>
        <Receipt color="primary" />
        <Typography variant="h5" fontWeight={700}>
          {index.totalTransactions}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Transactions
        </Typography>
      </Paper>
      <Paper sx={{ p: 2, flex: 1, textAlign: "center" }}>
        <TrendingUp color="primary" />
        <Typography variant="h5" fontWeight={700}>
          {index.suppliers.filter((s) =>
            s.transactions.some((t) => t.attachments.length > 0)
          ).length}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          With Invoices
        </Typography>
      </Paper>
    </Stack>
  );
}

// ─── Main Component ──────────────────────────────────────────────────

type SortField = "vendorName" | "transactionCount" | "totalValue" | "lastTransaction";
type SortDirection = "asc" | "desc";

export function SupplierHistoryView() {
  const user = useSelector((state: RootState) => state.auth.user);
  const [index, setIndex] = useState<SupplierIndex | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [orgFilter, setOrgFilter] = useState<string>("");
  const [expandedVendor, setExpandedVendor] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>("transactionCount");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");

  // Load data
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    supplierHistoryService
      .getSupplierIndex(orgFilter || undefined)
      .then((data) => {
        if (!cancelled) setIndex(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Failed to load supplier data");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [orgFilter]);

  // Filter & sort
  const filteredSuppliers = useMemo(() => {
    if (!index) return [];
    let result = index.suppliers;

    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      result = result.filter(
        (s) =>
          s.vendorName.toLowerCase().includes(term) ||
          s.organizations.some((o) => o.toLowerCase().includes(term)) ||
          s.transactions.some((t) =>
            t.description?.toLowerCase().includes(term) ||
            t.prNumber?.toLowerCase().includes(term)
          )
      );
    }

    // Sort
    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "vendorName":
          cmp = a.vendorName.localeCompare(b.vendorName);
          break;
        case "transactionCount":
          cmp = a.transactionCount - b.transactionCount;
          break;
        case "totalValue":
          cmp = a.totalValue - b.totalValue;
          break;
        case "lastTransaction":
          cmp = (a.lastTransaction || "").localeCompare(b.lastTransaction || "");
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [index, searchTerm, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  // Get unique organizations for filter
  const organizations = useMemo(() => {
    if (!index) return [];
    const orgs = new Set<string>();
    index.suppliers.forEach((s) => s.organizations.forEach((o) => orgs.add(o)));
    return Array.from(orgs).sort();
  }, [index]);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading supplier history...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
      </Alert>
    );
  }

  if (!index) return null;

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        Supplier History
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Historical vendor transactions from purchase requests. Click a supplier to see
        individual transactions and download invoices/quotes.
      </Typography>

      <StatsBar index={index} />

      {/* Search & Filter Bar */}
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <TextField
          placeholder="Search suppliers, PR numbers, descriptions..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          size="small"
          sx={{ flex: 1 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          }}
        />
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Organization</InputLabel>
          <Select
            value={orgFilter}
            onChange={(e) => setOrgFilter(e.target.value)}
            label="Organization"
          >
            <MenuItem value="">All Organizations</MenuItem>
            {organizations.map((org) => (
              <MenuItem key={org} value={org}>
                {org}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: "block" }}>
        Showing {filteredSuppliers.length} of {index.totalSuppliers} suppliers
      </Typography>

      {/* Supplier Table */}
      <TableContainer component={Paper} elevation={1}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell width={40} />
              <TableCell>
                <TableSortLabel
                  active={sortField === "vendorName"}
                  direction={sortField === "vendorName" ? sortDir : "asc"}
                  onClick={() => handleSort("vendorName")}
                >
                  Supplier
                </TableSortLabel>
              </TableCell>
              <TableCell align="center">
                <TableSortLabel
                  active={sortField === "transactionCount"}
                  direction={sortField === "transactionCount" ? sortDir : "desc"}
                  onClick={() => handleSort("transactionCount")}
                >
                  PRs
                </TableSortLabel>
              </TableCell>
              <TableCell align="right">
                <TableSortLabel
                  active={sortField === "totalValue"}
                  direction={sortField === "totalValue" ? sortDir : "desc"}
                  onClick={() => handleSort("totalValue")}
                >
                  Total Value
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortField === "lastTransaction"}
                  direction={sortField === "lastTransaction" ? sortDir : "desc"}
                  onClick={() => handleSort("lastTransaction")}
                >
                  Date Range
                </TableSortLabel>
              </TableCell>
              <TableCell>Statuses</TableCell>
              <TableCell align="center">Docs</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredSuppliers.map((supplier) => (
              <SupplierDetailRow
                key={supplier.vendorName}
                supplier={supplier}
                isExpanded={expandedVendor === supplier.vendorName}
                onToggle={() =>
                  setExpandedVendor(
                    expandedVendor === supplier.vendorName ? null : supplier.vendorName
                  )
                }
              />
            ))}
            {filteredSuppliers.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">
                    {searchTerm
                      ? `No suppliers match "${searchTerm}"`
                      : "No supplier transactions found"}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
