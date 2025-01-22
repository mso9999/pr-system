import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { CircularProgress, Box, Typography } from '@mui/material';
import { RootState } from '../../store';

interface AdminContext {
  isReadOnly: boolean;
}

export const AdminRoute = () => {
  const location = useLocation();
  const { user, loading, error } = useSelector((state: RootState) => state.auth);

  // Check if user has admin permissions (level 1-4)
  const hasAdminAccess = user?.permissionLevel && user.permissionLevel <= 4;
  // Level 2-4 users have read-only access
  const isReadOnly = user?.permissionLevel && user.permissionLevel >= 2;

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
