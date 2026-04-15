import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// Initialize Firebase Admin
const serviceAccountPath = path.join(process.cwd(), '..', 'firebase-service-account.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  storageBucket: 'pr-system-4ea55.firebasestorage.app'
});

const db = admin.firestore();

async function findConcretePolesInvoice() {
  console.log('Searching for concrete poles invoices from Benin/Mionwa...\n');
  
  // Search for PRs containing "concrete poles" or "poteaux" (French) in description
  // from MGB or Benin organizations
  const orgs = ['mgb', 'mionwa_gen', '1pwr_benin', 'Mionwa Gen', '1PWR BENIN'];
  
  const allMatches: any[] = [];
  
  for (const org of orgs) {
    const snapshot = await db.collection('purchaseRequests')
      .where('organization', '==', org)
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const description = (data.description || '').toLowerCase();
      const lineItems = data.lineItems || [];
      
      // Check description and line items for "concrete poles" or "poteaux"
      const hasConcretePolesInDesc = description.includes('concrete') || 
                                      description.includes('pole') ||
                                      description.includes('poteaux') ||
                                      description.includes('béton');
      
      const hasConcretePolesInItems = lineItems.some((item: any) => {
        const itemDesc = (item.description || '').toLowerCase();
        return itemDesc.includes('concrete') || 
               itemDesc.includes('pole') ||
               itemDesc.includes('poteaux') ||
               itemDesc.includes('béton');
      });
      
      if (hasConcretePolesInDesc || hasConcretePolesInItems) {
        allMatches.push({
          id: doc.id,
          prNumber: data.prNumber,
          organization: data.organization,
          status: data.status,
          description: data.description?.substring(0, 100),
          estimatedAmount: data.estimatedAmount,
          currency: data.currency,
          createdAt: data.createdAt,
          lineItems: lineItems.map((li: any) => li.description?.substring(0, 50))
        });
      }
    });
  }
  
  // Sort by creation date descending
  allMatches.sort((a, b) => {
    const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt);
    const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt);
    return dateB.getTime() - dateA.getTime();
  });
  
  console.log(`Found ${allMatches.length} matching PRs:\n`);
  
  allMatches.slice(0, 10).forEach((pr, i) => {
    const date = pr.createdAt?.toDate?.() || new Date(pr.createdAt);
    console.log(`${i + 1}. ${pr.prNumber} (${pr.organization})`);
    console.log(`   Status: ${pr.status}`);
    console.log(`   Amount: ${pr.currency} ${pr.estimatedAmount?.toLocaleString()}`);
    console.log(`   Date: ${date.toLocaleDateString()}`);
    console.log(`   Description: ${pr.description}`);
    console.log(`   Line items: ${pr.lineItems.join(', ')}`);
    console.log(`   URL: https://pr.1pwrafrica.com/pr/${pr.id}\n`);
  });
}

findConcretePolesInvoice()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
