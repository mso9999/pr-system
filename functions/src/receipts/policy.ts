import { createHash } from "crypto";

export type Row = Record<string, any>;
export const id = (value: unknown): string => {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,150}$/.test(value))
    throw new Error("Invalid document or line identifier");
  return value;
};
export function units(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > 1e9
  ) {
    throw new Error(
      "The initial receipt pilot requires whole units. Fractional quantities must not be rounded; AM decimal dispatch support is required first.",
    );
  }
  return value;
}
export function unit(value: unknown): string {
  if (typeof value !== "string") throw new Error("Unit is required");
  const normalized = value.trim().toLowerCase();
  const aliases: Row = {
    ea: "each",
    pcs: "each",
    piece: "each",
    pieces: "each",
    each: "each",
    m: "metre",
    meter: "metre",
    metre: "metre",
  };
  if (!normalized) throw new Error("Unit is required");
  return aliases[normalized] || normalized;
}
function canonical(value: any): any {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((k) => [k, canonical(value[k])]),
    );
  return value;
}
export const hash = (value: unknown) =>
  createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");
export function orderBasis(order: Row): Row {
  // Freeze both line representations: switching the selected source cannot evade amendment detection.
  return {
    lineItems: order.lineItems ?? null,
    poLines: order.lineItemsWithSKU ?? null,
    organization: order.organization ?? null,
    organizationId: order.organizationId ?? null,
    site: order.site ?? null,
    sites: order.sites ?? null,
    country: order.country ?? null,
    selectedVendor: order.selectedVendor ?? null,
    pendingAmendment: order.pendingAmendment ?? null,
  };
}
export interface ReceiptLine {
  lineId: string;
  description: string;
  ordered: number;
  unit: string;
  assetId: string;
  levelId: string;
  locationId: string;
  ownerId: string;
  received: number;
}
export interface ReceiptOrder {
  basisHash: string;
  revision: string;
  lines: ReceiptLine[];
  exception?: string | null;
}
export function eligible(
  order: Row,
  settlement: ReceiptOrder,
): { eligible: boolean; blockers: string[] } {
  const blockers: string[] = [];
  if (order.status !== "ORDERED") blockers.push("Order must be ORDERED");
  if (order.pendingAmendment)
    blockers.push("Resolve the pending order amendment");
  if (hash(orderBasis(order)) !== settlement.basisHash)
    blockers.push(
      "Order changed after receipt review; approved revision must be reconciled",
    );
  if (settlement.exception) blockers.push(settlement.exception);
  if (!settlement.lines.length) blockers.push("No approved receipt lines");
  for (const line of settlement.lines) {
    units(line.ordered);
    units(line.received);
    if (line.received !== line.ordered)
      blockers.push(
        `${line.description}: ${line.received} of ${line.ordered} ${line.unit} recorded in AM`,
      );
  }
  return { eligible: blockers.length === 0, blockers };
}
export function receiptChange(
  line: ReceiptLine,
  quantity: unknown,
  onHand: unknown,
  allocated: unknown,
) {
  const qty = units(quantity),
    stock = units(onHand),
    reserved = units(allocated);
  if (qty === 0) throw new Error("Accepted quantity must be greater than zero");
  if (reserved > stock)
    throw new Error("AM stock is overallocated; reconcile it before receiving");
  const received = units(line.received + qty);
  if (received > line.ordered)
    throw new Error("Overdelivery requires a reviewed order amendment");
  return { received, onHand: units(stock + qty), quantity: qty };
}

export function stockItem(asset: Row): boolean {
  return (
    ["Material", "Consumable", "Inventory"].includes(asset.item_class) &&
    asset.active !== false &&
    asset.active !== 0 &&
    !["disposed", "retired", "inactive", "lost", "decommissioned"].includes(
      String(asset.status || "").toLowerCase(),
    )
  );
}

export function signedGrant(
  token: Row | undefined,
  system: string,
): Row | null {
  if (!token || token.nexus_sso !== true || !token.privilegeVersion)
    return null;
  const grant =
    token.targetSystem === system
      ? token.effectivePrivilege
      : token.systems?.[system];
  return grant && Array.isArray(grant.actions) ? grant : null;
}
