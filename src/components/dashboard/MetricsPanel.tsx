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
      console.log('Days open for PR:', {
        id: pr.id,
        prNumber: pr.prNumber,
        createdAt: pr.createdAt,
        daysOpen
      });
      return acc + daysOpen;
    }, 0);
    
    const avgDaysOpen = totalPRs > 0 ? totalDaysOpen / totalPRs : 0;
    
    console.log('Average days calculation:', {
      totalPRs,
      totalDaysOpen,
      avgDaysOpen
    });
    
    const overduePRs = prs.filter(pr => pr.metrics?.isOverdue).length;
    const quotesRequired = prs.filter(pr => pr.metrics?.quotesRequired).length;
    const adjudicationRequired = prs.filter(pr => pr.metrics?.adjudicationRequired).length;
    const customsClearanceRequired = prs.filter(pr => pr.metrics?.customsClearanceRequired).length;
    const avgCompletionRate = prs.reduce((acc, pr) => acc + (pr.metrics?.completionPercentage || 0), 0) / totalPRs || 0;

    return {
      totalPRs,
      urgentPRs,
      avgDaysOpen: Math.round(avgDaysOpen * 10) / 10,
      overduePRs,
      quotesRequired,
      adjudicationRequired,
      customsClearanceRequired,
      completionRate: Math.round(avgCompletionRate)
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
    <Paper sx={{ p: 2, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        {t('dashboard.metrics')}
      </Typography>
      <Grid container spacing={2}>
        <MetricItem label={t('dashboard.totalPRs')} value={metrics.totalPRs} />
        <MetricItem label={t('dashboard.urgent')} value={metrics.urgentPRs} />
        <MetricItem label={t('dashboard.avgDaysOpen')} value={metrics.avgDaysOpen} />
        <MetricItem label={t('dashboard.overdue')} value={metrics.overduePRs} />
        <MetricItem label={t('pr.quotes')} value={metrics.quotesRequired} />
        <MetricItem label={t('pr.adjudicationNotes')} value={metrics.adjudicationRequired} />
        <MetricItem label={t('common.customsRequired')} value={metrics.customsClearanceRequired} />
        <MetricItem label={t('common.completionRate')} value={`${metrics.completionRate}%`} />
      </Grid>
    </Paper>
  );
};
