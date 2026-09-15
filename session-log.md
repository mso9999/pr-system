## 2026-09-08 — Cursor — Forecast remaining-work instructions
- Added `docs/FORECAST_PROGRAMME_REMAINING.md` and pointers on Brief 02 + `AGENTS.md`. Remaining PR work: `countryCode` on sites, MAS org identity, line quantities (not ZAR-as-stock), `ugpPartIds` mining. Do not rebuild prCatalogApi. Deploy only via `npm run deploy:functions`.
- Side effects: none (docs only).

## 2026-09-09 — Codex — Purchasing detail and historical read API
- User requested PR read API update, then continuation. Added request lineItems and separately recorded poLineItems with IDs/SKUs, description, notes, quantity/UOM, attachment availability and explicit malformed/missing/duplicate issues. No guessed quantities, UOM conversion, synthesized IDs or receipt claims.
- Added GET /api/v1/archived-purchase-requests under existing API-key/GET/rate-limit controls. Bounded document-ID paging, limit 1–500, strict cursor/parameter validation. Legacy dates/site/org labels preserved; no archives added to commitments or lead-time statistics. No raw originalData, identities or attachment URLs exposed.
- 35 catalogue/route tests pass; full functions TypeScript check passes. Dedicated test config avoids old frontend setup and uses Firestore test doubles without credentials/network. Updated API contract and release note; built output prepared locally. No deploy/push/source-system writes or credential access performed. Existing AGENTS/brief edits and unrelated pending docs preserved.

## 2026-09-15 — Cursor — Align saveAmReconciliation org scope with AM PHP
- Fixed false "outside your organization scope" when JWT org ids did not match asset.organization_id (empty org or non-AM grant ids).
- Deployed only saveAmReconciliation + confirmAmUgpMapping via scripts/deploy-functions.sh; mintSSOToken still present.
- Commit 15ac51b on main.
