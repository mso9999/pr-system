import { getPRSystemUrl } from '@/config/environment';

/**
 * Generates a link to view a PR in the system
 * Always uses production URL (pr.1pwrafrica.com) for notifications
 */
export function generatePRLink(prId: string): string {
  const baseUrl = getPRSystemUrl();
  return `${baseUrl}/pr/${prId}`;
}

/**
 * Formats a date for display
 */
export function formatDate(date: string | Date): string {
  if (!date) return 'Not specified';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Formats currency amount
 */
export function formatAmount(amount: number, currency: string): string {
  if (!amount) return 'Not specified';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD'
  }).format(amount);
}
