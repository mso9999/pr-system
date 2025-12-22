import { NotificationContext, EmailContent } from './types';
import { generateTable, formatSites } from './baseTemplate';
import { styles } from './styles';

export function generatePendingApprovalEmail(context: NotificationContext): EmailContent {
  try {
    const { pr, prNumber, user, notes, baseUrl, isUrgent } = context;
    // Always use production URL for notifications
    const prUrl = `https://pr.1pwrafrica.com/pr/${pr.id}`;
    
    const subject = `${isUrgent ? 'URGENT: ' : ''}PR ${prNumber} Awaiting Your Approval`;
    
    const requestorDetails = [
      ['Name', pr.requestor?.firstName && pr.requestor?.lastName ? 
        `${pr.requestor.firstName} ${pr.requestor.lastName}` : 'Not specified'],
      ['Email', pr.requestor?.email || 'Not specified'],
      ['Department', pr.requestor?.department || 'Not specified'],
      ['Site', formatSites(pr)],
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

    const htmlContent = `
      <div style="${styles.container}">
        <div style="${styles.header}">
          <h1 style="${styles.headerText}">${isUrgent ? 'URGENT: ' : ''}Purchase Requisition Approval Required</h1>
        </div>
        
        <div style="${styles.body}">
          <p style="${styles.paragraph}">Dear ${user?.firstName || 'Approver'},</p>
          
          <p style="${styles.paragraph}">
            A purchase requisition (${prNumber}) requires your approval.
            Please review the details below and take action by clicking the button at the bottom of this email.
          </p>
          
          <div style="${styles.section}">
            <h2 style="${styles.sectionTitle}">Requestor Information</h2>
            ${generateTable(requestorDetails.map(item => ({ label: item[0], value: item[1] })))}
          </div>
          
          <div style="${styles.section}">
            <h2 style="${styles.sectionTitle}">Purchase Requisition Summary</h2>
            ${generateTable(prSummary.map(item => ({ label: item[0], value: item[1] })))}
          </div>
          
          ${notes ? `
            <div style="${styles.notesSection}">
              <h3 style="${styles.notesTitle}">Additional Notes</h3>
              <p style="${styles.notesParagraph}">${notes}</p>
            </div>
          ` : ''}
          
          <div style="${styles.buttonContainer}">
            <a href="${prUrl}" style="${styles.button}">View Purchase Requisition</a>
          </div>
          
          <p style="${styles.paragraph}">
            If you need additional information before making a decision, please contact the requestor directly.
          </p>

          <p style="${styles.smallText}">
            Note: This email has been copied to the requestor and the procurement team.
          </p>
          
          <p style="${styles.paragraph}">
            Thank you,<br />
            1PWR Procurement System
          </p>
        </div>
        
        <div style="${styles.footer}">
          <p style="${styles.footerText}">
            This is an automated message from the 1PWR Procurement System. Please do not reply to this email.
          </p>
        </div>
      </div>
    `;

    const text = `
PR ${prNumber} Awaiting Your Approval

Dear ${user?.firstName || 'Approver'},

A purchase requisition (${prNumber}) requires your approval.
Please review the details below and take action by clicking the button at the bottom of this email.

Requestor Information:
${requestorDetails.map(([key, value]) => `${key}: ${value}`).join('\n')}

Purchase Requisition Summary:
${prSummary.map(([key, value]) => `${key}: ${value}`).join('\n')}

${notes ? `Additional Notes: ${notes}\n` : ''}

View Purchase Requisition: ${prUrl}

If you need additional information before making a decision, please contact the requestor directly.

Note: This email has been copied to the requestor and the procurement team.

Thank you,
1PWR Procurement System
    `.trim();

    return { subject, html: htmlContent, text };
  } catch (error) {
    console.error('Error generating pending approval email:', error);
    return {
      subject: 'PR Awaiting Your Approval',
      html: `<p>There was an error generating the email content. Please view the PR for details.</p>`,
      text: 'There was an error generating the email content. Please view the PR for details.'
    };
  }
}
