import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { CircularProgress, Box, Typography } from '@mui/material';
import { RootState } from '../../store';
import { PERMISSION_LEVELS } from '@/config/permissions';

interface AdminContext {
  isReadOnly: boolean;
}

export const AdminRoute = () => {
  const location = useLocation();
  const { user, loading, error } = useSelector((state: RootState) => state.auth);
  const permissionLevel = user?.permissionLevel ?? 999;

  // Level 1-4 have full admin access, level 8 (User Admin) has limited admin UI access
  const hasAdminAccess = permissionLevel <= 4 || permissionLevel === PERMISSION_LEVELS.USER_ADMIN;
  // Level 2-4 are read-only; level 8 should have edit rights in user management
  const isReadOnly =
    permissionLevel >= 2 &&
    permissionLevel !== PERMISSION_LEVELS.USER_ADMIN;

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
    return <Navigate to="/dashboard" replace />;
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
