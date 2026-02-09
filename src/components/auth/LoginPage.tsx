import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { Box, Button, TextField, Typography, CircularProgress, Link } from '@mui/material';
import { signIn, resetPassword } from '../../services/auth';
import { setError } from '../../store/slices/authSlice';
import { RootState } from '../../store';
import { useTranslation } from 'react-i18next';
import LanguageToggle from '../common/LanguageToggle';

export const LoginPage = () => {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  // If redirected from PrivateRoute, capture the intended destination
  const from = (location.state as any)?.from?.pathname || '/dashboard';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const globalError = useSelector((state: RootState) => state.auth.error);
  const isAuthenticated = useSelector((state: RootState) => !!state.auth.user);

  // Don't redirect here - let App.tsx handle it to avoid race conditions
  // The route definition in App.tsx will handle redirecting authenticated users

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('LoginPage: Starting login attempt');
    setLoading(true);
    setLocalError(null);
    dispatch(setError(null));

    try {
      console.log('LoginPage: Attempting login with email:', email);
      await signIn(email, password);
      console.log('LoginPage: Login successful, redirecting to:', from);
      // Navigate to the intended destination (e.g. /jobcards or /dashboard)
      navigate(from, { replace: true });
    } catch (error) {
      console.error('LoginPage: Login error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      setLocalError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setLocalError(t('validation.required'));
      return;
    }

    setLoading(true);
    setLocalError(null);
    dispatch(setError(null));

    try {
      await resetPassword(email);
      setResetSent(true);
    } catch (error) {
      console.error('LoginPage: Password reset error:', error);
      const errorMessage = error instanceof Error ? error.message : t('errors.genericError');
      setLocalError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Don't render if authenticated - let App.tsx handle redirect
  // Returning null immediately can cause React DOM issues during unmount
  if (isAuthenticated) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: 3,
      }}
    >
      <Box sx={{ position: 'absolute', top: 20, right: 20 }}>
        <LanguageToggle />
      </Box>
      
      <Box
        component="form"
        onSubmit={handleLogin}
        sx={{
          width: '100%',
          maxWidth: 400,
          p: 4,
          borderRadius: 2,
          bgcolor: 'background.paper',
          boxShadow: 3,
        }}
      >
        <Typography component="h1" variant="h5" sx={{ mb: 3 }}>
          {t('auth.signIn')}
        </Typography>

        {(localError || globalError) && (
          <Typography color="error" sx={{ mb: 2 }}>
            {localError || globalError}
          </Typography>
        )}

        {resetSent && (
          <Typography color="success.main" sx={{ mb: 2 }}>
            Password reset email sent. Please check your inbox.
          </Typography>
        )}

        <TextField
          margin="normal"
          required
          fullWidth
          id="email"
          label={t('auth.email')}
          name="email"
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
        />

        <TextField
          margin="normal"
          required
          fullWidth
          name="password"
          label={t('auth.password')}
          type="password"
          id="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
        />

        <Button
          type="submit"
          fullWidth
          variant="contained"
          sx={{ mt: 3, mb: 2 }}
          disabled={loading}
        >
          {loading ? <CircularProgress size={24} /> : t('auth.signIn')}
        </Button>

        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Link
            component="button"
            variant="body2"
            onClick={handleResetPassword}
            disabled={loading}
          >
            {t('auth.forgotPassword')}
          </Link>
        </Box>
      </Box>
    </Box>
  );
};
