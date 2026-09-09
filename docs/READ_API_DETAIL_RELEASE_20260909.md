# Purchasing detail API — local release note

Implemented additive request and PO line evidence in the existing prCatalogApi and a separate bounded archive read. See CROSS_REPO_API_CONTRACT.md for exact fields, pagination and uncertainty semantics.

Validation: 35 catalogue/HTTP tests pass; full functions TypeScript check passes. Tests cover decimals/zero/invalid quantities, duplicate and missing IDs, request-versus-PO separation, completed-not-received semantics, archive allowlisting, bounded paging, invalid cursors, existing auth/method gates and both live route spellings. Compiled output is prepared locally. No production deployment or source data mutation performed.

After authorized deployment, smoke-test:
1. Missing/wrong key fails; POST fails; authenticated GET succeeds.
2. A known SMP/MAS request exposes lineItems and poLineItems separately, including null/issue markers where appropriate.
3. Archive GET limit=2 returns at most two historical records; nextCursor resumes without repeating the page; bad cursor yields 400.
4. Response excludes attachment URLs, raw originalData and requestor metadata; receiptEvidenceStatus is not_connected.
5. Existing commitments/lead-times remain live-only, and shared Nexus SSO functions remain present.

Use the approved explicit-selector deployment script after a fresh functions build. Do not publish through the unsafe functions/package.json deploy command. The existing AM receipt-closeout brief remains a separate implementation task. These reads enable the next matching pass but do not authorize automatic mappings or fabricate received stock.
