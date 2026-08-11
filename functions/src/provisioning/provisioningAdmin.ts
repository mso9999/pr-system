/**
 * Permission-gated CRUD backend for the Field Camp Provisioning catalog.
 *
 * Why callable functions (not client writes + Firestore rules): Nexus now owns the
 * canonical `firestore.rules` for `pr-system-4ea55`. Routing provisioning writes through
 * these functions lets PR enforce ADMIN/PROC access server-side via the Admin SDK
 * (which bypasses Firestore rules), keeping provisioning governance self-contained in
 * the PR repo and free of the Nexus rules deploy cycle.
 *
 * Collections (all org-scoped, `referenceData_*`):
 *   - rations               : issue items (catalog)
 *   - rationPrices          : dated price book
 *   - provisioningDefaults  : one planning-defaults doc per org
 *   - provisioningMenus     : N-day meal cycle per org
 *
 * Permission matrix mirrors `src/config/permissions.ts` REFERENCE_DATA_ACCESS:
 *   - rations / menus   : ADMIN(1), PROC(3)
 *   - rationPrices      : ADMIN(1), PROC(3), FIN_AD(4), FIN_APPROVER(6)
 *   - provisioningDefaults : ADMIN(1)
 *
 * The nutrition ("calories work out") check is performed live in the studio UI using
 * the shared pure-TS engine (`src/utils/provisioningEngine.ts`); these functions handle
 * only authoritative writes + reads.
 */
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { callerHasPrAction } from "../prClaimAuth";

const db = admin.firestore();
const PREFIX = "referenceData_";

type ProvisioningType = "rations" | "provisioningMenus" | "rationPrices" | "provisioningDefaults";

// Claim-only caller authorization (signed Nexus effectivePrivilege for PR).
// Mapping preserves the legacy numeric-level allowlists:
//   rations / menus:  levels 1,3   -> process_procurement_queue | administer_pr
//   rationPrices:     1,3,4,6      -> queue | manage_finance_reference_data | administer
//   defaults:         level 1      -> administer_pr
const ALLOWED_ACTIONS: Record<ProvisioningType, string[]> = {
  rations: ["process_procurement_queue", "administer_pr"],
  provisioningMenus: ["process_procurement_queue", "administer_pr"],
  rationPrices: ["process_procurement_queue", "manage_finance_reference_data", "administer_pr"],
  provisioningDefaults: ["administer_pr"],
};

function standardizeOrgId(id: string): string {
  return String(id || "").trim().toLowerCase().replace(/\s+/g, "_");
}

function requireAuth(context: any): admin.auth.DecodedIdToken {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Sign-in required.");
  }
  return context.auth as admin.auth.DecodedIdToken;
}

async function requireEdit(context: any, type: ProvisioningType): Promise<string> {
  const auth = requireAuth(context);
  const allowed = ALLOWED_ACTIONS[type] as Array<Parameters<typeof callerHasPrAction>[1]>;
  if (!callerHasPrAction(auth, ...allowed)) {
    throw new functions.https.HttpsError(
      "permission-denied",
      `Your signed PR privileges do not allow you to manage provisioning ${type}. ` +
      "Ask your HR team or the Nexus/IS&T administrator to correct the assignment, then sign out and relaunch PR from Nexus."
    );
  }
  return auth.uid;
}

async function getOrgMeta(orgId: string): Promise<{ id: string; name: string; currency?: string; countryCode?: string }> {
  const snap = await db.collection(`${PREFIX}organizations`).doc(orgId).get();
  const data = snap.data();
  return {
    id: orgId,
    name: (data?.name as string) || orgId,
    currency: data?.currency as string | undefined,
    countryCode: data?.countryCode as string | undefined,
  };
}

function stampOrg(payload: Record<string, any>, orgId: string, orgName: string): Record<string, any> {
  return { ...payload, organizationId: orgId, organization: { id: orgId, name: orgName } };
}

function assertOrgId(orgId: string): string {
  const id = standardizeOrgId(orgId);
  if (!id) throw new functions.https.HttpsError("invalid-argument", "organizationId is required.");
  return id;
}

// ── Rations ──────────────────────────────────────────────────────────────────────

interface RationPayload {
  id?: string;
  name: string;
  category: string;
  class: "Food" | "Provision" | "Fixed";
  issueQtyPerPersonDay: number;
  issueUnit: string;
  nutritionPerUnit: { kcal: number; proteinG: number; fruitVegG: number };
  specialFormula?: string | null;
  procurementNote?: string | null;
  packPlanning: any;
  active?: boolean;
}

function validateRation(r: Partial<RationPayload>): void {
  if (!r.name || typeof r.name !== "string") throw new functions.https.HttpsError("invalid-argument", "Ration name is required.");
  if (!r.category) throw new functions.https.HttpsError("invalid-argument", "Ration category is required.");
  if (!r.class || !["Food", "Provision", "Fixed"].includes(r.class)) throw new functions.https.HttpsError("invalid-argument", "Ration class must be Food, Provision or Fixed.");
  if (typeof r.issueQtyPerPersonDay !== "number") throw new functions.https.HttpsError("invalid-argument", "issueQtyPerPersonDay must be a number.");
  if (!r.issueUnit) throw new functions.https.HttpsError("invalid-argument", "issueUnit is required.");
  if (!r.nutritionPerUnit || typeof r.nutritionPerUnit.kcal !== "number") throw new functions.https.HttpsError("invalid-argument", "nutritionPerUnit.kcal is required.");
  if (!r.packPlanning || !["simple", "bulk"].includes(r.packPlanning.mode)) throw new functions.https.HttpsError("invalid-argument", "packPlanning.mode must be 'simple' or 'bulk'.");
}

function slugify(s: string): string {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
}

export const saveProvisioningRation = functions
  .runWith({ memory: "256MB", timeoutSeconds: 30 })
  .https.onCall(async (data: { organizationId?: string; ration?: Partial<RationPayload> }, context) => {
    await requireEdit(context, "rations");
    const orgId = assertOrgId(data?.organizationId || "");
    const r = data?.ration;
    if (!r) throw new functions.https.HttpsError("invalid-argument", "ration payload is required.");
    validateRation(r);
    const org = await getOrgMeta(orgId);
    const now = new Date().toISOString();
    const id = r.id || `ration_${slugify(r.name as string)}`;
    const payload = stampOrg(
      {
        id,
        name: r.name,
        category: r.category,
        class: r.class,
        issueQtyPerPersonDay: r.issueQtyPerPersonDay,
        issueUnit: r.issueUnit,
        nutritionPerUnit: {
          kcal: Number(r.nutritionPerUnit!.kcal) || 0,
          proteinG: Number(r.nutritionPerUnit!.proteinG) || 0,
          fruitVegG: Number(r.nutritionPerUnit!.fruitVegG) || 0,
        },
        specialFormula: r.specialFormula || null,
        procurementNote: r.procurementNote || null,
        packPlanning: r.packPlanning,
        active: r.active !== false,
        updatedAt: now,
      },
      orgId,
      org.name
    );
    const ref = db.doc(`${PREFIX}rations/${id}`);
    const snap = await ref.get();
    if (!snap.exists) payload.createdAt = now;
    await ref.set(payload, { merge: true });
    return { id, organization: org };
  });

export const retireProvisioningRation = functions
  .runWith({ memory: "256MB", timeoutSeconds: 30 })
  .https.onCall(async (data: { organizationId?: string; rationId?: string }, context) => {
    await requireEdit(context, "rations");
    const orgId = assertOrgId(data?.organizationId || "");
    const rationId = String(data?.rationId || "").trim();
    if (!rationId) throw new functions.https.HttpsError("invalid-argument", "rationId is required.");
    const now = new Date().toISOString();
    await db.doc(`${PREFIX}rations/${rationId}`).set({ active: false, updatedAt: now }, { merge: true });
    // Retire matching prices so they don't surface as orphan price-book rows.
    const pricesSnap = await db.collection(`${PREFIX}rationPrices`).where("organizationId", "==", orgId).where("rationItemId", "==", rationId).get();
    const batch = db.batch();
    pricesSnap.docs.forEach((d) => batch.set(d.ref, { active: false, updatedAt: now }, { merge: true }));
    await batch.commit();
    return { retiredRation: rationId, retiredPrices: pricesSnap.size };
  });

// ── Prices ───────────────────────────────────────────────────────────────────────

interface PricePayload {
  id?: string;
  rationItemId: string;
  tier: "large" | "medium" | "small" | null;
  packName?: string;
  currency: string;
  price: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
  supplierId?: string | null;
  source?: string | null;
  note?: string | null;
  active?: boolean;
}

function validatePrice(p: Partial<PricePayload>): void {
  if (!p.rationItemId) throw new functions.https.HttpsError("invalid-argument", "rationItemId is required.");
  if (p.tier !== null && !["large", "medium", "small"].includes(p.tier as string)) throw new functions.https.HttpsError("invalid-argument", "tier must be large, medium, small or null.");
  if (!p.currency) throw new functions.https.HttpsError("invalid-argument", "currency is required.");
  if (typeof p.price !== "number" || !Number.isFinite(p.price)) throw new functions.https.HttpsError("invalid-argument", "price must be a finite number.");
  if (!p.effectiveFrom) throw new functions.https.HttpsError("invalid-argument", "effectiveFrom is required (YYYY-MM-DD).");
}

export const saveProvisioningPrice = functions
  .runWith({ memory: "256MB", timeoutSeconds: 30 })
  .https.onCall(async (data: { organizationId?: string; price?: Partial<PricePayload> }, context) => {
    await requireEdit(context, "rationPrices");
    const orgId = assertOrgId(data?.organizationId || "");
    const p = data?.price;
    if (!p) throw new functions.https.HttpsError("invalid-argument", "price payload is required.");
    validatePrice(p);
    const org = await getOrgMeta(orgId);
    const now = new Date().toISOString();
    const tierKey = p.tier || "unit";
    const id = p.id || `price_${slugify(p.rationItemId)}_${tierKey}_${Date.now()}`;
    const payload = stampOrg(
      {
        id,
        rationItemId: p.rationItemId,
        tier: p.tier ?? null,
        packName: p.packName || null,
        currency: p.currency,
        price: p.price,
        effectiveFrom: p.effectiveFrom,
        effectiveTo: p.effectiveTo ?? null,
        supplierId: p.supplierId || null,
        source: p.source || null,
        note: p.note || null,
        active: p.active !== false,
        updatedAt: now,
      },
      orgId,
      org.name
    );
    const ref = db.doc(`${PREFIX}rationPrices/${id}`);
    const snap = await ref.get();
    if (!snap.exists) payload.createdAt = now;
    await ref.set(payload, { merge: true });
    return { id, organization: org };
  });

export const retireProvisioningPrice = functions
  .runWith({ memory: "256MB", timeoutSeconds: 30 })
  .https.onCall(async (data: { organizationId?: string; priceId?: string }, context) => {
    await requireEdit(context, "rationPrices");
    assertOrgId(data?.organizationId || "");
    const priceId = String(data?.priceId || "").trim();
    if (!priceId) throw new functions.https.HttpsError("invalid-argument", "priceId is required.");
    await db.doc(`${PREFIX}rationPrices/${priceId}`).set({ active: false, updatedAt: new Date().toISOString() }, { merge: true });
    return { retiredPrice: priceId };
  });

// ── Defaults (one doc per org) ───────────────────────────────────────────────────

interface DefaultsPayload {
  id?: string;
  name?: string;
  nutritionTargets: { kcal: number; proteinG: number; fruitVegG: number };
  defaultBuffer: number;
  breadCoverageDays: number;
  flourPerLoafKg: number;
  yeastProportion: number;
  personDaysPerToiletRoll: number;
  defaultCurrency: string;
  reportingCurrency?: string | null;
  active?: boolean;
}

function validateDefaults(d: Partial<DefaultsPayload>): void {
  if (!d.nutritionTargets || typeof d.nutritionTargets.kcal !== "number") throw new functions.https.HttpsError("invalid-argument", "nutritionTargets.kcal is required.");
  if (typeof d.defaultBuffer !== "number") throw new functions.https.HttpsError("invalid-argument", "defaultBuffer must be a number.");
  if (!d.defaultCurrency) throw new functions.https.HttpsError("invalid-argument", "defaultCurrency is required.");
}

export const saveProvisioningDefaults = functions
  .runWith({ memory: "256MB", timeoutSeconds: 30 })
  .https.onCall(async (data: { organizationId?: string; defaults?: Partial<DefaultsPayload> }, context) => {
    await requireEdit(context, "provisioningDefaults");
    const orgId = assertOrgId(data?.organizationId || "");
    const d = data?.defaults;
    if (!d) throw new functions.https.HttpsError("invalid-argument", "defaults payload is required.");
    validateDefaults(d);
    const org = await getOrgMeta(orgId);
    const now = new Date().toISOString();
    const id = `provisioning_defaults_${orgId}`;
    const payload = stampOrg(
      {
        id,
        name: d.name || "Default planning assumptions",
        nutritionTargets: {
          kcal: Number(d.nutritionTargets!.kcal) || 0,
          proteinG: Number(d.nutritionTargets!.proteinG) || 0,
          fruitVegG: Number(d.nutritionTargets!.fruitVegG) || 0,
        },
        defaultBuffer: Number(d.defaultBuffer) || 0,
        breadCoverageDays: Number(d.breadCoverageDays) || 0,
        flourPerLoafKg: Number(d.flourPerLoafKg) || 0,
        yeastProportion: Number(d.yeastProportion) || 0,
        personDaysPerToiletRoll: Number(d.personDaysPerToiletRoll) || 0,
        defaultCurrency: d.defaultCurrency,
        reportingCurrency: d.reportingCurrency || null,
        active: d.active !== false,
        updatedAt: now,
      },
      orgId,
      org.name
    );
    const ref = db.doc(`${PREFIX}provisioningDefaults/${id}`);
    const snap = await ref.get();
    if (!snap.exists) payload.createdAt = now;
    await ref.set(payload, { merge: true });
    return { id, organization: org };
  });

// ── Menu (one doc per org) ───────────────────────────────────────────────────────

interface MenuPayload {
  id?: string;
  name?: string;
  cycleLength: number;
  days: Array<{ day: number; breakfast: string; midday: string; evening: string }>;
  active?: boolean;
}

export const saveProvisioningMenu = functions
  .runWith({ memory: "256MB", timeoutSeconds: 30 })
  .https.onCall(async (data: { organizationId?: string; menu?: Partial<MenuPayload> }, context) => {
    await requireEdit(context, "provisioningMenus");
    const orgId = assertOrgId(data?.organizationId || "");
    const m = data?.menu;
    if (!m) throw new functions.https.HttpsError("invalid-argument", "menu payload is required.");
    if (typeof m.cycleLength !== "number" || m.cycleLength <= 0) throw new functions.https.HttpsError("invalid-argument", "cycleLength must be a positive number.");
    if (!Array.isArray(m.days)) throw new functions.https.HttpsError("invalid-argument", "days must be an array.");
    const org = await getOrgMeta(orgId);
    const now = new Date().toISOString();
    const id = `provisioning_menu_${orgId}`;
    const payload = stampOrg(
      {
        id,
        name: m.name || `${m.cycleLength}-Day Camp Menu Cycle`,
        cycleLength: m.cycleLength,
        days: m.days,
        active: m.active !== false,
        updatedAt: now,
      },
      orgId,
      org.name
    );
    const ref = db.doc(`${PREFIX}provisioningMenus/${id}`);
    const snap = await ref.get();
    if (!snap.exists) payload.createdAt = now;
    await ref.set(payload, { merge: true });
    return { id, organization: org };
  });

// ── Read: full catalog for an org (used by the studio) ───────────────────────────

export const listProvisioningCatalog = functions
  .runWith({ memory: "256MB", timeoutSeconds: 30 })
  .https.onCall(async (data: { organizationId?: string }, context) => {
    requireAuth(context);
    const orgId = assertOrgId(data?.organizationId || "");
    const org = await getOrgMeta(orgId);
    const [rSnap, pSnap, dSnap, mSnap] = await Promise.all([
      db.collection(`${PREFIX}rations`).where("organizationId", "==", orgId).get(),
      db.collection(`${PREFIX}rationPrices`).where("organizationId", "==", orgId).get(),
      db.collection(`${PREFIX}provisioningDefaults`).where("organizationId", "==", orgId).get(),
      db.collection(`${PREFIX}provisioningMenus`).where("organizationId", "==", orgId).get(),
    ]);
    const map = (s: FirebaseFirestore.QuerySnapshot) => s.docs.map((d) => ({ id: d.id, ...d.data() }));
    const defaultsDocs = map(dSnap) as any[];
    const menuDocs = map(mSnap) as any[];
    return {
      organization: org,
      rations: map(rSnap),
      prices: map(pSnap),
      defaults: defaultsDocs.find((x) => x.active !== false) || defaultsDocs[0] || null,
      menu: menuDocs.find((x) => x.active !== false) || menuDocs[0] || null,
    };
  });
