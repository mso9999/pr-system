import { initializeApp, cert, ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as path from 'path';
import * as fs from 'fs';

const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || 
  path.join(process.cwd(), 'pr-system-4ea55-firebase-adminsdk-f3uff-2cec628657.json');

const serviceAccountJson = fs.readFileSync(serviceAccountPath, 'utf8');
const serviceAccount = JSON.parse(serviceAccountJson) as ServiceAccount;

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function checkPR() {
  const prId = 'da3xON8V5yHdgLsJ94hi';
  console.log(`Checking PR: ${prId}\n`);
  
  const doc = await db.collection('purchaseRequests').doc(prId).get();
  
  if (!doc.exists) {
    console.log('PR NOT FOUND');
    return;
  }

  const data = doc.data()!;
  console.log('=== BASIC INFO ===');
  console.log('PR Number:', data.prNumber);
  console.log('Organization:', data.organization);
  console.log('Status:', data.status);
  console.log('Amount:', data.currency, data.estimatedAmount);
  
  console.log('\n=== APPROVAL FIELDS ===');
  console.log('approver (top-level):', data.approver || '(not set)');
  console.log('approver2 (top-level):', data.approver2 || '(not set)');
  console.log('requiresDualApproval (top-level):', data.requiresDualApproval);
  
  console.log('\n=== APPROVAL WORKFLOW ===');
  const wf = data.approvalWorkflow;
  if (wf) {
    console.log('currentApprover:', wf.currentApprover || '(not set)');
    console.log('secondApprover:', wf.secondApprover || '(not set)');
    console.log('requiresDualApproval:', wf.requiresDualApproval);
    console.log('firstApprovalComplete:', wf.firstApprovalComplete);
    console.log('secondApprovalComplete:', wf.secondApprovalComplete);
    console.log('firstApproverJustification:', wf.firstApproverJustification || '(none)');
    console.log('secondApproverJustification:', wf.secondApproverJustification || '(none)');
    console.log('quoteConflict:', wf.quoteConflict);
    console.log('lastUpdated:', wf.lastUpdated);
    if (wf.approvalHistory?.length) {
      console.log('\nApproval History:');
      wf.approvalHistory.forEach((h: any, i: number) => {
        console.log(`  [${i}] approverId: ${h.approverId}, approved: ${h.approved}, timestamp: ${h.timestamp}, notes: ${h.notes}`);
      });
    } else {
      console.log('approvalHistory: (empty)');
    }
  } else {
    console.log('(no approvalWorkflow field)');
  }
  
  console.log('\n=== STATUS HISTORY ===');
  const sh = data.statusHistory;
  if (sh?.length) {
    sh.forEach((entry: any, i: number) => {
      const userName = entry.user?.name || entry.user?.email || entry.user?.id || 'unknown';
      console.log(`  [${i}] ${entry.status} by ${userName} at ${entry.timestamp} | notes: ${entry.notes || '(none)'}`);
    });
  } else {
    console.log('(no statusHistory)');
  }
  
  console.log('\n=== EXTERNAL APPROVAL BYPASS ===');
  console.log('externalApprovalBypass:', data.externalApprovalBypass || false);
  console.log('externalApprovalBy:', data.externalApprovalBy || '(not set)');
  console.log('externalApprovalDate:', data.externalApprovalDate || '(not set)');
}

checkPR()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Script error:', err);
    process.exit(1);
  });
