/**
 * Cleanup Inactive Users Script
 * Removes all inactive users from the user database
 */

import { config } from 'dotenv';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc, query, where } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

// Load environment variables
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
 * Remove all inactive users from the database
 */
async function cleanupInactiveUsers() {
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
      process.exit(1);
    }

    console.log('🔍 Finding inactive users...');
    const usersRef = collection(db, 'users');
    
    // Find users where isActive is false or undefined (treat undefined as inactive)
    const snapshot = await getDocs(usersRef);
    
    const inactiveUsers: Array<{ id: string; email: string; name?: string; isActive?: boolean }> = [];
    
    snapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      const id = docSnapshot.id;
      const isActive = data.isActive !== false; // Default to true if undefined
      
      // Only include users that are explicitly inactive
      if (data.isActive === false) {
        inactiveUsers.push({
          id,
          email: data.email || '',
          name: data.name || `${data.firstName || ''} ${data.lastName || ''}`.trim(),
          isActive: false
        });
      }
    });
    
    console.log(`📊 Found ${inactiveUsers.length} inactive users to delete`);
    
    if (inactiveUsers.length === 0) {
      console.log('✅ No inactive users found. Nothing to clean up.');
      process.exit(0);
    }
    
    // Show preview
    console.log('\n📋 Inactive users to be deleted:');
    inactiveUsers.slice(0, 20).forEach(user => {
      console.log(`  - ${user.id} (${user.email}) - ${user.name || 'No name'}`);
    });
    if (inactiveUsers.length > 20) {
      console.log(`  ... and ${inactiveUsers.length - 20} more`);
    }
    
    // Confirm deletion
    console.log(`\n⚠️  About to delete ${inactiveUsers.length} inactive user(s).`);
    console.log('   This action cannot be undone.');
    
    let deletedCount = 0;
    let errorCount = 0;
    
    for (const user of inactiveUsers) {
      try {
        await deleteDoc(doc(db, 'users', user.id));
        deletedCount++;
        if (deletedCount % 50 === 0) {
          console.log(`  ✅ Deleted ${deletedCount} users...`);
        }
      } catch (error) {
        errorCount++;
        console.error(`  ❌ Error deleting user ${user.id}:`, error);
      }
    }

    console.log('\n✅ Cleanup complete!');
    console.log(`   Successfully deleted: ${deletedCount} users`);
    console.log(`   Errors: ${errorCount} users`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }
}

// Run cleanup
cleanupInactiveUsers();

