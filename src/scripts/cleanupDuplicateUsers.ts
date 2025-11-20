/**
 * Cleanup Duplicate and Misspelled Domain Users Script
 * Removes:
 * 1. Inactive duplicate users (same email, different casing)
 * 2. Users with misspelled domains (typos of 1pwrafrica.com)
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

const CORRECT_DOMAIN = '1pwrafrica.com';

/**
 * Extract username and domain from email
 */
function parseEmail(email: string): { username: string; domain: string } | null {
  if (!email || !email.includes('@')) return null;
  const parts = email.split('@');
  return {
    username: parts[0].toLowerCase(),
    domain: parts[1].toLowerCase()
  };
}

/**
 * Check if domain is a misspelling of 1pwrafrica.com
 */
function isMisspelledDomain(domain: string): boolean {
  if (!domain) return false;
  const normalized = domain.toLowerCase().trim();
  
  // Exact match is correct
  if (normalized === CORRECT_DOMAIN) return false;
  
  // Common misspellings patterns
  const misspellingPatterns = [
    /^1[a-z]*africa\.com$/i,  // 1africa.com, 1perafrica.com, etc.
    /^1pwr[a-z]*africa\.com$/i,  // 1pwrafrca.com, 1pwrafrfica.com, etc.
    /^1pw[a-z]*africa\.com$/i,  // 1pwafrica.com, 1pwrfrica.com, etc.
    /^1[a-z]*pwrafrica\.com$/i,  // 1ppwrafrica.com, etc.
    /^1pwrafrica\.[a-z]+$/i,  // 1pwrafrica.con, 1pwrafrica.om, etc.
    /^[a-z]*pwrafrica\.com$/i,  // pwrafrica.com (missing 1)
  ];
  
  return misspellingPatterns.some(pattern => pattern.test(normalized));
}

/**
 * Find duplicate users (same email, different casing or variations)
 */
function findDuplicates(users: Array<{ id: string; email: string; isActive: boolean }>): Map<string, Array<{ id: string; email: string; isActive: boolean }>> {
  const emailMap = new Map<string, Array<{ id: string; email: string; isActive: boolean }>>();
  
  users.forEach(user => {
    const normalized = user.email.toLowerCase().trim();
    if (!emailMap.has(normalized)) {
      emailMap.set(normalized, []);
    }
    emailMap.get(normalized)!.push(user);
  });
  
  // Only return entries with duplicates
  const duplicates = new Map<string, Array<{ id: string; email: string; isActive: boolean }>>();
  emailMap.forEach((userList, email) => {
    if (userList.length > 1) {
      duplicates.set(email, userList);
    }
  });
  
  return duplicates;
}

/**
 * Main cleanup function
 */
async function cleanupDuplicateUsers() {
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

    console.log('🔍 Loading all users...');
    const usersRef = collection(db, 'users');
    const snapshot = await getDocs(usersRef);
    
    const allUsers: Array<{ id: string; email: string; isActive: boolean; data: any }> = [];
    
    snapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      const email = data.email;
      if (email && typeof email === 'string') {
        allUsers.push({
          id: docSnapshot.id,
          email: email,
          isActive: data.isActive !== false,
          data: data
        });
      }
    });
    
    console.log(`📊 Loaded ${allUsers.length} users`);
    
    // Find users with misspelled domains
    console.log('\n🔍 Finding users with misspelled domains...');
    const misspelledDomainUsers: Array<{ id: string; email: string; domain: string; isActive: boolean }> = [];
    
    allUsers.forEach(user => {
      const parsed = parseEmail(user.email);
      if (parsed && isMisspelledDomain(parsed.domain)) {
        misspelledDomainUsers.push({
          id: user.id,
          email: user.email,
          domain: parsed.domain,
          isActive: user.isActive
        });
      }
    });
    
    console.log(`📊 Found ${misspelledDomainUsers.length} users with misspelled domains`);
    
    // Find duplicate users
    console.log('\n🔍 Finding duplicate users...');
    const duplicates = findDuplicates(allUsers.map(u => ({ id: u.id, email: u.email, isActive: u.isActive })));
    console.log(`📊 Found ${duplicates.size} email addresses with duplicates`);
    
    // Collect users to delete
    const usersToDelete: Array<{ id: string; email: string; reason: string }> = [];
    
    // Add misspelled domain users (prioritize inactive ones, but delete all)
    misspelledDomainUsers.forEach(user => {
      usersToDelete.push({
        id: user.id,
        email: user.email,
        reason: `Misspelled domain: ${user.domain}`
      });
    });
    
    // Add inactive duplicates (keep active ones)
    duplicates.forEach((userList, normalizedEmail) => {
      const activeUsers = userList.filter(u => u.isActive);
      const inactiveUsers = userList.filter(u => !u.isActive);
      
      // If there are active users, delete all inactive duplicates
      if (activeUsers.length > 0 && inactiveUsers.length > 0) {
        inactiveUsers.forEach(user => {
          usersToDelete.push({
            id: user.id,
            email: user.email,
            reason: `Inactive duplicate of active user: ${normalizedEmail}`
          });
        });
      } else if (userList.length > 1) {
        // All are inactive or mixed, keep the first one, delete the rest
        const sorted = userList.sort((a, b) => {
          // Prefer active over inactive
          if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
          // Prefer shorter IDs (likely older/legacy)
          return a.id.length - b.id.length;
        });
        
        // Keep the first one, delete the rest
        for (let i = 1; i < sorted.length; i++) {
          usersToDelete.push({
            id: sorted[i].id,
            email: sorted[i].email,
            reason: `Duplicate user (keeping: ${sorted[0].email})`
          });
        }
      }
    });
    
    // Remove duplicates from deletion list (same user might be in both categories)
    const uniqueToDelete = new Map<string, { id: string; email: string; reason: string }>();
    usersToDelete.forEach(user => {
      if (!uniqueToDelete.has(user.id)) {
        uniqueToDelete.set(user.id, user);
      } else {
        // Merge reasons
        const existing = uniqueToDelete.get(user.id)!;
        existing.reason += `; ${user.reason}`;
      }
    });
    
    const finalDeleteList = Array.from(uniqueToDelete.values());
    
    console.log(`\n📋 Summary:`);
    console.log(`   Users with misspelled domains: ${misspelledDomainUsers.length}`);
    console.log(`   Duplicate email addresses: ${duplicates.size}`);
    console.log(`   Total users to delete: ${finalDeleteList.length}`);
    
    if (finalDeleteList.length === 0) {
      console.log('\n✅ No duplicate or misspelled domain users found. Nothing to clean up.');
      process.exit(0);
    }
    
    // Show preview
    console.log('\n📋 Users to be deleted (first 20):');
    finalDeleteList.slice(0, 20).forEach(user => {
      console.log(`  - ${user.id} (${user.email}) - ${user.reason}`);
    });
    if (finalDeleteList.length > 20) {
      console.log(`  ... and ${finalDeleteList.length - 20} more`);
    }
    
    // Confirm deletion
    console.log(`\n⚠️  About to delete ${finalDeleteList.length} user(s).`);
    console.log('   This action cannot be undone.');
    
    let deletedCount = 0;
    let errorCount = 0;
    
    for (const user of finalDeleteList) {
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
cleanupDuplicateUsers();

