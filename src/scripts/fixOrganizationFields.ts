/**
 * Fix Organization Fields Script
 *
 * Some PRs accidentally stored the normalized organization ID (e.g. "1pwr_lesotho")
 * instead of the human readable name (e.g. "1PWR LESOTHO"). This script:
 *   1. Loads all organizations from reference data
 *   2. Finds purchase requests whose `organization` matches a normalized ID
 *   3. Restores the human readable organization name
 *   4. Persists a normalized `organizationId` field for future filtering
 *
 * Usage:
 *   npx tsx src/scripts/fixOrganizationFields.ts
 *
 * Requirements:
 *   - FIREBASE_SERVICE_ACCOUNT_KEY env var (preferred)
 *   - or firebase-service-account.json in project root (fallback)
 */

import { config } from 'dotenv';
import type { ServiceAccount } from 'firebase-admin';
import { initializeApp, cert, getApp, getApps, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';

config();

const ORG_COLLECTION = 'referenceData_organizations';
const PR_COLLECTION = 'purchaseRequests';

function normalizeOrgId(value: string | undefined | null): string {
  if (!value) return '';
  return value.toString().toLowerCase().replace(/[^a-z0-9]/g, '_');
}

let cachedApp: App | null = null;

async function initializeAdmin() {
  if (cachedApp) {
    return cachedApp;
  }
  const existingApps = getApps();
  if (existingApps.length) {
    cachedApp = getApp();
    return cachedApp;
  }

  let serviceAccount: Record<string, unknown> | undefined;
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (serviceAccountKey) {
    try {
      try {
        serviceAccount = JSON.parse(serviceAccountKey);
      } catch {
        const cleanedKey = serviceAccountKey
          .replace(/\\n/g, '\n')
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, '\\');
        serviceAccount = JSON.parse(cleanedKey);
      }
    } catch (error) {
      console.error('❌ Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:', error);
      process.exit(1);
    }
  } else {
    const serviceAccountPath = join(process.cwd(), 'firebase-service-account.json');
    try {
      serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
    } catch {
      try {
        serviceAccount = JSON.parse(readFileSync('/tmp/firebase-service-account.json', 'utf8'));
      } catch (tempError) {
        console.error('❌ Could not load service account. Set FIREBASE_SERVICE_ACCOUNT_KEY or add firebase-service-account.json');
        console.error(tempError);
        process.exit(1);
      }
    }
  }

  cachedApp = initializeApp({
    credential: cert(serviceAccount as ServiceAccount)
  });
  console.log('✅ Firebase Admin SDK initialized');
  return cachedApp;
}

async function fixOrganizationFields() {
  try {
    const app = await initializeAdmin();
    const db = getFirestore(app);

    console.log('📋 Loading organization reference data...');
    const orgSnapshot = await db.collection(ORG_COLLECTION).get();
    if (orgSnapshot.empty) {
      console.error('❌ No organizations found in reference data.');
      process.exit(1);
    }

    const orgMap = new Map<string, { displayName: string; normalizedId: string }>();
    orgSnapshot.forEach(docSnap => {
      const data = docSnap.data() || {};
      const displayName = (data.name || data.displayName || docSnap.id || '').toString().trim();
      const normalizedId = normalizeOrgId(data.id || docSnap.id || displayName);

      if (!displayName) {
        console.warn(`⚠️ Organization ${docSnap.id} is missing a display name. Skipping.`);
        return;
      }

      // Map by both document ID and normalized ID for easy lookups
      orgMap.set(docSnap.id, { displayName, normalizedId });
      orgMap.set(normalizedId, { displayName, normalizedId });
    });

    console.log(`✅ Loaded ${orgMap.size} organization mappings.`);

    const uniqueKeys = Array.from(new Set(orgMap.keys()));
    let updatedCount = 0;
    let scannedCount = 0;

    const chunkSize = 10; // Firestore "in" queries support max 10 values
    for (let i = 0; i < uniqueKeys.length; i += chunkSize) {
      const chunk = uniqueKeys.slice(i, i + chunkSize);
      console.log(`\n🔎 Querying PRs for organization values: ${chunk.join(', ')}`);

      const snapshot = await db.collection(PR_COLLECTION)
        .where('organization', 'in', chunk)
        .get();

      if (snapshot.empty) {
        console.log('   ↪ No PRs found for this chunk.');
        continue;
      }

      for (const docSnap of snapshot.docs) {
        scannedCount++;
        const data = docSnap.data();
        const currentOrgValue = (data.organization || '').toString();
        const mapping = orgMap.get(currentOrgValue);

        if (!mapping) {
          continue;
        }

        const alreadyCorrectName = data.organization === mapping.displayName;
        const alreadyHasId = data.organizationId === mapping.normalizedId;

        if (alreadyCorrectName && alreadyHasId) {
          continue;
        }

        await docSnap.ref.update({
          organization: mapping.displayName,
          organizationId: mapping.normalizedId,
          updatedAt: new Date().toISOString()
        });

        updatedCount++;
        console.log(`   ✅ Fixed PR ${docSnap.id} (${data.prNumber || 'N/A'}) → ${mapping.displayName}`);
      }
    }

    console.log('\n🎉 Organization fix complete!');
    console.log(`   PRs scanned:  ${scannedCount}`);
    console.log(`   PRs updated: ${updatedCount}`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to fix organization fields:', error);
    process.exit(1);
  }
}

fixOrganizationFields();


