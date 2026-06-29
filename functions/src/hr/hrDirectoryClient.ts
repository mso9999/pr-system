/**
 * Server-to-server client for the 1PWR HR portal directory API.
 *
 * HR is the canonical source of truth for 1PWR employee metadata. This
 * client is intentionally server-only — the API key must never reach the
 * browser. See docs/HR_API_INTEGRATION.md (HR repo) and
 * docs/HR_EMPLOYEE_SYNC.md (this repo) for the contract.
 *
 * Base URL defaults to https://hr.1pwrafrica.com. Override with
 * HR_API_BASE_URL for staging/smoke tests.
 *
 * Auth: X-API-Key header = process.env.HR_API_KEY_PR_PORTAL.
 */
const DEFAULT_BASE_URL = "https://hr.1pwrafrica.com";
const TIMEOUT_MS = 8000;

export interface HrEmployee {
  id: number;
  employee_id: string | null;
  name: string;
  email: string;
  role: string;
  type: string;
  country: string | null;
  department: string | null;
  primary_deployment: string | null;
  status: string;
  headshot: string | null;
  employment_start_date: string | null;
  current_position_title: string | null;
  phone: string | null;
  last_updated_at: string | null;
}

export interface HrDirectoryResponse {
  count: number;
  employees: HrEmployee[];
}

export interface HrMetaResponse {
  countries: string[];
  departments: string[];
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
  return String(process.env.HR_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
}

function apiKey(): string {
  return String(process.env.HR_API_KEY_PR_PORTAL || "").trim();
}

async function getJson<T>(path: string): Promise<T> {
  const key = apiKey();
  if (!key) {
    throw new Error("HR_API_KEY_PR_PORTAL is not set — cannot call HR API");
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
          "X-API-Key": key,
        },
        signal: controller.signal,
      });
      clearTimeout(timer);
      lastStatus = Number(res.status || 0);
      lastBody = await res.text();
      if (res.ok) {
        return JSON.parse(lastBody) as T;
      }
      // 401/403/404 are not retryable
      if (lastStatus === 401 || lastStatus === 403 || lastStatus === 404) {
        break;
      }
    } catch (err) {
      // network/abort error — retry with backoff
      lastStatus = 0;
      lastBody = err instanceof Error ? err.message : String(err);
    }
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }

  if (lastStatus === 404) {
    const err = new Error(`HR API 404: ${path}`);
    (err as any).status = 404;
    throw err;
  }
  throw new Error(`HR API ${path} failed (HTTP ${lastStatus}): ${lastBody.slice(0, 200)}`);
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

export async function getDirectory(opts: {
  country?: string;
  department?: string;
  since?: string;
} = {}): Promise<HrDirectoryResponse> {
  const q = buildQuery({
    country: opts.country,
    department: opts.department,
    since: opts.since,
  });
  return getJson<HrDirectoryResponse>(`/api/employees/directory${q}`);
}

export async function getMeta(): Promise<HrMetaResponse> {
  return getJson<HrMetaResponse>(`/api/employees/meta`);
}

export async function lookupEmployee(employeeId: string): Promise<{
  employee_id: string;
  name: string;
  email: string;
  role: string;
} | null> {
  try {
    return await getJson(`/api/employees/lookup/${encodeURIComponent(employeeId)}`);
  } catch (err) {
    if ((err as any)?.status === 404) return null;
    throw err;
  }
}

export async function showEmployee(employeeId: string): Promise<HrEmployee | null> {
  try {
    return await getJson<HrEmployee>(`/api/employees/show/${encodeURIComponent(employeeId)}`);
  } catch (err) {
    if ((err as any)?.status === 404) return null;
    throw err;
  }
}

/** Smoke test the key + egress from the running runtime. */
export async function smokeTest(): Promise<{ ok: boolean; status: number; message: string }> {
  const key = apiKey();
  if (!key) {
    return { ok: false, status: 0, message: "HR_API_KEY_PR_PORTAL is not set" };
  }
  try {
    const r = await getDirectory({ country: "LS" });
    return {
      ok: true,
      status: 200,
      message: `OK — directory returned ${r.count} employee(s) for country=LS`,
    };
  } catch (err) {
    return {
      ok: false,
      status: (err as any)?.status || 0,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
