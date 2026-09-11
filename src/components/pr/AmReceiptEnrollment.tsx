import { useState } from 'react';
import { Alert, Autocomplete, Box, Button, Checkbox, FormControlLabel, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { collection, doc, getDoc, getDocs, getFirestore, limit, query, where } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '@/config/firebase';
import type { PRRequest } from '@/types/pr';

type Row = Record<string, any>;
type Choice = { assetId: string; levelId: string; label: string };

export default function AmReceiptEnrollment({ pr, onEnrolled }: { pr: PRRequest; onEnrolled: () => void }) {
  const [open, setOpen] = useState(false);
  const [sites, setSites] = useState<Row[]>([]);
  const [site, setSite] = useState<Row | null>(null);
  const [choices, setChoices] = useState<Choice[]>([]);
  const [selected, setSelected] = useState<Record<string, Choice | null>>({});
  const [source, setSource] = useState<'po' | 'request'>('po');
  const [note, setNote] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const row = pr as unknown as Row;
  const lines: Row[] = (source === 'po' ? row.lineItemsWithSKU : row.lineItems) || [];
  const stable = lines.length > 0 && lines.every(l => l.id && Number.isSafeInteger(l.quantity) && l.quantity > 0) && new Set(lines.map(l => l.id)).size === lines.length;
  const db = getFirestore(app);
  async function start() {
    setOpen(true); setBusy(true); setError('');
    try {
      const ids = [...new Set([row.site, ...(Array.isArray(row.sites) ? row.sites : [])].filter(x => typeof x === 'string' && x))];
      const records = await Promise.all(ids.map(id => getDoc(doc(db, 'referenceData_sites', id))));
      setSites(records.filter(s => s.exists()).map(s => ({ ...s.data(), id: s.id })));
      if (!ids.length) throw new Error('Record the approved destination site on this order before setting up receipt checks.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Destination sites could not be loaded.'); }
    finally { setBusy(false); }
  }
  async function chooseSite(id: string) {
    const next = sites.find(s => s.id === id) || null;
    setSite(next); setSelected({}); setChoices([]); setBusy(true); setError('');
    try {
      if (!next?.countryCode || !next?.organizationId || !next?.code) throw new Error('The site needs a canonical country, code and asset owner before enrollment.');
      const countries = await getDocs(query(collection(db, 'pr_master_countries'), where('iso2', '==', next.countryCode), limit(2)));
      if (countries.size !== 1) throw new Error('AM country identity needs reconciliation before receipt setup.');
      const location = `${countries.docs[0].data().country_code}-${next.code}`;
      const [assets, levels] = await Promise.all([
        getDocs(query(collection(db, 'am_core_assets'), where('organization_id', '==', next.organizationId), limit(2001))),
        getDocs(query(collection(db, 'am_core_inventory_levels'), where('location_id', '==', location), limit(2001))),
      ]);
      if (assets.size > 2000 || levels.size > 2000) throw new Error('This destination exceeds the pilot search limit; ask the AM administrator to narrow the inventory.');
      const byId = new Map(assets.docs.map(a => [a.id, a.data()]));
      const options: Choice[] = [];
      for (const level of levels.docs) {
        const l = level.data(), a = byId.get(l.asset_id);
        if (!a || !['Material', 'Consumable', 'Inventory'].includes(a.item_class) || a.active === false || a.active === 0) continue;
        options.push({ assetId: l.asset_id, levelId: level.id, label: `${a.name || a.asset_name || a.asset_id || l.asset_id} · ${a.asset_id || ''} · ${a.unit_of_measure || 'unit unknown'} · ${location}` });
      }
      setChoices(options);
      if (!options.length) throw new Error('No existing stock positions match this site and owner. AM must establish and reconcile the inventory first.');
    } catch (e) { setError(e instanceof Error ? e.message : 'AM inventory could not be loaded. Relaunch PR from Nexus and check your AM viewing access.'); }
    finally { setBusy(false); }
  }
  async function enroll() {
    setBusy(true); setError('');
    try {
      await httpsCallable(getFunctions(app), 'enrollPrReceiptPilot')({
        prId: pr.id, ownerId: site!.organizationId, siteDocumentId: site!.id, lineSource: source, note,
        lines: lines.map(l => ({ lineId: l.id, assetId: selected[l.id]!.assetId, levelId: selected[l.id]!.levelId, specificationVerified: confirmed })),
      });
      onEnrolled(); setOpen(false);
    } catch (e) { setError(e instanceof Error ? e.message : 'Receipt setup failed. No enrollment is assumed.'); }
    finally { setBusy(false); }
  }
  if (!open) return <Button sx={{ mb: 2 }} onClick={start}>Set up AM receipt checks</Button>;
  return <Box sx={{ mb: 3, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
    <Stack spacing={2}>
      <Typography variant="h6">Set up AM receipt checks</Typography>
      <Alert severity="info">Use this for prospective whole-unit goods orders. Every approved line must match an AM item and an existing destination. Once enabled, closeout requires AM to record all accepted quantities; delivery overrides cannot waive it.</Alert>
      <TextField select label="Approved destination and asset owner" value={site?.id || ''} onChange={e => chooseSite(e.target.value)} disabled={busy}>
        {sites.map(s => <MenuItem key={s.id} value={s.id}>{s.name} · {s.organizationId} · {s.countryCode || 'country missing'}</MenuItem>)}
      </TextField>
      <TextField select label="Approved order lines to reconcile" value={source} onChange={e => {setSource(e.target.value as 'po' | 'request'); setSelected({}); setConfirmed(false);}} disabled={busy}>
        <MenuItem value="po">Purchase order lines</MenuItem><MenuItem value="request">Approved purchase request lines</MenuItem>
      </TextField>
      {!stable && <Alert severity="warning">This line set needs unique line identifiers and positive whole-unit quantities. Services, fractions and mixed orders require reconciliation before joining the pilot.</Alert>}
      {lines.map((l, i) => <Autocomplete key={l.id || i} options={choices} getOptionLabel={o => o.label} isOptionEqualToValue={(a,b) => a.levelId === b.levelId} value={selected[l.id] || null} disabled={busy || !stable} onChange={(_, value) => {setSelected(s => ({...s, [l.id]: value})); setConfirmed(false);}} renderInput={params => <TextField {...params} label={`${l.description || `Line ${i+1}`} — ${l.quantity} ${l.uom || ''}`} helperText="Choose the exact specification and compatible unit, not just a similar name." />} />)}
      <TextField label="Specification review and approval reference" multiline minRows={2} value={note} onChange={e => setNote(e.target.value)} inputProps={{minLength:10,maxLength:2000}} disabled={busy} />
      <FormControlLabel control={<Checkbox checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)} />} label="I verified every selected AM specification against the approved order, including units and destination owner." />
      {error && <Alert severity="error">{error}</Alert>}
      <Stack direction="row" spacing={1}><Button variant="contained" onClick={enroll} disabled={busy || !site || !stable || !confirmed || note.trim().length < 10 || lines.some(l => !selected[l.id])}>{busy ? 'Checking…' : 'Enable AM receipt checks'}</Button><Button onClick={() => setOpen(false)} disabled={busy}>Cancel</Button></Stack>
    </Stack>
  </Box>;
}
