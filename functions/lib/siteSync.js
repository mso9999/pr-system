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
exports.checkSiteConflicts = exports.fanoutSiteChanges = exports.repointCanonicalUgpProject = exports.linkUgpProject = exports.updateSiteCoordinates = exports.ingestUgpSite = exports.SITE_PROXIMITY_WARN_M = void 0;
exports.findNearbySites = findNearbySites;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const crypto_1 = require("crypto");
const ORG_TO_COUNTRY = {
    "1pwr_lesotho": "LSO",
    "1pwr_benin": "BEN",
    "1pwr_zambia": "ZMB",
    "kuwala": "ZMB",
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
async function dispatchSiteFanout(event, opts = {}) {
    const amUrl = String(process.env.SITE_SYNC_AM_ENDPOINT || "").trim();
    const fmUrl = String(process.env.SITE_SYNC_FM_ENDPOINT || "").trim();
    // CC runs one deployment per country lane; each lane self-filters payloads
    // whose countryCode is not its own, so every lane URL receives every event.
    const ccUrls = String(process.env.SITE_SYNC_CC_ENDPOINTS || "")
        .split(",")
        .map((u) => u.trim())
        .filter((u) => u.length > 0);
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
    if (amUrl && !opts.skipAmFm) {
        deliveries.push(Object.assign({ target: "am" }, (await retryPost(amUrl, event, headers))));
    }
    if (fmUrl && !opts.skipAmFm) {
        deliveries.push(Object.assign({ target: "fm" }, (await retryPost(fmUrl, event, headers))));
    }
    for (const ccUrl of ccUrls) {
        deliveries.push(Object.assign({ target: `cc:${ccUrl}` }, (await retryPost(ccUrl, event, headers))));
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
    const address = asAddress(data.address) || asAddress(data.siteAddress);
    const payload = {
        organizationId: normalizeOrgId(String(data.organizationId || "")),
        countryCode: normalizeCountryCode(String(data.organizationId || ""), String(data.countryCode || "")),
        code: String(data.code || "").trim().toUpperCase(),
        name: String(data.name || "").trim(),
        active,
        latitude: Number(data.latitude),
        longitude: Number(data.longitude),
        district: asString(data.district) || (address && address.region) || undefined,
        address,
        ugpProjects: asUgpProjects(data.ugpProjects),
        canonicalUgpProjectId: asString(data.canonicalUgpProjectId),
        externalIds: data.externalIds || {},
        createdBy: asString(data.createdBy),
        createdAt: asString(data.createdAt),
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
/**
 * The organization's site document for a code. Most PR-created sites have
 * auto ids, so look up by (organizationId, code) before falling back to the
 * deterministic `{org}_{code}` id used for sites created by this module.
 */
async function siteDocRef(organizationId, code) {
    const coll = admin.firestore().collection("referenceData_sites");
    const byId = coll.doc(buildDocId(organizationId, code));
    if ((await byId.get()).exists)
        return byId;
    const matches = await coll
        .where("organizationId", "==", organizationId)
        .where("code", "==", code)
        .get();
    if (matches.empty)
        return byId;
    const bound = matches.docs.find((d) => asString(d.data().canonicalUgpProjectId));
    return (bound || matches.docs[0]).ref;
}
/** Great-circle distance in meters (haversine). */
function haversineMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}
/**
 * A new site closer than this to an existing one needs an explicit "not a
 * duplicate" confirmation (uGP site creation and the PR map picker share it).
 */
exports.SITE_PROXIMITY_WARN_M = 300;
/**
 * Coordinate provenance, strongest first. A canonical uGP design's gensite is
 * the site coordinate; without one, the centroid of its elements; a manual PR
 * pick only stands until uGP knows better.
 */
const COORDINATE_RANK = { gensite: 3, centroid: 2, manual: 1 };
function coordinateRank(source) {
    return COORDINATE_RANK[String(source || "manual")] || 1;
}
/** Sites of any organization within `radiusM` of a point, nearest first. */
async function findNearbySites(latitude, longitude, radiusM = exports.SITE_PROXIMITY_WARN_M, excludeId) {
    const snap = await admin.firestore().collection("referenceData_sites").get();
    const out = [];
    for (const doc of snap.docs) {
        if (doc.id === excludeId)
            continue;
        const d = doc.data();
        const lat = asNumber(d.latitude);
        const lon = asNumber(d.longitude);
        if (lat === null || lon === null)
            continue;
        const distanceM = haversineMeters(latitude, longitude, lat, lon);
        if (distanceM <= radiusM) {
            out.push({
                id: doc.id,
                code: String(d.code || ""),
                name: String(d.name || ""),
                organizationId: String(d.organizationId || ""),
                distanceM: Math.round(distanceM),
            });
        }
    }
    return out.sort((a, b) => a.distanceM - b.distanceM);
}
/**
 * Register a canonical uGP design's site in the Nexus all-sites list.
 *
 * The 3-letter code is used exactly as given. When the org already has a site
 * with that code the caller must confirm the bind (`bindConfirmed`) — otherwise
 * 409 `conflict: "code"` returns the existing site so uGP can ask the user to
 * bind, pick another code, or cancel. A brand-new code within
 * SITE_PROXIMITY_WARN_M of another site needs `proximityConfirmed` (409
 * `conflict: "nearby"`). Coordinates are optional: a design with no elements
 * yet lands with `coordinatesPending` and uGP fills them in later.
 */
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
    const hasCoords = latitude !== null && longitude !== null;
    const coordinateSource = String(input.coordinateSource || "gensite");
    const bindConfirmed = input.bindConfirmed === true;
    const proximityConfirmed = input.proximityConfirmed === true;
    const active = input.active !== false;
    const address = asAddress(input.address) || asAddress(input.siteAddress);
    const ugpProjectId = asString(input.ugpProjectId);
    const ugpProjects = asUgpProjects(input.ugpProjects) ||
        (ugpProjectId ? [{ ugpProjectId, ugpProjectCode: code, ugpProjectName: name }] : undefined);
    const externalIds = input.externalIds || {};
    if (code && !externalIds.ugpSiteCode) {
        externalIds.ugpSiteCode = code;
    }
    if (!organizationId || !name || !/^[A-Z]{3}$/.test(code) || !ugpProjectId) {
        res.status(400).json({
            success: false,
            error: "organizationId, a 3-letter code, name and ugpProjectId are required",
        });
        return;
    }
    if (hasCoords && (!isValidLatitude(latitude) || !isValidLongitude(longitude))) {
        res.status(400).json({ success: false, error: "Coordinates are out of bounds" });
        return;
    }
    if (!(coordinateSource in COORDINATE_RANK)) {
        res.status(400).json({ success: false, error: "coordinateSource must be gensite, centroid or manual" });
        return;
    }
    const now = new Date().toISOString();
    const countryCode = normalizeCountryCode(organizationId, String(input.countryCode || ""));
    const docRef = await siteDocRef(organizationId, code);
    const docId = docRef.id;
    const snap = await docRef.get();
    if (snap.exists) {
        const data = snap.data();
        const incumbent = asString(data.canonicalUgpProjectId);
        if (incumbent && incumbent !== ugpProjectId) {
            res.status(409).json({
                success: false,
                conflict: "canonical",
                error: `Site '${code}' already has canonical uGP design '${incumbent}'. Re-point it deliberately instead.`,
                canonicalUgpProjectId: incumbent,
            });
            return;
        }
        if (!incumbent && !bindConfirmed) {
            res.status(409).json({
                success: false,
                conflict: "code",
                error: `The Nexus site list already has '${code}' (${data.name || code}). Confirm the bind, choose another code, or cancel.`,
                site: {
                    id: snap.id,
                    code: data.code,
                    name: data.name,
                    organizationId: data.organizationId,
                    latitude: asNumber(data.latitude),
                    longitude: asNumber(data.longitude),
                },
            });
            return;
        }
        const existingLinks = asUgpProjects(data.ugpProjects) || [];
        const links = existingLinks.some((p) => p.ugpProjectId === ugpProjectId)
            ? existingLinks
            : [...existingLinks, ...(ugpProjects || []).filter((p) => p.ugpProjectId === ugpProjectId)];
        const update = {
            canonicalUgpProjectId: ugpProjectId,
            ugpProjects: links,
            countryCode,
            externalIds: Object.assign(Object.assign({}, (data.externalIds || {})), externalIds),
            updatedAt: now,
            lastUgpIngestAt: now,
        };
        const hadCoords = asNumber(data.latitude) !== null && asNumber(data.longitude) !== null;
        if (hasCoords && (!hadCoords || coordinateRank(coordinateSource) >= coordinateRank(data.coordinateSource))) {
            Object.assign(update, {
                latitude,
                longitude,
                coordinateSource,
                coordinatesPending: false,
                coordinatesUpdatedBy: `ugp:${ugpProjectId}`,
                coordinatesUpdatedAt: now,
            });
        }
        if (!incumbent) {
            update.boundAt = now;
            update.boundBy = asString(input.boundBy) || `ugp:${ugpProjectId}`;
        }
        await docRef.set(update, { merge: true });
        res.status(200).json({ success: true, id: docId, bound: !incumbent, code });
        return;
    }
    if (hasCoords && !proximityConfirmed) {
        const nearby = await findNearbySites(latitude, longitude);
        if (nearby.length > 0) {
            res.status(409).json({
                success: false,
                conflict: "nearby",
                error: `${nearby.length} existing site(s) within ${exports.SITE_PROXIMITY_WARN_M} m. Confirm this is not a duplicate.`,
                nearby,
            });
            return;
        }
    }
    const payload = Object.assign(Object.assign(Object.assign(Object.assign({ organizationId,
        countryCode,
        code,
        name,
        active }, (hasCoords
        ? { latitude, longitude, coordinateSource, coordinatesPending: false, coordinatesUpdatedAt: now }
        : { coordinatesPending: true })), (address ? { siteAddress: address } : {})), (ugpProjects ? { ugpProjects } : {})), { canonicalUgpProjectId: ugpProjectId, externalIds, source: "ugp", updatedAt: now, createdAt: now });
    await docRef.set(payload, { merge: true });
    res.status(200).json({ success: true, id: docId, created: true, code, coordinatesPending: !hasCoords });
});
/**
 * uGP gensite placement moves the canonical site coordinate: when a gensite
 * is created inside a canonical design, uGP calls this so the site record's
 * coordinate equals the gensite coordinate. Only latitude/longitude (plus
 * provenance) are touched; the fanout trigger propagates the move to CC.
 */
exports.updateSiteCoordinates = functions.https.onRequest(async (req, res) => {
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
    const code = String(input.siteCode || input.code || "").trim().toUpperCase();
    const latitude = asNumber(input.latitude);
    const longitude = asNumber(input.longitude);
    const ugpProjectId = asString(input.ugpProjectId);
    const coordinateSource = String(input.coordinateSource || "gensite");
    if (!organizationId || !code || latitude === null || longitude === null) {
        res.status(400).json({
            success: false,
            error: "organizationId, siteCode, latitude and longitude are required",
        });
        return;
    }
    if (!(coordinateSource in COORDINATE_RANK)) {
        res.status(400).json({ success: false, error: "coordinateSource must be gensite, centroid or manual" });
        return;
    }
    if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) {
        res.status(400).json({ success: false, error: "Coordinates are out of bounds" });
        return;
    }
    const docRef = await siteDocRef(organizationId, code);
    const docId = docRef.id;
    const snap = await docRef.get();
    if (!snap.exists) {
        res.status(404).json({
            success: false,
            error: `Site '${code}' is not in the canonical registry for ${organizationId}. Create it in PR (Admin → Reference Data → Sites) first.`,
        });
        return;
    }
    const data = snap.data();
    const hadCoords = asNumber(data.latitude) !== null && asNumber(data.longitude) !== null;
    if (hadCoords && coordinateRank(coordinateSource) < coordinateRank(data.coordinateSource)) {
        res.status(200).json({ success: true, id: docId, unchanged: true, coordinateSource: data.coordinateSource });
        return;
    }
    const now = new Date().toISOString();
    await docRef.update({
        latitude,
        longitude,
        coordinateSource,
        coordinatesPending: false,
        coordinatesUpdatedBy: ugpProjectId ? `ugp:${ugpProjectId}` : "ugp",
        coordinatesUpdatedAt: now,
        updatedAt: now,
    });
    res.status(200).json({ success: true, id: docId, latitude, longitude, coordinateSource });
});
/**
 * Attach a uGP design to a canonical site. PR is authoritative for the
 * "one canonical uGP design per canonical site" invariant: the first
 * canonical link wins, subsequent attempts for a different project get
 * 409 with the incumbent project id so the caller can remediate.
 */
exports.linkUgpProject = functions.https.onRequest(async (req, res) => {
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
    const code = String(input.siteCode || input.code || "").trim().toUpperCase();
    const ugpProjectId = asString(input.ugpProjectId);
    const ugpProjectCode = asString(input.ugpProjectCode);
    const ugpProjectName = asString(input.ugpProjectName);
    const canonical = input.role === undefined || input.role === null || String(input.role) === "canonical";
    if (!organizationId || !code || !ugpProjectId) {
        res.status(400).json({
            success: false,
            error: "organizationId, siteCode and ugpProjectId are required",
        });
        return;
    }
    const docRef = await siteDocRef(organizationId, code);
    const docId = docRef.id;
    try {
        const result = await admin.firestore().runTransaction(async (tx) => {
            const snap = await tx.get(docRef);
            if (!snap.exists) {
                return { status: 404 };
            }
            const data = snap.data();
            const incumbent = asString(data.canonicalUgpProjectId);
            if (canonical && incumbent && incumbent !== ugpProjectId) {
                return { status: 409, incumbent };
            }
            const existing = asUgpProjects(data.ugpProjects) || [];
            const link = { ugpProjectId, ugpProjectCode, ugpProjectName };
            const links = existing.some((p) => p.ugpProjectId === ugpProjectId)
                ? existing
                : [...existing, link];
            const updates = {
                ugpProjects: links,
                updatedAt: new Date().toISOString(),
            };
            if (canonical) {
                updates.canonicalUgpProjectId = ugpProjectId;
            }
            tx.update(docRef, updates);
            return { status: 200, incumbent: canonical ? ugpProjectId : incumbent };
        });
        if (result.status === 404) {
            res.status(404).json({
                success: false,
                error: `Site '${code}' is not in the canonical registry for ${organizationId}. Create it in PR (Admin → Reference Data → Sites) first.`,
            });
            return;
        }
        if (result.status === 409) {
            res.status(409).json({
                success: false,
                error: `Site '${code}' already has canonical uGP design '${result.incumbent}'.`,
                canonicalUgpProjectId: result.incumbent,
            });
            return;
        }
        res.status(200).json({ success: true, id: docId, canonicalUgpProjectId: result.incumbent });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e instanceof Error ? e.message : String(e) });
    }
});
/**
 * Re-point a canonical site to a different uGP design (canonical switch).
 *
 * linkUgpProject refuses (409) when a different design already holds the
 * pointer, so there was no way to switch which variant is canonical as a site
 * evolves (redesign / fork becomes the build). This endpoint performs a
 * deliberate, audited re-point: it records the handoff in `canonicalHistory[]`
 * (from → to, when, who, why) before moving `canonicalUgpProjectId`.
 *
 * Safety: pass `expectedIncumbent` (the project you believe currently holds the
 * pointer) to make the switch conditional — a mismatch returns 409 with the
 * actual incumbent so a stale caller can't silently hijack the site.
 */
exports.repointCanonicalUgpProject = functions.https.onRequest(async (req, res) => {
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
    const code = String(input.siteCode || input.code || "").trim().toUpperCase();
    const ugpProjectId = asString(input.ugpProjectId);
    const ugpProjectCode = asString(input.ugpProjectCode);
    const ugpProjectName = asString(input.ugpProjectName);
    const expectedIncumbent = asString(input.expectedIncumbent);
    const reason = asString(input.reason);
    const switchedBy = asString(input.switchedBy);
    if (!organizationId || !code || !ugpProjectId) {
        res.status(400).json({
            success: false,
            error: "organizationId, siteCode and ugpProjectId are required",
        });
        return;
    }
    const docRef = await siteDocRef(organizationId, code);
    const docId = docRef.id;
    try {
        const result = await admin.firestore().runTransaction(async (tx) => {
            const snap = await tx.get(docRef);
            if (!snap.exists) {
                return { status: 404 };
            }
            const data = snap.data();
            const incumbent = asString(data.canonicalUgpProjectId);
            // Conditional-switch guard: if the caller named the expected incumbent and
            // it doesn't match reality, refuse (stale caller / race).
            if (expectedIncumbent && incumbent && incumbent !== expectedIncumbent) {
                return { status: 409, incumbent };
            }
            // No-op: already canonical.
            if (incumbent === ugpProjectId) {
                return { status: 200, incumbent, unchanged: true };
            }
            const now = new Date().toISOString();
            const existing = asUgpProjects(data.ugpProjects) || [];
            const link = { ugpProjectId, ugpProjectCode, ugpProjectName };
            const links = existing.some((p) => p.ugpProjectId === ugpProjectId)
                ? existing
                : [...existing, link];
            // Audit trail of canonical handoffs for this site.
            const history = Array.isArray(data.canonicalHistory) ? data.canonicalHistory : [];
            const handoff = {
                from: incumbent || null,
                to: ugpProjectId,
                at: now,
            };
            if (switchedBy)
                handoff.by = switchedBy;
            if (reason)
                handoff.reason = reason;
            tx.update(docRef, {
                canonicalUgpProjectId: ugpProjectId,
                ugpProjects: links,
                canonicalHistory: [...history, handoff],
                updatedAt: now,
            });
            return { status: 200, incumbent, unchanged: false };
        });
        if (result.status === 404) {
            res.status(404).json({
                success: false,
                error: `Site '${code}' is not in the canonical registry for ${organizationId}. Create it in PR (Admin → Reference Data → Sites) first.`,
            });
            return;
        }
        if (result.status === 409) {
            res.status(409).json({
                success: false,
                error: `Site '${code}' canonical design is '${result.incumbent}', not the expected '${expectedIncumbent}'. Re-read and retry.`,
                canonicalUgpProjectId: result.incumbent,
            });
            return;
        }
        res.status(200).json({
            success: true,
            id: docId,
            previousCanonicalUgpProjectId: result.incumbent || null,
            canonicalUgpProjectId: ugpProjectId,
            unchanged: result.unchanged === true,
        });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e instanceof Error ? e.message : String(e) });
    }
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
    const hasCoords = isValidLatitude(event.site.latitude) && isValidLongitude(event.site.longitude);
    const dedupeRef = admin.firestore().collection("siteSyncDeliveries").doc(event.idempotencyKey);
    const dedupe = await dedupeRef.get();
    if (dedupe.exists)
        return;
    // CC ingest does not use coordinates. A missing GPS used to drop the
    // entire fanout, so PR/uGP sites never reached Customer Care. Always
    // deliver CC; skip AM/FM when the point is missing.
    await dispatchSiteFanout(event, { skipAmFm: !hasCoords });
    await dedupeRef.set({
        idempotencyKey: event.idempotencyKey,
        deliveredAt: admin.firestore.FieldValue.serverTimestamp(),
        eventType: event.eventType,
        siteCode: event.site.code,
        organizationId: event.site.organizationId,
    });
});
const ORG_TO_UGP_COUNTRY = { LSO: "LS", BEN: "BJ", ZMB: "ZM" };
function ugpCountryForOrg(organizationId) {
    const org = normalizeOrgId(organizationId);
    const iso3 = ORG_TO_COUNTRY[org] ||
        (org.includes("benin") ? "BEN" : org.includes("lesotho") ? "LSO" : org.includes("zambia") ? "ZMB" : "");
    return ORG_TO_UGP_COUNTRY[iso3] || "";
}
async function ugpDesignsForCode(country, code) {
    const base = String(process.env.UGP_INTEGRATION_BASE_URL || "").trim().replace(/\/+$/, "");
    const key = String(process.env.UGP_INTEGRATION_KEY || "").trim();
    if (!base || !key)
        return { designs: [], error: "uGP integration is not configured" };
    const root = base.endsWith("/api/v1") ? base : `${base}/api/v1`;
    const url = `${root}/sites?country=${encodeURIComponent(country)}&code=${encodeURIComponent(code)}`;
    try {
        const resp = await fetch(url, { headers: { "X-UGP-Integration-Key": key } });
        if (!resp.ok)
            return { designs: [], error: `uGP returned HTTP ${resp.status}` };
        const body = (await resp.json());
        return { designs: Array.isArray(body.designs) ? body.designs : [] };
    }
    catch (e) {
        return { designs: [], error: e instanceof Error ? e.message : String(e) };
    }
}
/**
 * PR site form pre-save check: uGP designs that already use this 3-letter
 * code in the site's country (bind or choose another code), and existing
 * Nexus sites within SITE_PROXIMITY_WARN_M of the picked point.
 */
exports.checkSiteConflicts = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Sign in to check site conflicts");
    }
    const organizationId = normalizeOrgId(String((data === null || data === void 0 ? void 0 : data.organizationId) || ""));
    const code = String((data === null || data === void 0 ? void 0 : data.code) || "").trim().toUpperCase();
    const latitude = asNumber(data === null || data === void 0 ? void 0 : data.latitude);
    const longitude = asNumber(data === null || data === void 0 ? void 0 : data.longitude);
    const excludeId = asString(data === null || data === void 0 ? void 0 : data.excludeId);
    const country = ugpCountryForOrg(organizationId);
    const ugp = country && /^[A-Z]{3}$/.test(code)
        ? await ugpDesignsForCode(country, code)
        : { designs: [] };
    const nearby = latitude !== null && longitude !== null
        ? await findNearbySites(latitude, longitude, exports.SITE_PROXIMITY_WARN_M, excludeId)
        : [];
    return {
        radiusM: exports.SITE_PROXIMITY_WARN_M,
        ugpCountry: country,
        ugpDesigns: ugp.designs,
        ugpError: ugp.error || null,
        nearby,
    };
});
//# sourceMappingURL=siteSync.js.map