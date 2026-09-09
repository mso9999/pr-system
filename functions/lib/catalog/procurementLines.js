"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.planningText = planningText;
exports.projectLines = projectLines;
function planningText(value) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}
function quantity(value) {
    // Accept decimal numeric legacy strings, never booleans, blank, hex or monetary text.
    if (typeof value === "string") {
        if (!/^[+]?\d+(?:\.\d+)?$/.test(value.trim()))
            return null;
        value = Number(value);
    }
    return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}
function projectLines(value) {
    if (value == null)
        return { items: [], status: "missing" };
    if (!Array.isArray(value))
        return { items: [], status: "invalid" };
    const ids = new Map();
    for (const row of value) {
        const id = row && typeof row === "object" && !Array.isArray(row) ? planningText(row.id) : null;
        if (id)
            ids.set(id, (ids.get(id) || 0) + 1);
    }
    return {
        status: value.length ? "available" : "empty",
        items: value.map((raw, sourceIndex) => {
            const validRow = raw != null && typeof raw === "object" && !Array.isArray(raw);
            const row = validRow ? raw : {};
            const id = planningText(row.id);
            const qty = quantity(row.quantity);
            const uom = planningText(row.uom);
            const description = planningText(row.description);
            const issues = [];
            if (!validRow)
                issues.push("invalid_line");
            if (!id)
                issues.push("line_id_missing");
            else if (ids.get(id) > 1)
                issues.push("line_id_duplicate");
            if (qty === null)
                issues.push("quantity_unknown_or_invalid");
            if (!uom)
                issues.push("uom_missing");
            if (!description)
                issues.push("description_missing");
            return {
                id, sourceIndex,
                lineNumber: Number.isSafeInteger(row.lineNumber) && row.lineNumber >= 0 ? row.lineNumber : null,
                itemNumber: planningText(row.itemNumber), description,
                notes: planningText(row.notes), quantity: qty, uom,
                attachmentCount: Array.isArray(row.attachments) ? row.attachments.length : 0,
                hasFileLink: planningText(row.fileLink) !== null,
                issues,
            };
        }),
    };
}
//# sourceMappingURL=procurementLines.js.map