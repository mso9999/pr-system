# Agent Notes — PR System repo

## Deploying Cloud Functions — READ BEFORE ANY DEPLOY

This repo shares Firebase project `pr-system-4ea55` with
`1PWR Nexus/nexus-portal`. A bare `firebase deploy --only functions`
(or `--force`) **deletes the other repo's production functions**
(2026-08-12 incident: Nexus SSO functions wiped by a PR deploy).

- Deploy functions ONLY via: `npm run deploy:functions`
  (runs `scripts/deploy-functions.sh`, which deploys with explicit
  per-function selectors and cannot delete unlisted functions).
- Never run bare `firebase deploy` / `firebase deploy --only functions`,
  and never pass `--force` to a functions deploy.
- Firestore rules/indexes are canonical in `nexus-portal` — do not deploy
  `firestore:*` from this repo.
- `npm run deploy` is safe: it composes `deploy:hosting` +
  `deploy:functions`.
