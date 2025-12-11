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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  InputAdornment,
  Visibility,
  VisibilityOff,
} from '@mui/material';
import { Key as KeyIcon } from '@mui/icons-material';
import { getPermissionInfo } from '@/config/permissions';

export function UserProfile() {
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);
  const permissionInfo = getPermissionInfo(user?.permissionLevel);
  
  const [isEditing, setIsEditing] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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

  const [passwordData, setPasswordData] = useState({
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
      setFormData(prev => ({ ...prev, newPassword: '', confirmPassword: '' }));
    } catch (error) {
      console.error('Error updating profile:', error);
      setSnackbar({
        open: true,
        message: 'Failed to update profile',
        severity: 'error',
      });
    }
  };

  const handlePasswordChange = async () => {
    try {
      if (!auth.currentUser) {
        setSnackbar({
          open: true,
          message: 'You must be logged in to change your password',
          severity: 'error',
        });
        return;
      }

      // Validate passwords
      if (!passwordData.newPassword || !passwordData.confirmPassword) {
        setSnackbar({
          open: true,
          message: 'Please fill in all password fields',
          severity: 'error',
        });
        return;
      }

      if (passwordData.newPassword !== passwordData.confirmPassword) {
        setSnackbar({
          open: true,
          message: 'New passwords do not match',
          severity: 'error',
        });
        return;
      }

      if (passwordData.newPassword.length < 6) {
        setSnackbar({
          open: true,
          message: 'Password must be at least 6 characters long',
          severity: 'error',
        });
        return;
      }

      // Update password using Firebase Auth
      await updatePassword(auth.currentUser, passwordData.newPassword);

      setSnackbar({
        open: true,
        message: 'Password changed successfully',
        severity: 'success',
      });

      // Reset password form and close dialog
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setIsPasswordDialogOpen(false);
    } catch (error: any) {
      console.error('Error changing password:', error);
      let errorMessage = 'Failed to change password';
      
      if (error.code === 'auth/requires-recent-login') {
        errorMessage = 'For security, please sign out and sign back in before changing your password';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Please choose a stronger password';
      } else if (error.message) {
        errorMessage = error.message;
      }

      setSnackbar({
        open: true,
        message: errorMessage,
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
      
      {/* Change Password Section */}
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
          Password
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Change your account password to keep your account secure.
        </Typography>
        <Button
          variant="outlined"
          startIcon={<KeyIcon />}
          onClick={() => setIsPasswordDialogOpen(true)}
        >
          Change Password
        </Button>
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

      {/* Change Password Dialog */}
      <Dialog
        open={isPasswordDialogOpen}
        onClose={() => {
          setIsPasswordDialogOpen(false);
          setPasswordData({
            currentPassword: '',
            newPassword: '',
            confirmPassword: '',
          });
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Change Password</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <TextField
              label="New Password"
              name="newPassword"
              type={showNewPassword ? 'text' : 'password'}
              value={passwordData.newPassword}
              onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
              fullWidth
              required
              helperText="Must be at least 6 characters long"
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
              value={passwordData.confirmPassword}
              onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
              fullWidth
              required
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
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setIsPasswordDialogOpen(false);
              setPasswordData({
                currentPassword: '',
                newPassword: '',
                confirmPassword: '',
              });
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handlePasswordChange}
            disabled={!passwordData.newPassword || !passwordData.confirmPassword}
          >
            Change Password
          </Button>
        </DialogActions>
      </Dialog>

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
