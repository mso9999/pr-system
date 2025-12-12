import { EmailContent, NotificationContext } from '../types';
import { generateEmailHeaders } from '../types/emailHeaders';
import { styles } from './styles';
import { UserReference } from '../../../types/pr';
import { referenceDataService } from '@/services/referenceData';
import { db } from '@/config/firebase';
import { doc, getDoc, query, collection, where, getDocs } from 'firebase/firestore';

// Helper function to format currency
function formatCurrency(amount?: number, currency?: string): string {
  if (amount === undefined || amount === null) return 'Not specified';
  
  // Use the PR's currency if provided, otherwise default to LSL
  const currencyCode = currency || 'LSL';
  return `${currencyCode} ${amount.toFixed(2)}`;
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
    
    // If it's all numeric, it's definitely an ID that needs lookup (like vendor "1029")
    if (/^\d+$/.test(id)) {
      console.debug(`ID ${id} is numeric, will look it up as ${type} ID`);
      // Continue to lookup below
    }
    // If it doesn't look like an ID (no special characters, just plain text), return as is
    else if (!/[^a-zA-Z0-9_]/.test(id) && !/^[a-zA-Z0-9]{20}$/.test(id)) {
      console.debug(`ID ${id} appears to be a plain text value, returning as is`);
      return id;
    }
    
    // Try to get the reference data item
    let items: any[] = [];
    
    switch (type) {
      case 'department':
        console.debug(`Fetching departments for organization: ${organization || 'Not specified'}`);
        items = await referenceDataService.getDepartments(organization || '');
        break;
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
          // Get ALL vendors (vendors are org-independent)
          const rawVendors = await referenceDataService.getVendors();
          console.debug(`Got ${rawVendors.length} vendors from referenceDataService`);
          
          // Check if vendor 1030 is in raw data
          const raw1030 = rawVendors.find(v => v.id === '1030');
          if (raw1030) {
            console.debug('[VENDOR DEBUG] Raw vendor 1030 from referenceDataService:', raw1030);
          } else {
            console.error('[VENDOR DEBUG] Vendor 1030 NOT in raw vendors from referenceDataService');
          }
          
          // Normalize vendor data structure to ensure consistent fields
          items = rawVendors.map(v => {
            const data = v;
            const approvedValue = data.approved !== undefined ? data.approved : data.Approved;
            const activeValue = data.active !== undefined ? data.active : data.isActive;
            
            const normalized = {
              id: v.id,
              vendorId: data.vendorId || data.code || data.Code || v.id,
              code: data.code || data.Code,
              name: data.name || data.Name,
              active: activeValue === true,
              approved: approvedValue,
              _rawData: data // Include raw data for debugging
            };
            
            // Debug log for vendor 1030 specifically
            if (v.id === '1030' || data.code === '1030') {
              console.debug('[VENDOR DEBUG] Normalizing vendor 1030:', {
                id: normalized.id,
                vendorId: normalized.vendorId,
                code: normalized.code,
                name: normalized.name,
                active: normalized.active,
                approved: normalized.approved,
                rawApproved: data.approved,
                rawActive: data.active,
                rawIsActive: data.isActive
              });
            }
            
            return normalized;
          });
          
          console.debug(`Normalized ${items.length} vendors`);
          if (items.length > 0) {
            console.debug('Sample normalized vendor:', { 
              id: items[0].id, 
              vendorId: items[0].vendorId,
              code: items[0].code, 
              name: items[0].name, 
              active: items[0].active, 
              approved: items[0].approved 
            });
          }
          
          // Check if vendor 1030 is in normalized items BEFORE filtering
          const normalized1030 = items.find(v => v.id === '1030' || v.code === '1030');
          if (normalized1030) {
            console.debug('[VENDOR DEBUG] Vendor 1030 in normalized list (BEFORE filtering):', normalized1030);
          } else {
            console.error('[VENDOR DEBUG] Vendor 1030 NOT found in normalized list');
          }
          
          // Check if vendor 1030 is in the list
          const vendor1030 = items.find(v => v.id === '1030' || v.code === '1030' || v.vendorId === '1030');
          if (vendor1030) {
            console.debug('[VENDOR DEBUG] Found vendor 1030 in normalized list:', vendor1030);
          } else {
            console.error('[VENDOR DEBUG] Vendor 1030 NOT found in normalized list of', items.length, 'vendors');
            console.debug('[VENDOR DEBUG] First 5 vendor IDs:', items.slice(0, 5).map(v => v.id));
          }
        } catch (e) {
          console.error(`Error getting vendors: ${e instanceof Error ? e.message : String(e)}`);
          // Try a direct Firestore query as fallback to get ALL vendors
          try {
            console.debug('Attempting direct Firestore query to referenceData_vendors collection');
            const vendorsCollection = collection(db, 'referenceData_vendors');
            const vendorDocs = await getDocs(vendorsCollection);
            items = vendorDocs.docs.map(doc => {
              const data = doc.data();
              const approvedValue = data.approved !== undefined ? data.approved : data.Approved;
              const activeValue = data.active !== undefined ? data.active : data.isActive;
              
              return {
                id: doc.id,
                vendorId: data.vendorId || data.code || data.Code || doc.id,
                code: data.code || data.Code,
                name: data.name || data.Name,
                active: activeValue === true,
                approved: approvedValue,
                _rawData: data // Include raw data for debugging
              };
            }).filter(v => {
              // Include vendors that are active OR approved OR have no explicit approval status
              // This ensures unapproved but active vendors are still usable
              const isActive = v.active === true;
              const isApproved = v.approved === true || v.approved === 'TRUE' || v.approved === '' || v.approved === undefined;
              const shouldInclude = isActive || isApproved;
              
              if (!shouldInclude) {
                console.debug(`Filtering out vendor ${v.id} (${v.name}): active=${v.active}, approved=${v.approved}`);
              }
              
              return shouldInclude;
            });
            console.debug(`Got ${items.length} active vendors directly from Firestore`);
            if (items.length > 0) {
              console.debug('Sample vendor after filtering:', { id: items[0].id, vendorId: items[0].vendorId, code: items[0].code, name: items[0].name, active: items[0].active, approved: items[0].approved });
            }
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
    
    // Special handling for vendors - try multiple matching strategies
    if (type === 'vendor') {
      console.debug(`Matching vendor ID '${id}' against ${items.length} vendors`);
      console.debug(`Search ID: '${id}' (type: ${typeof id})`);
      
      // Check if we're looking for vendor 1030 specifically
      if (id === '1030' || id === 1030) {
        console.debug('[VENDOR DEBUG] Searching for vendor 1030 in items list');
        const check1030 = items.find(v => v.id === '1030' || v.code === '1030');
        if (check1030) {
          console.debug('[VENDOR DEBUG] Vendor 1030 IS in items list:', check1030);
        } else {
          console.error('[VENDOR DEBUG] Vendor 1030 NOT in items list. Available vendor IDs:', items.map(v => v.id).slice(0, 10));
        }
      }
      
      const vendor = items.find(item => {
        // Get code value (check both cases)
        const codeValue = item.code || item.Code;
        const codeStr = codeValue ? codeValue.toString().trim() : null;
        
        // Get vendorId value
        const vendorIdStr = item.vendorId ? item.vendorId.toString().trim() : null;
        
        // Get document ID
        const docId = item.id ? item.id.toString().trim() : null;
        
        // Normalize the search ID for comparison
        const searchId = id.toString().trim();
        
        // Try multiple matching strategies (case-insensitive)
        const matchesId = docId && docId.toLowerCase() === searchId.toLowerCase();
        const matchesVendorId = vendorIdStr && vendorIdStr.toLowerCase() === searchId.toLowerCase();
        const matchesCode = codeStr && codeStr.toLowerCase() === searchId.toLowerCase();
        
        const isMatch = matchesId || matchesVendorId || matchesCode;
        
        // Debug logging for vendor 1030 specifically
        if (item.id === '1030' || codeStr === '1030') {
          console.debug(`[VENDOR DEBUG] Matching vendor 1030: ID='${docId}', vendorId='${vendorIdStr}', code='${codeStr}', name='${item.name}' | searchId='${searchId}' | Match: ${isMatch} (ID:${matchesId}, VID:${matchesVendorId}, Code:${matchesCode})`);
        }
        
        // Debug logging for each vendor to understand matching
        console.debug(`Checking vendor: ID='${docId}', vendorId='${vendorIdStr}', code='${codeStr}', name='${item.name}' | Match: ${isMatch} (ID:${matchesId}, VID:${matchesVendorId}, Code:${matchesCode})`);
        
        if (isMatch) {
          console.info(`✓ Vendor match found: ID='${docId}', code='${codeStr}', vendorId='${vendorIdStr}', name='${item.name || item.Name}'`);
        }
        
        return isMatch;
      });
      
      if (vendor) {
        const vendorName = vendor.name || vendor.Name;
        if (!vendorName || vendorName === id) {
          console.error(`Vendor found but name is missing or same as ID: ${JSON.stringify(vendor)}`);
          // Return vendor code with indicator that name is missing
          return `Vendor ${id} (Name Missing)`;
        }
        console.info(`✓ Successfully resolved vendor '${id}' to '${vendorName}'`);
        return vendorName;
      } else {
        console.error(`✗ Vendor with ID '${id}' not found in ${items.length} vendors`);
        console.debug('All available vendors:', items.map(v => ({ 
          id: v.id, 
          vendorId: v.vendorId, 
          code: v.code || v.Code, 
          name: v.name || v.Name,
          active: v.active,
          approved: v.approved
        })));
        // For numeric vendor IDs, make it clear this is a vendor code
        return /^\d+$/.test(id) ? `Vendor #${id}` : id;
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

  // Always use production URL for notifications
  const prUrl = `https://pr.1pwrafrica.com/pr/${pr.id}`;
  const urgentFlag = pr.isUrgent || isUrgent;
  const subject = `${urgentFlag ? 'URGENT: ' : ''}New PR ${prNumber} Submitted`;

  // Get approver information
  let approverName = 'Not specified';
  let approverEmail = 'Not specified';
  
  // Enhanced approver resolution logic - check multiple sources
  if (pr.approver) {
    if (typeof pr.approver === 'string') {
      // If it's a string, try to resolve it as a user ID
      try {
        const approverUser = await fetchUserDetails(pr.approver);
        if (approverUser) {
          approverName = approverUser.name || `${approverUser.firstName || ''} ${approverUser.lastName || ''}`.trim();
          approverEmail = approverUser.email || 'Not specified';
        } else {
          approverName = pr.approver;
          approverEmail = pr.approver;
        }
      } catch (error) {
        console.warn('Failed to fetch approver details:', error);
        approverName = pr.approver;
        approverEmail = pr.approver;
      }
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
  } else if (pr.approvers && pr.approvers.length > 0) {
    // Fallback to first approver from the deprecated approvers array
    try {
      const approverUser = await fetchUserDetails(pr.approvers[0]);
      if (approverUser) {
        approverName = approverUser.name || `${approverUser.firstName || ''} ${approverUser.lastName || ''}`.trim();
        approverEmail = approverUser.email || 'Not specified';
      } else {
        approverName = pr.approvers[0];
        approverEmail = pr.approvers[0];
      }
    } catch (error) {
      console.warn('Failed to fetch approver details from approvers array:', error);
      approverName = pr.approvers[0];
      approverEmail = pr.approvers[0];
    }
  }

  // Get requestor information - Directly use the pre-processed requestor object from context.
  // getEmailContent now ensures context.pr.requestor is populated.
  const requestorName = context.pr!.requestor?.name || 'Unknown Requestor'; 
  const requestorEmail = context.pr!.requestor?.email || pr.requestorEmail || 'unknown@example.com'; // Fallback to pr.requestorEmail if needed
  
  console.debug('Using pre-processed requestor details:', { requestorName, requestorEmail, requestorDept: pr.department });

  // Resolve ALL reference data IDs to human-readable names with additional logging
  const requestorDept = await resolveReferenceData(pr.department || '', 'department', pr.organization);
  console.debug(`Resolved department '${pr.department}' to '${requestorDept}'`);
  
  const requestorSite = await resolveReferenceData(pr.site || '', 'site', pr.organization);
  console.debug(`Resolved site '${pr.site}' to '${requestorSite}'`);
  
  const categoryName = await resolveReferenceData(pr.projectCategory || pr.category || '', 'category', pr.organization);
  console.debug(`Resolved category '${pr.projectCategory || pr.category}' to '${categoryName}'`);
  
  const expenseTypeName = await resolveReferenceData(pr.expenseType || '', 'expenseType', pr.organization);
  console.debug(`Resolved expenseType '${pr.expenseType}' to '${expenseTypeName}'`);

  // For vendor name, use enhanced resolution
  let vendorName = 'Not specified';
  console.log(`[VENDOR DEBUG] ========== VENDOR RESOLUTION START ==========`);
  console.log(`[VENDOR DEBUG] PR ID: ${pr.id}`);
  console.log(`[VENDOR DEBUG] Preferred Vendor: '${pr.preferredVendor}' (type: ${typeof pr.preferredVendor})`);
  console.log(`[VENDOR DEBUG] Organization: '${pr.organization}'`);
  console.log(`[VENDOR DEBUG] ================================================`);
  
  if (pr.preferredVendor) {
    console.log(`[VENDOR DEBUG] Calling resolveReferenceData with: id='${pr.preferredVendor}', type='vendor', org='${pr.organization}'`);
    vendorName = await resolveReferenceData(pr.preferredVendor, 'vendor', pr.organization);
    console.log(`[VENDOR DEBUG] ========== VENDOR RESOLUTION RESULT ==========`);
    console.log(`[VENDOR DEBUG] Input: '${pr.preferredVendor}'`);
    console.log(`[VENDOR DEBUG] Output: '${vendorName}'`);
    console.log(`[VENDOR DEBUG] ================================================`);
    
    // If still showing ID/code, it means resolution failed
    if (vendorName === pr.preferredVendor || vendorName.startsWith('Vendor #')) {
      console.error(`[VENDOR DEBUG] ✗ Vendor resolution FAILED - vendor not found or name missing: ${pr.preferredVendor}`);
    } else {
      console.log(`[VENDOR DEBUG] ✓ Vendor resolution SUCCESSFUL: '${pr.preferredVendor}' → '${vendorName}'`);
    }
  } else {
    console.warn(`[VENDOR DEBUG] ✗ No preferredVendor field in PR object`);
  }

  const html = `
    <div style="${styles.container}">
      ${urgentFlag ? `<div style="${styles.urgentBadge}">URGENT</div>` : ''}
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
            <td style="${styles.tableCell}">${requestorDept}</td>
          </tr>
          <tr>
            <td style="${styles.tableCell}"><strong>Site</strong></td>
            <td style="${styles.tableCell}">${requestorSite}</td>
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
            <td style="${styles.tableCell}">${formatCurrency(pr.estimatedAmount, pr.currency)}</td>
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
Department: ${requestorDept}
Site: ${requestorSite}

PR Details:
PR Number: ${prNumber}
Approver: ${approverName}
Category: ${categoryName}
Expense Type: ${expenseTypeName}
Total Amount: ${formatCurrency(pr.estimatedAmount, pr.currency)}
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
