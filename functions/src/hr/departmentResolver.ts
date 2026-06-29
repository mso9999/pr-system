/**
 * Resolves HR department name strings (e.g. "O&M", "Engineering") to
 * PR `referenceData_departments` doc ids. HR returns a department NAME;
 * PR stores department as a doc ID. We cache all department docs once
 * per run and match case-insensitively, ignoring whitespace differences.
 *
 * Unmapped names are tracked so the reconciliation report can flag them
 * for an admin to add or rename a department in PR.
 */
import * as admin from "firebase-admin";

const db = admin.firestore();

export interface DepartmentResolver {
  resolve: (name: string | null | undefined) => { departmentId: string | null; unmapped: boolean };
  unmappedNames: () => string[];
}

function normalizeName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function buildDepartmentResolver(): Promise<DepartmentResolver> {
  const snap = await db.collection("referenceData_departments").get();
  const byName = new Map<string, string>();
  for (const d of snap.docs) {
    const data = d.data() as { name?: string; active?: boolean };
    if (!data.name) continue;
    byName.set(normalizeName(data.name), d.id);
  }

  const unmapped = new Set<string>();

  const resolve = (name: string | null | undefined) => {
    if (!name || !String(name).trim()) {
      return { departmentId: null, unmapped: false };
    }
    const key = normalizeName(String(name));
    const id = byName.get(key);
    if (id) return { departmentId: id, unmapped: false };
    unmapped.add(String(name).trim());
    return { departmentId: null, unmapped: true };
  };

  return {
    resolve,
    unmappedNames: () => [...unmapped].sort(),
  };
}
