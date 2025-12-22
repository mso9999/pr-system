import { PRRequest } from '@/types/pr';
import { FilterCriteria } from '@/components/dashboard/AdvancedFilterPanel';

/**
 * Export filtered PR results to CSV format
 */
export function exportPRsToCSV(prs: PRRequest[], filters: FilterCriteria, baseCurrency: string): void {
  if (prs.length === 0) {
    alert('No data to export');
    return;
  }

  // Calculate analytics
  const totalValue = prs.reduce((sum, pr) => sum + (pr.estimatedAmount || 0), 0);
  const averageValue = prs.length > 0 ? totalValue / prs.length : 0;

  // CSV Header with analytics summary
  const headers = [
    'PR/PO Number',
    'Object Type',
    'Status',
    'Description',
    'Organization',
    'Department',
    'Site',
    'Project Category',
    'Expense Type',
    'Vehicle',
    'Requestor',
    'Requestor Email',
    'Approver',
    'Second Approver',
    'Estimated Amount',
    'Currency',
    'Required Date',
    'Created Date',
    'Last Updated',
    'Urgency',
    'Preferred Vendor',
    'Selected Vendor',
    'Days Open',
    'Notes'
  ];

  // Create CSV content
  let csvContent = '';
  
  // Add analytics summary at the top
  csvContent += `Export Summary\n`;
  csvContent += `Generated: ${new Date().toLocaleString()}\n`;
  csvContent += `Number of Transactions: ${prs.length}\n`;
  csvContent += `Total Transaction Value: ${totalValue.toFixed(2)} ${baseCurrency}\n`;
  csvContent += `Average Transaction Value: ${averageValue.toFixed(2)} ${baseCurrency}\n`;
  csvContent += `\n`;

  // Add active filters
  if (filters) {
    csvContent += `Active Filters:\n`;
    if (filters.searchText) csvContent += `- Search: ${filters.searchText}\n`;
    if (filters.organizations && filters.organizations.length > 0) {
      csvContent += `- Organizations: ${filters.organizations.join(', ')}\n`;
    }
    if (filters.urgency && filters.urgency !== 'all') {
      csvContent += `- Urgency: ${filters.urgency}\n`;
    }
    csvContent += `\n`;
  }

  // Add headers
  csvContent += headers.join(',') + '\n';

  // Add data rows
  prs.forEach(pr => {
    const row = [
      escapeCSV(pr.prNumber || ''),
      escapeCSV(pr.objectType || 'PR'),
      escapeCSV(pr.status || ''),
      escapeCSV(pr.description || ''),
      escapeCSV(pr.organization || ''),
      escapeCSV(pr.department || ''),
      escapeCSV((pr.sites && pr.sites.length > 0 ? pr.sites.join(', ') : (pr.site || ''))),
      escapeCSV(pr.projectCategory || ''),
      escapeCSV(pr.expenseType || ''),
      escapeCSV(pr.vehicle || ''),
      escapeCSV(pr.requestor?.name || pr.requestor?.email || ''),
      escapeCSV(pr.requestorEmail || ''),
      escapeCSV(pr.approver || ''),
      escapeCSV(pr.approver2 || ''),
      pr.estimatedAmount?.toFixed(2) || '0.00',
      escapeCSV(pr.currency || ''),
      escapeCSV(pr.requiredDate || ''),
      escapeCSV(pr.createdAt ? new Date(pr.createdAt).toLocaleDateString() : ''),
      escapeCSV(pr.updatedAt ? new Date(pr.updatedAt).toLocaleDateString() : ''),
      pr.isUrgent ? 'URGENT' : 'NORMAL',
      escapeCSV(pr.preferredVendor || ''),
      escapeCSV(pr.selectedVendor || ''),
      calculateDaysOpen(pr).toString(),
      escapeCSV(pr.notes || '')
    ];
    csvContent += row.join(',') + '\n';
  });

  // Create and download file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `pr_export_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Escape CSV field (handle commas, quotes, and newlines)
 */
function escapeCSV(field: string): string {
  if (!field) return '';
  
  // Convert to string if not already
  let value = String(field);
  
  // If field contains comma, quote, or newline, wrap in quotes and escape internal quotes
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    value = '"' + value.replace(/"/g, '""') + '"';
  }
  
  return value;
}

/**
 * Calculate days a PR has been open
 */
function calculateDaysOpen(pr: PRRequest): number {
  if (!pr.createdAt) return 0;

  const createdDate = new Date(pr.createdAt);
  let endDate: Date;

  // For closed PRs (completed, canceled, rejected), use the appropriate date
  if (pr.status === 'COMPLETED' && pr.completedAt) {
    endDate = new Date(pr.completedAt);
  } else if (pr.status === 'CANCELED' && pr.canceledAt) {
    endDate = new Date(pr.canceledAt);
  } else if (pr.status === 'REJECTED' && pr.rejectedAt) {
    endDate = new Date(pr.rejectedAt);
  } else {
    // For open PRs, use current date
    endDate = new Date();
  }

  const diffTime = Math.abs(endDate.getTime() - createdDate.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

