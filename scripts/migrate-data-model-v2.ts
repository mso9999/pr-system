/**
 * Database Migration Script v2
 * Migrates existing data to support new features from specifications alignment
 * 
 * WARNING: This script modifies database records. 
 * - Run in development environment first
 * - Create backups before running in production
 * - Review changes carefully
 * 
 * Usage:
 *   npx ts-node scripts/migrate-data-model-v2.ts
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import * as path from 'path';

// Initialize Firebase Admin
const serviceAccountPath = path.resolve(__dirname, '../serviceAccountKey.json');

let app;
try {
  app = initializeApp({
    credential: cert(serviceAccountPath)
  });
} catch (error: any) {
  if (error.code === 'app/duplicate-app') {
    console.log('Firebase app already initialized');
  } else {
    throw error;
  }
}

const db = getFirestore();

interface MigrationStats {
  prsProcessed: number;
  prsUpdated: number;
  orgsProcessed: number;
  orgsUpdated: number;
  vendorsProcessed: number;
  vendorsUpdated: number;
  errors: string[];
}

const stats: MigrationStats = {
  prsProcessed: 0,
  prsUpdated: 0,
  orgsProcessed: 0,
  orgsUpdated: 0,
  vendorsProcessed: 0,
  vendorsUpdated: 0,
  errors: []
};

/**
 * Migrate PRs to add new fields
 */
async function migratePRs() {
  console.log('\n📝 Migrating Purchase Requests...');
  
  try {
    const prsSnapshot = await db.collection('purchaseRequests').get();
    
    for (const doc of prsSnapshot.docs) {
      stats.prsProcessed++;
      const pr = doc.data();
      const updates: any = {};
      let needsUpdate = false;
      
      // Add objectType based on status
      if (!pr.objectType) {
        updates.objectType = ['APPROVED', 'ORDERED', 'COMPLETED'].includes(pr.status) ? 'PO' : 'PR';
        needsUpdate = true;
      }
      
      // Initialize requiresDualApproval if missing
      if (pr.requiresDualApproval === undefined) {
        updates.requiresDualApproval = false;
        needsUpdate = true;
      }
      
      // Enhance approvalWorkflow if it exists but is missing new fields
      if (pr.approvalWorkflow) {
        const workflowUpdates: any = {};
        
        if (pr.approvalWorkflow.requiresDualApproval === undefined) {
          workflowUpdates.requiresDualApproval = false;
        }
        if (pr.approvalWorkflow.firstApprovalComplete === undefined) {
          workflowUpdates.firstApprovalComplete = false;
        }
        if (pr.approvalWorkflow.secondApprovalComplete === undefined) {
          workflowUpdates.secondApprovalComplete = false;
        }
        
        if (Object.keys(workflowUpdates).length > 0) {
          updates.approvalWorkflow = {
            ...pr.approvalWorkflow,
            ...workflowUpdates
          };
          needsUpdate = true;
        }
      } else {
        // Initialize approvalWorkflow if missing
        updates.approvalWorkflow = {
          currentApprover: pr.approver || null,
          secondApprover: null,
          requiresDualApproval: false,
          firstApprovalComplete: false,
          secondApprovalComplete: false,
          approvalHistory: [],
          lastUpdated: new Date().toISOString()
        };
        needsUpdate = true;
      }
      
      // Initialize document management fields to null/undefined (they'll be set when needed)
      if (pr.proformaInvoice === undefined) {
        // Don't need to explicitly set undefined fields
      }
      
      if (needsUpdate) {
        try {
          await doc.ref.update(updates);
          stats.prsUpdated++;
          if (stats.prsUpdated % 10 === 0) {
            console.log(`  Updated ${stats.prsUpdated} PRs...`);
          }
        } catch (error: any) {
          stats.errors.push(`PR ${doc.id}: ${error.message}`);
        }
      }
    }
    
    console.log(`✅ PRs Migration Complete: ${stats.prsUpdated} of ${stats.prsProcessed} updated`);
  } catch (error: any) {
    console.error('❌ Error migrating PRs:', error);
    stats.errors.push(`PR Migration: ${error.message}`);
  }
}

/**
 * Migrate Organizations to add new configuration fields
 */
async function migrateOrganizations() {
  console.log('\n🏢 Migrating Organizations...');
  
  try {
    const orgsSnapshot = await db.collection('referenceData_organizations').get();
    
    for (const doc of orgsSnapshot.docs) {
      stats.orgsProcessed++;
      const org = doc.data();
      const updates: any = {};
      let needsUpdate = false;
      
      // Set default values for new fields if they don't exist
      
      // Email Configuration (optional - leave empty for now)
      // procurementEmail, assetManagementEmail, adminEmail
      
      // Business Rules
      if (!org.baseCurrency) {
        updates.baseCurrency = 'LSL'; // Default currency
        needsUpdate = true;
      }
      
      if (!org.allowedCurrencies) {
        updates.allowedCurrencies = ['LSL', 'USD', 'ZAR'];
        needsUpdate = true;
      }
      
      // Vendor Approval Duration Settings (defaults in months)
      if (!org.vendorApproval3QuoteDuration) {
        updates.vendorApproval3QuoteDuration = 12;
        needsUpdate = true;
      }
      
      if (!org.vendorApprovalCompletedDuration) {
        updates.vendorApprovalCompletedDuration = 6;
        needsUpdate = true;
      }
      
      if (!org.vendorApprovalManualDuration) {
        updates.vendorApprovalManualDuration = 12;
        needsUpdate = true;
      }
      
      // High-Value Vendor Rules
      if (!org.highValueVendorMultiplier) {
        updates.highValueVendorMultiplier = 10;
        needsUpdate = true;
      }
      
      if (!org.highValueVendorMaxDuration) {
        updates.highValueVendorMaxDuration = 24;
        needsUpdate = true;
      }
      
      // Ensure active field exists
      if (org.active === undefined) {
        updates.active = true;
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        try {
          await doc.ref.update(updates);
          stats.orgsUpdated++;
          console.log(`  Updated organization: ${org.name || doc.id}`);
        } catch (error: any) {
          stats.errors.push(`Org ${doc.id}: ${error.message}`);
        }
      }
    }
    
    console.log(`✅ Organizations Migration Complete: ${stats.orgsUpdated} of ${stats.orgsProcessed} updated`);
  } catch (error: any) {
    console.error('❌ Error migrating organizations:', error);
    stats.errors.push(`Organizations Migration: ${error.message}`);
  }
}

/**
 * Migrate Vendors to add approval tracking fields
 */
async function migrateVendors() {
  console.log('\n🏭 Migrating Vendors...');
  
  try {
    const vendorsSnapshot = await db.collection('referenceData_vendors').get();
    
    for (const doc of vendorsSnapshot.docs) {
      stats.vendorsProcessed++;
      const vendor = doc.data();
      const updates: any = {};
      let needsUpdate = false;
      
      // Initialize approval tracking fields
      if (vendor.isApproved === undefined) {
        // Map old 'approved' field to new 'isApproved' if it exists
        updates.isApproved = vendor.approved === true;
        needsUpdate = true;
      }
      
      // Initialize other approval fields to null (they'll be set when vendor is approved)
      if (vendor.isApproved && !vendor.approvalDate) {
        // If already approved but missing date, set a default
        updates.approvalDate = new Date().toISOString();
        needsUpdate = true;
      }
      
      // Initialize high-value classification
      if (vendor.isHighValue === undefined) {
        updates.isHighValue = false;
        needsUpdate = true;
      }
      
      if (vendor.cumulativeOrderValue === undefined) {
        updates.cumulativeOrderValue = 0;
        needsUpdate = true;
      }
      
      // Ensure active field exists
      if (vendor.active === undefined) {
        updates.active = vendor.isActive !== false; // Default to true unless explicitly false
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        try {
          await doc.ref.update(updates);
          stats.vendorsUpdated++;
          if (stats.vendorsUpdated % 10 === 0) {
            console.log(`  Updated ${stats.vendorsUpdated} vendors...`);
          }
        } catch (error: any) {
          stats.errors.push(`Vendor ${doc.id}: ${error.message}`);
        }
      }
    }
    
    console.log(`✅ Vendors Migration Complete: ${stats.vendorsUpdated} of ${stats.vendorsProcessed} updated`);
  } catch (error: any) {
    console.error('❌ Error migrating vendors:', error);
    stats.errors.push(`Vendors Migration: ${error.message}`);
  }
}

/**
 * Print migration summary
 */
function printSummary() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 MIGRATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`\nPurchase Requests:`);
  console.log(`  Processed: ${stats.prsProcessed}`);
  console.log(`  Updated: ${stats.prsUpdated}`);
  console.log(`\nOrganizations:`);
  console.log(`  Processed: ${stats.orgsProcessed}`);
  console.log(`  Updated: ${stats.orgsUpdated}`);
  console.log(`\nVendors:`);
  console.log(`  Processed: ${stats.vendorsProcessed}`);
  console.log(`  Updated: ${stats.vendorsUpdated}`);
  
  if (stats.errors.length > 0) {
    console.log(`\n⚠️  Errors (${stats.errors.length}):`);
    stats.errors.forEach((error, index) => {
      console.log(`  ${index + 1}. ${error}`);
    });
  } else {
    console.log(`\n✅ No errors encountered`);
  }
  
  console.log('\n' + '='.repeat(60));
}

/**
 * Main migration function
 */
async function runMigration() {
  console.log('🚀 Starting Data Migration v2');
  console.log('='.repeat(60));
  
  const startTime = Date.now();
  
  try {
    // Run migrations sequentially
    await migratePRs();
    await migrateOrganizations();
    await migrateVendors();
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n⏱️  Total migration time: ${duration} seconds`);
    
    printSummary();
    
    console.log('\n✅ Migration completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Review the migration results above');
    console.log('2. Test the application to ensure data integrity');
    console.log('3. Check that new fields are accessible in the UI');
    console.log('4. Update any queries that depend on the new fields');
    
  } catch (error: any) {
    console.error('\n❌ Migration failed:', error);
    printSummary();
    process.exit(1);
  }
}

// Run the migration if this script is executed directly
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('\n👋 Migration script finished. Exiting...');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Fatal error:', error);
      process.exit(1);
    });
}

export { runMigration };

