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
exports.amCountry = amCountry;
const admin = __importStar(require("firebase-admin"));
/** AM legacy country_id is a field value, not necessarily the document ID. */
async function amCountry(tx, countryId) {
    if (typeof countryId !== 'string' || !countryId || countryId.includes('/'))
        throw new Error('AM country identity is missing');
    const countries = admin.firestore().collection('pr_master_countries');
    const [direct, byField] = await Promise.all([
        tx.get(countries.doc(countryId)),
        tx.get(countries.where('country_id', '==', countryId).limit(2)),
    ]);
    const matches = new Map(byField.docs.map(d => [d.id, d.data()]));
    if (direct.exists)
        matches.set(direct.id, direct.data());
    if (matches.size !== 1)
        throw new Error('AM country identity is missing or ambiguous; reconcile country references');
    return [...matches.values()][0];
}
//# sourceMappingURL=country.js.map