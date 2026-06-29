# PR-Centered Realtime Site Sync

PR is the canonical site hub. UGP and PR Admin writes converge in `referenceData_sites`, and every site change fans out to AM and FM.

## Canonical Event Contract

```json
{
  "source": "ugp | pr_admin",
  "eventType": "site.created | site.updated | site.deactivated",
  "idempotencyKey": "sha1(source|organizationId|code|eventType|updatedAt)",
  "updatedAt": "ISO-8601",
  "site": {
    "organizationId": "1pwr_lesotho",
    "countryCode": "LSO",
    "code": "LGS01",
    "name": "LGS North Yard",
    "active": true,
    "latitude": -29.3151,
    "longitude": 27.4782,
    "externalIds": { "ugpSiteCode": "LGS01" }
  }
}
```

## PR Changes

- `functions/src/siteSync.ts`
  - `ingestUgpSite` (`POST` HTTPS function): upserts UGP events into `referenceData_sites`.
  - `fanoutSiteChanges` (Firestore trigger): dispatches site events to AM + FM with retries and delivery logs.
- `src/components/admin/ReferenceDataManagement.tsx`
  - Sites now require `latitude` + `longitude`.
  - Map picker added for coordinate selection.
- `src/services/referenceDataAdmin.ts`
  - Service-level coordinate validation for `sites`.

## Required Environment Variables

- `SITE_SYNC_UGP_API_KEY`: shared secret for UGP -> PR ingest endpoint.
- `SITE_SYNC_FANOUT_API_KEY`: shared secret used for PR -> AM/FM fanout requests.
- `SITE_SYNC_AM_ENDPOINT`: AM ingest URL, e.g. `https://am.example.com/api/sync/site-ingest.php`.
- `SITE_SYNC_FM_ENDPOINT`: FM ingest URL, e.g. `https://fm.example.com/api/sync/site-ingest`.
- `FIREBASE_ADMIN_BEARER_TOKEN` (optional): bearer fallback for server-to-server fanout.

## Verification Checklist

1. Send UGP payload to `ingestUgpSite` and verify `referenceData_sites/{org_code}` is upserted.
2. Verify a new `siteSyncFanoutLogs` row exists with AM/FM responses.
3. Create/update a site in PR Admin and confirm AM + FM endpoints receive the event.
4. Replay the same payload (same `idempotencyKey`) and confirm AM/FM return idempotent success.
5. Confirm PR Admin blocks save when lat/lng is missing or out of bounds.
