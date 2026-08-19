/**
 * One-time backfill: push every existing PR canonical site to the CC lane
 * ingest endpoints as `site.created` events, mirroring the exact payload
 * shape produced by fanoutSiteChanges (toCanonicalEvent).
 *
 * Lanes self-filter by country and stage new sites inactive, so this is
 * safe to re-run (ingest upserts; idempotency keys dedupe exact replays —
 * we suffix a run id so a re-run is applied as a fresh update).
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=firebase-service-account.json \
 *   npx tsx src/scripts/backfillSitesToCc.ts [--dry-run]
 */
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { createHash } from "crypto";

initializeApp({ credential: applicationDefault(), projectId: "pr-system-4ea55" });
const db = getFirestore();

const DRY_RUN = process.argv.includes("--dry-run");
const RUN_ID = new Date().toISOString().slice(0, 10);

const LANES = [
  "https://cc.1pwrafrica.com/api/site-sync/ingest",
  "https://cc.1pwrafrica.com/api/bn/site-sync/ingest",
  "https://cc.1pwrafrica.com/api/zm/site-sync/ingest",
];

const ORG_TO_COUNTRY: Record<string, string> = {
  "1pwr_lesotho": "LSO",
  "1pwr_benin": "BEN",
  "1pwr_zambia": "ZMB",
};

function normalizeOrgId(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

async function main() {
  const fanoutKey = process.env.SITE_SYNC_FANOUT_API_KEY || "";
  if (!fanoutKey && !DRY_RUN) {
    throw new Error("SITE_SYNC_FANOUT_API_KEY is required (matches CC_SITE_SYNC_API_KEY on lanes)");
  }

  const snap = await db.collection("referenceData_sites").get();
  console.log(`found ${snap.size} site docs`);

  let sent = 0;
  let skipped = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    const org = normalizeOrgId(String(data.organizationId || ""));
    const code = String(data.code || "").trim().toUpperCase();
    const name = String(data.name || "").trim();
    const lat = Number(data.latitude);
    const lng = Number(data.longitude);
    if (!org.startsWith("1pwr_") || !/^[A-Z]{3}$/.test(code) || !name) {
      skipped++;
      continue;
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      console.log(`  skip ${org}/${code}: no coordinates`);
      skipped++;
      continue;
    }
    const countryCode = ORG_TO_COUNTRY[org] || String(data.countryCode || "").toUpperCase();
    const active = data.active !== false;
    const address = data.siteAddress || data.address || undefined;
    const ugpProjects = Array.isArray(data.ugpProjects) ? data.ugpProjects : [];
    const updatedAt = String(data.updatedAt || new Date().toISOString());
    const event = {
      source: data.source === "ugp" ? "ugp" : "pr_admin",
      eventType: !active ? "site.deactivated" : "site.created",
      site: {
        organizationId: org,
        countryCode,
        code,
        name,
        active,
        latitude: lat,
        longitude: lng,
        district: data.district || address?.region || undefined,
        address,
        ugpProjects,
        canonicalUgpProjectId: data.canonicalUgpProjectId || undefined,
        externalIds: data.externalIds || {},
      },
      idempotencyKey: createHash("sha1")
        .update(`backfill|${RUN_ID}|${org}|${code}|${updatedAt}`)
        .digest("hex"),
      updatedAt,
    };

    if (DRY_RUN) {
      console.log(`  [dry] ${org}/${code} -> ${countryCode} (${event.eventType})`);
      sent++;
      continue;
    }
    for (const url of LANES) {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": fanoutKey },
        body: JSON.stringify(event),
      });
      const body = await res.text();
      if (!res.ok) {
        console.error(`  FAIL ${url} ${org}/${code}: HTTP ${res.status} ${body}`);
      } else {
        const parsed = JSON.parse(body);
        if (parsed.applied) console.log(`  ${url.includes("/zm/") ? "ZM" : url.includes("/bn/") ? "BN" : "LS"}: ${code} ${parsed.action}`);
      }
    }
    sent++;
  }
  console.log(`done: ${sent} processed, ${skipped} skipped`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
