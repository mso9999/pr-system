import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { doc, updateDoc } from 'firebase/firestore';
import { updateEmail, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
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
  IconButton,
  InputAdornment,
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { getPermissionInfo } from '@/config/permissions';

export function UserProfile() {
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);
  const permissionInfo = getPermissionInfo(user?.permissionLevel);
  
  const [isEditing, setIsEditing] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
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
    currentPassword: '',
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

        if (formData.newPassword.length < 6) {
          setSnackbar({
            open: true,
            message: 'Password must be at least 6 characters long',
            severity: 'error',
          });
          return;
        }

        // Re-authenticate user before changing password (Firebase requirement)
        if (!formData.currentPassword) {
          setSnackbar({
            open: true,
            message: 'Please enter your current password to change your password',
            severity: 'error',
          });
          return;
        }

        if (!auth.currentUser?.email) {
          setSnackbar({
            open: true,
            message: 'Unable to verify your account. Please sign out and sign back in.',
            severity: 'error',
          });
          return;
        }

        try {
          // Re-authenticate with current password
          const credential = EmailAuthProvider.credential(
            auth.currentUser.email,
            formData.currentPassword
          );
          await reauthenticateWithCredential(auth.currentUser, credential);
        } catch (reauthError: any) {
          console.error('Re-authentication error:', reauthError);
          if (reauthError.code === 'auth/wrong-password' || reauthError.code === 'auth/invalid-credential') {
            setSnackbar({
              open: true,
              message: 'Current password is incorrect',
              severity: 'error',
            });
          } else {
            setSnackbar({
              open: true,
              message: `Authentication failed: ${reauthError.message || 'Please try again'}`,
              severity: 'error',
            });
          }
          return;
        }

        // Update password using Firebase Auth
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
      // Clear password fields
      setFormData(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
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
                label="Current Password (required to change password)"
                name="currentPassword"
                type={showCurrentPassword ? 'text' : 'password'}
                value={formData.currentPassword}
                onChange={handleInputChange}
                fullWidth
                helperText="Enter your current password if you want to change your password"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        edge="end"
                      >
                        {showCurrentPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              <TextField
                label="New Password (optional)"
                name="newPassword"
                type={showNewPassword ? 'text' : 'password'}
                value={formData.newPassword}
                onChange={handleInputChange}
                fullWidth
                helperText="Leave blank to keep current password. Must be at least 6 characters."
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        edge="end"
                      >
                        {showNewPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              <TextField
                label="Confirm New Password"
                name="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={handleInputChange}
                fullWidth
                disabled={!formData.newPassword}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        edge="end"
                      >
                        {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
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
