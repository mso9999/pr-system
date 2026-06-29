/**
 * Per-user refresh from HR (admin-only callable).
 *
 * Looks up one employee by HR employee_id and either updates the matched
 * PR user's HR-owned fields or provisions a new PR account. Useful from
 * the User Management screen's "Refresh from HR" action.
 */
import * as functions from "firebase-functions";
import { refreshOneUser, assertAdmin } from "./hrEmployeeSyncCore";

export const refreshUserFromHr = functions.https.onCall(
  async (data: { employeeId?: string }, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Sign-in required");
    }
    try {
      await assertAdmin(context.auth.uid);
    } catch (err) {
      throw new functions.https.HttpsError("permission-denied", err instanceof Error ? err.message : String(err));
    }
    const employeeId = String(data?.employeeId || "").trim();
    if (!employeeId) {
      throw new functions.https.HttpsError("invalid-argument", "employeeId is required");
    }
    try {
      const result = await refreshOneUser(employeeId);
      return { success: true, ...result };
    } catch (err) {
      throw new functions.https.HttpsError(
        "internal",
        err instanceof Error ? err.message : String(err)
      );
    }
  }
);

export const hrSmokeTest = functions.https.onCall(async (_data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Sign-in required");
  }
  try {
    await assertAdmin(context.auth.uid);
  } catch (err) {
    throw new functions.https.HttpsError("permission-denied", err instanceof Error ? err.message : String(err));
  }
  // Lazy import to avoid loading the client at module init for non-HR workloads.
  const { smokeTest } = await import("./hrDirectoryClient");
  return smokeTest();
});
