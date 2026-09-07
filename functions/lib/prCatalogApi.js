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
 * PR read-only catalog + procurement API.
 *
 * Auth: `X-API-Key` matching any of HR_API_KEY_PR_PORTAL, PR_CATALOG_API_KEY,
 * UGRIDPREDICT_API_KEY (see catalog/auth.ts). Cache-Control: no-store.
 *
 * Existing catalog surface (camelCase, {count, items[]}):
 *   GET /api/countries | /organizations | /sites | /vendors
 * Brief 02 additions:
 *   GET /api/v1/purchase-requests | /commitments | /lead-times
 *   GET /api/categories | /expense-types
 *   /api/vendors gains country, origin, defaultCurrency, incotermDefault
 */
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const auth_1 = require("./catalog/auth");
const procurementRead_1 = require("./catalog/procurementRead");
const db = admin.firestore();
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
function resolveOrgCountryIso2(id, data) {
    const fromField = String(data.countryCode || "").trim().toUpperCase();
    if (fromField)
        return fromField;
    const fallback = {
        "1pwr_lesotho": "LS",
        "1pwr_benin": "BJ",
        "1pwr_zambia": "ZM",
        kuwala: "ZM",
        pueco_lesotho: "LS",
        pueco_benin: "BJ",
        smp: "LS",
        neo1: "LS",
        mgb: "BJ",
    };
    if (fallback[id])
        return fallback[id];
    const countryName = String(data.country || "").trim().toUpperCase();
    const byName = {
        LESOTHO: "LS",
        LSO: "LS",
        BENIN: "BJ",
        BEN: "BJ",
        BN: "BJ",
        ZAMBIA: "ZM",
        ZMB: "ZM",
    };
    return byName[countryName] || null;
}
async function listOrganizations(countryFilter) {
    // Filter in memory. A Firestore `where("countryCode", "==", "LS")` drops
    // catalog rows (notably SMP) that still have `country: "Lesotho"` from the
    // original import and were never backfilled with countryCode.
    const snap = await db.collection("referenceData_organizations").get();
    const wanted = countryFilter ? countryFilter.trim().toUpperCase() : "";
    const rows = snap.docs
        .map((d) => {
        const data = d.data();
        const countryCode = resolveOrgCountryIso2(String(d.id), data);
        return {
            id: String(d.id),
            name: String(data.name || d.id),
            countryCode,
            country: data.country || null,
            currency: data.currency || null,
            timezoneOffset: typeof data.timezoneOffset === "number" ? data.timezoneOffset : null,
            active: data.active !== false && data.active !== "false" && data.active !== "N",
        };
    })
        .filter((row) => !wanted || row.countryCode === wanted)
        .sort((a, b) => a.id.localeCompare(b.id));
    return { count: rows.length, organizations: rows };
}
async function listSites(countryFilter, orgFilter) {
    let q = db.collection("referenceData_sites");
    if (countryFilter) {
        q = q.where("countryCode", "==", countryFilter.toUpperCase());
    }
    if (orgFilter) {
        q = q.where("organizationId", "==", orgFilter);
    }
    const snap = await q.get();
    const rows = snap.docs.map((d) => {
        const data = d.data();
        return {
            id: String(d.id),
            code: data.code ? String(data.code) : null,
            name: String(data.name || d.id),
            countryCode: data.countryCode || null,
            organizationId: data.organizationId || null,
            active: data.active !== false,
            canonicalUgpProjectId: data.canonicalUgpProjectId || null,
        };
    }).sort((a, b) => a.name.localeCompare(b.name));
    return { count: rows.length, sites: rows };
}
exports.prCatalogApi = functions
    .runWith({ memory: "512MB", timeoutSeconds: 60 })
    .https.onRequest(async (req, res) => {
    const started = Date.now();
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
    const consumer = (0, auth_1.resolveConsumer)(req);
    if (!consumer) {
        forbidden(res);
        return;
    }
    if ((0, auth_1.isRateLimited)(consumer.name)) {
        res.status(429).json({ error: "Rate limit exceeded (60 req/min per consumer)" });
        (0, auth_1.logCatalogCall)({ consumer: consumer.name, method: req.method, path: String(req.path || ""), status: 429, ms: Date.now() - started });
        return;
    }
    const path = String(req.path || "").replace(/^\/+/, "");
    const normalized = path.replace(/^prCatalogApi\/+/, "");
    const q = req.query;
    const ok = (body, status = 200) => {
        res.status(status).set("Cache-Control", "no-store, max-age=0").json(body);
        (0, auth_1.logCatalogCall)({ consumer: consumer.name, method: req.method, path: normalized, status, ms: Date.now() - started });
    };
    try {
        if (normalized === "api/countries" || normalized === "countries") {
            ok(await listCountries());
            return;
        }
        if (normalized === "api/organizations" || normalized === "organizations") {
            const country = String(req.query.country || "").trim();
            ok(await listOrganizations(country || undefined));
            return;
        }
        if (normalized === "api/sites" || normalized === "sites") {
            const country = String(req.query.country || "").trim();
            const org = String(req.query.org || "").trim();
            ok(await listSites(country || undefined, org || undefined));
            return;
        }
        if (normalized === "api/vendors" ||
            normalized === "vendors" ||
            normalized === "api/v1/vendors") {
            ok(await (0, procurementRead_1.listEnhancedVendors)());
            return;
        }
        if (normalized === "api/categories" || normalized === "api/v1/categories") {
            ok(await (0, procurementRead_1.listProjectCategories)());
            return;
        }
        if (normalized === "api/expense-types" || normalized === "api/v1/expense-types") {
            ok(await (0, procurementRead_1.listExpenseTypes)());
            return;
        }
        if (normalized === "api/v1/purchase-requests" ||
            normalized === "api/v1/purchaseRequests") {
            ok(await (0, procurementRead_1.listPurchaseRequests)(q));
            return;
        }
        if (normalized === "api/v1/commitments") {
            ok(await (0, procurementRead_1.listCommitments)(q));
            return;
        }
        if (normalized === "api/v1/lead-times" || normalized === "api/v1/leadTimes") {
            ok(await (0, procurementRead_1.listLeadTimes)(q));
            return;
        }
        notFound(res);
        (0, auth_1.logCatalogCall)({ consumer: consumer.name, method: req.method, path: normalized, status: 404, ms: Date.now() - started });
    }
    catch (err) {
        console.error("[prCatalogApi] error:", err);
        res.status(500).json({ error: "Internal error" });
        (0, auth_1.logCatalogCall)({ consumer: consumer.name, method: req.method, path: normalized, status: 500, ms: Date.now() - started });
    }
});
//# sourceMappingURL=prCatalogApi.js.map