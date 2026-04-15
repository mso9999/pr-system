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

const ORG_CODE_MAP: Record<string, string> = {
  '1pwr_lesotho': '1PL', '1pwr_benin': '1PB', '1pwr_zambia': '1PZ',
  'neo1': 'NEO', 'pueco_benin': 'PCB', 'pueco_lesotho': 'PCL', 'smp': 'SMP',
  'mgb': 'MIO', 'mionwa': 'MIO', 'mionwa_gen': 'MIO',
};
const COUNTRY_CODE_MAP: Record<string, string> = {
  '1pwr_lesotho': 'LS', '1pwr_benin': 'BN', '1pwr_zambia': 'ZM',
  'neo1': 'LS', 'pueco_benin': 'BN', 'pueco_lesotho': 'LS', 'smp': 'LS',
  'mgb': 'BN', 'mionwa': 'BN', 'mionwa_gen': 'BN',
};

async function reassignPR() {
  const prNumber = '260327-0471-1PL-LS';
  const newOrg = 'SMP';
  const reason = 'Organizational reassignment from 1PWR Lesotho to SMP per admin request';
  const isDryRun = process.env.DRY_RUN !== 'false';

  console.log(`${isDryRun ? '[DRY RUN]' : '[APPLYING]'} Reassigning PR ${prNumber} to ${newOrg}\n`);

  // Find the PR by number
  const snapshot = await db.collection('purchaseRequests')
    .where('prNumber', '==', prNumber)
    .limit(1)
    .get();

  if (snapshot.empty) {
    console.error(`PR with number ${prNumber} not found!`);
    process.exit(1);
  }

  const docRef = snapshot.docs[0].ref;
  const data = snapshot.docs[0].data();

  console.log('=== CURRENT STATE ===');
  console.log('  ID:', snapshot.docs[0].id);
  console.log('  PR Number:', data.prNumber);
  console.log('  Organization:', data.organization);
  console.log('  Status:', data.status);
  console.log('  Approver:', data.approver || '(none)');
  console.log('  Approver2:', data.approver2 || '(none)');

  // Build new PR number
  const normalizedNewOrg = newOrg.toLowerCase();
  const orgCode = ORG_CODE_MAP[normalizedNewOrg] || newOrg.substring(0, 3).toUpperCase();
  const countryCode = COUNTRY_CODE_MAP[normalizedNewOrg] || 'XX';
  const parts = data.prNumber.split('-');
  parts[2] = orgCode;
  parts[3] = countryCode;
  const newPrNumber = parts.join('-');

  console.log('\n=== PLANNED CHANGES ===');
  console.log('  Organization:', data.organization, '→', newOrg);
  console.log('  PR Number:', data.prNumber, '→', newPrNumber);

  if (isDryRun) {
    console.log('\n[DRY RUN] No changes applied. Set DRY_RUN=false to apply.');
    return;
  }

  const statusHistoryEntry = {
    status: data.status,
    timestamp: new Date().toISOString(),
    user: {
      id: 'BSY3Ov0tOIgYXvM7bYBfVapjmXA2',
      email: 'matt@1pwrafrica.com',
      firstName: 'Matt',
      lastName: 'Orosz',
      name: 'Matt Orosz',
      role: 'admin',
      organization: '1PWR Lesotho',
      isActive: true,
      permissionLevel: 1,
      permissions: {}
    },
    notes: `Organization reassigned from ${data.organization} to ${newOrg}. PR number updated: ${data.prNumber} → ${newPrNumber}. Reason: ${reason}`
  };

  const existingHistory = data.statusHistory || [];

  await docRef.update({
    organization: newOrg,
    prNumber: newPrNumber,
    statusHistory: [...existingHistory, statusHistoryEntry],
    updatedAt: new Date().toISOString()
  });

  console.log('\nFix applied successfully!');

  // Verify
  const verifyDoc = await docRef.get();
  const verifyData = verifyDoc.data()!;
  console.log('\n=== VERIFICATION ===');
  console.log('  Organization:', verifyData.organization);
  console.log('  PR Number:', verifyData.prNumber);
  console.log('  Status:', verifyData.status);
}

reassignPR()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Script error:', err);
    process.exit(1);
  });
