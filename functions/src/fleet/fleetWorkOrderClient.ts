/**
 * Server-to-server client for the 1PWR Fleet Hub work-order API.
 *
 * Backs the PR ↔ FM procurement gate: vehicle-expense PRs (expense type code 4)
 * must reference an open Fleet Hub work order before they can be pushed to an
 * approver, and creating such a PR registers a pr-link back in FM so the WO
 * carries the procurement trail (needs-parts → pr-submitted auto-advance).
 *
 * Endpoints:
 *   GET  <FLEET_API_BASE_URL>/api/integrations/v1/work-orders?org=&vehicleId=&status=
 *   GET  <FLEET_API_BASE_URL>/api/integrations/v1/work-orders/{id}
 *   POST <FLEET_API_BASE_URL>/api/integrations/v1/work-orders/{id}/pr-links
 * Auth:  X-Fleet-Integration-Key: <FLEET_INTEGRATION_API_KEY> (server-side only)
 */
const DEFAULT_BASE_URL = "https://fm.1pwrafrica.com";
const TIMEOUT_MS = 8000;

export interface FleetWorkOrder {
  id: string;
  organizationId: string;
  vehicleId: string;
  vehicleCode?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  title: string;
  description?: string;
  type?: string;
  priority?: string;
  status: string;
  totalCost?: number;
  totalLabourHours?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface FleetPrLinkBody {
  prNumber: string;
  poNumber?: string;
  vendor?: string;
  description?: string;
  amount?: number;
  currency?: string;
  status?: string;
  prSystemUrl?: string;
}

interface FetchLike {
  (input: string, init?: unknown): Promise<{
    ok: boolean;
    status: number;
    text: () => Promise<string>;
  }>;
}

function getFetch(): FetchLike {
  const fn = (globalThis as any).fetch;
  if (!fn) {
    throw new Error("fetch is not available in this runtime");
  }
  return fn as FetchLike;
}

function baseUrl(): string {
  return String(process.env.FLEET_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
}

function apiKey(): string {
  return String(process.env.FLEET_INTEGRATION_API_KEY || "").trim();
}

function buildQuery(params: Record<string, string | undefined>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
    }
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

async function request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const key = apiKey();
  if (!key) {
    throw new Error("FLEET_INTEGRATION_API_KEY is not set — cannot call Fleet API");
  }
  const url = `${baseUrl()}${path}`;
  const fetchFn = getFetch();

  let lastStatus = 0;
  let lastBody = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const controller = new (AbortController as any)();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const res = await fetchFn(url, {
        method,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Fleet-Integration-Key": key,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timer);
      lastStatus = Number(res.status || 0);
      lastBody = await res.text();
      if (res.ok) {
        return JSON.parse(lastBody) as T;
      }
      if (lastStatus === 401 || lastStatus === 403 || lastStatus === 404) {
        break;
      }
    } catch (err) {
      lastStatus = 0;
      lastBody = err instanceof Error ? err.message : String(err);
    }
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }

  if (lastStatus === 404) {
    const err = new Error(`Fleet API 404: ${path}`);
    (err as any).status = 404;
    throw err;
  }
  throw new Error(`Fleet API ${method} ${path} failed (HTTP ${lastStatus}): ${lastBody.slice(0, 200)}`);
}

export async function listFleetWorkOrders(opts: {
  org?: string;
  vehicleId?: string;
  status?: string;
} = {}): Promise<FleetWorkOrder[]> {
  const q = buildQuery({ org: opts.org, vehicleId: opts.vehicleId, status: opts.status });
  const body = await request<{ workOrders?: FleetWorkOrder[] }>("GET", `/api/integrations/v1/work-orders${q}`);
  return Array.isArray(body.workOrders) ? body.workOrders : [];
}

export async function getFleetWorkOrder(id: string): Promise<FleetWorkOrder | null> {
  try {
    return await request<FleetWorkOrder>("GET", `/api/integrations/v1/work-orders/${encodeURIComponent(id)}`);
  } catch (err) {
    if ((err as any)?.status === 404) return null;
    throw err;
  }
}

/** Register a PR against an FM work order (advances needs-parts → pr-submitted in FM). */
export async function registerFleetWorkOrderPrLink(
  workOrderId: string,
  link: FleetPrLinkBody,
): Promise<{ ok: boolean }> {
  await request<unknown>(
    "POST",
    `/api/integrations/v1/work-orders/${encodeURIComponent(workOrderId)}/pr-links`,
    link,
  );
  return { ok: true };
}
