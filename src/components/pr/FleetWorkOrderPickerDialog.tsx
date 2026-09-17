/**
 * Searchable, paged modal picker for Fleet Hub work orders.
 *
 * Replaces the plain Select for the WO link on vehicle-expense PRs — the WO
 * list per vehicle grows without bound, so this supports text search
 * (title / description / vehicle code), sorting (most recent / priority /
 * status), and server-side paging via the listFleetWorkOrders callable.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { listFleetWorkOrders, type FleetWorkOrder } from '../../services/fleetWorkOrders';

const PAGE_SIZE = 10;

type SortKey = 'recent' | 'priority' | 'status';
type StatusFilter = 'open' | 'closed' | 'all';

interface FleetWorkOrderPickerDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (workOrder: FleetWorkOrder) => void;
  /** FM organization id (map PR orgs via prOrgToFleetOrg). */
  org: string;
  /** FM vehicle UUID (resolve mirror ids via resolveFleetVehicleId). */
  vehicleId: string;
  /** Currently linked WO id, if any (highlighted). */
  selectedId?: string;
}

function statusTone(status: string): 'default' | 'primary' | 'warning' | 'success' | 'error' {
  const s = (status || '').toLowerCase();
  if (s === 'in-progress') return 'primary';
  if (s === 'needs-parts' || s === 'awaiting-parts' || s === 'pr-submitted') return 'warning';
  if (s === 'completed' || s === 'closed') return 'success';
  if (s === 'cancelled' || s === 'rejected') return 'error';
  return 'default';
}

export function FleetWorkOrderPickerDialog({
  open,
  onClose,
  onSelect,
  org,
  vehicleId,
  selectedId,
}: FleetWorkOrderPickerDialogProps): React.ReactElement {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('recent');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<FleetWorkOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce the search box
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  // Reset to first page when the query/sort/status/vehicle changes
  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, sort, statusFilter, vehicleId, org]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    listFleetWorkOrders({
      org,
      vehicleId,
      status: statusFilter,
      q: debouncedQuery || undefined,
      sort,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    })
      .then((res) => {
        if (cancelled) return;
        setRows(res.workOrders || []);
        setTotal(typeof res.total === 'number' ? res.total : (res.workOrders || []).length);
      })
      .catch((err) => {
        if (cancelled) return;
        setRows([]);
        setTotal(0);
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, org, vehicleId, debouncedQuery, sort, statusFilter, page]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Select Fleet work order</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
          <TextField
            fullWidth
            size="small"
            label="Search work orders"
            placeholder="Title, description, or vehicle code…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <FormControl size="small" sx={{ minWidth: 110 }}>
            <InputLabel id="fleet-wo-status-label">Status</InputLabel>
            <Select
              labelId="fleet-wo-status-label"
              value={statusFilter}
              label="Status"
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            >
              <MenuItem value="open">Open</MenuItem>
              <MenuItem value="closed">Closed</MenuItem>
              <MenuItem value="all">All</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel id="fleet-wo-sort-label">Sort</InputLabel>
            <Select
              labelId="fleet-wo-sort-label"
              value={sort}
              label="Sort"
              onChange={(e) => setSort(e.target.value as SortKey)}
            >
              <MenuItem value="recent">Most recent</MenuItem>
              <MenuItem value="priority">Priority</MenuItem>
              <MenuItem value="status">Status</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : error ? (
          <Typography color="error" variant="body2">
            Could not load work orders: {error}
          </Typography>
        ) : rows.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {debouncedQuery
              ? `No ${statusFilter === 'all' ? '' : statusFilter + ' '}work orders match “${debouncedQuery}”.`
              : statusFilter === 'open'
                ? 'No open work orders for this vehicle — log one in Fleet Hub first (fm.1pwrafrica.com → Work orders).'
                : `No ${statusFilter === 'all' ? '' : 'closed '}work orders for this vehicle.`}
          </Typography>
        ) : (
          <List dense disablePadding>
            {rows.map((wo) => (
              <ListItemButton
                key={wo.id}
                selected={wo.id === selectedId}
                onClick={() => {
                  onSelect(wo);
                  onClose();
                }}
                sx={{ borderBottom: '1px solid', borderColor: 'divider', alignItems: 'flex-start' }}
              >
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      {wo.workOrderNumber ? (
                        <Typography variant="caption" component="span" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                          {wo.workOrderNumber}
                        </Typography>
                      ) : null}
                      <Typography variant="body2" fontWeight={600} component="span">
                        {wo.title || 'Work order'}
                      </Typography>
                      <Chip label={wo.status} size="small" color={statusTone(wo.status)} variant="outlined" />
                      {wo.priority ? (
                        <Chip label={wo.priority} size="small" variant="outlined" />
                      ) : null}
                    </Box>
                  }
                  secondary={
                    <>
                      {wo.vehicleCode ? `${wo.vehicleCode} · ` : ''}
                      {wo.createdAt ? `opened ${String(wo.createdAt).slice(0, 10)}` : ''}
                      {wo.description ? ` — ${String(wo.description).slice(0, 120)}` : ''}
                    </>
                  }
                />
              </ListItemButton>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between' }}>
        <Typography variant="caption" color="text.secondary" sx={{ pl: 1 }}>
          {total > 0
            ? `Page ${page} of ${totalPages} · ${total} ${statusFilter === 'all' ? '' : statusFilter + ' '}work order${total === 1 ? '' : 's'}`
            : ''}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button size="small" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <Button
            size="small"
            disabled={loading || page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
          <Button size="small" onClick={onClose}>
            Cancel
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}
