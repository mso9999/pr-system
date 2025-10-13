import React, { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Box,
  Typography,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Snackbar,
  Alert,
  Select,
  FormControl,
  InputLabel,
  IconButton,
  Chip,
  InputAdornment,
  RadioGroup,
  FormControlLabel,
  Radio,
  Switch
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, Visibility, VisibilityOff, Key as KeyIcon } from '@mui/icons-material';
import { doc, collection, query, where, getDocs, updateDoc, addDoc, deleteDoc, orderBy, setDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../config/firebase';
import { User } from '../../types/user';
import { updateUserEmail, createUser, updateUserPassword } from '../../services/auth';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { referenceDataService } from '../../services/referenceData';
import { ReferenceData } from '../../types/referenceData';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { PERMISSION_LEVELS, PERMISSION_NAMES } from '../../config/permissions';

// Helper function to generate random password
function generateRandomPassword(): string {
  const length = 12;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    password += charset[randomIndex];
  }
  return password;
}

interface PasswordDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (newPassword: string) => void;
  userId: string;
}

interface UserManagementProps {
  isReadOnly: boolean;
}

function PasswordDialog({ open, onClose, onSubmit, userId }: PasswordDialogProps) {
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = () => {
    onSubmit(newPassword);
    setNewPassword('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Change Password</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label="New Password"
          type={showPassword ? 'text' : 'password'}
          fullWidth
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={() => setShowPassword(!showPassword)}
                  edge="end"
                >
                  {showPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={!newPassword}>
          Update Password
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function UserManagement({ isReadOnly }: UserManagementProps) {
  const currentUser = useSelector((state: RootState) => state.auth.user);
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<ReferenceData[]>([]);
  const [organizations, setOrganizations] = useState<ReferenceData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDepartmentsLoading, setIsDepartmentsLoading] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [passwordMode, setPasswordMode] = useState<'random' | 'custom'>('custom');
  const [customPassword, setCustomPassword] = useState('');
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isPasswordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<User>>({
    firstName: '',
    lastName: '',
    email: '',
    department: '',
    organization: '',
    additionalOrganizations: [],
    permissionLevel: undefined,
    isActive: true
  });
  const { showSnackbar } = useSnackbar();

  // Procurement restrictions: Can only manage Level 5 (Requester) users
  const isProcurement = currentUser?.permissionLevel === 3;
  const canManageAllUsers = currentUser?.permissionLevel === 1; // Only Admin

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        loadUsers(), 
        loadOrganizations()
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const loadedUsers: User[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        
        // Log user data for debugging
        console.log('Loading user data:', {
          id: doc.id,
          rawPermissionLevel: data.permissionLevel,
          convertedPermissionLevel: typeof data.permissionLevel === 'number' ? data.permissionLevel : 
            typeof data.permissionLevel === 'string' ? Number(data.permissionLevel) : 5
        });
        
        loadedUsers.push({
          id: doc.id,
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          email: data.email || '',
          department: data.department || '',
          organization: typeof data.organization === 'string' ? data.organization : '',
          additionalOrganizations: Array.isArray(data.additionalOrganizations) 
            ? data.additionalOrganizations.map(org => typeof org === 'string' ? org : org?.name || '')
            : [],
          // Handle both string and number permission levels
          permissionLevel: typeof data.permissionLevel === 'number' ? data.permissionLevel : 
            typeof data.permissionLevel === 'string' ? Number(data.permissionLevel) : 5,
          isActive: data.isActive !== false
        });
      });
      
      // Log all loaded users
      console.log('All loaded users:', loadedUsers.map(u => ({ 
        id: u.id, 
        email: u.email,
        permissionLevel: u.permissionLevel 
      })));
      
      setUsers(loadedUsers);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  // Helper function to normalize organization ID
  const normalizeOrgId = (orgId: string): string => {
    return orgId.toLowerCase().replace(/\s+/g, '_');
  };

  // Helper function to find department by name (case insensitive)
  const findDepartmentByName = (deptName: string): ReferenceData | undefined => {
    return departments.find(d => 
      d.name.toLowerCase() === deptName.toLowerCase()
    );
  };

  // Helper function to find department by ID
  const findDepartmentById = (deptId: string): ReferenceData | undefined => {
    return departments.find(d => d.id === deptId);
  };

  // Load departments for a specific organization
  const loadDepartmentsForOrg = async (organization: string) => {
    console.log('Loading departments for organization:', organization);
    setIsDepartmentsLoading(true);
    
    try {
      const loadedDepartments = await referenceDataService.getDepartments(organization);
      console.log('Loaded departments:', loadedDepartments);
      console.log('Available department values:', loadedDepartments.map(dept => ({
        id: dept.id,
        name: dept.name,
        organization: dept.organization
      })));
      
      setDepartments(loadedDepartments);
    } catch (error) {
      console.error('Error loading departments:', error);
      setDepartments([]);
    } finally {
      setIsDepartmentsLoading(false);
    }
  };

  const loadOrganizations = async () => {
    try {
      console.log('Loading organizations...');
      const loadedOrganizations = await referenceDataService.getOrganizations();
      console.log('Loaded organizations:', loadedOrganizations);
      setOrganizations(loadedOrganizations);
    } catch (error) {
      console.error('Error loading organizations:', error);
      showSnackbar('Error loading organizations', 'error');
    }
  };

  // Load departments whenever organization changes in the form
  useEffect(() => {
    if (formData.organization) {
      loadDepartmentsForOrg(formData.organization);
    } else {
      setDepartments([]);
    }
  }, [formData.organization]);

  const handleAdd = () => {
    setEditingUser(null);
    // Default to Requester (Level 5) when creating new users
    // Procurement users can only create Level 5, others default to Level 5
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      department: '',
      organization: '',
      additionalOrganizations: [],
      permissionLevel: isProcurement ? 5 : 5, // Default to Requester level
      isActive: true
    });
    setIsDialogOpen(true);
  };

  const handleClose = () => {
    setIsDialogOpen(false);
    setEditingUser(null);
    // Reset form data
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      department: '',
      organization: '',
      additionalOrganizations: [],
      permissionLevel: isProcurement ? 5 : undefined, // Procurement can only create Level 5
      isActive: true
    });
  };

  const handleEdit = (user: User) => {
    // Procurement restriction: Can only edit Level 5 users
    if (isProcurement && user.permissionLevel !== 5) {
      showSnackbar('Procurement users can only manage Level 5 (Requester) users', 'error');
      return;
    }

    console.log('Editing user:', user);
    
    const normalizedOrg = normalizeOrgId(user.organization);
    const dept = findDepartmentByName(user.department);
    
    console.log('Normalized values:', {
      originalOrg: user.organization,
      normalizedOrg,
      originalDept: user.department,
      foundDept: dept
    });
    
    setEditingUser(user);
    setFormData({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      department: dept?.id || '',
      organization: normalizedOrg,
      additionalOrganizations: user.additionalOrganizations || [],
      permissionLevel: user.permissionLevel || 5,
      isActive: user.isActive
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (userId: string) => {
    // Find the user to check permission level
    const userToDelete = users.find(u => u.id === userId);
    
    // Procurement restriction: Can only delete Level 5 users
    if (isProcurement && userToDelete && userToDelete.permissionLevel !== 5) {
      showSnackbar('Procurement users can only manage Level 5 (Requester) users', 'error');
      return;
    }

    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        await deleteDoc(doc(db, 'users', userId));
        await loadUsers();
        showSnackbar('User deleted successfully', 'success');
      } catch (error) {
        console.error('Error deleting user:', error);
        showSnackbar('Failed to delete user', 'error');
      }
    }
  };

  const handleUserUpdate = async (userId: string, updatedData: Partial<User>, originalEmail?: string) => {
    try {
      setIsLoading(true);
      
      // If email is being updated AND it's different from the original, use special function to sync with Firebase Auth
      if (updatedData.email && originalEmail && updatedData.email !== originalEmail) {
        await updateUserEmail(userId, updatedData.email);
      }

      // Update other user data in Firestore
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        ...updatedData,
        updatedAt: new Date().toISOString()
      });

      // Refresh user list
      await loadUsers();
      
      showSnackbar('User updated successfully', 'success');
    } catch (error) {
      console.error('Error updating user:', error);
      showSnackbar(error instanceof Error ? error.message : 'Failed to update user', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewUser = async (userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    department: string;
    organization: string;
    permissionLevel: number;
    isActive: boolean;
  }) => {
    try {
      setIsLoading(true);
      
      // Use createUser function that handles both Auth and Firestore
      await createUser(userData);

      // Refresh user list
      await loadUsers();
      
      showSnackbar('User created successfully', 'success');
    } catch (error) {
      console.error('Error creating user:', error);
      showSnackbar(error instanceof Error ? error.message : 'Failed to create user', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.organization || !formData.permissionLevel) {
      showSnackbar('Please fill in all required fields', 'error');
      return;
    }

    try {
      setIsLoading(true);
      
      if (editingUser) {
        await handleUserUpdate(editingUser.id, {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          department: formData.department,
          organization: formData.organization,
          additionalOrganizations: formData.additionalOrganizations,
          permissionLevel: formData.permissionLevel,
          isActive: formData.isActive
        }, editingUser.email);
      } else {
        // Create new user
        const password = generateRandomPassword();
        const newUserData = {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          department: formData.department,
          organization: formData.organization,
          additionalOrganizations: formData.additionalOrganizations,
          permissionLevel: formData.permissionLevel,
          isActive: formData.isActive,
          createdAt: new Date().toISOString()
        };

        await createUser(newUserData, password);
        await loadUsers();
      }

      handleClose();
      showSnackbar(editingUser ? 'User updated successfully' : 'User created successfully', 'success');
    } catch (error) {
      console.error('Error saving user:', error);
      showSnackbar(error instanceof Error ? error.message : 'Failed to save user', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field: keyof User, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handlePasswordUpdate = async (userId: string, email: string, newPassword: string) => {
    try {
      setIsLoading(true);
      
      // Trim and validate email
      const trimmedEmail = email.trim().toLowerCase();
      if (!trimmedEmail) {
        throw new Error('Email is required');
      }

      const result = await updateUserPassword(userId, trimmedEmail, newPassword);
      
      if (result.data?.success) {
        showSnackbar('Password updated successfully', 'success');
        setPasswordDialogOpen(false);
        // Reset states
        setCustomPassword('');
        setGeneratedPassword('');
        setPasswordMode('custom');
        setShowPassword(false);
      } else {
        throw new Error(result.data?.error || 'Failed to update password');
      }
    } catch (error) {
      console.error('Error updating password:', error);
      showSnackbar(error instanceof Error ? error.message : 'Failed to update password', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordDialogOpen = (user: User) => {
    if (!user.email) {
      showSnackbar('User has no email address', 'error');
      return;
    }
    setSelectedUserId(user.id);
    setPasswordDialogOpen(true);
    // Generate a random password by default
    setGeneratedPassword(generateRandomPassword());
  };

  // Helper functions to get names from IDs
  const getOrganizationName = (id: string): string => {
    const org = organizations.find(o => o.id === id);
    return org?.name || id;
  };

  const getDepartmentName = (id: string): string => {
    const dept = departments.find(d => d.id === id);
    return dept?.name || id;
  };

  const getPermissionName = (level: number): string => {
    // Use centralized permission names from config
    return PERMISSION_NAMES[level as keyof typeof PERMISSION_NAMES] || `Unknown Permission`;
  };

  return (
    <Box sx={{ p: 3 }}>
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h4" gutterBottom>
              User Management
            </Typography>
            {!isReadOnly && (
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  variant="outlined"
                  onClick={() => handleSyncEmails()}
                  disabled={isLoading}
                >
                  Sync User Emails
                </Button>
                <Button
                  variant="contained"
                  onClick={handleAdd}
                  disabled={isLoading}
                >
                  Add New User
                </Button>
              </Box>
            )}
          </Box>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Organization</TableCell>
                  <TableCell>Department</TableCell>
                  <TableCell>Permission Level</TableCell>
                  <TableCell>Status</TableCell>
                  {!isReadOnly && <TableCell>Actions</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>{`${user.firstName} ${user.lastName}`}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{getOrganizationName(user.organization)}</TableCell>
                    <TableCell>{getDepartmentName(user.department)}</TableCell>
                    <TableCell>{getPermissionName(user.permissionLevel)}</TableCell>
                    <TableCell>
                      <Chip 
                        label={user.isActive ? "Active" : "Inactive"}
                        color={user.isActive ? "success" : "default"}
                      />
                    </TableCell>
                    {!isReadOnly && (
                      <TableCell>
                        <IconButton onClick={() => handleEdit(user)} title="Edit User">
                          <EditIcon />
                        </IconButton>
                        <IconButton onClick={() => handlePasswordDialogOpen(user)} title="Reset Password">
                          <KeyIcon />
                        </IconButton>
                        <IconButton onClick={() => handleDelete(user.id)} title="Delete User" color="error">
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          {!isReadOnly && (
            <Box sx={{ mt: 2 }}>
              <Button
                variant="contained"
                color="primary"
                onClick={() => setIsDialogOpen(true)}
              >
                Add New User
              </Button>
            </Box>
          )}
          <Dialog open={isDialogOpen} onClose={handleClose}>
            <DialogTitle>{editingUser ? 'Edit User' : 'Add New User'}</DialogTitle>
            <DialogContent>
              <TextField
                autoFocus
                margin="dense"
                label="First Name"
                fullWidth
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              />
              <TextField
                margin="dense"
                label="Last Name"
                fullWidth
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              />
              <TextField
                margin="dense"
                label="Email"
                type="email"
                fullWidth
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
              <FormControl fullWidth margin="dense">
                <InputLabel>Organization</InputLabel>
                <Select
                  value={formData.organization}
                  onChange={(e) => setFormData({ ...formData, organization: e.target.value, department: '' })}
                  label="Organization"
                >
                  {organizations.map((org) => (
                    <MenuItem key={org.id} value={org.id}>
                      {org.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth margin="dense">
                <InputLabel>Department</InputLabel>
                <Select
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  label="Department"
                  disabled={!formData.organization || isDepartmentsLoading}
                >
                  {isDepartmentsLoading ? (
                    <MenuItem disabled>Loading departments...</MenuItem>
                  ) : departments.length === 0 ? (
                    <MenuItem disabled>No departments available</MenuItem>
                  ) : (
                    departments.map((dept) => (
                      <MenuItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </MenuItem>
                    ))
                  )}
                </Select>
              </FormControl>
              <FormControl fullWidth margin="dense">
                <InputLabel>Additional Organizations</InputLabel>
                <Select
                  multiple
                  value={formData.additionalOrganizations || []}
                  onChange={(e) => {
                    const value = e.target.value as string[];
                    setFormData({
                      ...formData,
                      additionalOrganizations: value
                    });
                  }}
                  label="Additional Organizations"
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {(selected as string[]).map((value) => {
                        const org = organizations.find(o => o.id === value);
                        return (
                          <Chip 
                            key={value} 
                            label={org?.name || value}
                            size="small"
                          />
                        );
                      })}
                    </Box>
                  )}
                >
                  {organizations.map((org) => (
                    <MenuItem key={org.id} value={org.id}>
                      {org.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth margin="normal">
                <InputLabel>Permission Level</InputLabel>
                <Select
                  value={formData.permissionLevel || ''}
                  onChange={(e) => setFormData({ ...formData, permissionLevel: Number(e.target.value) })}
                  label="Permission Level"
                  disabled={isProcurement} // Procurement can only create Level 5
                >
                  {Object.entries(PERMISSION_LEVELS)
                    .filter(([_, level]) => {
                      // Procurement can only see/select Level 5 (Requester)
                      if (isProcurement) {
                        return level === 5;
                      }
                      // Admin sees all levels
                      return true;
                    })
                    .map(([key, level]) => (
                      <MenuItem key={key} value={level}>
                        {PERMISSION_NAMES[level]}
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>
              <FormControl fullWidth margin="dense">
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.isActive !== false}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    />
                  }
                  label="Active"
                />
              </FormControl>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleClose}>Cancel</Button>
              <Button onClick={handleSubmit} variant="contained">
                {editingUser ? 'Update' : 'Add'}
              </Button>
            </DialogActions>
          </Dialog>

          <Dialog 
            open={isPasswordDialogOpen} 
            onClose={() => {
              setPasswordDialogOpen(false);
              setCustomPassword('');
              setGeneratedPassword('');
              setPasswordMode('custom');
              setShowPassword(false);
            }}
          >
            <DialogTitle>Update Password</DialogTitle>
            <DialogContent>
              <Box sx={{ mb: 2 }}>
                <FormControl component="fieldset">
                  <RadioGroup
                    row
                    value={passwordMode}
                    onChange={(e) => setPasswordMode(e.target.value as 'random' | 'custom')}
                  >
                    <FormControlLabel 
                      value="custom" 
                      control={<Radio />} 
                      label="Custom Password" 
                    />
                    <FormControlLabel 
                      value="random" 
                      control={<Radio />} 
                      label="Random Password" 
                    />
                  </RadioGroup>
                </FormControl>
              </Box>

              {passwordMode === 'custom' ? (
                <TextField
                  fullWidth
                  label="New Password"
                  type={showPassword ? 'text' : 'password'}
                  value={customPassword}
                  onChange={(e) => setCustomPassword(e.target.value)}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  sx={{ mb: 2 }}
                />
              ) : (
                <Box sx={{ mb: 2 }}>
                  <TextField
                    fullWidth
                    label="Generated Password"
                    type={showPassword ? 'text' : 'password'}
                    value={generatedPassword}
                    InputProps={{
                      readOnly: true,
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowPassword(!showPassword)}
                            edge="end"
                          >
                            {showPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                  <Button
                    size="small"
                    onClick={() => setGeneratedPassword(generateRandomPassword())}
                    sx={{ mt: 1 }}
                  >
                    Generate New Password
                  </Button>
                </Box>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setPasswordDialogOpen(false)}>Cancel</Button>
              <Button
                onClick={() => {
                  const user = users.find(u => u.id === selectedUserId);
                  if (user?.email) {
                    const newPassword = passwordMode === 'custom' ? customPassword : generatedPassword;
                    if (newPassword.length < 6) {
                      showSnackbar('Password must be at least 6 characters long', 'error');
                      return;
                    }
                    handlePasswordUpdate(selectedUserId, user.email, newPassword);
                  }
                }}
                color="primary"
                disabled={passwordMode === 'custom' ? !customPassword : !generatedPassword}
              >
                Update Password
              </Button>
            </DialogActions>
          </Dialog>
        </>
      )}
    </Box>
  );
}
