/**
 * Migration Script: Reconcile Olivier's Duplicate Accounts
 * 
 * Problem: Olivier has two user accounts:
 * - OLD: ID=Yj4ME65G0heJq5J1gcac0IQ0AWM2, email=olivier@1pwrbenin.com
 * - CORRECT: ID=zxtrN6r6YdS7iamxJQobq6exAq62, email=odumont@1pwrbenin.com
 * 
 * This script will:
 * 1. Find all PRs that reference the OLD approver ID
 * 2. Update them to use the CORRECT approver ID
 * 3. Delete/deactivate the OLD user account
 * 
 * Run with: npx ts-node scripts/reconcile-olivier-accounts.ts
 */

import { initializeApp, cert, ServiceAccount } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as path from 'path';

// IDs from the debug logs
const OLD_APPROVER_ID = 'Yj4ME65G0heJq5J1gcac0IQ0AWM2';
const CORRECT_APPROVER_ID = 'zxtrN6r6YdS7iamxJQobq6exAq62';

const OLD_EMAIL = 'olivier@1pwrbenin.com';
const CORRECT_EMAIL = 'odumont@1pwrbenin.com';

async function main() {
  // Initialize Firebase Admin
  try {
    const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || 
      path.join(__dirname, '../pr-system-4ea55-firebase-adminsdk-f3uff-2cec628657.json');
    
    const serviceAccount = require(serviceAccountPath) as ServiceAccount;
    
    initializeApp({
      credential: cert(serviceAccount)
    });
  } catch (error) {
    console.error('Failed to initialize Firebase Admin. Make sure you have a serviceAccountKey.json file or GOOGLE_APPLICATION_CREDENTIALS set.');
    console.error(error);
    process.exit(1);
  }

  const db = getFirestore();
  
  console.log('=== Reconciling Olivier\'s Accounts ===\n');
  console.log(`OLD account: ${OLD_APPROVER_ID} (${OLD_EMAIL})`);
  console.log(`CORRECT account: ${CORRECT_APPROVER_ID} (${CORRECT_EMAIL})\n`);

  // Step 1: Find all PRs with the old approver ID
  console.log('Step 1: Finding PRs with old approver ID...');
  
  const prsToUpdate: { id: string; data: any; collection: string }[] = [];
  
  // PRs are stored in 'purchaseRequests' collection
  const purchaseRequestsRef = db.collection('purchaseRequests');
  
  // Get all PRs and check for old approver ID
  console.log('Checking purchaseRequests collection...');
  const allPrsSnapshot = await purchaseRequestsRef.get();
  console.log(`Found ${allPrsSnapshot.size} total PRs in purchaseRequests collection`);
  
  for (const doc of allPrsSnapshot.docs) {
    const data = doc.data();
    const hasOldApprover = 
      data.approver === OLD_APPROVER_ID ||
      data.approver2 === OLD_APPROVER_ID ||
      data.approvalWorkflow?.currentApprover === OLD_APPROVER_ID ||
      data.approvalWorkflow?.secondApprover === OLD_APPROVER_ID ||
      (data.approvers && data.approvers.includes(OLD_APPROVER_ID));
    
    if (hasOldApprover) {
      prsToUpdate.push({
        id: doc.id,
        data: data,
        collection: 'purchaseRequests'
      });
    }
  }
  
  console.log(`Found ${prsToUpdate.length} PR(s) referencing old approver ID\n`);
  
  if (prsToUpdate.length > 0) {
    console.log('PRs to update:');
    for (const pr of prsToUpdate) {
      console.log(`  - ${pr.collection}/${pr.id}: ${pr.data.prNumber || pr.id}`);
    }
    console.log('');
  }
  
  // Step 2: Update the PRs
  console.log('Step 2: Updating PRs to use correct approver ID...');
  
  let updatedCount = 0;
  for (const pr of prsToUpdate) {
    const docRef = db.doc(`${pr.collection}/${pr.id}`);
    const updates: any = {
      updatedAt: new Date().toISOString(),
      '_migration': {
        reconcileOlivierAccounts: true,
        migratedAt: new Date().toISOString(),
        oldApproverId: OLD_APPROVER_ID,
        newApproverId: CORRECT_APPROVER_ID
      }
    };
    
    // Update approver field
    if (pr.data.approver === OLD_APPROVER_ID) {
      updates.approver = CORRECT_APPROVER_ID;
    }
    
    // Update approver2 field
    if (pr.data.approver2 === OLD_APPROVER_ID) {
      updates.approver2 = CORRECT_APPROVER_ID;
    }
    
    // Update approvalWorkflow
    if (pr.data.approvalWorkflow) {
      if (pr.data.approvalWorkflow.currentApprover === OLD_APPROVER_ID) {
        updates['approvalWorkflow.currentApprover'] = CORRECT_APPROVER_ID;
      }
      if (pr.data.approvalWorkflow.secondApprover === OLD_APPROVER_ID) {
        updates['approvalWorkflow.secondApprover'] = CORRECT_APPROVER_ID;
      }
    }
    
    // Update approvers array
    if (pr.data.approvers && pr.data.approvers.includes(OLD_APPROVER_ID)) {
      const newApprovers = pr.data.approvers.map((id: string) => 
        id === OLD_APPROVER_ID ? CORRECT_APPROVER_ID : id
      );
      updates.approvers = newApprovers;
    }
    
    try {
      await docRef.update(updates);
      console.log(`  ✓ Updated ${pr.collection}/${pr.id}`);
      updatedCount++;
    } catch (error) {
      console.error(`  ✗ Failed to update ${pr.collection}/${pr.id}:`, error);
    }
  }
  
  console.log(`\nUpdated ${updatedCount}/${prsToUpdate.length} PRs\n`);
  
  // Step 3: Deactivate/Delete the old user account
  console.log('Step 3: Deactivating old user account...');
  
  const oldUserRef = db.collection('users').doc(OLD_APPROVER_ID);
  const oldUserDoc = await oldUserRef.get();
  
  if (oldUserDoc.exists) {
    const oldUserData = oldUserDoc.data();
    console.log(`Found old user: ${oldUserData?.firstName} ${oldUserData?.lastName} (${oldUserData?.email})`);
    
    // Option A: Deactivate (safer - keeps history)
    await oldUserRef.update({
      isActive: false,
      deactivatedAt: new Date().toISOString(),
      deactivationReason: 'Duplicate account - merged with ' + CORRECT_APPROVER_ID,
      '_migration': {
        reconcileOlivierAccounts: true,
        migratedTo: CORRECT_APPROVER_ID,
        migratedAt: new Date().toISOString()
      }
    });
    console.log(`  ✓ Deactivated old user account ${OLD_APPROVER_ID}`);
    
    // Option B: Delete (uncomment if you want to completely remove)
    // await oldUserRef.delete();
    // console.log(`  ✓ Deleted old user account ${OLD_APPROVER_ID}`);
  } else {
    console.log(`  Old user account ${OLD_APPROVER_ID} not found in users collection`);
  }
  
  console.log('\n=== Migration Complete ===');
  console.log(`PRs updated: ${updatedCount}`);
  console.log(`Old account deactivated: ${oldUserDoc.exists ? 'Yes' : 'Not found'}`);
  console.log('\nOlivier should now be able to see action buttons when logged in as odumont@1pwrbenin.com');
}

main().catch(console.error);

