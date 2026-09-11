# PR–AM release status — 11 September 2026

## Production change verified

Deployed only `prCatalogApi` to `pr-system-4ea55`, from an isolated archive of
`d3045f7` (includes purchasing evidence commit `a938350`). The supported root
`npm run deploy:functions -- --functions=prCatalogApi` now validates requested names
against this repository's exported functions. Unknown names are rejected. No receipt
functions, frontend, or Firestore rules were released in this deployment.

Live smoke checks: authenticated purchasing reads return 200 with request lines,
PO lines, quantity basis and receipt-evidence status; authenticated archive reads return
200 with bounded pages and a continuation cursor; unauthenticated archive reads return
403. Responses use `no-store`. Before/after function inventories both contain 74
functions; none were removed, and `mintSSOToken` and `createUser` remain present.

## Local changes retained

`5dedbbf` commits the receipt/mapping pilot, including the 11 September stock fix.
Receipts and returns atomically update the asset total and destination balance.
Enrollment, receipts and returns reject inconsistent totals, duplicate/malformed
location codes, explicit unverified stock, and overallocated stock. No live stock
repair, receipt, order enrollment or authoritative mapping has been performed.

Validation: 40 PR catalog/policy tests passed, functions TypeScript build passed,
and Firestore emulator transaction/rules tests passed, including the new inventory
discrepancy cases. Forecast access for Matt plus PR approvers is committed separately
in uGridPREDICT (`62d693b`); its suite passes 251 tests. Forecast access is not yet hosted.

## Next release gates

1. Resolve AM's inventory-level duplication using the existing reconciliation brief.
   Physical location counts must come from the AM team; do not infer site balances.
2. Isolate and deploy the receipt-specific canonical Nexus rules, then the receipt
   callables and coordinated PR/AM interfaces. AM's release announcement remains a draft.
3. Resolve explicit MAS/SMP country/site metadata, verify item specifications and
   select a prospective whole-unit order before enrolling it. No historical backfill.
4. Host the authenticated forecast service and existing Nexus workbench, then verify
   signed-in access and exports end to end. Live forecast inputs remain separate gates;
   fixture outputs must stay labelled as drafts.
