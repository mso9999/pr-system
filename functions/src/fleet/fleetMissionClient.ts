/**
 * Server-to-server client for the 1PWR Fleet Hub mission API.
 *
 * Used by the PR field-camp provisioning wizard to prepopulate "number of persons"
 * (crew_size) and "number of days" (departure_date → return_date) from a linked
 * Fleet mission. The Fleet Integration Key is kept server-side — never exposed to
 * the browser.
 *
 * Endpoint: GET <FLEET_API_BASE_URL>/api/integrations/v1/missions
 *   Query: org=<organizationId>, id=<missionId>, hrRequestId=<...>, approvalStatus=<...>
 *   Auth:  X-Fleet-Integration-Key: <FLEET_INTEGRATION_API_KEY>
 *   Response: an array of mission rows, or a single row / null when `id` is supplied.
 *
 * Base URL defaults to https://fm.1pwrafrica.com. Override with FLEET_API_BASE_URL.
 */
const DEFAULT_BASE_URL = "https://fm.1pwrafrica.com";
const TIMEOUT_MS = 8000;

export interface FleetMissionPerson {
  employee_id: string;
  name: string;
  department?: string | null;
  country?: string | null;
}

export interface FleetMission {
  id: string;
  organization_id: string;
  title: string;
  destination: string;
  departure_date: string;
  return_date: string;
  mission_type: string;
  passengers: string;
  /** Numeric crew size — the canonical "number of persons" for provisioning. */
  crew_size: number;
  /** JSON string of a personnel manifest (parsed via parseManifest). */
  personnel_manifest: string;
  loadout_summary: string;
  notes: string;
  status: string;
  approval_status: string;
  mission_profile: string;
  trip_shape: string;
  required_vehicle_class: string;
  created_at: string;
  updated_at: string;
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

async function getJson<T>(path: string): Promise<T> {
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
        method: "GET",
        headers: {
          Accept: "application/json",
          "X-Fleet-Integration-Key": key,
        },
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
  throw new Error(`Fleet API ${path} failed (HTTP ${lastStatus}): ${lastBody.slice(0, 200)}`);
}

/** Parse the personnel_manifest JSON string into a typed array (defensive). */
export function parseManifest(raw: string | null | undefined): FleetMissionPerson[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((p) => p && typeof p === "object")
      .map((p) => ({
        employee_id: String((p as any).employee_id || ""),
        name: String((p as any).name || ""),
        department: (p as any).department ?? null,
        country: (p as any).country ?? null,
      }));
  } catch {
    return [];
  }
}

/** Whole days between two ISO dates (return − departure), minimum 0. */
export function missionDays(m: { departure_date?: string; return_date?: string }): number {
  const d = m.departure_date ? Date.parse(m.departure_date) : NaN;
  const r = m.return_date ? Date.parse(m.return_date) : NaN;
  if (!Number.isFinite(d) || !Number.isFinite(r)) return 0;
  const ms = r - d;
  if (ms <= 0) return 0;
  return Math.round(ms / 86_400_000);
}

export async function listFleetMissions(opts: {
  org?: string;
  approvalStatus?: string;
} = {}): Promise<FleetMission[]> {
  const q = buildQuery({ org: opts.org, approvalStatus: opts.approvalStatus });
  const body = await getJson<FleetMission[] | { error: string }>(`/api/integrations/v1/missions${q}`);
  if (Array.isArray(body)) return body;
  throw new Error(`Fleet API returned non-array response: ${JSON.stringify(body).slice(0, 200)}`);
}

export async function getFleetMission(id: string, org?: string): Promise<FleetMission | null> {
  try {
    const q = buildQuery({ id, org });
    const body = await getJson<FleetMission | null | FleetMission[]>(`/api/integrations/v1/missions${q}`);
    if (Array.isArray(body)) return body[0] ?? null;
    return body ?? null;
  } catch (err) {
    if ((err as any)?.status === 404) return null;
    throw err;
  }
}

/** Smoke test the key + egress from the running runtime. */
export async function smokeTestFleet(): Promise<{ ok: boolean; status: number; message: string }> {
  const key = apiKey();
  if (!key) {
    return { ok: false, status: 0, message: "FLEET_INTEGRATION_API_KEY is not set" };
  }
  try {
    const rows = await listFleetMissions({ org: "1pwr_lesotho" });
    return {
      ok: true,
      status: 200,
      message: `OK — Fleet returned ${rows.length} mission(s) for org=1pwr_lesotho`,
    };
  } catch (err) {
    return {
      ok: false,
      status: (err as any)?.status || 0,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
