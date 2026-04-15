import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

const serviceAccountPath = path.join(process.cwd(), '..', 'firebase-service-account.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  storageBucket: 'pr-system-4ea55.firebasestorage.app'
});

const db = admin.firestore();

async function searchBroader() {
  console.log('Broader search for poles in Benin/Mionwa PRs...\n');
  
  const orgs = ['mgb', 'mionwa_gen', '1pwr_benin', 'Mionwa Gen', '1PWR BENIN', 'pueco_benin', 'Inclusive/PUECO BENIN'];
  const allPRs: any[] = [];
  
  for (const org of orgs) {
    try {
      const snapshot = await db.collection('purchaseRequests')
        .where('organization', '==', org)
        .orderBy('createdAt', 'desc')
        .limit(100)
        .get();
      
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        allPRs.push({
          id: doc.id,
          ...data
        });
      });
    } catch (e) {
      // Skip if index error
    }
  }
  
  console.log(`Total PRs from Benin/Mionwa: ${allPRs.length}\n`);
  
  // Search for anything that might be poles/poteaux
  const keywords = ['pole', 'poteau', 'pylone', 'pylône', 'support', 'mat', 'mât', 'pilier'];
  
  const matches = allPRs.filter(pr => {
    const desc = (pr.description || '').toLowerCase();
    const items = (pr.lineItems || []).map((li: any) => (li.description || '').toLowerCase()).join(' ');
    const allText = desc + ' ' + items;
    
    // Exclude molds and production equipment
    if (allText.includes('moule') || allText.includes('mould') || allText.includes('producing')) {
      return false;
    }
    
    return keywords.some(kw => allText.includes(kw));
  });
  
  console.log(`Found ${matches.length} PRs with pole-related keywords:\n`);
  
  matches.sort((a, b) => {
    const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
    const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
    return dateB.getTime() - dateA.getTime();
  });
  
  matches.slice(0, 15).forEach((pr, i) => {
    const date = pr.createdAt?.toDate?.() || new Date(pr.createdAt);
    const attachCount = (pr.attachments?.length || 0) + (pr.files?.length || 0);
    console.log(`${i + 1}. ${pr.prNumber} (${pr.organization})`);
    console.log(`   Status: ${pr.status}${attachCount > 0 ? ' [' + attachCount + ' files]' : ''}`);
    console.log(`   Amount: ${pr.currency} ${pr.estimatedAmount?.toLocaleString()}`);
    console.log(`   Date: ${date?.toLocaleDateString?.() || 'Unknown'}`);
    console.log(`   Description: ${pr.description?.substring(0, 120)}`);
    console.log(`   URL: https://pr.1pwrafrica.com/pr/${pr.id}\n`);
  });
  
  // Also list recent COMPLETED/ORDERED PRs that might have invoices
  console.log('\n--- Recent COMPLETED/ORDERED PRs (may have invoices) ---\n');
  
  const completedOrdered = allPRs.filter(pr => 
    ['COMPLETED', 'ORDERED', 'APPROVED'].includes(pr.status) &&
    ((pr.attachments?.length > 0) || (pr.files?.length > 0))
  );
  
  completedOrdered.sort((a, b) => {
    const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
    const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
    return dateB.getTime() - dateA.getTime();
  });
  
  completedOrdered.slice(0, 10).forEach((pr, i) => {
    const date = pr.createdAt?.toDate?.() || new Date(pr.createdAt);
    const attachCount = (pr.attachments?.length || 0) + (pr.files?.length || 0);
    console.log(`${i + 1}. ${pr.prNumber} - ${pr.description?.substring(0, 60)}`);
    console.log(`   Status: ${pr.status} | ${attachCount} files | ${pr.currency} ${pr.estimatedAmount?.toLocaleString()}`);
    console.log(`   URL: https://pr.1pwrafrica.com/pr/${pr.id}\n`);
  });
}

searchBroader()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
