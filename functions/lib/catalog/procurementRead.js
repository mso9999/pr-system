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
exports.deriveVendorOrigin = void 0;
exports.listPurchaseRequests = listPurchaseRequests;
exports.listCommitments = listCommitments;
exports.listLeadTimes = listLeadTimes;
exports.listEnhancedVendors = listEnhancedVendors;
exports.listProjectCategories = listProjectCategories;
exports.listExpenseTypes = listExpenseTypes;
/**
 * Brief 02 — committed procurement + lead-time reads.
 *
 * Lives on prCatalogApi (same key, same envelope). archivePRs are excluded
 * from lead-time stats: they are Google Forms imports with no status history.
 * Ordered/delivered timestamps come from PR itself (orderedAt, completedAt,
 * statusHistory) — no AM movements join required.
 */
const admin = __importStar(require("firebase-admin"));
const procurementLines_1 = require("./procurementLines");
const stats_1 = require("./stats");
const vendorOrigin_1 = require("./vendorOrigin");
Object.defineProperty(exports, "deriveVendorOrigin", { enumerable: true, get: function () { return vendorOrigin_1.deriveVendorOrigin; } });
const db = admin.firestore();
const COMMITTED_STATUSES = new Set(["APPROVED", "ORDERED"]);
const LEADTIME_STATUSES = new Set(["COMPLETED", "ORDERED"]);
function asString(v) {
    return v == null ? "" : String(v).trim();
}
function asNumber(v) {
    if (typeof v === "number" && Number.isFinite(v))
        return v;
    if (typeof v === "string" && v.trim() && Number.isFinite(Number(v)))
        return Number(v);
    return null;
}
function asIso(v) {
    if (!v)
        return null;
    if (typeof v === "string") {
        const t = Date.parse(v);
        return Number.isFinite(t) ? new Date(t).toISOString() : null;
    }
    if (typeof v.toDate === "function") {
        return v.toDate().toISOString();
    }
    return null;
}
function normalizeOrg(input) {
    return input.toLowerCase().replace(/[^a-z0-9]/g, "_");
}
function firstHistory(hist, status) {
    for (const h of hist) {
        if (String(h.status || "").toUpperCase() === status)
            return asIso(h.timestamp);
    }
    return null;
}
function loadRawPr(id, data) {
    var _a;
    const requestLines = (0, procurementLines_1.projectLines)(data.lineItems);
    const poLines = (0, procurementLines_1.projectLines)(data.lineItemsWithSKU);
    const hist = Array.isArray(data.statusHistory) ? data.statusHistory : [];
    const sites = [];
    if (Array.isArray(data.sites)) {
        for (const s of data.sites) {
            if (typeof s === "string" && s.trim())
                sites.push(s.trim());
            else if (s && typeof s === "object" && (s.id || s.name))
                sites.push(String(s.id || s.name));
        }
    }
    else if (data.site) {
        sites.push(asString(data.site));
    }
    const quotes = Array.isArray(data.quotes)
        ? data.quotes.map((q) => ({
            vendorId: asString(q.vendorId || q.vendor_id) || null,
            vendorName: asString(q.vendorName || q.vendor_name) || null,
            amount: asNumber(q.amount),
            currency: asString(q.currency || q.currencyId) || null,
        }))
        : [];
    const ugpPartIds = Array.isArray(data.ugpPartIds)
        ? data.ugpPartIds.map((x) => asString(x)).filter(Boolean)
        : [];
    const source = asString(data.mappingSource).toLowerCase();
    return {
        id,
        prNumber: asString(data.prNumber) || id,
        status: asString(data.status).toUpperCase() || "UNKNOWN",
        organization: asString(data.organization),
        organizationId: asString(data.organizationId) || normalizeOrg(asString(data.organization)),
        siteIds: sites,
        department: asString(data.department) || null,
        description: asString(data.description),
        category: asString(data.projectCategory || data.category) || null,
        expenseType: asString(data.expenseType) || null,
        estimatedAmount: asNumber((_a = data.totalAmount) !== null && _a !== void 0 ? _a : data.estimatedAmount),
        currency: asString(data.currency) || null,
        vendorId: asString(data.selectedVendor || data.preferredVendor || data.vendor) || null,
        quotes,
        createdAt: asIso(data.createdAt),
        approvedAt: asIso(data.approvedAt) || firstHistory(hist, "APPROVED"),
        orderedAt: asIso(data.orderedAt) || firstHistory(hist, "ORDERED"),
        expectedDelivery: asIso(data.estimatedDeliveryDate || data.expectedLandingDate),
        deliveredAt: asIso(data.completedAt || data.deliveredAt) || firstHistory(hist, "COMPLETED"),
        ugpPartIds,
        mappingConfidence: asNumber(data.mappingConfidence),
        mappingSource: source === "ai" || source === "human" || source === "rule" ? source : null,
        incoterm: asString(data.incoterm) || null,
        lineItems: requestLines.items, lineItemsStatus: requestLines.status,
        poLineItems: poLines.items, poLineItemsStatus: poLines.status,
    };
}
async function loadAllLivePrs() {
    const snap = await db.collection("purchaseRequests").get();
    return snap.docs.map((d) => loadRawPr(d.id, d.data()));
}
function queryStr(q, ...keys) {
    for (const k of keys) {
        const v = asString(q[k]);
        if (v)
            return v;
    }
    return "";
}
function toRow(p) {
    return {
        id: p.id,
        prId: p.prNumber,
        status: p.status,
        organization: p.organization,
        organizationId: p.organizationId,
        site: p.siteIds[0] || null,
        sites: p.siteIds,
        department: p.department,
        description: p.description,
        category: p.category,
        expenseType: p.expenseType,
        estimatedAmount: p.estimatedAmount,
        currency: p.currency,
        vendorId: p.vendorId,
        quotes: p.quotes,
        createdAt: p.createdAt,
        approvedAt: p.approvedAt,
        orderedAt: p.orderedAt,
        expectedDelivery: p.expectedDelivery,
        deliveredAt: p.deliveredAt,
        ugpPartIds: p.ugpPartIds,
        mappingConfidence: p.mappingConfidence,
        mappingSource: p.mappingSource,
        incoterm: p.incoterm,
        lineItems: p.lineItems, lineItemsStatus: p.lineItemsStatus,
        poLineItems: p.poLineItems, poLineItemsStatus: p.poLineItemsStatus,
        quantityBasis: { lineItems: "requested", poLineItems: "recorded_po_lines" },
        receiptEvidenceStatus: "not_connected",
        sourceCollection: "purchaseRequests",
    };
}
function matchesFilters(p, q) {
    const status = queryStr(q, "status").toUpperCase();
    if (status && p.status !== status)
        return false;
    const org = queryStr(q, "organization", "org");
    if (org) {
        const n = normalizeOrg(org);
        if (normalizeOrg(p.organizationId) !== n && normalizeOrg(p.organization) !== n)
            return false;
    }
    const site = queryStr(q, "site");
    if (site) {
        const n = normalizeOrg(site);
        if (!p.siteIds.some((s) => normalizeOrg(s) === n || s === site))
            return false;
    }
    const since = queryStr(q, "created_since", "createdSince");
    if (since && p.createdAt && p.createdAt < since)
        return false;
    const before = queryStr(q, "expected_before", "expectedBefore");
    if (before && p.expectedDelivery && p.expectedDelivery > before)
        return false;
    if (before && !p.expectedDelivery)
        return false;
    return true;
}
function decodeCursor(raw) {
    try {
        const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
        if (parsed && typeof parsed.createdAt === "string" && typeof parsed.id === "string")
            return parsed;
    }
    catch (_a) {
        /* ignore */
    }
    return null;
}
async function listPurchaseRequests(query) {
    const limitRaw = Number(queryStr(query, "limit") || 100);
    const limit = Math.min(500, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 100));
    const cursor = decodeCursor(queryStr(query, "cursor"));
    const all = (await loadAllLivePrs())
        .filter((p) => matchesFilters(p, query))
        .sort((a, b) => {
        const ca = a.createdAt || "";
        const cb = b.createdAt || "";
        if (ca !== cb)
            return cb.localeCompare(ca);
        return b.id.localeCompare(a.id);
    });
    let start = 0;
    if (cursor) {
        const idx = all.findIndex((p) => p.createdAt === cursor.createdAt && p.id === cursor.id);
        start = idx >= 0 ? idx + 1 : 0;
    }
    const page = all.slice(start, start + limit);
    const last = page[page.length - 1];
    const nextCursor = start + page.length < all.length && last
        ? Buffer.from(JSON.stringify({ createdAt: last.createdAt || "", id: last.id }), "utf8").toString("base64url")
        : null;
    return { count: all.length, items: page.map(toRow), nextCursor };
}
function cashMonth(p) {
    const iso = p.expectedDelivery || p.orderedAt || p.createdAt;
    return iso ? iso.slice(0, 7) : "unknown";
}
async function listCommitments(query) {
    const org = queryStr(query, "organization", "org");
    const monthFilter = queryStr(query, "month");
    const buckets = new Map();
    for (const p of await loadAllLivePrs()) {
        if (!COMMITTED_STATUSES.has(p.status))
            continue;
        if (p.deliveredAt)
            continue;
        if (p.estimatedAmount == null)
            continue;
        if (org) {
            const n = normalizeOrg(org);
            if (normalizeOrg(p.organizationId) !== n && normalizeOrg(p.organization) !== n)
                continue;
        }
        const month = cashMonth(p);
        if (monthFilter && month !== monthFilter)
            continue;
        const site = p.siteIds[0] || null;
        const currency = p.currency || "XXX";
        const key = [month, p.organizationId, site || "", p.category || "", currency].join("|");
        const existing = buckets.get(key);
        const expected = p.expectedDelivery;
        if (existing) {
            existing.committedAmount += p.estimatedAmount;
            existing.prCount += 1;
            if (expected && (!existing.earliestExpected || expected < existing.earliestExpected)) {
                existing.earliestExpected = expected;
            }
            if (expected && (!existing.latestExpected || expected > existing.latestExpected)) {
                existing.latestExpected = expected;
            }
        }
        else {
            buckets.set(key, {
                month,
                organization: p.organization,
                organizationId: p.organizationId,
                site,
                category: p.category,
                committedAmount: p.estimatedAmount,
                currency,
                prCount: 1,
                earliestExpected: expected,
                latestExpected: expected,
            });
        }
    }
    const items = [...buckets.values()].sort((a, b) => {
        if (a.month !== b.month)
            return a.month.localeCompare(b.month);
        if (a.organizationId !== b.organizationId)
            return a.organizationId.localeCompare(b.organizationId);
        return (a.site || "").localeCompare(b.site || "");
    });
    return {
        count: items.length,
        items,
        notes: "Cash month = expectedDelivery || orderedAt || createdAt (YYYY-MM). Status APPROVED or ORDERED only; rows with deliveredAt are excluded. Currencies are never mixed. Sum committedAmount for a month+organization to reconcile against /purchase-requests with the same filters.",
    };
}
async function listLeadTimes(query) {
    var _a;
    const vendorFilter = queryStr(query, "vendor_id", "vendorId");
    const categoryFilter = queryStr(query, "category");
    const originFilter = queryStr(query, "origin").toLowerCase();
    const since = queryStr(query, "since");
    const vendorSnap = await db.collection("referenceData_vendors").get();
    const originByVendor = new Map();
    vendorSnap.docs.forEach((d) => {
        const v = d.data();
        const origin = (0, vendorOrigin_1.deriveVendorOrigin)(v.country, v.origin);
        originByVendor.set(d.id, origin);
        if (v.name)
            originByVendor.set(v.name, origin);
    });
    const groups = new Map();
    for (const p of await loadAllLivePrs()) {
        if (!LEADTIME_STATUSES.has(p.status))
            continue;
        if (since && p.createdAt && p.createdAt < since)
            continue;
        if (vendorFilter && asString(p.vendorId).toLowerCase() !== vendorFilter.toLowerCase())
            continue;
        if (categoryFilter && asString(p.category).toLowerCase() !== categoryFilter.toLowerCase())
            continue;
        const origin = (_a = originByVendor.get(p.vendorId || "")) !== null && _a !== void 0 ? _a : null;
        if (originFilter && origin !== originFilter)
            continue;
        const requestToOrder = (0, stats_1.daysBetween)(p.createdAt, p.orderedAt);
        const orderToDelivery = (0, stats_1.daysBetween)(p.orderedAt, p.deliveredAt);
        if (requestToOrder == null && orderToDelivery == null)
            continue;
        const vendorId = p.vendorId || "unknown";
        const key = [vendorId, p.category || "", origin || ""].join("|");
        let g = groups.get(key);
        if (!g) {
            g = { vendorId, category: p.category, origin, acc: { orderToDelivery: [], requestToOrder: [], dates: [] } };
            groups.set(key, g);
        }
        if (orderToDelivery != null)
            g.acc.orderToDelivery.push(orderToDelivery);
        if (requestToOrder != null)
            g.acc.requestToOrder.push(requestToOrder);
        if (p.createdAt)
            g.acc.dates.push(p.createdAt);
        if (p.deliveredAt)
            g.acc.dates.push(p.deliveredAt);
    }
    const items = [...groups.values()]
        .map((g) => {
        const dates = g.acc.dates.sort();
        const n = Math.max(g.acc.orderToDelivery.length, g.acc.requestToOrder.length);
        return {
            vendorId: g.vendorId,
            category: g.category,
            origin: g.origin,
            n,
            daysOrderToDelivery: (0, stats_1.percentileBlock)(g.acc.orderToDelivery),
            daysRequestToOrder: (0, stats_1.percentileBlock)(g.acc.requestToOrder),
            window: dates.length ? `${dates[0].slice(0, 10)}..${dates[dates.length - 1].slice(0, 10)}` : "",
            lowConfidence: n < 5,
        };
    })
        .sort((a, b) => b.n - a.n);
    return {
        count: items.length,
        items,
        notes: "archivePRs excluded (legacy Google Forms imports, no status history). Lead times derived from purchaseRequests.orderedAt / completedAt / statusHistory — no AM movements join.",
    };
}
async function listEnhancedVendors() {
    const snap = await db.collection("referenceData_vendors").get();
    const vendors = snap.docs
        .map((d) => {
        const data = d.data();
        const active = data.active !== false &&
            data.active !== "false" &&
            data.active !== "N" &&
            data.isActive !== false &&
            data.approved !== false;
        return {
            id: String(d.id),
            name: String(data.name || d.id),
            email: data.email || data.contactEmail || null,
            phone: data.phone || data.contactPhone || null,
            country: data.country || null,
            active,
            defaultCurrency: data.defaultCurrency || data.currency || null,
            origin: (0, vendorOrigin_1.deriveVendorOrigin)(data.country, data.origin),
            incotermDefault: data.incotermDefault || data.incoterm || null,
        };
    })
        .sort((a, b) => a.name.localeCompare(b.name));
    return { count: vendors.length, vendors };
}
async function listRefCollection(collectionName) {
    const snap = await db.collection(collectionName).get();
    const items = snap.docs
        .map((d) => {
        const data = d.data();
        return {
            id: String(d.id),
            name: String(data.name || d.id),
            code: data.code ? String(data.code) : null,
            organizationId: data.organizationId ? String(data.organizationId) : null,
            active: data.active !== false && data.active !== "false" && data.active !== "N",
        };
    })
        .filter((r) => r.active)
        .sort((a, b) => a.name.localeCompare(b.name));
    return { count: items.length, items };
}
function listProjectCategories() {
    return listRefCollection("referenceData_projectCategories");
}
function listExpenseTypes() {
    return listRefCollection("referenceData_expenseTypes");
}
//# sourceMappingURL=procurementRead.js.map