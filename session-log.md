## 2026-09-21 — Cursor — Fleet integration key on live PR functions
- After the shared-EC2 React2Shell rotation, production PR functions still had the old `FLEET_INTEGRATION_API_KEY` (fingerprint `a561af80ad56`). Patched the seven Fleet clients only (`listFleetMissions`, `getFleetMission`, `fleetSmokeTest`, `listFleetWorkOrders`, `getFleetWorkOrder`, `validateFleetWorkOrderForPr`, `fleetPrLinkOnCreate`) via Cloud Functions API `PATCH environmentVariables`. **No** `firebase deploy`. Local `functions/.env` already had the new value.
- Verified `fleetSmokeTest` and the other six now fingerprint `8f6a4049adea`, status ACTIVE. Other PR/Nexus functions still carry the old unused copy in their env until their next selective deploy.
- Incident: `1PWR Nexus/nexus-portal/docs/incidents/INCIDENT_20260921_REACT2SHELL.md`.
- Side effects: seven function env updates ~17:26Z. No repo functions deploy, no delete list.

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
