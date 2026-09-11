#!/usr/bin/env bash
#
# Safe Cloud Functions deploy for this repo.
#
# This Firebase project (pr-system-4ea55) hosts functions deployed from TWO
# repos: this one and nexus-portal. A bare `firebase deploy --only functions`
# (especially with --force) DELETES every deployed function not exported by
# the local source — i.e. the other repo's entire set. That outage happened
# on 2026-08-12 (Nexus SSO functions were wiped by a PR deploy).
#
# This script derives the exact list of functions exported by the built
# functions/lib/index.js and deploys with explicit per-function selectors.
# Selective deploys never delete unlisted functions, so a deploy from this
# repo can never touch the Nexus set (and vice versa).
#
# Usage:  scripts/deploy-functions.sh            # deploy all of this repo's functions
#         scripts/deploy-functions.sh --dry-run  # print the selector list only
#         scripts/deploy-functions.sh --functions=prCatalogApi [--dry-run]
#
set -euo pipefail
cd "$(dirname "$0")/.."

DRY_RUN=false
export PR_DEPLOY_FUNCTIONS=""
for argument in "$@"; do
  case "$argument" in
    --dry-run) DRY_RUN=true ;;
    --functions=*) PR_DEPLOY_FUNCTIONS="${argument#--functions=}"; [ -n "$PR_DEPLOY_FUNCTIONS" ] || { echo "Function names required" >&2; exit 1; } ;;
    *) echo "Unknown argument: $argument" >&2; exit 1 ;;
  esac
done

if [ ! -f functions/lib/index.js ]; then
  echo "functions/lib/index.js missing — building first..." >&2
  (cd functions && npm run build)
fi

# GCLOUD_PROJECT is only needed so the v1 SDK doesn't throw on require().
SELECTORS=$(GCLOUD_PROJECT=deploy-dry-run node -e "
const idx = require('./functions/lib/index.js');
const names = Object.keys(idx).filter(k => idx[k] && idx[k].__endpoint);
if (!names.length) { console.error('no functions exported from lib/index.js'); process.exit(1); }
const requested = process.env.PR_DEPLOY_FUNCTIONS ? process.env.PR_DEPLOY_FUNCTIONS.split(',') : names;
if (requested.some(n => !names.includes(n)) || new Set(requested).size !== requested.length) {
  console.error('Every requested function must be a unique export of this repository'); process.exit(1);
}
console.log(requested.map(n => 'functions:' + n).join(','));
" | grep '^functions:')

COUNT=$(echo "$SELECTORS" | tr ',' '\n' | wc -l | tr -d ' ')
echo "Selected $COUNT repository functions."

if [ "$DRY_RUN" = true ]; then
  echo "$SELECTORS" | tr ',' '\n' | sed 's/^functions:/  - /'
  exit 0
fi

echo "Deploying selectively (unlisted functions are never deleted)..."
npx firebase deploy --only "$SELECTORS"
