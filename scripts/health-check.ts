import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

const serviceAccountPath = path.join(process.cwd(), 'pr-system-4ea55-firebase-adminsdk-f3uff-2cec628657.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  storageBucket: 'pr-system-4ea55.firebasestorage.app',
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

interface AttachmentInfo {
  name: string;
  url: string;
  path?: string;
  size: number;
}

function extractAttachments(obj: any, prefix = ''): AttachmentInfo[] {
  const results: AttachmentInfo[] = [];
  if (!obj || typeof obj !== 'object') return results;

  if (obj.url && obj.name && typeof obj.size === 'number') {
    results.push({ name: obj.name, url: obj.url, path: obj.path, size: obj.size });
    return results;
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      results.push(...extractAttachments(item, prefix));
    }
    return results;
  }

  for (const [key, value] of Object.entries(obj)) {
    if (['attachments', 'proformaInvoice', 'proofOfPayment', 'deliveryPhotos', 'poDocument', 'deliveryNotes'].includes(key)) {
      results.push(...extractAttachments(value, `${prefix}${key}.`));
    }
    if (['lineItems', 'quotes'].includes(key) && Array.isArray(value)) {
      for (const item of value as any[]) {
        if (item?.attachments) {
          results.push(...extractAttachments(item.attachments, `${prefix}${key}[].attachments.`));
        }
      }
    }
  }
  return results;
}

async function checkFirestoreCollections() {
  console.log('\n' + '='.repeat(70));
  console.log('  FIRESTORE COLLECTIONS');
  console.log('='.repeat(70));

  const knownCollections = [
    'purchaseRequests',
    'users',
    'counters',
    'notifications',
    'purchaseRequestsNotifications',
    'notificationLogs',
    'archivePRs',
    'exchangeRates',
    'approvalRules',
    'referenceData_departments',
    'referenceData_organizations',
    'referenceData_permissions',
    'referenceData_vendors',
    'referenceData_currencies',
    'referenceData_rules',
    'referenceData_sites',
    'referenceData_expenseTypes',
    'referenceData_projectCategories',
    'referenceData_uom',
    'referenceData_vehicles',
    'referenceData_paymentTypes',
    'organizations',
    'departments',
    'permissions',
    'rules',
  ];

  const counts: Record<string, number> = {};

  for (const col of knownCollections) {
    try {
      const snapshot = await db.collection(col).get();
      counts[col] = snapshot.size;
    } catch (e: any) {
      counts[col] = -1;
    }
  }

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  console.log('\n  Collection                              Documents');
  console.log('  ' + '-'.repeat(55));
  let totalDocs = 0;
  for (const [name, count] of sorted) {
    if (count === 0) continue;
    const label = count === -1 ? 'ERROR' : count.toString();
    console.log(`  ${name.padEnd(42)} ${label}`);
    if (count > 0) totalDocs += count;
  }
  console.log('  ' + '-'.repeat(55));
  console.log(`  ${'TOTAL'.padEnd(42)} ${totalDocs}`);

  const emptyOnes = sorted.filter(([, c]) => c === 0).map(([n]) => n);
  if (emptyOnes.length > 0) {
    console.log(`\n  Empty collections: ${emptyOnes.join(', ')}`);
  }

  return counts;
}

async function checkPRsByOrgAndStatus() {
  console.log('\n' + '='.repeat(70));
  console.log('  PURCHASE REQUESTS — BY ORGANIZATION & STATUS');
  console.log('='.repeat(70));

  const snapshot = await db.collection('purchaseRequests').get();
  const byOrg: Record<string, Record<string, number>> = {};
  const allStatuses = new Set<string>();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const org = data.organization || '(none)';
    const status = data.status || '(none)';
    allStatuses.add(status);
    if (!byOrg[org]) byOrg[org] = {};
    byOrg[org][status] = (byOrg[org][status] || 0) + 1;
  }

  const statusList = [...allStatuses].sort();
  for (const [org, statuses] of Object.entries(byOrg).sort()) {
    const total = Object.values(statuses).reduce((a, b) => a + b, 0);
    console.log(`\n  ${org} (${total} PRs)`);
    for (const s of statusList) {
      if (statuses[s]) {
        console.log(`    ${s.padEnd(25)} ${statuses[s]}`);
      }
    }
  }

  console.log(`\n  GRAND TOTAL: ${snapshot.size} PRs`);
  return snapshot;
}

async function checkStorageBucket() {
  console.log('\n' + '='.repeat(70));
  console.log('  FIREBASE STORAGE — BUCKET INVENTORY');
  console.log('='.repeat(70));

  const [files] = await bucket.getFiles();

  let totalSize = 0;
  const byPrefix: Record<string, { count: number; size: number }> = {};

  for (const file of files) {
    const size = parseInt(file.metadata.size as string, 10) || 0;
    totalSize += size;

    const parts = file.name.split('/');
    let prefix: string;
    if (parts[0] === 'temp') {
      prefix = 'temp/';
    } else if (parts[0] === 'pr' && parts.length >= 3) {
      prefix = `pr/${parts[1]}/`;
    } else {
      prefix = parts[0] + '/';
    }

    if (!byPrefix[prefix]) byPrefix[prefix] = { count: 0, size: 0 };
    byPrefix[prefix].count++;
    byPrefix[prefix].size += size;
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  console.log(`\n  Total files: ${files.length}`);
  console.log(`  Total size:  ${formatSize(totalSize)}`);

  const tempFiles = Object.entries(byPrefix).filter(([k]) => k === 'temp/');
  const prFiles = Object.entries(byPrefix).filter(([k]) => k.startsWith('pr/'));
  const otherFiles = Object.entries(byPrefix).filter(([k]) => k !== 'temp/' && !k.startsWith('pr/'));

  if (tempFiles.length > 0) {
    console.log(`\n  TEMP FILES (orphaned uploads):`);
    for (const [prefix, info] of tempFiles) {
      console.log(`    ${prefix.padEnd(42)} ${String(info.count).padEnd(6)} files   ${formatSize(info.size)}`);
    }
  }

  if (prFiles.length > 0) {
    console.log(`\n  PR / VENDOR FILES (by folder, top 20 by size):`);
    const sorted = prFiles.sort((a, b) => b[1].size - a[1].size).slice(0, 20);
    for (const [prefix, info] of sorted) {
      console.log(`    ${prefix.padEnd(42)} ${String(info.count).padEnd(6)} files   ${formatSize(info.size)}`);
    }
    if (prFiles.length > 20) {
      console.log(`    ... and ${prFiles.length - 20} more folders`);
    }
  }

  if (otherFiles.length > 0) {
    console.log(`\n  OTHER:`);
    for (const [prefix, info] of otherFiles) {
      console.log(`    ${prefix.padEnd(42)} ${String(info.count).padEnd(6)} files   ${formatSize(info.size)}`);
    }
  }

  return { files, byPrefix, totalSize };
}

async function crossReferenceAttachments(prSnapshot: admin.firestore.QuerySnapshot) {
  console.log('\n' + '='.repeat(70));
  console.log('  ATTACHMENT CROSS-REFERENCE — PR DOCS vs STORAGE');
  console.log('='.repeat(70));

  let totalAttachmentRecords = 0;
  let totalAttachmentSizeFromDocs = 0;
  let attachmentsWithPath = 0;
  let attachmentsWithTempPath = 0;
  let attachmentsWithPermanentPath = 0;
  let attachmentsWithNoPath = 0;
  const prAttachmentCounts: { prNumber: string; org: string; count: number; totalSize: number }[] = [];

  for (const doc of prSnapshot.docs) {
    const data = doc.data();
    const attachments = extractAttachments(data);
    if (attachments.length === 0) continue;

    totalAttachmentRecords += attachments.length;
    let prSize = 0;

    for (const att of attachments) {
      prSize += att.size || 0;
      totalAttachmentSizeFromDocs += att.size || 0;

      if (att.path) {
        attachmentsWithPath++;
        if (att.path.startsWith('temp/')) attachmentsWithTempPath++;
        else attachmentsWithPermanentPath++;
      } else {
        attachmentsWithNoPath++;
      }
    }

    prAttachmentCounts.push({
      prNumber: data.prNumber || doc.id,
      org: data.organization || '(none)',
      count: attachments.length,
      totalSize: prSize,
    });
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  console.log(`\n  Total attachment records across all PRs:  ${totalAttachmentRecords}`);
  console.log(`  Cumulative size (from doc metadata):      ${formatSize(totalAttachmentSizeFromDocs)}`);
  console.log(`  Attachments with storage path:            ${attachmentsWithPath}`);
  console.log(`    - temp/ paths:                          ${attachmentsWithTempPath}`);
  console.log(`    - permanent paths:                      ${attachmentsWithPermanentPath}`);
  console.log(`  Attachments with no path (URL only):      ${attachmentsWithNoPath}`);

  console.log(`\n  Top 15 PRs by attachment count:`);
  const topByCount = [...prAttachmentCounts].sort((a, b) => b.count - a.count).slice(0, 15);
  for (const pr of topByCount) {
    console.log(`    ${pr.prNumber.padEnd(30)} ${pr.org.padEnd(18)} ${String(pr.count).padEnd(5)} files   ${formatSize(pr.totalSize)}`);
  }

  console.log(`\n  Top 15 PRs by total attachment size:`);
  const topBySize = [...prAttachmentCounts].sort((a, b) => b.totalSize - a.totalSize).slice(0, 15);
  for (const pr of topBySize) {
    console.log(`    ${pr.prNumber.padEnd(30)} ${pr.org.padEnd(18)} ${String(pr.count).padEnd(5)} files   ${formatSize(pr.totalSize)}`);
  }

  const prsWithAttachments = prAttachmentCounts.length;
  const prsWithout = prSnapshot.size - prsWithAttachments;
  console.log(`\n  PRs with attachments: ${prsWithAttachments}`);
  console.log(`  PRs without:          ${prsWithout}`);
}

async function main() {
  console.log('='.repeat(70));
  console.log('  PR SYSTEM FIREBASE HEALTH CHECK');
  console.log(`  Project: pr-system-4ea55`);
  console.log(`  Time:    ${new Date().toISOString()}`);
  console.log('='.repeat(70));

  const collectionCounts = await checkFirestoreCollections();
  const prSnapshot = await checkPRsByOrgAndStatus();
  const storageInfo = await checkStorageBucket();
  await crossReferenceAttachments(prSnapshot);

  console.log('\n' + '='.repeat(70));
  console.log('  SUMMARY');
  console.log('='.repeat(70));
  console.log(`  Firestore documents:  ${Object.values(collectionCounts).filter(v => v > 0).reduce((a, b) => a + b, 0)}`);
  console.log(`  Storage files:        ${storageInfo.files.length}`);
  console.log(`  Storage size:         ${storageInfo.totalSize < 1024 * 1024 * 1024 ? (storageInfo.totalSize / (1024 * 1024)).toFixed(1) + ' MB' : (storageInfo.totalSize / (1024 * 1024 * 1024)).toFixed(2) + ' GB'}`);
  console.log(`  Purchase requests:    ${prSnapshot.size}`);
  console.log('='.repeat(70));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
