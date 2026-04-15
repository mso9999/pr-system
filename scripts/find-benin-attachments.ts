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

async function findAttachments() {
  console.log('Finding all Benin/Mionwa PRs with attachments...\n');
  
  const orgs = ['mgb', 'mionwa_gen', '1pwr_benin', 'Mionwa Gen', '1PWR BENIN', 'pueco_benin', 'Inclusive/PUECO BENIN'];
  const allPRs: any[] = [];
  
  for (const org of orgs) {
    try {
      const snapshot = await db.collection('purchaseRequests')
        .where('organization', '==', org)
        .get();
      
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const attachments = data.attachments || [];
        const files = data.files || [];
        const quotes = data.quotes || [];
        
        // Collect all file names
        const allFiles: string[] = [];
        attachments.forEach((a: any) => allFiles.push(a.name || a.fileName || 'unnamed'));
        files.forEach((f: any) => allFiles.push(f.name || f.fileName || 'unnamed'));
        quotes.forEach((q: any) => {
          if (q.attachments) {
            q.attachments.forEach((a: any) => allFiles.push(`Quote: ${a.name || a.fileName || 'unnamed'}`));
          }
        });
        
        if (allFiles.length > 0) {
          allPRs.push({
            id: doc.id,
            prNumber: data.prNumber,
            organization: data.organization,
            status: data.status,
            description: data.description,
            estimatedAmount: data.estimatedAmount,
            currency: data.currency,
            createdAt: data.createdAt,
            files: allFiles,
            preferredVendor: data.preferredVendor
          });
        }
      });
    } catch (e) {
      console.log(`Error for org ${org}:`, e);
    }
  }
  
  // Sort by date
  allPRs.sort((a, b) => {
    const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
    const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
    return dateB.getTime() - dateA.getTime();
  });
  
  console.log(`Found ${allPRs.length} PRs with attachments:\n`);
  
  // Look for invoices or anything pole-related in file names
  const poleRelated = allPRs.filter(pr => {
    const allText = (pr.description + ' ' + pr.files.join(' ')).toLowerCase();
    return allText.includes('pole') || allText.includes('poteau') || 
           allText.includes('facture') || allText.includes('invoice');
  });
  
  if (poleRelated.length > 0) {
    console.log('=== PRs with pole/invoice keywords in description or filenames ===\n');
    poleRelated.forEach((pr, i) => {
      const date = pr.createdAt?.toDate?.() || new Date(pr.createdAt);
      console.log(`${i + 1}. ${pr.prNumber} (${pr.organization})`);
      console.log(`   Status: ${pr.status} | ${pr.currency} ${pr.estimatedAmount?.toLocaleString()}`);
      console.log(`   Date: ${date?.toLocaleDateString?.() || 'Unknown'}`);
      console.log(`   Description: ${pr.description?.substring(0, 100)}`);
      console.log(`   Files: ${pr.files.join(', ')}`);
      console.log(`   URL: https://pr.1pwrafrica.com/pr/${pr.id}\n`);
    });
  }
  
  console.log('\n=== All PRs with attachments (most recent first) ===\n');
  allPRs.slice(0, 20).forEach((pr, i) => {
    const date = pr.createdAt?.toDate?.() || new Date(pr.createdAt);
    console.log(`${i + 1}. ${pr.prNumber} - ${pr.description?.substring(0, 50)}`);
    console.log(`   ${pr.status} | ${pr.currency} ${pr.estimatedAmount?.toLocaleString()} | ${date?.toLocaleDateString?.()}`);
    console.log(`   Files: ${pr.files.slice(0, 3).join(', ')}${pr.files.length > 3 ? '...' : ''}`);
    console.log(`   URL: https://pr.1pwrafrica.com/pr/${pr.id}\n`);
  });
}

findAttachments()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
