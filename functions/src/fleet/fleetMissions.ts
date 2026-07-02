/**
 * Callable Cloud Functions exposing Fleet Hub mission data to the PR frontend.
 *
 * The Fleet Integration Key is kept server-side (functions/.env); the browser only
 * sees the curated mission fields needed for field-camp provisioning prepopulation
 * (crew_size, departure/return dates, personnel manifest, destination).
 *
 *   listFleetMissions({ org?, approvalStatus? }) → FleetMission[]
 *   getFleetMission({ id, org? })                → FleetMission | null
 *   fleetSmokeTest()                              → { ok, status, message }
 */
import * as functions from "firebase-functions";
import {
  listFleetMissions as listFleetMissionsClient,
  getFleetMission as getFleetMissionClient,
  smokeTestFleet,
} from "./fleetMissionClient";

function requireAuth(context: any): void {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Sign-in required");
  }
}

export const listFleetMissions = functions
  .runWith({ memory: "256MB", timeoutSeconds: 30 })
  .https.onCall(async (data: { org?: string; approvalStatus?: string }, context) => {
    requireAuth(context);
    try {
      const rows = await listFleetMissionsClient({
        org: data?.org ? String(data.org) : undefined,
        approvalStatus: data?.approvalStatus ? String(data.approvalStatus) : undefined,
      });
      return { count: rows.length, missions: rows };
    } catch (err) {
      throw new functions.https.HttpsError(
        "internal",
        err instanceof Error ? err.message : String(err)
      );
    }
  });

export const getFleetMission = functions
  .runWith({ memory: "256MB", timeoutSeconds: 30 })
  .https.onCall(async (data: { id?: string; org?: string }, context) => {
    requireAuth(context);
    const id = String(data?.id || "").trim();
    if (!id) {
      throw new functions.https.HttpsError("invalid-argument", "id is required");
    }
    try {
      const mission = await getFleetMissionClient(id, data?.org ? String(data.org) : undefined);
      return { mission };
    } catch (err) {
      throw new functions.https.HttpsError(
        "internal",
        err instanceof Error ? err.message : String(err)
      );
    }
  });

export const fleetSmokeTest = functions.https.onCall(async (_data, context) => {
  requireAuth(context);
  return smokeTestFleet();
});
