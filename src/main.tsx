// Add error handler for uncaught errors
window.onerror = function(message, source, lineno, colno, error) {
  console.error('Global error:', { message, source, lineno, colno, error });
  return false;
};

// Add handler for unhandled promise rejections
window.onunhandledrejection = function(event) {
  console.error('Unhandled promise rejection:', event.reason);
};

// Version information
// Note: In production, this will be replaced at build time via vite.config.ts
const FRONTEND_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0';
const BUILD_DATE = import.meta.env.VITE_BUILD_DATE || new Date().toISOString();
const BUILD_HASH = import.meta.env.VITE_BUILD_HASH || 'dev';
const GIT_COMMIT = import.meta.env.VITE_GIT_COMMIT || 'local';

// Prominent version logging
console.log('%c═══════════════════════════════════════════════════════════', 'color: #1976d2; font-weight: bold; font-size: 14px;');
console.log('%c🚀 PR SYSTEM - VERSION INFO', 'color: #1976d2; font-weight: bold; font-size: 16px;');
console.log('%c═══════════════════════════════════════════════════════════', 'color: #1976d2; font-weight: bold; font-size: 14px;');
console.log(`%cVersion: ${FRONTEND_VERSION}`, 'color: #10b981; font-weight: bold; font-size: 13px;');
console.log(`%cBuild Date: ${BUILD_DATE}`, 'color: #64748b; font-size: 12px;');
console.log(`%cBuild Hash: ${BUILD_HASH}`, 'color: #64748b; font-size: 12px;');
console.log(`%cGit Commit: ${GIT_COMMIT.substring(0, 7)}`, 'color: #64748b; font-size: 12px;');
console.log('%c═══════════════════════════════════════════════════════════', 'color: #1976d2; font-weight: bold; font-size: 14px;');

// Store version info globally for UI access
(window as any).__APP_VERSION__ = {
  version: FRONTEND_VERSION,
  buildDate: BUILD_DATE,
  buildHash: BUILD_HASH,
  gitCommit: GIT_COMMIT
};

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { createTheme } from '@mui/material/styles';
import { SnackbarProvider } from 'notistack';
import { store } from './store';
import './index.css';
import App from './App';
import './config/i18n'; // Initialize i18n

console.log('main.tsx: Starting application initialization');

// Wrap the entire initialization in a try-catch
try {
  // Log initial store state
  console.log('main.tsx: Initial store state:', store.getState());

  console.log('main.tsx: Creating theme');
  const theme = createTheme({
    palette: {
      primary: {
        main: '#1976d2',
      },
      secondary: {
        main: '#dc004e',
      },
      background: {
        default: '#f5f5f5',
      },
    },
  });
  console.log('main.tsx: Theme created');

  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Failed to find the root element');
  }
  console.log('main.tsx: Root element found');

  console.log('main.tsx: Creating root');
  const root = createRoot(rootElement);
  
  console.log('main.tsx: Rendering app');
  root.render(
    <StrictMode>
      <Provider store={store}>
        <ThemeProvider theme={theme}>
          <SnackbarProvider maxSnack={3}>
            <CssBaseline />
            <App />
          </SnackbarProvider>
        </ThemeProvider>
      </Provider>
    </StrictMode>
  );
  console.log('main.tsx: Initial render complete');
} catch (error) {
  console.error('main.tsx: Fatal error during initialization:', error);
  
  // Try to render a basic error message
  const rootElement = document.getElementById('root');
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100vh;
        font-family: sans-serif;
        color: #666;
        text-align: center;
      ">
        <h1>Something went wrong</h1>
        <p>Please check the console for more details.</p>
        <pre style="
          margin-top: 20px;
          padding: 20px;
          background: #f5f5f5;
          border-radius: 4px;
          max-width: 800px;
          overflow: auto;
        ">${error instanceof Error ? error.message : 'Unknown error'}</pre>
      </div>
    `;
  }
  
  // Re-throw the error for debugging
  throw error;
}
