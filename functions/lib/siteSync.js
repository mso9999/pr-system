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
exports.fanoutSiteChanges = exports.ingestUgpSite = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const crypto_1 = require("crypto");
const ORG_TO_COUNTRY = {
    "1pwr_lesotho": "LSO",
    "1pwr_benin": "BEN",
    "1pwr_zambia": "ZMB",
};
function normalizeOrgId(value) {
    return value.trim().toLowerCase().replace(/\s+/g, "_");
}
function normalizeCountryCode(organizationId, countryCode) {
    const fromOrg = ORG_TO_COUNTRY[normalizeOrgId(organizationId)];
    if (fromOrg)
        return fromOrg;
    const cleaned = (countryCode || "").trim().toUpperCase();
    return cleaned || "LSO";
}
function asNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}
function asString(value) {
    if (value === null || value === undefined)
        return undefined;
    const s = String(value).trim();
    return s ? s : undefined;
}
function asAddress(value) {
    if (!value || typeof value !== "object")
        return undefined;
    const v = value;
    const address = {
        street: asString(v.street),
        city: asString(v.city),
        region: asString(v.region),
        postalCode: asString(v.postalCode),
        country: asString(v.country),
    };
    return Object.values(address).some((x) => x !== undefined) ? address : undefined;
}
function asUgpProjects(value) {
    if (!Array.isArray(value))
        return undefined;
    const links = [];
    for (const entry of value) {
        if (!entry || typeof entry !== "object")
            continue;
        const e = entry;
        const ugpProjectId = asString(e.ugpProjectId);
        if (!ugpProjectId)
            continue;
        links.push({
            ugpProjectId,
            ugpProjectCode: asString(e.ugpProjectCode),
            ugpProjectName: asString(e.ugpProjectName),
        });
    }
    return links.length > 0 ? links : undefined;
}
function isValidLatitude(value) {
    return Number.isFinite(value) && value >= -90 && value <= 90;
}
function isValidLongitude(value) {
    return Number.isFinite(value) && value >= -180 && value <= 180;
}
function buildDocId(organizationId, code) {
    return `${normalizeOrgId(organizationId)}_${code.trim().toLowerCase()}`;
}
function buildIdempotencyKey(payload) {
    const raw = `${payload.source}|${payload.organizationId}|${payload.code}|${payload.eventType}|${payload.updatedAt}`;
    return (0, crypto_1.createHash)("sha1").update(raw).digest("hex");
}
function expectedUgpApiKey() {
    return String(process.env.SITE_SYNC_UGP_API_KEY || "").trim();
}
function expectedFanoutApiKey() {
    return String(process.env.SITE_SYNC_FANOUT_API_KEY || "").trim();
}
function getBearerToken(req) {
    const auth = String(req.headers.authorization || "");
    const m = auth.match(/^Bearer\s+(.+)$/i);
    return m ? m[1].trim() : "";
}
async function isAllowedIngestCaller(req) {
    const apiKey = String(req.headers["x-api-key"] || "").trim();
    const expected = expectedUgpApiKey();
    if (expected && apiKey && expected === apiKey) {
        return true;
    }
    const bearer = getBearerToken(req);
    if (!bearer)
        return false;
    try {
        await admin.auth().verifyIdToken(bearer);
        return true;
    }
    catch (_a) {
        const adminToken = String(process.env.FIREBASE_ADMIN_BEARER_TOKEN || "").trim();
        return adminToken !== "" && adminToken === bearer;
    }
}
async function retryPost(url, payload, headers) {
    const fetchFn = globalThis.fetch;
    if (!fetchFn) {
        throw new Error("fetch is not available in runtime");
    }
    let lastStatus = 0;
    let lastBody = "";
    for (let attempt = 0; attempt < 3; attempt++) {
        const res = await fetchFn(url, {
            method: "POST",
            headers,
            body: JSON.stringify(payload),
        });
        lastStatus = Number(res.status || 0);
        lastBody = await res.text();
        if (res.ok)
            return { ok: true, status: lastStatus, body: lastBody };
        if (lastStatus < 500 && lastStatus !== 429)
            break;
        await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
    return { ok: false, status: lastStatus, body: lastBody };
}
async function dispatchSiteFanout(event) {
    const amUrl = String(process.env.SITE_SYNC_AM_ENDPOINT || "").trim();
    const fmUrl = String(process.env.SITE_SYNC_FM_ENDPOINT || "").trim();
    const fanoutKey = expectedFanoutApiKey();
    const headers = {
        "Content-Type": "application/json",
    };
    if (fanoutKey)
        headers["X-API-Key"] = fanoutKey;
    const adminBearer = String(process.env.FIREBASE_ADMIN_BEARER_TOKEN || "").trim();
    if (adminBearer)
        headers.Authorization = `Bearer ${adminBearer}`;
    const deliveries = [];
    if (amUrl) {
        deliveries.push(Object.assign({ target: "am" }, (await retryPost(amUrl, event, headers))));
    }
    if (fmUrl) {
        deliveries.push(Object.assign({ target: "fm" }, (await retryPost(fmUrl, event, headers))));
    }
    await admin.firestore().collection("siteSyncFanoutLogs").add({
        idempotencyKey: event.idempotencyKey,
        eventType: event.eventType,
        source: event.source,
        siteCode: event.site.code,
        organizationId: event.site.organizationId,
        updatedAt: event.updatedAt,
        deliveries,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const failed = deliveries.find((d) => !d.ok);
    if (failed) {
        throw new Error(`Fanout to ${failed.target} failed (${failed.status}): ${failed.body || "unknown"}`);
    }
}
function toCanonicalEvent(data, beforeExists) {
    const updatedAt = String(data.updatedAt || new Date().toISOString());
    const active = data.active !== false;
    const eventType = !active
        ? "site.deactivated"
        : beforeExists
            ? "site.updated"
            : "site.created";
    const source = data.source === "ugp" ? "ugp" : "pr_admin";
    const payload = {
        organizationId: normalizeOrgId(String(data.organizationId || "")),
        countryCode: normalizeCountryCode(String(data.organizationId || ""), String(data.countryCode || "")),
        code: String(data.code || "").trim().toUpperCase(),
        name: String(data.name || "").trim(),
        active,
        latitude: Number(data.latitude),
        longitude: Number(data.longitude),
        address: asAddress(data.address) || asAddress(data.siteAddress),
        ugpProjects: asUgpProjects(data.ugpProjects),
        externalIds: data.externalIds || {},
    };
    return {
        source,
        eventType,
        site: payload,
        idempotencyKey: buildIdempotencyKey({
            source,
            organizationId: payload.organizationId,
            code: payload.code,
            eventType,
            updatedAt,
        }),
        updatedAt,
    };
}
function setCors(res) {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
}
exports.ingestUgpSite = functions.https.onRequest(async (req, res) => {
    setCors(res);
    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
    }
    if (req.method !== "POST") {
        res.status(405).json({ success: false, error: "Method not allowed" });
        return;
    }
    if (!(await isAllowedIngestCaller(req))) {
        res.status(401).json({ success: false, error: "Unauthorized" });
        return;
    }
    const input = (req.body || {});
    const organizationId = normalizeOrgId(String(input.organizationId || ""));
    const code = String(input.code || "").trim().toUpperCase();
    const name = String(input.name || "").trim();
    const latitude = asNumber(input.latitude);
    const longitude = asNumber(input.longitude);
    const active = input.active !== false;
    const address = asAddress(input.address) || asAddress(input.siteAddress);
    const ugpProjects = asUgpProjects(input.ugpProjects);
    const externalIds = input.externalIds || {};
    if (code && !externalIds.ugpSiteCode) {
        externalIds.ugpSiteCode = code;
    }
    if (!organizationId || !code || !name || latitude === null || longitude === null) {
        res.status(400).json({
            success: false,
            error: "organizationId, code, name, latitude and longitude are required",
        });
        return;
    }
    if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) {
        res.status(400).json({
            success: false,
            error: "Coordinates are out of bounds",
        });
        return;
    }
    const now = new Date().toISOString();
    const countryCode = normalizeCountryCode(organizationId, String(input.countryCode || ""));
    const docId = buildDocId(organizationId, code);
    const payload = Object.assign(Object.assign(Object.assign({ organizationId,
        countryCode,
        code,
        name,
        active,
        latitude,
        longitude }, (address ? { siteAddress: address } : {})), (ugpProjects ? { ugpProjects } : {})), { externalIds, source: "ugp", updatedAt: now, createdAt: now });
    await admin
        .firestore()
        .collection("referenceData_sites")
        .doc(docId)
        .set(payload, { merge: true });
    res.status(200).json({ success: true, id: docId, site: payload });
});
exports.fanoutSiteChanges = functions.firestore
    .document("referenceData_sites/{siteId}")
    .onWrite(async (change) => {
    if (!change.after.exists)
        return;
    const after = change.after.data();
    if (!after)
        return;
    if (!after.code || !after.organizationId || !after.name)
        return;
    const event = toCanonicalEvent(after, change.before.exists);
    if (!event.site.code || !event.site.organizationId)
        return;
    if (!isValidLatitude(event.site.latitude) || !isValidLongitude(event.site.longitude))
        return;
    const dedupeRef = admin.firestore().collection("siteSyncDeliveries").doc(event.idempotencyKey);
    const dedupe = await dedupeRef.get();
    if (dedupe.exists)
        return;
    await dispatchSiteFanout(event);
    await dedupeRef.set({
        idempotencyKey: event.idempotencyKey,
        deliveredAt: admin.firestore.FieldValue.serverTimestamp(),
        eventType: event.eventType,
        siteCode: event.site.code,
        organizationId: event.site.organizationId,
    });
});
//# sourceMappingURL=siteSync.js.map