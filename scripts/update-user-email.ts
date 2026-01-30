/**
 * Update User Email Script
 * Updates a user's email in both Firebase Auth and Firestore
 * 
 * Usage: npx ts-node scripts/update-user-email.ts <user-id-or-current-email> <new-email>
 */

import * as admin from 'firebase-admin';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { readFileSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';

config();

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

async function findUser(identifier: string): Promise<{ id: string; data: any } | null> {
  // First try to find by document ID
  const docById = await db.collection('users').doc(identifier).get();
  if (docById.exists) {
    return { id: docById.id, data: docById.data() };
  }

  // Try to find by email
  const byEmail = await db.collection('users')
    .where('email', '==', identifier.toLowerCase().trim())
    .get();
  
  if (!byEmail.empty) {
    const doc = byEmail.docs[0];
    return { id: doc.id, data: doc.data() };
  }

  // Try case-insensitive email search
  const allUsers = await db.collection('users').get();
  for (const doc of allUsers.docs) {
    const userData = doc.data();
    if (userData.email?.toLowerCase().trim() === identifier.toLowerCase().trim()) {
      return { id: doc.id, data: userData };
    }
  }

  return null;
}

async function updateUserEmail(identifier: string, newEmail: string) {
  const cleanNewEmail = newEmail.trim().toLowerCase();
  
  console.log('🔍 Finding user...');
  const user = await findUser(identifier);
  
  if (!user) {
    console.error(`❌ User not found: ${identifier}`);
    process.exit(1);
  }

  console.log('✅ Found user:');
  console.log(`   ID: ${user.id}`);
  console.log(`   Current Email: ${user.data.email}`);
  console.log(`   Name: ${user.data.firstName} ${user.data.lastName}`);
  console.log(`   New Email: ${cleanNewEmail}`);
  console.log('');

  if (user.data.email?.toLowerCase().trim() === cleanNewEmail) {
    console.log('⚠️  Email is already the same. No changes needed.');
    process.exit(0);
  }

  // Check if new email is already in use
  const existingByEmail = await findUser(cleanNewEmail);
  if (existingByEmail && existingByEmail.id !== user.id) {
    console.error(`❌ Email ${cleanNewEmail} is already in use by user: ${existingByEmail.id}`);
    process.exit(1);
  }

  // Update Firebase Auth
  console.log('🔐 Updating Firebase Auth...');
  let authUserExists = true;
  try {
    await auth.getUser(user.id);
  } catch (error: any) {
    if (error.code === 'auth/user-not-found') {
      authUserExists = false;
    } else {
      throw error;
    }
  }

  if (authUserExists) {
    await auth.updateUser(user.id, { email: cleanNewEmail });
    console.log('   ✅ Updated email in Firebase Auth');
  } else {
    // Create Auth account with new email
    const displayName = `${user.data.firstName || ''} ${user.data.lastName || ''}`.trim();
    await auth.createUser({
      uid: user.id,
      email: cleanNewEmail,
      emailVerified: false,
      disabled: false,
      displayName: displayName || undefined
    });
    console.log('   ✅ Created new Auth account with new email');
    console.log('   ⚠️  Password needs to be set for this user!');
  }

  // Update Firestore
  console.log('📁 Updating Firestore...');
  await db.collection('users').doc(user.id).update({
    email: cleanNewEmail,
    updatedAt: new Date().toISOString()
  });
  console.log('   ✅ Updated email in Firestore');

  console.log('');
  console.log('✅ Email update complete!');
  console.log(`   Old email: ${user.data.email}`);
  console.log(`   New email: ${cleanNewEmail}`);

  process.exit(0);
}

// Get arguments
const args = process.argv.slice(2);
if (args.length < 2) {
  console.log('Usage: npx ts-node scripts/update-user-email.ts <user-id-or-current-email> <new-email>');
  console.log('');
  console.log('Example: npx ts-node scripts/update-user-email.ts motlatsi.manka@1pwrafrica.com motlatsi@1pwrafrica.com');
  process.exit(1);
}

const [identifier, newEmail] = args;
updateUserEmail(identifier, newEmail);
