import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

const serviceAccountPath = path.join(process.cwd(), '..', 'firebase-service-account.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
});

const db = admin.firestore();

async function checkZambiaData() {
  console.log('Checking reference data for 1PWR ZAMBIA...\n');
  
  const orgNames = ['1PWR ZAMBIA', '1pwr_zambia', 'zambia'];
  
  // Check organization exists
  const orgsSnapshot = await db.collection('organizations').get();
  console.log('Organizations in database:');
  orgsSnapshot.docs.forEach(doc => {
    const data = doc.data();
    console.log(`  - ${doc.id}: ${data.name} (${data.code})`);
  });
  
  // Check departments for Zambia
  console.log('\nDepartments for Zambia:');
  for (const org of orgNames) {
    const depts = await db.collection('departments')
      .where('organizationId', '==', org)
      .get();
    if (depts.size > 0) {
      console.log(`  Found ${depts.size} departments for org "${org}"`);
    }
  }
  
  // Check approvers for Zambia
  console.log('\nApprovers for Zambia:');
  const users = await db.collection('users').get();
  const zambiaUsers = users.docs.filter(doc => {
    const data = doc.data();
    const orgs = data.assignedOrganizations || [];
    return orgs.some((o: string) => o.toLowerCase().includes('zambia'));
  });
  console.log(`  Found ${zambiaUsers.length} users assigned to Zambia orgs`);
  zambiaUsers.forEach(doc => {
    const data = doc.data();
    console.log(`    - ${data.firstName} ${data.lastName} (Level ${data.permissionLevel})`);
  });
  
  // Check the specific PR
  console.log('\n\nChecking PR da3xON8V5yHdgLsJ94hi...');
  const prDoc = await db.collection('purchaseRequests').doc('da3xON8V5yHdgLsJ94hi').get();
  const prData = prDoc.data();
  
  console.log('PR Organization:', prData?.organization);
  console.log('PR createdAt:', prData?.createdAt);
  console.log('PR createdAt type:', typeof prData?.createdAt);
  
  if (prData?.createdAt && prData.createdAt.toDate) {
    console.log('PR createdAt as Date:', prData.createdAt.toDate());
  }
  
  // Check if there are any issues with the PR data
  console.log('\n\nChecking for potentially problematic fields...');
  for (const [key, value] of Object.entries(prData || {})) {
    if (value === null) {
      console.log(`  - ${key}: null`);
    } else if (value === undefined) {
      console.log(`  - ${key}: undefined`);
    } else if (typeof value === 'object' && value !== null) {
      if (value.constructor?.name === 'Timestamp') {
        // This is a Firestore Timestamp - should be handled OK
      } else if (Array.isArray(value) && value.length === 0) {
        // Empty array - OK
      }
    }
  }
}

checkZambiaData()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
