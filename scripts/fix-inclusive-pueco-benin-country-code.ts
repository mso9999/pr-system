/**
 * Migration Script: Fix PR Numbers for Inclusive/PUECO Benin (XX → BN)
 *
 * Problem: PRs submitted under the inclusive_pueco_benin org had 'XX' as the
 * country code in their prNumber because the org alias wasn't resolved before
 * the countryCodeMap lookup.
 *
 * This script will:
 * 1. Find all PRs for pueco_benin where prNumber contains '-XX'
 * 2. Replace '-XX' with '-BN' in prNumber
 * 3. Log all changes (dry-run by default)
 *
 * Run with:
 *   npx ts-node scripts/fix-inclusive-pueco-benin-country-code.ts           (dry run)
 *   npx ts-node scripts/fix-inclusive-pueco-benin-country-code.ts --apply   (apply)
 */

import { initializeApp, cert, ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as path from 'path';

const args = process.argv.slice(2);
const isDryRun = !args.includes('--apply');

// Same alias map as src/utils/organization.ts
const ORGANIZATION_ALIAS_MAP: Record<string, string> = {
  '1pwr_lesotho': '1pwr_lesotho',
  '1pwr_benin': '1pwr_benin',
  '1pwr_zambia': '1pwr_zambia',
  neo1: 'neo1',
  'pueco_lesotho': 'pueco_lesotho',
  'pueco_benin': 'pueco_benin',
  'inclusive_pueco_benin': 'pueco_benin',
  smp: 'smp',
  mgb: 'mgb',
  'mionwa_gen': 'mgb',
  mionwa: 'mgb',
  'mionwa_generation': 'mgb',
};

function normalizeOrg(input: string | any): string {
  if (!input) return '';
  const raw = typeof input === 'object' ? (input.code || input.id || input.name || '') : String(input);
  const normalized = raw.toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
  return ORGANIZATION_ALIAS_MAP[normalized] || normalized;
}

async function main() {
  console.log('='.repeat(70));
  console.log('MIGRATION: Fix XX → BN in prNumber for Inclusive/PUECO Benin PRs');
  console.log('='.repeat(70));
  console.log(`Mode: ${isDryRun ? 'DRY RUN (preview only)' : 'APPLY CHANGES'}\n`);

  // Initialize Firebase Admin
  try {
    const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      path.join(__dirname, '../pr-system-4ea55-firebase-adminsdk-f3uff-2cec628657.json');
    const serviceAccount = require(serviceAccountPath) as ServiceAccount;
    initializeApp({ credential: cert(serviceAccount) });
    console.log('✓ Firebase Admin initialized\n');
  } catch (error) {
    console.error('Failed to initialize Firebase Admin.');
    console.error('Make sure you have a serviceAccountKey.json or GOOGLE_APPLICATION_CREDENTIALS set.');
    console.error(error);
    process.exit(1);
  }

  const db = getFirestore();

  // Fetch all PRs whose prNumber contains '-XX'
  console.log('Querying PRs with "-XX" in prNumber...');
  const snapshot = await db.collection('purchaseRequests')
    .where('prNumber', '>=', '')
    .get();

  const toFix: Array<{ id: string; oldPrNumber: string; newPrNumber: string; organization: string }> = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const prNumber: string = data.prNumber || '';
    const organization = data.organization || '';
    const normalizedOrg = normalizeOrg(organization);

    // Only target pueco_benin PRs with XX country code
    if (normalizedOrg !== 'pueco_benin') continue;
    if (!prNumber.includes('-XX')) continue;

    const newPrNumber = prNumber.replace(/-XX(-|$)/, '-BN$1');
    toFix.push({ id: doc.id, oldPrNumber: prNumber, newPrNumber, organization });
  }

  if (toFix.length === 0) {
    console.log('\nNo pueco_benin PRs with "-XX" country code found. Nothing to do.');
    return;
  }

  console.log(`\nFound ${toFix.length} PR(s) to fix:\n`);
  for (const item of toFix) {
    console.log(`  [${item.id}]`);
    console.log(`    Organization : ${item.organization}`);
    console.log(`    Old prNumber : ${item.oldPrNumber}`);
    console.log(`    New prNumber : ${item.newPrNumber}`);
  }

  console.log('\n' + '='.repeat(70));

  if (isDryRun) {
    console.log('\nDRY RUN — no changes applied.');
    console.log('To apply, run with: npx ts-node scripts/fix-inclusive-pueco-benin-country-code.ts --apply');
    return;
  }

  // Apply fixes
  console.log('\nApplying fixes...');
  let successCount = 0;
  let errorCount = 0;

  for (const item of toFix) {
    try {
      await db.collection('purchaseRequests').doc(item.id).update({
        prNumber: item.newPrNumber,
        updatedAt: new Date().toISOString(),
        '_migration': {
          fixInclusivePuecoBenin: true,
          migratedAt: new Date().toISOString(),
          oldPrNumber: item.oldPrNumber,
          reason: 'Fixed country code XX → BN for inclusive_pueco_benin organization',
        },
      });
      console.log(`  ✓ ${item.oldPrNumber} → ${item.newPrNumber}`);
      successCount++;
    } catch (error) {
      console.error(`  ✗ Failed to update ${item.oldPrNumber}:`, error);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('MIGRATION COMPLETE');
  console.log('='.repeat(70));
  console.log(`  Total found : ${toFix.length}`);
  console.log(`  Updated     : ${successCount}`);
  console.log(`  Errors      : ${errorCount}`);
}

main().catch(console.error);
