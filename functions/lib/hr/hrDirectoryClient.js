"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDirectory = getDirectory;
exports.getMeta = getMeta;
exports.lookupEmployee = lookupEmployee;
exports.showEmployee = showEmployee;
exports.smokeTest = smokeTest;
/**
 * Server-to-server client for the 1PWR HR portal directory API.
 *
 * HR is the canonical source of truth for 1PWR employee metadata. This
 * client is intentionally server-only — the API key must never reach the
 * browser. See docs/HR_API_INTEGRATION.md (HR repo) and
 * docs/HR_EMPLOYEE_SYNC.md (this repo) for the contract.
 *
 * Base URL defaults to https://hr.1pwrafrica.com. Override with
 * HR_API_BASE_URL for staging/smoke tests.
 *
 * Auth: X-API-Key header = process.env.HR_API_KEY_PR_PORTAL.
 */
const DEFAULT_BASE_URL = "https://hr.1pwrafrica.com";
const TIMEOUT_MS = 8000;
function getFetch() {
    const fn = globalThis.fetch;
    if (!fn) {
        throw new Error("fetch is not available in this runtime");
    }
    return fn;
}
function baseUrl() {
    return String(process.env.HR_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
}
function apiKey() {
    return String(process.env.HR_API_KEY_PR_PORTAL || "").trim();
}
async function getJson(path) {
    const key = apiKey();
    if (!key) {
        throw new Error("HR_API_KEY_PR_PORTAL is not set — cannot call HR API");
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
                    "X-API-Key": key,
                },
                signal: controller.signal,
            });
            clearTimeout(timer);
            lastStatus = Number(res.status || 0);
            lastBody = await res.text();
            if (res.ok) {
                return JSON.parse(lastBody);
            }
            // 401/403/404 are not retryable
            if (lastStatus === 401 || lastStatus === 403 || lastStatus === 404) {
                break;
            }
        }
        catch (err) {
            // network/abort error — retry with backoff
            lastStatus = 0;
            lastBody = err instanceof Error ? err.message : String(err);
        }
        if (attempt < 2) {
            await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        }
    }
    if (lastStatus === 404) {
        const err = new Error(`HR API 404: ${path}`);
        err.status = 404;
        throw err;
    }
    throw new Error(`HR API ${path} failed (HTTP ${lastStatus}): ${lastBody.slice(0, 200)}`);
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
async function getDirectory(opts = {}) {
    const q = buildQuery({
        country: opts.country,
        department: opts.department,
        since: opts.since,
    });
    return getJson(`/api/employees/directory${q}`);
}
async function getMeta() {
    return getJson(`/api/employees/meta`);
}
async function lookupEmployee(employeeId) {
    try {
        return await getJson(`/api/employees/lookup/${encodeURIComponent(employeeId)}`);
    }
    catch (err) {
        if ((err === null || err === void 0 ? void 0 : err.status) === 404)
            return null;
        throw err;
    }
}
async function showEmployee(employeeId) {
    try {
        return await getJson(`/api/employees/show/${encodeURIComponent(employeeId)}`);
    }
    catch (err) {
        if ((err === null || err === void 0 ? void 0 : err.status) === 404)
            return null;
        throw err;
    }
}
/** Smoke test the key + egress from the running runtime. */
async function smokeTest() {
    const key = apiKey();
    if (!key) {
        return { ok: false, status: 0, message: "HR_API_KEY_PR_PORTAL is not set" };
    }
    try {
        const r = await getDirectory({ country: "LS" });
        return {
            ok: true,
            status: 200,
            message: `OK — directory returned ${r.count} employee(s) for country=LS`,
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
//# sourceMappingURL=hrDirectoryClient.js.map