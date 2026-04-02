# Supplier History View — Polish & Integration

## What's Already Done
- `src/services/supplierHistory.ts` — SupplierHistoryService that aggregates vendor transactions from purchaseRequests Firestore collection
- `src/components/suppliers/SupplierHistoryView.tsx` — Full MUI component with searchable table, expandable rows, transaction detail, downloadable attachments
- Route `/suppliers` added to `src/App.tsx`
- Nav link "Suppliers" with Business icon added to `src/components/common/Layout.tsx`

## Polish Tasks

### 1. Fix Firebase Import Path
The service uses `import { db } from "@/config/firebase"` — verify this matches the actual export. The PR System's firebase config may export `db` from `getFirestore(app)` in the main pr.ts service rather than config/firebase. Check `src/config/firebase.ts` for the actual export.

### 2. Performance: Add Caching
The `getSupplierIndex()` fetches ALL purchaseRequests on every call. Add:
- In-memory cache with 5-minute TTL
- Loading state in the component (already has CircularProgress)
- Consider pagination for large datasets (>500 PRs)

### 3. Add Invoice Download Tracking
When a user clicks a download link for an attachment, the URL goes directly to Firebase Storage. Verify:
- The download URLs are valid (they should be Firebase Storage signed URLs)
- PDFs open in a new tab
- Consider adding a "Download All" button per vendor

### 4. Connect to UGP Cost Data
The UGP adapter now exposes `GET /cost/suppliers` with the same data aggregated from cost_records.json. For vendors that appear in both systems:
- Show a "Cost Data Available" badge
- Link to UGP's cost detail for that vendor's parts

### 5. Verify Layout Integration
- The nav link should appear between "PRs" and "Archive Dataroom"
- It should be accessible to ALL authenticated users (not admin-only)
- Test that the route works within the PrivateRoute wrapper

### 6. Organization Filter
The component has an org filter dropdown. Verify it works with the multi-tenant setup:
- Users should see all orgs they have access to
- The filter should query Firestore with the organization constraint

## Tech Stack
- React 18.3 + TypeScript 5.6
- Material UI 6.2 (MUI)
- Firebase/Firestore
- Redux Toolkit for auth state
- React Router 7.1

## Key Files
- `src/services/supplierHistory.ts` — data service
- `src/components/suppliers/SupplierHistoryView.tsx` — UI component
- `src/App.tsx` — route registration (line ~110)
- `src/components/common/Layout.tsx` — nav link (line ~161)
- `src/config/firebase.ts` — Firebase config/exports
- `src/services/pr.ts` — reference for Firestore patterns
