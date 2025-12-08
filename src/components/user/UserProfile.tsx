import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { doc, updateDoc } from 'firebase/firestore';
import { updateEmail, updatePassword } from 'firebase/auth';
import { auth, db } from '@/config/firebase';
import { RootState } from '@/store';
import { setUser } from '@/store/slices/authSlice';
import {
  Button,
  TextField,
  Typography,
  Box,
  Snackbar,
  Alert,
  Chip,
  Divider,
  Tooltip,
} from '@mui/material';
import { getPermissionInfo } from '@/config/permissions';

export function UserProfile() {
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);
  const permissionInfo = getPermissionInfo(user?.permissionLevel);
  
  const [isEditing, setIsEditing] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });
  
  const [formData, setFormData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    newPassword: '',
    confirmPassword: '',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (!user?.id || !auth.currentUser) return;

      const userRef = doc(db, 'users', user.id);
      const updates: Record<string, any> = {
        firstName: formData.firstName,
        lastName: formData.lastName,
      };

      // Update email if changed
      if (formData.email !== user.email) {
        await updateEmail(auth.currentUser, formData.email);
        updates.email = formData.email;
      }

      // Update password if provided
      if (formData.newPassword) {
        if (formData.newPassword !== formData.confirmPassword) {
          setSnackbar({
            open: true,
            message: 'Passwords do not match',
            severity: 'error',
          });
          return;
        }
        await updatePassword(auth.currentUser, formData.newPassword);
      }

      // Update Firestore document
      await updateDoc(userRef, updates);

      // Update Redux state
      dispatch(setUser({
        ...user,
        ...updates,
      }));

      setSnackbar({
        open: true,
        message: 'Profile updated successfully',
        severity: 'success',
      });
      
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      setSnackbar({
        open: true,
        message: 'Failed to update profile',
        severity: 'error',
      });
    }
  };

  const formatOrganization = (org: unknown): string => {
    if (!org) return '';
    if (typeof org === 'string') return org;
    if (typeof org === 'object' && org !== null) {
      const obj = org as { name?: string; code?: string; id?: string };
      return obj.name || obj.code || obj.id || '';
    }
    return String(org);
  };

  const primaryOrganization = formatOrganization(user?.organization) || 'Not set';
  const additionalOrganizations = Array.isArray(user?.additionalOrganizations)
    ? user!.additionalOrganizations!.map(formatOrganization).filter(Boolean)
    : [];

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Profile Management
      </Typography>
      <Box
        sx={{
          p: 2,
          mb: 3,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          backgroundColor: 'background.paper',
        }}
      >
        <Typography variant="subtitle1" gutterBottom>
          Access Level
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Chip
            color="primary"
            label={
              user?.permissionLevel
                ? `Level ${user.permissionLevel}: ${permissionInfo.name}`
                : 'Permission level unavailable'
            }
          />
          <Tooltip title="Permission levels determine which parts of the system you can use.">
            <Typography variant="body2" color="text.secondary">
              Read only
            </Typography>
          </Tooltip>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {permissionInfo.description}
        </Typography>

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle1" gutterBottom>
          Organizations
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Chip color="secondary" label={`Primary: ${primaryOrganization}`} />
          </Box>
          {additionalOrganizations.length > 0 ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              {additionalOrganizations.map((org, idx) => (
                <Chip key={`${org}-${idx}`} variant="outlined" label={`Additional: ${org}`} />
              ))}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No additional organizations assigned.
            </Typography>
          )}
        </Box>
      </Box>
      <Divider sx={{ mb: 3 }} />
      <form onSubmit={handleSubmit}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="First Name"
            name="firstName"
            value={formData.firstName}
            onChange={handleInputChange}
            disabled={!isEditing}
            fullWidth
          />
          
          <TextField
            label="Last Name"
            name="lastName"
            value={formData.lastName}
            onChange={handleInputChange}
            disabled={!isEditing}
            fullWidth
          />

          <TextField
            label="Email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleInputChange}
            disabled={!isEditing}
            fullWidth
          />

          {isEditing && (
            <>
              <TextField
                label="New Password (optional)"
                name="newPassword"
                type="password"
                value={formData.newPassword}
                onChange={handleInputChange}
                fullWidth
              />

              <TextField
                label="Confirm Password"
                name="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                fullWidth
              />
            </>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
            {isEditing ? (
              <>
                <Button
                  variant="outlined"
                  onClick={() => setIsEditing(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  type="submit"
                >
                  Save Changes
                </Button>
              </>
            ) : (
              <Button
                variant="contained"
                onClick={() => setIsEditing(true)}
              >
                Edit Profile
              </Button>
            )}
          </Box>
        </Box>
      </form>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
      >
        <Alert
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
