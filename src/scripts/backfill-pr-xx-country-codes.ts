/**
 * Backfill PR numbers that contain -XX by resolving the correct country code
 * from static org maps and referenceData_organizations.country.
 *
 * Run:
 *   npx tsx src/scripts/backfill-pr-xx-country-codes.ts
 *   npx tsx src/scripts/backfill-pr-xx-country-codes.ts --apply
 *
 * Note: Patches buffer.SlowBuffer before firebase-admin loads (removed in Node 21+).
 */

import { readFileSync, existsSync } from 'fs';
import { createRequire } from 'module';
import * as path from 'path';
import { getOrgCodes, mapIsoCountryToPrCountryCode } from '../utils/prOrgCountryCodes.ts';
import { normalizeOrganizationId } from '../utils/organization.ts';

const require = createRequire(import.meta.url);
const nodeBuffer = require('buffer') as typeof import('buffer') & { SlowBuffer?: typeof Buffer };
if (!nodeBuffer.SlowBuffer) {
  nodeBuffer.SlowBuffer = nodeBuffer.Buffer;
}

const args = process.argv.slice(2);
const isApply = args.includes('--apply');

async function resolveCountryForBackfill(
  db: import('firebase-admin/firestore').Firestore,
  organization: string
): Promise<string> {
  const base = getOrgCodes(organization);
  if (base.countryCode !== 'XX') {
    return base.countryCode;
  }

  const normalized = normalizeOrganizationId(organization);
  const rawTrim = typeof organization === 'string' ? organization.trim() : '';
  const slug = rawTrim.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const candidates = [...new Set([normalized, slug].filter((x) => x.length > 0))];

  for (const key of candidates) {
    const snap = await db.collection('referenceData_organizations').doc(key).get();
    if (snap.exists) {
      const data = snap.data() as { country?: string } | undefined;
      const suffix = mapIsoCountryToPrCountryCode(data?.country);
      if (suffix !== 'XX') {
        return suffix;
      }
    }
  }

  return 'XX';
}

function replacePrCountrySuffix(prNumber: string, newCountry: string): string | null {
  const parts = prNumber.split('-');
  if (parts.length < 4) return null;
  parts[parts.length - 1] = newCountry;
  return parts.join('-');
}

async function main() {
  const { initializeApp, cert } = await import('firebase-admin/app');
  type ServiceAccount = import('firebase-admin/app').ServiceAccount;
  const { getFirestore } = await import('firebase-admin/firestore');

  console.log('='.repeat(72));
  console.log('Backfill: PR numbers with -XX → resolved country code');
  console.log(`Mode: ${isApply ? 'APPLY' : 'DRY RUN'}\n`);

  const serviceAccountPath =
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    path.join(process.cwd(), 'pr-system-4ea55-firebase-adminsdk-f3uff-2cec628657.json');

  if (!existsSync(serviceAccountPath)) {
    console.error('Missing service account JSON. Set GOOGLE_APPLICATION_CREDENTIALS or add key at:', serviceAccountPath);
    process.exit(1);
  }

  const raw = readFileSync(serviceAccountPath, 'utf8');
  const serviceAccount = JSON.parse(raw) as ServiceAccount;
  initializeApp({ credential: cert(serviceAccount) });

  const db = getFirestore();
  const snapshot = await db.collection('purchaseRequests').get();

  const updates: Array<{ id: string; old: string; next: string; org: string; country: string }> = [];

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    const prNumber: string = data.prNumber || '';
    const organization: string = data.organization || '';

    if (!prNumber.includes('-XX')) continue;

    const country = await resolveCountryForBackfill(db, organization);
    if (country === 'XX') {
      console.warn(`Skip (unresolved): ${docSnap.id} org="${organization}" prNumber=${prNumber}`);
      continue;
    }

    const next = replacePrCountrySuffix(prNumber, country);
    if (!next || next === prNumber) continue;

    updates.push({
      id: docSnap.id,
      old: prNumber,
      next,
      org: organization,
      country,
    });
  }

  console.log(`Found ${updates.length} PR(s) to update.\n`);
  for (const u of updates) {
    console.log(`  ${u.id}`);
    console.log(`    org: ${u.org}`);
    console.log(`    ${u.old}  →  ${u.next}`);
  }

  if (!isApply) {
    console.log('\nDry run only. Re-run with --apply to write changes.');
    return;
  }

  for (const u of updates) {
    await db.collection('purchaseRequests').doc(u.id).update({
      prNumber: u.next,
      updatedAt: new Date().toISOString(),
    });
    console.log(`Updated ${u.id}`);
  }

  console.log('\nDone.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
