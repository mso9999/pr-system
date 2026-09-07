# PR System Session Log — BOM Cost Integration

## 2026-04-01 — Planning Session (Cowork)

**What happened:**
- Deep exploration of PR system: Firestore schema, PR fields, quote structure, archive data, vendor reference data
- Deep exploration of UGP repo: BOM generator, parts catalog, tech stack
- Created master integration plan at `/AI Projects/BOM_COST_INTEGRATION_PLAN.md`
- Created CONTEXT.md in both repos with cross-references

**Key findings:**
- PRs use free-text descriptions, no part numbers — AI mapping required
- Quotes have vendorId, amount, currencyId, notes — but no incoterms
- Archive PRs from old system have `legacyResponses[]` and `originalData` snapshot
- Vendor master has ~10 entries, all local (Herholdts, LEC, etc.) — no offshore classification
- 30 expense types, relevant ones: "Materials and supplies", "Equipment", "Parts for assets"
- Organization→country mapping is clean and reliable

**Next steps (Phase 0):**
1. Add `incoterm` optional field to PR/quote schema
2. Add vendor origin classification (local/regional/offshore_china/offshore_other)
3. Create `costMappings` Firestore collection schema
4. Extract unique PR descriptions for AI mapping bootstrap

**Decisions made:**
- Incoterm field is optional, inferred from vendor classification for historical records
- Vendor origin stored in reference data, not on individual PRs
- Cloud Function will handle batch export of mapped cost data

## 2026-09-07 — Cursor — Brief 02 procurement read API
- What: Extended `prCatalogApi` with read-only purchase-request, commitment and lead-time endpoints for ugridPREDICT (forecast programme brief 02). Multi-key auth (`HR_API_KEY_PR_PORTAL` / `PR_CATALOG_API_KEY` / `UGRIDPREDICT_API_KEY`), per-consumer 60 req/min burst guard, structured call logs. `/api/vendors` now includes `country`, `origin`, `defaultCurrency`, `incotermDefault`. Added `/api/categories` and `/api/expense-types`.
- Why: Forecast service is a consumer, not a store of record. PR is the only system that knows committed-but-undelivered spend and real vendor lead times. SMP cash model currently has no procurement schedule behind it.
- Schema answers (do not escalate): `orderedAt` / `completedAt` / `estimatedDeliveryDate` / `statusHistory[]` exist on live PRs; no separate PO entity; `archivePRs` excluded from lead times. No AM movements join required.
- Not in this change: AI part-mapping miner (nullable `ugpPartIds[]` / `mappingConfidence` / `mappingSource` exposed only; never overwrite human with AI). No UI or workflow writes.
- Side effects: none yet — functions not deployed. Dedicated `UGRIDPREDICT_API_KEY` still to be written into `functions/.env` at deploy time (existing HR key will work immediately).
- Key files: `functions/src/prCatalogApi.ts`, `functions/src/catalog/*`, `CROSS_REPO_API_CONTRACT.md`, `docs/BRIEF_02_PR_PROCUREMENT_READ_API.md`
- Follow-ups: safe functions deploy (`npm run deploy:functions`); verify `mintSSOToken` survived; provision `UGRIDPREDICT_API_KEY`; commit nexus-portal `CANONICAL_DATA_OWNERSHIP.md` update; AI description→UGP part miner.
