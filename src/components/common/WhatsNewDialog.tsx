import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Link,
  Stack,
  Typography,
} from '@mui/material';
import { Close as CloseIcon, NewReleases as NewReleasesIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { WhatsNewItem } from '../../types/whatsNew';

interface WhatsNewDialogProps {
  open: boolean;
  items: WhatsNewItem[];
  onClose: () => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function WhatsNewDialog({ open, items, onClose }: WhatsNewDialogProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleLink = (route?: string) => {
    if (!route) return;
    onClose();
    navigate(route);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 6 }}>
        <NewReleasesIcon color="primary" />
        <Typography variant="h6" component="span" sx={{ fontWeight: 700 }}>
          {t('whatsNew.title', "What's new")}
        </Typography>
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{ position: 'absolute', right: 8, top: 8, color: 'grey.500' }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          {items.map((it, idx) => (
            <div key={it.id}>
              {idx > 0 && <Divider sx={{ mb: 2.5 }} />}
              <Stack spacing={0.75}>
                <Typography variant="caption" color="text.secondary">
                  {formatDate(it.date)}
                </Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {it.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
                  {it.body}
                </Typography>
                {it.linkRoute && (
                  <Link
                    component="button"
                    type="button"
                    sx={{ alignSelf: 'flex-start', mt: 0.5 }}
                    onClick={() => handleLink(it.linkRoute)}
                  >
                    {it.linkLabel || t('whatsNew.tryIt', 'Try it')}
                  </Link>
                )}
              </Stack>
            </div>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={onClose}>
          {t('whatsNew.gotIt', 'Got it')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
