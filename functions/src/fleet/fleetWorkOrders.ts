/**
 * PR ↔ Fleet Hub work-order gate (procurement diligence).
 *
 * Policy: vehicle-expense PRs (expense type code 4 — parts, service, repairs)
 * must reference an open Fleet Hub work order before they can be pushed to an
 * approver. Fuel (code 11) and consumable fluids are exempt — see the expense
 * type configuration; the gate keys off the expense type's `code`.
 *
 * Callables (browser → server, Fleet key stays server-side):
 *   listFleetWorkOrders({ org?, vehicleId?, status? }) → picker data
 *   getFleetWorkOrder({ id })                          → validation
 *
 * Trigger:
 *   fleetPrLinkOnCreate — when a PR is created with fleetWorkOrderId, register
 *   the PR link back in FM (advances the WO needs-parts → pr-submitted and
 *   gives FM the per-vehicle cost trail).
 */
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import {
  getFleetWorkOrder as getFleetWorkOrderClient,
  listFleetWorkOrders as listFleetWorkOrdersClient,
  registerFleetWorkOrderPrLink,
} from "./fleetWorkOrderClient";

function requireAuth(context: any): void {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Sign-in required");
  }
}

/** Statuses that mean a WO no longer accepts procurement links. */
const TERMINAL_WO_STATUSES = new Set(["completed", "cancelled", "canceled", "closed"]);

export const listFleetWorkOrders = functions
  .runWith({ memory: "256MB", timeoutSeconds: 30 })
  .https.onCall(async (data: { org?: string; vehicleId?: string; status?: string }, context) => {
    requireAuth(context);
    try {
      const rows = await listFleetWorkOrdersClient({
        org: data?.org ? String(data.org) : undefined,
        vehicleId: data?.vehicleId ? String(data.vehicleId) : undefined,
        status: data?.status ? String(data.status) : "open",
      });
      return { count: rows.length, workOrders: rows };
    } catch (err) {
      throw new functions.https.HttpsError(
        "internal",
        err instanceof Error ? err.message : String(err)
      );
    }
  });

export const getFleetWorkOrder = functions
  .runWith({ memory: "256MB", timeoutSeconds: 30 })
  .https.onCall(async (data: { id?: string }, context) => {
    requireAuth(context);
    const id = String(data?.id || "").trim();
    if (!id) {
      throw new functions.https.HttpsError("invalid-argument", "id is required");
    }
    try {
      const workOrder = await getFleetWorkOrderClient(id);
      return { workOrder };
    } catch (err) {
      throw new functions.https.HttpsError(
        "internal",
        err instanceof Error ? err.message : String(err)
      );
    }
  });

/**
 * Re-validate a PR's WO link at push-to-approver time. Returns ok:true when the
 * WO exists, matches the PR's vehicle, and is not terminal. The client blocks
 * the transition on ok:false — this message is shown to the user verbatim.
 */
export const validateFleetWorkOrderForPr = functions
  .runWith({ memory: "256MB", timeoutSeconds: 30 })
  .https.onCall(async (data: { workOrderId?: string; vehicleId?: string }, context) => {
    requireAuth(context);
    const workOrderId = String(data?.workOrderId || "").trim();
    const vehicleId = String(data?.vehicleId || "").trim();
    if (!workOrderId) {
      return { ok: false, reason: "No Fleet Hub work order is linked to this PR." };
    }
    let wo;
    try {
      wo = await getFleetWorkOrderClient(workOrderId);
    } catch (err) {
      // FM unreachable — fail closed for the gate but say so explicitly.
      throw new functions.https.HttpsError(
        "unavailable",
        `Could not reach Fleet Hub to validate the work order: ${err instanceof Error ? err.message : String(err)}`
      );
    }
    if (!wo) {
      return { ok: false, reason: "The linked Fleet Hub work order no longer exists." };
    }
    if (vehicleId && wo.vehicleId && wo.vehicleId !== vehicleId) {
      return {
        ok: false,
        reason: `Work order is for ${wo.vehicleCode || "another vehicle"} — it does not match the vehicle on this PR.`,
      };
    }
    if (TERMINAL_WO_STATUSES.has(String(wo.status || "").toLowerCase())) {
      return {
        ok: false,
        reason: `Work order ${wo.title || workOrderId} is ${wo.status} — link an open work order instead.`,
      };
    }
    return { ok: true, workOrder: wo };
  });

/**
 * purchaseRequests onCreate: when the PR carries a Fleet work order, register
 * the link back in FM so the WO shows the PR and its amount (per-vehicle cost
 * trail). Fire-and-forget with a delivery marker — failures are logged on the
 * PR doc (fleetLinkError) rather than retried blindly.
 */
export const fleetPrLinkOnCreate = functions
  .runWith({ memory: "256MB", timeoutSeconds: 60 })
  .firestore.document("purchaseRequests/{prId}")
  .onCreate(async (snapshot, context) => {
    const data = snapshot.data();
    if (!data) return;
    const workOrderId = String(data.fleetWorkOrderId || "").trim();
    if (!workOrderId) return;

    const prId = context.params.prId as string;
    const prNumber = String(data.prNumber || prId);
    try {
      await registerFleetWorkOrderPrLink(workOrderId, {
        prNumber,
        vendor: String(
          data.preferredVendor?.name || data.selectedVendor?.name || data.vendorName || ""
        ),
        description: String(data.description || data.title || "").slice(0, 300),
        amount: Number(data.estimatedAmount || data.totalAmount || 0),
        currency: String(data.currency || "LSL"),
        status: String(data.status || "submitted").toLowerCase(),
        prSystemUrl: `https://pr.1pwrafrica.com/pr/${prId}`,
      });
      await snapshot.ref.update({
        fleetLinkRegisteredAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      functions.logger.info("[fleetPrLinkOnCreate] linked", { prId, prNumber, workOrderId });
    } catch (err) {
      functions.logger.error("[fleetPrLinkOnCreate] failed", {
        prId,
        workOrderId,
        error: err instanceof Error ? err.message : String(err),
      });
      await snapshot.ref
        .update({ fleetLinkError: err instanceof Error ? err.message : String(err) })
        .catch(() => undefined);
    }
  });
