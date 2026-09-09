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
exports.ArchiveQueryError = void 0;
exports.archivePageQuery = archivePageQuery;
exports.projectArchive = projectArchive;
exports.listArchivedPurchaseRequests = listArchivedPurchaseRequests;
/** Opt-in historical evidence. Never feeds commitments, receipts or lead-time statistics. */
const admin = __importStar(require("firebase-admin"));
const procurementLines_1 = require("./procurementLines");
class ArchiveQueryError extends Error {
}
exports.ArchiveQueryError = ArchiveQueryError;
function archivePageQuery(query) {
    for (const key of Object.keys(query)) {
        if (!["limit", "cursor"].includes(key))
            throw new ArchiveQueryError(`Unsupported archive parameter: ${key}`);
    }
    const rawLimit = query.limit === undefined ? "100" : query.limit;
    if (typeof rawLimit !== "string" || !/^\d+$/.test(rawLimit))
        throw new ArchiveQueryError("limit must be an integer from 1 to 500");
    const limit = Number(rawLimit);
    if (limit < 1 || limit > 500)
        throw new ArchiveQueryError("limit must be an integer from 1 to 500");
    let afterId = null;
    if (query.cursor !== undefined) {
        try {
            if (typeof query.cursor !== "string" || query.cursor.length > 4096 || !/^[A-Za-z0-9_-]+$/.test(query.cursor))
                throw new Error();
            const decoded = JSON.parse(Buffer.from(query.cursor, "base64url").toString("utf8"));
            if (decoded.source !== "archivePRs" || typeof decoded.id !== "string" || !decoded.id || decoded.id.includes("/") || Buffer.byteLength(decoded.id) > 1500)
                throw new Error();
            afterId = decoded.id;
        }
        catch (_a) {
            throw new ArchiveQueryError("Invalid archive cursor");
        }
    }
    return { limit, afterId };
}
function projectArchive(id, data) {
    const lines = (0, procurementLines_1.projectLines)(data.lineItems);
    return {
        id, sourceCollection: "archivePRs",
        submittedDate: (0, procurementLines_1.planningText)(data.submittedDate),
        importedAt: (0, procurementLines_1.planningText)(data.importedAt),
        organization: (0, procurementLines_1.planningText)(data.organization),
        site: (0, procurementLines_1.planningText)(data.site),
        description: (0, procurementLines_1.planningText)(data.description),
        reason: (0, procurementLines_1.planningText)(data.reason),
        category: (0, procurementLines_1.planningText)(data.projectCategory),
        vendorName: (0, procurementLines_1.planningText)(data.vendorName) || (0, procurementLines_1.planningText)(data.vendor),
        vendorCode: (0, procurementLines_1.planningText)(data.vendorCode),
        status: (0, procurementLines_1.planningText)(data.status),
        lineItems: lines.items, lineItemsStatus: lines.status,
        quantityBasis: "legacy_record_only",
        receiptEvidenceStatus: "not_connected",
        attachmentCount: Array.isArray(data.attachments) ? data.attachments.length : 0,
    };
}
async function listArchivedPurchaseRequests(query) {
    const { limit, afterId } = archivePageQuery(query);
    let ref = admin.firestore().collection("archivePRs").orderBy(admin.firestore.FieldPath.documentId());
    if (afterId)
        ref = ref.startAfter(afterId);
    const page = await ref.limit(limit + 1).get();
    const docs = page.docs.slice(0, limit);
    return {
        count: docs.length, // Page count, not total collection count. Bounded database read.
        items: docs.map(doc => projectArchive(doc.id, doc.data())),
        nextCursor: page.docs.length > limit
            ? Buffer.from(JSON.stringify({ source: "archivePRs", id: docs[docs.length - 1].id })).toString("base64url")
            : null,
    };
}
//# sourceMappingURL=archiveRead.js.map