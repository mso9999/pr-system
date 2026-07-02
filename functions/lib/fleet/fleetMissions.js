"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.fleetSmokeTest = exports.getFleetMission = exports.listFleetMissions = void 0;
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
const functions = __importStar(require("firebase-functions"));
const fleetMissionClient_1 = require("./fleetMissionClient");
function requireAuth(context) {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Sign-in required");
    }
}
exports.listFleetMissions = functions
    .runWith({ memory: "256MB", timeoutSeconds: 30 })
    .https.onCall(async (data, context) => {
    requireAuth(context);
    try {
        const rows = await (0, fleetMissionClient_1.listFleetMissions)({
            org: (data === null || data === void 0 ? void 0 : data.org) ? String(data.org) : undefined,
            approvalStatus: (data === null || data === void 0 ? void 0 : data.approvalStatus) ? String(data.approvalStatus) : undefined,
        });
        return { count: rows.length, missions: rows };
    }
    catch (err) {
        throw new functions.https.HttpsError("internal", err instanceof Error ? err.message : String(err));
    }
});
exports.getFleetMission = functions
    .runWith({ memory: "256MB", timeoutSeconds: 30 })
    .https.onCall(async (data, context) => {
    requireAuth(context);
    const id = String((data === null || data === void 0 ? void 0 : data.id) || "").trim();
    if (!id) {
        throw new functions.https.HttpsError("invalid-argument", "id is required");
    }
    try {
        const mission = await (0, fleetMissionClient_1.getFleetMission)(id, (data === null || data === void 0 ? void 0 : data.org) ? String(data.org) : undefined);
        return { mission };
    }
    catch (err) {
        throw new functions.https.HttpsError("internal", err instanceof Error ? err.message : String(err));
    }
});
exports.fleetSmokeTest = functions.https.onCall(async (_data, context) => {
    requireAuth(context);
    return (0, fleetMissionClient_1.smokeTestFleet)();
});
//# sourceMappingURL=fleetMissions.js.map