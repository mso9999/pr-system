import { Alert, AlertTitle, Box, Chip, Paper, Stack, Typography } from '@mui/material';

interface Props {
  assignedRoles: string[];
  requiredRoles: string[];
  countryCode?: string;
  action?: string;
}

export function PrivilegeDenied({ assignedRoles, requiredRoles, countryCode, action }: Props) {
  const country = ({ BJ: 'Benin', BN: 'Benin', LS: 'Lesotho', ZM: 'Zambia' } as Record<string, string>)[countryCode || '']
    || 'your country';
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '75vh', p: 3 }}>
      <Paper variant="outlined" sx={{ maxWidth: 760, width: '100%', overflow: 'hidden' }}>
        <Alert severity="error" sx={{ borderRadius: 0 }}>
          <AlertTitle>This action is not included in your current access</AlertTitle>
          {action || 'The PR System compared all of your effective assignments with the role required here.'}
        </Alert>
        <Stack spacing={3} sx={{ p: 3 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Box sx={{ flex: 1, bgcolor: 'grey.50', p: 2, borderRadius: 1 }}>
              <Typography variant="subtitle2">Your effective PR role(s)</Typography>
              <Stack direction="row" gap={1} flexWrap="wrap" mt={1}>{(assignedRoles.length ? assignedRoles : ['REQ']).map((role) => <Chip key={role} label={role} size="small" />)}</Stack>
            </Box>
            <Box sx={{ flex: 1, bgcolor: 'warning.50', p: 2, borderRadius: 1 }}>
              <Typography variant="subtitle2">Role needed for this action</Typography>
              <Stack direction="row" gap={1} flexWrap="wrap" mt={1}>{requiredRoles.map((role) => <Chip key={role} label={role} size="small" color="warning" />)}</Stack>
            </Box>
          </Stack>
          <Box>
            <Typography variant="subtitle2" gutterBottom>Who is responsible for changing access</Typography>
            <ul>
              <li>The {country} HR team manages primary/secondary department assignments, Lead status, and scope.</li>
              <li>A Nexus/IS&amp;T User Administrator manages explicit PR access or denial in Nexus.</li>
              <li>A PR Superadmin manages protected PR roles and administrator actions.</li>
            </ul>
          </Box>
          <Alert severity="info">Ask the appropriate owner to correct the assignment, then sign out and back in to refresh the signed privilege claim.</Alert>
        </Stack>
      </Paper>
    </Box>
  );
}
