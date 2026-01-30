/**
 * Fix User Auth Script
 * Diagnoses and fixes users who exist in Firestore but not in Firebase Auth
 * 
 * Usage: npx ts-node scripts/fix-user-auth.ts <email> [password]
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

const DEFAULT_PASSWORD = '1PWR2024!';

async function fixUserAuth(targetEmail: string, newPassword?: string) {
  const password = newPassword || DEFAULT_PASSWORD;
  const normalizedEmail = targetEmail.trim().toLowerCase();
  
  console.log('🔍 Checking user:', normalizedEmail);
  console.log('');
  
  // Step 1: Find user in Firestore
  console.log('📁 Step 1: Checking Firestore...');
  const usersSnapshot = await db.collection('users')
    .where('email', '==', normalizedEmail)
    .get();
  
  if (usersSnapshot.empty) {
    // Also try with original case
    const usersSnapshot2 = await db.collection('users')
      .where('email', '==', targetEmail)
      .get();
    
    if (usersSnapshot2.empty) {
      console.error('❌ User not found in Firestore with email:', normalizedEmail);
      console.log('');
      console.log('Searching for similar emails...');
      
      // Search for similar emails
      const allUsers = await db.collection('users').get();
      const similar = allUsers.docs.filter(doc => {
        const email = doc.data().email?.toLowerCase() || '';
        return email.includes('motlatsi') || email.includes('1pwrafrica');
      });
      
      if (similar.length > 0) {
        console.log('Found similar users:');
        similar.forEach(doc => {
          const data = doc.data();
          console.log(`  - ${data.email} (ID: ${doc.id})`);
        });
      }
      
      process.exit(1);
    }
  }
  
  const firestoreDoc = usersSnapshot.docs[0] || (await db.collection('users').where('email', '==', targetEmail).get()).docs[0];
  const firestoreData = firestoreDoc.data();
  const firestoreUserId = firestoreDoc.id;
  
  console.log('✅ Found user in Firestore:');
  console.log(`   Document ID: ${firestoreUserId}`);
  console.log(`   Email: ${firestoreData.email}`);
  console.log(`   Name: ${firestoreData.firstName} ${firestoreData.lastName}`);
  console.log(`   Organization: ${firestoreData.organization}`);
  console.log(`   Permission Level: ${firestoreData.permissionLevel}`);
  console.log(`   Is Active: ${firestoreData.isActive}`);
  console.log('');
  
  // Step 2: Check Firebase Auth
  console.log('🔐 Step 2: Checking Firebase Auth...');
  
  let authUser = null;
  let authExistsByEmail = false;
  let authExistsByUid = false;
  
  // Check by UID first
  try {
    authUser = await auth.getUser(firestoreUserId);
    authExistsByUid = true;
    console.log('✅ Found user in Firebase Auth by UID:');
    console.log(`   UID: ${authUser.uid}`);
    console.log(`   Email: ${authUser.email}`);
    console.log(`   Email Verified: ${authUser.emailVerified}`);
    console.log(`   Disabled: ${authUser.disabled}`);
    console.log(`   Created: ${authUser.metadata.creationTime}`);
    console.log(`   Last Sign In: ${authUser.metadata.lastSignInTime || 'Never'}`);
  } catch (error: any) {
    if (error.code === 'auth/user-not-found') {
      console.log('⚠️  User NOT found in Firebase Auth by UID');
    } else {
      console.error('❌ Error checking Auth by UID:', error.message);
    }
  }
  
  // Also check by email
  if (!authExistsByUid) {
    try {
      authUser = await auth.getUserByEmail(normalizedEmail);
      authExistsByEmail = true;
      console.log('⚠️  Found user in Firebase Auth by EMAIL (but different UID!):');
      console.log(`   Auth UID: ${authUser.uid}`);
      console.log(`   Firestore UID: ${firestoreUserId}`);
      console.log(`   Email: ${authUser.email}`);
      console.log('');
      console.log('🔧 This is a UID mismatch! The Auth account exists but with a different UID.');
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        console.log('⚠️  User NOT found in Firebase Auth by email either');
      } else {
        console.error('❌ Error checking Auth by email:', error.message);
      }
    }
  }
  
  console.log('');
  
  // Step 3: Fix the issue
  console.log('🔧 Step 3: Fixing the issue...');
  
  if (authExistsByUid) {
    // User exists with correct UID - just update password
    console.log('User exists in Auth with correct UID. Updating password...');
    try {
      await auth.updateUser(firestoreUserId, { 
        password: password,
        disabled: false  // Ensure account is not disabled
      });
      console.log('✅ Password updated successfully!');
      console.log(`   New password: ${password}`);
    } catch (error: any) {
      console.error('❌ Failed to update password:', error.message);
      process.exit(1);
    }
  } else if (authExistsByEmail && authUser) {
    // User exists with different UID - need to delete and recreate
    console.log('User exists with mismatched UID. Deleting and recreating...');
    try {
      await auth.deleteUser(authUser.uid);
      console.log('✅ Deleted old Auth account');
      
      const newAuthUser = await auth.createUser({
        uid: firestoreUserId,
        email: normalizedEmail,
        emailVerified: false,
        password: password,
        disabled: false
      });
      console.log('✅ Created new Auth account with correct UID');
      console.log(`   UID: ${newAuthUser.uid}`);
      console.log(`   Password: ${password}`);
    } catch (error: any) {
      console.error('❌ Failed to recreate user:', error.message);
      process.exit(1);
    }
  } else {
    // User doesn't exist in Auth at all - create them
    console.log('User does not exist in Firebase Auth. Creating...');
    try {
      const newAuthUser = await auth.createUser({
        uid: firestoreUserId,
        email: normalizedEmail,
        emailVerified: false,
        password: password,
        disabled: false
      });
      console.log('✅ Created new Auth account');
      console.log(`   UID: ${newAuthUser.uid}`);
      console.log(`   Email: ${newAuthUser.email}`);
      console.log(`   Password: ${password}`);
    } catch (error: any) {
      console.error('❌ Failed to create user:', error.message);
      process.exit(1);
    }
  }
  
  console.log('');
  console.log('✅ Done! User should now be able to log in with:');
  console.log(`   Email: ${normalizedEmail}`);
  console.log(`   Password: ${password}`);
  
  process.exit(0);
}

// Get email from command line arguments
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Usage: npx ts-node scripts/fix-user-auth.ts <email> [password]');
  console.log('');
  console.log('Example: npx ts-node scripts/fix-user-auth.ts motlatsi@1pwrafrica.com MyNewPassword123');
  process.exit(1);
}

const targetEmail = args[0];
const customPassword = args[1];

fixUserAuth(targetEmail, customPassword);
