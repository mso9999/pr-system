/**
 * Nightly incremental HR → PR sync.
 *
 *   nightlyHrEmployeeSync  — scheduled (daily 02:00 Africa/Maseru). Pulls
 *                            only rows HR has updated since the last cursor.
 *                            Cannot detect departures — see
 *                            weeklyHrReconciliation.
 *   runHrEmployeeSyncNow   — callable (admin-only) for ad-hoc incremental
 *                            runs from the admin UI.
 */
import * as functions from "firebase-functions";
import {
  runIncrementalSync,
  assertAdmin,
  type SyncReport,
} from "./hrEmployeeSyncCore";

export const nightlyHrEmployeeSync = functions
  .runWith({ timeoutSeconds: 540, memory: "512MB" })
  .pubsub.schedule("0 2 * * *") // daily at 02:00
  .timeZone("Africa/Maseru")
  .onRun(async () => {
    console.log("[hrSync] nightlyHrEmployeeSync starting");
    try {
      const report = await runIncrementalSync();
      console.log("[hrSync] nightlyHrEmployeeSync done:", report.totals);
    } catch (err) {
      console.error("[hrSync] nightlyHrEmployeeSync failed:", err);
    }
    return null;
  });

export const runHrEmployeeSyncNow = functions
  .runWith({ timeoutSeconds: 540, memory: "512MB" })
  .https.onCall(async (_data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Sign-in required");
    }
    try {
      await assertAdmin(context.auth.uid);
    } catch (err) {
      throw new functions.https.HttpsError("permission-denied", err instanceof Error ? err.message : String(err));
    }
    try {
      const report: SyncReport = await runIncrementalSync();
      return {
        success: true,
        totals: report.totals,
        reportId: new Date().toISOString().replace(/[:.]/g, "-"),
        unmappedDepartments: report.unmappedDepartments,
        errors: report.errors.slice(0, 25),
      };
    } catch (err) {
      throw new functions.https.HttpsError(
        "internal",
        err instanceof Error ? err.message : String(err)
      );
    }
  });
