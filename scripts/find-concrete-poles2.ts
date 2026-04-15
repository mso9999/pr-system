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
  console.log('Searching for concrete poles PURCHASES from Benin/Mionwa...\n');
  
  const orgs = ['mgb', 'mionwa_gen', '1pwr_benin', 'Mionwa Gen', '1PWR BENIN'];
  
  const allMatches: any[] = [];
  
  for (const org of orgs) {
    // Get ALL PRs and search more broadly
    const snapshot = await db.collection('purchaseRequests')
      .where('organization', '==', org)
      .orderBy('createdAt', 'desc')
      .limit(200)
      .get();
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const description = (data.description || '').toLowerCase();
      const lineItems = data.lineItems || [];
      
      // More specific search for actual poles (not molds)
      const poleKeywords = ['poteaux', 'poteau', 'concrete pole', 'poles béton', 'poteau béton', 
                           'poteau en béton', 'poteaux en béton', 'pylone', 'pylône'];
      
      // Exclude mold-related
      const excludeKeywords = ['moule', 'mould', 'mold', 'machine', 'producing', 'production'];
      
      const hasPolesInDesc = poleKeywords.some(kw => description.includes(kw));
      const hasExcludeInDesc = excludeKeywords.some(kw => description.includes(kw));
      
      const hasPolesInItems = lineItems.some((item: any) => {
        const itemDesc = (item.description || '').toLowerCase();
        return poleKeywords.some(kw => itemDesc.includes(kw));
      });
      
      const hasExcludeInItems = lineItems.some((item: any) => {
        const itemDesc = (item.description || '').toLowerCase();
        return excludeKeywords.some(kw => itemDesc.includes(kw));
      });
      
      // Also check for invoices/attachments
      const hasAttachments = (data.attachments && data.attachments.length > 0) ||
                             (data.files && data.files.length > 0);
      
      if ((hasPolesInDesc || hasPolesInItems) && !hasExcludeInDesc && !hasExcludeInItems) {
        allMatches.push({
          id: doc.id,
          prNumber: data.prNumber,
          organization: data.organization,
          status: data.status,
          description: data.description?.substring(0, 150),
          estimatedAmount: data.estimatedAmount,
          currency: data.currency,
          createdAt: data.createdAt,
          lineItems: lineItems.slice(0, 5).map((li: any) => li.description?.substring(0, 80)),
          hasAttachments,
          attachmentCount: (data.attachments?.length || 0) + (data.files?.length || 0),
          preferredVendor: data.preferredVendor
        });
      }
    });
  }
  
  // Also search for "poteau" in all PRs regardless of organization
  console.log('Also searching all organizations for "poteau"...\n');
  const allOrgsSnapshot = await db.collection('purchaseRequests')
    .orderBy('createdAt', 'desc')
    .limit(500)
    .get();
    
  allOrgsSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const description = (data.description || '').toLowerCase();
    const lineItems = data.lineItems || [];
    
    const poleKeywords = ['poteaux', 'poteau', 'concrete pole'];
    const excludeKeywords = ['moule', 'mould', 'mold'];
    
    const hasPolesInDesc = poleKeywords.some(kw => description.includes(kw));
    const hasExcludeInDesc = excludeKeywords.some(kw => description.includes(kw));
    
    const hasPolesInItems = lineItems.some((item: any) => {
      const itemDesc = (item.description || '').toLowerCase();
      return poleKeywords.some(kw => itemDesc.includes(kw));
    });
    
    // Check if already in matches
    const alreadyInMatches = allMatches.some(m => m.id === doc.id);
    
    if ((hasPolesInDesc || hasPolesInItems) && !hasExcludeInDesc && !alreadyInMatches) {
      allMatches.push({
        id: doc.id,
        prNumber: data.prNumber,
        organization: data.organization,
        status: data.status,
        description: data.description?.substring(0, 150),
        estimatedAmount: data.estimatedAmount,
        currency: data.currency,
        createdAt: data.createdAt,
        lineItems: lineItems.slice(0, 5).map((li: any) => li.description?.substring(0, 80)),
        hasAttachments: (data.attachments?.length > 0) || (data.files?.length > 0),
        attachmentCount: (data.attachments?.length || 0) + (data.files?.length || 0),
        preferredVendor: data.preferredVendor
      });
    }
  });
  
  // Sort by creation date descending
  allMatches.sort((a, b) => {
    const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt);
    const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt);
    return dateB.getTime() - dateA.getTime();
  });
  
  console.log(`Found ${allMatches.length} matching PRs:\n`);
  
  allMatches.forEach((pr, i) => {
    const date = pr.createdAt?.toDate?.() || new Date(pr.createdAt);
    console.log(`${i + 1}. ${pr.prNumber} (${pr.organization})`);
    console.log(`   Status: ${pr.status}${pr.hasAttachments ? ' [HAS ATTACHMENTS: ' + pr.attachmentCount + ']' : ''}`);
    console.log(`   Amount: ${pr.currency} ${pr.estimatedAmount?.toLocaleString()}`);
    console.log(`   Date: ${date.toLocaleDateString()}`);
    console.log(`   Vendor: ${pr.preferredVendor || 'N/A'}`);
    console.log(`   Description: ${pr.description}`);
    if (pr.lineItems.length > 0) {
      console.log(`   Line items: ${pr.lineItems.join(' | ')}`);
    }
    console.log(`   URL: https://pr.1pwrafrica.com/pr/${pr.id}\n`);
  });
}

findConcretePolesInvoice()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
