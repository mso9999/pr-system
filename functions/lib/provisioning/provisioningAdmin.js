"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.listProvisioningCatalog = exports.saveProvisioningMenu = exports.saveProvisioningDefaults = exports.retireProvisioningPrice = exports.saveProvisioningPrice = exports.retireProvisioningRation = exports.saveProvisioningRation = void 0;
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
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const db = admin.firestore();
const PREFIX = "referenceData_";
const LEVEL = { ADMIN: 1, PROC: 3, FIN_AD: 4, FIN_APPROVER: 6 };
const ALLOWED_LEVELS = {
    rations: [LEVEL.ADMIN, LEVEL.PROC],
    provisioningMenus: [LEVEL.ADMIN, LEVEL.PROC],
    rationPrices: [LEVEL.ADMIN, LEVEL.PROC, LEVEL.FIN_AD, LEVEL.FIN_APPROVER],
    provisioningDefaults: [LEVEL.ADMIN],
};
function standardizeOrgId(id) {
    return String(id || "").trim().toLowerCase().replace(/\s+/g, "_");
}
function requireAuth(context) {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Sign-in required.");
    }
    return context.auth;
}
async function getCallerPermissionLevel(uid) {
    var _a;
    const snap = await db.collection("users").doc(uid).get();
    const lvl = (_a = snap.data()) === null || _a === void 0 ? void 0 : _a.permissionLevel;
    const n = typeof lvl === "number" ? lvl : typeof lvl === "string" ? Number(lvl) : NaN;
    return Number.isFinite(n) ? n : 99;
}
async function requireEdit(context, type) {
    const auth = requireAuth(context);
    const level = await getCallerPermissionLevel(auth.uid);
    if (!ALLOWED_LEVELS[type].includes(level)) {
        throw new functions.https.HttpsError("permission-denied", `Your permission level (${level}) is not authorised to manage provisioning ${type}.`);
    }
    return auth.uid;
}
async function getOrgMeta(orgId) {
    const snap = await db.collection(`${PREFIX}organizations`).doc(orgId).get();
    const data = snap.data();
    return {
        id: orgId,
        name: (data === null || data === void 0 ? void 0 : data.name) || orgId,
        currency: data === null || data === void 0 ? void 0 : data.currency,
        countryCode: data === null || data === void 0 ? void 0 : data.countryCode,
    };
}
function stampOrg(payload, orgId, orgName) {
    return Object.assign(Object.assign({}, payload), { organizationId: orgId, organization: { id: orgId, name: orgName } });
}
function assertOrgId(orgId) {
    const id = standardizeOrgId(orgId);
    if (!id)
        throw new functions.https.HttpsError("invalid-argument", "organizationId is required.");
    return id;
}
function validateRation(r) {
    if (!r.name || typeof r.name !== "string")
        throw new functions.https.HttpsError("invalid-argument", "Ration name is required.");
    if (!r.category)
        throw new functions.https.HttpsError("invalid-argument", "Ration category is required.");
    if (!r.class || !["Food", "Provision", "Fixed"].includes(r.class))
        throw new functions.https.HttpsError("invalid-argument", "Ration class must be Food, Provision or Fixed.");
    if (typeof r.issueQtyPerPersonDay !== "number")
        throw new functions.https.HttpsError("invalid-argument", "issueQtyPerPersonDay must be a number.");
    if (!r.issueUnit)
        throw new functions.https.HttpsError("invalid-argument", "issueUnit is required.");
    if (!r.nutritionPerUnit || typeof r.nutritionPerUnit.kcal !== "number")
        throw new functions.https.HttpsError("invalid-argument", "nutritionPerUnit.kcal is required.");
    if (!r.packPlanning || !["simple", "bulk"].includes(r.packPlanning.mode))
        throw new functions.https.HttpsError("invalid-argument", "packPlanning.mode must be 'simple' or 'bulk'.");
}
function slugify(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
}
exports.saveProvisioningRation = functions
    .runWith({ memory: "256MB", timeoutSeconds: 30 })
    .https.onCall(async (data, context) => {
    await requireEdit(context, "rations");
    const orgId = assertOrgId((data === null || data === void 0 ? void 0 : data.organizationId) || "");
    const r = data === null || data === void 0 ? void 0 : data.ration;
    if (!r)
        throw new functions.https.HttpsError("invalid-argument", "ration payload is required.");
    validateRation(r);
    const org = await getOrgMeta(orgId);
    const now = new Date().toISOString();
    const id = r.id || `ration_${slugify(r.name)}`;
    const payload = stampOrg({
        id,
        name: r.name,
        category: r.category,
        class: r.class,
        issueQtyPerPersonDay: r.issueQtyPerPersonDay,
        issueUnit: r.issueUnit,
        nutritionPerUnit: {
            kcal: Number(r.nutritionPerUnit.kcal) || 0,
            proteinG: Number(r.nutritionPerUnit.proteinG) || 0,
            fruitVegG: Number(r.nutritionPerUnit.fruitVegG) || 0,
        },
        specialFormula: r.specialFormula || null,
        procurementNote: r.procurementNote || null,
        packPlanning: r.packPlanning,
        active: r.active !== false,
        updatedAt: now,
    }, orgId, org.name);
    const ref = db.doc(`${PREFIX}rations/${id}`);
    const snap = await ref.get();
    if (!snap.exists)
        payload.createdAt = now;
    await ref.set(payload, { merge: true });
    return { id, organization: org };
});
exports.retireProvisioningRation = functions
    .runWith({ memory: "256MB", timeoutSeconds: 30 })
    .https.onCall(async (data, context) => {
    await requireEdit(context, "rations");
    const orgId = assertOrgId((data === null || data === void 0 ? void 0 : data.organizationId) || "");
    const rationId = String((data === null || data === void 0 ? void 0 : data.rationId) || "").trim();
    if (!rationId)
        throw new functions.https.HttpsError("invalid-argument", "rationId is required.");
    const now = new Date().toISOString();
    await db.doc(`${PREFIX}rations/${rationId}`).set({ active: false, updatedAt: now }, { merge: true });
    // Retire matching prices so they don't surface as orphan price-book rows.
    const pricesSnap = await db.collection(`${PREFIX}rationPrices`).where("organizationId", "==", orgId).where("rationItemId", "==", rationId).get();
    const batch = db.batch();
    pricesSnap.docs.forEach((d) => batch.set(d.ref, { active: false, updatedAt: now }, { merge: true }));
    await batch.commit();
    return { retiredRation: rationId, retiredPrices: pricesSnap.size };
});
function validatePrice(p) {
    if (!p.rationItemId)
        throw new functions.https.HttpsError("invalid-argument", "rationItemId is required.");
    if (p.tier !== null && !["large", "medium", "small"].includes(p.tier))
        throw new functions.https.HttpsError("invalid-argument", "tier must be large, medium, small or null.");
    if (!p.currency)
        throw new functions.https.HttpsError("invalid-argument", "currency is required.");
    if (typeof p.price !== "number" || !Number.isFinite(p.price))
        throw new functions.https.HttpsError("invalid-argument", "price must be a finite number.");
    if (!p.effectiveFrom)
        throw new functions.https.HttpsError("invalid-argument", "effectiveFrom is required (YYYY-MM-DD).");
}
exports.saveProvisioningPrice = functions
    .runWith({ memory: "256MB", timeoutSeconds: 30 })
    .https.onCall(async (data, context) => {
    var _a, _b;
    await requireEdit(context, "rationPrices");
    const orgId = assertOrgId((data === null || data === void 0 ? void 0 : data.organizationId) || "");
    const p = data === null || data === void 0 ? void 0 : data.price;
    if (!p)
        throw new functions.https.HttpsError("invalid-argument", "price payload is required.");
    validatePrice(p);
    const org = await getOrgMeta(orgId);
    const now = new Date().toISOString();
    const tierKey = p.tier || "unit";
    const id = p.id || `price_${slugify(p.rationItemId)}_${tierKey}_${Date.now()}`;
    const payload = stampOrg({
        id,
        rationItemId: p.rationItemId,
        tier: (_a = p.tier) !== null && _a !== void 0 ? _a : null,
        packName: p.packName || null,
        currency: p.currency,
        price: p.price,
        effectiveFrom: p.effectiveFrom,
        effectiveTo: (_b = p.effectiveTo) !== null && _b !== void 0 ? _b : null,
        supplierId: p.supplierId || null,
        source: p.source || null,
        note: p.note || null,
        active: p.active !== false,
        updatedAt: now,
    }, orgId, org.name);
    const ref = db.doc(`${PREFIX}rationPrices/${id}`);
    const snap = await ref.get();
    if (!snap.exists)
        payload.createdAt = now;
    await ref.set(payload, { merge: true });
    return { id, organization: org };
});
exports.retireProvisioningPrice = functions
    .runWith({ memory: "256MB", timeoutSeconds: 30 })
    .https.onCall(async (data, context) => {
    await requireEdit(context, "rationPrices");
    assertOrgId((data === null || data === void 0 ? void 0 : data.organizationId) || "");
    const priceId = String((data === null || data === void 0 ? void 0 : data.priceId) || "").trim();
    if (!priceId)
        throw new functions.https.HttpsError("invalid-argument", "priceId is required.");
    await db.doc(`${PREFIX}rationPrices/${priceId}`).set({ active: false, updatedAt: new Date().toISOString() }, { merge: true });
    return { retiredPrice: priceId };
});
function validateDefaults(d) {
    if (!d.nutritionTargets || typeof d.nutritionTargets.kcal !== "number")
        throw new functions.https.HttpsError("invalid-argument", "nutritionTargets.kcal is required.");
    if (typeof d.defaultBuffer !== "number")
        throw new functions.https.HttpsError("invalid-argument", "defaultBuffer must be a number.");
    if (!d.defaultCurrency)
        throw new functions.https.HttpsError("invalid-argument", "defaultCurrency is required.");
}
exports.saveProvisioningDefaults = functions
    .runWith({ memory: "256MB", timeoutSeconds: 30 })
    .https.onCall(async (data, context) => {
    await requireEdit(context, "provisioningDefaults");
    const orgId = assertOrgId((data === null || data === void 0 ? void 0 : data.organizationId) || "");
    const d = data === null || data === void 0 ? void 0 : data.defaults;
    if (!d)
        throw new functions.https.HttpsError("invalid-argument", "defaults payload is required.");
    validateDefaults(d);
    const org = await getOrgMeta(orgId);
    const now = new Date().toISOString();
    const id = `provisioning_defaults_${orgId}`;
    const payload = stampOrg({
        id,
        name: d.name || "Default planning assumptions",
        nutritionTargets: {
            kcal: Number(d.nutritionTargets.kcal) || 0,
            proteinG: Number(d.nutritionTargets.proteinG) || 0,
            fruitVegG: Number(d.nutritionTargets.fruitVegG) || 0,
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
    }, orgId, org.name);
    const ref = db.doc(`${PREFIX}provisioningDefaults/${id}`);
    const snap = await ref.get();
    if (!snap.exists)
        payload.createdAt = now;
    await ref.set(payload, { merge: true });
    return { id, organization: org };
});
exports.saveProvisioningMenu = functions
    .runWith({ memory: "256MB", timeoutSeconds: 30 })
    .https.onCall(async (data, context) => {
    await requireEdit(context, "provisioningMenus");
    const orgId = assertOrgId((data === null || data === void 0 ? void 0 : data.organizationId) || "");
    const m = data === null || data === void 0 ? void 0 : data.menu;
    if (!m)
        throw new functions.https.HttpsError("invalid-argument", "menu payload is required.");
    if (typeof m.cycleLength !== "number" || m.cycleLength <= 0)
        throw new functions.https.HttpsError("invalid-argument", "cycleLength must be a positive number.");
    if (!Array.isArray(m.days))
        throw new functions.https.HttpsError("invalid-argument", "days must be an array.");
    const org = await getOrgMeta(orgId);
    const now = new Date().toISOString();
    const id = `provisioning_menu_${orgId}`;
    const payload = stampOrg({
        id,
        name: m.name || `${m.cycleLength}-Day Camp Menu Cycle`,
        cycleLength: m.cycleLength,
        days: m.days,
        active: m.active !== false,
        updatedAt: now,
    }, orgId, org.name);
    const ref = db.doc(`${PREFIX}provisioningMenus/${id}`);
    const snap = await ref.get();
    if (!snap.exists)
        payload.createdAt = now;
    await ref.set(payload, { merge: true });
    return { id, organization: org };
});
// ── Read: full catalog for an org (used by the studio) ───────────────────────────
exports.listProvisioningCatalog = functions
    .runWith({ memory: "256MB", timeoutSeconds: 30 })
    .https.onCall(async (data, context) => {
    requireAuth(context);
    const orgId = assertOrgId((data === null || data === void 0 ? void 0 : data.organizationId) || "");
    const org = await getOrgMeta(orgId);
    const [rSnap, pSnap, dSnap, mSnap] = await Promise.all([
        db.collection(`${PREFIX}rations`).where("organizationId", "==", orgId).get(),
        db.collection(`${PREFIX}rationPrices`).where("organizationId", "==", orgId).get(),
        db.collection(`${PREFIX}provisioningDefaults`).where("organizationId", "==", orgId).get(),
        db.collection(`${PREFIX}provisioningMenus`).where("organizationId", "==", orgId).get(),
    ]);
    const map = (s) => s.docs.map((d) => (Object.assign({ id: d.id }, d.data())));
    const defaultsDocs = map(dSnap);
    const menuDocs = map(mSnap);
    return {
        organization: org,
        rations: map(rSnap),
        prices: map(pSnap),
        defaults: defaultsDocs.find((x) => x.active !== false) || defaultsDocs[0] || null,
        menu: menuDocs.find((x) => x.active !== false) || menuDocs[0] || null,
    };
});
//# sourceMappingURL=provisioningAdmin.js.map