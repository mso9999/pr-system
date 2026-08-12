/**
 * Backfill nexus_users/{uid}.systemAccess.pr from the legacy PR users
 * collection (users/{uid}.permissionLevel).
 *
 * Why: the 2026-08 claim-based authorization migration made the signed
 * Nexus claim the sole PR write authority, but existing PR users' numeric
 * permission levels lived only in the PR users collection — the resolver
 * (nexus-portal functions/src/privileges.ts) reads
 * nexus_users.systemAccess.pr.permissionLevel, so unmigrated users
 * received claims with no PR actions (2026-08-12 PR submission outage).
 *
 * Behavior:
 *  - Every active PR user with a numeric permissionLevel gets
 *    nexus_users/{uid}.systemAccess.pr = { enabled: true, permissionLevel }.
 *  - Existing systemAccess.pr entries are NOT overwritten (Nexus is
 *    authoritative once set); they are reported as skipped.
 *  - Inactive users (isActive === false) are reported but not written.
 *
 * Usage:
 *   npx tsx src/scripts/backfillNexusPrAccess.ts           # dry run
 *   npx tsx src/scripts/backfillNexusPrAccess.ts --apply   # write
 *
 * Auth: Application Default Credentials (gcloud auth
 * application-default login) or GOOGLE_APPLICATION_CREDENTIALS.
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const APPLY = process.argv.includes('--apply');
const PROJECT = 'pr-system-4ea55';

initializeApp({ credential: applicationDefault(), projectId: PROJECT });
const db = getFirestore();

async function main() {
  const usersSnap = await db.collection('users').get();
  console.log(`PR users collection: ${usersSnap.size} docs`);

  let eligible = 0, inactive = 0, noLevel = 0, alreadySet = 0, written = 0;
  const levelHistogram: Record<string, number> = {};
  const skippedExisting: string[] = [];

  for (const doc of usersSnap.docs) {
    const data = doc.data();
    const email = String(data.email ?? '').toLowerCase();
    const levelRaw = data.permissionLevel;
    const level = typeof levelRaw === 'number' ? levelRaw : Number(levelRaw);

    if (!Number.isFinite(level) || level <= 0) {
      noLevel++;
      continue;
    }
    if (data.isActive === false) {
      inactive++;
      continue;
    }
    eligible++;
    levelHistogram[level] = (levelHistogram[level] || 0) + 1;

    const nexusRef = db.collection('nexus_users').doc(doc.id);
    const nexusSnap = await nexusRef.get();
    const existing = nexusSnap.data()?.systemAccess?.pr;
    if (existing && typeof existing === 'object' && Object.keys(existing).length > 0) {
      alreadySet++;
      skippedExisting.push(`${email} (existing: ${JSON.stringify(existing)})`);
      continue;
    }

    if (APPLY) {
      await nexusRef.set(
        {
          email,
          systemAccess: {
            pr: {
              enabled: true,
              permissionLevel: level,
              backfilledFrom: 'users.permissionLevel',
              backfilledAt: FieldValue.serverTimestamp(),
            },
          },
        },
        { merge: true }
      );
      written++;
    }
  }

  console.log(`\nEligible active users with a level: ${eligible}`);
  console.log(`Level histogram: ${JSON.stringify(levelHistogram)}`);
  console.log(`Skipped (inactive): ${inactive}`);
  console.log(`Skipped (no numeric level): ${noLevel}`);
  console.log(`Skipped (nexus systemAccess.pr already set): ${alreadySet}`);
  for (const s of skippedExisting.slice(0, 20)) console.log(`   - ${s}`);
  if (skippedExisting.length > 20) console.log(`   … and ${skippedExisting.length - 20} more`);
  console.log(APPLY ? `\nWROTE ${written} nexus_users docs.` : `\nDRY RUN — would write ${eligible - alreadySet} docs. Re-run with --apply to write.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
