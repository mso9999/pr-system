import * as functions from 'firebase-functions';

/**
 * RETIRED (2026-08-11) — this function used to write the legacy PR custom
 * claims (admin / procurement / requester / permissionLevel). Authorization
 * is now claim-only: the signed Nexus `effectivePrivilege` claim, minted at
 * SSO time from the nexus_users.systemAccess.pr assignment, is the sole
 * authority, and no PR component reads the legacy claims anymore.
 *
 * The export is kept (failing closed) so a stale caller gets a clear error
 * instead of silently succeeding against a claim nobody enforces. The
 * function can be fully deleted in a later deploy once no caller remains.
 */
export const setUserClaims = functions.https.onCall(async () => {
  throw new functions.https.HttpsError(
    'failed-precondition',
    'Legacy PR custom claims are retired. PR access is assigned in Nexus ' +
    '(systemAccess.pr.permissionLevel) and signed into the SSO claim at ' +
    'launch; the user relaunches PR from the Nexus portal to receive it.'
  );
});
