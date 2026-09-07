"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveConsumer = resolveConsumer;
exports.isRateLimited = isRateLimited;
exports.logCatalogCall = logCatalogCall;
const WINDOW_MS = 60000;
const MAX_PER_WINDOW = 60;
const hits = new Map();
function configuredConsumers() {
    const rows = [
        ["hr", String(process.env.HR_API_KEY_PR_PORTAL || "").trim()],
        ["pr_catalog", String(process.env.PR_CATALOG_API_KEY || "").trim()],
        ["ugridpredict", String(process.env.UGRIDPREDICT_API_KEY || "").trim()],
    ];
    const seen = new Set();
    const out = [];
    for (const [name, key] of rows) {
        if (!key || seen.has(key))
            continue;
        seen.add(key);
        out.push({ name, key });
    }
    return out;
}
function resolveConsumer(req) {
    const presented = String(req.headers["x-api-key"] || "").trim();
    if (!presented)
        return null;
    return configuredConsumers().find((c) => c.key === presented) || null;
}
/** True when this consumer has exceeded MAX_PER_WINDOW in the last minute. */
function isRateLimited(consumerName) {
    const now = Date.now();
    const recent = (hits.get(consumerName) || []).filter((t) => now - t < WINDOW_MS);
    if (recent.length >= MAX_PER_WINDOW) {
        hits.set(consumerName, recent);
        return true;
    }
    recent.push(now);
    hits.set(consumerName, recent);
    return false;
}
function logCatalogCall(args) {
    console.info(`[prCatalogApi] consumer=${args.consumer} ${args.method} /${args.path} status=${args.status} ${args.ms}ms`);
}
//# sourceMappingURL=auth.js.map