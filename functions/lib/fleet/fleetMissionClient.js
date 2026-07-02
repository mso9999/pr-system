"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseManifest = parseManifest;
exports.missionDays = missionDays;
exports.listFleetMissions = listFleetMissions;
exports.getFleetMission = getFleetMission;
exports.smokeTestFleet = smokeTestFleet;
/**
 * Server-to-server client for the 1PWR Fleet Hub mission API.
 *
 * Used by the PR field-camp provisioning wizard to prepopulate "number of persons"
 * (crew_size) and "number of days" (departure_date → return_date) from a linked
 * Fleet mission. The Fleet Integration Key is kept server-side — never exposed to
 * the browser.
 *
 * Endpoint: GET <FLEET_API_BASE_URL>/api/integrations/v1/missions
 *   Query: org=<organizationId>, id=<missionId>, hrRequestId=<...>, approvalStatus=<...>
 *   Auth:  X-Fleet-Integration-Key: <FLEET_INTEGRATION_API_KEY>
 *   Response: an array of mission rows, or a single row / null when `id` is supplied.
 *
 * Base URL defaults to https://fm.1pwrafrica.com. Override with FLEET_API_BASE_URL.
 */
const DEFAULT_BASE_URL = "https://fm.1pwrafrica.com";
const TIMEOUT_MS = 8000;
function getFetch() {
    const fn = globalThis.fetch;
    if (!fn) {
        throw new Error("fetch is not available in this runtime");
    }
    return fn;
}
function baseUrl() {
    return String(process.env.FLEET_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
}
function apiKey() {
    return String(process.env.FLEET_INTEGRATION_API_KEY || "").trim();
}
function buildQuery(params) {
    const parts = [];
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && String(v).trim() !== "") {
            parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
        }
    }
    return parts.length ? `?${parts.join("&")}` : "";
}
async function getJson(path) {
    const key = apiKey();
    if (!key) {
        throw new Error("FLEET_INTEGRATION_API_KEY is not set — cannot call Fleet API");
    }
    const url = `${baseUrl()}${path}`;
    const fetchFn = getFetch();
    let lastStatus = 0;
    let lastBody = "";
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
            const res = await fetchFn(url, {
                method: "GET",
                headers: {
                    Accept: "application/json",
                    "X-Fleet-Integration-Key": key,
                },
                signal: controller.signal,
            });
            clearTimeout(timer);
            lastStatus = Number(res.status || 0);
            lastBody = await res.text();
            if (res.ok) {
                return JSON.parse(lastBody);
            }
            if (lastStatus === 401 || lastStatus === 403 || lastStatus === 404) {
                break;
            }
        }
        catch (err) {
            lastStatus = 0;
            lastBody = err instanceof Error ? err.message : String(err);
        }
        if (attempt < 2) {
            await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        }
    }
    if (lastStatus === 404) {
        const err = new Error(`Fleet API 404: ${path}`);
        err.status = 404;
        throw err;
    }
    throw new Error(`Fleet API ${path} failed (HTTP ${lastStatus}): ${lastBody.slice(0, 200)}`);
}
/** Parse the personnel_manifest JSON string into a typed array (defensive). */
function parseManifest(raw) {
    if (!raw)
        return [];
    try {
        const arr = JSON.parse(raw);
        if (!Array.isArray(arr))
            return [];
        return arr
            .filter((p) => p && typeof p === "object")
            .map((p) => {
            var _a, _b;
            return ({
                employee_id: String(p.employee_id || ""),
                name: String(p.name || ""),
                department: (_a = p.department) !== null && _a !== void 0 ? _a : null,
                country: (_b = p.country) !== null && _b !== void 0 ? _b : null,
            });
        });
    }
    catch (_a) {
        return [];
    }
}
/** Whole days between two ISO dates (return − departure), minimum 0. */
function missionDays(m) {
    const d = m.departure_date ? Date.parse(m.departure_date) : NaN;
    const r = m.return_date ? Date.parse(m.return_date) : NaN;
    if (!Number.isFinite(d) || !Number.isFinite(r))
        return 0;
    const ms = r - d;
    if (ms <= 0)
        return 0;
    return Math.round(ms / 86400000);
}
async function listFleetMissions(opts = {}) {
    const q = buildQuery({ org: opts.org, approvalStatus: opts.approvalStatus });
    const body = await getJson(`/api/integrations/v1/missions${q}`);
    if (Array.isArray(body))
        return body;
    throw new Error(`Fleet API returned non-array response: ${JSON.stringify(body).slice(0, 200)}`);
}
async function getFleetMission(id, org) {
    var _a;
    try {
        const q = buildQuery({ id, org });
        const body = await getJson(`/api/integrations/v1/missions${q}`);
        if (Array.isArray(body))
            return (_a = body[0]) !== null && _a !== void 0 ? _a : null;
        return body !== null && body !== void 0 ? body : null;
    }
    catch (err) {
        if ((err === null || err === void 0 ? void 0 : err.status) === 404)
            return null;
        throw err;
    }
}
/** Smoke test the key + egress from the running runtime. */
async function smokeTestFleet() {
    const key = apiKey();
    if (!key) {
        return { ok: false, status: 0, message: "FLEET_INTEGRATION_API_KEY is not set" };
    }
    try {
        const rows = await listFleetMissions({ org: "1pwr_lesotho" });
        return {
            ok: true,
            status: 200,
            message: `OK — Fleet returned ${rows.length} mission(s) for org=1pwr_lesotho`,
        };
    }
    catch (err) {
        return {
            ok: false,
            status: (err === null || err === void 0 ? void 0 : err.status) || 0,
            message: err instanceof Error ? err.message : String(err),
        };
    }
}
//# sourceMappingURL=fleetMissionClient.js.map