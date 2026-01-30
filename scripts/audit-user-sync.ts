/**
 * Audit User Sync Script
 * Identifies users that exist in Firestore but not in Firebase Auth
 * and vice versa. This helps diagnose CRUD issues in user management.
 * 
 * Usage: npx ts-node scripts/audit-user-sync.ts
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

interface AuditResult {
  firestoreOnly: { id: string; email: string; name: string }[];
  authOnly: { uid: string; email: string }[];
  emailMismatch: { id: string; firestoreEmail: string; authEmail: string }[];
  synced: number;
}

async function getAllAuthUsers(): Promise<Map<string, admin.auth.UserRecord>> {
  const authUsers = new Map<string, admin.auth.UserRecord>();
  let nextPageToken: string | undefined;

  do {
    const listResult = await auth.listUsers(1000, nextPageToken);
    for (const user of listResult.users) {
      authUsers.set(user.uid, user);
    }
    nextPageToken = listResult.pageToken;
  } while (nextPageToken);

  return authUsers;
}

async function auditUserSync(): Promise<AuditResult> {
  console.log('🔍 Starting user sync audit...\n');
  
  const result: AuditResult = {
    firestoreOnly: [],
    authOnly: [],
    emailMismatch: [],
    synced: 0
  };

  // Get all Firestore users
  console.log('📁 Loading Firestore users...');
  const firestoreSnapshot = await db.collection('users').get();
  const firestoreUsers = new Map<string, any>();
  firestoreSnapshot.forEach(doc => {
    firestoreUsers.set(doc.id, { id: doc.id, ...doc.data() });
  });
  console.log(`   Found ${firestoreUsers.size} users in Firestore\n`);

  // Get all Auth users
  console.log('🔐 Loading Firebase Auth users...');
  const authUsers = await getAllAuthUsers();
  console.log(`   Found ${authUsers.size} users in Firebase Auth\n`);

  // Check Firestore users against Auth
  console.log('🔄 Comparing databases...\n');
  
  for (const [uid, userData] of firestoreUsers) {
    const authUser = authUsers.get(uid);
    
    if (!authUser) {
      // User exists in Firestore but not in Auth
      result.firestoreOnly.push({
        id: uid,
        email: userData.email || 'NO EMAIL',
        name: `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'NO NAME'
      });
    } else {
      // Check if emails match
      const firestoreEmail = (userData.email || '').toLowerCase().trim();
      const authEmail = (authUser.email || '').toLowerCase().trim();
      
      if (firestoreEmail && authEmail && firestoreEmail !== authEmail) {
        result.emailMismatch.push({
          id: uid,
          firestoreEmail,
          authEmail
        });
      } else {
        result.synced++;
      }
    }
  }

  // Check for Auth users not in Firestore
  for (const [uid, authUser] of authUsers) {
    if (!firestoreUsers.has(uid)) {
      result.authOnly.push({
        uid,
        email: authUser.email || 'NO EMAIL'
      });
    }
  }

  return result;
}

async function main() {
  try {
    const result = await auditUserSync();

    console.log('=' .repeat(60));
    console.log('                     AUDIT RESULTS');
    console.log('=' .repeat(60));
    
    console.log(`\n✅ Properly synced users: ${result.synced}`);
    
    if (result.firestoreOnly.length > 0) {
      console.log(`\n⚠️  Users in Firestore but NOT in Firebase Auth: ${result.firestoreOnly.length}`);
      console.log('   These users CANNOT log in!\n');
      result.firestoreOnly.forEach(user => {
        console.log(`   - ${user.email} (${user.name}) [ID: ${user.id}]`);
      });
      console.log('\n   FIX: Run "npx ts-node scripts/fix-user-auth.ts <email>" for each user');
    }

    if (result.authOnly.length > 0) {
      console.log(`\n⚠️  Users in Firebase Auth but NOT in Firestore: ${result.authOnly.length}`);
      console.log('   These users can authenticate but won\'t load in the app!\n');
      result.authOnly.forEach(user => {
        console.log(`   - ${user.email} [UID: ${user.uid}]`);
      });
      console.log('\n   FIX: Either delete from Auth or create Firestore document');
    }

    if (result.emailMismatch.length > 0) {
      console.log(`\n⚠️  Users with email mismatch between Firestore and Auth: ${result.emailMismatch.length}`);
      console.log('   These users may have login issues!\n');
      result.emailMismatch.forEach(user => {
        console.log(`   - Firestore: ${user.firestoreEmail} vs Auth: ${user.authEmail} [ID: ${user.id}]`);
      });
      console.log('\n   FIX: Update Firestore email to match Auth email');
    }

    console.log('\n' + '=' .repeat(60));

    if (result.firestoreOnly.length === 0 && result.authOnly.length === 0 && result.emailMismatch.length === 0) {
      console.log('🎉 All users are properly synced!');
    } else {
      console.log(`⚠️  Found ${result.firestoreOnly.length + result.authOnly.length + result.emailMismatch.length} sync issues`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Audit failed:', error);
    process.exit(1);
  }
}

main();
