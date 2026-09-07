# Brief 02 — PR System: committed procurement and lead-time read API

**Target repo**: `AI Projects/PR 25 NOV` (`mso9999/pr-system`) · **Live at**: pr.1pwrafrica.com
**Stack**: React/TypeScript, Firebase/Firestore, Cloud Functions (Node 18)
**Read first**: `00_PROGRAMME_BRIEF.md`, then this repo's `CROSS_REPO_API_CONTRACT.md`, `AGENTS.md` and
`nexus-portal/docs/CANONICAL_DATA_OWNERSHIP.md`. **Extends**: `AI Projects/BOM_COST_INTEGRATION_PLAN.md`
**Priority**: CRITICAL PATH, parallel with brief 01.

---

## 0. Correction to earlier scoping — read this first

An earlier assessment recorded PR as having "no vendors/sites GET API". **That is out of date.**
`prCatalogApi` already exposes, all under `X-API-Key: <PR_CATALOG_API_KEY>` validated in
`functions/src/prCatalogApi.ts`, base
`https://us-central1-pr-system-4ea55.cloudfunctions.net/prCatalogApi`:

| Path | Envelope | Consumers |
|---|---|---|
| `/api/countries` | `{count, countries[]}` | AM, Nexus |
| `/api/organizations` (`?country=LS`) | `{count, organizations[]}` | AM, Nexus, HR |
| `/api/sites` (`?country=&org=`) | `{count, sites[]}` | AM, Nexus |
| `/api/vendors` | `{count, vendors[]}` | AM, Nexus |

**So sections 4's `/sites` and `/catalog` are largely done.** What is genuinely missing is the thing this
programme needs: **purchase requests, commitments and lead times**. Scope accordingly.

Follow the established conventions exactly: camelCase items, `{count, items[]}` envelope,
`Cache-Control: no-store`, and extend `prCatalogApi` (or add a sibling function to the same export set)
rather than standing up a new service with a new key.

Useful and already solved: `fanoutSiteChanges` pushes site changes to AM's
`POST /api/sync/site-ingest.php`, so **PR site ids are the shared join key across PR, AM and the forecast
service.** Do not invent another.

---

## ⚠️ Deploy safety — read before touching anything

Firebase project `pr-system-4ea55` hosts Cloud Functions from **two** repos: this one and
`1PWR Nexus/nexus-portal`. A bare `firebase deploy --only functions` **deletes every function this repo
does not export**. On 12 Aug 2026 exactly that wiped the Nexus SSO functions (`mintSSOToken`,
`verifyPin`, `nexusAssistant`) — a production outage for every app launching through Nexus.

- **Never** run `firebase deploy` or `firebase deploy --only functions`. **Never** pass `--force`.
- Deploy only via `npm run deploy:functions` / `scripts/deploy-functions.sh` (explicit per-function
  selectors). `scripts/deploy-functions.sh --dry-run` lists what would deploy.
- Firestore rules and indexes are canonical in `nexus-portal` only. **Never deploy `firestore:*` from
  this repo.**
- After any functions deploy: `firebase functions:list | grep -E "mintSSOToken|createUser"` to confirm
  both repos' sets survived.
- If a deploy plan shows a list of "functions to delete" — **stop**. That list is production.

---

## 1. Problem

PR owns purchase requests, vendors, organisations, sites and the procurement catalogue. It is the only
system that knows **what has been committed but not yet delivered**, and it holds years of history from
which real vendor lead times can be derived.

Neither is currently readable. There is a `prCatalogApi` for countries and organisations and an
`ingestUgpSite` function, but **no GET API for vendors, sites, or purchase requests**.

The executive consequence: the SMP cash model shows grid capex as ZAR 307,000 in one month and a single
ZAR 8,500,000 lump seven months later. There is no procurement schedule behind it, no lead times, no
landed cost, and no way to tell whether the lump is a plan or a placeholder. Committed spend and expected
delivery dates cannot enter a cash forecast that cannot read them.

## 2. Scope

Read-only, key-authenticated Firestore-backed API, plus a derived **lead-time statistics** endpoint. No
changes to PR's UI or approval workflow. No writes.

## 3. Authentication

Reuse `X-API-Key: <PR_CATALOG_API_KEY>` as validated in `functions/src/prCatalogApi.ts`. Provision a
consumer key for `ugridpredict`. Per-key rate limiting and call logging.

Implement as Cloud Functions **added to the existing export set** — and deploy per section ⚠ above. Note
that PR CI deploys **hosting only**, and Firestore rules are canonical in `nexus-portal/firestore.rules`;
any rules change belongs there, not here.

## 4. Endpoints

### `GET /api/v1/purchase-requests`
Query: `status`, `organization`, `site`, `created_since`, `expected_before`, `cursor`, `limit`.

```json
{
  "items": [{
    "pr_id": "PR-2026-0417",
    "status": "approved",
    "organization": "SMP",
    "site": "MAS",
    "department": "PM",
    "description": "LV conductor 2x16mm ABC — 12km",
    "category": "Conductors",
    "expense_type": "capex",
    "estimated_amount": 184000,
    "currency": "ZAR",
    "vendor_id": "herholdts",
    "quotes": [{"vendor_id": "herholdts", "amount": 184000, "currency": "ZAR"}],
    "created_at": "2026-07-14T08:11:00Z",
    "approved_at": "2026-07-19T10:02:00Z",
    "ordered_at": "2026-07-22T09:00:00Z",
    "expected_delivery": null,
    "delivered_at": null,
    "ugp_part_ids": ["wire-abc-2c-16"]
  }],
  "next_cursor": "..."
}
```

**`ordered_at`, `expected_delivery` and `delivered_at` are the fields the forecast needs and are the ones
most likely not to exist today.** See section 6 before assuming they can be populated.

### `GET /api/v1/commitments`
The cash-relevant view: approved-or-ordered, not yet delivered, aggregated by month and category.
Fields: `month`, `organization`, `site`, `category`, `committed_amount`, `currency`, `pr_count`,
`earliest_expected`, `latest_expected`. This is what drops straight into a cash projection as committed
outflow and is the highest-value endpoint for the board-facing work.

### `GET /api/v1/vendors`
`vendor_id`, `name`, `country`, `active`, `default_currency`, `origin` (local / regional / import),
`incoterm_default` (nullable). Origin and incoterm matter because a Chinese import and a Maseru pickup
have completely different lead-time and landed-cost profiles.

### `GET /api/v1/lead-times`
**Derived statistics, computed from history — this is the endpoint that replaces guesswork with evidence.**

Query: `vendor_id`, `category`, `origin`, `since`.

```json
{
  "vendor_id": "herholdts",
  "category": "Conductors",
  "origin": "local",
  "n": 23,
  "days_order_to_delivery": {"p50": 18, "p80": 34, "p95": 61, "mean": 24.8},
  "days_request_to_order": {"p50": 9, "p80": 21, "p95": 40},
  "window": "2024-01-01..2026-09-01"
}
```

Publish **percentiles, not means**. The forecast service consumes p50 for the base case and p80/p95 for
the slip cases; a mean lead time is exactly the assumption that has been producing unmeetable plans.
Where `n < 5`, return the statistics with a `low_confidence: true` flag rather than suppressing them.

### Reference data — mostly already exposed
`/api/countries`, `/api/organizations`, `/api/sites` and `/api/vendors` exist (see §0). The only additions
needed are **item categories** and **expense types**, and the `origin` / `incoterm_default` fields on the
vendor shape above, which the current `{id, name, email, phone, active}` payload lacks.

## 5. Part identity and cost mining

`BOM_COST_INTEGRATION_PLAN.md` already specifies AI-assisted mining of PR free-text descriptions into UGP
part IDs, with a cost store carrying `part_id`, `unit_cost`, `currency`, `country`, `vendor`,
`vendor_origin`, `incoterm`, `date`, `source_ref`, `logistics_cost`, `fob_cost`. **Execute that plan as
part of this brief**, with three amendments:

1. Persist the mapping as a nullable `ugp_part_ids[]` array on the PR record and expose it in the API
   above, so the mapping is reusable rather than recomputed.
2. Every mapping carries `mapping_confidence` and `mapping_source` (`ai` / `human` / `rule`). The forecast
   service must be able to exclude low-confidence mappings from anything lender-facing.
3. **Never overwrite a human mapping with an AI one.**

**Costing trap**: UGP parts catalogues still carry SparkMeter metering. The in-house 1MTR at
~ZAR 900/connection has replaced it for the remaining portfolio; SparkMeter is installed base only. Any
mined cost that reintroduces SparkMeter pricing for new connections is wrong.

## 6. Questions to resolve before coding — raise, do not assume

- **Does PR record `ordered_at` and `delivered_at` at all?** If the workflow ends at approval, lead times
  cannot be derived from PR alone and must be joined to AM `movements` (brief 01, `movement_type=receipt`,
  `reference` = PR/PO id). **Report which is the case before building `/lead-times`** — this determines
  whether briefs 01 and 02 have a hard dependency on each other.
- Is there a PO entity distinct from the PR, or is the PR the order?
- Are `archivePRs` (legacy Google Forms imports) structurally comparable enough to include in lead-time
  statistics, or do they need exclusion? Prefer excluding and saying so over silently mixing.
## 6a. Register the result

When endpoints ship, update **both** this repo's `CROSS_REPO_API_CONTRACT.md` ("Exposed APIs" table) and
`nexus-portal/docs/CANONICAL_DATA_OWNERSHIP.md`. Both of this brief's scoping errors came from working off
a stale second-hand summary instead of those two files.

## 7. Acceptance

- All endpoints respond with a valid key, reject without one.
- `/commitments` reconciles to the sum of underlying PRs for a chosen month and organisation.
- `/lead-times` returns evidence-based percentiles for at least the top ten vendors by PR volume, or the
  dependency on AM `movements` is formally documented and escalated.
- Existing PR UI and approval flow unchanged; no writes introduced.
- **Both repos' Cloud Functions verified alive after deploy** (see ⚠ above). This is an acceptance
  criterion, not a courtesy.

## 8. Resolved before coding (2026-09-07, live schema)

Do not escalate — answered from production `purchaseRequests` (~1864 docs):

1. **`orderedAt`, `completedAt` (= delivered), `estimatedDeliveryDate`, `statusHistory[]` exist.**
   Lifecycle is `APPROVED → ORDERED → COMPLETED`. Lead times are derived from PR alone — no hard
   dependency on AM `movements`.
2. **No separate PO entity.** The PR *is* the order (`objectType` flips to PO from APPROVED onward).
3. **`archivePRs` are excluded** from lead-time stats (Google Forms imports, no status history).
4. Vendor docs have `country` but not yet `origin` / `incotermDefault` / `defaultCurrency`. The API
   exposes those fields as nullable and derives `origin` from country.
5. AI part-mapping (`ugpPartIds[]`) is **exposed, not mined**. Human mappings are never overwritten.
   SparkMeter pricing must not be used for new connections (1MTR ~ZAR 900).
