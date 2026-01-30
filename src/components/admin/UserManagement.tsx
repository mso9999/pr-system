import React, { useState, useEffect, useMemo } from 'react';
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
  Switch,
  Checkbox
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, Visibility, VisibilityOff, Key as KeyIcon, Search as SearchIcon, ArrowUpward, ArrowDownward } from '@mui/icons-material';
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

type SortField = 'name' | 'email' | 'organization' | 'department' | 'permissionLevel' | 'status';
type SortDirection = 'asc' | 'desc';

export function UserManagement({ isReadOnly }: UserManagementProps) {
  const currentUser = useSelector((state: RootState) => state.auth.user);
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<ReferenceData[]>([]);
  const [allDepartments, setAllDepartments] = useState<ReferenceData[]>([]);
  const [organizations, setOrganizations] = useState<ReferenceData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [isDepartmentsLoading, setIsDepartmentsLoading] = useState(false);
  const [permissionOptions, setPermissionOptions] = useState<{ 
    level: number; 
    name: string; 
    code?: string; 
    description?: string;
    source: 'reference' | 'fallback';
  }[]>([]);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [permissionsWarning, setPermissionsWarning] = useState<string | null>(null);
  const [usingFallbackPermissions, setUsingFallbackPermissions] = useState(false);

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

  // Role restrictions
  const isProcurement = currentUser?.permissionLevel === PERMISSION_LEVELS.PROC;
  const isUserAdmin = currentUser?.permissionLevel === PERMISSION_LEVELS.USER_ADMIN;
  const canManageAllUsers = currentUser?.permissionLevel === 1; // Only Admin
  const isProtectedAdminAccount = (user?: User | null) =>
    !!user && user.permissionLevel === PERMISSION_LEVELS.ADMIN;

  const fallbackPermissionOptions = useMemo(() => {
    return Object.entries(PERMISSION_LEVELS).map(([key, level]) => ({
      level,
      name: PERMISSION_NAMES[level as keyof typeof PERMISSION_NAMES] || `Level ${level}`,
      code: key,
      description: `${PERMISSION_NAMES[level as keyof typeof PERMISSION_NAMES] || key} (default)`,
      source: 'fallback' as const
    }));
  }, []);

  const loadPermissions = async () => {
    setPermissionsLoading(true);
    setPermissionsWarning(null);
    try {
      const items = await referenceDataService.getItemsByType('permissions');
      const activeItems = (items || []).filter(item => item.active !== false);
      
      const normalized: typeof permissionOptions = [];
      const seenLevels = new Set<number>();
      const duplicateLevels = new Set<number>();

      activeItems.forEach(item => {
        const rawLevel = typeof item.level === 'number' ? item.level : Number(item.level ?? item.code);
        if (!rawLevel || Number.isNaN(rawLevel)) {
          console.warn('[UserManagement] Skipping permission with invalid level', item);
          return;
        }
        if (seenLevels.has(rawLevel)) {
          duplicateLevels.add(rawLevel);
          return;
        }
        seenLevels.add(rawLevel);
        normalized.push({
          level: rawLevel,
          name: item.name || PERMISSION_NAMES[rawLevel as keyof typeof PERMISSION_NAMES] || `Level ${rawLevel}`,
          code: item.code,
          description: item.description,
          source: 'reference'
        });
      });

      const requiredLevels = Object.values(PERMISSION_LEVELS);
      const hasAllRequired = requiredLevels.every(level => normalized.some(option => option.level === level));

      if (normalized.length === 0 || !hasAllRequired) {
        const warningMsg = normalized.length === 0
          ? 'Reference permissions are empty; using fallback levels.'
          : 'Reference permissions missing required levels; using fallback.';
        console.warn('[UserManagement] ' + warningMsg, { normalized, requiredLevels });
        setPermissionsWarning(warningMsg);
        setPermissionOptions(fallbackPermissionOptions);
        setUsingFallbackPermissions(true);
        return;
      }

      if (duplicateLevels.size > 0) {
        const warningMsg = `Duplicate permission levels detected (${Array.from(duplicateLevels).join(', ')}); using fallback.`;
        console.warn('[UserManagement] ' + warningMsg);
        setPermissionsWarning(warningMsg);
        setPermissionOptions(fallbackPermissionOptions);
        setUsingFallbackPermissions(true);
        return;
      }

      normalized.sort((a, b) => a.level - b.level);
      setPermissionOptions(normalized);
      setUsingFallbackPermissions(false);
    } catch (error) {
      console.error('Error loading permissions reference data:', error);
      setPermissionsWarning('Failed to load permissions reference data; using fallback levels.');
      setPermissionOptions(fallbackPermissionOptions);
      setUsingFallbackPermissions(true);
    } finally {
      setPermissionsLoading(false);
    }
  };

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        loadUsers(), 
        loadOrganizations(),
        loadAllDepartments(),
        loadPermissions()
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadUsers = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const loadedUsers: User[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        
        // Log user data for debugging (development only)
        if (import.meta.env.MODE === 'development') {
          console.log('Loading user data:', {
            id: doc.id,
            rawPermissionLevel: data.permissionLevel,
            convertedPermissionLevel: typeof data.permissionLevel === 'number' ? data.permissionLevel : 
              typeof data.permissionLevel === 'string' ? Number(data.permissionLevel) : 5
          });
        }
        
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

  const availablePermissionOptions = useMemo(() => {
    if (!isUserAdmin) {
      return permissionOptions;
    }
    return permissionOptions.filter(
      option =>
        option.level >= PERMISSION_LEVELS.REQ &&
        option.level !== PERMISSION_LEVELS.ADMIN
    );
  }, [permissionOptions, isUserAdmin]);

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
      // Load all organizations from reference data without filtering by active status
      // This ensures all organizations are available for selection in user management
      const collectionRef = collection(db, 'referenceData_organizations');
      const querySnapshot = await getDocs(collectionRef);
      const loadedOrganizations: ReferenceData[] = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ReferenceData[];
      console.log('Loaded organizations:', loadedOrganizations);
      setOrganizations(loadedOrganizations);
    } catch (error) {
      console.error('Error loading organizations:', error);
      showSnackbar('Error loading organizations', 'error');
    }
  };

  const loadAllDepartments = async () => {
    try {
      console.log('Loading all departments...');
      const allDepts: ReferenceData[] = [];
      
      // First get organizations, then load departments for each
      const loadedOrganizations = await referenceDataService.getOrganizations();
      
      // Load departments for each organization
      for (const org of loadedOrganizations) {
        try {
          const orgDepartments = await referenceDataService.getDepartments(org.id);
          allDepts.push(...orgDepartments);
        } catch (error) {
          console.error(`Error loading departments for organization ${org.id}:`, error);
        }
      }
      
      console.log('Loaded all departments:', allDepts);
      setAllDepartments(allDepts);
    } catch (error) {
      console.error('Error loading all departments:', error);
      showSnackbar('Error loading departments', 'error');
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
    // Default to Requester when creating new users
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      department: '',
      organization: '',
      additionalOrganizations: [],
      permissionLevel: PERMISSION_LEVELS.REQ,
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
      permissionLevel: isProcurement || isUserAdmin ? PERMISSION_LEVELS.REQ : undefined,
      isActive: true
    });
  };

  const handleEdit = (user: User) => {
    // Procurement restriction: Can only edit Level 5 users
    if (isProcurement && user.permissionLevel !== 5) {
      showSnackbar('Procurement users can only manage Level 5 (Requester) users', 'error');
      return;
    }

    if (isUserAdmin && isProtectedAdminAccount(user)) {
      showSnackbar('User Administrators cannot modify Administrator accounts', 'error');
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

  const handleDelete = async (userId: string, skipConfirm = false) => {
    // Find the user to check permission level
    const userToDelete = users.find(u => u.id === userId);
    
    // Procurement restriction: Can only delete Level 5 users
    if (isProcurement && userToDelete && userToDelete.permissionLevel !== 5) {
      if (!skipConfirm) {
        showSnackbar('Procurement users can only manage Level 5 (Requester) users', 'error');
      }
      return;
    }

    if (isUserAdmin && isProtectedAdminAccount(userToDelete)) {
      if (!skipConfirm) {
        showSnackbar('User Administrators cannot delete Administrator accounts', 'error');
      }
      return;
    }

    if (skipConfirm || window.confirm('Are you sure you want to delete this user?')) {
      try {
        await deleteDoc(doc(db, 'users', userId));
        if (!skipConfirm) {
          await loadUsers();
          showSnackbar('User deleted successfully', 'success');
        }
      } catch (error) {
        console.error('Error deleting user:', error);
        if (!skipConfirm) {
          showSnackbar('Failed to delete user', 'error');
        }
        throw error; // Re-throw for bulk delete handling
      }
    }
  };

  const handleUserUpdate = async (userId: string, updatedData: Partial<User>, originalEmail?: string) => {
    try {
      setIsLoading(true);
      
      // If email is being updated AND it's different from the original, use special function to sync with Firebase Auth
      const emailChanged = updatedData.email && originalEmail && 
        updatedData.email.trim().toLowerCase() !== originalEmail.trim().toLowerCase();
      
      if (emailChanged) {
        try {
          await updateUserEmail(userId, updatedData.email!);
          // Email update also updates Firestore, so we can skip updating email below
          // But we still need to update other fields
        } catch (emailError: any) {
          console.error('Error updating email:', emailError);
          // Provide specific error messages for email update failures
          let errorMessage = 'Failed to update email';
          if (emailError?.code === 'functions/permission-denied') {
            errorMessage = 'You do not have permission to update user emails. Only Superadmin or IT Support can update emails.';
          } else if (emailError?.code === 'functions/already-exists') {
            errorMessage = 'This email is already in use by another account';
          } else if (emailError?.code === 'functions/invalid-argument') {
            errorMessage = emailError.message || 'Invalid email format';
          } else if (emailError?.message) {
            errorMessage = emailError.message;
          }
          showSnackbar(errorMessage, 'error');
          return; // Don't proceed with other updates if email update failed
        }
      }

      // Update other user data in Firestore (skip email if we just updated it via the cloud function)
      const userRef = doc(db, 'users', userId);
      const dataToUpdate = emailChanged 
        ? { ...updatedData, email: undefined, updatedAt: new Date().toISOString() } // Skip email, already updated
        : { ...updatedData, updatedAt: new Date().toISOString() };
      
      // Remove undefined values
      const cleanData = Object.fromEntries(
        Object.entries(dataToUpdate).filter(([_, v]) => v !== undefined)
      );
      
      await updateDoc(userRef, cleanData);

      // Refresh user list
      await loadUsers();
      
      const message = emailChanged 
        ? 'User updated successfully (email synced to Firebase Auth)'
        : 'User updated successfully';
      showSnackbar(message, 'success');
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
    if (isUserAdmin) {
      if (userData.permissionLevel < PERMISSION_LEVELS.REQ || userData.permissionLevel === PERMISSION_LEVELS.ADMIN) {
        showSnackbar('User Administrators can only create non-administrator users.', 'error');
        return;
      }
    }
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
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.organization || !formData.department || !formData.permissionLevel) {
      showSnackbar('Please fill in all required fields (including department)', 'error');
      return;
    }

    if (isUserAdmin) {
      if (formData.permissionLevel < PERMISSION_LEVELS.REQ || formData.permissionLevel === PERMISSION_LEVELS.ADMIN) {
        showSnackbar('User Administrators can only assign requester-level or higher (non-administrator) permissions.', 'error');
        return;
      }
      if (editingUser && isProtectedAdminAccount(editingUser)) {
        showSnackbar('User Administrators cannot modify Administrator accounts', 'error');
        return;
      }
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

        await createUser({
          email: formData.email!,
          password: password,
          firstName: formData.firstName!,
          lastName: formData.lastName!,
          department: formData.department || '',
          organization: formData.organization!,
          permissionLevel: formData.permissionLevel!
        });
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

      if (isUserAdmin) {
        const targetUser = users.find(u => u.id === userId);
        if (isProtectedAdminAccount(targetUser)) {
          showSnackbar('User Administrators cannot update Administrator passwords', 'error');
          setIsLoading(false);
          return;
        }
      }

      const result = await updateUserPassword(userId, trimmedEmail, newPassword);
      
      if (result.data?.success) {
        const message = result.data?.message || 'Password updated successfully';
        showSnackbar(message, 'success');
        setPasswordDialogOpen(false);
        // Reset states
        setCustomPassword('');
        setGeneratedPassword('');
        setPasswordMode('custom');
        setShowPassword(false);
        // Reload users to ensure UI is up to date
        await loadUsers();
      } else {
        throw new Error(result.data?.error || 'Failed to update password');
      }
    } catch (error: any) {
      console.error('Error updating password:', error);
      let errorMessage = 'Failed to update password';
      
      // Handle specific Firebase errors
      if (error?.code === 'functions/not-found') {
        errorMessage = 'User not found in Firestore. Please verify the user exists in the system. If the user exists, check that the email address matches exactly (case-sensitive).';
      } else if (error?.code === 'functions/permission-denied') {
        errorMessage = 'You do not have permission to update passwords. Only Superadmin can update passwords.';
      } else if (error?.code === 'functions/invalid-argument') {
        // Check if it's an email mismatch error
        if (error?.message?.includes('Email does not match Firestore record')) {
          errorMessage = `Email mismatch: ${error.message}. Please verify the email address in the user record matches exactly.`;
        } else {
          errorMessage = error.message || 'Invalid password or email format';
        }
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      showSnackbar(errorMessage, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordDialogOpen = (user: User) => {
    if (!user.email) {
      showSnackbar('User has no email address', 'error');
      return;
    }
    if (isUserAdmin && isProtectedAdminAccount(user)) {
      showSnackbar('User Administrators cannot update Administrator passwords', 'error');
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
    const dept = allDepartments.find(d => d.id === id);
    return dept?.name || id;
  };

  const getPermissionName = (level: number): string => {
    // Use centralized permission names from config
    return PERMISSION_NAMES[level as keyof typeof PERMISSION_NAMES] || `Unknown Permission`;
  };

  // Filter and sort users
  const filteredAndSortedUsers = useMemo(() => {
    let filtered = users;

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(user => 
        `${user.firstName} ${user.lastName}`.toLowerCase().includes(searchLower) ||
        user.email.toLowerCase().includes(searchLower) ||
        getOrganizationName(user.organization).toLowerCase().includes(searchLower) ||
        getDepartmentName(user.department).toLowerCase().includes(searchLower) ||
        getPermissionName(user.permissionLevel).toLowerCase().includes(searchLower)
      );
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'name':
          aValue = `${a.firstName} ${a.lastName}`.toLowerCase();
          bValue = `${b.firstName} ${b.lastName}`.toLowerCase();
          break;
        case 'email':
          aValue = a.email.toLowerCase();
          bValue = b.email.toLowerCase();
          break;
        case 'organization':
          aValue = getOrganizationName(a.organization).toLowerCase();
          bValue = getOrganizationName(b.organization).toLowerCase();
          break;
        case 'department':
          aValue = getDepartmentName(a.department).toLowerCase();
          bValue = getDepartmentName(b.department).toLowerCase();
          break;
        case 'permissionLevel':
          aValue = a.permissionLevel || 0;
          bValue = b.permissionLevel || 0;
          break;
        case 'status':
          aValue = a.isActive ? 1 : 0;
          bValue = b.isActive ? 1 : 0;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [users, searchTerm, sortField, sortDirection, organizations, allDepartments]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleSelectUser = (userId: string) => {
    setSelectedUsers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedUsers.size === filteredAndSortedUsers.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(filteredAndSortedUsers.map(u => u.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedUsers.size === 0) {
      showSnackbar('No users selected', 'warning');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete ${selectedUsers.size} user(s)? This action cannot be undone.`)) {
      return;
    }

    setIsLoading(true);
    const countBefore = selectedUsers.size;
    try {
      const deletePromises = Array.from(selectedUsers).map(userId => handleDelete(userId, true));
      await Promise.all(deletePromises);
      setSelectedUsers(new Set());
      await loadUsers();
      showSnackbar(`Successfully deleted ${countBefore} user(s)`, 'success');
    } catch (error) {
      console.error('Error bulk deleting users:', error);
      showSnackbar('Error deleting some users', 'error');
      await loadUsers(); // Refresh to show current state
    } finally {
      setIsLoading(false);
    }
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />;
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

          {/* Search and Bulk Actions */}
          <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
            <TextField
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
              sx={{ flexGrow: 1, maxWidth: 400 }}
            />
            {!isReadOnly && selectedUsers.size > 0 && (
              <Button
                variant="contained"
                color="error"
                onClick={handleBulkDelete}
                disabled={isLoading}
              >
                Delete Selected ({selectedUsers.size})
              </Button>
            )}
          </Box>

          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  {!isReadOnly && (
                    <TableCell padding="checkbox">
                      <Checkbox
                        indeterminate={selectedUsers.size > 0 && selectedUsers.size < filteredAndSortedUsers.length}
                        checked={filteredAndSortedUsers.length > 0 && selectedUsers.size === filteredAndSortedUsers.length}
                        onChange={handleSelectAll}
                      />
                    </TableCell>
                  )}
                  <TableCell 
                    sx={{ cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => handleSort('name')}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      Name
                      {renderSortIcon('name')}
                    </Box>
                  </TableCell>
                  <TableCell 
                    sx={{ cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => handleSort('email')}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      Email
                      {renderSortIcon('email')}
                    </Box>
                  </TableCell>
                  <TableCell 
                    sx={{ cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => handleSort('organization')}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      Organization
                      {renderSortIcon('organization')}
                    </Box>
                  </TableCell>
                  <TableCell 
                    sx={{ cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => handleSort('department')}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      Department
                      {renderSortIcon('department')}
                    </Box>
                  </TableCell>
                  <TableCell 
                    sx={{ cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => handleSort('permissionLevel')}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      Permission Level
                      {renderSortIcon('permissionLevel')}
                    </Box>
                  </TableCell>
                  <TableCell 
                    sx={{ cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => handleSort('status')}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      Status
                      {renderSortIcon('status')}
                    </Box>
                  </TableCell>
                  {!isReadOnly && <TableCell>Actions</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredAndSortedUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={!isReadOnly ? 8 : 7} align="center">
                      <Typography variant="body2" color="text.secondary">
                        {searchTerm ? 'No users found matching your search' : 'No users found'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAndSortedUsers.map((user) => (
                    <TableRow key={user.id} hover>
                      {!isReadOnly && (
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={selectedUsers.has(user.id)}
                            onChange={() => handleSelectUser(user.id)}
                          />
                        </TableCell>
                      )}
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
                  ))
                )}
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
                  value={formData.permissionLevel ?? ''}
                  onChange={(e) => setFormData({ ...formData, permissionLevel: Number(e.target.value) })}
                  label="Permission Level"
                  disabled={isProcurement}
                  displayEmpty
                >
                  {permissionsLoading && (
                    <MenuItem disabled>Loading permissions...</MenuItem>
                  )}
                  {!permissionsLoading &&
                    availablePermissionOptions
                      .filter(option => {
                        if (isProcurement) {
                          return option.level === PERMISSION_LEVELS.REQ;
                        }
                        return true;
                      })
                      .map(option => (
                        <MenuItem key={option.level} value={option.level}>
                          {option.name} {option.source === 'fallback' ? '(default)' : ''}
                        </MenuItem>
                      ))}
                </Select>
              </FormControl>
              {permissionsWarning && (
                <Alert severity="warning" sx={{ mt: 1 }}>
                  {permissionsWarning}
                </Alert>
              )}
              {!permissionsWarning && !permissionsLoading && usingFallbackPermissions && (
                <Alert severity="info" sx={{ mt: 1 }}>
                  Using built-in permission levels.
                </Alert>
              )}
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
                  if (isUserAdmin && isProtectedAdminAccount(user)) {
                    showSnackbar('User Administrators cannot update Administrator passwords', 'error');
                    return;
                  }
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
