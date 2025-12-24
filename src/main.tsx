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
const FRONTEND_VERSION = '1.0.0';
console.log('=== Application Starting ===');
console.log(`Frontend Version: ${FRONTEND_VERSION}`);
console.log(`Build Date: ${new Date().toISOString()}`);

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
