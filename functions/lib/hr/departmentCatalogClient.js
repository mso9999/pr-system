"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDepartments = getDepartments;
exports.showDepartment = showDepartment;
exports.getAllDepartments = getAllDepartments;
/**
 * Server-to-server client for the 1PWR HR portal DEPARTMENT CATALOG API.
 *
 * As of 2026-06-30 HR is the canonical source for the department catalog
 * (see HR_API_INTEGRATION.md §3.5 + §12). PR is a consumer: it mirrors
 * `/api/departments` into `referenceData_departments` and resolves HR
 * department names to PR doc ids via the mirrored catalog.
 *
 * Server-only — the API key must never reach the browser. Same env vars
 * as the employee directory client: HR_API_BASE_URL + HR_API_KEY_PR_PORTAL.
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
async function getDepartments(opts = {}) {
    const q = buildQuery({
        country: opts.country,
        organization: opts.organization,
        active: opts.active === undefined ? undefined : opts.active ? "true" : "false",
        since: opts.since,
    });
    return getJson(`/api/departments${q}`);
}
async function showDepartment(id) {
    try {
        return await getJson(`/api/departments/${encodeURIComponent(String(id))}`);
    }
    catch (err) {
        if ((err === null || err === void 0 ? void 0 : err.status) === 404)
            return null;
        throw err;
    }
}
/** Pull every department (all pages if HR ever paginates; today it returns all). */
async function getAllDepartments(since) {
    return getDepartments({ since });
}
//# sourceMappingURL=departmentCatalogClient.js.map