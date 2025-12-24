import { Grid, Paper, Typography } from '@mui/material';
import { PRRequest } from '../../types/pr';
import { calculateDaysOpen } from '../../utils/formatters';
import { useTranslation } from 'react-i18next';

interface MetricsPanelProps {
  prs: PRRequest[];
}

export const MetricsPanel = ({ prs }: MetricsPanelProps) => {
  const { t } = useTranslation();
  const calculateMetrics = () => {
    const totalPRs = prs.length;
    console.log('MetricsPanel - PRs:', prs.map(pr => ({
      id: pr.id,
      prNumber: pr.prNumber,
      isUrgent: pr.isUrgent,
      status: pr.status,
      createdAt: pr.createdAt
    })));
    
    const urgentPRs = prs.filter(pr => Boolean(pr.isUrgent)).length;
    console.log('MetricsPanel - Urgent PRs count:', {
      total: totalPRs,
      urgent: urgentPRs,
      urgentPRs: prs.filter(pr => Boolean(pr.isUrgent)).map(pr => ({
        id: pr.id,
        prNumber: pr.prNumber,
        isUrgent: pr.isUrgent
      }))
    });
    
    // Calculate average days open dynamically
    const totalDaysOpen = prs.reduce((acc, pr) => {
      const daysOpen = calculateDaysOpen(pr.createdAt);
      // Debug logging (development only)
      if (import.meta.env.MODE === 'development') {
        console.log('Days open for PR:', {
          id: pr.id,
          prNumber: pr.prNumber,
          createdAt: pr.createdAt,
          daysOpen
        });
      }
      return acc + daysOpen;
    }, 0);
    
    const avgDaysOpen = totalPRs > 0 ? totalDaysOpen / totalPRs : 0;
    
    // Debug logging (development only)
    if (import.meta.env.MODE === 'development') {
      console.log('Average days calculation:', {
        totalPRs,
        totalDaysOpen,
        avgDaysOpen
      });
    }
    
    const overduePRs = prs.filter(pr => pr.metrics?.isOverdue).length;

    return {
      totalPRs,
      urgentPRs,
      avgDaysOpen: Math.round(avgDaysOpen * 10) / 10,
      overduePRs
    };
  };

  const metrics = calculateMetrics();

  const MetricItem = ({ label, value }: { label: string; value: number | string }) => (
    <Grid item xs={12} sm={6} md={3}>
      <Paper sx={{ 
        p: 1.5, 
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <Typography variant="body1" color="textSecondary">
          {label}
        </Typography>
        <Typography variant="h6" sx={{ ml: 1 }}>
          {value}
        </Typography>
      </Paper>
    </Grid>
  );

  return (
    <Paper sx={{ p: { xs: 1.5, sm: 2 }, mb: 3 }}>
      <Typography variant="h6" gutterBottom sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
        {t('dashboard.metrics')}
      </Typography>
      <Grid container spacing={{ xs: 1.5, sm: 2 }}>
        <MetricItem label={t('dashboard.totalPRs')} value={metrics.totalPRs} />
        <MetricItem label={t('dashboard.urgent')} value={metrics.urgentPRs} />
        <MetricItem label={t('dashboard.avgDaysOpen')} value={metrics.avgDaysOpen} />
        <MetricItem label={t('dashboard.overdue')} value={metrics.overduePRs} />
      </Grid>
    </Paper>
  );
};
