import { useEffect, useState, useMemo, useRef } from 'react';
import { useSelector } from 'react-redux';
import { Select, MenuItem, FormControl, InputLabel, CircularProgress, FormHelperText } from '@mui/material';
import { referenceDataService } from '../../services/referenceData';
import { ReferenceData } from '@/types/referenceData';
import { RootState } from '@/store';
import {
  normalizeOrganizationId,
  organizationDisplayName,
  organizationMatchesUser,
} from '@/utils/organization';
import { hasPrAction } from '@/utils/prPrivilege';

export const ALL_ORGANIZATIONS_OPTION = { id: 'ALL_ORGS', name: 'All Organizations' };

interface OrganizationSelectorProps {
  value: { id: string; name: string } | null | string;
  onChange: (value: { id: string; name: string }) => void;
  includeAllOption?: boolean;
  restrictToUserOrgs?: boolean; // If true, only show orgs assigned to the user (primary, additional, secondment)
  onOrganizationsLoaded?: (orgs: { id: string; name: string }[]) => void;
  error?: boolean;
  helperText?: string;
}

export const OrganizationSelector = ({ value, onChange, includeAllOption = false, restrictToUserOrgs = false, onOrganizationsLoaded, error, helperText }: OrganizationSelectorProps) => {
  const [organizations, setOrganizations] = useState<ReferenceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [internalError, setInternalError] = useState<string | null>(null);
  const [hasSetDefault, setHasSetDefault] = useState(false);
  const user = useSelector((state: RootState) => state.auth.user);
  
  // Use refs for callbacks to avoid infinite loops in useEffect
  const onChangeRef = useRef(onChange);
  const onOrganizationsLoadedRef = useRef(onOrganizationsLoaded);
  useEffect(() => {
    onChangeRef.current = onChange;
    onOrganizationsLoadedRef.current = onOrganizationsLoaded;
  });

  const canSeeAllOrganizations = Boolean(
    user && (
      hasPrAction(user, 'administer_pr') ||
      hasPrAction(user, 'finance_administration', 'approve_and_finance') ||
      hasPrAction(user, 'process_procurement_queue')
    )
  );
  
  const userOrgIds = useMemo(() => {
    if (!user) return new Set<string>();
    const now = new Date().toISOString().slice(0, 10);
    const activeSecondmentOrgs = (user.secondments || [])
      .filter((s) => {
        if (!s.organizationId) return false;
        const started = !s.startDate || s.startDate <= now;
        const notEnded = !s.endDate || s.endDate >= now;
        return started && notEnded;
      })
      .map((s) => s.organizationId);
    const orgEntries = [
      user.organization,
      ...(user.additionalOrganizations || []),
      ...activeSecondmentOrgs,
    ];
    const normalized = orgEntries
      .map(entry => normalizeOrganizationId(entry as any))
      .filter((id): id is string => Boolean(id));
    return new Set(normalized);
  }, [user]);

  // Normalize value to string for comparison (prevent re-runs on object reference changes)
  const valueId = useMemo(() => {
    if (!value) return null;
    if (typeof value === 'object') return value.id;
    return value;
  }, [value]);

  useEffect(() => {
    const loadOrganizations = async () => {
      try {
        setInternalError(null);
        
        const allOrgs = await referenceDataService.getOrganizations();
        console.log('All organizations loaded:', allOrgs.map(org => ({
          id: org.id,
          name: org.name,
          code: org.code,
          type: org.type
        })));

        if (allOrgs.length === 0) {
          console.error('No organizations found in the database');
          setInternalError('No organizations available');
          setOrganizations([]);
          return;
        }

        allOrgs.sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
        
        // New PR passes restrictToUserOrgs: only primary, additional, and
        // active secondments. SMP appears only if it is one of those.
        // Dashboard (unrestricted) still shows the full catalog to admin /
        // finance / procurement.
        let filteredOrgs;
        if (!user) {
          filteredOrgs = [];
        } else if (!restrictToUserOrgs && canSeeAllOrganizations) {
          filteredOrgs = allOrgs;
        } else {
          filteredOrgs = allOrgs.filter(org => organizationMatchesUser(org, userOrgIds));

          if (filteredOrgs.length === 0) {
            console.error('User has no matching organizations');
            setInternalError('No organizations available for your account');
          }
        }
        
        console.log('Filtered organizations:', filteredOrgs.map(org => ({
          id: org.id,
          name: org.name,
          code: org.code
        })));
        setOrganizations(filteredOrgs);
        onOrganizationsLoadedRef.current?.(filteredOrgs.map(org => ({ id: org.id, name: org.name })));

        // Only set default once to prevent infinite loops
        // Also check if value is already a valid organization to avoid overriding persisted selections
        if (!hasSetDefault) {
          // Check if current value is a valid organization in the filtered list
          const currentValueIsValid = valueId && (
            valueId === ALL_ORGANIZATIONS_OPTION.id ||
            filteredOrgs.some(org =>
              org.id === valueId ||
              org.name === valueId ||
              organizationMatchesUser(org, new Set([String(valueId)]))
            )
          );
          
          console.log('[OrganizationSelector] Default check:', { 
            hasSetDefault, 
            valueId, 
            currentValueIsValid,
            includeAllOption,
            filteredOrgsCount: filteredOrgs.length 
          });
          
          if (currentValueIsValid) {
            // Value is already valid, don't override
            console.log('[OrganizationSelector] Current value is valid, not overriding:', valueId);
            setHasSetDefault(true);
          } else if (!valueId) {
            // No value set, apply defaults
            const shouldDefaultToAll = includeAllOption;

            if (shouldDefaultToAll) {
              console.log('[OrganizationSelector] Setting default organization to ALL');
              setHasSetDefault(true);
              onChangeRef.current(ALL_ORGANIZATIONS_OPTION);
              return;
            }

            // Set default organization if no value is selected and user has an organization
            if (user?.organization && filteredOrgs.length > 0) {
              // Try to find org by normalized ID
              const targetId = normalizeOrganizationId(user.organization as any);
              const userOrg = filteredOrgs.find(org => organizationMatchesUser(org, new Set([targetId])));
              
              if (userOrg) {
                console.log('[OrganizationSelector] Setting default organization:', userOrg);
                setHasSetDefault(true);
                onChangeRef.current({ id: userOrg.id, name: userOrg.name });
              }
            }
          }
        }
      } catch (error) {
        console.error('Error loading organizations:', error);
        setInternalError('Failed to load organizations');
        setOrganizations([]);
      } finally {
        setLoading(false);
      }
    };
    loadOrganizations();
    // Only re-run when user changes - not when value or callbacks change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, userOrgIds, includeAllOption, canSeeAllOrganizations, restrictToUserOrgs]);

  const organizationOptions = useMemo(() => {
    if (includeAllOption) {
      return [ALL_ORGANIZATIONS_OPTION, ...organizations];
    }
    return organizations;
  }, [includeAllOption, organizations]);

  // Select value is the catalog document id so short names like "SMP" cannot
  // collide with an unmatched stored name vs id (SMP vs smp).
  const selectValue = useMemo(() => {
    if (!value) return '';
    if (typeof value === 'object') {
      if (value.id === ALL_ORGANIZATIONS_OPTION.id || value.name === ALL_ORGANIZATIONS_OPTION.name) {
        return ALL_ORGANIZATIONS_OPTION.id;
      }
    } else if (value === ALL_ORGANIZATIONS_OPTION.id || value === ALL_ORGANIZATIONS_OPTION.name) {
      return ALL_ORGANIZATIONS_OPTION.id;
    }
    const raw = typeof value === 'object' ? (value.id || value.name) : value;
    const match = organizationOptions.find((org) =>
      org.id === raw ||
      org.name === raw ||
      organizationMatchesUser(org, new Set([String(raw)]))
    );
    return match ? match.id : '';
  }, [value, organizationOptions]);

  if (loading) {
    return <CircularProgress size={24} />;
  }

  return (
    <FormControl fullWidth error={!!error || !!internalError}>
      <InputLabel id="organization-label">Organization</InputLabel>
      <Select
        labelId="organization-label"
        id="organization-select"
        value={selectValue}
        label="Organization"
        onChange={(e) => {
          if (includeAllOption && e.target.value === ALL_ORGANIZATIONS_OPTION.id) {
            console.log('Organization selected: ALL');
            onChange(ALL_ORGANIZATIONS_OPTION);
            return;
          }
          const selectedOrg = organizations.find(org => org.id === e.target.value)
            || organizations.find(org => organizationMatchesUser(org, new Set([String(e.target.value)])));
          if (selectedOrg) {
            console.log('Organization selected:', selectedOrg);
            onChange({ id: selectedOrg.id, name: selectedOrg.name });
          }
        }}
      >
        {organizationOptions.map((org) => (
          <MenuItem key={org.id} value={org.id}>
            {organizationDisplayName(org)}
          </MenuItem>
        ))}
      </Select>
      {(internalError && <FormHelperText error>{internalError}</FormHelperText>) || 
       (error && helperText && <FormHelperText error>{helperText}</FormHelperText>) || 
       (helperText && <FormHelperText>{helperText}</FormHelperText>)}
    </FormControl>
  );
};
