import React, { useState } from 'react';
import { Button, Card, CardContent, Typography, Alert, Box } from '@mui/material';
import { sendTestEmail } from '@/services/testEmail';

export const TestEmail: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message?: string } | null>(null);

  const handleSendTestEmail = async () => {
    setLoading(true);
    setResult(null);
    
    try {
      const result = await sendTestEmail();
      setResult(result);
    } catch (error) {
      setResult({ success: false, message: `Error: ${error}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card sx={{ maxWidth: 600, margin: '20px auto' }}>
      <CardContent>
        <Typography variant="h5" gutterBottom>
          Test Email Notification
        </Typography>
        
        <Typography variant="body1" paragraph>
          This will send a test email to procurement@1pwrafrica.com to verify that the email notification system is working correctly.
        </Typography>
        
        <Box sx={{ mb: 2 }}>
          <Button 
            variant="contained" 
            onClick={handleSendTestEmail}
            disabled={loading}
            fullWidth
          >
            {loading ? 'Sending...' : 'Send Test Email'}
          </Button>
        </Box>
        
        {result && (
          <Alert severity={result.success ? 'success' : 'error'}>
            {result.message}
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};