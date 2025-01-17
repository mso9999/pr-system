import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { onAuthStateChanged } from 'firebase/auth';
import { PersistGate } from 'redux-persist/integration/react';
import { auth } from './config/firebase';
import { setUser, setLoading, setError } from './store/slices/authSlice';
import { RootState } from './store';
import { persistor } from './store';
import { LoginPage } from './components/auth/LoginPage';
import { Dashboard } from './components/dashboard/Dashboard';
import { NewPRForm } from './components/pr/NewPRForm';
import { PRView } from './components/pr/PRView';
import { PrivateRoute } from './components/common/PrivateRoute';
import { AdminRoute } from './components/common/AdminRoute';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { Layout } from './components/common/Layout';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { getUserDetails } from './services/auth';
import { Box, Typography, CircularProgress } from '@mui/material';
import './App.css';

function App() {
  console.log('App: Component rendering');
  const dispatch = useDispatch();
  const { user, loading, error } = useSelector((state: RootState) => {
    console.log('App: Checking auth state:', state.auth);
    return state.auth;
  });

  useEffect(() => {
    console.log('App: Setting up auth state listener');
    dispatch(setLoading(true));
    
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('App: Auth state changed:', { email: firebaseUser?.email, loading });
      
      try {
        if (firebaseUser) {
          console.log('App: Getting user details for:', firebaseUser.uid);
          const userDetails = await getUserDetails(firebaseUser.uid);
          if (userDetails) {
            console.log('App: User details loaded:', userDetails);
            dispatch(setUser(userDetails));
          } else {
            console.error('App: No user details found');
            dispatch(setError('User account not found'));
          }
        } else {
          console.log('App: No user signed in');
          dispatch(setUser(null));
        }
      } catch (error) {
        console.error('App: Error handling auth state change:', error);
        dispatch(setError(error instanceof Error ? error.message : 'Authentication error'));
      } finally {
        console.log('App: Setting loading to false');
        dispatch(setLoading(false));
      }
    });

    return () => {
      console.log('App: Cleaning up auth state listener');
      unsubscribe();
    };
  }, [dispatch]);

  console.log('App: Current state:', { user, loading, error });

  return (
    <ErrorBoundary>
      <PersistGate loading={<Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>} persistor={persistor}>
        <Router>
          <Routes>
            <Route path="/login" element={
              loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                  <CircularProgress />
                </Box>
              ) : (
                user ? <Navigate to="/dashboard" replace /> : <LoginPage />
              )
            } />
            <Route element={<PrivateRoute />}>
              <Route element={<Layout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/pr/new" element={<NewPRForm />} />
                <Route path="/pr/:id" element={<PRView />} />
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
              </Route>
            </Route>
            <Route element={<AdminRoute />}>
              <Route element={<Layout />}>
                <Route path="/admin" element={<AdminDashboard />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </PersistGate>
    </ErrorBoundary>
  );
}

export default App;
