/**
 * Scheduled Cloud Function: Daily PR/PO Reminders
 * 
 * Sends automated reminder notifications to users with pending actions:
 * - Daily reminders at 8:00 AM for all pending items
 * - Urgent reminders at 8:00 AM and 3:00 PM for items > 2 business days
 * - Delay notifications for ORDERED POs > 3 days after ETD
 * 
 * Schedule: 8:00 AM and 3:00 PM daily
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as nodemailer from 'nodemailer';

const db = admin.firestore();

// Create nodemailer transporter for SMTP
const transporter = nodemailer.createTransport({
  host: functions.config().smtp?.host || 'mail.1pwrafrica.com',
  port: parseInt(functions.config().smtp?.port || '465'),
  secure: functions.config().smtp?.secure === 'true',
  auth: {
    user: functions.config().smtp?.user || 'notifications@1pwrafrica.com',
    pass: functions.config().smtp?.password || ''
  },
  tls: {
    rejectUnauthorized: false
  }
});

interface PRDocument {
  id: string;
  prNumber: string;
  status: string;
  organization: string;
  description: string;
  estimatedAmount: number;
  currency: string;
  requiredDate: string;
  createdAt: string;
  requestorEmail: string;
  requestor?: {
    name?: string;
    email?: string;
  };
  approver?: string;
  approver2?: string;
  estimatedDeliveryDate?: string;
  orderedAt?: string;
  isUrgent?: boolean;
}

interface Organization {
  id: string;
  name: string;
  procurementEmail?: string;
  assetManagementEmail?: string;
}

interface User {
  id: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
}

/**
 * Calculate business days between two dates (excluding weekends)
 */
function calculateBusinessDays(startDate: Date, endDate: Date): number {
  let count = 0;
  const current = new Date(startDate);
  
  while (current <= endDate) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday (0) or Saturday (6)
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return count;
}

/**
 * Daily Reminder - Runs at 8:00 AM
 */
export const dailyReminders = functions.pubsub
  .schedule('0 8 * * *') // 8:00 AM daily
  .timeZone('Africa/Maseru')
  .onRun(async (context) => {
    console.log('Starting daily reminders (8:00 AM)...');
    
    const stats = {
      procurement: 0,
      approvers: 0,
      requestors: 0,
      finance: 0,
      assetManagement: 0,
      errors: [] as string[]
    };

    try {
      await sendProcurementReminders(stats);
      await sendApproverReminders(stats);
      await sendRequestorReminders(stats);
      await sendFinanceReminders(stats);
      await sendAssetManagementReminders(stats);

      console.log('Daily reminders completed:', stats);
      return { success: true, stats };
    } catch (error: any) {
      console.error('Error in daily reminders:', error);
      return { success: false, error: error.message };
    }
  });

/**
 * Urgent Reminder - Runs at 3:00 PM
 */
export const urgentReminders = functions.pubsub
  .schedule('0 15 * * *') // 3:00 PM daily
  .timeZone('Africa/Maseru')
  .onRun(async (context) => {
    console.log('Starting urgent reminders (3:00 PM)...');
    
    const stats = {
      procurement: 0,
      approvers: 0,
      requestors: 0,
      finance: 0,
      assetManagement: 0,
      errors: [] as string[]
    };

    try {
      // Only send urgent reminders for items > 2 business days
      await sendProcurementReminders(stats, true);
      await sendApproverReminders(stats, true);
      await sendRequestorReminders(stats, true);
      await sendFinanceReminders(stats, true);
      await sendAssetManagementReminders(stats, true);

      console.log('Urgent reminders completed:', stats);
      return { success: true, stats };
    } catch (error: any) {
      console.error('Error in urgent reminders:', error);
      return { success: false, error: error.message };
    }
  });

/**
 * Delay Notifications - Check daily for overdue deliveries
 */
export const deliveryDelayCheck = functions.pubsub
  .schedule('0 9 * * *') // 9:00 AM daily
  .timeZone('Africa/Maseru')
  .onRun(async (context) => {
    console.log('Starting delivery delay check...');
    
    const stats = {
      checked: 0,
      delayed: 0,
      notified: 0,
      errors: [] as string[]
    };

    try {
      const today = new Date();
      
      // Get all POs in ORDERED status
      const orderedPOs = await db.collection('purchaseRequests')
        .where('status', '==', 'ORDERED')
        .get();

      console.log(`Found ${orderedPOs.size} POs in ORDERED status`);

      for (const poDoc of orderedPOs.docs) {
        stats.checked++;
        const po = { id: poDoc.id, ...poDoc.data() } as PRDocument;

        try {
          if (po.estimatedDeliveryDate && po.orderedAt) {
            const etd = new Date(po.estimatedDeliveryDate);
            const orderedDate = new Date(po.orderedAt);
            
            // Calculate business days since ETD
            const businessDaysSinceETD = calculateBusinessDays(etd, today);
            
            if (businessDaysSinceETD > 3) {
              console.log(`PO ${po.prNumber} delayed ${businessDaysSinceETD} days beyond ETD`);
              stats.delayed++;
              
              // Send delay notification (only once - check if already notified)
              const notificationCheck = await db.collection('notificationLogs')
                .where('type', '==', 'DELIVERY_DELAY')
                .where('prId', '==', po.id)
                .limit(1)
                .get();

              if (notificationCheck.empty) {
                await sendDelayNotification(po, businessDaysSinceETD);
                stats.notified++;
              }
            }
          }
        } catch (error: any) {
          console.error(`Error processing PO ${po.id}:`, error);
          stats.errors.push(`PO ${po.id}: ${error.message}`);
        }
      }

      console.log('Delivery delay check completed:', stats);
      return { success: true, stats };
    } catch (error: any) {
      console.error('Error in delivery delay check:', error);
      return { success: false, error: error.message };
    }
  });

/**
 * Send procurement reminders for PRs in SUBMITTED, IN_QUEUE, and POs in APPROVED, ORDERED
 */
async function sendProcurementReminders(stats: any, urgentOnly: boolean = false): Promise<void> {
  try {
    const statuses = ['SUBMITTED', 'IN_QUEUE', 'APPROVED', 'ORDERED'];
    const prsSnapshot = await db.collection('purchaseRequests')
      .where('status', 'in', statuses)
      .get();

    const prsByOrg: { [orgId: string]: PRDocument[] } = {};
    const today = new Date();

    for (const doc of prsSnapshot.docs) {
      const pr = { id: doc.id, ...doc.data() } as PRDocument;
      const businessDaysOpen = calculateBusinessDays(new Date(pr.createdAt), today);

      // If urgentOnly, skip items <= 2 business days
      if (urgentOnly && businessDaysOpen <= 2) continue;

      if (!prsByOrg[pr.organization]) {
        prsByOrg[pr.organization] = [];
      }
      prsByOrg[pr.organization].push(pr);
    }

    // Send reminders per organization
    for (const [orgId, prs] of Object.entries(prsByOrg)) {
      const org = await getOrganization(orgId);
      if (org?.procurementEmail) {
        await sendReminderEmail(
          org.procurementEmail,
          'Procurement',
          prs,
          urgentOnly
        );
        stats.procurement++;
      }
    }
  } catch (error) {
    console.error('Error sending procurement reminders:', error);
    throw error;
  }
}

/**
 * Send approver reminders for PRs in PENDING_APPROVAL
 */
async function sendApproverReminders(stats: any, urgentOnly: boolean = false): Promise<void> {
  try {
    const prsSnapshot = await db.collection('purchaseRequests')
      .where('status', '==', 'PENDING_APPROVAL')
      .get();

    const prsByApprover: { [approverId: string]: PRDocument[] } = {};
    const today = new Date();

    for (const doc of prsSnapshot.docs) {
      const pr = { id: doc.id, ...doc.data() } as PRDocument;
      const businessDaysOpen = calculateBusinessDays(new Date(pr.createdAt), today);

      // If urgentOnly, skip items <= 2 business days
      if (urgentOnly && businessDaysOpen <= 2) continue;

      // Add to both approvers if dual approval
      if (pr.approver) {
        if (!prsByApprover[pr.approver]) prsByApprover[pr.approver] = [];
        prsByApprover[pr.approver].push(pr);
      }
      if (pr.approver2) {
        if (!prsByApprover[pr.approver2]) prsByApprover[pr.approver2] = [];
        prsByApprover[pr.approver2].push(pr);
      }
    }

    // Send reminders to each approver
    for (const [approverId, prs] of Object.entries(prsByApprover)) {
      const approver = await getUser(approverId);
      if (approver?.email) {
        await sendReminderEmail(
          approver.email,
          'Approver',
          prs,
          urgentOnly
        );
        stats.approvers++;
      }
    }
  } catch (error) {
    console.error('Error sending approver reminders:', error);
    throw error;
  }
}

/**
 * Send requestor reminders for PRs in REVISION_REQUIRED
 */
async function sendRequestorReminders(stats: any, urgentOnly: boolean = false): Promise<void> {
  try {
    const prsSnapshot = await db.collection('purchaseRequests')
      .where('status', '==', 'REVISION_REQUIRED')
      .get();

    const prsByRequestor: { [email: string]: PRDocument[] } = {};
    const today = new Date();

    for (const doc of prsSnapshot.docs) {
      const pr = { id: doc.id, ...doc.data() } as PRDocument;
      const businessDaysOpen = calculateBusinessDays(new Date(pr.createdAt), today);

      // If urgentOnly, skip items <= 2 business days
      if (urgentOnly && businessDaysOpen <= 2) continue;

      if (!prsByRequestor[pr.requestorEmail]) {
        prsByRequestor[pr.requestorEmail] = [];
      }
      prsByRequestor[pr.requestorEmail].push(pr);
    }

    // Send reminders to each requestor
    for (const [email, prs] of Object.entries(prsByRequestor)) {
      await sendReminderEmail(
        email,
        'Requestor',
        prs,
        urgentOnly
      );
      stats.requestors++;
    }
  } catch (error) {
    console.error('Error sending requestor reminders:', error);
    throw error;
  }
}

/**
 * Send finance reminders for POs in APPROVED status
 */
async function sendFinanceReminders(stats: any, urgentOnly: boolean = false): Promise<void> {
  try {
    const posSnapshot = await db.collection('purchaseRequests')
      .where('status', '==', 'APPROVED')
      .get();

    const posByOrg: { [orgId: string]: PRDocument[] } = {};
    const today = new Date();

    for (const doc of posSnapshot.docs) {
      const po = { id: doc.id, ...doc.data() } as PRDocument;
      const businessDaysOpen = calculateBusinessDays(new Date(po.createdAt), today);

      // If urgentOnly, skip items <= 2 business days
      if (urgentOnly && businessDaysOpen <= 2) continue;

      if (!posByOrg[po.organization]) {
        posByOrg[po.organization] = [];
      }
      posByOrg[po.organization].push(po);
    }

    // Send reminders per organization (to finance email if configured)
    // For now, using procurement email as fallback
    for (const [orgId, pos] of Object.entries(posByOrg)) {
      const org = await getOrganization(orgId);
      if (org?.procurementEmail) {
        await sendReminderEmail(
          org.procurementEmail,
          'Finance/Admin',
          pos,
          urgentOnly
        );
        stats.finance++;
      }
    }
  } catch (error) {
    console.error('Error sending finance reminders:', error);
    throw error;
  }
}

/**
 * Send asset management reminders for POs in ORDERED status
 */
async function sendAssetManagementReminders(stats: any, urgentOnly: boolean = false): Promise<void> {
  try {
    const posSnapshot = await db.collection('purchaseRequests')
      .where('status', '==', 'ORDERED')
      .get();

    const posByOrg: { [orgId: string]: PRDocument[] } = {};
    const today = new Date();

    for (const doc of posSnapshot.docs) {
      const po = { id: doc.id, ...doc.data() } as PRDocument;
      const businessDaysOpen = calculateBusinessDays(new Date(po.createdAt), today);

      // If urgentOnly, skip items <= 2 business days
      if (urgentOnly && businessDaysOpen <= 2) continue;

      if (!posByOrg[po.organization]) {
        posByOrg[po.organization] = [];
      }
      posByOrg[po.organization].push(po);
    }

    // Send reminders per organization to asset management email
    for (const [orgId, pos] of Object.entries(posByOrg)) {
      const org = await getOrganization(orgId);
      if (org?.assetManagementEmail) {
        await sendReminderEmail(
          org.assetManagementEmail,
          'Asset Management',
          pos,
          urgentOnly
        );
        stats.assetManagement++;
      }
    }
  } catch (error) {
    console.error('Error sending asset management reminders:', error);
    throw error;
  }
}

/**
 * Send delay notification for overdue delivery
 */
async function sendDelayNotification(po: PRDocument, daysOverdue: number): Promise<void> {
  try {
    const org = await getOrganization(po.organization);
    
    const recipients: string[] = [po.requestorEmail];
    const cc: string[] = [];
    
    // Add org admin email
    if (org?.procurementEmail) {
      cc.push(org.procurementEmail);
    }
    
    // Add asset management email
    if (org?.assetManagementEmail) {
      cc.push(org.assetManagementEmail);
    }

    // Add approvers
    if (po.approver) {
      const approver = await getUser(po.approver);
      if (approver?.email) recipients.push(approver.email);
    }
    if (po.approver2) {
      const approver2 = await getUser(po.approver2);
      if (approver2?.email) recipients.push(approver2.email);
    }

    const subject = `${po.isUrgent ? 'URGENT: ' : ''}Delivery Delay Alert: PO ${po.prNumber}`;
    const message = `
      PO ${po.prNumber} is overdue for delivery.
      
      Expected Delivery Date: ${new Date(po.estimatedDeliveryDate!).toLocaleDateString()}
      Days Overdue: ${daysOverdue} business days
      
      Please follow up with the vendor regarding delivery status.
    `;

    // Send actual email via SMTP
    try {
      const mailOptions = {
        to: recipients,
        cc: cc,
        from: '"1PWR System" <notifications@1pwrafrica.com>',
        subject: subject,
        text: message,
        html: `<pre>${message}</pre>`
      };
      
      const result = await transporter.sendMail(mailOptions);
      console.log(`Sent delay notification for PO ${po.prNumber} - MessageID: ${result.messageId}`);
    } catch (emailError) {
      console.error(`Failed to send delay notification for PO ${po.prNumber}:`, emailError);
      // Don't throw - we still want to log the notification
    }

    // Log notification
    await db.collection('notificationLogs').add({
      type: 'DELIVERY_DELAY',
      prId: po.id,
      prNumber: po.prNumber,
      recipients,
      cc,
      status: 'sent',
      timestamp: new Date().toISOString(),
      message,
    });

  } catch (error) {
    console.error('Error sending delay notification:', error);
    throw error;
  }
}

/**
 * Send reminder email
 */
async function sendReminderEmail(
  recipient: string,
  role: string,
  items: PRDocument[],
  isUrgent: boolean
): Promise<void> {
  const subject = isUrgent 
    ? `URGENT: PRs/POs Overdue - Action Required`
    : `Reminder: PRs/POs Pending Your Action`;

  const itemList = items.map(item => {
    const daysOpen = calculateBusinessDays(new Date(item.createdAt), new Date());
    return `
      - ${item.prNumber}: ${item.description}
        Status: ${item.status}
        Days Open: ${daysOpen}
        Amount: ${item.currency} ${item.estimatedAmount}
    `;
  }).join('\n');

  const message = `
    ${role} Reminder
    
    You have ${items.length} PR/PO(s) requiring your action:
    
    ${itemList}
    
    Please log in to the PR System to take action.
  `;

  // Send actual email via SMTP
  try {
    const mailOptions = {
      to: recipient,
      from: '"1PWR System" <notifications@1pwrafrica.com>',
      subject: subject,
      text: message,
      html: `<pre>${message}</pre>`
    };
    
    const result = await transporter.sendMail(mailOptions);
    console.log(`Sent ${isUrgent ? 'URGENT' : 'daily'} reminder to ${recipient} (${role}): ${items.length} items - MessageID: ${result.messageId}`);
  } catch (emailError) {
    console.error(`Failed to send ${isUrgent ? 'URGENT' : 'daily'} reminder to ${recipient}:`, emailError);
    // Don't throw - we still want to log the notification
  }

  // Log notification
  await db.collection('notificationLogs').add({
    type: isUrgent ? 'URGENT_REMINDER' : 'DAILY_REMINDER',
    recipient,
    role,
    itemCount: items.length,
    items: items.map(i => ({ prNumber: i.prNumber, status: i.status })),
    status: 'sent',
    timestamp: new Date().toISOString(),
  });
}

/**
 * Get organization data
 */
async function getOrganization(orgId: string): Promise<Organization | null> {
  try {
    const orgDoc = await db.collection('referenceData_organizations').doc(orgId).get();
    if (orgDoc.exists) {
      return { id: orgDoc.id, ...orgDoc.data() } as Organization;
    }
    return null;
  } catch (error) {
    console.error('Error fetching organization:', error);
    return null;
  }
}

/**
 * Get user data
 */
async function getUser(userId: string): Promise<User | null> {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (userDoc.exists) {
      return { id: userDoc.id, ...userDoc.data() } as User;
    }
    return null;
  } catch (error) {
    console.error('Error fetching user:', error);
    return null;
  }
}

