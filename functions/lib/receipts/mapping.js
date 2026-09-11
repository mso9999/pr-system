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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.confirmAmUgpMapping = void 0;
const country_1 = require("./country");
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const crypto_1 = require("crypto");
const policy_1 = require("./policy");
const masMappingReview_json_1 = __importDefault(require("./masMappingReview.json"));
exports.confirmAmUgpMapping = functions.https.onCall(async (data, context) => {
    var _a;
    const token = (_a = context.auth) === null || _a === void 0 ? void 0 : _a.token, p = (0, policy_1.signedGrant)(token, "am");
    if (!context.auth ||
        (token === null || token === void 0 ? void 0 : token.nexus_sso) !== true ||
        !token.privilegeVersion ||
        !Array.isArray(p === null || p === void 0 ? void 0 : p.actions) ||
        !p.actions.some((a) => ["approve_assets", "administer_assets"].includes(a)))
        throw new functions.https.HttpsError("permission-denied", "AM approver access through Nexus is required");
    try {
        const assetId = (0, policy_1.id)(data.assetId), partId = (0, policy_1.id)(data.ugpPartId);
        const part = masMappingReview_json_1.default.parts[partId];
        if (!part ||
            part.category !== "candidate" ||
            !part.candidateIds.includes(assetId))
            throw new Error("This pair is not an eligible MAS candidate. Conflicting specifications and component-only matches need source-owner resolution first.");
        if (data.specificationVerified !== true ||
            data.canonicalPartVerified !== true ||
            typeof data.evidence !== "string" ||
            data.evidence.trim().length < 20 ||
            data.evidence.length > 2000)
            throw new Error("Confirm the current UGP specification and the AM item, and record the manufacturer/specification evidence");
        if (!Array.isArray(p.scopeOrganizations) ||
            !Array.isArray(p.scopeCountries))
            throw new Error("Refresh Nexus sign-in for scoped access");
        const db = admin.firestore(), assetRef = db.collection("am_core_assets").doc(assetId);
        return await db.runTransaction(async (tx) => {
            const assetSnap = await tx.get(assetRef), asset = assetSnap.data();
            if (!asset || !(0, policy_1.stockItem)(asset))
                throw new Error("Active stock item required");
            if (p.scopeOrganizations.length &&
                !p.scopeOrganizations.includes(asset.organization_id))
                throw new Error("Item organization is outside your scope");
            const country = await (0, country_1.amCountry)(tx, asset.country_id);
            const iso2 = (country === null || country === void 0 ? void 0 : country.iso2) || (country === null || country === void 0 ? void 0 : country.country_code_2) || (country === null || country === void 0 ? void 0 : country.code);
            if (p.scopeCountries.length && !p.scopeCountries.includes(iso2))
                throw new Error("Item country is outside your scope");
            const existing = asset.ugp_part_id || null;
            if (existing !== (data.expectedUgpPartId || null))
                throw new Error("Mapping changed while reviewing; reload first");
            if (existing && existing !== partId)
                throw new Error("Existing mappings cannot be overwritten by this pilot");
            if ((0, policy_1.unit)(asset.unit_of_measure) !== (0, policy_1.unit)(part.unit))
                throw new Error("Unit mismatch; do not assume a kit/package conversion");
            if (existing === partId)
                return { mapped: true, unchanged: true };
            const eventId = (0, crypto_1.randomUUID)(), now = new Date().toISOString();
            const verification = {
                eventId,
                by: context.auth.uid,
                at: now,
                evidence: data.evidence.trim(),
                referenceSnapshot: masMappingReview_json_1.default.snapshotId,
                referenceHash: (0, policy_1.hash)(masMappingReview_json_1.default),
                unit: (0, policy_1.unit)(part.unit),
                ugpPartId: partId,
            };
            tx.update(assetRef, {
                ugp_part_id: partId,
                ugp_mapping_verification: verification,
                updated_at: now,
            });
            tx.create(db.collection("am_core_mapping_reviews").doc(eventId), Object.assign({ assetId, before: existing, after: partId }, verification));
            return { mapped: true, unchanged: false, eventId };
        });
    }
    catch (error) {
        throw new functions.https.HttpsError("failed-precondition", error instanceof Error ? error.message : "Mapping review failed");
    }
});
//# sourceMappingURL=mapping.js.map