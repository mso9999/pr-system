"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listFleetWorkOrders = listFleetWorkOrders;
exports.getFleetWorkOrder = getFleetWorkOrder;
exports.registerFleetWorkOrderPrLink = registerFleetWorkOrderPrLink;
/**
 * Server-to-server client for the 1PWR Fleet Hub work-order API.
 *
 * Backs the PR ↔ FM procurement gate: vehicle-expense PRs (expense type code 4)
 * must reference an open Fleet Hub work order before they can be pushed to an
 * approver, and creating such a PR registers a pr-link back in FM so the WO
 * carries the procurement trail (needs-parts → pr-submitted auto-advance).
 *
 * Endpoints:
 *   GET  <FLEET_API_BASE_URL>/api/integrations/v1/work-orders?org=&vehicleId=&status=
 *   GET  <FLEET_API_BASE_URL>/api/integrations/v1/work-orders/{id}
 *   POST <FLEET_API_BASE_URL>/api/integrations/v1/work-orders/{id}/pr-links
 * Auth:  X-Fleet-Integration-Key: <FLEET_INTEGRATION_API_KEY> (server-side only)
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
async function request(method, path, body) {
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
                method,
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                    "X-Fleet-Integration-Key": key,
                },
                body: body === undefined ? undefined : JSON.stringify(body),
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
    throw new Error(`Fleet API ${method} ${path} failed (HTTP ${lastStatus}): ${lastBody.slice(0, 200)}`);
}
async function listFleetWorkOrders(opts = {}) {
    const q = buildQuery({ org: opts.org, vehicleId: opts.vehicleId, status: opts.status });
    const body = await request("GET", `/api/integrations/v1/work-orders${q}`);
    return Array.isArray(body.workOrders) ? body.workOrders : [];
}
async function getFleetWorkOrder(id) {
    try {
        return await request("GET", `/api/integrations/v1/work-orders/${encodeURIComponent(id)}`);
    }
    catch (err) {
        if ((err === null || err === void 0 ? void 0 : err.status) === 404)
            return null;
        throw err;
    }
}
/** Register a PR against an FM work order (advances needs-parts → pr-submitted in FM). */
async function registerFleetWorkOrderPrLink(workOrderId, link) {
    await request("POST", `/api/integrations/v1/work-orders/${encodeURIComponent(workOrderId)}/pr-links`, link);
    return { ok: true };
}
//# sourceMappingURL=fleetWorkOrderClient.js.map