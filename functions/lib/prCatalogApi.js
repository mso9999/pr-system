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
exports.prCatalogApi = void 0;
/**
 * PR → HR read-only catalog API.
 *
 * PR is the canonical source of truth for COUNTRIES and ORGANIZATIONS (HR
 * is canonical for the department catalog and employee metadata). HR pulls
 * these two lists from this endpoint to replace its static
 * `config/pr_org_map.php` (see docs/HR_ORG_COUNTRY_SYNC_SPEC.md).
 *
 * Surface (HTTPS, server-to-server):
 *   GET /api/countries                  → { count, countries: [{ code, name, active }] }
 *   GET /api/organizations?country=LS   → { count, organizations: [{ id, name, countryCode, country, currency, timezoneOffset, active }] }
 *
 * Auth: `X-API-Key: <HR_API_KEY_PR_PORTAL>` header — the SAME key HR issues
 * for its own API and PR already stores in functions/.env. Reused in both
 * directions by explicit user decision (2026-07-01).
 *
 * Countries are org-independent parents; organizations are children that
 * carry a `countryCode` (ISO-2) linking back to their parent country.
 */
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const db = admin.firestore();
function apiKey() {
    return String(process.env.HR_API_KEY_PR_PORTAL || "").trim();
}
function isAuthorized(req) {
    const expected = apiKey();
    if (!expected)
        return false;
    const presented = String(req.headers["x-api-key"] || "").trim();
    return presented === expected;
}
function forbidden(res) {
    res.status(403).json({ error: "Forbidden — valid X-API-Key required" });
}
function notFound(res) {
    res.status(404).json({ error: "Not found" });
}
async function listCountries() {
    const snap = await db.collection("referenceData_countries").get();
    const rows = snap.docs
        .map((d) => {
        const data = d.data();
        const code = String(data.code || d.id || "").toUpperCase();
        return {
            code,
            name: String(data.name || code),
            active: data.active !== false,
        };
    })
        .sort((a, b) => a.code.localeCompare(b.code));
    return { count: rows.length, countries: rows };
}
async function listOrganizations(countryFilter) {
    let q = db.collection("referenceData_organizations");
    if (countryFilter) {
        q = q.where("countryCode", "==", countryFilter.toUpperCase());
    }
    const snap = await q.get();
    const rows = snap.docs
        .map((d) => {
        const data = d.data();
        return {
            id: String(d.id),
            name: String(data.name || d.id),
            countryCode: data.countryCode || null,
            country: data.country || null,
            currency: data.currency || null,
            timezoneOffset: typeof data.timezoneOffset === "number" ? data.timezoneOffset : null,
            active: data.active !== false,
        };
    })
        .sort((a, b) => a.id.localeCompare(b.id));
    return { count: rows.length, organizations: rows };
}
exports.prCatalogApi = functions
    .runWith({ memory: "256MB", timeoutSeconds: 30 })
    .https.onRequest(async (req, res) => {
    // CORS preflight (in case a browser tool ever probes; HR is server-side).
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Headers", "Content-Type, X-API-Key");
    res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    if (req.method === "OPTIONS") {
        res.status(204).end();
        return;
    }
    if (req.method !== "GET") {
        res.status(405).json({ error: "Method not allowed" });
        return;
    }
    if (!isAuthorized(req)) {
        forbidden(res);
        return;
    }
    // Strip a leading function-mount path segment if present (e.g. /prCatalogApi/api/countries).
    const path = String(req.path || "").replace(/^\/+/, "");
    const normalized = path.replace(/^prCatalogApi\/+/, "");
    try {
        if (normalized === "api/countries" || normalized === "countries") {
            const body = await listCountries();
            res.set("Cache-Control", "no-store, max-age=0").json(body);
            return;
        }
        if (normalized === "api/organizations" || normalized === "organizations") {
            const country = String(req.query.country || "").trim();
            const body = await listOrganizations(country || undefined);
            res.set("Cache-Control", "no-store, max-age=0").json(body);
            return;
        }
        notFound(res);
    }
    catch (err) {
        console.error("[prCatalogApi] error:", err);
        res.status(500).json({ error: "Internal error" });
    }
});
//# sourceMappingURL=prCatalogApi.js.map