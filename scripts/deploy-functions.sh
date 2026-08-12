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
#
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f functions/lib/index.js ]; then
  echo "functions/lib/index.js missing — building first..." >&2
  (cd functions && npm run build)
fi

# GCLOUD_PROJECT is only needed so the v1 SDK doesn't throw on require().
SELECTORS=$(GCLOUD_PROJECT=deploy-dry-run node -e "
const idx = require('./functions/lib/index.js');
const names = Object.keys(idx).filter(k => idx[k] && idx[k].__endpoint);
if (!names.length) { console.error('no functions exported from lib/index.js'); process.exit(1); }
console.log(names.map(n => 'functions:' + n).join(','));
" 2>/dev/null | grep '^functions:')

COUNT=$(echo "$SELECTORS" | tr ',' '\n' | wc -l | tr -d ' ')
echo "Repo exports $COUNT functions."

if [ "${1:-}" = "--dry-run" ]; then
  echo "$SELECTORS" | tr ',' '\n' | sed 's/^functions:/  - /'
  exit 0
fi

echo "Deploying selectively (unlisted functions are never deleted)..."
npx firebase deploy --only "$SELECTORS"
