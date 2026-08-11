import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { CircularProgress, Box, Typography } from '@mui/material';
import { RootState } from '../../store';
import { canEnterAdminArea, hasPrAction, assignedPrRoleLabels } from '@/utils/prPrivilege';
import { PrivilegeDenied } from './PrivilegeDenied';

interface AdminContext {
  isReadOnly: boolean;
}

export const AdminRoute = () => {
  const location = useLocation();
  const { user, loading, error } = useSelector((state: RootState) => state.auth);

  // Claim-based (2026-08 migration): admin-area entry is decided by the
  // signed Nexus action set, not the numeric permissionLevel.
  const hasAdminAccess = canEnterAdminArea(user);
  // Full admins edit everything; scoped roles (approver/proc/finance/IT)
  // are read-only except where a panel grants a type-specific action.
  const isReadOnly = !hasPrAction(user, 'administer_pr');

  if (loading) {
    return (
      <Box 
        sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center', 
          height: '100vh',
          bgcolor: 'background.default'
        }}
      >
        <CircularProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading...
        </Typography>
      </Box>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!hasAdminAccess) {
    // Explain the denial instead of silently bouncing to the dashboard:
    // assigned vs required roles and who owns role CRUD.
    return (
      <PrivilegeDenied
        action="You tried to open the PR admin area."
        assignedRoles={assignedPrRoleLabels(user)}
        requiredRoles={['ADMIN (administer_pr)', 'USER_ADMIN (manage_pr_users)', 'PROC (process_procurement_queue)', 'APPROVER/FINANCE (approve actions)', 'IT (manage_pr_sites)']}
      />
    );
  }

  if (error) {
    return (
      <Box 
        sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center', 
          height: '100vh',
          bgcolor: 'background.default',
          p: 3
        }}
      >
        <Typography variant="h6" color="error" align="center">
          {error}
        </Typography>
      </Box>
    );
  }

  // Always provide a context value
  const contextValue: AdminContext = {
    isReadOnly: isReadOnly
  };

  return <Outlet context={contextValue} />;
};
