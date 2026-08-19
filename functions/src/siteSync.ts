import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { createHash } from "crypto";

type SiteEventType = "site.created" | "site.updated" | "site.deactivated";
type SiteSource = "ugp" | "pr_admin";

interface SiteAddress {
  street?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
}

interface UgpProjectLink {
  ugpProjectId: string;
  ugpProjectCode?: string;
  ugpProjectName?: string;
}

interface SitePayload {
  organizationId: string;
  countryCode: string;
  code: string;
  name: string;
  active: boolean;
  latitude: number;
  longitude: number;
  district?: string;
  address?: SiteAddress;
  ugpProjects?: UgpProjectLink[];
  canonicalUgpProjectId?: string;
  externalIds?: Record<string, string>;
  createdBy?: string;
  createdAt?: string;
}

interface CanonicalSiteEvent {
  source: SiteSource;
  eventType: SiteEventType;
  site: SitePayload;
  idempotencyKey: string;
  updatedAt: string;
}

const ORG_TO_COUNTRY: Record<string, string> = {
  "1pwr_lesotho": "LSO",
  "1pwr_benin": "BEN",
  "1pwr_zambia": "ZMB",
};

function normalizeOrgId(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function normalizeCountryCode(organizationId: string, countryCode?: string): string {
  const fromOrg = ORG_TO_COUNTRY[normalizeOrgId(organizationId)];
  if (fromOrg) return fromOrg;
  const cleaned = (countryCode || "").trim().toUpperCase();
  return cleaned || "LSO";
}

function asNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  const s = String(value).trim();
  return s ? s : undefined;
}

function asAddress(value: unknown): SiteAddress | undefined {
  if (!value || typeof value !== "object") return undefined;
  const v = value as Record<string, unknown>;
  const address: SiteAddress = {
    street: asString(v.street),
    city: asString(v.city),
    region: asString(v.region),
    postalCode: asString(v.postalCode),
    country: asString(v.country),
  };
  return Object.values(address).some((x) => x !== undefined) ? address : undefined;
}

function asUgpProjects(value: unknown): UgpProjectLink[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const links: UgpProjectLink[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const ugpProjectId = asString(e.ugpProjectId);
    if (!ugpProjectId) continue;
    links.push({
      ugpProjectId,
      ugpProjectCode: asString(e.ugpProjectCode),
      ugpProjectName: asString(e.ugpProjectName),
    });
  }
  return links.length > 0 ? links : undefined;
}

function isValidLatitude(value: number): boolean {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

function isValidLongitude(value: number): boolean {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}

function buildDocId(organizationId: string, code: string): string {
  return `${normalizeOrgId(organizationId)}_${code.trim().toLowerCase()}`;
}

function buildIdempotencyKey(payload: {
  source: SiteSource;
  organizationId: string;
  code: string;
  eventType: SiteEventType;
  updatedAt: string;
}): string {
  const raw = `${payload.source}|${payload.organizationId}|${payload.code}|${payload.eventType}|${payload.updatedAt}`;
  return createHash("sha1").update(raw).digest("hex");
}

function expectedUgpApiKey(): string {
  return String(process.env.SITE_SYNC_UGP_API_KEY || "").trim();
}

function expectedFanoutApiKey(): string {
  return String(process.env.SITE_SYNC_FANOUT_API_KEY || "").trim();
}

function getBearerToken(req: functions.https.Request): string {
  const auth = String(req.headers.authorization || "");
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : "";
}

async function isAllowedIngestCaller(req: functions.https.Request): Promise<boolean> {
  const apiKey = String(req.headers["x-api-key"] || "").trim();
  const expected = expectedUgpApiKey();
  if (expected && apiKey && expected === apiKey) {
    return true;
  }

  const bearer = getBearerToken(req);
  if (!bearer) return false;

  try {
    await admin.auth().verifyIdToken(bearer);
    return true;
  } catch {
    const adminToken = String(process.env.FIREBASE_ADMIN_BEARER_TOKEN || "").trim();
    return adminToken !== "" && adminToken === bearer;
  }
}

async function retryPost(url: string, payload: CanonicalSiteEvent, headers: Record<string, string>): Promise<{ ok: boolean; status: number; body: string }> {
  const fetchFn: ((input: string, init?: unknown) => Promise<any>) | undefined = (globalThis as any).fetch;
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
    if (res.ok) return { ok: true, status: lastStatus, body: lastBody };
    if (lastStatus < 500 && lastStatus !== 429) break;
    await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
  }
  return { ok: false, status: lastStatus, body: lastBody };
}

async function dispatchSiteFanout(event: CanonicalSiteEvent): Promise<void> {
  const amUrl = String(process.env.SITE_SYNC_AM_ENDPOINT || "").trim();
  const fmUrl = String(process.env.SITE_SYNC_FM_ENDPOINT || "").trim();
  // CC runs one deployment per country lane; each lane self-filters payloads
  // whose countryCode is not its own, so every lane URL receives every event.
  const ccUrls = String(process.env.SITE_SYNC_CC_ENDPOINTS || "")
    .split(",")
    .map((u) => u.trim())
    .filter((u) => u.length > 0);
  const fanoutKey = expectedFanoutApiKey();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (fanoutKey) headers["X-API-Key"] = fanoutKey;
  const adminBearer = String(process.env.FIREBASE_ADMIN_BEARER_TOKEN || "").trim();
  if (adminBearer) headers.Authorization = `Bearer ${adminBearer}`;

  const deliveries: Array<{ target: string; ok: boolean; status: number; body: string }> = [];
  if (amUrl) {
    deliveries.push({ target: "am", ...(await retryPost(amUrl, event, headers)) });
  }
  if (fmUrl) {
    deliveries.push({ target: "fm", ...(await retryPost(fmUrl, event, headers)) });
  }
  for (const ccUrl of ccUrls) {
    deliveries.push({ target: `cc:${ccUrl}`, ...(await retryPost(ccUrl, event, headers)) });
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

function toCanonicalEvent(data: FirebaseFirestore.DocumentData, beforeExists: boolean): CanonicalSiteEvent {
  const updatedAt = String(data.updatedAt || new Date().toISOString());
  const active = data.active !== false;
  const eventType: SiteEventType = !active
    ? "site.deactivated"
    : beforeExists
      ? "site.updated"
      : "site.created";
  const source: SiteSource = data.source === "ugp" ? "ugp" : "pr_admin";

  const address = asAddress(data.address) || asAddress(data.siteAddress);
  const payload: SitePayload = {
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

function setCors(res: functions.Response): void {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
}

export const ingestUgpSite = functions.https.onRequest(async (req, res) => {
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

  const input = (req.body || {}) as Record<string, unknown>;
  const organizationId = normalizeOrgId(String(input.organizationId || ""));
  const code = String(input.code || "").trim().toUpperCase();
  const name = String(input.name || "").trim();
  const latitude = asNumber(input.latitude);
  const longitude = asNumber(input.longitude);
  const active = input.active !== false;
  const address = asAddress(input.address) || asAddress(input.siteAddress);
  const ugpProjects = asUgpProjects(input.ugpProjects);
  const externalIds = (input.externalIds as Record<string, string>) || {};
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
  const payload = {
    organizationId,
    countryCode,
    code,
    name,
    active,
    latitude,
    longitude,
    ...(address ? { siteAddress: address } : {}),
    ...(ugpProjects ? { ugpProjects } : {}),
    externalIds,
    source: "ugp",
    updatedAt: now,
    createdAt: now,
  };

  await admin
    .firestore()
    .collection("referenceData_sites")
    .doc(docId)
    .set(payload, { merge: true });

  res.status(200).json({ success: true, id: docId, site: payload });
});

/**
 * uGP gensite placement moves the canonical site coordinate: when a gensite
 * is created inside a canonical design, uGP calls this so the site record's
 * coordinate equals the gensite coordinate. Only latitude/longitude (plus
 * provenance) are touched; the fanout trigger propagates the move to CC.
 */
export const updateSiteCoordinates = functions.https.onRequest(async (req, res) => {
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

  const input = (req.body || {}) as Record<string, unknown>;
  const organizationId = normalizeOrgId(String(input.organizationId || ""));
  const code = String(input.siteCode || input.code || "").trim().toUpperCase();
  const latitude = asNumber(input.latitude);
  const longitude = asNumber(input.longitude);
  const ugpProjectId = asString(input.ugpProjectId);

  if (!organizationId || !code || latitude === null || longitude === null) {
    res.status(400).json({
      success: false,
      error: "organizationId, siteCode, latitude and longitude are required",
    });
    return;
  }
  if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) {
    res.status(400).json({ success: false, error: "Coordinates are out of bounds" });
    return;
  }

  const docId = buildDocId(organizationId, code);
  const docRef = admin.firestore().collection("referenceData_sites").doc(docId);
  const snap = await docRef.get();
  if (!snap.exists) {
    res.status(404).json({
      success: false,
      error: `Site '${code}' is not in the canonical registry for ${organizationId}. Create it in PR (Admin → Reference Data → Sites) first.`,
    });
    return;
  }

  const now = new Date().toISOString();
  await docRef.update({
    latitude,
    longitude,
    coordinatesUpdatedBy: ugpProjectId ? `ugp:${ugpProjectId}` : "ugp",
    coordinatesUpdatedAt: now,
    updatedAt: now,
  });

  res.status(200).json({ success: true, id: docId, latitude, longitude });
});

/**
 * Attach a uGP design to a canonical site. PR is authoritative for the
 * "one canonical uGP design per canonical site" invariant: the first
 * canonical link wins, subsequent attempts for a different project get
 * 409 with the incumbent project id so the caller can remediate.
 */
export const linkUgpProject = functions.https.onRequest(async (req, res) => {
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

  const input = (req.body || {}) as Record<string, unknown>;
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

  const docId = buildDocId(organizationId, code);
  const docRef = admin.firestore().collection("referenceData_sites").doc(docId);

  try {
    const result = await admin.firestore().runTransaction(async (tx) => {
      const snap = await tx.get(docRef);
      if (!snap.exists) {
        return { status: 404 as const };
      }
      const data = snap.data() as FirebaseFirestore.DocumentData;
      const incumbent = asString(data.canonicalUgpProjectId);
      if (canonical && incumbent && incumbent !== ugpProjectId) {
        return { status: 409 as const, incumbent };
      }

      const existing = asUgpProjects(data.ugpProjects) || [];
      const link: UgpProjectLink = { ugpProjectId, ugpProjectCode, ugpProjectName };
      const links = existing.some((p) => p.ugpProjectId === ugpProjectId)
        ? existing
        : [...existing, link];

      const updates: Record<string, unknown> = {
        ugpProjects: links,
        updatedAt: new Date().toISOString(),
      };
      if (canonical) {
        updates.canonicalUgpProjectId = ugpProjectId;
      }
      tx.update(docRef, updates);
      return { status: 200 as const, incumbent: canonical ? ugpProjectId : incumbent };
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
  } catch (e) {
    res.status(500).json({ success: false, error: e instanceof Error ? e.message : String(e) });
  }
});

export const fanoutSiteChanges = functions.firestore
  .document("referenceData_sites/{siteId}")
  .onWrite(async (change) => {
    if (!change.after.exists) return;
    const after = change.after.data();
    if (!after) return;
    if (!after.code || !after.organizationId || !after.name) return;

    const event = toCanonicalEvent(after, change.before.exists);
    if (!event.site.code || !event.site.organizationId) return;
    if (!isValidLatitude(event.site.latitude) || !isValidLongitude(event.site.longitude)) return;

    const dedupeRef = admin.firestore().collection("siteSyncDeliveries").doc(event.idempotencyKey);
    const dedupe = await dedupeRef.get();
    if (dedupe.exists) return;

    await dispatchSiteFanout(event);
    await dedupeRef.set({
      idempotencyKey: event.idempotencyKey,
      deliveredAt: admin.firestore.FieldValue.serverTimestamp(),
      eventType: event.eventType,
      siteCode: event.site.code,
      organizationId: event.site.organizationId,
    });
  });
