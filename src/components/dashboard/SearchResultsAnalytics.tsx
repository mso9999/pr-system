import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Button,
  Divider,
} from '@mui/material';
import { 
  FileDownload as DownloadIcon,
  Receipt as ReceiptIcon,
  AttachMoney as MoneyIcon,
  TrendingUp as TrendingIcon,
} from '@mui/icons-material';
import { PRRequest } from '@/types/pr';
import { formatCurrency } from '@/utils/formatters';

interface SearchResultsAnalyticsProps {
  filteredPRs: PRRequest[];
  baseCurrency: string;
  onExport: () => void;
}

export const SearchResultsAnalytics: React.FC<SearchResultsAnalyticsProps> = ({
  filteredPRs,
  baseCurrency,
  onExport,
}) => {
  // Calculate analytics
  const numberOfTransactions = filteredPRs.length;
  
  const totalValue = filteredPRs.reduce((sum, pr) => {
    // TODO: Convert to base currency if different
    return sum + (pr.estimatedAmount || 0);
  }, 0);
  
  const averageValue = numberOfTransactions > 0 ? totalValue / numberOfTransactions : 0;

  // Check if multiple currencies are present
  const currencies = new Set(filteredPRs.map(pr => pr.currency).filter(Boolean));
  const hasMultipleCurrencies = currencies.size > 1;

  return (
    <Box sx={{ mb: 2 }}>
      <Grid container spacing={2}>
        {/* Number of Transactions */}
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ReceiptIcon color="primary" />
                <Box>
                  <Typography variant="caption" color="textSecondary">
                    Transactions
                  </Typography>
                  <Typography variant="h5" fontWeight="bold">
                    {numberOfTransactions}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Total Transaction Value */}
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <MoneyIcon color="success" />
                <Box>
                  <Typography variant="caption" color="textSecondary">
                    Total Value
                  </Typography>
                  <Typography variant="h5" fontWeight="bold">
                    {formatCurrency(totalValue, baseCurrency)}
                  </Typography>
                  {hasMultipleCurrencies && (
                    <Typography variant="caption" color="warning.main">
                      Multiple currencies
                    </Typography>
                  )}
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Average Transaction Value */}
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TrendingIcon color="info" />
                <Box>
                  <Typography variant="caption" color="textSecondary">
                    Average Value
                  </Typography>
                  <Typography variant="h5" fontWeight="bold">
                    {formatCurrency(averageValue, baseCurrency)}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Export Button */}
        <Grid item xs={12} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <Button
                variant="contained"
                startIcon={<DownloadIcon />}
                onClick={onExport}
                fullWidth
              >
                Export to CSV
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

