import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';

const serviceAccount = JSON.parse(readFileSync(join(__dirname, '../firebase-service-account.json'), 'utf8'));
const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

async function listBeninOrgs() {
  const orgs = await db.collection('referenceData_organizations').where('country', '==', 'Benin').get();
  console.log('Benin organizations:');
  orgs.forEach(doc => {
    const data = doc.data();
    console.log(`  - ID: ${doc.id}, Name: ${data.name}, Code: ${data.code}`);
  });
  process.exit(0);
}

listBeninOrgs();



