import { useEffect, useState, useMemo, useRef } from 'react';
import { useSelector } from 'react-redux';
import { Select, MenuItem, FormControl, InputLabel, CircularProgress, FormHelperText } from '@mui/material';
import { referenceDataService } from '../../services/referenceData';
import { ReferenceData } from '@/types/referenceData';
import { RootState } from '@/store';
import { normalizeOrganizationId, organizationMatchesUser } from '@/utils/organization';

export const ALL_ORGANIZATIONS_OPTION = { id: 'ALL_ORGS', name: 'All Organizations' };

interface OrganizationSelectorProps {
  value: { id: string; name: string } | null | string;
  onChange: (value: { id: string; name: string }) => void;
  includeAllOption?: boolean;
  restrictToUserOrgs?: boolean; // If true, only show user's assigned organizations (primary + additional)
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
  
  const userOrgIds = useMemo(() => {
    if (!user) return new Set<string>();
    const orgEntries = [
      user.organization,
      ...(user.additionalOrganizations || [])
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
        
        // Filter organizations based on user role and permission level
        let filteredOrgs;
        if (!user) {
          filteredOrgs = [];
        } else {
          // If restrictToUserOrgs is true, always filter to user's assigned organizations
          if (restrictToUserOrgs) {
            filteredOrgs = allOrgs.filter(org => organizationMatchesUser(org, userOrgIds));
            if (filteredOrgs.length === 0) {
              console.error('User has no matching organizations');
              setInternalError('No organizations available for your account');
            }
          } else {
            // Normalize permission level to number
            const permissionLevel = typeof user.permissionLevel === 'number' 
              ? user.permissionLevel 
              : Number(user.permissionLevel) || 0;
            
            // Superadmin (level 1), Admin role, Finance Admin (level 4), and Procurement (level 3) see all orgs
            if (
              permissionLevel === 1 || // Superadmin
              user.role === 'ADMIN' || 
              user.role === 'FINANCE_ADMIN' || 
              user.role === 'PROCUREMENT' ||
              permissionLevel === 3 || // Procurement
              permissionLevel === 4    // Finance Admin
            ) {
              filteredOrgs = allOrgs;
            } else {
              // Approvers and Requestors see their primary org and additional orgs
              filteredOrgs = allOrgs.filter(org => organizationMatchesUser(org, userOrgIds));

              if (filteredOrgs.length === 0) {
                console.error('User has no matching organizations');
                setInternalError('No organizations available for your account');
              }
            }
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
            filteredOrgs.some(org => org.id === valueId || org.name === valueId)
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
              const userOrg = filteredOrgs.find(org => normalizeOrganizationId(org) === targetId);
              
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
  }, [user, userOrgIds, restrictToUserOrgs, includeAllOption]);

  // Convert organization object or string to display value
  const organizationOptions = useMemo(() => {
    if (includeAllOption) {
      return [ALL_ORGANIZATIONS_OPTION, ...organizations];
    }
    return organizations;
  }, [includeAllOption, organizations]);

  const displayValue = useMemo(() => {
    if (!value) return '';
    if (typeof value === 'object') return value.name;
    
    // If value is a string, try to find matching organization
    if (value === ALL_ORGANIZATIONS_OPTION.id || value === ALL_ORGANIZATIONS_OPTION.name) {
      return ALL_ORGANIZATIONS_OPTION.name;
    }
    const normalizedValue = normalizeOrganizationId(value as any);
    const org = organizations.find(o => 
      o.id === value || 
      o.name === value || 
      normalizeOrganizationId(o) === normalizedValue
    );
    return org ? org.name : value;
  }, [value, organizations]);

  if (loading) {
    return <CircularProgress size={24} />;
  }

  return (
    <FormControl fullWidth error={!!error || !!internalError}>
      <InputLabel id="organization-label">Organization</InputLabel>
      <Select
        labelId="organization-label"
        id="organization-select"
        value={displayValue}
        label="Organization"
        onChange={(e) => {
          // Find the selected organization object
          if (includeAllOption && e.target.value === ALL_ORGANIZATIONS_OPTION.name) {
            console.log('Organization selected: ALL');
            onChange(ALL_ORGANIZATIONS_OPTION);
            return;
          }
          const selectedOrg = organizations.find(org => org.name === e.target.value);
          if (selectedOrg) {
            console.log('Organization selected:', selectedOrg);
            onChange({ id: selectedOrg.id, name: selectedOrg.name });
          }
        }}
      >
        {organizationOptions.map((org) => (
          <MenuItem key={org.id} value={org.name}>
            {org.name}
          </MenuItem>
        ))}
      </Select>
      {(internalError && <FormHelperText error>{internalError}</FormHelperText>) || 
       (error && helperText && <FormHelperText error>{helperText}</FormHelperText>) || 
       (helperText && <FormHelperText>{helperText}</FormHelperText>)}
    </FormControl>
  );
};
