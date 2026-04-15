import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Box, Typography, Button } from '@mui/material';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    console.error('ErrorBoundary: React error caught:', error);
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary: Uncaught error:', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      componentStack: errorInfo.componentStack
    });

    const isChunkError =
      error.message.includes('Failed to fetch dynamically imported module') ||
      error.message.includes('Loading chunk') ||
      error.message.includes('Loading CSS chunk');

    if (isChunkError) {
      const reloadKey = 'chunk_error_reload';
      const lastReload = sessionStorage.getItem(reloadKey);
      const now = Date.now();
      if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
        sessionStorage.setItem(reloadKey, String(now));
        window.location.reload();
        return;
      }
    }

    if (error instanceof TypeError) {
      console.error('ErrorBoundary: Type error detected. This might be due to undefined props or invalid data types.');
    } else if (error.message.includes('Firebase')) {
      console.error('ErrorBoundary: Firebase-related error detected. Check Firebase initialization and configuration.');
    } else if (error.message.includes('undefined is not an object')) {
      console.error('ErrorBoundary: Null/undefined object access detected. Check for missing props or uninitialized state.');
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ p: 3, textAlign: 'center', maxWidth: 600, mx: 'auto' }}>
          <Typography variant="h5" color="error" gutterBottom>
            Application Error
          </Typography>
          <Typography color="textSecondary" sx={{ mb: 2 }}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </Typography>
          {this.state.error?.stack && (
            <Box 
              sx={{ 
                mt: 2, 
                p: 2, 
                bgcolor: 'grey.100', 
                borderRadius: 1,
                textAlign: 'left',
                overflow: 'auto',
                maxHeight: 200
              }}
            >
              <Typography variant="caption" component="pre" sx={{ fontFamily: 'monospace' }}>
                {this.state.error.stack}
              </Typography>
            </Box>
          )}
          <Button
            variant="contained"
            onClick={() => {
              console.log('ErrorBoundary: Attempting page reload');
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            sx={{ mt: 3 }}
          >
            Reload Application
          </Button>
        </Box>
      );
    }

    return this.props.children;
  }
}
