/**
 * Supplier History Service
 *
 * Aggregates vendor/supplier transaction history from purchaseRequests collection.
 * Provides a read-only, user-facing view of historical transactions with metadata
 * and links to downloadable invoices. Separate from admin vendor CRUD.
 */

import { db } from "@/config/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
} from "firebase/firestore";

// ─── Types ───────────────────────────────────────────────────────────

export interface SupplierTransaction {
  prId: string;
  prNumber: string;
  status: string;
  organization: string;
  date: string;               // ISO string
  amount: number;
  currency: string;
  description: string;        // First line item description or PR description
  lineItemCount: number;
  quoteCount: number;
  attachments: SupplierAttachment[];
  vendorName: string;
  vendorId?: string;
}

export interface SupplierAttachment {
  name: string;
  url: string;
  type: string;               // MIME type
  size?: number;
  uploadedAt?: string;
  prNumber: string;
}

export interface SupplierSummary {
  vendorName: string;
  vendorId?: string;
  vendorCode?: string;
  transactionCount: number;
  totalValue: number;         // Sum in original currencies (approximate)
  currencies: string[];
  organizations: string[];
  statuses: Record<string, number>;
  firstTransaction: string;   // ISO date
  lastTransaction: string;    // ISO date
  partCategories: string[];   // Derived from line item descriptions
  transactions: SupplierTransaction[];
}

export interface SupplierIndex {
  totalSuppliers: number;
  totalTransactions: number;
  suppliers: SupplierSummary[];
  lastUpdated: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────

function timestampToISO(ts: any): string {
  if (!ts) return "";
  if (ts instanceof Timestamp) {
    return ts.toDate().toISOString();
  }
  if (typeof ts === "string") return ts;
  if (ts.seconds) {
    return new Date(ts.seconds * 1000).toISOString();
  }
  return "";
}

function extractVendorNames(pr: any): string[] {
  const names = new Set<string>();

  // From quotes
  if (pr.quotes && Array.isArray(pr.quotes)) {
    for (const q of pr.quotes) {
      if (q.vendorName) names.add(q.vendorName.trim());
    }
  }

  // From preferredVendor field
  if (pr.preferredVendor && typeof pr.preferredVendor === "string") {
    names.add(pr.preferredVendor.trim());
  }

  // From vendor field (some PRs have this)
  if (pr.vendor?.name) {
    names.add(pr.vendor.name.trim());
  }

  return Array.from(names).filter(n => n.length > 0);
}

function extractAttachments(pr: any, prNumber: string): SupplierAttachment[] {
  const attachments: SupplierAttachment[] = [];

  // PR-level attachments
  if (pr.attachments && Array.isArray(pr.attachments)) {
    for (const a of pr.attachments) {
      if (a.url) {
        attachments.push({
          name: a.name || "attachment",
          url: a.url,
          type: a.type || "application/octet-stream",
          size: a.size,
          uploadedAt: timestampToISO(a.uploadedAt),
          prNumber,
        });
      }
    }
  }

  // Quote-level attachments
  if (pr.quotes && Array.isArray(pr.quotes)) {
    for (const q of pr.quotes) {
      if (q.attachments && Array.isArray(q.attachments)) {
        for (const a of q.attachments) {
          if (a.url) {
            attachments.push({
              name: a.name || `quote_${q.vendorName || "unknown"}`,
              url: a.url,
              type: a.type || "application/pdf",
              size: a.size,
              uploadedAt: timestampToISO(a.uploadedAt),
              prNumber,
            });
          }
        }
      }
    }
  }

  // Line item attachments
  if (pr.lineItems && Array.isArray(pr.lineItems)) {
    for (const item of pr.lineItems) {
      if (item.attachments && Array.isArray(item.attachments)) {
        for (const a of item.attachments) {
          if (a.url) {
            attachments.push({
              name: a.name || "line_item_attachment",
              url: a.url,
              type: a.type || "application/octet-stream",
              size: a.size,
              uploadedAt: timestampToISO(a.uploadedAt),
              prNumber,
            });
          }
        }
      }
    }
  }

  return attachments;
}

// ─── Main Service ────────────────────────────────────────────────────

class SupplierHistoryService {
  // In-memory cache with 5-minute TTL
  private cache = new Map<string, { data: SupplierIndex; ts: number }>();
  private CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Build the full supplier transaction index from purchaseRequests.
   * Groups transactions by vendor name and returns sorted summaries.
   * Results are cached for 5 minutes per organization filter.
   */
  async getSupplierIndex(organizationFilter?: string): Promise<SupplierIndex> {
    const cacheKey = organizationFilter || "__all__";
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < this.CACHE_TTL) {
      return cached.data;
    }
    const prRef = collection(db, "purchaseRequests");

    // Fetch all PRs (optionally filtered by org)
    let q;
    if (organizationFilter) {
      q = query(prRef, where("organization", "==", organizationFilter));
    } else {
      q = query(prRef);
    }

    const snapshot = await getDocs(q);
    const vendorMap = new Map<string, SupplierSummary>();

    snapshot.forEach((doc) => {
      const pr = doc.data();
      const prId = doc.id;
      const prNumber = pr.prNumber || prId;
      const vendorNames = extractVendorNames(pr);
      const attachments = extractAttachments(pr, prNumber);

      // Build transaction record
      const date = timestampToISO(pr.createdAt || pr.submittedAt);
      const amount = pr.totalAmount || pr.estimatedAmount || 0;
      const currency = pr.currency || "USD";
      const status = pr.status || "UNKNOWN";
      const organization = pr.organization || "";

      // First line item description as summary
      const description =
        pr.lineItems?.[0]?.description ||
        pr.description ||
        pr.notes ||
        "";

      const lineItemCount = pr.lineItems?.length || 0;
      const quoteCount = pr.quotes?.length || 0;

      // If no vendor names found, use "Unspecified"
      const effectiveVendors = vendorNames.length > 0 ? vendorNames : ["Unspecified"];

      for (const vendorName of effectiveVendors) {
        const normalizedName = vendorName.toLowerCase().trim();

        if (!vendorMap.has(normalizedName)) {
          vendorMap.set(normalizedName, {
            vendorName: vendorName,
            transactionCount: 0,
            totalValue: 0,
            currencies: [],
            organizations: [],
            statuses: {},
            firstTransaction: date || "9999",
            lastTransaction: date || "0000",
            partCategories: [],
            transactions: [],
          });
        }

        const summary = vendorMap.get(normalizedName)!;
        summary.transactionCount += 1;
        summary.totalValue += typeof amount === "number" ? amount : 0;

        if (currency && !summary.currencies.includes(currency)) {
          summary.currencies.push(currency);
        }
        if (organization && !summary.organizations.includes(organization)) {
          summary.organizations.push(organization);
        }

        summary.statuses[status] = (summary.statuses[status] || 0) + 1;

        if (date && date < summary.firstTransaction) {
          summary.firstTransaction = date;
        }
        if (date && date > summary.lastTransaction) {
          summary.lastTransaction = date;
        }

        // Extract part categories from line items
        if (pr.lineItems && Array.isArray(pr.lineItems)) {
          for (const item of pr.lineItems) {
            const cat = item.category || item.projectCategory;
            if (cat && !summary.partCategories.includes(cat)) {
              summary.partCategories.push(cat);
            }
          }
        }

        summary.transactions.push({
          prId,
          prNumber,
          status,
          organization,
          date,
          amount,
          currency,
          description: description.substring(0, 200),
          lineItemCount,
          quoteCount,
          attachments,
          vendorName,
        });
      }
    });

    // Sort transactions within each vendor (newest first)
    const suppliers = Array.from(vendorMap.values())
      .map((s) => {
        s.transactions.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
        return s;
      })
      .sort((a, b) => b.transactionCount - a.transactionCount);

    const result: SupplierIndex = {
      totalSuppliers: suppliers.length,
      totalTransactions: suppliers.reduce((sum, s) => sum + s.transactionCount, 0),
      suppliers,
      lastUpdated: new Date().toISOString(),
    };

    // Store in cache
    this.cache.set(cacheKey, { data: result, ts: Date.now() });

    return result;
  }

  /**
   * Get transaction history for a specific vendor.
   */
  async getSupplierDetail(vendorName: string, organizationFilter?: string): Promise<SupplierSummary | null> {
    const index = await this.getSupplierIndex(organizationFilter);
    const normalized = vendorName.toLowerCase().trim();
    return (
      index.suppliers.find(
        (s) => s.vendorName.toLowerCase().trim() === normalized
      ) || null
    );
  }

  /**
   * Search suppliers by name (partial match).
   */
  async searchSuppliers(
    searchTerm: string,
    organizationFilter?: string
  ): Promise<SupplierSummary[]> {
    const index = await this.getSupplierIndex(organizationFilter);
    const term = searchTerm.toLowerCase().trim();
    if (!term) return index.suppliers;
    return index.suppliers.filter(
      (s) =>
        s.vendorName.toLowerCase().includes(term) ||
        s.organizations.some((o) => o.toLowerCase().includes(term))
    );
  }
}

export const supplierHistoryService = new SupplierHistoryService();
