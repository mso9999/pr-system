import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { CircularProgress, Box, Typography } from '@mui/material';
import { RootState } from '../../store';

interface PrivateRouteProps {
  requiredRoles?: string[];
}

export const PrivateRoute = ({ requiredRoles }: PrivateRouteProps) => {
  const location = useLocation();
  const { user, loading, error } = useSelector((state: RootState) => {
    console.log('PrivateRoute: Checking auth state:', state.auth);
    return state.auth;
  });

  console.log('PrivateRoute: Current state:', { user, loading, error, path: location.pathname });

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
    const search = new URLSearchParams(window.location.search);
    // NexusSSOHandler is still consuming ?sso_token= — don't redirect away mid-sign-in.
    if (search.get('sso_token') && search.get('from') === 'nexus') {
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
            Signing you in...
          </Typography>
        </Box>
      );
    }
    // Emergency fallback: local login form stays reachable via ?fallback=1
    // (e.g. Nexus outage). Normal path is Nexus-centralized auth.
    if (search.get('fallback') === '1') {
      console.log('PrivateRoute: No user, fallback=1 -> local login');
      return <Navigate to="/login" state={{ from: location }} replace />;
    }
    console.log('PrivateRoute: No user, redirecting to Nexus SSO');
    window.location.replace(
      'https://nexus.1pwrafrica.com/sso/authorize?tool=pr&redirect_uri=' +
        encodeURIComponent(window.location.href)
    );
    return null;
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
          bgcolor: 'background.default'
        }}
      >
        <Typography variant="h6" color="error" gutterBottom>
          {error}
        </Typography>
        <Typography color="textSecondary" sx={{ mb: 2 }}>
          Please try logging in again
        </Typography>
        <Navigate to="/login" state={{ from: location }} replace />
      </Box>
    );
  }

  if (requiredRoles && !requiredRoles.some(role => user.roles?.includes(role))) {
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
        <Typography variant="h6" color="error" gutterBottom>
          Access Denied
        </Typography>
        <Typography color="textSecondary">
          You don't have the required permissions to access this page
        </Typography>
      </Box>
    );
  }

  return <Outlet />;
};
