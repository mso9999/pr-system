/**
 * Delete Test PR Script
 * Deletes a specific PR by ID (H3cQplynU4vKuTJ6qAvs)
 * 
 * Usage:
 *   npm run delete-test-pr
 * 
 * Requires FIREBASE_AUTH_EMAIL and FIREBASE_AUTH_PASSWORD in .env file
 * Or set them as environment variables
 */

import { config } from 'dotenv';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, getDoc, deleteDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

// Load environment variables from .env file
config();

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || 'AIzaSyD0tA1fvWs5dCr-7JqJv_bxlay2Bhs72jQ',
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || 'pr-system-4ea55.firebaseapp.com',
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'pr-system-4ea55',
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || 'pr-system-4ea55.firebasestorage.app',
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '562987209098',
  appId: process.env.VITE_FIREBASE_APP_ID || '1:562987209098:web:2f788d189f1c0867cb3873',
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);
const PR_COLLECTION = 'purchaseRequests';
const PR_ID = 'H3cQplynU4vKuTJ6qAvs';

async function deleteTestPR() {
  try {
    // Authenticate with Firebase
    const auth = getAuth(app);
    const email = process.env.FIREBASE_AUTH_EMAIL || process.env.VITE_TEST_EMAIL;
    const password = process.env.FIREBASE_AUTH_PASSWORD || process.env.VITE_TEST_PASSWORD;
    
    if (!email || !password) {
      console.error('❌ Authentication credentials not found.');
      console.log('\nPlease set one of the following in your .env file:');
      console.log('  FIREBASE_AUTH_EMAIL=your-email@1pwrafrica.com');
      console.log('  FIREBASE_AUTH_PASSWORD=your-password');
      console.log('\nOr use:');
      console.log('  VITE_TEST_EMAIL=your-email@1pwrafrica.com');
      console.log('  VITE_TEST_PASSWORD=your-password');
      process.exit(1);
    }
    
    console.log('🔐 Authenticating with Firebase...');
    console.log(`   Email: ${email}`);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      console.log('✅ Authentication successful');
    } catch (authError: any) {
      console.error('❌ Authentication failed:', authError.message);
      console.log('\nPlease check your credentials in .env file.');
      process.exit(1);
    }

    console.log(`\n🗑️  Attempting to delete PR: ${PR_ID}`);
    
    // First, check if the PR exists
    const prRef = doc(db, PR_COLLECTION, PR_ID);
    const prDoc = await getDoc(prRef);
    
    if (!prDoc.exists()) {
      console.log(`❌ PR ${PR_ID} not found in database.`);
      process.exit(1);
    }

    const prData = prDoc.data();
    console.log(`📋 Found PR:`, {
      id: PR_ID,
      prNumber: prData?.prNumber || 'N/A',
      status: prData?.status || 'N/A',
      organization: prData?.organization || 'N/A',
      description: prData?.description?.substring(0, 50) || 'N/A'
    });

    // Delete the PR
    await deleteDoc(prRef);
    
    console.log(`\n✅ Successfully deleted PR ${PR_ID}`);
    console.log(`   PR Number: ${prData?.prNumber || 'N/A'}`);
    console.log(`   Status: ${prData?.status || 'N/A'}`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Delete failed:', error);
    process.exit(1);
  }
}

deleteTestPR();

deleteTestPR();

