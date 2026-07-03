import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  IconButton,
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, Add as AddIcon } from '@mui/icons-material';
import { PERMISSION_NAMES } from '../../config/permissions';
import {
  listAllWhatsNew,
  createWhatsNew,
  updateWhatsNew,
  deleteWhatsNew,
} from '../../services/whatsNew';
import type { WhatsNewItem, WhatsNewItemInput } from '../../types/whatsNew';
import { useSnackbar } from '../../contexts/SnackbarContext';

const EMPTY_FORM: WhatsNewItemInput = {
  title: '',
  body: '',
  date: new Date().toISOString().slice(0, 10),
  active: true,
  audienceRoles: [],
  linkLabel: '',
  linkRoute: '',
};

const ROLE_OPTIONS = Object.entries(PERMISSION_NAMES) as unknown as [string, string][];

export function WhatsNewManagement() {
  const { showSnackbar } = useSnackbar();
  const [items, setItems] = useState<WhatsNewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<WhatsNewItemInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setItems(await listAllWhatsNew());
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, date: new Date().toISOString().slice(0, 10) });
    setDialogOpen(true);
  };

  const openEdit = (it: WhatsNewItem) => {
    setEditingId(it.id);
    setForm({
      title: it.title,
      body: it.body,
      date: it.date,
      active: it.active,
      audienceRoles: it.audienceRoles || [],
      linkLabel: it.linkLabel || '',
      linkRoute: it.linkRoute || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.body.trim() || !form.date) {
      showSnackbar('Title, body, and date are required.', 'warning');
      return;
    }
    setSaving(true);
    try {
      const payload: WhatsNewItemInput = {
        ...form,
        audienceRoles: (form.audienceRoles || []).filter((r) => typeof r === 'number'),
      };
      if (editingId) {
        await updateWhatsNew(editingId, payload);
        showSnackbar('Update saved', 'success');
      } else {
        await createWhatsNew(payload);
        showSnackbar('What\'s new item created', 'success');
      }
      setDialogOpen(false);
      await load();
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (it: WhatsNewItem) => {
    if (!window.confirm(`Delete "${it.title}"?`)) return;
    try {
      await deleteWhatsNew(it.id);
      showSnackbar('Deleted', 'success');
      await load();
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : String(err), 'error');
    }
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h6">What&apos;s New primer</Typography>
          <Typography variant="body2" color="text.secondary">
            Posts shown to users on their next login. Users see items dated after their last seen time.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>
          New item
        </Button>
      </Stack>

      <Alert severity="info" sx={{ mb: 2 }}>
        Leave <strong>Audience</strong> empty to show to everyone, or pick specific roles.
        Set <strong>Date</strong> to the publish day; users with a <code>lastWhatsNewSeenAt</code> after that date won&apos;t see it.
      </Alert>

      {loading ? (
        <CircularProgress />
      ) : items.length === 0 ? (
        <Typography variant="body2" color="text.secondary">No items yet.</Typography>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Title</TableCell>
                <TableCell>Audience</TableCell>
                <TableCell>Active</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((it) => (
                <TableRow key={it.id} hover>
                  <TableCell>{it.date}</TableCell>
                  <TableCell>{it.title}</TableCell>
                  <TableCell>
                    {(!it.audienceRoles || it.audienceRoles.length === 0)
                      ? 'Everyone'
                      : it.audienceRoles.map((r) => PERMISSION_NAMES[r as keyof typeof PERMISSION_NAMES] || `L${r}`).join(', ')}
                  </TableCell>
                  <TableCell>{it.active === false ? 'No' : 'Yes'}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => openEdit(it)} title="Edit"><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" onClick={() => handleDelete(it)} title="Delete"><DeleteIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editingId ? 'Edit What\'s New item' : 'New What\'s New item'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Title" fullWidth value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <TextField
              label="Body"
              fullWidth
              multiline
              minRows={3}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              helperText="Supports line breaks."
            />
            <TextField
              type="date"
              label="Date"
              InputLabelProps={{ shrink: true }}
              fullWidth
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
            <FormControl fullWidth>
              <InputLabel>Audience (empty = everyone)</InputLabel>
              <Select
                multiple
                value={form.audienceRoles || []}
                label="Audience (empty = everyone)"
                onChange={(e) => {
                  const val = e.target.value;
                  setForm({ ...form, audienceRoles: typeof val === 'string' ? [Number(val)] : val.map(Number) });
                }}
                renderValue={(selected) =>
                  (selected as number[]).map((r) => PERMISSION_NAMES[r as keyof typeof PERMISSION_NAMES] || `L${r}`).join(', ')
                }
              >
                {ROLE_OPTIONS.map(([lvlStr, name]) => {
                  const lvl = Number(lvlStr);
                  return (
                    <MenuItem key={lvl} value={lvl}>
                      <Checkbox checked={(form.audienceRoles || []).includes(lvl)} />
                      <ListItemText primary={`${name} (L${lvl})`} />
                    </MenuItem>
                  );
                })}
              </Select>
            </FormControl>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="Link label (optional)" fullWidth value={form.linkLabel || ''} onChange={(e) => setForm({ ...form, linkLabel: e.target.value })} />
              <TextField label="Link route (optional)" fullWidth placeholder="/provisioning" value={form.linkRoute || ''} onChange={(e) => setForm({ ...form, linkRoute: e.target.value })} />
            </Stack>
            <FormControlLabel
              control={<Switch checked={form.active !== false} onChange={(e) => setForm({ ...form, active: e.target.checked })} />}
              label="Active (shown to users)"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
