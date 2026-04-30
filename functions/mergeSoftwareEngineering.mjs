/**
 * Merge Software Engineering into Electrical Engineering: rename the
 * existing "Electrical Engineering" department docs to "Electrical &
 * Software Engineering" with code "EE/SE", and tag each with an aliases
 * array so users tagged any of {Electrical Engineering, Software
 * Engineering, Software, EE, SE} resolve to the same bucket on the HR
 * mirror.
 *
 * Why aliases (not a separate Software Engineering department)?
 *   1PWR's policy is to treat EE and SE as one team. A single department
 *   doc keeps payslip headcounts, project-allocation breakdowns, and
 *   badges consistent. Aliases preserve loose-text-tag interoperability
 *   so legacy "Software Engineering" entries still resolve.
 *
 * Idempotent: re-running this checks current state and only writes when
 * the rename / alias additions haven't been applied yet.
 *
 * Run:  node functions/mergeSoftwareEngineering.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const svcPath = join(__dirname, '../firebase-service-account.json');
const sa = JSON.parse(readFileSync(svcPath, 'utf8'));
if (!getApps().length) initializeApp({ credential: cert(sa) });
const db = getFirestore();

const NEW_NAME = 'Electrical & Software Engineering';
const NEW_CODE = 'EE/SE';
const ALIASES = [
  'Electrical Engineering',
  'Software Engineering',
  'Electrical',
  'Software',
  'EE',
  'SE',
  'EE/SE',
];

const targets = await db.collection('referenceData_departments')
  .where('name', '==', 'Electrical Engineering')
  .get();

if (targets.empty) {
  console.log('No "Electrical Engineering" department docs found — nothing to rename.');
  process.exit(0);
}

let touched = 0;
for (const doc of targets.docs) {
  const data = doc.data();
  const update = {};

  if (data.name !== NEW_NAME) update.name = NEW_NAME;
  if (data.code !== NEW_CODE) update.code = NEW_CODE;

  // Aliases — merge with whatever's already there.
  const existing = Array.isArray(data.aliases) ? data.aliases : [];
  const merged = Array.from(new Set([...existing, ...ALIASES]));
  if (merged.length !== existing.length) update.aliases = merged;

  if (Object.keys(update).length === 0) {
    console.log(`[skip]   ${doc.id}  org=${data.organizationId}  already up to date`);
    continue;
  }

  update.updatedAt = Timestamp.now();
  await doc.ref.update(update);
  touched++;
  console.log(`[update] ${doc.id}  org=${data.organizationId}  ${JSON.stringify(update)}`);
}

console.log(`\nDone. Updated ${touched} department doc(s).`);
