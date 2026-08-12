/**
 * Backfill purchaseRequests/{id}.organizationId + .organizationCountry.
 *
 * Why: the Nexus claim-based read gate scopes PR visibility by the signed
 * effectivePrivilege scopeCountries (ISO-2). The gate compares against
 * organizationCountry on the document; organizationId is the canonical
 * org slug (1pwr_*-style). Legacy docs only carry the display-name
 * `organization` string. Rules treat docs WITHOUT organizationCountry as
 * not-yet-backfilled and keep them readable, so this backfill is what
 * actually switches the gate on per document.
 *
 * Behavior:
 *  - organizationId = normalizeOrganizationId(doc.organization) (alias map
 *    in src/utils/organization.ts handles names, codes, and legacy slugs).
 *  - organizationCountry = the org catalog's `country`, normalized to
 *    ISO-2. Catalog lookup tries normalized doc id and name.
 *  - Docs whose org cannot be resolved are reported and left untouched.
 *
 * Usage:
 *   npx tsx src/scripts/backfillPrOrgScope.ts           # dry run
 *   npx tsx src/scripts/backfillPrOrgScope.ts --apply   # write
 *
 * Auth: Application Default Credentials (gcloud auth
 * application-default login) or GOOGLE_APPLICATION_CREDENTIALS.
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import {
  normalizeOrganizationId,
  normalizeCountryIso2,
  organizationCountryFallback,
} from '../utils/organization';

const APPLY = process.argv.includes('--apply');
const PROJECT = 'pr-system-4ea55';

initializeApp({ credential: applicationDefault(), projectId: PROJECT });
const db = getFirestore();

async function main() {
  const orgSnap = await db.collection('organizations').get();
  const countryByOrg = new Map<string, string>();
  let catalogPatched = 0;
  for (const doc of orgSnap.docs) {
    const data = doc.data();
    let country = normalizeCountryIso2(data.country);
    if (!country) {
      // Catalog docs predate the country field — repair from the verified
      // fallback map so HR's pr_organizations sync and the client create
      // path both resolve country going forward.
      country = organizationCountryFallback(doc.id) || organizationCountryFallback(data.name);
      if (country && APPLY) {
        await doc.ref.update({ country });
        catalogPatched++;
      }
    }
    if (!country) continue;
    for (const key of [doc.id, data.id, data.name, data.code]) {
      const normalized = normalizeOrganizationId(key as string);
      if (normalized && !countryByOrg.has(normalized)) {
        countryByOrg.set(normalized, country);
      }
    }
  }
  console.log(`Org catalog: ${orgSnap.size} docs, ${countryByOrg.size} resolvable org keys`);
  console.log(`Catalog country fields ${APPLY ? 'repaired' : 'to repair'}: ${catalogPatched || 'see below'}`);
  for (const [org, country] of [...countryByOrg.entries()].sort()) {
    console.log(`  ${org} -> ${country}`);
  }

  const prSnap = await db.collection('purchaseRequests').get();
  console.log(`\npurchaseRequests: ${prSnap.size} docs`);

  let alreadySet = 0, patched = 0, noOrg = 0, unresolved = 0;
  const unresolvedOrgs = new Map<string, number>();
  const batchLimit = 400;
  let batch = db.batch();
  let batchCount = 0;

  const flush = async () => {
    if (APPLY && batchCount > 0) {
      await batch.commit();
    }
    batch = db.batch();
    batchCount = 0;
  };

  for (const doc of prSnap.docs) {
    const data = doc.data();
    if (data.organizationId && data.organizationCountry) {
      alreadySet++;
      continue;
    }
    const organizationId = normalizeOrganizationId(data.organization);
    if (!organizationId) {
      noOrg++;
      continue;
    }
    const organizationCountry =
      countryByOrg.get(organizationId) || organizationCountryFallback(organizationId);
    if (!organizationCountry) {
      unresolved++;
      unresolvedOrgs.set(organizationId, (unresolvedOrgs.get(organizationId) || 0) + 1);
      continue;
    }
    batch.update(doc.ref, { organizationId, organizationCountry });
    batchCount++;
    patched++;
    if (batchCount >= batchLimit) await flush();
  }
  await flush();

  console.log(`\nAlready scoped: ${alreadySet}`);
  console.log(`Missing organization field: ${noOrg}`);
  console.log(`Unresolved org (left untouched): ${unresolved}`);
  for (const [org, count] of [...unresolvedOrgs.entries()].sort()) {
    console.log(`  ${org}: ${count}`);
  }
  console.log(`${APPLY ? 'Patched' : 'Would patch'}: ${patched}`);
  if (!APPLY) console.log('\nDry run — re-run with --apply to write.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
