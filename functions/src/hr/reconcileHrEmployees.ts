/**
 * One-time / on-demand HR → PR reconciliation trigger.
 *
 *   reconcileHrEmployees    — callable (admin-only). Runs the full
 *                             reconciliation, persists a report to
 *                             hrReconciliationReports/<ts>, returns totals.
 *   weeklyHrReconciliation  — scheduled (Mondays 06:30 Africa/Maseru).
 *                             Detects departures that the nightly
 *                             incremental sync cannot see.
 */
import * as functions from "firebase-functions";
import {
  runReconciliation,
  assertAdmin,
  type SyncReport,
} from "./hrEmployeeSyncCore";

export const reconcileHrEmployees = functions
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
      const report: SyncReport = await runReconciliation({ detectDepartures: true });
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

export const weeklyHrReconciliation = functions
  .runWith({ timeoutSeconds: 540, memory: "512MB" })
  .pubsub.schedule("30 6 * * 1") // Mondays at 06:30
  .timeZone("Africa/Maseru")
  .onRun(async () => {
    console.log("[hrSync] weeklyHrReconciliation starting");
    try {
      const report = await runReconciliation({ detectDepartures: true });
      console.log("[hrSync] weeklyHrReconciliation done:", report.totals);
    } catch (err) {
      console.error("[hrSync] weeklyHrReconciliation failed:", err);
    }
    return null;
  });
