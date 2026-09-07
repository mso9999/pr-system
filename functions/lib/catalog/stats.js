"use strict";
/** Percentile helpers for /lead-times. Pure — no Firebase imports. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.percentile = percentile;
exports.percentileBlock = percentileBlock;
exports.daysBetween = daysBetween;
function percentile(sorted, p) {
    if (sorted.length === 0)
        return 0;
    if (sorted.length === 1)
        return sorted[0];
    const idx = (p / 100) * (sorted.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi)
        return sorted[lo];
    const w = idx - lo;
    return sorted[lo] * (1 - w) + sorted[hi] * w;
}
function percentileBlock(values) {
    if (values.length === 0)
        return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mean = sorted.reduce((s, v) => s + v, 0) / sorted.length;
    const round1 = (n) => Math.round(n * 10) / 10;
    return {
        p50: round1(percentile(sorted, 50)),
        p80: round1(percentile(sorted, 80)),
        p95: round1(percentile(sorted, 95)),
        mean: round1(mean),
    };
}
function daysBetween(fromIso, toIso) {
    if (!fromIso || !toIso)
        return null;
    const a = Date.parse(fromIso);
    const b = Date.parse(toIso);
    if (!Number.isFinite(a) || !Number.isFinite(b) || b < a)
        return null;
    return (b - a) / 86400000;
}
//# sourceMappingURL=stats.js.map