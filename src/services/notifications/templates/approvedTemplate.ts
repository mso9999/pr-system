import { NotificationContext, EmailContent } from './types';
import { generateTable } from './baseTemplate';
import { styles } from './styles';

export function generateApprovedEmail(context: NotificationContext): EmailContent {
  try {
    const { pr, prNumber, user, notes, baseUrl, isUrgent } = context;
    // Always use production URL for notifications
    const prUrl = `https://pr.1pwrafrica.com/pr/${pr.id}`;
    
    const subject = `${isUrgent ? 'URGENT: ' : ''}PR ${prNumber} Has Been Approved`;
    
    const requestorDetails = [
      ['Name', pr.requestor?.firstName && pr.requestor?.lastName ? 
        `${pr.requestor.firstName} ${pr.requestor.lastName}` : 'Not specified'],
      ['Email', pr.requestor?.email || 'Not specified'],
      ['Department', pr.requestor?.department || 'Not specified'],
      ['Site', pr.site || 'Not specified'],
    ];

    const prSummary = [
      ['PR Number', prNumber || 'Not specified'],
      ['Category', pr.category || 'Not specified'],
      ['Expense Type', pr.expenseType || 'Not specified'],
      ['Total Amount', pr.estimatedAmount ? pr.estimatedAmount.toLocaleString('en-US', { 
        style: 'currency', 
        currency: pr.currency || 'USD' 
      }) : 'Not specified'],
      ['Vendor', pr.preferredVendor || 'Not specified'],
      ['Required Date', pr.requiredDate ? new Date(pr.requiredDate).toLocaleDateString() : 'Not specified'],
    ];

    const html = `
      <div style="${styles.container}">
        ${isUrgent ? `<div style="${styles.urgentHeader}">URGENT</div>` : ''}
        <h2 style="${styles.header}">Purchase Request #${prNumber} Has Been Approved</h2>
        
        <div style="${styles.section}">
          <h3 style="${styles.subHeader}">Approval Details</h3>
          <p style="${styles.paragraph}">
            <strong>Approved By:</strong> ${user ? `${user.firstName} ${user.lastName}` : 'System'}
          </p>
          ${notes ? `
            <p style="${styles.paragraph}">
              <strong>Notes:</strong> ${notes}
            </p>
          ` : ''}
        </div>

        <div style="${styles.section}">
          <h3 style="${styles.subHeader}">Requestor Information</h3>
          ${generateTable(requestorDetails.map(item => ({ label: item[0], value: item[1] })))}
        </div>

        <div style="${styles.section}">
          <h3 style="${styles.subHeader}">PR Details</h3>
          ${generateTable(prSummary.map(item => ({ label: item[0], value: item[1] })))}
        </div>

        <div style="${styles.buttonContainer}">
          <a href="${prUrl}" style="${styles.button}">View Purchase Request</a>
        </div>
      </div>
    `;

    const text = `
PR ${prNumber} Has Been Approved

Approved By: ${user ? `${user.firstName} ${user.lastName}` : 'System'}
${notes ? `Notes: ${notes}\n` : ''}

Requestor Information:
${requestorDetails.map(([key, value]) => `${key}: ${value}`).join('\n')}

PR Details:
${prSummary.map(([key, value]) => `${key}: ${value}`).join('\n')}

View PR: ${prUrl}
    `.trim();

    return { subject, html, text };
  } catch (error) {
    console.error('Error generating approved email:', error);
    return {
      subject: 'PR Has Been Approved',
      html: `<p>There was an error generating the email content. Please view the PR for details.</p>`,
      text: 'There was an error generating the email content. Please view the PR for details.'
    };
  }
}
