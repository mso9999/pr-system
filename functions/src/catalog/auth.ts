/**
 * Multi-key auth + best-effort rate limit for prCatalogApi.
 *
 * Accepts any of the provisioned consumer keys so HR, AM, and ugridpredict
 * can share the surface without rotating the HR key. Rate-limit state is
 * per-instance memory — Cloud Functions instances are ephemeral, so this
 * is a burst guard, not a global quota.
 */
import * as functions from "firebase-functions";

export interface CatalogConsumer {
  name: string;
  key: string;
}

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 60;

const hits = new Map<string, number[]>();

function configuredConsumers(): CatalogConsumer[] {
  const rows: Array<[string, string]> = [
    ["hr", String(process.env.HR_API_KEY_PR_PORTAL || "").trim()],
    ["pr_catalog", String(process.env.PR_CATALOG_API_KEY || "").trim()],
    ["ugridpredict", String(process.env.UGRIDPREDICT_API_KEY || "").trim()],
  ];
  const seen = new Set<string>();
  const out: CatalogConsumer[] = [];
  for (const [name, key] of rows) {
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ name, key });
  }
  return out;
}

export function resolveConsumer(req: functions.https.Request): CatalogConsumer | null {
  const presented = String(req.headers["x-api-key"] || "").trim();
  if (!presented) return null;
  return configuredConsumers().find((c) => c.key === presented) || null;
}

/** True when this consumer has exceeded MAX_PER_WINDOW in the last minute. */
export function isRateLimited(consumerName: string): boolean {
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

export function logCatalogCall(args: {
  consumer: string;
  method: string;
  path: string;
  status: number;
  ms: number;
}): void {
  console.info(
    `[prCatalogApi] consumer=${args.consumer} ${args.method} /${args.path} status=${args.status} ${args.ms}ms`
  );
}
