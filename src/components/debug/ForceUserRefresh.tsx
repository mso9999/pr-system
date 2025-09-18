import React from 'react';
import { useDispatch } from 'react-redux';
import { Button, Box, Typography, Paper } from '@mui/material';
import { signOut } from '@/services/auth';
import { clearUser } from '@/store/slices/authSlice';

export function ForceUserRefresh() {
  const dispatch = useDispatch();

  const handleForceRefresh = async () => {
    try {
      console.log('Forcing user refresh...');
      
      // Clear Redux auth state
      dispatch(clearUser());
      
      // Sign out from Firebase
      await signOut();
      
      // Force page reload to clear all caches
      window.location.reload();
      
    } catch (error) {
      console.error('Error forcing refresh:', error);
    }
  };

  return (
    <Paper sx={{ p: 2, mb: 2, bgcolor: 'error.light' }}>
      <Typography variant="h6" gutterBottom>Admin: Force User Refresh</Typography>
      <Typography variant="body2" sx={{ mb: 2 }}>
        Use this if permission changes aren't reflecting. This will log out the user and clear all caches.
      </Typography>
      <Button 
        variant="contained" 
        color="error" 
        onClick={handleForceRefresh}
      >
        Force Logout & Refresh
      </Button>
    </Paper>
  );
}

