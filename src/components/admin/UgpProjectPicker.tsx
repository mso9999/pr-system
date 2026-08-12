import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Typography,
  Box,
  Chip,
  CircularProgress,
} from '@mui/material';
import {
  Search as SearchIcon,
  LocationOn as LocationIcon,
  Folder as ProjectIcon,
} from '@mui/icons-material';
import { ReferenceDataItem, UgpProjectLink } from '@/types/referenceData';

interface UgpProjectWithSource extends UgpProjectLink {
  sourceSiteName: string;
  sourceSiteCode?: string;
  latitude?: number;
  longitude?: number;
}

interface UgpProjectPickerProps {
  open: boolean;
  onClose: () => void;
  sites: ReferenceDataItem[];
  onPick: (project: UgpProjectWithSource) => void;
}

function collectUgpProjects(sites: ReferenceDataItem[]): UgpProjectWithSource[] {
  const seen = new Map<string, UgpProjectWithSource>();
  for (const site of sites) {
    if (!Array.isArray(site.ugpProjects)) continue;
    for (const p of site.ugpProjects) {
      if (!p.ugpProjectId) continue;
      if (seen.has(p.ugpProjectId)) continue;
      seen.set(p.ugpProjectId, {
        ugpProjectId: p.ugpProjectId,
        ugpProjectCode: p.ugpProjectCode,
        ugpProjectName: p.ugpProjectName,
        sourceSiteName: site.name,
        sourceSiteCode: site.code,
        latitude: site.latitude,
        longitude: site.longitude,
      });
    }
  }
  return Array.from(seen.values()).sort((a, b) =>
    (a.ugpProjectName || a.ugpProjectId).localeCompare(b.ugpProjectName || b.ugpProjectId)
  );
}

export function UgpProjectPicker({ open, onClose, sites, onPick }: UgpProjectPickerProps) {
  const [search, setSearch] = useState('');

  const allProjects = useMemo(() => collectUgpProjects(sites), [sites]);

  const filtered = useMemo(() => {
    if (!search.trim()) return allProjects;
    const term = search.trim().toLowerCase();
    return allProjects.filter((p) =>
      p.ugpProjectId.toLowerCase().includes(term) ||
      (p.ugpProjectCode?.toLowerCase().includes(term) ?? false) ||
      (p.ugpProjectName?.toLowerCase().includes(term) ?? false) ||
      p.sourceSiteName.toLowerCase().includes(term)
    );
  }, [allProjects, search]);

  const handlePick = (project: UgpProjectWithSource) => {
    onPick(project);
    setSearch('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Select a UGP Project
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {allProjects.length} project(s) available from existing sites. Selecting one will auto-fill the project link and suggest name/coordinates.
        </Typography>
      </DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          size="small"
          placeholder="Search by project ID, code, name, or site name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 2 }}
        />
        {filtered.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            {allProjects.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No UGP projects found in existing sites. UGP projects appear here after sites are ingested from UGP or linked manually.
              </Typography>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No projects match "{search}".
              </Typography>
            )}
          </Box>
        ) : (
          <List sx={{ maxHeight: 400, overflow: 'auto' }}>
            {filtered.map((project) => (
              <ListItemButton
                key={project.ugpProjectId}
                onClick={() => handlePick(project)}
                sx={{ borderRadius: 1, mb: 0.5 }}
              >
                <ListItemIcon>
                  <ProjectIcon />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Typography variant="body2" fontWeight="bold">
                        {project.ugpProjectName || project.ugpProjectId}
                      </Typography>
                      {project.ugpProjectCode && (
                        <Chip label={project.ugpProjectCode} size="small" variant="outlined" />
                      )}
                    </Box>
                  }
                  secondary={
                    <Box component="span" sx={{ display: 'block', mt: 0.5 }}>
                      <Typography variant="caption" component="span" color="text.secondary">
                        ID: {project.ugpProjectId}
                      </Typography>
                      <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
                        <LocationIcon fontSize="small" color="action" />
                        <Typography variant="caption" component="span" color="text.secondary">
                          From site: {project.sourceSiteName}
                          {project.latitude != null && project.longitude != null
                            ? ` (${project.latitude.toFixed(4)}, ${project.longitude.toFixed(4)})`
                            : ' (no coordinates)'}
                        </Typography>
                      </Box>
                    </Box>
                  }
                />
              </ListItemButton>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
}

export type { UgpProjectWithSource };
