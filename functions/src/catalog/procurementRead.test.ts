import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { projectLines } from "./procurementLines";

import { mock } from "../../test/firebaseAdminMock";
let listPurchaseRequests: typeof import("./procurementRead").listPurchaseRequests;
let listCommitments: typeof import("./procurementRead").listCommitments;
beforeAll(async () => { ({ listPurchaseRequests, listCommitments } = await import("./procurementRead")); });

beforeEach(() => {
  mock.collection.mockReturnValue({ get: mock.get });
  mock.get.mockResolvedValue({ docs: [] });
});

describe("purchasing line evidence", () => {
  it("preserves fractional quantities, zero and explicit source IDs while excluding attachment URLs", () => {
    const result = projectLines([{ id: "wire-1", quantity: "12.50", uom: "M", description: "Airdac 2x25",
      notes: "two cores", attachments: [{ url: "private-token", uploadedBy: "private-user" }],
      fileLink: "private-file", unexpected: "secret" }, { id: "zero", quantity: 0, uom: "EA", description: "None" }]);
    expect(result.items[0]).toMatchObject({ id: "wire-1", sourceIndex: 0, quantity: 12.5, uom: "M", notes: "two cores", attachmentCount: 1, hasFileLink: true, issues: [] });
    expect(result.items[1].quantity).toBe(0);
    expect(JSON.stringify(result)).not.toMatch(/private|secret|uploadedBy/);
  });
  it.each([null, undefined, true, "", "LSL 25", "0x10", -1, NaN, Infinity, {}])("keeps invalid quantity %s unknown", quantity => {
    const row = projectLines([{ id: "x", description: "wire", uom: "M", quantity }]).items[0];
    expect(row.quantity).toBeNull();
    expect(row.issues).toContain("quantity_unknown_or_invalid");
  });
  it("distinguishes missing, empty and invalid arrays without hiding malformed lines", () => {
    expect(projectLines(undefined).status).toBe("missing");
    expect(projectLines([]).status).toBe("empty");
    expect(projectLines({}).status).toBe("invalid");
    const result = projectLines([null, { id: "same" }, { id: "same" }]);
    expect(result.items).toHaveLength(3);
    expect(result.items[0].issues).toContain("invalid_line");
    expect(result.items[0].id).toBeNull();
    expect(result.items[1].issues).toContain("line_id_duplicate");
  });
  it("lists request and recorded PO quantities separately; COMPLETED is not a receipt", async () => {
    mock.get.mockResolvedValue({ docs: [{ id: "pr-1", data: () => ({ prNumber: "PR-1", status: "COMPLETED",
      sites: ["mashai_smp"], organizationId: "smp", description: "wire", createdAt: "2026-01-01",
      lineItems: [{ id: "request-wire", description: "wire", quantity: 100, uom: "M" }],
      lineItemsWithSKU: [{ lineNumber: 1, itemNumber: "SKU-25", description: "wire", quantity: 80, uom: "M" }],
      completedAt: "2026-01-10", receiptQuantity: 999 }) }] });
    const result = await listPurchaseRequests({ organization: "smp", site: "mashai_smp" });
    expect(result.count).toBe(1);
    const row = result.items[0];
    expect(row.lineItems[0].quantity).toBe(100);
    expect(row.poLineItems[0]).toMatchObject({ id: null, lineNumber: 1, itemNumber: "SKU-25", quantity: 80 });
    expect(row.receiptEvidenceStatus).toBe("not_connected");
    expect(row.quantityBasis.lineItems).toBe("requested");
    expect(row.sourceCollection).toBe("purchaseRequests");
    expect(row).not.toHaveProperty("receiptQuantity");
    expect(mock.collection).toHaveBeenCalledWith("purchaseRequests");
    expect((await listCommitments({})).items).toEqual([]);
  });
  it("retains live pagination and total-count semantics", async () => {
    mock.get.mockResolvedValue({ docs: ["a", "b"].map(id => ({ id, data: () => ({ createdAt: "2026-01-01" }) })) });
    const first = await listPurchaseRequests({ limit: "1" });
    expect(first.count).toBe(2);
    expect(first.items[0].id).toBe("b");
    expect(first.items[0].lineItemsStatus).toBe("missing");
    const second = await listPurchaseRequests({ limit: "1", cursor: first.nextCursor });
    expect(second.items[0].id).toBe("a");
    expect(second.nextCursor).toBeNull();
  });
});
