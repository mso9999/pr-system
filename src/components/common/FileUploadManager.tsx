/**
 * @fileoverview Reusable File Upload Manager Component
 * @description Handles multiple file uploads with preview, delete, and download functionality
 */

import React, { useState } from 'react';
import {
  Box,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Typography,
  CircularProgress,
  Tooltip,
  Paper,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  InsertDriveFile as FileIcon,
} from '@mui/icons-material';
import { Attachment } from '@/types/pr';
import { formatFileSize } from '@/utils/formatters';

interface FileUploadManagerProps {
  /** Label for the upload section */
  label: string;
  /** Currently uploaded files */
  files: Attachment[];
  /** Callback when files are uploaded */
  onUpload: (files: File[]) => Promise<void>;
  /** Callback when a file is deleted */
  onDelete: (attachmentId: string) => Promise<void>;
  /** Whether uploads are currently in progress */
  uploading?: boolean;
  /** Whether the component is disabled */
  disabled?: boolean;
  /** Accept attribute for file input */
  accept?: string;
  /** Maximum number of files allowed */
  maxFiles?: number;
  /** Helper text to display */
  helperText?: string;
  /** Whether to allow multiple files in one upload */
  multiple?: boolean;
}

export const FileUploadManager: React.FC<FileUploadManagerProps> = ({
  label,
  files,
  onUpload,
  onDelete,
  uploading = false,
  disabled = false,
  accept,
  maxFiles,
  helperText,
  multiple = true,
}) => {
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    const filesArray = Array.from(selectedFiles);
    
    // Check max files limit
    if (maxFiles && files.length + filesArray.length > maxFiles) {
      alert(`Maximum ${maxFiles} file(s) allowed`);
      return;
    }

    await onUpload(filesArray);
    
    // Reset input
    event.target.value = '';
  };

  const handleDelete = async (attachmentId: string) => {
    if (!confirm('Are you sure you want to delete this file?')) return;
    
    setDeleting(attachmentId);
    try {
      await onDelete(attachmentId);
    } finally {
      setDeleting(null);
    }
  };

  const handleDownload = (file: Attachment) => {
    window.open(file.url, '_blank');
  };

  const canUploadMore = !maxFiles || files.length < maxFiles;

  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom>
        {label}
      </Typography>

      {/* File List */}
      {files.length > 0 && (
        <Paper variant="outlined" sx={{ mb: 2, maxHeight: 300, overflow: 'auto' }}>
          <List dense>
            {files.map((file) => (
              <ListItem key={file.id}>
                <FileIcon sx={{ mr: 1, color: 'text.secondary' }} />
                <ListItemText
                  primary={file.name}
                  secondary={
                    <>
                      {formatFileSize(file.size)}
                      {file.uploadedAt && (
                        <> • Uploaded {new Date(file.uploadedAt).toLocaleString()}</>
                      )}
                      {file.uploadedBy && <> • by {file.uploadedBy.email}</>}
                    </>
                  }
                />
                <ListItemSecondaryAction>
                  <Tooltip title="Download">
                    <IconButton
                      edge="end"
                      size="small"
                      onClick={() => handleDownload(file)}
                      sx={{ mr: 1 }}
                    >
                      <DownloadIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton
                      edge="end"
                      size="small"
                      onClick={() => handleDelete(file.id)}
                      disabled={disabled || deleting === file.id}
                    >
                      {deleting === file.id ? (
                        <CircularProgress size={20} />
                      ) : (
                        <DeleteIcon fontSize="small" />
                      )}
                    </IconButton>
                  </Tooltip>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </Paper>
      )}

      {/* Upload Button */}
      {canUploadMore && (
        <Box>
          <input
            accept={accept}
            style={{ display: 'none' }}
            id={`file-upload-${label.replace(/\s+/g, '-').toLowerCase()}`}
            multiple={multiple}
            type="file"
            onChange={handleFileChange}
            disabled={disabled || uploading}
          />
          <label htmlFor={`file-upload-${label.replace(/\s+/g, '-').toLowerCase()}`}>
            <Button
              variant="outlined"
              component="span"
              startIcon={uploading ? <CircularProgress size={20} /> : <UploadIcon />}
              disabled={disabled || uploading}
              fullWidth
            >
              {uploading ? 'Uploading...' : `Upload ${label}`}
            </Button>
          </label>
          {helperText && (
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
              {helperText}
            </Typography>
          )}
          {maxFiles && (
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
              {files.length} of {maxFiles} file(s) uploaded
            </Typography>
          )}
        </Box>
      )}

      {!canUploadMore && (
        <Typography variant="body2" color="text.secondary">
          Maximum number of files reached
        </Typography>
      )}
    </Box>
  );
};

