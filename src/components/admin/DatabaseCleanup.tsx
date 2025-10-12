import React, { useState } from 'react';
import {
  Box,
  Button,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  Paper,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import WarningIcon from '@mui/icons-material/Warning';
import { db } from '@/config/firebase';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { useSnackbar } from 'notistack';

export function DatabaseCleanup() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState<string[]>([]);
  const { enqueueSnackbar } = useSnackbar();

  const handleOpenDialog = () => {
    setIsDialogOpen(true);
    setConfirmText('');
    setDeleteProgress([]);
  };

  const handleCloseDialog = () => {
    if (!isDeleting) {
      setIsDialogOpen(false);
      setConfirmText('');
    }
  };

  const deleteCollection = async (collectionName: string): Promise<number> => {
    const collectionRef = collection(db, collectionName);
    const snapshot = await getDocs(collectionRef);
    
    if (snapshot.empty) {
      setDeleteProgress(prev => [...prev, `  ℹ️  Collection '${collectionName}' is already empty`]);
      return 0;
    }
    
    setDeleteProgress(prev => [...prev, `  🗑️  Deleting ${snapshot.size} documents from '${collectionName}'...`]);
    
    const deletePromises: Promise<void>[] = [];
    let deletedCount = 0;
    
    snapshot.forEach((document) => {
      deletePromises.push(deleteDoc(doc(db, collectionName, document.id)));
      deletedCount++;
    });
    
    await Promise.all(deletePromises);
    
    setDeleteProgress(prev => [...prev, `  ✅ Deleted ${deletedCount} documents from '${collectionName}'`]);
    return deletedCount;
  };

  const handleCleanup = async () => {
    if (confirmText !== 'DELETE ALL') {
      enqueueSnackbar('Please type "DELETE ALL" to confirm', { variant: 'error' });
      return;
    }

    setIsDeleting(true);
    setDeleteProgress(['Starting cleanup process...']);
    
    const startTime = Date.now();
    let totalDeleted = 0;

    try {
      // Delete Purchase Requests
      setDeleteProgress(prev => [...prev, '\n1️⃣  Cleaning up Purchase Requests...']);
      const prCount = await deleteCollection('purchaseRequests');
      totalDeleted += prCount;
      
      // Delete PR Notifications
      setDeleteProgress(prev => [...prev, '\n2️⃣  Cleaning up PR Notifications...']);
      const prNotifCount = await deleteCollection('purchaseRequestsNotifications');
      totalDeleted += prNotifCount;
      
      // Delete General Notifications
      setDeleteProgress(prev => [...prev, '\n3️⃣  Cleaning up General Notifications...']);
      const notifCount = await deleteCollection('notifications');
      totalDeleted += notifCount;
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      setDeleteProgress(prev => [
        ...prev,
        '\n' + '='.repeat(50),
        '✅ CLEANUP COMPLETED SUCCESSFULLY',
        '='.repeat(50),
        `\nSummary:`,
        `  • Total documents deleted: ${totalDeleted}`,
        `  • Purchase Requests: ${prCount}`,
        `  • PR Notifications: ${prNotifCount}`,
        `  • General Notifications: ${notifCount}`,
        `  • Time taken: ${duration}s`,
        '\n✨ Database is now clean and ready for fresh testing!'
      ]);
      
      enqueueSnackbar(`Successfully deleted ${totalDeleted} documents`, { variant: 'success' });
      
      // Auto-close after 3 seconds
      setTimeout(() => {
        setIsDialogOpen(false);
        setIsDeleting(false);
        // Reload page to refresh data
        window.location.reload();
      }, 3000);
      
    } catch (error) {
      console.error('Error during cleanup:', error);
      setDeleteProgress(prev => [...prev, `\n❌ Error: ${error instanceof Error ? error.message : String(error)}`]);
      enqueueSnackbar('Cleanup failed', { variant: 'error' });
      setIsDeleting(false);
    }
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <WarningIcon color="error" sx={{ mr: 1, fontSize: 32 }} />
        <Typography variant="h6">Danger Zone</Typography>
      </Box>
      
      <Alert severity="error" sx={{ mb: 2 }}>
        <strong>Warning:</strong> This action will permanently delete ALL Purchase Requests and related data from the database. This operation cannot be undone!
      </Alert>
      
      <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
        Use this only for testing purposes to clear out test data and start fresh.
      </Typography>
      
      <Typography variant="body2" sx={{ mb: 2 }}>
        <strong>What will be deleted:</strong>
      </Typography>
      <List dense sx={{ mb: 2 }}>
        <ListItem>
          <ListItemText primary="• All Purchase Requests (all statuses)" />
        </ListItem>
        <ListItem>
          <ListItemText primary="• All PR Notifications" />
        </ListItem>
        <ListItem>
          <ListItemText primary="• All General Notifications" />
        </ListItem>
      </List>
      
      <Button
        variant="contained"
        color="error"
        startIcon={<DeleteForeverIcon />}
        onClick={handleOpenDialog}
        size="large"
      >
        Delete All PRs
      </Button>
      
      <Dialog
        open={isDialogOpen}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ color: 'error.main', display: 'flex', alignItems: 'center' }}>
          <WarningIcon sx={{ mr: 1 }} />
          Confirm Database Cleanup
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            <strong>⚠️ THIS OPERATION CANNOT BE UNDONE! ⚠️</strong>
          </DialogContentText>
          
          <DialogContentText sx={{ mb: 2 }}>
            This will permanently delete ALL Purchase Requests and related notifications from the database.
          </DialogContentText>
          
          {deleteProgress.length > 0 ? (
            <Paper 
              sx={{ 
                p: 2, 
                bgcolor: '#000', 
                color: '#0f0', 
                fontFamily: 'monospace', 
                fontSize: '12px',
                maxHeight: '400px',
                overflowY: 'auto',
                mb: 2
              }}
            >
              {deleteProgress.map((line, index) => (
                <div key={index}>{line}</div>
              ))}
            </Paper>
          ) : (
            <>
              <DialogContentText sx={{ mb: 2 }}>
                To confirm, type <strong>DELETE ALL</strong> in the box below:
              </DialogContentText>
              
              <TextField
                fullWidth
                label="Type DELETE ALL to confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                disabled={isDeleting}
                error={confirmText !== '' && confirmText !== 'DELETE ALL'}
                helperText={confirmText !== '' && confirmText !== 'DELETE ALL' ? 'Must type exactly: DELETE ALL' : ''}
                sx={{ mb: 2 }}
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={handleCloseDialog} 
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCleanup}
            color="error"
            variant="contained"
            disabled={confirmText !== 'DELETE ALL' || isDeleting}
            startIcon={isDeleting ? <CircularProgress size={20} /> : <DeleteForeverIcon />}
          >
            {isDeleting ? 'Deleting...' : 'Delete All Data'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}

