import { EmailContent, NotificationContext } from '../types';
import { generateEmailHeaders } from '../types/emailHeaders';
import { styles } from './styles';
import { UserReference } from '../../../types/pr';
import { referenceDataService } from '@/services/referenceData';
import { db } from '@/config/firebase';
import { doc, getDoc, query, collection, where, getDocs } from 'firebase/firestore';

// Helper function to format currency
function formatCurrency(amount?: number): string {
  if (amount === undefined || amount === null) return 'Not specified';
  
  // Format with LSL currency code and 2 decimal places
  return `LSL ${amount.toFixed(2)}`;
}

// Helper function to format date
function formatDate(dateString?: string): string {
  if (!dateString) return 'Not specified';
  
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  } catch (e) {
    return dateString;
  }
}

// Helper function to format reference data (e.g., department_name to Department Name)
function formatReferenceData(value: string): string {
  if (!value) return 'Not specified';
  
  // Handle underscore format (e.g., department_name)
  if (value.includes('_')) {
    return value.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }
  
  return value;
}

// Helper function to resolve reference data IDs to names
async function resolveReferenceData(id: string, type: string, organization?: string): Promise<string> {
  if (!id) return 'Not specified';
  
  try {
    console.debug(`Resolving ${type} ID: ${id} for organization: ${organization || 'Not specified'}`);
    
    // If it looks like a code with underscores (like "7_administrative_overhead"), format it for display
    if (id.includes('_')) {
      const readableName = id
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      console.debug(`Formatted ${type} ID with underscores: ${id} to: ${readableName}`);
      return readableName;
    }
    
    // If it doesn't look like an ID (no special characters, just plain text), return as is
    if (!/[^a-zA-Z0-9_]/.test(id) && !/^[a-zA-Z0-9]{20}$/.test(id)) {
      console.debug(`ID ${id} appears to be a plain text value, returning as is`);
      return id;
    }
    
    // Try to get the reference data item
    let items: any[] = [];
    
    switch (type) {
      case 'category':
        console.debug(`Fetching project categories for organization: ${organization || 'Not specified'}`);
        items = await referenceDataService.getProjectCategories(organization || '');
        break;
      case 'expenseType':
        console.debug(`Fetching expense types for organization: ${organization || 'Not specified'}`);
        items = await referenceDataService.getExpenseTypes(organization || '');
        break;
      case 'vendor':
        console.debug(`Fetching vendors for organization: ${organization || 'Not specified'}`);
        try {
          // Get vendors through the reference data service
          items = await referenceDataService.getVendors(organization || '');
          console.debug(`Got ${items.length} vendors from referenceDataService`);
        } catch (e) {
          console.error(`Error getting vendors: ${e instanceof Error ? e.message : String(e)}`);
          // Try a direct Firestore query as fallback
          try {
            console.debug('Attempting direct Firestore query to vendors collection');
            const vendorsQuery = query(collection(db, 'vendors'), where('organizationId', '==', organization || ''));
            const vendorDocs = await getDocs(vendorsQuery);
            items = vendorDocs.docs.map(doc => ({
              id: doc.id,
              vendorId: doc.data().vendorId || doc.id,
              name: doc.data().name
            }));
            console.debug(`Got ${items.length} vendors directly from Firestore`);
          } catch (firestoreError) {
            console.error(`Firestore fallback also failed: ${firestoreError instanceof Error ? firestoreError.message : String(firestoreError)}`);
          }
        }
        break;
      case 'site':
        console.debug(`Fetching sites for organization: ${organization || 'Not specified'}`);
        items = await referenceDataService.getSites(organization || '');
        break;
      default:
        console.warn(`Unknown reference data type: ${type}`);
        return id;
    }
    
    console.debug(`Got ${items.length} items for ${type}`);
    
    // Special handling for numeric vendor IDs
    if (type === 'vendor' && /^\d+$/.test(id)) {
      const numericId = id;
      const vendor = items.find(item => 
        item.vendorId === numericId || 
        item.id === numericId || 
        (item.vendorId && item.vendorId.toString() === numericId)
      );
      
      if (vendor) {
        console.debug(`Found vendor with ID ${numericId}: ${vendor.name}`);
        return vendor.name;
      } else {
        // For numeric vendor IDs, make it clear this is a vendor code
        console.debug(`Vendor ID ${numericId} not found in reference data`);
        return `Vendor #${numericId}`;
      }
    }
    
    // For other reference data types, look for a match by id
    const item = items.find(item => item.id === id);
    if (item) {
      console.debug(`Found ${type} with ID ${id}: ${item.name}`);
      return item.name;
    }
    
    console.debug(`${type} with ID ${id} not found in reference data`);
    return id;
  } catch (error) {
    console.error(`Error resolving ${type} reference data for ID ${id}:`, error);
    return id;
  }
}

// Helper function to fetch user details from Firestore
async function fetchUserDetails(userId: string): Promise<UserReference | null> {
  try {
    console.debug(`Fetching user details for ID: ${userId}`);
    const userDoc = await getDoc(doc(db, 'users', userId));
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      console.debug(`Found user data:`, userData);
      return {
        id: userId,
        name: userData.name || `${userData.firstName || ''} ${userData.lastName || ''}`.trim(),
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName
      };
    } else {
      console.warn(`User with ID ${userId} not found in Firestore`);
      return null;
    }
  } catch (error) {
    console.error(`Error fetching user details for ${userId}:`, error);
    return null;
  }
}

export async function generateNewPREmail(context: NotificationContext): Promise<EmailContent> {
  const { pr, prNumber, isUrgent, notes, baseUrl, user, requestorInfo } = context;
  
  if (!pr) {
    throw new Error('PR object is required');
  }

  // Debug logs to see exactly what data we have
  console.debug('Email template data - full context:', {
    prId: pr.id,
    prNumber,
    requestorInfoFromContext: requestorInfo,
    userFromContext: user,
    prRequestor: pr.requestor,
    requestorEmail: pr.requestorEmail
  });

  const prUrl = `${baseUrl || 'https://1pwr.firebaseapp.com'}/pr/${pr.id}`;
  const subject = `${isUrgent ? 'URGENT: ' : ''}New PR ${prNumber} Submitted`;

  // Get approver information
  let approverName = 'Not specified';
  let approverEmail = 'Not specified';
  
  // Enhanced approver resolution logic prioritizing PR.approver as the source of truth
  if (pr.approver) {
    if (typeof pr.approver === 'string') {
      approverName = pr.approver;
      approverEmail = pr.approver;
    } else if (typeof pr.approver === 'object' && pr.approver !== null) {
      const approverObj = pr.approver as UserReference;
      if (approverObj.name) {
        approverName = approverObj.name;
      } else if (approverObj.firstName || approverObj.lastName) {
        approverName = `${approverObj.firstName || ''} ${approverObj.lastName || ''}`.trim();
      } else if (approverObj.email) {
        approverName = approverObj.email;
      }
      
      approverEmail = approverObj.email || 'Not specified';
    }
  } else if (context.approver) {
    if (context.approver.name) {
      approverName = context.approver.name;
    } else if (context.approver.firstName || context.approver.lastName) {
      approverName = `${context.approver.firstName || ''} ${context.approver.lastName || ''}`.trim();
    } else if (context.approver.email) {
      approverName = context.approver.email;
    }
    
    approverEmail = context.approver.email || 'Not specified';
  } else if (pr.approvalWorkflow?.currentApprover) {
    // Basic fallback if only currentApprover string is available
    approverName = pr.approvalWorkflow.currentApprover;
    approverEmail = pr.approvalWorkflow.currentApprover;
  }

  // Get requestor information - Directly use the pre-processed requestor object from context.
  // getEmailContent now ensures context.pr.requestor is populated.
  const requestorName = context.pr!.requestor?.name || 'Unknown Requestor'; 
  const requestorEmail = context.pr!.requestor?.email || pr.requestorEmail || 'unknown@example.com'; // Fallback to pr.requestorEmail if needed
  const requestorDept = pr.department || 'Not specified';
  
  console.debug('Using pre-processed requestor details:', { requestorName, requestorEmail, requestorDept });

  // Resolve reference data IDs to human-readable names with additional logging
  const requestorSite = await resolveReferenceData(pr.site || '', 'site', pr.organization);
  console.debug(`Resolved site '${pr.site}' to '${requestorSite}'`);
  
  const categoryName = await resolveReferenceData(pr.category || '', 'category', pr.organization);
  console.debug(`Resolved category '${pr.category}' to '${categoryName}'`);
  
  const expenseTypeName = await resolveReferenceData(pr.expenseType || '', 'expenseType', pr.organization);
  console.debug(`Resolved expenseType '${pr.expenseType}' to '${expenseTypeName}'`);

  // For vendor name, use enhanced resolution
  let vendorName = 'Not specified';
  if (pr.preferredVendor) {
    vendorName = await resolveReferenceData(pr.preferredVendor, 'vendor', pr.organization);
    console.debug(`Resolved vendor '${pr.preferredVendor}' to '${vendorName}'`);
  }

  const html = `
    <div style="${styles.container}">
      ${isUrgent ? `<div style="${styles.urgentBadge}">URGENT</div>` : ''}
      <h2 style="${styles.header}">New Purchase Request #${prNumber} Submitted</h2>
      
      <div style="${styles.section}">
        <h3 style="${styles.subHeader}">Submission Details</h3>
        <p style="${styles.paragraph}">
          <strong>Submitted By:</strong> ${requestorName}</p>
      ${notes ? `
        <div style="${styles.notesContainer}">
          <h4 style="${styles.notesHeader}">Notes:</h4>
          <p style="${styles.notesParagraph}">${notes}</p>
        </div>
      ` : ''}
      </div>

      <div style="${styles.section}">
        <h3 style="${styles.subHeader}">Requestor Information</h3>
        
        <table style="${styles.table}">
          <tr>
            <td style="${styles.tableCell}"><strong>Name</strong></td>
            <td style="${styles.tableCell}">${requestorName}</td>
          </tr>
          <tr>
            <td style="${styles.tableCell}"><strong>Email</strong></td>
            <td style="${styles.tableCell}">${requestorEmail}</td>
          </tr>
          <tr>
            <td style="${styles.tableCell}"><strong>Department</strong></td>
            <td style="${styles.tableCell}">${formatReferenceData(requestorDept)}</td>
          </tr>
          <tr>
            <td style="${styles.tableCell}"><strong>Site</strong></td>
            <td style="${styles.tableCell}">${pr.site || 'Not specified'}</td>
          </tr>
        </table>
      </div>

      <div style="${styles.section}">
        <h3 style="${styles.subHeader}">PR Details</h3>
        
        <table style="${styles.table}">
          <tr>
            <td style="${styles.tableCell}"><strong>PR Number</strong></td>
            <td style="${styles.tableCell}">${prNumber}</td>
          </tr>
          <tr>
            <td style="${styles.tableCell}"><strong>Approver</strong></td>
            <td style="${styles.tableCell}">${approverName}</td>
          </tr>
          <tr>
            <td style="${styles.tableCell}"><strong>Category</strong></td>
            <td style="${styles.tableCell}">${categoryName}</td>
          </tr>
          <tr>
            <td style="${styles.tableCell}"><strong>Expense Type</strong></td>
            <td style="${styles.tableCell}">${expenseTypeName}</td>
          </tr>
          <tr>
            <td style="${styles.tableCell}"><strong>Total Amount</strong></td>
            <td style="${styles.tableCell}">${formatCurrency(pr.estimatedAmount)}</td>
          </tr>
          <tr>
            <td style="${styles.tableCell}"><strong>Vendor</strong></td>
            <td style="${styles.tableCell}">${vendorName}</td>
          </tr>
          <tr>
            <td style="${styles.tableCell}"><strong>Required Date</strong></td>
            <td style="${styles.tableCell}">${formatDate(pr.requiredDate)}</td>
          </tr>
          ${pr.description ? `
          <tr>
            <td style="${styles.tableCell}"><strong>Description</strong></td>
            <td style="${styles.tableCell}">${pr.description}</td>
          </tr>
          ` : ''}
        </table>
      </div>

      ${pr.lineItems?.length ? `
        <div style="${styles.section}">
          <h3 style="${styles.subHeader}">Line Items</h3>
          <table style="${styles.table}">
            <tr>
              <th style="${styles.tableHeader}">Description</th>
              <th style="${styles.tableHeader}">Quantity</th>
              <th style="${styles.tableHeader}">UOM</th>
            </tr>
            ${pr.lineItems.map(item => `
              <tr>
                <td style="${styles.tableCell}">${item.description}</td>
                <td style="${styles.tableCell}">${item.quantity}</td>
                <td style="${styles.tableCell}">${item.uom}</td>
              </tr>
            `).join('')}
          </table>
        </div>
      ` : ''}

      <div style="${styles.buttonContainer}">
        <a href="${prUrl}" style="${styles.button}">View Purchase Request</a>
      </div>
    </div>
  `;

  const text = `
New PR ${prNumber} Submitted

Submission Details:
Submitted By: ${requestorName}

Requestor Information:
Name: ${requestorName}
Email: ${requestorEmail}
Department: ${formatReferenceData(requestorDept)}
Site: ${pr.site || 'Not specified'}

PR Details:
PR Number: ${prNumber}
Approver: ${approverName}
Category: ${categoryName}
Expense Type: ${expenseTypeName}
Total Amount: ${formatCurrency(pr.estimatedAmount)}
Vendor: ${vendorName}
Required Date: ${formatDate(pr.requiredDate)}
${pr.description ? `Description: ${pr.description}` : ''}

View PR: ${prUrl}
`;

  return {
    subject,
    html,
    text,
    headers: generateEmailHeaders({
      prId: pr.id,
      prNumber,
      subject,
      notificationType: 'NEW_PR_SUBMITTED'
    })
  };
}
