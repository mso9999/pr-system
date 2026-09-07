"use strict";
/** Derive local / regional / import from vendor country (or an explicit override). */
Object.defineProperty(exports, "__esModule", { value: true });
exports.deriveVendorOrigin = deriveVendorOrigin;
function norm(v) {
    return v == null ? "" : String(v).trim().toLowerCase();
}
function deriveVendorOrigin(country, explicit) {
    const raw = norm(explicit);
    if (raw === "local" || raw === "regional" || raw === "import")
        return raw;
    const c = norm(country);
    if (!c)
        return null;
    if (/^(ls|lso|bj|ben|zm|zmb|mw|mwi|bw|bwa)$/.test(c) ||
        (/\b(lesotho|benin|zambia|malawi|botswana)\b/.test(c) &&
            !/\b(south africa|china|india)\b/.test(c))) {
        return "local";
    }
    if (/^(za|zaf|rsa)$/.test(c) || /\bsouth africa\b/.test(c))
        return "regional";
    if (/^(cn|chn|in|ind|de|deu|us|usa|tr|tur|ae|are)$/.test(c) ||
        /\b(china|india|europe|germany|usa|united states|turkey|uae)\b/.test(c)) {
        return "import";
    }
    return null;
}
//# sourceMappingURL=vendorOrigin.js.map