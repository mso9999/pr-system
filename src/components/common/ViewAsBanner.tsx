import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store';
import { clearViewAs } from '../../store/slices/authSlice';
import { VisibilityOff, Close } from '@mui/icons-material';
import { Box, IconButton, Typography } from '@mui/material';

const VIEW_AS_LABELS: Record<string, string> = {
  requester: 'Requester',
  procurement: 'Procurement Officer',
  approver: 'Senior Approver',
  finance_admin: 'Finance Admin',
  finance_approver: 'Finance Approver',
  site_manager: 'Site Manager',
};

export function ViewAsBanner() {
  const dispatch = useDispatch();
  const { viewAs, isViewingAs } = useSelector((state: RootState) => state.auth);

  if (!isViewingAs || !viewAs) return null;

  const label = VIEW_AS_LABELS[viewAs] || viewAs;

  const handleExit = () => {
    localStorage.removeItem('pr_view_as');
    dispatch(clearViewAs());
    window.location.reload();
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 2,
        py: 1,
        bgcolor: 'warning.light',
        borderBottom: '1px solid',
        borderColor: 'warning.main',
      }}
    >
      <VisibilityOff fontSize="small" sx={{ color: 'warning.contrastText' }} />
      <Typography variant="body2" sx={{ color: 'warning.contrastText', fontWeight: 500, flex: 1 }}>
        Viewing as <strong>{label}</strong> — Read-only preview. All write actions are blocked.
      </Typography>
      <IconButton size="small" onClick={handleExit} sx={{ color: 'warning.contrastText' }}>
        <Close fontSize="small" />
      </IconButton>
    </Box>
  );
}
