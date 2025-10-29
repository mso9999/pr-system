/**
 * @fileoverview Main Layout Component
 * @version 1.2.0
 * 
 * Description:
 * Core layout component that provides the base structure for all pages.
 * Implements Material-UI's responsive layout system with a persistent
 * drawer for navigation and a top app bar.
 * 
 * Features:
 * - Responsive navigation drawer
 * - Top app bar with user menu
 * - Breadcrumb navigation
 * - Theme switching
 * - Mobile-friendly design
 * 
 * Props:
 * ```typescript
 * interface LayoutProps {
 *   children: React.ReactNode;  // Page content
 *   title?: string;            // Page title
 *   showBack?: boolean;        // Show back button
 * }
 * ```
 * 
 * Usage:
 * ```typescript
 * <Layout title="Dashboard">
 *   <DashboardContent />
 * </Layout>
 * ```
 * 
 * Related Components:
 * - components/common/Navigation.tsx: Navigation menu
 * - components/common/UserMenu.tsx: User dropdown
 * - components/common/Breadcrumbs.tsx: Breadcrumb nav
 */

import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import {
  AppBar,
  Box,
  Container,
  IconButton,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
  Button
} from '@mui/material';
import { AccountCircle } from '@mui/icons-material';
import { signOut } from 'firebase/auth';
import { auth } from '../config/firebase';
import { useAuth } from '../hooks/useAuth';
import { useSnackbar } from '../hooks/useSnackbar';
import { useTranslation } from 'react-i18next';
import LanguageToggle from './common/LanguageToggle';

export const Layout: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showSnackbar } = useSnackbar();
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      showSnackbar(t('auth.logoutSuccess'), 'success');
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Logout error:', error);
      showSnackbar(t('errors.genericError'), 'error');
    }
    handleClose();
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            {t('pr.purchaseRequest')} System
          </Typography>
          <Button color="inherit" onClick={() => navigate('/dashboard')}>
            {t('nav.dashboard')}
          </Button>
          <Button color="inherit" onClick={() => navigate('/pr/new')}>
            {t('nav.newPR')}
          </Button>
          {user && user.permissionLevel && user.permissionLevel <= 4 && (
            <Button color="inherit" onClick={() => navigate('/admin')}>
              {t('nav.admin')}
            </Button>
          )}
          <Box sx={{ mx: 2 }}>
            <LanguageToggle />
          </Box>
          {user && (
            <div>
              <IconButton
                size="large"
                aria-label="account of current user"
                aria-controls="menu-appbar"
                aria-haspopup="true"
                onClick={handleMenu}
                color="inherit"
              >
                <AccountCircle />
              </IconButton>
              <Menu
                id="menu-appbar"
                anchorEl={anchorEl}
                anchorOrigin={{
                  vertical: 'top',
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
                <MenuItem disabled>
                  {user.email} ({user.role})
                </MenuItem>
                <MenuItem onClick={handleLogout}>{t('auth.logout')}</MenuItem>
              </Menu>
            </div>
          )}
        </Toolbar>
      </AppBar>
      <Container component="main" sx={{ flexGrow: 1, py: 3 }}>
        <Outlet />
      </Container>
    </Box>
  );
};
