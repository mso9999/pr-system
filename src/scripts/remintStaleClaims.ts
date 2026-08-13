/**
 * Invoke the Nexus adminRemintStalePrivilegeClaims callable as the local
 * superadmin operator: mints a custom token for the operator uid, exchanges
 * it for an ID token via Identity Toolkit, then POSTs the callable.
 *
 * Usage:
 *   npx tsx src/scripts/remintStaleClaims.ts           # dry run
 *   npx tsx src/scripts/remintStaleClaims.ts --apply   # write
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const APPLY = process.argv.includes('--apply');
const OPERATOR_UID = 'BSY3Ov0tOIgYXvM7bYBfVapjmXA2'; // mso@1pwrafrica.com (Nexus superadmin)
const WEB_API_KEY = 'AIzaSyD0tA1fvWs5dCr-7JqJv_bxlay2Bhs72jQ';
const FUNCTION_URL = 'https://us-central1-pr-system-4ea55.cloudfunctions.net/adminRemintStalePrivilegeClaims';

initializeApp({ credential: applicationDefault(), projectId: 'pr-system-4ea55' });

async function main() {
  const customToken = await getAuth().createCustomToken(OPERATOR_UID);
  const signIn = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${WEB_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    }
  );
  if (!signIn.ok) throw new Error(`signInWithCustomToken failed: HTTP ${signIn.status}`);
  const { idToken } = (await signIn.json()) as { idToken: string };

  const response = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ data: { dryRun: !APPLY } }),
  });
  if (!response.ok) throw new Error(`callable failed: HTTP ${response.status} ${await response.text()}`);
  const payload = (await response.json()) as { result: Record<string, unknown> };
  const r = payload.result;
  console.log(`dryRun=${r.dryRun} scanned=${r.scanned} current=${r.current} stale=${r.stale} reminted=${r.reminted} failed=${r.failed} skippedNoSso=${r.skippedNoSso}`);
  for (const u of (r.staleUsers as Array<Record<string, unknown>>) || []) {
    console.log(` ${u.email}  ${u.from} -> ${u.to}${u.error ? '  ERROR: ' + u.error : ''}`);
    console.log(`    prActions: ${JSON.stringify(u.prActions)}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
