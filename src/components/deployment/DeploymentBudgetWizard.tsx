import React, { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Button,
  FormControl,
  InputLabel,
  Link,
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
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { RootState } from '../../store';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { createPR } from '../../services/pr';
import { PRStatus, type LineItem, type UserReference } from '../../types/pr';
import {
  budgetProfile,
  cashLineAmount,
  computeDeploymentBudget,
  daysBetween,
  defaultCashLines,
  type CashLine,
  type FoodMode,
  type FuelLeg,
  type PartyMember,
} from '../../utils/deploymentBudget';

const STEPS = ['Header', 'Party', 'Food', 'Fuel', 'Other cash', 'Total'];

function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

export function DeploymentBudgetWizard() {
  const { showSnackbar } = useSnackbar();
  const user = useSelector((state: RootState) => state.auth.user);
  const orgOptions = useMemo(() => {
    const ids = new Set<string>();
    if (user?.organization) ids.add(user.organization);
    (user?.additionalOrganizations || []).forEach((id) => ids.add(id));
    return Array.from(ids);
  }, [user]);

  const [step, setStep] = useState(0);
  const [organizationId, setOrganizationId] = useState(orgOptions[0] || '1pwr_lesotho');
  const [sites, setSites] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [purpose, setPurpose] = useState('');
  const [thrust, setThrust] = useState('');
  const [preparer, setPreparer] = useState(user?.name || user?.email || '');
  const [party, setParty] = useState<PartyMember[]>([
    { id: newId('p'), name: '', departureDate: '', departureTime: '', returnDate: '', returnTime: '', days: 0 },
  ]);
  const [foodMode, setFoodMode] = useState<FoodMode>('lump');
  const [foodAmount, setFoodAmount] = useState(0);
  const [fuelLegs, setFuelLegs] = useState<FuelLeg[]>([]);
  const [fleetFuel, setFleetFuel] = useState('');
  const [lines, setLines] = useState<CashLine[]>(defaultCashLines);
  const [filing, setFiling] = useState(false);
  const [envelopeNote, setEnvelopeNote] = useState('');

  const profile = budgetProfile(organizationId);
  const fleetFuelAmount = fleetFuel.trim() === '' ? null : Number(fleetFuel);
  const budget = computeDeploymentBudget(profile, {
    foodMode,
    foodAmount,
    fuelLegs,
    fleetFuelAmount: fleetFuelAmount != null && !Number.isNaN(fleetFuelAmount) ? fleetFuelAmount : null,
    lines,
  });

  const partyDays = party.reduce((sum, member) => sum + (member.days || 0), 0);

  function updateMember(id: string, patch: Partial<PartyMember>) {
    setParty((rows) => rows.map((row) => {
      if (row.id !== id) return row;
      const next = { ...row, ...patch };
      if ('departureDate' in patch || 'returnDate' in patch) {
        const counted = daysBetween(next.departureDate, next.returnDate);
        if (counted > 0) next.days = counted;
      }
      return next;
    }));
  }

  async function file(asEnvelope: boolean) {
    if (!user) {
      showSnackbar('Sign in before filing a budget.', 'error');
      return;
    }
    const priced = budget.lines.filter((line) => line.amount > 0);
    if (priced.length === 0) {
      showSnackbar('Enter at least one amount.', 'warning');
      return;
    }
    setFiling(true);
    try {
      const requestor: UserReference = {
        id: user.id,
        email: user.email,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        organization: organizationId,
        department: user.department,
      };
      const lineItems: LineItem[] = priced.map((line, index) => ({
        id: `db-${line.id}-${index}`,
        description: line.categoryCode ? `${line.categoryCode}: ${line.label}` : line.label,
        quantity: 1,
        uom: 'lot',
        estimatedUnitPrice: line.amount,
        estimatedTotal: line.amount,
        attachments: [],
        notes: line.id === 'lodging'
          ? 'Accommodation, recurring for the stay'
          : line.id === 'materials'
            ? 'Includes PPE, blankets, and tools on an annual replacement cycle'
            : undefined,
      }));
      const description = [
        asEnvelope ? 'Approved deployment envelope' : 'Deployment budget',
        sites && `Sites: ${sites}`,
        purpose && `Purpose: ${purpose}`,
        thrust && `Thrust: ${thrust}`,
        preparer && `Preparer: ${preparer}`,
        startDate && `Dates: ${startDate} to ${endDate || startDate}`,
        `Party: ${party.filter((m) => m.name).map((m) => `${m.name} (${m.days}d)`).join(', ') || 'not named'}`,
        `Food: ${foodMode === 'provisioning' ? 'provisioning wizard' : 'cash lump'} ${profile.currency} ${foodAmount}`,
        `Total: ${profile.currency} ${budget.total.toFixed(2)}`,
      ].filter(Boolean).join('\n');
      const result = await createPR({
        organization: organizationId,
        organizationId,
        department: user.department || thrust || 'Operations',
        projectCategory: '4:Minigrids',
        description,
        sites: sites.split(',').map((s) => s.trim()).filter(Boolean),
        expenseType: 'deployment',
        estimatedAmount: budget.total,
        currency: profile.currency,
        requiredDate: startDate || new Date().toISOString().slice(0, 10),
        requestorId: user.id,
        requestorEmail: user.email,
        requestor,
        lineItems,
        lineItemsWithSKU: [],
        status: PRStatus.SUBMITTED,
        objectType: 'PR',
      } as unknown as Parameters<typeof createPR>[0]);
      const note = asEnvelope
        ? `Envelope filed as ${result.prNumber}. It is a submitted PR because that is how this app stores a budget.`
        : `Purchase request ${result.prNumber} raised for the priced lines.`;
      setEnvelopeNote(note);
      showSnackbar(note, 'success');
    } catch (error) {
      showSnackbar(error instanceof Error ? error.message : 'Could not file the budget.', 'error');
    } finally {
      setFiling(false);
    }
  }

  return (
    <Box sx={{ p: 3, maxWidth: 980 }}>
      <Typography variant="h5" gutterBottom>Deployment budget</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Cash around a deployment. Food can come from the field-camp provisioning wizard. Lodging repeats every stay. PPE, blankets, and tools wear out and are replaced about once a year.
      </Typography>
      <Stepper activeStep={step} sx={{ mb: 3 }}>
        {STEPS.map((label) => (
          <Step key={label}><StepLabel>{label}</StepLabel></Step>
        ))}
      </Stepper>

      {step === 0 && (
        <Stack spacing={2}>
          <FormControl>
            <InputLabel>Organisation</InputLabel>
            <Select label="Organisation" value={organizationId} onChange={(e) => setOrganizationId(e.target.value)}>
              {(orgOptions.length ? orgOptions : ['1pwr_lesotho', '1pwr_benin']).map((id) => (
                <MenuItem key={id} value={id}>{id}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField label="Site or sites" value={sites} onChange={(e) => setSites(e.target.value)} helperText="Comma-separated" />
          <Stack direction="row" spacing={2}>
            <TextField type="date" label="Start" InputLabelProps={{ shrink: true }} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <TextField type="date" label="End" InputLabelProps={{ shrink: true }} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </Stack>
          <TextField label="Purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
          <TextField label="Thrust or team" value={thrust} onChange={(e) => setThrust(e.target.value)} />
          <TextField label="Preparer" value={preparer} onChange={(e) => setPreparer(e.target.value)} />
        </Stack>
      )}

      {step === 1 && (
        <Stack spacing={2}>
          <Typography variant="body2">One row per person. Days fill from the departure and return dates. This is the F027 deployment list.</Typography>
          {party.map((member) => (
            <Stack key={member.id} direction="row" spacing={1} alignItems="center">
              <TextField label="Name" value={member.name} onChange={(e) => updateMember(member.id, { name: e.target.value })} />
              <TextField type="date" label="Depart" InputLabelProps={{ shrink: true }} value={member.departureDate} onChange={(e) => updateMember(member.id, { departureDate: e.target.value })} />
              <TextField type="time" label="Time" InputLabelProps={{ shrink: true }} value={member.departureTime} onChange={(e) => updateMember(member.id, { departureTime: e.target.value })} />
              <TextField type="date" label="Return" InputLabelProps={{ shrink: true }} value={member.returnDate} onChange={(e) => updateMember(member.id, { returnDate: e.target.value })} />
              <TextField type="time" label="Time" InputLabelProps={{ shrink: true }} value={member.returnTime} onChange={(e) => updateMember(member.id, { returnTime: e.target.value })} />
              <TextField type="number" label="Days" value={member.days} onChange={(e) => updateMember(member.id, { days: Number(e.target.value) })} sx={{ width: 90 }} />
            </Stack>
          ))}
          <Button onClick={() => setParty((rows) => [...rows, { id: newId('p'), name: '', departureDate: startDate, departureTime: '', returnDate: endDate, returnTime: '', days: daysBetween(startDate, endDate) }])}>
            Add person
          </Button>
          <Typography variant="body2">Party days: {partyDays}</Typography>
        </Stack>
      )}

      {step === 2 && (
        <Stack spacing={2}>
          <FormControl>
            <InputLabel>Food</InputLabel>
            <Select label="Food" value={foodMode} onChange={(e) => setFoodMode(e.target.value as FoodMode)}>
              <MenuItem value="provisioning">From the provisioning wizard</MenuItem>
              <MenuItem value="lump">Cash lump, team shops</MenuItem>
            </Select>
          </FormControl>
          {foodMode === 'provisioning' && (
            <Typography variant="body2">
              Build the ration in <Link component={RouterLink} to="/provisioning">Field Camp Provisioning</Link>, then enter that total here. The ration calculator is unchanged.
            </Typography>
          )}
          <TextField
            type="number"
            label={`${profile.labels.food} (${profile.currency})`}
            value={foodAmount}
            onChange={(e) => setFoodAmount(Number(e.target.value))}
          />
        </Stack>
      )}

      {step === 3 && (
        <Stack spacing={2}>
          <Typography variant="body2">
            Distance is typed. Default safety factor for this organisation is {profile.defaultSafetyFactor}. If Fleet Hub has already priced this mission, enter that figure and it replaces the legs.
          </Typography>
          <TextField
            label={`Fleet Hub fuel (${profile.currency}), optional`}
            value={fleetFuel}
            onChange={(e) => setFleetFuel(e.target.value)}
          />
          {fuelLegs.map((leg) => (
            <Stack key={leg.id} direction="row" spacing={1}>
              <TextField label="Leg" value={leg.label} onChange={(e) => setFuelLegs((rows) => rows.map((r) => r.id === leg.id ? { ...r, label: e.target.value } : r))} />
              <TextField type="number" label="km" value={leg.kilometres} onChange={(e) => setFuelLegs((rows) => rows.map((r) => r.id === leg.id ? { ...r, kilometres: Number(e.target.value) } : r))} sx={{ width: 100 }} />
              <TextField type="number" label={`${profile.currency}/L`} value={leg.pricePerLitre} onChange={(e) => setFuelLegs((rows) => rows.map((r) => r.id === leg.id ? { ...r, pricePerLitre: Number(e.target.value) } : r))} sx={{ width: 110 }} />
              <TextField type="number" label="km/L" value={leg.kmPerLitre} onChange={(e) => setFuelLegs((rows) => rows.map((r) => r.id === leg.id ? { ...r, kmPerLitre: Number(e.target.value) } : r))} sx={{ width: 90 }} />
              <TextField type="number" label="Factor" value={leg.safetyFactor} onChange={(e) => setFuelLegs((rows) => rows.map((r) => r.id === leg.id ? { ...r, safetyFactor: Number(e.target.value) } : r))} sx={{ width: 90 }} />
            </Stack>
          ))}
          <Button onClick={() => setFuelLegs((rows) => [...rows, { id: newId('f'), label: '', kilometres: 0, pricePerLitre: 0, kmPerLitre: 10, safetyFactor: profile.defaultSafetyFactor }])}>
            Add fuel leg
          </Button>
        </Stack>
      )}

      {step === 4 && (
        <Stack spacing={2}>
          <Typography variant="body2">
            Lodging is the accommodation for this stay and repeats on the next one. Materials covers PPE, blankets, and tools, which wear out and are replaced about once a year. Casuals are a day rate on the wages line.
          </Typography>
          {lines.map((line) => (
            <Stack key={line.id} direction="row" spacing={1} alignItems="center">
              <Typography sx={{ width: 180 }}>
                {profile.labels[line.kind]}
                {profile.showCategoryCodes ? ` (${line.categoryCode})` : ''}
              </Typography>
              <TextField type="number" label="Qty" value={line.quantity} onChange={(e) => setLines((rows) => rows.map((r) => r.id === line.id ? { ...r, quantity: Number(e.target.value) } : r))} sx={{ width: 120 }} />
              <TextField type="number" label="Unit price" value={line.unitPrice} onChange={(e) => setLines((rows) => rows.map((r) => r.id === line.id ? { ...r, unitPrice: Number(e.target.value) } : r))} sx={{ width: 140 }} />
              <Typography sx={{ width: 120 }}>{profile.currency} {cashLineAmount(line).toFixed(2)}</Typography>
            </Stack>
          ))}
          <Button onClick={() => setLines((rows) => rows.map((r) => r.kind === 'perDiem' || r.kind === 'wages' ? { ...r, quantity: partyDays } : r))}>
            Use party days for per diem and casuals
          </Button>
        </Stack>
      )}

      {step === 5 && (
        <Stack spacing={2}>
          <Paper variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Line</TableCell>
                  {profile.showCategoryCodes && <TableCell>Code</TableCell>}
                  <TableCell align="right">{profile.currency}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {budget.lines.filter((line) => line.amount > 0).map((line) => (
                  <TableRow key={line.id}>
                    <TableCell>{line.label}</TableCell>
                    {profile.showCategoryCodes && <TableCell>{line.categoryCode}</TableCell>}
                    <TableCell align="right">{line.amount.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell><strong>Total</strong></TableCell>
                  {profile.showCategoryCodes && <TableCell />}
                  <TableCell align="right"><strong>{budget.total.toFixed(2)}</strong></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Paper>
          <Stack direction="row" spacing={1}>
            <Button variant="contained" disabled={filing} onClick={() => file(false)}>Raise purchase requests</Button>
            <Button variant="outlined" disabled={filing} onClick={() => file(true)}>Mark as the approved envelope</Button>
          </Stack>
          {envelopeNote && <Typography variant="body2">{envelopeNote}</Typography>}
        </Stack>
      )}

      <Stack direction="row" spacing={1} sx={{ mt: 3 }}>
        <Button disabled={step === 0} onClick={() => setStep((n) => n - 1)}>Back</Button>
        <Button disabled={step === STEPS.length - 1} variant="contained" onClick={() => setStep((n) => n + 1)}>Next</Button>
      </Stack>
    </Box>
  );
}
