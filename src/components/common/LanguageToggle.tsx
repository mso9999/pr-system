import React from 'react';
import { useTranslation } from 'react-i18next';
import { Select, MenuItem, FormControl } from '@mui/material';
import { Language as LanguageIcon } from '@mui/icons-material';
import { Box } from '@mui/material';

const LanguageToggle: React.FC = () => {
  const { i18n, t } = useTranslation();

  const handleLanguageChange = (event: any) => {
    const newLanguage = event.target.value;
    i18n.changeLanguage(newLanguage);
    localStorage.setItem('language', newLanguage);
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <LanguageIcon sx={{ color: 'text.secondary' }} />
      <FormControl variant="standard" sx={{ minWidth: 80 }}>
        <Select
          value={i18n.language}
          onChange={handleLanguageChange}
          sx={{
            color: 'text.primary',
            '.MuiSelect-icon': { color: 'text.secondary' }
          }}
        >
          <MenuItem value="en">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <span>🇬🇧</span>
              <span>EN</span>
            </Box>
          </MenuItem>
          <MenuItem value="fr">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <span>🇫🇷</span>
              <span>FR</span>
            </Box>
          </MenuItem>
        </Select>
      </FormControl>
    </Box>
  );
};

export default LanguageToggle;

