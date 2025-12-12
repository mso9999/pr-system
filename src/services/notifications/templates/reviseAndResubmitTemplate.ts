import { NotificationContext, EmailContent } from '../types';
import { generateEmailHeaders } from '../types/emailHeaders';
import { generateTable } from './baseTemplate';
import { styles } from './styles';

export function generateReviseAndResubmitEmail(context: NotificationContext): EmailContent {
  const { pr, prNumber, isUrgent, notes, baseUrl } = context;
  // Always use production URL for notifications
  const prUrl = `https://pr.1pwrafrica.com/pr/${pr.id}`;
  
  const subject = `${isUrgent ? 'URGENT: ' : ''}PR ${prNumber} Status Changed: SUBMITTED → REVISION_REQUIRED`;
  
  const prDetails = [
    ['Requestor', `${pr.requestor.firstName} ${pr.requestor.lastName}`],
    ['Category', pr.category],
    ['Expense Type', pr.expenseType],
    ['Site', pr.site],
    ['Amount', pr.amount.toLocaleString('en-US', { style: 'currency', currency: pr.currency })],
    ['Vendor', pr.vendor || 'Not specified'],
    ['Required Date', new Date(pr.requiredDate).toLocaleDateString()],
    ['PR Link', prUrl]
  ];

  const html = `
    <div style="${styles.container}">
      <h2 style="${styles.header}">Purchase Request #${prNumber} Requires Revisions</h2>
      ${generateTable('PR Details', prDetails)}
      ${notes ? `<div style="${styles.notes}"><strong>Revision Instructions:</strong> ${notes}</div>` : ''}
      <div style="${styles.actions}">
        <a href="${prUrl}" style="${styles.button}">View PR</a>
      </div>
    </div>
  `;

  const text = `
PR #${prNumber} Requires Revisions

PR Details:
${prDetails.map(([key, value]) => `${key}: ${value}`).join('\n')}

${notes ? `\nRevision Instructions: ${notes}` : ''}

View PR: ${prUrl}
  `.trim();

  return {
    headers: generateEmailHeaders({
      prId: pr.id,
      prNumber,
      subject,
      notificationType: 'revise-and-resubmit'
    }),
    subject,
    html,
    text,
    boundary: 'boundary-' + Date.now()
  };
}
