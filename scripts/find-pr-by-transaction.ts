import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
const firebaseConfig = {
  apiKey: 'AIzaSyD0tA1fvWs5dCr-7JqJv_bxlay2Bhs72jQ',
  authDomain: 'pr-system-4ea55.firebaseapp.com',
  projectId: 'pr-system-4ea55',
  storageBucket: 'pr-system-4ea55.firebasestorage.app',
  appId: '1:562987209098:web:2f788d189f1c0867cb3873',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

async function searchPRs() {
  await signInWithEmailAndPassword(auth, 'mso@1pwrafrica.com', '1PWR00');
  console.log('Authenticated. Searching...\n');

  const searchTerms = ['wenzhou', 'ouou', 'wzoodq', 'voltage protect', 'voltage protective', 'din rail', 'relay monitor', 'current limit'];
  const targetAmount = 9150;
  const amountTolerance = 500;

  const matches: any[] = [];

  // Search live PRs
  console.log('=== Searching purchaseRequests ===');
  const prSnap = await getDocs(collection(db, 'purchaseRequests'));
  console.log(`  Loaded ${prSnap.size} PRs`);

  prSnap.forEach((doc) => {
    const pr = doc.data();
    const prId = doc.id;
    const prNumber = pr.prNumber || '';
    const description = (pr.description || '').toLowerCase();
    const vendor = (pr.preferredVendor || pr.selectedVendor || pr.vendorName || pr.vendor?.name || '').toLowerCase();
    const supplierName = (pr.supplierName || '').toLowerCase();
    const amount = pr.estimatedAmount || pr.totalAmount || 0;
    const lineItemDescs = (pr.lineItems || []).map((li: any) => (li.description || '').toLowerCase()).join(' ');
    const quoteVendors = (pr.quotes || []).map((q: any) => `${(q.vendorName || '')} ${(q.notes || '')}`).join(' ').toLowerCase();
    const allText = `${description} ${vendor} ${supplierName} ${lineItemDescs} ${quoteVendors}`;

    const termMatch = searchTerms.some(t => allText.includes(t));
    const amountMatch = Math.abs(amount - targetAmount) <= amountTolerance;

    if (termMatch || amountMatch) {
      matches.push({
        source: 'LIVE',
        id: prId,
        prNumber,
        status: pr.status,
        amount,
        currency: pr.currency,
        vendor: vendor || supplierName || '(none)',
        description: (pr.description || '').substring(0, 100),
        lineItems: (pr.lineItems || []).map((li: any) => li.description).join('; ').substring(0, 100),
        matchReason: [
          termMatch ? 'text' : null,
          amountMatch ? `amount(${amount})` : null,
        ].filter(Boolean).join(', '),
      });
    }
  });

  // Search archive PRs  
  console.log('=== Searching archivePRs ===');
  const archSnap = await getDocs(collection(db, 'archivePRs'));
  console.log(`  Loaded ${archSnap.size} archive PRs`);

  archSnap.forEach((doc) => {
    const pr = doc.data();
    const prId = doc.id;
    const description = (pr.description || pr.reason || '').toLowerCase();
    const vendor = (pr.vendorName || pr.vendor || '').toLowerCase();
    const amount = pr.amount || 0;
    const allText = `${description} ${vendor}`;

    const termMatch = searchTerms.some(t => allText.includes(t));
    const amountMatch = amount > 0 && Math.abs(amount - targetAmount) <= amountTolerance;

    if (termMatch || amountMatch) {
      matches.push({
        source: 'ARCHIVE',
        id: prId,
        date: pr.submittedDate,
        amount,
        currency: pr.currency,
        vendor: vendor || '(none)',
        description: (pr.description || pr.reason || '').substring(0, 100),
        matchReason: [
          termMatch ? 'text' : null,
          amountMatch ? `amount(${amount})` : null,
        ].filter(Boolean).join(', '),
      });
    }
  });

  console.log(`\n=== Found ${matches.length} matches ===\n`);
  for (const m of matches) {
    console.log(`[${m.source}] ${m.prNumber || m.id}`);
    console.log(`  Match: ${m.matchReason}`);
    console.log(`  Amount: ${m.currency || '?'} ${m.amount}`);
    console.log(`  Vendor: ${m.vendor}`);
    console.log(`  Desc: ${m.description}`);
    if (m.lineItems) console.log(`  Items: ${m.lineItems}`);
    console.log(`  Status: ${m.status || m.date || '—'}`);
    console.log(`  ID: ${m.id}`);
    if (m.source === 'LIVE') console.log(`  URL: https://pr.1pwrafrica.com/pr/${m.id}`);
    if (m.source === 'ARCHIVE') console.log(`  URL: https://pr.1pwrafrica.com/archive/${m.id}`);
    console.log('');
  }

  if (matches.length === 0) {
    console.log('No exact matches. Listing all USD PRs with amount $8,000-$10,000:\n');
    prSnap.forEach((doc) => {
      const pr = doc.data();
      const amount = pr.estimatedAmount || pr.totalAmount || 0;
      const currency = (pr.currency || '').toUpperCase();
      if (currency === 'USD' && amount >= 8000 && amount <= 10000) {
        console.log(`  ${pr.prNumber} | USD ${amount} | ${pr.status} | ${(pr.description || '').substring(0, 60)}`);
        console.log(`    Vendor: ${pr.preferredVendor || pr.selectedVendor || pr.vendorName || '—'}`);
      }
    });
  }

  process.exit(0);
}

searchPRs().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
