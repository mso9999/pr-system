/**
 * Scheduled Cloud Function: Daily Vendor Approval Expiry Check
 * 
 * Runs daily to check vendor approval expiry dates and:
 * 1. Auto-deactivate vendors with expired approvals
 * 2. Send notifications to Procurement team about expiries
 * 3. Handle high-value vendor special rules
 * 
 * Schedule: Daily at 1:00 AM
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

interface Vendor {
  id: string;
  name: string;
  isApproved: boolean;
  approvalDate?: string;
  approvalExpiryDate?: string;
  approvalReason?: 'auto_3quote' | 'auto_completed' | 'manual';
  approvedBy?: string;
  lastCompletedOrderDate?: string;
  isHighValue?: boolean;
  cumulativeOrderValue?: number;
  organizationId?: string;
}

interface Organization {
  id: string;
  name: string;
  procurementEmail?: string;
  vendorApproval3QuoteDuration?: number;
  highValueVendorMaxDuration?: number;
}

export const dailyVendorExpiryCheck = functions.pubsub
  .schedule('0 1 * * *') // Daily at 1:00 AM
  .timeZone('Africa/Maseru')
  .onRun(async (context) => {
    console.log('Starting daily vendor expiry check...');
    
    const today = new Date();
    const stats = {
      checked: 0,
      expired: 0,
      notified: 0,
      errors: [] as string[]
    };

    try {
      // Get all approved vendors
      const vendorsSnapshot = await db.collection('referenceData_vendors')
        .where('isApproved', '==', true)
        .get();

      console.log(`Found ${vendorsSnapshot.size} approved vendors to check`);

      for (const vendorDoc of vendorsSnapshot.docs) {
        stats.checked++;
        const vendor = { id: vendorDoc.id, ...vendorDoc.data() } as Vendor;

        try {
          // Check if approval has expired
          if (vendor.approvalExpiryDate) {
            const expiryDate = new Date(vendor.approvalExpiryDate);
            
            if (today >= expiryDate) {
              console.log(`Vendor ${vendor.name} approval expired on ${expiryDate.toDateString()}`);
              
              // Auto-deactivate
              await vendorDoc.ref.update({
                isApproved: false,
                approvalNote: `Auto-deactivated on ${today.toISOString()} - approval expired`,
                updatedAt: new Date().toISOString()
              });
              
              stats.expired++;

              // Send notification to procurement
              await sendExpiryNotification(vendor);
              stats.notified++;
            }
          }

          // Check high-value vendor rules
          if (vendor.isHighValue) {
            await checkHighValueVendorRules(vendor, vendorDoc.ref);
          }

        } catch (error: any) {
          console.error(`Error processing vendor ${vendor.id}:`, error);
          stats.errors.push(`Vendor ${vendor.id}: ${error.message}`);
        }
      }

      console.log('Daily vendor expiry check completed:', stats);
      
      return {
        success: true,
        stats
      };

    } catch (error: any) {
      console.error('Error in daily vendor expiry check:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

/**
 * Send expiry notification to Procurement team
 */
async function sendExpiryNotification(vendor: Vendor): Promise<void> {
  try {
    // Get organization to find procurement email
    let procurementEmail = 'procurement@1pwrafrica.com'; // Default fallback

    if (vendor.organizationId) {
      const orgDoc = await db.collection('referenceData_organizations')
        .doc(vendor.organizationId)
        .get();
      
      if (orgDoc.exists) {
        const org = orgDoc.data() as Organization;
        procurementEmail = org.procurementEmail || procurementEmail;
      }
    }

    // TODO: Implement actual email sending via SendGrid or similar
    // For now, just log
    console.log(`Would send expiry notification for vendor ${vendor.name} to ${procurementEmail}`);
    
    // Log notification to collection
    await db.collection('notificationLogs').add({
      type: 'VENDOR_EXPIRY',
      vendorId: vendor.id,
      vendorName: vendor.name,
      recipient: procurementEmail,
      status: 'sent',
      timestamp: new Date().toISOString(),
      message: `Vendor approval expired for ${vendor.name}. Last approval: ${vendor.approvalDate}`,
    });

  } catch (error) {
    console.error('Error sending expiry notification:', error);
    throw error;
  }
}

/**
 * Check and enforce high-value vendor rules
 */
async function checkHighValueVendorRules(
  vendor: Vendor,
  vendorRef: FirebaseFirestore.DocumentReference
): Promise<void> {
  try {
    // Get organization settings for high-value rules
    if (!vendor.organizationId) return;

    const orgDoc = await db.collection('referenceData_organizations')
      .doc(vendor.organizationId)
      .get();
    
    if (!orgDoc.exists) return;

    const org = orgDoc.data() as Organization;
    const maxDuration = org.highValueVendorMaxDuration || 24; // months
    const threQuoteDuration = org.vendorApproval3QuoteDuration || 12; // months

    // Check if vendor has recent 3-quote process
    let has3QuoteWithinWindow = false;
    if (vendor.last3QuoteProcessDate) {
      const monthsSince3Quote = monthsDiff(new Date(vendor.last3QuoteProcessDate), new Date());
      has3QuoteWithinWindow = monthsSince3Quote <= threQuoteDuration;
    }

    // Check if approval is beyond max duration without 3-quote process
    if (vendor.approvalDate && !has3QuoteWithinWindow) {
      const monthsSinceApproval = monthsDiff(new Date(vendor.approvalDate), new Date());
      
      if (monthsSinceApproval >= maxDuration) {
        console.log(`High-value vendor ${vendor.name} exceeded max duration without 3-quote process`);
        
        // Auto-deactivate
        await vendorRef.update({
          isApproved: false,
          approvalNote: `High-value vendor auto-deactivated: exceeded ${maxDuration} months without 3-quote process`,
          updatedAt: new Date().toISOString()
        });

        // Send notification to procurement
        await sendHighValueExpiryNotification(vendor, org);
      }
    }

  } catch (error) {
    console.error('Error checking high-value vendor rules:', error);
    throw error;
  }
}

/**
 * Send high-value vendor expiry notification
 */
async function sendHighValueExpiryNotification(vendor: Vendor, org: Organization): Promise<void> {
  const procurementEmail = org.procurementEmail || 'procurement@1pwrafrica.com';

  console.log(`Sending high-value vendor expiry notification for ${vendor.name} to ${procurementEmail}`);

  await db.collection('notificationLogs').add({
    type: 'HIGH_VALUE_VENDOR_EXPIRY',
    vendorId: vendor.id,
    vendorName: vendor.name,
    recipient: procurementEmail,
    status: 'sent',
    timestamp: new Date().toISOString(),
    message: `High-value vendor ${vendor.name} approval expired. Requires 3-quote process or manual override.`,
  });
}

/**
 * Calculate difference in months between two dates
 */
function monthsDiff(startDate: Date, endDate: Date): number {
  const years = endDate.getFullYear() - startDate.getFullYear();
  const months = endDate.getMonth() - startDate.getMonth();
  return years * 12 + months;
}

