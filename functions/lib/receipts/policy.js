"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hash = exports.id = void 0;
exports.units = units;
exports.unit = unit;
exports.orderBasis = orderBasis;
exports.eligible = eligible;
exports.receiptChange = receiptChange;
exports.stockItem = stockItem;
exports.signedGrant = signedGrant;
const crypto_1 = require("crypto");
const id = (value) => {
    if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,150}$/.test(value))
        throw new Error("Invalid document or line identifier");
    return value;
};
exports.id = id;
function units(value) {
    if (typeof value !== "number" ||
        !Number.isSafeInteger(value) ||
        value < 0 ||
        value > 1e9) {
        throw new Error("The initial receipt pilot requires whole units. Fractional quantities must not be rounded; AM decimal dispatch support is required first.");
    }
    return value;
}
function unit(value) {
    if (typeof value !== "string")
        throw new Error("Unit is required");
    const normalized = value.trim().toLowerCase();
    const aliases = {
        ea: "each",
        pcs: "each",
        piece: "each",
        pieces: "each",
        each: "each",
        m: "metre",
        meter: "metre",
        metre: "metre",
    };
    if (!normalized)
        throw new Error("Unit is required");
    return aliases[normalized] || normalized;
}
function canonical(value) {
    if (Array.isArray(value))
        return value.map(canonical);
    if (value && typeof value === "object")
        return Object.fromEntries(Object.keys(value)
            .sort()
            .map((k) => [k, canonical(value[k])]));
    return value;
}
const hash = (value) => (0, crypto_1.createHash)("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");
exports.hash = hash;
function orderBasis(order) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    // Freeze both line representations: switching the selected source cannot evade amendment detection.
    return {
        lineItems: (_a = order.lineItems) !== null && _a !== void 0 ? _a : null,
        poLines: (_b = order.lineItemsWithSKU) !== null && _b !== void 0 ? _b : null,
        organization: (_c = order.organization) !== null && _c !== void 0 ? _c : null,
        organizationId: (_d = order.organizationId) !== null && _d !== void 0 ? _d : null,
        site: (_e = order.site) !== null && _e !== void 0 ? _e : null,
        sites: (_f = order.sites) !== null && _f !== void 0 ? _f : null,
        country: (_g = order.country) !== null && _g !== void 0 ? _g : null,
        selectedVendor: (_h = order.selectedVendor) !== null && _h !== void 0 ? _h : null,
        pendingAmendment: (_j = order.pendingAmendment) !== null && _j !== void 0 ? _j : null,
    };
}
function eligible(order, settlement) {
    const blockers = [];
    if (order.status !== "ORDERED")
        blockers.push("Order must be ORDERED");
    if (order.pendingAmendment)
        blockers.push("Resolve the pending order amendment");
    if ((0, exports.hash)(orderBasis(order)) !== settlement.basisHash)
        blockers.push("Order changed after receipt review; approved revision must be reconciled");
    if (settlement.exception)
        blockers.push(settlement.exception);
    if (!settlement.lines.length)
        blockers.push("No approved receipt lines");
    for (const line of settlement.lines) {
        units(line.ordered);
        units(line.received);
        if (line.received !== line.ordered)
            blockers.push(`${line.description}: ${line.received} of ${line.ordered} ${line.unit} recorded in AM`);
    }
    return { eligible: blockers.length === 0, blockers };
}
function receiptChange(line, quantity, onHand, allocated) {
    const qty = units(quantity), stock = units(onHand), reserved = units(allocated);
    if (qty === 0)
        throw new Error("Accepted quantity must be greater than zero");
    if (reserved > stock)
        throw new Error("AM stock is overallocated; reconcile it before receiving");
    const received = units(line.received + qty);
    if (received > line.ordered)
        throw new Error("Overdelivery requires a reviewed order amendment");
    return { received, onHand: units(stock + qty), quantity: qty };
}
function stockItem(asset) {
    return (["Material", "Consumable", "Inventory"].includes(asset.item_class) &&
        asset.active !== false &&
        asset.active !== 0 &&
        !["disposed", "retired", "inactive", "lost", "decommissioned"].includes(String(asset.status || "").toLowerCase()));
}
function signedGrant(token, system) {
    var _a;
    if (!token || token.nexus_sso !== true || !token.privilegeVersion)
        return null;
    const grant = token.targetSystem === system
        ? token.effectivePrivilege
        : (_a = token.systems) === null || _a === void 0 ? void 0 : _a[system];
    return grant && Array.isArray(grant.actions) ? grant : null;
}
//# sourceMappingURL=policy.js.map