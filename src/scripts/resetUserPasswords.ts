/**
 * Reset User Passwords Script
 * Resets passwords for all non-admin users to a default value.
 */

import * as admin from 'firebase-admin';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { readFileSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';

config(); // Load environment variables

type ServiceAccount = admin.ServiceAccount | undefined;

function loadServiceAccount(): ServiceAccount {
  const envKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (envKey) {
    try {
      const cleanedKey = envKey.replace(/\\n/g, '\n').replace(/\\"/g, '"');
      return JSON.parse(cleanedKey);
    } catch (error) {
      console.error('❌ Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:', error);
      process.exit(1);
    }
  }

  const possiblePaths = [
    join(process.cwd(), 'firebase-service-account.json'),
    '/tmp/firebase-service-account.json'
  ];

  for (const filePath of possiblePaths) {
    try {
      const fileContents = readFileSync(filePath, 'utf8');
      return JSON.parse(fileContents);
    } catch {
      // continue trying next path
    }
  }

  console.error('❌ Could not load service account credentials. Set FIREBASE_SERVICE_ACCOUNT_KEY or provide firebase-service-account.json');
  process.exit(1);
}

const serviceAccount = loadServiceAccount();
const app = initializeApp({
  credential: cert(serviceAccount as admin.ServiceAccount),
});

const db = getFirestore(app);
const auth = getAuth(app);

const DEFAULT_PASSWORD = process.env.RESET_PASSWORD || '1PWR00';

function isAdminUser(userData: any): boolean {
  const permissionLevelRaw = userData?.permissionLevel;
  const role = typeof userData?.role === 'string' ? userData.role.toLowerCase() : '';

  let permissionLevel: number | null = null;
  if (typeof permissionLevelRaw === 'number') {
    permissionLevel = permissionLevelRaw;
  } else if (typeof permissionLevelRaw === 'string') {
    const parsed = Number(permissionLevelRaw);
    permissionLevel = Number.isNaN(parsed) ? null : parsed;
  }

  // Treat permission levels 1-2 (Admin/Super Admin) as administrators
  if (permissionLevel !== null && permissionLevel <= 2) {
    return true;
  }

  return role === 'admin';
}

async function resetPasswords() {
  try {
    console.log('🔐 Initializing password reset process...');
    console.log('   Default password =>', DEFAULT_PASSWORD);

    const usersSnapshot = await db.collection('users').get();
    console.log(`📊 Loaded ${usersSnapshot.size} users from Firestore`);

    let resetCount = 0;
    let skippedAdmins = 0;
    let skippedNoEmail = 0;
    let skippedAuthMissing = 0;
    let errorCount = 0;

    for (const docSnapshot of usersSnapshot.docs) {
      const userData = docSnapshot.data();
      const email = typeof userData.email === 'string' ? userData.email.trim() : '';

      if (!email) {
        skippedNoEmail++;
        console.warn(`⚠️  Skipping user ${docSnapshot.id} - missing email`);
        continue;
      }

      if (isAdminUser(userData)) {
        skippedAdmins++;
        continue;
      }

      try {
        const userRecord = await auth.getUserByEmail(email);
        await auth.updateUser(userRecord.uid, { password: DEFAULT_PASSWORD });
        resetCount++;

        if (resetCount % 25 === 0) {
          console.log(`  ✅ Password reset for ${resetCount} users so far...`);
        }
      } catch (error: any) {
        if (error?.code === 'auth/user-not-found') {
          skippedAuthMissing++;
          console.warn(`⚠️  Auth user not found for email: ${email}`);
        } else {
          errorCount++;
          console.error(`❌ Failed to reset password for ${email}:`, error?.message || error);
        }
      }
    }

    console.log('\n✅ Password reset complete!');
    console.log(`   Password reset to ${DEFAULT_PASSWORD} for: ${resetCount} users`);
    console.log(`   Skipped administrators: ${skippedAdmins}`);
    console.log(`   Skipped (missing email): ${skippedNoEmail}`);
    console.log(`   Skipped (no auth record): ${skippedAuthMissing}`);
    console.log(`   Errors: ${errorCount}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Password reset failed:', error);
    process.exit(1);
  }
}

resetPasswords();

