import { useTheme } from '@mui/material/styles';
import { useMediaQuery } from '@mui/material';

/**
 * Custom hook for responsive breakpoint detection
 * Provides consistent breakpoint detection across all components
 * 
 * @returns Object with boolean flags for different screen sizes
 */
export const useResponsive = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const isSmallMobile = useMediaQuery(theme.breakpoints.down(400));
  
  return { isMobile, isTablet, isDesktop, isSmallMobile };
};

