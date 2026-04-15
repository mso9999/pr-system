import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItemButton,
  ListItemText,
  Typography,
  Divider,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useTutorial } from '@/contexts/TutorialContext';
import { TOUR_LIST, type TourId } from '@/tutorial/tourConfig';

export function TutorialPickerDialog() {
  const { t } = useTranslation();
  const { pickerOpen, setPickerOpen, startTour } = useTutorial();

  return (
    <Dialog open={pickerOpen} onClose={() => setPickerOpen(false)} maxWidth="sm" fullWidth>
      <DialogTitle>{t('tutorial.pickerTitle')}</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('tutorial.pickerIntro')}
        </Typography>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          {t('tutorial.sectionOrientation')}
        </Typography>
        <List dense disablePadding>
          {TOUR_LIST.filter((m) => m.id === 'orientation').map((meta) => (
            <ListItemButton
              key={meta.id}
              onClick={() => startTour(meta.id as TourId)}
              sx={{ borderRadius: 1, mb: 0.5 }}
            >
              <ListItemText primary={t(meta.titleKey)} secondary={t(meta.descriptionKey)} />
            </ListItemButton>
          ))}
        </List>
        <Divider sx={{ my: 2 }} />
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          {t('tutorial.sectionDashboard')}
        </Typography>
        <List dense disablePadding>
          {TOUR_LIST.filter((m) => m.id === 'dashboard').map((meta) => (
            <ListItemButton
              key={meta.id}
              onClick={() => startTour(meta.id as TourId)}
              sx={{ borderRadius: 1, mb: 0.5 }}
            >
              <ListItemText primary={t(meta.titleKey)} secondary={t(meta.descriptionKey)} />
            </ListItemButton>
          ))}
        </List>
        <Divider sx={{ my: 2 }} />
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          {t('tutorial.sectionWorkflows')}
        </Typography>
        <List dense disablePadding>
          {TOUR_LIST.filter((m) =>
            ['workflowRequestor', 'workflowApprover', 'workflowProcurement', 'newPrForm'].includes(m.id)
          ).map((meta) => (
            <ListItemButton
              key={meta.id}
              onClick={() => startTour(meta.id as TourId)}
              sx={{ borderRadius: 1, mb: 0.5 }}
            >
              <ListItemText primary={t(meta.titleKey)} secondary={t(meta.descriptionKey)} />
            </ListItemButton>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setPickerOpen(false)}>{t('common.cancel')}</Button>
      </DialogActions>
    </Dialog>
  );
}
