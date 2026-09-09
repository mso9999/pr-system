/** Opt-in historical evidence. Never feeds commitments, receipts or lead-time statistics. */
import * as admin from "firebase-admin";
import { planningText, projectLines } from "./procurementLines";

export class ArchiveQueryError extends Error {}

export function archivePageQuery(query: Record<string, unknown>): { limit: number; afterId: string | null } {
  for (const key of Object.keys(query)) {
    if (!["limit", "cursor"].includes(key)) throw new ArchiveQueryError(`Unsupported archive parameter: ${key}`);
  }
  const rawLimit = query.limit === undefined ? "100" : query.limit;
  if (typeof rawLimit !== "string" || !/^\d+$/.test(rawLimit)) throw new ArchiveQueryError("limit must be an integer from 1 to 500");
  const limit = Number(rawLimit);
  if (limit < 1 || limit > 500) throw new ArchiveQueryError("limit must be an integer from 1 to 500");
  let afterId: string | null = null;
  if (query.cursor !== undefined) {
    try {
      if (typeof query.cursor !== "string" || query.cursor.length > 4096 || !/^[A-Za-z0-9_-]+$/.test(query.cursor)) throw new Error();
      const decoded = JSON.parse(Buffer.from(query.cursor, "base64url").toString("utf8"));
      if (decoded.source !== "archivePRs" || typeof decoded.id !== "string" || !decoded.id || decoded.id.includes("/") || Buffer.byteLength(decoded.id) > 1500) throw new Error();
      afterId = decoded.id;
    } catch {
      throw new ArchiveQueryError("Invalid archive cursor");
    }
  }
  return { limit, afterId };
}

export function projectArchive(id: string, data: Record<string, unknown>) {
  const lines = projectLines(data.lineItems);
  return {
    id, sourceCollection: "archivePRs" as const,
    submittedDate: planningText(data.submittedDate),
    importedAt: planningText(data.importedAt),
    organization: planningText(data.organization),
    site: planningText(data.site),
    description: planningText(data.description),
    reason: planningText(data.reason),
    category: planningText(data.projectCategory),
    vendorName: planningText(data.vendorName) || planningText(data.vendor),
    vendorCode: planningText(data.vendorCode),
    status: planningText(data.status),
    lineItems: lines.items, lineItemsStatus: lines.status,
    quantityBasis: "legacy_record_only" as const,
    receiptEvidenceStatus: "not_connected" as const,
    attachmentCount: Array.isArray(data.attachments) ? data.attachments.length : 0,
  };
}

export async function listArchivedPurchaseRequests(query: Record<string, unknown>) {
  const { limit, afterId } = archivePageQuery(query);
  let ref = admin.firestore().collection("archivePRs").orderBy(admin.firestore.FieldPath.documentId());
  if (afterId) ref = ref.startAfter(afterId);
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
