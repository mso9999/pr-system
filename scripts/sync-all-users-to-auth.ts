/**
 * Sync All Users to Auth Script
 * Creates Firebase Auth accounts for all Firestore users that don't have one.
 * 
 * Usage: npx ts-node scripts/sync-all-users-to-auth.ts [--dry-run] [--password=<default-password>]
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

  console.error('❌ Could not load service account credentials.');
  process.exit(1);
}

const serviceAccount = loadServiceAccount();
const app = initializeApp({
  credential: cert(serviceAccount as admin.ServiceAccount),
});

const db = getFirestore(app);
const auth = getAuth(app);

const DEFAULT_PASSWORD = '1PWR2024!';

interface SyncResult {
  created: string[];
  skipped: string[];
  errors: { email: string; error: string }[];
}

async function syncAllUsersToAuth(dryRun: boolean, defaultPassword: string): Promise<SyncResult> {
  console.log('🔄 Starting user sync to Firebase Auth...');
  console.log(`   Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE'}`);
  console.log(`   Default password: ${defaultPassword}\n`);

  const result: SyncResult = {
    created: [],
    skipped: [],
    errors: []
  };

  // Get all Firestore users
  console.log('📁 Loading Firestore users...');
  const firestoreSnapshot = await db.collection('users').get();
  console.log(`   Found ${firestoreSnapshot.size} users in Firestore\n`);

  let processed = 0;
  for (const doc of firestoreSnapshot.docs) {
    const userData = doc.data();
    const userId = doc.id;
    const email = (userData.email || '').trim().toLowerCase();
    const name = `${userData.firstName || ''} ${userData.lastName || ''}`.trim();

    processed++;
    
    if (!email) {
      console.log(`⏭️  [${processed}/${firestoreSnapshot.size}] Skipping ${userId} - no email`);
      result.skipped.push(`${userId} (no email)`);
      continue;
    }

    // Check if user exists in Auth
    try {
      await auth.getUser(userId);
      // User exists, skip
      result.skipped.push(email);
      continue;
    } catch (error: any) {
      if (error.code !== 'auth/user-not-found') {
        console.error(`❌ [${processed}/${firestoreSnapshot.size}] Error checking ${email}:`, error.message);
        result.errors.push({ email, error: error.message });
        continue;
      }
    }

    // User doesn't exist in Auth - create them
    console.log(`📝 [${processed}/${firestoreSnapshot.size}] Creating Auth account for: ${email} (${name})`);

    if (dryRun) {
      result.created.push(email);
      continue;
    }

    try {
      // Check if email exists with different UID
      try {
        const existingUser = await auth.getUserByEmail(email);
        console.log(`   ⚠️  Email exists with different UID: ${existingUser.uid}`);
        console.log(`   ⚠️  Deleting old account and creating with correct UID...`);
        await auth.deleteUser(existingUser.uid);
      } catch (e: any) {
        if (e.code !== 'auth/user-not-found') {
          throw e;
        }
      }

      await auth.createUser({
        uid: userId,
        email: email,
        emailVerified: false,
        password: defaultPassword,
        disabled: false,
        displayName: name || undefined
      });
      
      console.log(`   ✅ Created Auth account for ${email}`);
      result.created.push(email);
    } catch (error: any) {
      console.error(`   ❌ Failed to create account for ${email}:`, error.message);
      result.errors.push({ email, error: error.message });
    }
  }

  return result;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const passwordArg = args.find(a => a.startsWith('--password='));
  const password = passwordArg ? passwordArg.split('=')[1] : DEFAULT_PASSWORD;

  try {
    const result = await syncAllUsersToAuth(dryRun, password);

    console.log('\n' + '='.repeat(60));
    console.log('                     SYNC RESULTS');
    console.log('='.repeat(60));
    
    console.log(`\n✅ Auth accounts created: ${result.created.length}`);
    if (result.created.length > 0) {
      result.created.forEach(email => console.log(`   - ${email}`));
    }

    console.log(`\n⏭️  Skipped (already synced or no email): ${result.skipped.length}`);
    
    if (result.errors.length > 0) {
      console.log(`\n❌ Errors: ${result.errors.length}`);
      result.errors.forEach(({ email, error }) => console.log(`   - ${email}: ${error}`));
    }

    console.log('\n' + '='.repeat(60));

    if (dryRun && result.created.length > 0) {
      console.log(`\n⚠️  DRY RUN - No changes made. Run without --dry-run to apply changes.`);
      console.log(`   Users that would be created: ${result.created.length}`);
      console.log(`   Default password: ${password}`);
    } else if (result.created.length > 0) {
      console.log(`\n✅ Successfully created ${result.created.length} Auth accounts.`);
      console.log(`   Default password for all: ${password}`);
      console.log(`   Users should change their password after first login.`);
    } else {
      console.log(`\n✅ All users are already synced!`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Sync failed:', error);
    process.exit(1);
  }
}

main();
