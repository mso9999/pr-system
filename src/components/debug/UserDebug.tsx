import React from 'react';
import { useSelector } from 'react-redux';
import { Box, Typography, Paper } from '@mui/material';
import { RootState } from '@/store';

export function UserDebug() {
  const currentUser = useSelector((state: RootState) => state.auth.user);

  // console.log('UserDebug: Current user from Redux:', currentUser);

  if (!currentUser) {
    return (
      <Paper sx={{ p: 2, mb: 2, bgcolor: 'warning.light' }}>
        <Typography variant="h6">Debug: No User Logged In</Typography>
      </Paper>
    );
  }

  const isProcurement = currentUser.permissionLevel === 2 || currentUser.permissionLevel === 3;

  return (
    <Paper sx={{ p: 2, mb: 2, bgcolor: 'info.light' }}>
      <Typography variant="h6" gutterBottom>Debug: User Information</Typography>
      <Typography><strong>Email:</strong> {currentUser.email}</Typography>
      <Typography><strong>Role:</strong> {currentUser.role}</Typography>
      <Typography><strong>Permission Level:</strong> {currentUser.permissionLevel}</Typography>
      <Typography><strong>Organization:</strong> {currentUser.organization}</Typography>
      <Typography><strong>Is Procurement:</strong> {isProcurement ? 'YES' : 'NO'}</Typography>
      <Typography><strong>Can Process PR:</strong> {currentUser.permissions?.canProcessPR ? 'YES' : 'NO'}</Typography>
    </Paper>
  );
}
