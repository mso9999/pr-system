/**
 * Add a generic "Engineering" department to referenceData_departments for
 * 1PWR LESOTHO so existing user.department='Engineering' tags resolve to
 * something real on the HR side mirror.
 *
 * Background: the Departments.csv seed file lists "Electrical Engineering"
 * and "Mechanical Engineering" but Personnel.csv tags six engineers with
 * the umbrella "Engineering". The HR portal's department sync joins by
 * slugified-name (so "Engineering" must match a department doc whose
 * name slugs to "engineering"). Without an Engineering department row,
 * those six users land with no department on HR.
 *
 * This script adds the umbrella department once. Future cleanup (splitting
 * "Engineering" into "Electrical Engineering" / "Mechanical Engineering"
 * per person) can happen in the PR admin UI; they'll re-sync to HR
 * automatically on the next nightly run.
 *
 * Run from the repo root:
 *   node functions/addEngineeringDepartment.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const svcPath = join(__dirname, '../firebase-service-account.json');
const serviceAccount = JSON.parse(readFileSync(svcPath, 'utf8'));

if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount) });
}
const db = getFirestore();

async function ensureDepartment({ name, organizationId, organizationName, code = '' }) {
  // Upsert by (organizationId, name) so re-running this script is idempotent
  // and we don't create duplicate "Engineering" rows.
  const existing = await db.collection('referenceData_departments')
    .where('organizationId', '==', organizationId)
    .where('name', '==', name)
    .get();

  if (!existing.empty) {
    console.log(`[skip] Engineering already exists for ${organizationId}: doc ${existing.docs[0].id}`);
    return existing.docs[0].id;
  }

  const now = Timestamp.now();
  const docRef = await db.collection('referenceData_departments').add({
    name,
    organizationId,
    active: true,
    code,
    organization: { id: organizationId, name: organizationName },
    createdAt: now,
    updatedAt: now,
  });
  console.log(`[created] ${name} for ${organizationId}: doc ${docRef.id}`);
  return docRef.id;
}

const ORGS = [
  { id: '1pwr_lesotho', name: '1PWR LESOTHO' },
];

let failed = false;
for (const org of ORGS) {
  try {
    await ensureDepartment({
      name: 'Engineering',
      organizationId: org.id,
      organizationName: org.name,
      code: 'ENG',
    });
  } catch (err) {
    console.error(`[error] ${org.id}:`, err);
    failed = true;
  }
}

process.exit(failed ? 1 : 0);
