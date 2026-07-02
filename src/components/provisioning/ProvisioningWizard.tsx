import React, { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { RootState } from '../../store';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { resolveProvisioningContext, SPREADSHEET_DEFAULTS } from '../../utils/provisioningContext';
import {
  computePlan,
  ProvisioningInputs,
  ProvisioningLine,
} from '../../utils/provisioningEngine';
import type { RationItem, ProvisioningPlan } from '../../types/provisioning';
import { listFleetMissions, getFleetMission, fleetMissionDays, FleetMission } from '../../services/fleetMissions';
import { savePlan, updatePlanStatus } from '../../services/provisioningPlans';
import { createPRFromProvisioningPlan } from '../../services/pr';
import { referenceDataAdminService } from '../../services/referenceDataAdmin';

const STEPS = ['Mission & inputs', 'Ration selection', 'Review & save'];

export function ProvisioningWizard() {
  const navigate = useNavigate();
  const { showSnackbar } = useSnackbar();
  const user = useSelector((state: RootState) => state.auth.user);

  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Org options from the user's primary + additional orgs.
  const orgOptions = useMemo(() => {
    const ids = new Set<string>();
    if (user?.organization) ids.add(user.organization);
    (user?.additionalOrganizations || []).forEach((o: string) => ids.add(o));
    return Array.from(ids);
  }, [user]);

  const [organizationId, setOrganizationId] = useState<string>(orgOptions[0] || '');
  const [context, setContext] = useState<Awaited<ReturnType<typeof resolveProvisioningContext>> | null>(null);

  // Mission link.
  const [missions, setMissions] = useState<FleetMission[]>([]);
  const [missionId, setMissionId] = useState<string>('');
  const [mission, setMission] = useState<FleetMission | null>(null);

  // Step 1 inputs.
  const [numberOfPeople, setNumberOfPeople] = useState<number>(4);
  const [numberOfDays, setNumberOfDays] = useState<number>(7);
  const [procurementBuffer, setProcurementBuffer] = useState<number>(SPREADSHEET_DEFAULTS.defaultBuffer);
  const [breadCoverageDays, setBreadCoverageDays] = useState<number>(SPREADSHEET_DEFAULTS.breadCoverageDays);
  const [flourPerLoafKg, setFlourPerLoafKg] = useState<number>(SPREADSHEET_DEFAULTS.flourPerLoafKg);
  const [yeastProportion, setYeastProportion] = useState<number>(SPREADSHEET_DEFAULTS.yeastProportion);
  const [personDaysPerToiletRoll, setPersonDaysPerToiletRoll] = useState<number>(SPREADSHEET_DEFAULTS.personDaysPerToiletRoll);
  const [inputsOverridden, setInputsOverridden] = useState(false);
  const [notes, setNotes] = useState('');

  // Step 2 selection.
  const [selectedRationIds, setSelectedRationIds] = useState<string[]>([]);

  // Step 3 manual price overrides + saved plan.
  const [manualPriceOverrides, setManualPriceOverrides] = useState<Record<string, number>>({});
  const [savedPlan, setSavedPlan] = useState<ProvisioningPlan | null>(null);

  // Generate PR dialog state.
  const [prDialogOpen, setPrDialogOpen] = useState(false);
  const [prExtras, setPrExtras] = useState({ department: '', projectCategory: '', site: '', expenseType: '', requiredDate: '' });
  const [prDepartments, setPrDepartments] = useState<any[]>([]);
  const [prCategories, setPrCategories] = useState<any[]>([]);
  const [prSites, setPrSites] = useState<any[]>([]);
  const [prExpenseTypes, setPrExpenseTypes] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);

  // Load provisioning context when org changes.
  useEffect(() => {
    let cancelled = false;
    if (!organizationId) return;
    setLoading(true);
    resolveProvisioningContext(organizationId)
      .then((ctx) => {
        if (cancelled) return;
        setContext(ctx);
        if (ctx?.defaults) {
          const d = ctx.defaults;
          setProcurementBuffer(d.defaultBuffer ?? SPREADSHEET_DEFAULTS.defaultBuffer);
          setBreadCoverageDays(d.breadCoverageDays ?? SPREADSHEET_DEFAULTS.breadCoverageDays);
          setFlourPerLoafKg(d.flourPerLoafKg ?? SPREADSHEET_DEFAULTS.flourPerLoafKg);
          setYeastProportion(d.yeastProportion ?? SPREADSHEET_DEFAULTS.yeastProportion);
          setPersonDaysPerToiletRoll(d.personDaysPerToiletRoll ?? SPREADSHEET_DEFAULTS.personDaysPerToiletRoll);
        }
        // Default-select all rations.
        setSelectedRationIds((ctx?.rations || []).map((r) => r.id));
      })
      .catch((err) => showSnackbar(err instanceof Error ? err.message : String(err), 'error'))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [organizationId, showSnackbar]);

  // Load Fleet missions for the org.
  useEffect(() => {
    if (!organizationId) return;
    listFleetMissions({ org: organizationId })
      .then((res) => setMissions(res.missions))
      .catch((err) => {
        console.warn('[provisioning] Fleet mission list failed:', err);
        setMissions([]);
      });
  }, [organizationId]);

  // When a mission is selected, prepopulate people/days.
  useEffect(() => {
    if (!missionId) { setMission(null); return; }
    getFleetMission(missionId, organizationId)
      .then((res) => {
        setMission(res.mission);
        if (res.mission) {
          const crew = Number(res.mission.crew_size);
          if (Number.isFinite(crew) && crew > 0) setNumberOfPeople(crew);
          const days = fleetMissionDays(res.mission);
          if (days > 0) setNumberOfDays(days);
          setInputsOverridden(false);
        }
      })
      .catch((err) => showSnackbar(err instanceof Error ? err.message : String(err), 'error'));
  }, [missionId, organizationId, showSnackbar]);

  const inputs: ProvisioningInputs = useMemo(() => ({
    numberOfPeople,
    numberOfDays,
    procurementBuffer,
    breadCoverageDays,
    flourPerLoafKg,
    yeastProportion,
    personDaysPerToiletRoll,
    nutritionTargets: context?.defaults?.nutritionTargets || SPREADSHEET_DEFAULTS.nutritionTargets,
  }), [numberOfPeople, numberOfDays, procurementBuffer, breadCoverageDays, flourPerLoafKg, yeastProportion, personDaysPerToiletRoll, context]);

  const plan = useMemo(() => {
    const catalog = (context?.rations || []).filter((r) => selectedRationIds.includes(r.id));
    if (catalog.length === 0) return null;
    const asOf = new Date().toISOString().slice(0, 10);
    const prices = (context?.prices || []).map((p) => ({
      ...p,
      // Apply manual overrides by key `${rationItemId}|${tier ?? 'unit'}`.
      price: manualPriceOverrides[`${p.rationItemId}|${p.tier ?? 'unit'}`] ?? p.price,
    }));
    return computePlan(catalog as RationItem[], inputs, prices as any, context?.baseCurrency || 'LSL', asOf);
  }, [context, selectedRationIds, inputs, manualPriceOverrides]);

  const toggleRation = (id: string) => {
    setSelectedRationIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const markOverride = () => setInputsOverridden(true);

  const handleSave = async () => {
    if (!plan || !context || !user) return;
    setLoading(true);
    try {
      const lines = plan.lines.map((l) => ({ ...l }));
      const snapshot = {
        rations: (context.rations || []).map((r) => ({
          id: r.id, name: r.name, category: r.category, class: r.class,
          issueQtyPerPersonDay: r.issueQtyPerPersonDay, issueUnit: r.issueUnit,
        })),
        prices: (context.prices || []).map((p) => ({
          rationItemId: p.rationItemId, tier: p.tier, price: p.price, currency: p.currency, priceEntryId: p.id,
        })),
      };
      const payload = {
        organizationId,
        organizationName: context.organizationName,
        countryCode: context.countryCode,
        currency: context.baseCurrency,
        reportingCurrency: context.reportingCurrency,
        fleetMissionId: mission?.id,
        fleetMissionTitle: mission?.title,
        fleetMissionUrl: mission ? `${mission.id}` : undefined,
        numberOfPeople, numberOfDays, procurementBuffer, breadCoverageDays,
        flourPerLoafKg, yeastProportion, personDaysPerToiletRoll,
        nutritionTargets: inputs.nutritionTargets,
        inputsOverridden,
        selectedRationIds,
        manualPriceOverrides,
        adjustedPersonDays: plan.adjustedPersonDays,
        lines,
        nutrition: plan.nutrition,
        totals: plan.totals,
        status: 'confirmed' as const,
        createdByUid: user.id,
        createdByName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
        createdByEmail: user.email,
        notes,
        snapshot,
      };
      const saved = await savePlan(payload as any);
      setSavedPlan(saved);
      showSnackbar(`Plan saved as ${saved.planNumber}`, 'success');
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setLoading(false);
    }
  };

  const openPrDialog = async () => {
    if (!savedPlan) { showSnackbar('Save the plan first.', 'warning'); return; }
    setPrDialogOpen(true);
    if (organizationId) {
      try {
        const [deps, cats, sites, exps] = await Promise.all([
          referenceDataAdminService.getItems('departments', organizationId),
          referenceDataAdminService.getItems('projectCategories', organizationId),
          referenceDataAdminService.getItems('sites', organizationId),
          referenceDataAdminService.getItems('expenseTypes', organizationId),
        ]);
        setPrDepartments(deps); setPrCategories(cats); setPrSites(sites); setPrExpenseTypes(exps);
      } catch (err) {
        console.warn('[provisioning] reference data load failed:', err);
      }
    }
  };

  const handleGeneratePR = async () => {
    if (!savedPlan || !user) return;
    if (!prExtras.department || !prExtras.projectCategory || !prExtras.site || !prExtras.expenseType || !prExtras.requiredDate) {
      showSnackbar('All PR classification fields are required.', 'warning');
      return;
    }
    setGenerating(true);
    try {
      const requestor = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        organization: organizationId,
      };
      const result = await createPRFromProvisioningPlan(
        savedPlan,
        { department: prExtras.department, projectCategory: prExtras.projectCategory, sites: [prExtras.site], expenseType: prExtras.expenseType, requiredDate: prExtras.requiredDate },
        requestor as any,
      );
      await updatePlanStatus(savedPlan.id, 'pr_generated', result.prId);
      setSavedPlan({ ...savedPlan, status: 'pr_generated', generatedPrId: result.prId });
      showSnackbar(`PR ${result.prNumber} created`, 'success');
      setPrDialogOpen(false);
      navigate(`/pr/${result.prId}`);
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setGenerating(false);
    }
  };

  const canNext = activeStep === 0 ? (!!organizationId && numberOfPeople > 0 && numberOfDays > 0)
    : activeStep === 1 ? selectedRationIds.length > 0
    : true;

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>Field Camp Provisioning</Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Plan a field camp shopping list from the org's ration catalog. Link a Fleet mission to prepopulate crew size and duration; override either if provisioning for a shorter window.
      </Typography>

      <Stepper activeStep={activeStep} sx={{ my: 3 }} data-tutorial="provisioning-stepper">
        {STEPS.map((label) => (
          <Step key={label}><StepLabel>{label}</StepLabel></Step>
        ))}
      </Stepper>

      {loading && <CircularProgress sx={{ my: 2 }} />}

      {activeStep === 0 && (
        <Stack spacing={2}>
          <FormControl fullWidth data-tutorial="provisioning-org">
            <InputLabel>Organization</InputLabel>
            <Select value={organizationId} label="Organization" onChange={(e) => setOrganizationId(e.target.value)}>
              {orgOptions.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl fullWidth data-tutorial="provisioning-mission">
            <InputLabel>Link Fleet mission (optional)</InputLabel>
            <Select value={missionId} label="Link Fleet mission (optional)" onChange={(e) => setMissionId(e.target.value)}>
              <MenuItem value="">— None —</MenuItem>
              {missions.map((m) => (
                <MenuItem key={m.id} value={m.id}>
                  {m.title || m.id} — {m.departure_date} → {m.return_date} (crew {m.crew_size})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {mission && (
            <Typography variant="body2" color="text.secondary">
              Linked: <strong>{mission.title}</strong> · {mission.departure_date} → {mission.return_date} · crew {mission.crew_size}
            </Typography>
          )}
          <Divider />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} data-tutorial="provisioning-people-days">
            <TextField fullWidth type="number" label="Number of people" value={numberOfPeople}
              onChange={(e) => { setNumberOfPeople(Number(e.target.value)); markOverride(); }}
              helperText={inputsOverridden ? 'Overridden from mission default' : 'From mission crew_size'} />
            <TextField fullWidth type="number" label="Number of days" value={numberOfDays}
              onChange={(e) => { setNumberOfDays(Number(e.target.value)); markOverride(); }}
              helperText={inputsOverridden ? 'Overridden from mission default' : 'From mission dates'} />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} data-tutorial="provisioning-buffer">
            <TextField fullWidth type="number" label="Procurement buffer (fraction)" value={procurementBuffer} onChange={(e) => setProcurementBuffer(Number(e.target.value))} helperText="0.05 = 5%" />
            <TextField fullWidth type="number" label="Bread coverage days" value={breadCoverageDays} onChange={(e) => setBreadCoverageDays(Number(e.target.value))} />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField fullWidth type="number" label="Flour per loaf (kg)" value={flourPerLoafKg} onChange={(e) => setFlourPerLoafKg(Number(e.target.value))} />
            <TextField fullWidth type="number" label="Yeast proportion" value={yeastProportion} onChange={(e) => setYeastProportion(Number(e.target.value))} />
            <TextField fullWidth type="number" label="Person-days per toilet roll" value={personDaysPerToiletRoll} onChange={(e) => setPersonDaysPerToiletRoll(Number(e.target.value))} />
          </Stack>
          <Typography variant="body2">
            Adjusted person-days: <strong>{(numberOfPeople * numberOfDays * (1 + procurementBuffer)).toFixed(2)}</strong>
          </Typography>
        </Stack>
      )}

      {activeStep === 1 && (
        <Stack spacing={2}>
          <Typography variant="h6">Ration catalog ({context?.rations.length || 0})</Typography>
          {context?.menu && (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2">Default menu: {context.menu.name}</Typography>
              <Typography variant="body2" color="text.secondary">{context.menu.cycleLength}-day cycle</Typography>
            </Paper>
          )}
          <TableContainer component={Paper} variant="outlined" data-tutorial="provisioning-ration-table">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox"></TableCell>
                  <TableCell>Item</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Class</TableCell>
                  <TableCell>Qty/pd</TableCell>
                  <TableCell>Unit</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(context?.rations || []).map((r) => (
                  <TableRow key={r.id} hover>
                    <TableCell padding="checkbox">
                      <Checkbox checked={selectedRationIds.includes(r.id)} onChange={() => toggleRation(r.id)} />
                    </TableCell>
                    <TableCell>{r.name}</TableCell>
                    <TableCell>{r.category}</TableCell>
                    <TableCell>{r.class}</TableCell>
                    <TableCell>{r.issueQtyPerPersonDay}</TableCell>
                    <TableCell>{r.issueUnit}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Stack>
      )}

      {activeStep === 2 && (
        <Stack spacing={2}>
          {!plan && <Typography>No items selected.</Typography>}
          {plan && (
            <>
              <Paper variant="outlined" sx={{ p: 2 }} data-tutorial="provisioning-nutrition">
                <Typography variant="subtitle1">Nutrition check</Typography>
                <Typography variant="body2">
                  Energy: {plan.nutrition.energyKcal} kcal/pd (target {plan.nutrition.targets.kcal}) — {plan.nutrition.energyMeets ? 'OK' : 'review'}
                </Typography>
                <Typography variant="body2">
                  Protein: {plan.nutrition.proteinG} g/pd (target {plan.nutrition.targets.proteinG}) — {plan.nutrition.proteinMeets ? 'OK' : 'review'}
                </Typography>
                <Typography variant="body2">
                  Fruit & veg: {plan.nutrition.fruitVegG} g/pd (target {plan.nutrition.targets.fruitVegG}) — {plan.nutrition.fruitVegMeets ? 'OK' : 'review'}
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }} color={plan.nutrition.status === 'MEETS PLANNING TARGETS' ? 'success.main' : 'warning.main'}>
                  {plan.nutrition.status}
                </Typography>
              </Paper>

              <TableContainer component={Paper} variant="outlined" data-tutorial="provisioning-shopping-list">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Item</TableCell>
                      <TableCell>Required</TableCell>
                      <TableCell>Pack instruction</TableCell>
                      <TableCell>Buy qty</TableCell>
                      <TableCell>Excess</TableCell>
                      <TableCell>Price</TableCell>
                      <TableCell>Cost</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {plan.lines.map((l: ProvisioningLine) => {
                      const key = `${l.rationItemId}|${l.packMode === 'bulk' ? 'large' : 'unit'}`;
                      const priceVal = l.packMode === 'bulk'
                        ? (l.tierPricesUsed?.large ?? 0)
                        : (manualPriceOverrides[`${l.rationItemId}|unit`] ?? (l.estCost && l.buyQty ? l.estCost / l.buyQty : 0));
                      return (
                        <TableRow key={l.rationItemId} hover>
                          <TableCell>{l.name}</TableCell>
                          <TableCell>{l.requiredQty} {l.issueUnit}</TableCell>
                          <TableCell>{l.packInstruction}</TableCell>
                          <TableCell>{l.buyQty}</TableCell>
                          <TableCell>{l.excessQty}</TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              type="number"
                              value={priceVal || ''}
                              onChange={(e) => {
                                const v = Number(e.target.value);
                                setManualPriceOverrides((prev) => ({ ...prev, [`${l.rationItemId}|${l.packMode === 'bulk' ? 'large' : 'unit'}`]: v }));
                              }}
                              sx={{ width: 90 }}
                              placeholder={l.priceSource === 'priceBook' ? 'book' : 'manual'}
                            />
                          </TableCell>
                          <TableCell>{l.estCost}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>

              <Typography variant="h6">
                Total: {plan.totals.totalFoodCost} {context?.baseCurrency} · {plan.totals.costPerAdjustedPersonDay}/person-day
              </Typography>

              <TextField label="Notes" multiline minRows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />

              <Stack direction="row" spacing={2}>
                <Button variant="contained" onClick={handleSave} disabled={loading} data-tutorial="provisioning-save">
                  {savedPlan ? 'Re-save plan' : 'Save plan'}
                </Button>
                <Button variant="outlined" onClick={openPrDialog} disabled={!savedPlan} data-tutorial="provisioning-generate-pr">
                  Generate PR
                </Button>
                {savedPlan && (
                  <Typography variant="body2" sx={{ alignSelf: 'center' }}>
                    Saved: <strong>{savedPlan.planNumber}</strong>{savedPlan.generatedPrId ? ` → PR ${savedPlan.generatedPrId}` : ''}
                  </Typography>
                )}
              </Stack>
            </>
          )}
        </Stack>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
        <Button disabled={activeStep === 0} onClick={() => setActiveStep((s) => s - 1)}>Back</Button>
        {activeStep < 2 ? (
          <Button variant="contained" disabled={!canNext} onClick={() => setActiveStep((s) => s + 1)}>Next</Button>
        ) : null}
      </Box>

      <Dialog open={prDialogOpen} onClose={() => setPrDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Generate PR from plan</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Department</InputLabel>
              <Select value={prExtras.department} label="Department" onChange={(e) => setPrExtras((p) => ({ ...p, department: e.target.value }))}>
                {prDepartments.map((d) => <MenuItem key={d.id} value={d.name}>{d.name}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Project category</InputLabel>
              <Select value={prExtras.projectCategory} label="Project category" onChange={(e) => setPrExtras((p) => ({ ...p, projectCategory: e.target.value }))}>
                {prCategories.map((c) => <MenuItem key={c.id} value={c.name}>{c.name}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Site</InputLabel>
              <Select value={prExtras.site} label="Site" onChange={(e) => setPrExtras((p) => ({ ...p, site: e.target.value }))}>
                {prSites.map((s) => <MenuItem key={s.id} value={s.name}>{s.name}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Expense type</InputLabel>
              <Select value={prExtras.expenseType} label="Expense type" onChange={(e) => setPrExtras((p) => ({ ...p, expenseType: e.target.value }))}>
                {prExpenseTypes.map((x) => <MenuItem key={x.id} value={x.name}>{x.name}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField type="date" label="Required date" InputLabelProps={{ shrink: true }} value={prExtras.requiredDate} onChange={(e) => setPrExtras((p) => ({ ...p, requiredDate: e.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPrDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleGeneratePR} disabled={generating}>
            {generating ? <CircularProgress size={20} /> : 'Create PR'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
