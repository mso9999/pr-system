/**
 * Country-context resolver for Field Camp Provisioning.
 *
 * Given an organization id, resolves the full country/currency/menu/price context the
 * provisioning planner needs:
 *   - countryCode + baseCurrency from `referenceData_organizations`
 *   - provisioningDefaults doc for that org
 *   - provisioningMenus doc for that org (the N-day meal cycle)
 *   - rations catalog for that org
 *   - rationPrices entries for that org (filtered to the org's base currency)
 *
 * All collections are org-scoped (`referenceData_<type>` with `organizationId`), so the
 * country dimension is implicit in which org is selected. This keeps the data model
 * simple: one org = one country = one ration catalog + one menu + one defaults doc + one
 * price book.
 */
import { db } from '@/config/firebase';
import { collection, query, where, getDocs, doc, getDoc, DocumentData } from 'firebase/firestore';
import { normalizeOrganizationId } from '@/utils/organization';
import type {
  RationItem,
  ProvisioningMenu,
  ProvisioningDefaults,
  RationPriceEntry,
} from '@/types/provisioning';

const PREFIX = 'referenceData_';

export interface ProvisioningCountryContext {
  organizationId: string;
  organizationName: string;
  countryCode: string;
  baseCurrency: string;
  reportingCurrency?: string;
  defaults?: ProvisioningDefaults;
  menu?: ProvisioningMenu;
  rations: RationItem[];
  /** Price-book entries already filtered to the org's base currency. */
  prices: RationPriceEntry[];
}

function mapDoc<T>(d: DocumentData): T {
  return { id: d.id, ...d.data() } as T;
}

async function getOrgDoc(orgId: string): Promise<DocumentData | null> {
  const ref = doc(db, `${PREFIX}organizations`, orgId);
  const snap = await getDoc(ref);
  return snap.exists() ? snap : null;
}

/**
 * Resolve the provisioning context for an organization. Returns `null` when the org
 * cannot be found. Missing defaults/menu are non-fatal — the planner falls back to
 * spreadsheet-derived defaults and an empty menu.
 */
export async function resolveProvisioningContext(
  organization: string | { id?: string; code?: string; name?: string },
): Promise<ProvisioningCountryContext | null> {
  const organizationId = normalizeOrganizationId(organization);
  if (!organizationId) return null;

  const orgSnap = await getOrgDoc(organizationId);
  if (!orgSnap) return null;
  const org = mapDoc<{ name?: string; countryCode?: string; currency?: string }>(orgSnap);

  const countryCode = org.countryCode || '';
  const baseCurrency = org.currency || '';

  // Defaults + menu are org-scoped; expect at most one active doc each. Fetch all and
  // pick the first active.
  const [defaultsSnap, menuSnap, rationsSnap, pricesSnap] = await Promise.all([
    getDocs(query(collection(db, `${PREFIX}provisioningDefaults`), where('organizationId', '==', organizationId))),
    getDocs(query(collection(db, `${PREFIX}provisioningMenus`), where('organizationId', '==', organizationId))),
    getDocs(query(collection(db, `${PREFIX}rations`), where('organizationId', '==', organizationId))),
    getDocs(query(collection(db, `${PREFIX}rationPrices`), where('organizationId', '==', organizationId))),
  ]);

  const defaultsDocs = defaultsSnap.docs.map(mapDoc<ProvisioningDefaults>);
  const menuDocs = menuSnap.docs.map(mapDoc<ProvisioningMenu>);
  const rations = rationsSnap.docs.map(mapDoc<RationItem>);
  const allPrices = pricesSnap.docs.map(mapDoc<RationPriceEntry>);

  const defaults = defaultsDocs.find((d) => d.active !== false) || defaultsDocs[0];
  const menu = menuDocs.find((m) => m.active !== false) || menuDocs[0];

  const prices = baseCurrency
    ? allPrices.filter((p) => p.currency === baseCurrency)
    : allPrices;

  return {
    organizationId,
    organizationName: org.name || organizationId,
    countryCode,
    baseCurrency,
    reportingCurrency: defaults?.reportingCurrency,
    defaults,
    menu,
    rations,
    prices,
  };
}

/** Spreadsheet-derived fallback defaults used when no `provisioningDefaults` doc exists. */
export const SPREADSHEET_DEFAULTS = {
  nutritionTargets: { kcal: 3000, proteinG: 80, fruitVegG: 400 },
  defaultBuffer: 0.05,
  breadCoverageDays: 7,
  flourPerLoafKg: 0.7,
  yeastProportion: 0.015,
  personDaysPerToiletRoll: 40,
};
