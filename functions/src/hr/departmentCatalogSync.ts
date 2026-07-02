/**
 * Department catalog sync triggers.
 *
 *   nightlyDepartmentCatalogSync  — scheduled (daily 01:00 Africa/Maseru).
 *                                   Runs BEFORE the 02:00 employee sync so
 *                                   the resolver has a fresh catalog.
 *   runDepartmentCatalogSyncNow   — callable (admin-only), incremental.
 *   reconcileDepartmentCatalog    — callable (admin-only), full + tombstone.
 */
import * as functions from "firebase-functions";
import { runCatalogSync, type CatalogSyncReport } from "./departmentCatalogSyncCore";
import { assertAdmin } from "./hrEmployeeSyncCore";

function summarize(r: CatalogSyncReport): string {
  const t = r.totals;
  return [
    `pulled ${t.pulled}`,
    `created ${t.created}`,
    `updated ${t.updated}`,
    `unchanged ${t.unchanged}`,
    t.tombstoned ? `tombstoned ${t.tombstoned}` : null,
    t.prNativeUntouched ? `pr-native untouched ${t.prNativeUntouched}` : null,
    t.unmappedOrgs ? `unmapped orgs ${t.unmappedOrgs}` : null,
    t.errors ? `errors ${t.errors}` : null,
  ]
    .filter(Boolean)
    .join(", ");
}

export const nightlyDepartmentCatalogSync = functions
  .runWith({ timeoutSeconds: 540, memory: "512MB" })
  .pubsub.schedule("0 1 * * *") // daily at 01:00
  .timeZone("Africa/Maseru")
  .onRun(async () => {
    console.log("[hrDeptSync] nightlyDepartmentCatalogSync starting");
    try {
      const report = await runCatalogSync({ full: true });
      console.log("[hrDeptSync] nightlyDepartmentCatalogSync done:", summarize(report));
    } catch (err) {
      console.error("[hrDeptSync] nightlyDepartmentCatalogSync failed:", err);
    }
    return null;
  });

export const runDepartmentCatalogSyncNow = functions
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
      const report: CatalogSyncReport = await runCatalogSync({ full: false });
      return {
        success: true,
        totals: report.totals,
        summary: summarize(report),
        unmappedOrgs: report.unmappedOrgs,
        errors: report.errors.slice(0, 25),
      };
    } catch (err) {
      throw new functions.https.HttpsError("internal", err instanceof Error ? err.message : String(err));
    }
  });

export const reconcileDepartmentCatalog = functions
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
      const report: CatalogSyncReport = await runCatalogSync({ full: true });
      return {
        success: true,
        totals: report.totals,
        summary: summarize(report),
        unmappedOrgs: report.unmappedOrgs,
        prNativeUntouched: report.prNativeUntouched.slice(0, 50),
        errors: report.errors.slice(0, 25),
      };
    } catch (err) {
      throw new functions.https.HttpsError("internal", err instanceof Error ? err.message : String(err));
    }
  });
