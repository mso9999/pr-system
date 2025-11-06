/**
 * @fileoverview Company Logo Component
 * @description Displays the 1PWR Africa logo in the header (non-obtrusive)
 * Logo is hardcoded for the entire group, not per subsidiary
 */

import React from 'react';
import { Box } from '@mui/material';

// Hardcoded 1PWR Africa logo URL for the entire group
const LOGO_URL = 'https://1pwrafrica.com/wp-content/uploads/2018/11/logo.png';

export const CompanyLogo: React.FC = () => {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
      }}
    >
      <img
        src={LOGO_URL}
        alt="1PWR Africa"
        style={{
          maxHeight: '50px',
          maxWidth: '180px',
          objectFit: 'contain',
        }}
        onError={(e) => {
          // Hide image if it fails to load
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
    </Box>
  );
};

