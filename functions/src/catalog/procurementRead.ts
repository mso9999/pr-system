/**
 * Brief 02 — committed procurement + lead-time reads.
 *
 * Lives on prCatalogApi (same key, same envelope). archivePRs are excluded
 * from lead-time stats: they are Google Forms imports with no status history.
 * Ordered/delivered timestamps come from PR itself (orderedAt, completedAt,
 * statusHistory) — no AM movements join required.
 */
import * as admin from "firebase-admin";
import { projectLines, ProcurementLine, LineDataStatus } from "./procurementLines";
import { daysBetween, percentileBlock, PercentileBlock } from "./stats";
import { deriveVendorOrigin, VendorOrigin } from "./vendorOrigin";

export { deriveVendorOrigin };
export type { VendorOrigin };

const db = admin.firestore();

const COMMITTED_STATUSES = new Set(["APPROVED", "ORDERED"]);
const LEADTIME_STATUSES = new Set(["COMPLETED", "ORDERED"]);

function asString(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function asIso(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "string") {
    const t = Date.parse(v);
    return Number.isFinite(t) ? new Date(t).toISOString() : null;
  }
  if (typeof (v as { toDate?: () => Date }).toDate === "function") {
    return (v as { toDate: () => Date }).toDate().toISOString();
  }
  return null;
}

function normalizeOrg(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]/g, "_");
}

function firstHistory(hist: Array<{ status?: string; timestamp?: unknown }>, status: string): string | null {
  for (const h of hist) {
    if (String(h.status || "").toUpperCase() === status) return asIso(h.timestamp);
  }
  return null;
}

interface RawPr {
  id: string;
  prNumber: string;
  status: string;
  organization: string;
  organizationId: string;
  siteIds: string[];
  department: string | null;
  description: string;
  category: string | null;
  expenseType: string | null;
  estimatedAmount: number | null;
  currency: string | null;
  vendorId: string | null;
  quotes: Array<{ vendorId: string | null; vendorName: string | null; amount: number | null; currency: string | null }>;
  createdAt: string | null;
  approvedAt: string | null;
  orderedAt: string | null;
  expectedDelivery: string | null;
  deliveredAt: string | null;
  ugpPartIds: string[];
  mappingConfidence: number | null;
  mappingSource: "ai" | "human" | "rule" | null;
  incoterm: string | null;
  lineItems: ProcurementLine[];
  lineItemsStatus: LineDataStatus;
  poLineItems: ProcurementLine[];
  poLineItemsStatus: LineDataStatus;
}

function loadRawPr(id: string, data: FirebaseFirestore.DocumentData): RawPr {
  const requestLines = projectLines(data.lineItems);
  const poLines = projectLines(data.lineItemsWithSKU);
  const hist = Array.isArray(data.statusHistory) ? data.statusHistory : [];
  const sites: string[] = [];
  if (Array.isArray(data.sites)) {
    for (const s of data.sites) {
      if (typeof s === "string" && s.trim()) sites.push(s.trim());
      else if (s && typeof s === "object" && (s.id || s.name)) sites.push(String(s.id || s.name));
    }
  } else if (data.site) {
    sites.push(asString(data.site));
  }
  const quotes = Array.isArray(data.quotes)
    ? data.quotes.map((q: Record<string, unknown>) => ({
        vendorId: asString(q.vendorId || q.vendor_id) || null,
        vendorName: asString(q.vendorName || q.vendor_name) || null,
        amount: asNumber(q.amount),
        currency: asString(q.currency || q.currencyId) || null,
      }))
    : [];
  const ugpPartIds = Array.isArray(data.ugpPartIds)
    ? data.ugpPartIds.map((x: unknown) => asString(x)).filter(Boolean)
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
    estimatedAmount: asNumber(data.totalAmount ?? data.estimatedAmount),
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

async function loadAllLivePrs(): Promise<RawPr[]> {
  const snap = await db.collection("purchaseRequests").get();
  return snap.docs.map((d) => loadRawPr(d.id, d.data()));
}

function queryStr(q: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = asString(q[k]);
    if (v) return v;
  }
  return "";
}

export interface PurchaseRequestRow {
  id: string;
  prId: string;
  status: string;
  organization: string;
  organizationId: string;
  site: string | null;
  sites: string[];
  department: string | null;
  description: string;
  category: string | null;
  expenseType: string | null;
  estimatedAmount: number | null;
  currency: string | null;
  vendorId: string | null;
  quotes: RawPr["quotes"];
  createdAt: string | null;
  approvedAt: string | null;
  orderedAt: string | null;
  expectedDelivery: string | null;
  deliveredAt: string | null;
  ugpPartIds: string[];
  mappingConfidence: number | null;
  mappingSource: "ai" | "human" | "rule" | null;
  incoterm: string | null;
  lineItems: ProcurementLine[];
  lineItemsStatus: LineDataStatus;
  poLineItems: ProcurementLine[];
  poLineItemsStatus: LineDataStatus;
  quantityBasis: { lineItems: "requested"; poLineItems: "recorded_po_lines" };
  receiptEvidenceStatus: "not_connected";
  sourceCollection: "purchaseRequests";
}

function toRow(p: RawPr): PurchaseRequestRow {
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

function matchesFilters(p: RawPr, q: Record<string, unknown>): boolean {
  const status = queryStr(q, "status").toUpperCase();
  if (status && p.status !== status) return false;
  const org = queryStr(q, "organization", "org");
  if (org) {
    const n = normalizeOrg(org);
    if (normalizeOrg(p.organizationId) !== n && normalizeOrg(p.organization) !== n) return false;
  }
  const site = queryStr(q, "site");
  if (site) {
    const n = normalizeOrg(site);
    if (!p.siteIds.some((s) => normalizeOrg(s) === n || s === site)) return false;
  }
  const since = queryStr(q, "created_since", "createdSince");
  if (since && p.createdAt && p.createdAt < since) return false;
  const before = queryStr(q, "expected_before", "expectedBefore");
  if (before && p.expectedDelivery && p.expectedDelivery > before) return false;
  if (before && !p.expectedDelivery) return false;
  return true;
}

function decodeCursor(raw: string): { createdAt: string; id: string } | null {
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (parsed && typeof parsed.createdAt === "string" && typeof parsed.id === "string") return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

export async function listPurchaseRequests(query: Record<string, unknown>): Promise<{
  count: number;
  items: PurchaseRequestRow[];
  nextCursor: string | null;
}> {
  const limitRaw = Number(queryStr(query, "limit") || 100);
  const limit = Math.min(500, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 100));
  const cursor = decodeCursor(queryStr(query, "cursor"));
  const all = (await loadAllLivePrs())
    .filter((p) => matchesFilters(p, query))
    .sort((a, b) => {
      const ca = a.createdAt || "";
      const cb = b.createdAt || "";
      if (ca !== cb) return cb.localeCompare(ca);
      return b.id.localeCompare(a.id);
    });
  let start = 0;
  if (cursor) {
    const idx = all.findIndex((p) => p.createdAt === cursor.createdAt && p.id === cursor.id);
    start = idx >= 0 ? idx + 1 : 0;
  }
  const page = all.slice(start, start + limit);
  const last = page[page.length - 1];
  const nextCursor =
    start + page.length < all.length && last
      ? Buffer.from(JSON.stringify({ createdAt: last.createdAt || "", id: last.id }), "utf8").toString("base64url")
      : null;
  return { count: all.length, items: page.map(toRow), nextCursor };
}

export interface CommitmentRow {
  month: string;
  organization: string;
  organizationId: string;
  site: string | null;
  category: string | null;
  committedAmount: number;
  currency: string;
  prCount: number;
  earliestExpected: string | null;
  latestExpected: string | null;
}

function cashMonth(p: RawPr): string {
  const iso = p.expectedDelivery || p.orderedAt || p.createdAt;
  return iso ? iso.slice(0, 7) : "unknown";
}

export async function listCommitments(query: Record<string, unknown>): Promise<{
  count: number;
  items: CommitmentRow[];
  notes: string;
}> {
  const org = queryStr(query, "organization", "org");
  const monthFilter = queryStr(query, "month");
  const buckets = new Map<string, CommitmentRow>();
  for (const p of await loadAllLivePrs()) {
    if (!COMMITTED_STATUSES.has(p.status)) continue;
    if (p.deliveredAt) continue;
    if (p.estimatedAmount == null) continue;
    if (org) {
      const n = normalizeOrg(org);
      if (normalizeOrg(p.organizationId) !== n && normalizeOrg(p.organization) !== n) continue;
    }
    const month = cashMonth(p);
    if (monthFilter && month !== monthFilter) continue;
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
    } else {
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
    if (a.month !== b.month) return a.month.localeCompare(b.month);
    if (a.organizationId !== b.organizationId) return a.organizationId.localeCompare(b.organizationId);
    return (a.site || "").localeCompare(b.site || "");
  });
  return {
    count: items.length,
    items,
    notes:
      "Cash month = expectedDelivery || orderedAt || createdAt (YYYY-MM). Status APPROVED or ORDERED only; rows with deliveredAt are excluded. Currencies are never mixed. Sum committedAmount for a month+organization to reconcile against /purchase-requests with the same filters.",
  };
}

export interface LeadTimeRow {
  vendorId: string;
  category: string | null;
  origin: VendorOrigin | null;
  n: number;
  daysOrderToDelivery: PercentileBlock | null;
  daysRequestToOrder: PercentileBlock | null;
  window: string;
  lowConfidence: boolean;
}

export async function listLeadTimes(query: Record<string, unknown>): Promise<{
  count: number;
  items: LeadTimeRow[];
  notes: string;
}> {
  const vendorFilter = queryStr(query, "vendor_id", "vendorId");
  const categoryFilter = queryStr(query, "category");
  const originFilter = queryStr(query, "origin").toLowerCase() as VendorOrigin | "";
  const since = queryStr(query, "since");

  const vendorSnap = await db.collection("referenceData_vendors").get();
  const originByVendor = new Map<string, VendorOrigin | null>();
  vendorSnap.docs.forEach((d) => {
    const v = d.data() as { country?: string; origin?: string; name?: string };
    const origin = deriveVendorOrigin(v.country, v.origin);
    originByVendor.set(d.id, origin);
    if (v.name) originByVendor.set(v.name, origin);
  });

  type Acc = { orderToDelivery: number[]; requestToOrder: number[]; dates: string[] };
  const groups = new Map<string, { vendorId: string; category: string | null; origin: VendorOrigin | null; acc: Acc }>();

  for (const p of await loadAllLivePrs()) {
    if (!LEADTIME_STATUSES.has(p.status)) continue;
    if (since && p.createdAt && p.createdAt < since) continue;
    if (vendorFilter && asString(p.vendorId).toLowerCase() !== vendorFilter.toLowerCase()) continue;
    if (categoryFilter && asString(p.category).toLowerCase() !== categoryFilter.toLowerCase()) continue;
    const origin = originByVendor.get(p.vendorId || "") ?? null;
    if (originFilter && origin !== originFilter) continue;

    const requestToOrder = daysBetween(p.createdAt, p.orderedAt);
    const orderToDelivery = daysBetween(p.orderedAt, p.deliveredAt);
    if (requestToOrder == null && orderToDelivery == null) continue;

    const vendorId = p.vendorId || "unknown";
    const key = [vendorId, p.category || "", origin || ""].join("|");
    let g = groups.get(key);
    if (!g) {
      g = { vendorId, category: p.category, origin, acc: { orderToDelivery: [], requestToOrder: [], dates: [] } };
      groups.set(key, g);
    }
    if (orderToDelivery != null) g.acc.orderToDelivery.push(orderToDelivery);
    if (requestToOrder != null) g.acc.requestToOrder.push(requestToOrder);
    if (p.createdAt) g.acc.dates.push(p.createdAt);
    if (p.deliveredAt) g.acc.dates.push(p.deliveredAt);
  }

  const items: LeadTimeRow[] = [...groups.values()]
    .map((g) => {
      const dates = g.acc.dates.sort();
      const n = Math.max(g.acc.orderToDelivery.length, g.acc.requestToOrder.length);
      return {
        vendorId: g.vendorId,
        category: g.category,
        origin: g.origin,
        n,
        daysOrderToDelivery: percentileBlock(g.acc.orderToDelivery),
        daysRequestToOrder: percentileBlock(g.acc.requestToOrder),
        window: dates.length ? `${dates[0].slice(0, 10)}..${dates[dates.length - 1].slice(0, 10)}` : "",
        lowConfidence: n < 5,
      };
    })
    .sort((a, b) => b.n - a.n);

  return {
    count: items.length,
    items,
    notes:
      "archivePRs excluded (legacy Google Forms imports, no status history). Lead times derived from purchaseRequests.orderedAt / completedAt / statusHistory — no AM movements join.",
  };
}

export interface EnhancedVendorRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  country: string | null;
  active: boolean;
  defaultCurrency: string | null;
  origin: VendorOrigin | null;
  incotermDefault: string | null;
}

export async function listEnhancedVendors(): Promise<{ count: number; vendors: EnhancedVendorRow[] }> {
  const snap = await db.collection("referenceData_vendors").get();
  const vendors = snap.docs
    .map((d) => {
      const data = d.data() as {
        name?: string;
        email?: string;
        contactEmail?: string;
        phone?: string;
        contactPhone?: string;
        country?: string;
        active?: boolean | string;
        isActive?: boolean;
        approved?: boolean;
        defaultCurrency?: string;
        currency?: string;
        origin?: string;
        incotermDefault?: string;
        incoterm?: string;
      };
      const active =
        data.active !== false &&
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
        origin: deriveVendorOrigin(data.country, data.origin),
        incotermDefault: data.incotermDefault || data.incoterm || null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  return { count: vendors.length, vendors };
}

interface CatalogRefRow {
  id: string;
  name: string;
  code: string | null;
  organizationId: string | null;
  active: boolean;
}

async function listRefCollection(
  collectionName: string
): Promise<{ count: number; items: CatalogRefRow[] }> {
  const snap = await db.collection(collectionName).get();
  const items = snap.docs
    .map((d) => {
      const data = d.data() as {
        name?: string;
        code?: string;
        organizationId?: string;
        active?: boolean | string;
      };
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

export function listProjectCategories(): Promise<{ count: number; items: CatalogRefRow[] }> {
  return listRefCollection("referenceData_projectCategories");
}

export function listExpenseTypes(): Promise<{ count: number; items: CatalogRefRow[] }> {
  return listRefCollection("referenceData_expenseTypes");
}
