/**
 * Inspect a user's PR user doc, nexus_users entry, and persisted Auth
 * custom claims — for diagnosing claim-based authorization issues.
 *
 * Usage:
 *   npx tsx src/scripts/inspectUserClaims.ts <name-or-email-substring> [...more]
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

initializeApp({ credential: applicationDefault(), projectId: 'pr-system-4ea55' });
const db = getFirestore();

async function main() {
  const needles = process.argv.slice(2).map((s) => s.toLowerCase());
  if (needles.length === 0) {
    console.error('Usage: inspectUserClaims.ts <name-or-email-substring> [...]');
    process.exit(1);
  }
  const users = await db.collection('users').get();
  for (const d of users.docs) {
    const data = d.data();
    const hay = [
      data.displayName, data.name, data.firstName, data.lastName, data.email,
    ].map((v) => String(v || '').toLowerCase()).join(' | ');
    if (!needles.some((n) => hay.includes(n))) continue;

    console.log('USER', d.id, '|', data.email, '| level:', data.permissionLevel,
      '| org:', data.organization, '| active:', data.isActive);
    const nx = await db.collection('nexus_users').doc(d.id).get();
    console.log('  nexus_users:', nx.exists
      ? JSON.stringify(nx.data()?.systemAccess || {})
      : 'MISSING');
    try {
      const authUser = await getAuth().getUser(d.id);
      const claims = (authUser.customClaims || {}) as Record<string, any>;
      console.log('  claims: nexus_sso=', claims.nexus_sso,
        '| targetSystem=', claims.targetSystem,
        '| privilegeVersion=', claims.privilegeVersion);
      console.log('  effectivePrivilege:', claims.effectivePrivilege
        ? JSON.stringify(claims.effectivePrivilege).slice(0, 400)
        : 'null');
      console.log('  systems.pr:', claims.systems?.pr
        ? JSON.stringify(claims.systems.pr).slice(0, 400)
        : 'MISSING');
    } catch (e: any) {
      console.log('  auth lookup failed:', e.message);
    }
    console.log('');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
