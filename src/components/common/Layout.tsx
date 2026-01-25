import { useState, useEffect } from 'react';
import { useNavigate, Outlet, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '@/store';
import { PERMISSION_LEVELS } from '@/config/permissions';
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
  FormControlLabel,
  useMediaQuery,
  useTheme
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard,
  AddCircle,
  List as ListIcon,
  Person,
  AdminPanelSettings,
  FilterList,
  HelpOutline,
  Archive as ArchiveIcon,
  Assignment
} from '@mui/icons-material';
import { signOut, getIdToken } from '../../services/auth';
import { clearUser } from '../../store/slices/authSlice';
import { clearPRState, setShowOnlyMyPRs } from '../../store/slices/prSlice';
import { UserProfile } from '@/components/user/UserProfile';
import { useTranslation } from 'react-i18next';
import LanguageToggle from './LanguageToggle';
import { CompanyLogo } from './CompanyLogo';
import { getAuth } from 'firebase/auth';

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
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { t } = useTranslation();
  const user = useSelector((state: RootState) => state.auth.user);
  const showOnlyMyPRs = useSelector((state: RootState) => state.pr.showOnlyMyPRs);
  
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Auto-close drawer on mobile when route changes
  useEffect(() => {
    if (isMobile && mobileOpen) {
      setMobileOpen(false);
    }
  }, [location.pathname, isMobile]);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    if (isMobile) {
      setMobileOpen(false);
    }
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

  const hasAdminAccess =
    user?.role === 'ADMIN' ||
    (user?.permissionLevel &&
      (user.permissionLevel <= 4 || user.permissionLevel === PERMISSION_LEVELS.USER_ADMIN));

  const drawer = (
    <Box>
      <Box sx={{ 
        p: 2, 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        minHeight: '64px'
      }}>
        <CompanyLogo />
      </Box>
      <Divider />
      <List>
        <NavItem onClick={() => handleNavigation('/dashboard')}>
          <ListItemIcon>
            <Dashboard />
          </ListItemIcon>
          <ListItemText primary={t('nav.dashboard')} />
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
            label={t('nav.myPRs')}
          />
        </NavItem>
        <NavItem onClick={() => handleNavigation('/pr/list')}>
          <ListItemIcon>
            <ListIcon />
          </ListItemIcon>
          <ListItemText primary="PRs" />
        </NavItem>
        <Divider />
        <NavItem onClick={() => handleNavigation('/archive')}>
          <ListItemIcon>
            <ArchiveIcon />
          </ListItemIcon>
          <ListItemText primary="Archive Dataroom" />
        </NavItem>
        <Divider />
        <NavItem onClick={async () => {
          try {
            const auth = getAuth();
            const currentUser = auth.currentUser;
            if (currentUser) {
              const token = await getIdToken(currentUser);
              const jobCardUrl = `https://prod.1pwrafrica.com?token=${encodeURIComponent(token)}`;
              window.open(jobCardUrl, '_blank');
            } else {
              window.open('https://prod.1pwrafrica.com', '_blank');
            }
          } catch (error) {
            console.error('Error getting auth token:', error);
            window.open('https://prod.1pwrafrica.com', '_blank');
          }
        }}>
          <ListItemIcon>
            <Assignment />
          </ListItemIcon>
          <ListItemText primary="Job Cards" />
        </NavItem>
        <Divider />
        <NavItem onClick={() => handleNavigation('/help')}>
          <ListItemIcon>
            <HelpOutline />
          </ListItemIcon>
          <ListItemText primary={t('nav.help')} />
        </NavItem>
        {hasAdminAccess && (
          <>
            <Divider />
            <NavItem onClick={() => handleNavigation('/admin')}>
              <ListItemIcon>
                <AdminPanelSettings />
              </ListItemIcon>
              <ListItemText primary={t('nav.admin')} />
            </NavItem>
          </>
        )}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', overflow: 'hidden', maxWidth: '100vw' }}>
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
            {t('pr.purchaseRequest')} System
          </Typography>
          <Box sx={{ mr: 2 }}>
            <LanguageToggle />
          </Box>
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
                  {user?.email}
                </Typography>
              </div>
              <Divider />
              <MenuItem onClick={() => {
                handleClose();
                setIsProfileOpen(true);
              }}>
                {t('nav.settings')}
              </MenuItem>
              <Divider />
              <div style={{ padding: '8px 16px', minWidth: '200px' }}>
                <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.7rem' }}>
                  Version: {(window as any).__APP_VERSION__?.version || '1.0.9'}
                </Typography>
                <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.65rem', display: 'block', mt: 0.5 }}>
                  Build: {(window as any).__APP_VERSION__?.buildHash?.substring(0, 8) || 'dev'}
                </Typography>
                <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.65rem', display: 'block', mt: 0.5 }}>
                  Commit: {(window as any).__APP_VERSION__?.gitCommit?.substring(0, 7) || 'local'}
                </Typography>
              </div>
              <Divider />
              <MenuItem onClick={handleSignOut}>{t('auth.signOut')}</MenuItem>
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
          p: { xs: 1, sm: 2, md: 3 },
          width: { xs: '100%', sm: `calc(100% - 240px)` },
          mt: '64px',
          maxWidth: { xs: '100vw', sm: `calc(100vw - 240px)` },
          overflowX: 'hidden',
          boxSizing: 'border-box',
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
