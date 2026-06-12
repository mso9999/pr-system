import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { PRStatus } from '@/types/pr';

interface TutorialSandboxPanelsProps {
  showApproverDemo: boolean;
  showProcurementDemo: boolean;
  showApprovedDemo: boolean;
  showOrderedDemo: boolean;
}

function DemoPanel({
  title,
  children,
  'data-tutorial': dataTutorial,
}: {
  title: string;
  children: React.ReactNode;
  'data-tutorial': string;
}) {
  return (
    <Paper
      variant="outlined"
      sx={{ mb: 3, p: 2, borderStyle: 'dashed', bgcolor: 'action.hover' }}
      data-tutorial={dataTutorial}
    >
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
        {title}
      </Typography>
      {children}
    </Paper>
  );
}

export function TutorialSandboxPanels({
  showApproverDemo,
  showProcurementDemo,
  showApprovedDemo,
  showOrderedDemo,
}: TutorialSandboxPanelsProps) {
  const { t } = useTranslation();

  if (!showApproverDemo && !showProcurementDemo && !showApprovedDemo && !showOrderedDemo) {
    return null;
  }

  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t('tutorial.sandboxDemoNote')}
      </Typography>

      {showProcurementDemo && (
        <DemoPanel title={t('tutorial.sandboxProcurementLabel')} data-tutorial="pr-procurement-actions">
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button variant="contained" disabled>
              {t('tutorial.sandboxDemoButton')}
            </Button>
            <Button variant="outlined" disabled>
              {t('tutorial.sandboxDemoButton')}
            </Button>
          </Stack>
        </DemoPanel>
      )}

      {showApproverDemo && (
        <DemoPanel title={t('tutorial.sandboxApproverLabel')} data-tutorial="pr-approver-actions">
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button variant="contained" color="success" disabled>
              Approve
            </Button>
            <Button variant="outlined" color="error" disabled>
              Reject
            </Button>
            <Button variant="outlined" disabled>
              Request Revision
            </Button>
          </Stack>
        </DemoPanel>
      )}

      {showApprovedDemo && (
        <DemoPanel title={t('tutorial.sandboxApprovedLabel')} data-tutorial="pr-approved-actions">
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button variant="contained" disabled>
              {PRStatus.ORDERED}
            </Button>
            <Button variant="outlined" disabled>
              {t('tutorial.sandboxDemoButton')}
            </Button>
          </Stack>
        </DemoPanel>
      )}

      {showOrderedDemo && (
        <DemoPanel title={t('tutorial.sandboxOrderedLabel')} data-tutorial="pr-ordered-actions">
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button variant="contained" disabled>
              {t('tutorial.sandboxDemoButton')}
            </Button>
          </Stack>
        </DemoPanel>
      )}
    </Box>
  );
}
