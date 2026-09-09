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
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { ArchiveQueryError, listArchivedPurchaseRequests } from "./catalog/archiveRead";
import { isRateLimited, logCatalogCall, resolveConsumer } from "./catalog/auth";
import {
  listCommitments,
  listEnhancedVendors,
  listExpenseTypes,
  listLeadTimes,
  listProjectCategories,
  listPurchaseRequests,
} from "./catalog/procurementRead";

const db = admin.firestore();

function forbidden(res: functions.Response): void {
  res.status(403).json({ error: "Forbidden — valid X-API-Key required" });
}

function notFound(res: functions.Response): void {
  res.status(404).json({ error: "Not found" });
}

interface CountryRow {
  code: string;
  name: string;
  active: boolean;
}

interface OrganizationRow {
  id: string;
  name: string;
  countryCode: string | null;
  country: string | null;
  currency: string | null;
  timezoneOffset: number | null;
  active: boolean;
}

async function listCountries(): Promise<{ count: number; countries: CountryRow[] }> {
  const snap = await db.collection("referenceData_countries").get();
  const rows: CountryRow[] = snap.docs
    .map((d) => {
      const data = d.data() as {
        code?: string;
        name?: string;
        active?: boolean;
      };
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

function resolveOrgCountryIso2(
  id: string,
  data: { countryCode?: string | null; country?: string | null }
): string | null {
  const fromField = String(data.countryCode || "").trim().toUpperCase();
  if (fromField) return fromField;
  const fallback: Record<string, string> = {
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
  if (fallback[id]) return fallback[id];
  const countryName = String(data.country || "").trim().toUpperCase();
  const byName: Record<string, string> = {
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

async function listOrganizations(countryFilter?: string): Promise<{
  count: number;
  organizations: OrganizationRow[];
}> {
  // Filter in memory. A Firestore `where("countryCode", "==", "LS")` drops
  // catalog rows (notably SMP) that still have `country: "Lesotho"` from the
  // original import and were never backfilled with countryCode.
  const snap = await db.collection("referenceData_organizations").get();
  const wanted = countryFilter ? countryFilter.trim().toUpperCase() : "";
  const rows: OrganizationRow[] = snap.docs
    .map((d) => {
      const data = d.data() as {
        name?: string;
        countryCode?: string | null;
        country?: string | null;
        currency?: string | null;
        timezoneOffset?: number | null;
        active?: boolean | string;
      };
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

interface SiteRow {
  id: string;
  code: string | null;
  name: string;
  countryCode: string | null;
  organizationId: string | null;
  active: boolean;
  canonicalUgpProjectId: string | null;
}


async function listSites(countryFilter?: string, orgFilter?: string): Promise<{
  count: number;
  sites: SiteRow[];
}> {
  let q: admin.firestore.Query = db.collection("referenceData_sites");
  if (countryFilter) {
    q = q.where("countryCode", "==", countryFilter.toUpperCase());
  }
  if (orgFilter) {
    q = q.where("organizationId", "==", orgFilter);
  }
  const snap = await q.get();
  const rows: SiteRow[] = snap.docs.map((d) => {
    const data = d.data() as {
      code?: string;
      name?: string;
      countryCode?: string | null;
      organizationId?: string | null;
      active?: boolean;
      canonicalUgpProjectId?: string | null;
    };
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

export const prCatalogApi = functions
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
    const consumer = resolveConsumer(req);
    if (!consumer) {
      forbidden(res);
      return;
    }
    if (isRateLimited(consumer.name)) {
      res.status(429).json({ error: "Rate limit exceeded (60 req/min per consumer)" });
      logCatalogCall({ consumer: consumer.name, method: req.method, path: String(req.path || ""), status: 429, ms: Date.now() - started });
      return;
    }

    const path = String(req.path || "").replace(/^\/+/, "");
    const normalized = path.replace(/^prCatalogApi\/+/, "");
    const q = req.query as Record<string, unknown>;

    const ok = (body: unknown, status = 200) => {
      res.status(status).set("Cache-Control", "no-store, max-age=0").json(body);
      logCatalogCall({ consumer: consumer.name, method: req.method, path: normalized, status, ms: Date.now() - started });
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
      if (
        normalized === "api/vendors" ||
        normalized === "vendors" ||
        normalized === "api/v1/vendors"
      ) {
        ok(await listEnhancedVendors());
        return;
      }
      if (normalized === "api/categories" || normalized === "api/v1/categories") {
        ok(await listProjectCategories());
        return;
      }
      if (normalized === "api/expense-types" || normalized === "api/v1/expense-types") {
        ok(await listExpenseTypes());
        return;
      }
      if (
        normalized === "api/v1/purchase-requests" ||
        normalized === "api/v1/purchaseRequests"
      ) {
        ok(await listPurchaseRequests(q));
        return;
      }
      if (normalized === "api/v1/archived-purchase-requests") {
        ok(await listArchivedPurchaseRequests(q));
        return;
      }
      if (normalized === "api/v1/commitments") {
        ok(await listCommitments(q));
        return;
      }
      if (normalized === "api/v1/lead-times" || normalized === "api/v1/leadTimes") {
        ok(await listLeadTimes(q));
        return;
      }
      notFound(res);
      logCatalogCall({ consumer: consumer.name, method: req.method, path: normalized, status: 404, ms: Date.now() - started });
    } catch (err) {
      if (err instanceof ArchiveQueryError) {
        res.status(400).json({ error: err.message });
        logCatalogCall({ consumer: consumer.name, method: req.method, path: normalized, status: 400, ms: Date.now() - started });
        return;
      }
      console.error("[prCatalogApi] error:", err);
      res.status(500).json({ error: "Internal error" });
      logCatalogCall({ consumer: consumer.name, method: req.method, path: normalized, status: 500, ms: Date.now() - started });
    }
  });
