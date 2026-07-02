/**
 * Server-to-server client for the 1PWR HR portal DEPARTMENT CATALOG API.
 *
 * As of 2026-06-30 HR is the canonical source for the department catalog
 * (see HR_API_INTEGRATION.md §3.5 + §12). PR is a consumer: it mirrors
 * `/api/departments` into `referenceData_departments` and resolves HR
 * department names to PR doc ids via the mirrored catalog.
 *
 * Server-only — the API key must never reach the browser. Same env vars
 * as the employee directory client: HR_API_BASE_URL + HR_API_KEY_PR_PORTAL.
 */
const DEFAULT_BASE_URL = "https://hr.1pwrafrica.com";
const TIMEOUT_MS = 8000;

export type HrDepartmentSourceSystem = "pr" | "hr" | "hr_renamed";

export interface HrDepartment {
  id: number;
  name: string;
  /** ISO-2 country code (HR aliases country_code → country). */
  country: string | null;
  /** Org slug, e.g. 1pwr_lesotho, pueco_lesotho, smp, neo1, 1pwr_benin, 1pwr_zambia. */
  organization_id: string;
  active: boolean;
  source_system: HrDepartmentSourceSystem;
  /** PR Firestore doc id when source_system='pr'; HR-generated slug otherwise. */
  source_doc_id: string | null;
  source_synced_at: string | null;
  /** Alias names (HR model exposes these; the API serializer may omit — handled defensively). */
  aliases?: string[] | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface HrDepartmentsResponse {
  count: number;
  departments: HrDepartment[];
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

export async function getDepartments(opts: {
  country?: string;
  organization?: string;
  active?: boolean;
  since?: string;
} = {}): Promise<HrDepartmentsResponse> {
  const q = buildQuery({
    country: opts.country,
    organization: opts.organization,
    active: opts.active === undefined ? undefined : opts.active ? "true" : "false",
    since: opts.since,
  });
  return getJson<HrDepartmentsResponse>(`/api/departments${q}`);
}

export async function showDepartment(id: number | string): Promise<HrDepartment | null> {
  try {
    return await getJson<HrDepartment>(`/api/departments/${encodeURIComponent(String(id))}`);
  } catch (err) {
    if ((err as any)?.status === 404) return null;
    throw err;
  }
}

/** Pull every department (all pages if HR ever paginates; today it returns all). */
export async function getAllDepartments(since?: string): Promise<HrDepartmentsResponse> {
  return getDepartments({ since });
}
