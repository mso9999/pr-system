/**
 * Clear Archive PRs from Firestore
 * One-time script to delete all archived PRs before re-import
 */

import { config } from 'dotenv';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

// Load environment variables from .env file
config();

// Firebase configuration
const firebaseConfig = {
  apiKey: 'AIzaSyD0tA1fvWs5dCr-7JqJv_bxlay2Bhs72jQ',
  authDomain: 'pr-system-4ea55.firebaseapp.com',
  projectId: 'pr-system-4ea55',
  storageBucket: 'pr-system-4ea55.firebasestorage.app',
  messagingSenderId: '562987209098',
  appId: '1:562987209098:web:2f788d189f1c0867cb3873',
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

/**
 * Clear all archive PRs
 */
async function clearArchive() {
  try {
    // Authenticate with Firebase
    const auth = getAuth(app);
    const email = process.env.FIREBASE_AUTH_EMAIL || process.env.VITE_TEST_EMAIL || 'mso@1pwrafrica.com';
    const password = process.env.FIREBASE_AUTH_PASSWORD || process.env.VITE_TEST_PASSWORD || '1PWR00';
    
    console.log('🔐 Authenticating with Firebase...');
    try {
      await signInWithEmailAndPassword(auth, email, password);
      console.log('✅ Authentication successful');
    } catch (authError: any) {
      console.error('❌ Authentication failed:', authError.message);
      console.log('   Please check your credentials.');
      process.exit(1);
    }

    console.log('🗑️  Fetching all archive PRs...');
    const archiveRef = collection(db, 'archivePRs');
    const snapshot = await getDocs(archiveRef);
    
    console.log(`📊 Found ${snapshot.size} documents to delete`);
    
    let deletedCount = 0;
    let errorCount = 0;
    
    for (const docSnapshot of snapshot.docs) {
      try {
        await deleteDoc(doc(db, 'archivePRs', docSnapshot.id));
        deletedCount++;
        if (deletedCount % 100 === 0) {
          console.log(`  ✅ Deleted ${deletedCount} documents...`);
        }
      } catch (error) {
        errorCount++;
        console.error(`  ❌ Error deleting document ${docSnapshot.id}:`, error);
      }
    }

    console.log('\n✅ Clear complete!');
    console.log(`   Successfully deleted: ${deletedCount} documents`);
    console.log(`   Errors: ${errorCount} documents`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Clear failed:', error);
    process.exit(1);
  }
}

// Run clear
clearArchive();

