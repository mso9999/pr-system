import { initializeApp, cert, ServiceAccount } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as path from 'path';
import * as fs from 'fs';

const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || 
  path.join(process.cwd(), 'pr-system-4ea55-firebase-adminsdk-f3uff-2cec628657.json');

const serviceAccountJson = fs.readFileSync(serviceAccountPath, 'utf8');
const serviceAccount = JSON.parse(serviceAccountJson) as ServiceAccount;

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function fixPR() {
  const prId = 'da3xON8V5yHdgLsJ94hi';
  const isDryRun = process.env.DRY_RUN !== 'false';
  
  console.log(`${isDryRun ? '[DRY RUN]' : '[APPLYING]'} Fixing PR: ${prId}\n`);
  
  const doc = await db.collection('purchaseRequests').doc(prId).get();
  if (!doc.exists) {
    console.error('PR not found!');
    process.exit(1);
  }

  const data = doc.data()!;
  console.log('Current state:');
  console.log('  Status:', data.status);
  console.log('  approver:', data.approver);
  console.log('  approver2:', data.approver2);
  console.log('  requiresDualApproval:', data.requiresDualApproval);
  console.log('  workflow.requiresDualApproval:', data.approvalWorkflow?.requiresDualApproval);
  console.log('  workflow.firstApprovalComplete:', data.approvalWorkflow?.firstApprovalComplete);
  console.log('  workflow.secondApprovalComplete:', data.approvalWorkflow?.secondApprovalComplete);
  console.log('  statusHistory entries:', data.statusHistory?.length);
  
  if (data.status !== 'APPROVED') {
    console.log('\nPR is not in APPROVED status, no fix needed.');
    return;
  }

  // Remove the duplicate APPROVED status history entries (indices 4 and 5)
  // and add a PENDING_APPROVAL reversion entry
  const existingHistory = data.statusHistory || [];
  const cleanedHistory = existingHistory.filter((entry: any) => entry.status !== 'APPROVED');
  
  const reversionEntry = {
    status: 'PENDING_APPROVAL',
    timestamp: new Date().toISOString(),
    user: {
      id: 'SYSTEM',
      email: 'system@1pwrafrica.com',
      firstName: 'System',
      lastName: 'Fix',
      name: 'System Fix',
      role: 'system',
      organization: 'system',
      isActive: true,
      permissionLevel: 0,
      permissions: {}
    },
    notes: 'Reverted from APPROVED: PR requires dual approval but was approved via single-approval code path due to missing field mapping bug. Second approver (Mable Muchangwe) approval preserved; waiting for first approver (Matt Orosz).'
  };

  const updatedHistory = [...cleanedHistory, reversionEntry];

  // Restore correct approval workflow:
  // - Mable (approver2 = pIiK86hwLCRhjBUJOldJebKaV6C2) already approved → secondApprovalComplete: true
  // - Matt (approver = BSY3Ov0tOIgYXvM7bYBfVapjmXA2) has NOT approved → firstApprovalComplete: false
  const correctedWorkflow = {
    currentApprover: data.approver,
    secondApprover: data.approver2,
    requiresDualApproval: true,
    firstApprovalComplete: false,
    secondApprovalComplete: true,
    firstApproverJustification: null,
    secondApproverJustification: data.approvalWorkflow?.firstApproverJustification || 'Lowest cost if we take unit price. This fills three trucks.',
    firstApproverSelectedQuoteId: null,
    secondApproverSelectedQuoteId: data.approvalWorkflow?.firstApproverSelectedQuoteId || null,
    quoteConflict: false,
    approvalHistory: data.approvalWorkflow?.approvalHistory || [],
    lastUpdated: new Date().toISOString()
  };

  console.log('\nPlanned changes:');
  console.log('  status: APPROVED → PENDING_APPROVAL');
  console.log('  workflow.requiresDualApproval: false → true');
  console.log('  workflow.firstApprovalComplete: true → false');
  console.log('  workflow.secondApprovalComplete: false → true');
  console.log('  workflow.secondApprover: (null) →', data.approver2);
  console.log('  workflow.secondApproverJustification:', correctedWorkflow.secondApproverJustification);
  console.log('  statusHistory: removed 2 duplicate APPROVED, added reversion entry');

  if (isDryRun) {
    console.log('\n[DRY RUN] No changes applied. Set DRY_RUN=false to apply.');
    return;
  }

  await db.collection('purchaseRequests').doc(prId).update({
    status: 'PENDING_APPROVAL',
    statusHistory: updatedHistory,
    requiresDualApproval: true,
    approvalWorkflow: correctedWorkflow,
    updatedAt: FieldValue.serverTimestamp()
  });

  console.log('\nFix applied successfully!');
  
  // Verify
  const verifyDoc = await db.collection('purchaseRequests').doc(prId).get();
  const verifyData = verifyDoc.data()!;
  console.log('\nVerification:');
  console.log('  Status:', verifyData.status);
  console.log('  workflow.requiresDualApproval:', verifyData.approvalWorkflow?.requiresDualApproval);
  console.log('  workflow.firstApprovalComplete:', verifyData.approvalWorkflow?.firstApprovalComplete);
  console.log('  workflow.secondApprovalComplete:', verifyData.approvalWorkflow?.secondApprovalComplete);
  console.log('  workflow.secondApprover:', verifyData.approvalWorkflow?.secondApprover);
}

fixPR()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Script error:', err);
    process.exit(1);
  });
