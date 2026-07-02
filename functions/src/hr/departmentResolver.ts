/**
 * Resolves HR department name strings (e.g. "O&M", "Engineering") to PR
 * `referenceData_departments` doc ids. HR is canonical for the department
 * catalog as of 2026-06-30; PR mirrors it via departmentCatalogSync.
 *
 * Matching priority (most-specific first), all case/whitespace-insensitive:
 *   1. (country, organizationId, name)
 *   2. (country, name)            — used by the employee sync, which has
 *                                    country but not the employee's org_id
 *   3. (organizationId, name)
 *   4. (name)                     — last-resort fallback; ambiguous if the
 *                                    same name exists in multiple orgs
 *
 * Only active departments are eligible. If a name matches only an inactive
 * (tombstoned) department, it is reported as unmapped so an admin can fix
 * the HR record.
 *
 * Unmapped names and ambiguous matches are tracked for the reconciliation
 * report.
 */
import * as admin from "firebase-admin";

const db = admin.firestore();

export interface ResolveContext {
  country?: string | null;
  organizationId?: string | null;
}

export interface ResolveResult {
  departmentId: string | null;
  unmapped: boolean;
  ambiguous: boolean;
}

export interface DepartmentResolver {
  resolve: (name: string | null | undefined, ctx?: ResolveContext) => ResolveResult;
  unmappedNames: () => string[];
  ambiguousNames: () => string[];
}

function normalizeName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function normCountry(s: string | null | undefined): string {
  return String(s || "").trim().toUpperCase();
}

function normOrg(s: string | null | undefined): string {
  return String(s || "").trim().toLowerCase();
}

export async function buildDepartmentResolver(): Promise<DepartmentResolver> {
  const snap = await db.collection("referenceData_departments").get();

  // key → Set<docId>
  const byCountryOrgName = new Map<string, Set<string>>();
  const byCountryName = new Map<string, Set<string>>();
  const byOrgName = new Map<string, Set<string>>();
  const byName = new Map<string, Set<string>>();
  // Track inactive names so we can distinguish "no match" from "matches a tombstone".
  const inactiveNames = new Set<string>();

  const index = (map: Map<string, Set<string>>, key: string, docId: string) => {
    const set = map.get(key);
    if (set) set.add(docId);
    else map.set(key, new Set([docId]));
  };

  for (const d of snap.docs) {
    const data = d.data() as {
      name?: string;
      active?: boolean;
      country?: string | null;
      organizationId?: string | null;
      aliases?: string[] | null;
    };
    if (!data.name) continue;
    const nameKey = normalizeName(String(data.name));
    const isActive = data.active !== false;
    if (!isActive) {
      inactiveNames.add(nameKey);
      continue;
    }
    const country = normCountry(data.country);
    const org = normOrg(data.organizationId);

    index(byCountryOrgName, `${country}|${org}|${nameKey}`, d.id);
    if (country) index(byCountryName, `${country}|${nameKey}`, d.id);
    if (org) index(byOrgName, `${org}|${nameKey}`, d.id);
    index(byName, nameKey, d.id);

    // Also index aliases (HR alternate names) under the same scopes.
    if (Array.isArray(data.aliases)) {
      for (const alias of data.aliases) {
        if (!alias || !String(alias).trim()) continue;
        const aKey = normalizeName(String(alias));
        index(byCountryOrgName, `${country}|${org}|${aKey}`, d.id);
        if (country) index(byCountryName, `${country}|${aKey}`, d.id);
        if (org) index(byOrgName, `${org}|${aKey}`, d.id);
        index(byName, aKey, d.id);
      }
    }
  }

  const unmapped = new Set<string>();
  const ambiguous = new Set<string>();

  const pick = (set: Set<string> | undefined, name: string): ResolveResult => {
    if (!set || set.size === 0) return { departmentId: null, unmapped: false, ambiguous: false };
    if (set.size > 1) {
      ambiguous.add(name);
      return { departmentId: [...set][0], unmapped: false, ambiguous: true };
    }
    return { departmentId: [...set][0], unmapped: false, ambiguous: false };
  };

  const resolve = (name: string | null | undefined, ctx: ResolveContext = {}): ResolveResult => {
    if (!name || !String(name).trim()) {
      return { departmentId: null, unmapped: false, ambiguous: false };
    }
    const nameKey = normalizeName(String(name));
    const country = normCountry(ctx.country);
    const org = normOrg(ctx.organizationId);

    // 1. (country, org, name)
    if (country && org) {
      const r = pick(byCountryOrgName.get(`${country}|${org}|${nameKey}`), String(name));
      if (r.departmentId) return r;
    }
    // 2. (country, name)
    if (country) {
      const r = pick(byCountryName.get(`${country}|${nameKey}`), String(name));
      if (r.departmentId) return r;
    }
    // 3. (org, name)
    if (org) {
      const r = pick(byOrgName.get(`${org}|${nameKey}`), String(name));
      if (r.departmentId) return r;
    }
    // 4. (name) — last resort
    const r = pick(byName.get(nameKey), String(name));
    if (r.departmentId) return r;

    // No active match. If it matches a tombstoned name, still report unmapped
    // (so admins fix the HR record) but note it in the unmapped set.
    unmapped.add(String(name).trim());
    return { departmentId: null, unmapped: true, ambiguous: false };
  };

  return {
    resolve,
    unmappedNames: () => [...unmapped].sort(),
    ambiguousNames: () => [...ambiguous].sort(),
  };
}
