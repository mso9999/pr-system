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
