/**
 * Auth onCreate audit logger.
 *
 * Fires whenever a Firebase Auth user is created (admin SDK, console,
 * or normal sign-up). Writes a record to `userCreationAudit/<uid>`
 * with the provider, email, displayName, and creation time so we have
 * a forensic trail of every Auth account ever created.
 *
 * Anonymous Auth accounts (no email AND no provider data) are
 * deliberately NOT logged — the project is shared with 1PWR AM which
 * uses anonymous auth and would flood this collection.
 *
 * This is write-only. It does NOT block, modify, or delete the user.
 */
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

const db = admin.firestore();

export const authUserCreated = functions.auth.user().onCreate(async (user) => {
  try {
    const isAnonymous =
      !user.email && (!user.providerData || user.providerData.length === 0);
    if (isAnonymous) return;

    const providerIds = (user.providerData || []).map((p) => p.providerId);
    const record = {
      uid: user.uid,
      email: user.email || null,
      emailVerified: user.emailVerified,
      displayName: user.displayName || null,
      phoneNumber: user.phoneNumber || null,
      providerIds,
      disabled: user.disabled,
      createdAt: user.metadata.creationTime || new Date().toISOString(),
      observedAt: new Date().toISOString(),
    };

    await db
      .collection("userCreationAudit")
      .doc(user.uid)
      .set(record, { merge: true });
  } catch (e) {
    console.error("authUserCreated logger failed:", e);
  }
});
