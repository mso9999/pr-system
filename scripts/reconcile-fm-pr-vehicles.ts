#!/usr/bin/env npx tsx
/**
 * Compare FM SQLite vehicles vs PR Firestore referenceData_vehicles.
 * Thin wrapper — canonical script lives in the FM repo.
 *
 * Usage (from PR repo): npx tsx scripts/reconcile-fm-pr-vehicles.ts
 */

import { spawnSync } from "child_process";
import path from "path";

const FM_SCRIPT = path.resolve(
  __dirname,
  "../../../1PWR FLEET/fleet-hub/scripts/reconcile-fm-pr-vehicles.ts"
);

const result = spawnSync("npx", ["tsx", FM_SCRIPT], {
  stdio: "inherit",
  env: {
    ...process.env,
    FM_DB_PATH: process.env.FM_DB_PATH || path.resolve(__dirname, "../../../1PWR FLEET/fleet-hub/fleet-hub.db"),
  },
});

process.exit(result.status ?? 1);
