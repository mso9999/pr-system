import { describe, it, expect } from "vitest";
import {
  eligible,
  hash,
  orderBasis,
  receiptChange,
  ReceiptLine,
  units,
  unit,
} from "./policy";
const order = {
  status: "ORDERED",
  lineItems: [{ id: "clamps", quantity: 100 }],
  organization: "smp",
  site: "mashai_smp",
};
const line: ReceiptLine = {
  lineId: "clamps",
  description: "Clamps",
  ordered: 100,
  unit: "each",
  assetId: "a",
  levelId: "stock",
  locationId: "LSO-MAS",
  ownerId: "smp",
  received: 0,
};
const settlement = (received = 0) => ({
  basisHash: hash(orderBasis(order)),
  revision: "v1",
  lines: [{ ...line, received }],
});
describe("prospective AM receipt closeout", () => {
  it("blocks 60 of 100 and permits the final 40", () => {
    expect(eligible(order, settlement(60)).eligible).toBe(false);
    const change = receiptChange({ ...line, received: 60 }, 40, 60, 10);
    expect(change).toEqual({ received: 100, onHand: 100, quantity: 40 });
    expect(eligible(order, settlement(change.received)).eligible).toBe(true);
  });
  it("refuses revised or non-ordered orders and receipt exceptions", () => {
    expect(
      eligible(
        { ...order, lineItems: [{ id: "clamps", quantity: 101 }] },
        settlement(100),
      ).eligible,
    ).toBe(false);
    expect(
      eligible({ ...order, status: "COMPLETED" }, settlement(100)).eligible,
    ).toBe(false);
    expect(
      eligible(order, { ...settlement(100), exception: "Receipt returned" })
        .eligible,
    ).toBe(false);
  });
  it("does not round fractions, accept overdelivery, negative stock or overallocated stock", () => {
    for (const v of [1.5, NaN, Infinity, -1, "100", true])
      expect(() => units(v)).toThrow();
    expect(() => receiptChange(line, 101, 0, 0)).toThrow(/Overdelivery/);
    expect(() => receiptChange(line, 1, 0, 2)).toThrow(/overallocated/);
  });
  it("normalizes exact unit aliases without assuming kit conversions", () => {
    expect(unit("PCS")).toBe(unit("piece"));
    expect(unit("M")).toBe(unit("meter"));
    expect(unit("kit")).not.toBe(unit("each"));
  });
  it("detects switching line source, owner, destination and pending amendments", () => {
    for (const patch of [
      { lineItemsWithSKU: [{}] },
      { organization: "neo1" },
      { site: "other" },
      { pendingAmendment: { status: "pending" } },
    ]) {
      expect(eligible({ ...order, ...patch }, settlement(100)).eligible).toBe(
        false,
      );
    }
  });
});
