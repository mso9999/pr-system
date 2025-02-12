import { useState } from 'react';
import { useNavigate, Outlet } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '@/store';
import {
  AppBar,
  Box,
  CssBaseline,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Menu,
  MenuItem,
  styled,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard,
  AddCircle,
  List as ListIcon,
  Person,
  AdminPanelSettings,
  FilterList
} from '@mui/icons-material';
import { signOut } from '../../services/auth';
import { clearUser } from '../../store/slices/authSlice';
import { clearPRState, setShowOnlyMyPRs } from '../../store/slices/prSlice';
import { UserProfile } from '@/components/user/UserProfile';

const NavItem = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(1.5, 2),
  cursor: 'pointer',
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  },
  '& .MuiListItemIcon-root': {
    minWidth: 40,
  },
}));

export const Layout = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);
  const showOnlyMyPRs = useSelector((state: RootState) => state.pr.showOnlyMyPRs);
  
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleMyPRsToggle = () => {
    dispatch(setShowOnlyMyPRs(!showOnlyMyPRs));
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      dispatch(clearUser());
      dispatch(clearPRState());
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Check if user has admin access (either role ADMIN or permissionLevel <= 4)
  const hasAdminAccess = user?.role === 'ADMIN' || (user?.permissionLevel && user?.permissionLevel <= 4);

  const drawer = (
    <Box>
      <Toolbar />
      <Divider />
      <List>
        <NavItem onClick={() => navigate('/dashboard')}>
          <ListItemIcon>
            <Dashboard />
          </ListItemIcon>
          <ListItemText primary="Dashboard" />
        </NavItem>
        <NavItem>
          <ListItemIcon>
            <FilterList />
          </ListItemIcon>
          <FormControlLabel
            control={
              <Switch
                checked={showOnlyMyPRs}
                onChange={handleMyPRsToggle}
                name="myPRs"
                color="primary"
              />
            }
            label="My PRs"
          />
        </NavItem>
        <NavItem onClick={() => navigate('/pr/list')}>
          <ListItemIcon>
            <ListIcon />
          </ListItemIcon>
          <ListItemText primary="PRs" />
        </NavItem>
        {hasAdminAccess && (
          <>
            <Divider />
            <NavItem onClick={() => navigate('/admin')}>
              <ListItemIcon>
                <AdminPanelSettings />
              </ListItemIcon>
              <ListItemText primary="Admin Portal" />
            </NavItem>
          </>
        )}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - 240px)` },
          ml: { sm: `240px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            1PWR Procurement System
          </Typography>
          <div>
            <IconButton
              size="large"
              aria-label="account of current user"
              aria-controls="menu-appbar"
              aria-haspopup="true"
              onClick={handleMenu}
              color="inherit"
            >
              <Person />
            </IconButton>
            <Menu
              id="menu-appbar"
              anchorEl={anchorEl}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'right',
              }}
              keepMounted
              transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
              open={Boolean(anchorEl)}
              onClose={handleClose}
            >
              <div style={{ padding: '8px 16px', minWidth: '200px' }}>
                <Typography variant="body2" color="textSecondary">
                  Signed in as
                </Typography>
                <Typography variant="body1">
                  {user?.email}
                </Typography>
              </div>
              <Divider />
              <MenuItem onClick={() => {
                handleClose();
                setIsProfileOpen(true);
              }}>
                Manage Profile
              </MenuItem>
              <MenuItem onClick={handleSignOut}>Sign Out</MenuItem>
            </Menu>
          </div>
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ width: { sm: 240 }, flexShrink: { sm: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: 240 },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: 240 },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - 240px)` },
          mt: '64px',
        }}
      >
        <Outlet />
      </Box>
      {isProfileOpen && (
        <UserProfile
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
        />
      )}
    </Box>
  );
};
