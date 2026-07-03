/**
 * Provisioning Catalog Studio — admin/procurement UI for the Field Camp Provisioning
 * catalog, gated by permission level.
 *
 * All writes route through permission-gated Cloud Functions (services/provisioningAdmin)
 * rather than writing Firestore directly, so access is enforced server-side and is
 * independent of the Nexus-owned firestore.rules.
 *
 * Tabs:
 *   - Rations   : issue-item catalog (ADMIN + PROC)
 *   - Menu      : N-day meal cycle (ADMIN + PROC)
 *   - Defaults  : per-org planning defaults + nutrition targets (ADMIN only)
 *   - Prices    : dated price book (ADMIN + PROC + FIN_AD + FIN_APPROVER)
 *   - Nutrition : live "calories work out" check using the shared engine
 *
 * Region/country dimension is implicit in which org is selected (one org = one country =
 * one catalog + menu + defaults + price book). Benin (1pwr_benin) and Lesotho
 * (1pwr_lesotho) maintain independent pantries here.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, MenuItem, Paper, Select, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Tabs, Tab, TextField, Typography, Chip,
  FormControl, InputLabel, Accordion, AccordionSummary, AccordionDetails, Alert,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AddIcon from '@mui/icons-material/Add';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { PERMISSION_LEVELS } from '../../config/permissions';
import { referenceDataAdminService } from '@/services/referenceDataAdmin';
import {
  listProvisioningCatalog, saveProvisioningRation, retireProvisioningRation,
  saveProvisioningPrice, retireProvisioningPrice, saveProvisioningDefaults,
  saveProvisioningMenu, ProvisioningCatalogResult,
} from '@/services/provisioningAdmin';
import { SPREADSHEET_DEFAULTS } from '@/utils/provisioningContext';
import {
  computeNutrition, computeNutritionBreakdown, ProvisioningInputs,
} from '@/utils/provisioningEngine';
import type {
  RationItem, RationPriceEntry, ProvisioningDefaults, ProvisioningMenu,
  RationCategory, RationClass, RationSpecialFormula, RationPackPlanning, RationPackTier,
} from '@/types/provisioning';

const CATEGORIES: RationCategory[] = ['Staples', 'Protein', 'Dairy', 'Cooking Inputs', 'Vegetables & Fruit', 'Seasoning', 'Issued Beverages', 'Kitchen & Hygiene'];
const CLASSES: RationClass[] = ['Food', 'Provision', 'Fixed'];
const FORMULAS: Array<{ value: '' | RationSpecialFormula; label: string }> = [
  { value: '', label: '— None (constant issue qty) —' },
  { value: 'purchasedBread', label: 'Purchased bread' },
  { value: 'steamedFlour', label: 'Steamed-bread flour' },
  { value: 'yeast', label: 'Yeast (steamed-flour × proportion)' },
  { value: 'toiletPaper', label: 'Toilet paper (1 / person-days per roll)' },
];
const TIERS: Array<'large' | 'medium' | 'small'> = ['large', 'medium', 'small'];

const emptyRation: Omit<RationItem, 'id'> = {
  name: '', category: 'Staples', class: 'Food', issueQtyPerPersonDay: 0, issueUnit: 'kg',
  nutritionPerUnit: { kcal: 0, proteinG: 0, fruitVegG: 0 }, specialFormula: undefined,
  packPlanning: { mode: 'simple', packSize: 1, packName: '1 unit' }, procurementNote: '', active: true,
} as any;

function inputsFromDefaults(d: ProvisioningDefaults | null): ProvisioningInputs {
  const t = d?.nutritionTargets ?? SPREADSHEET_DEFAULTS.nutritionTargets;
  return {
    numberOfPeople: 4, numberOfDays: 14,
    procurementBuffer: d?.defaultBuffer ?? SPREADSHEET_DEFAULTS.defaultBuffer,
    breadCoverageDays: d?.breadCoverageDays ?? SPREADSHEET_DEFAULTS.breadCoverageDays,
    flourPerLoafKg: d?.flourPerLoafKg ?? SPREADSHEET_DEFAULTS.flourPerLoafKg,
    yeastProportion: d?.yeastProportion ?? SPREADSHEET_DEFAULTS.yeastProportion,
    personDaysPerToiletRoll: d?.personDaysPerToiletRoll ?? SPREADSHEET_DEFAULTS.personDaysPerToiletRoll,
    nutritionTargets: t,
  };
}

export function ProvisioningStudio() {
  const { user } = useSelector((s: RootState) => s.auth);
  const level = user?.permissionLevel ?? 99;
  const canEditRations = level === PERMISSION_LEVELS.ADMIN || level === PERMISSION_LEVELS.PROC;
  const canEditMenu = canEditRations;
  const canEditDefaults = level === PERMISSION_LEVELS.ADMIN;
  const PROVISIONING_PRICE_LEVELS: number[] = [PERMISSION_LEVELS.ADMIN, PERMISSION_LEVELS.PROC, PERMISSION_LEVELS.FIN_AD, PERMISSION_LEVELS.FIN_APPROVER];
  const canEditPrices = PROVISIONING_PRICE_LEVELS.includes(level);

  const [orgs, setOrgs] = useState<Array<{ id: string; name: string; currency?: string; country?: string }>>([]);
  const [orgId, setOrgId] = useState('');
  const [catalog, setCatalog] = useState<ProvisioningCatalogResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState(0);

  const loadOrgs = useCallback(async () => {
    try {
      const items = await referenceDataAdminService.getItems('organizations');
      const list = items.map((o) => ({ id: o.id, name: o.name, currency: o.currency, country: o.country }));
      setOrgs(list);
      if (!orgId && list.length) setOrgId(list[0].id);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }, [orgId]);

  useEffect(() => { loadOrgs(); }, [loadOrgs]);

  const loadCatalog = useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true); setError(null);
    try { setCatalog(await listProvisioningCatalog(id)); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (orgId) loadCatalog(orgId); }, [orgId, loadCatalog]);

  const rations = catalog?.rations ?? [];
  const prices = catalog?.prices ?? [];
  const defaults = catalog?.defaults ?? null;
  const menu = catalog?.menu ?? null;
  const rationNameById = useMemo(() => {
    const m = new Map<string, string>();
    rations.forEach((r) => m.set(r.id, r.name));
    return m;
  }, [rations]);

  const activeRations = useMemo(() => rations.filter((r) => r.active !== false), [rations]);
  const inputs = useMemo(() => inputsFromDefaults(defaults), [defaults]);
  const nutrition = useMemo(() => computeNutrition(activeRations, inputs), [activeRations, inputs]);
  const breakdown = useMemo(() => computeNutritionBreakdown(activeRations, inputs), [activeRations, inputs]);

  const reload = () => orgId && loadCatalog(orgId);

  return (
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <FormControl size="small" sx={{ minWidth: 260 }}>
          <InputLabel>Organization</InputLabel>
          <Select value={orgId} label="Organization" onChange={(e) => setOrgId(e.target.value)}>
            {orgs.map((o) => <MenuItem key={o.id} value={o.id}>{o.name} ({o.currency || o.country || o.id})</MenuItem>)}
          </Select>
        </FormControl>
        <Chip
          size="small"
          color={nutrition.status === 'MEETS PLANNING TARGETS' ? 'success' : 'warning'}
          label={`Nutrition: ${nutrition.status}`}
        />
        <Typography variant="caption" color="text.secondary">
          {nutrition.energyKcal} kcal · {nutrition.proteinG}g protein · {nutrition.fruitVegG}g fruit/veg per person-day
        </Typography>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {!canEditRations && !canEditDefaults && !canEditPrices && (
        <Alert severity="info" sx={{ mb: 2 }}>You have view-only access to the provisioning catalog.</Alert>
      )}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tab label="Rations" />
        <Tab label="Menu" />
        <Tab label="Defaults" />
        <Tab label="Prices" />
        <Tab label="Nutrition check" />
      </Tabs>

      {loading && !catalog ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
      ) : !orgId ? (
        <Typography color="text.secondary">Select an organization to manage its provisioning catalog.</Typography>
      ) : (
        <>
          {tab === 0 && <RationsTab rations={rations} canEdit={canEditRations} saving={saving}
            onSave={async (r) => { setSaving(true); try { await saveProvisioningRation(orgId, r); await reload(); } catch (e) { setError(String(e)); } finally { setSaving(false); } }}
            onRetire={async (id) => { setSaving(true); try { await retireProvisioningRation(orgId, id); await reload(); } catch (e) { setError(String(e)); } finally { setSaving(false); } }} />}
          {tab === 1 && <MenuTab menu={menu} canEdit={canEditMenu} saving={saving}
            onSave={async (m) => { setSaving(true); try { await saveProvisioningMenu(orgId, m); await reload(); } catch (e) { setError(String(e)); } finally { setSaving(false); } }} />}
          {tab === 2 && <DefaultsTab defaults={defaults} orgCurrency={catalog?.organization?.currency} canEdit={canEditDefaults} saving={saving}
            onSave={async (d) => { setSaving(true); try { await saveProvisioningDefaults(orgId, d); await reload(); } catch (e) { setError(String(e)); } finally { setSaving(false); } }} />}
          {tab === 3 && <PricesTab prices={prices} rationNameById={rationNameById} rations={activeRations} orgCurrency={catalog?.organization?.currency} canEdit={canEditPrices} saving={saving}
            onSave={async (p) => { setSaving(true); try { await saveProvisioningPrice(orgId, p); await reload(); } catch (e) { setError(String(e)); } finally { setSaving(false); } }}
            onRetire={async (id) => { setSaving(true); try { await retireProvisioningPrice(orgId, id); await reload(); } catch (e) { setError(String(e)); } finally { setSaving(false); } }} />}
          {tab === 4 && <NutritionTab nutrition={nutrition} breakdown={breakdown} defaults={defaults} />}
        </>
      )}
    </Box>
  );
}

// ── Rations tab ─────────────────────────────────────────────────────────────────

function RationsTab({ rations, canEdit, saving, onSave, onRetire }: {
  rations: RationItem[]; canEdit: boolean; saving: boolean;
  onSave: (r: Partial<RationItem>) => Promise<void>;
  onRetire: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState<Partial<RationItem> | null>(null);
  return (
    <Box>
      {canEdit && (
        <Button variant="contained" startIcon={<AddIcon />} sx={{ mb: 2 }} onClick={() => setEditing({ ...emptyRation })}>
          Add ration item
        </Button>
      )}
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Item</TableCell><TableCell>Category</TableCell><TableCell>Class</TableCell>
              <TableCell>Qty/pd</TableCell><TableCell>Unit</TableCell><TableCell>Formula</TableCell>
              <TableCell>kcal</TableCell><TableCell>Active</TableCell><TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rations.map((r) => (
              <TableRow key={r.id} sx={{ opacity: r.active === false ? 0.5 : 1 }}>
                <TableCell>{r.name}</TableCell>
                <TableCell>{r.category}</TableCell><TableCell>{r.class}</TableCell>
                <TableCell>{r.issueQtyPerPersonDay}</TableCell><TableCell>{r.issueUnit}</TableCell>
                <TableCell>{r.specialFormula || '—'}</TableCell>
                <TableCell>{r.nutritionPerUnit?.kcal ?? 0}</TableCell>
                <TableCell>{r.active === false ? 'No' : 'Yes'}</TableCell>
                <TableCell>
                  {canEdit && (
                    <>
                      <IconButton size="small" onClick={() => setEditing(r)}><EditIcon fontSize="small" /></IconButton>
                      <IconButton size="small" color="error" disabled={r.active === false} onClick={() => onRetire(r.id)}><DeleteOutlineIcon fontSize="small" /></IconButton>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {editing && <RationDialog initial={editing} saving={saving} onClose={() => setEditing(null)} onSave={async (r) => { await onSave(r); setEditing(null); }} />}
    </Box>
  );
}

function RationDialog({ initial, saving, onClose, onSave }: {
  initial: Partial<RationItem>; saving: boolean; onClose: () => void; onSave: (r: Partial<RationItem>) => Promise<void>;
}) {
  const [r, setR] = useState<Partial<RationItem>>(() => ({
    ...initial,
    nutritionPerUnit: initial.nutritionPerUnit ?? { kcal: 0, proteinG: 0, fruitVegG: 0 },
    packPlanning: initial.packPlanning ?? { mode: 'simple', packSize: 1, packName: '1 unit' },
  }));
  const set = (k: keyof RationItem, v: any) => setR((p) => ({ ...p, [k]: v }));
  const setN = (k: 'kcal' | 'proteinG' | 'fruitVegG', v: number) => setR((p) => ({ ...p, nutritionPerUnit: { ...p.nutritionPerUnit!, [k]: v } }));
  const pack = r.packPlanning as RationPackPlanning;
  const setPack = (pp: RationPackPlanning) => set('packPlanning', pp);

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{initial.id ? 'Edit ration item' : 'Add ration item'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Item name" required value={r.name || ''} onChange={(e) => set('name', e.target.value)} fullWidth />
          <Stack direction="row" spacing={2}>
            <FormControl fullWidth><InputLabel>Category</InputLabel>
              <Select value={r.category || 'Staples'} label="Category" onChange={(e) => set('category', e.target.value as RationCategory)}>
                {CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl fullWidth><InputLabel>Class</InputLabel>
              <Select value={r.class || 'Food'} label="Class" onChange={(e) => set('class', e.target.value as RationClass)}>
                {CLASSES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </Select>
            </FormControl>
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField label="Issue qty / person-day" type="number" value={r.issueQtyPerPersonDay ?? 0} onChange={(e) => set('issueQtyPerPersonDay', Number(e.target.value))} fullWidth
              helperText={r.class === 'Fixed' ? 'Per-deployment quantity (not scaled).' : ''} />
            <TextField label="Issue unit" value={r.issueUnit || ''} onChange={(e) => set('issueUnit', e.target.value)} fullWidth />
          </Stack>
          <FormControl fullWidth><InputLabel>Special formula</InputLabel>
            <Select value={r.specialFormula || ''} label="Special formula" onChange={(e) => set('specialFormula', (e.target.value || undefined) as RationSpecialFormula | undefined)}>
              {FORMULAS.map((f) => <MenuItem key={f.value} value={f.value}>{f.label}</MenuItem>)}
            </Select>
          </FormControl>
          <Typography variant="subtitle2">Nutrition per issue unit</Typography>
          <Stack direction="row" spacing={2}>
            <TextField label="kcal" type="number" value={r.nutritionPerUnit?.kcal ?? 0} onChange={(e) => setN('kcal', Number(e.target.value))} fullWidth />
            <TextField label="Protein (g)" type="number" value={r.nutritionPerUnit?.proteinG ?? 0} onChange={(e) => setN('proteinG', Number(e.target.value))} fullWidth />
            <TextField label="Fruit/veg (g)" type="number" value={r.nutritionPerUnit?.fruitVegG ?? 0} onChange={(e) => setN('fruitVegG', Number(e.target.value))} fullWidth helperText="1000 = 1:1 by issue kg" />
          </Stack>
          <PackPlanningEditor pack={pack} onChange={setPack} />
          <TextField label="Procurement note" value={r.procurementNote || ''} onChange={(e) => set('procurementNote', e.target.value)} fullWidth multiline minRows={2} />
          <FormControl fullWidth><InputLabel>Active</InputLabel>
            <Select value={r.active === false ? false : true} label="Active" onChange={(e) => set('active', e.target.value === 'true')}>
              <MenuItem value="true">Yes</MenuItem><MenuItem value="false">No (retired)</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={saving || !r.name} onClick={() => onSave(r)}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}

function PackPlanningEditor({ pack, onChange }: { pack: RationPackPlanning; onChange: (p: RationPackPlanning) => void }) {
  if (pack.mode === 'simple') {
    return (
      <Box>
        <Stack direction="row" spacing={2} alignItems="center">
          <FormControl><InputLabel>Pack mode</InputLabel>
            <Select size="small" value="simple" label="Pack mode" onChange={() => onChange({ mode: 'bulk', tiers: [{ tier: 'large', size: 10, packName: '10 kg bag', unit: 'kg' }] })}>
              <MenuItem value="simple">Simple (single pack)</MenuItem>
              <MenuItem value="bulk">Bulk (tiered)</MenuItem>
            </Select>
          </FormControl>
          <TextField label="Pack size" type="number" value={pack.packSize} onChange={(e) => onChange({ mode: 'simple', packSize: Number(e.target.value), packName: pack.packName })} />
          <TextField label="Pack name" value={pack.packName} onChange={(e) => onChange({ mode: 'simple', packSize: pack.packSize, packName: e.target.value })} />
        </Stack>
      </Box>
    );
  }
  const tiers = pack.tiers ?? [];
  const updateTier = (i: number, t: Partial<RationPackTier>) => onChange({ mode: 'bulk', tiers: tiers.map((x, idx) => idx === i ? { ...x, ...t } : x) });
  const addTier = () => onChange({ mode: 'bulk', tiers: [...tiers, { tier: 'small', size: 1, packName: '1 unit', unit: 'kg' }] });
  const removeTier = (i: number) => onChange({ mode: 'bulk', tiers: tiers.filter((_, idx) => idx !== i) });
  return (
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
        <FormControl><InputLabel>Pack mode</InputLabel>
          <Select size="small" value="bulk" label="Pack mode" onChange={() => onChange({ mode: 'simple', packSize: 1, packName: '1 unit' })}>
            <MenuItem value="simple">Simple (single pack)</MenuItem>
            <MenuItem value="bulk">Bulk (tiered)</MenuItem>
          </Select>
        </FormControl>
        <Button size="small" startIcon={<AddIcon />} onClick={addTier}>Add tier</Button>
      </Stack>
      {tiers.map((t, i) => (
        <Stack key={i} direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <FormControl size="small"><Select value={t.tier} onChange={(e) => updateTier(i, { tier: e.target.value as RationPackTier['tier'] })}>
            {TIERS.map((tt) => <MenuItem key={tt} value={tt}>{tt}</MenuItem>)}
          </Select></FormControl>
          <TextField size="small" label="Size" type="number" value={t.size} onChange={(e) => updateTier(i, { size: Number(e.target.value) })} sx={{ width: 100 }} />
          <TextField size="small" label="Unit" value={t.unit} onChange={(e) => updateTier(i, { unit: e.target.value })} sx={{ width: 100 }} />
          <TextField size="small" label="Pack name" value={t.packName} onChange={(e) => updateTier(i, { packName: e.target.value })} sx={{ flex: 1 }} />
          <IconButton size="small" onClick={() => removeTier(i)}><DeleteOutlineIcon fontSize="small" /></IconButton>
        </Stack>
      ))}
    </Box>
  );
}

// ── Menu tab ────────────────────────────────────────────────────────────────────

function MenuTab({ menu, canEdit, saving, onSave }: {
  menu: ProvisioningMenu | null; canEdit: boolean; saving: boolean;
  onSave: (m: Partial<ProvisioningMenu>) => Promise<void>;
}) {
  const [name, setName] = useState(menu?.name || '7-Day Camp Menu Cycle');
  const [cycleLength, setCycleLength] = useState(menu?.cycleLength ?? 7);
  const [days, setDays] = useState<Array<{ day: number; breakfast: string; midday: string; evening: string }>>(menu?.days ?? []);
  useEffect(() => {
    setName(menu?.name || '7-Day Camp Menu Cycle');
    setCycleLength(menu?.cycleLength ?? 7);
    setDays(menu?.days ?? []);
  }, [menu]);
  const setDay = (i: number, k: 'breakfast' | 'midday' | 'evening', v: string) => setDays((p) => p.map((d, idx) => idx === i ? { ...d, [k]: v } : d));
  const addDay = () => setDays((p) => [...p, { day: p.length + 1, breakfast: '', midday: '', evening: '' }]);
  const removeDay = (i: number) => setDays((p) => p.filter((_, idx) => idx !== i).map((d, idx) => ({ ...d, day: idx + 1 })));

  return (
    <Box>
      <Stack direction="row" spacing={2} sx={{ mb: 2 }} alignItems="center">
        <TextField label="Menu name" value={name} onChange={(e) => setName(e.target.value)} sx={{ minWidth: 300 }} />
        <TextField label="Cycle length (days)" type="number" value={cycleLength} onChange={(e) => setCycleLength(Number(e.target.value))} sx={{ width: 180 }} />
      </Stack>
      {days.length === 0 && <Typography color="text.secondary" sx={{ mb: 1 }}>No menu days yet. Add the first day to build the cycle.</Typography>}
      {days.map((d, i) => (
        <Paper key={i} variant="outlined" sx={{ p: 1.5, mb: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="subtitle2">Day {d.day}</Typography>
            <IconButton size="small" onClick={() => removeDay(i)}><DeleteOutlineIcon fontSize="small" /></IconButton>
          </Stack>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
            <TextField size="small" label="Breakfast" value={d.breakfast} onChange={(e) => setDay(i, 'breakfast', e.target.value)} fullWidth />
            <TextField size="small" label="Midday" value={d.midday} onChange={(e) => setDay(i, 'midday', e.target.value)} fullWidth />
            <TextField size="small" label="Evening" value={d.evening} onChange={(e) => setDay(i, 'evening', e.target.value)} fullWidth />
          </Stack>
        </Paper>
      ))}
      {canEdit && (
        <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
          <Button startIcon={<AddIcon />} onClick={addDay}>Add day</Button>
          <Button variant="contained" disabled={saving} onClick={() => onSave({ name, cycleLength, days })}>Save menu</Button>
        </Stack>
      )}
    </Box>
  );
}

// ── Defaults tab ────────────────────────────────────────────────────────────────

function DefaultsTab({ defaults, orgCurrency, canEdit, saving, onSave }: {
  defaults: ProvisioningDefaults | null; orgCurrency?: string; canEdit: boolean; saving: boolean;
  onSave: (d: Partial<ProvisioningDefaults>) => Promise<void>;
}) {
  const [d, setD] = useState<Partial<ProvisioningDefaults>>(() => defaults ?? {
    name: 'Default planning assumptions', nutritionTargets: { kcal: 3600, proteinG: 100, fruitVegG: 400 },
    defaultBuffer: 0.05, breadCoverageDays: 7, flourPerLoafKg: 0.52, yeastProportion: 0.02,
    personDaysPerToiletRoll: 3.5, defaultCurrency: orgCurrency || 'LSL', reportingCurrency: '',
  });
  useEffect(() => { if (defaults) setD(defaults); }, [defaults]);
  const set = (k: keyof ProvisioningDefaults, v: any) => setD((p) => ({ ...p, [k]: v }));
  const setT = (k: 'kcal' | 'proteinG' | 'fruitVegG', v: number) => setD((p) => ({ ...p, nutritionTargets: { ...p.nutritionTargets!, [k]: v } }));

  return (
    <Box>
      {!canEdit && <Alert severity="info" sx={{ mb: 2 }}>Defaults are ADMIN-managed. You can view but not edit.</Alert>}
      <Stack spacing={2} sx={{ maxWidth: 700 }}>
        <TextField label="Label" value={d.name || ''} onChange={(e) => set('name', e.target.value)} disabled={!canEdit} />
        <Typography variant="subtitle2">Nutrition targets (per person-day)</Typography>
        <Stack direction="row" spacing={2}>
          <TextField label="Energy (kcal)" type="number" value={d.nutritionTargets?.kcal ?? 0} onChange={(e) => setT('kcal', Number(e.target.value))} disabled={!canEdit} fullWidth />
          <TextField label="Protein (g)" type="number" value={d.nutritionTargets?.proteinG ?? 0} onChange={(e) => setT('proteinG', Number(e.target.value))} disabled={!canEdit} fullWidth />
          <TextField label="Fruit/veg (g)" type="number" value={d.nutritionTargets?.fruitVegG ?? 0} onChange={(e) => setT('fruitVegG', Number(e.target.value))} disabled={!canEdit} fullWidth />
        </Stack>
        <Stack direction="row" spacing={2}>
          <TextField label="Default buffer (fraction)" type="number" value={d.defaultBuffer ?? 0} onChange={(e) => set('defaultBuffer', Number(e.target.value))} disabled={!canEdit} helperText="0.05 = 5%" />
          <TextField label="Bread coverage days" type="number" value={d.breadCoverageDays ?? 0} onChange={(e) => set('breadCoverageDays', Number(e.target.value))} disabled={!canEdit} />
        </Stack>
        <Stack direction="row" spacing={2}>
          <TextField label="Flour per loaf (kg)" type="number" value={d.flourPerLoafKg ?? 0} onChange={(e) => set('flourPerLoafKg', Number(e.target.value))} disabled={!canEdit} />
          <TextField label="Yeast proportion" type="number" value={d.yeastProportion ?? 0} onChange={(e) => set('yeastProportion', Number(e.target.value))} disabled={!canEdit} />
          <TextField label="Person-days / toilet roll" type="number" value={d.personDaysPerToiletRoll ?? 0} onChange={(e) => set('personDaysPerToiletRoll', Number(e.target.value))} disabled={!canEdit} />
        </Stack>
        <Stack direction="row" spacing={2}>
          <TextField label="Plan currency" value={d.defaultCurrency || ''} onChange={(e) => set('defaultCurrency', e.target.value)} disabled={!canEdit} />
          <TextField label="Reporting currency (optional)" value={d.reportingCurrency || ''} onChange={(e) => set('reportingCurrency', e.target.value)} disabled={!canEdit} />
        </Stack>
        {canEdit && <Button variant="contained" disabled={saving} sx={{ alignSelf: 'flex-start' }} onClick={() => onSave(d)}>Save defaults</Button>}
      </Stack>
    </Box>
  );
}

// ── Prices tab ──────────────────────────────────────────────────────────────────

function PricesTab({ prices, rationNameById, rations, orgCurrency, canEdit, saving, onSave, onRetire }: {
  prices: RationPriceEntry[]; rationNameById: Map<string, string>; rations: RationItem[]; orgCurrency?: string;
  canEdit: boolean; saving: boolean;
  onSave: (p: Partial<RationPriceEntry>) => Promise<void>;
  onRetire: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState<Partial<RationPriceEntry> | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <Box>
      {canEdit && (
        <Button variant="contained" startIcon={<AddIcon />} sx={{ mb: 2 }} onClick={() => setEditing({ tier: null, currency: orgCurrency || 'LSL', price: 0, effectiveFrom: today, effectiveTo: null, active: true })}>
          Add price entry
        </Button>
      )}
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Ration item</TableCell><TableCell>Tier</TableCell><TableCell>Pack</TableCell>
              <TableCell>Currency</TableCell><TableCell>Price</TableCell><TableCell>From</TableCell><TableCell>To</TableCell>
              <TableCell>Active</TableCell><TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {prices.map((p) => (
              <TableRow key={p.id} sx={{ opacity: p.active === false ? 0.5 : 1 }}>
                <TableCell>{rationNameById.get(p.rationItemId) || p.rationItemId}</TableCell>
                <TableCell>{p.tier || 'unit'}</TableCell><TableCell>{p.packName || '—'}</TableCell>
                <TableCell>{p.currency}</TableCell><TableCell>{p.price}</TableCell>
                <TableCell>{p.effectiveFrom}</TableCell><TableCell>{p.effectiveTo || 'open'}</TableCell>
                <TableCell>{p.active === false ? 'No' : 'Yes'}</TableCell>
                <TableCell>
                  {canEdit && (
                    <>
                      <IconButton size="small" onClick={() => setEditing(p)}><EditIcon fontSize="small" /></IconButton>
                      <IconButton size="small" color="error" disabled={p.active === false} onClick={() => onRetire(p.id)}><DeleteOutlineIcon fontSize="small" /></IconButton>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {editing && (
        <PriceDialog initial={editing} rations={rations} saving={saving} onClose={() => setEditing(null)}
          onSave={async (p) => { await onSave(p); setEditing(null); }} />
      )}
    </Box>
  );
}

function PriceDialog({ initial, rations, saving, onClose, onSave }: {
  initial: Partial<RationPriceEntry>; rations: RationItem[]; saving: boolean;
  onClose: () => void; onSave: (p: Partial<RationPriceEntry>) => Promise<void>;
}) {
  const [p, setP] = useState<Partial<RationPriceEntry>>(initial);
  const set = (k: keyof RationPriceEntry, v: any) => setP((prev) => ({ ...prev, [k]: v }));
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{initial.id ? 'Edit price entry' : 'Add price entry'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <FormControl fullWidth><InputLabel>Ration item</InputLabel>
            <Select value={p.rationItemId || ''} label="Ration item" onChange={(e) => set('rationItemId', e.target.value)}>
              {rations.map((r) => <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl fullWidth><InputLabel>Pack tier</InputLabel>
            <Select value={p.tier === null ? 'unit' : p.tier} label="Pack tier" onChange={(e) => set('tier', e.target.value === 'unit' ? null : e.target.value)}>
              <MenuItem value="unit">Unit / simple pack</MenuItem>
              {TIERS.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField label="Pack name" value={p.packName || ''} onChange={(e) => set('packName', e.target.value)} helperText='e.g. "10 kg bag", "400 g can"' />
          <Stack direction="row" spacing={2}>
            <TextField label="Currency" value={p.currency || ''} onChange={(e) => set('currency', e.target.value)} fullWidth />
            <TextField label="Price" type="number" value={p.price ?? 0} onChange={(e) => set('price', Number(e.target.value))} fullWidth />
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField label="Effective from" value={p.effectiveFrom || ''} onChange={(e) => set('effectiveFrom', e.target.value)} helperText="YYYY-MM-DD" />
            <TextField label="Effective to (optional)" value={p.effectiveTo || ''} onChange={(e) => set('effectiveTo', e.target.value || null)} helperText="YYYY-MM-DD" />
          </Stack>
          <TextField label="Source" value={p.source || ''} onChange={(e) => set('source', e.target.value)} helperText='e.g. "quote:2026-06"' />
          <TextField label="Note" value={p.note || ''} onChange={(e) => set('note', e.target.value)} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={saving || !p.rationItemId} onClick={() => onSave(p)}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Nutrition check tab ─────────────────────────────────────────────────────────

function NutritionTab({ nutrition, breakdown, defaults }: {
  nutrition: ReturnType<typeof computeNutrition>;
  breakdown: ReturnType<typeof computeNutritionBreakdown>;
  defaults: ProvisioningDefaults | null;
}) {
  const t = nutrition.targets;
  const row = (label: string, value: number, target: number, meets: boolean) => (
    <TableRow>
      <TableCell>{label}</TableCell>
      <TableCell>{value}</TableCell>
      <TableCell>≥ {target}</TableCell>
      <TableCell><Chip size="small" color={meets ? 'success' : 'warning'} label={meets ? 'Meets' : 'Review'} /></TableCell>
    </TableRow>
  );
  return (
    <Box>
      <Alert severity={nutrition.status === 'MEETS PLANNING TARGETS' ? 'success' : 'warning'} sx={{ mb: 2 }}>
        {nutrition.status} — computed from the active catalog against this org's nutrition targets.
      </Alert>
      <TableContainer component={Paper} variant="outlined" sx={{ mb: 2, maxWidth: 500 }}>
        <Table size="small">
          <TableHead><TableRow><TableCell>Metric</TableCell><TableCell>Per person-day</TableCell><TableCell>Target</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
          <TableBody>
            {row('Energy (kcal)', nutrition.energyKcal, t.kcal, nutrition.energyMeets)}
            {row('Protein (g)', nutrition.proteinG, t.proteinG, nutrition.proteinMeets)}
            {row('Fruit & veg (g)', nutrition.fruitVegG, t.fruitVegG, nutrition.fruitVegMeets)}
          </TableBody>
        </Table>
      </TableContainer>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Targets source: {defaults ? 'org provisioning defaults' : 'spreadsheet fallback (3600 / 100 / 400)'}. Edit on the Defaults tab.
      </Typography>
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography>Per-item breakdown</Typography></AccordionSummary>
        <AccordionDetails>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead><TableRow><TableCell>Item</TableCell><TableCell>Issue qty/pd</TableCell><TableCell>Unit</TableCell><TableCell>kcal</TableCell><TableCell>Protein (g)</TableCell><TableCell>Fruit/veg (g)</TableCell></TableRow></TableHead>
              <TableBody>
                {breakdown.map((b) => (
                  <TableRow key={b.rationItemId}>
                    <TableCell>{b.name}</TableCell><TableCell>{b.issueQty}</TableCell><TableCell>{b.issueUnit}</TableCell>
                    <TableCell>{b.kcal}</TableCell><TableCell>{b.proteinG}</TableCell><TableCell>{b.fruitVegG}</TableCell>
                  </TableRow>
                ))}
                <TableRow sx={{ fontWeight: 'bold' }}>
                  <TableCell><strong>Total</strong></TableCell><TableCell /><TableCell />
                  <TableCell><strong>{nutrition.energyKcal}</strong></TableCell>
                  <TableCell><strong>{nutrition.proteinG}</strong></TableCell>
                  <TableCell><strong>{nutrition.fruitVegG}</strong></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}
