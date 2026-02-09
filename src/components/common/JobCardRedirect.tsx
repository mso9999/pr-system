import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Box, CircularProgress, Typography } from '@mui/material';
import { RootState } from '../../store';

/**
 * JobCardRedirect component
 *
 * Protected route that redirects authenticated users to the Job Card system
 * with their credentials passed via URL parameters.
 *
 * Used as the target for email notification links so that:
 * 1. Unauthenticated users are routed to login first (via PrivateRoute)
 * 2. After login, they land here and are redirected to the Job Card system
 */
export const JobCardRedirect = () => {
  const user = useSelector((state: RootState) => state.auth.user);

  useEffect(() => {
    if (user) {
      const params = new URLSearchParams({
        uid: user.id,
        email: user.email,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email
      });
      const jobCardUrl = `https://prod.1pwrafrica.com?${params.toString()}`;
      // Replace current page so back button doesn't loop
      window.location.replace(jobCardUrl);
    }
  }, [user]);

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
        Redirecting to Job Cards...
      </Typography>
    </Box>
  );
};
