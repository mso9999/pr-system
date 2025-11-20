/**
 * Cleanup Non-Company Users Script
 * Deletes all users that do not have 1pwrafrica.com as their email domain
 */

import * as admin from 'firebase-admin';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';

// Load environment variables
config();

// Initialize Firebase Admin SDK
// Try to read from environment variable first, then from file
let serviceAccount;
const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

if (serviceAccountKey) {
  try {
    // Handle escaped newlines in the JSON string
    const cleanedKey = serviceAccountKey
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"');
    serviceAccount = JSON.parse(cleanedKey);
  } catch (error) {
    console.error('❌ Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY from environment:', error);
    process.exit(1);
  }
} else {
  // Try to read from file (for local development)
  const serviceAccountPath = join(process.cwd(), 'firebase-service-account.json');
  try {
    serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
  } catch (error) {
    // Try temp file as fallback
    try {
      serviceAccount = JSON.parse(readFileSync('/tmp/firebase-service-account.json', 'utf8'));
    } catch (tempError) {
      console.error('❌ Could not load service account. Please set FIREBASE_SERVICE_ACCOUNT_KEY or provide firebase-service-account.json');
      process.exit(1);
    }
  }
}

const app = initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore(app);

const CORRECT_DOMAIN = '1pwrafrica.com';

/**
 * Check if email has the correct company domain
 */
function hasCorrectDomain(email: string): boolean {
  if (!email || !email.includes('@')) return false;
  const domain = email.split('@')[1].toLowerCase().trim();
  return domain === CORRECT_DOMAIN;
}

/**
 * Main cleanup function
 */
async function cleanupNonCompanyUsers() {
  try {
    console.log('🔐 Initializing Firebase Admin SDK...');
    console.log('✅ Authentication successful (Admin SDK)');

    console.log('🔍 Loading all users...');
    const usersRef = db.collection('users');
    const snapshot = await usersRef.get();
    
    const allUsers: Array<{ id: string; email: string; isActive: boolean; name?: string }> = [];
    const usersToDelete: Array<{ id: string; email: string; domain: string }> = [];
    
    snapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      const email = data.email;
      if (email && typeof email === 'string') {
        const domain = email.split('@')[1]?.toLowerCase().trim() || '';
        const hasCorrect = hasCorrectDomain(email);
        
        allUsers.push({
          id: docSnapshot.id,
          email: email,
          isActive: data.isActive !== false,
          name: data.name || `${data.firstName || ''} ${data.lastName || ''}`.trim()
        });
        
        if (!hasCorrect) {
          usersToDelete.push({
            id: docSnapshot.id,
            email: email,
            domain: domain
          });
        }
      }
    });
    
    console.log(`📊 Loaded ${allUsers.length} total users`);
    console.log(`📊 Users with correct domain (${CORRECT_DOMAIN}): ${allUsers.length - usersToDelete.length}`);
    console.log(`📊 Users with other domains: ${usersToDelete.length}`);
    
    if (usersToDelete.length === 0) {
      console.log('\n✅ All users have the correct domain. Nothing to clean up.');
      process.exit(0);
    }
    
    // Group by domain for summary
    const domainGroups = new Map<string, number>();
    usersToDelete.forEach(user => {
      const count = domainGroups.get(user.domain) || 0;
      domainGroups.set(user.domain, count + 1);
    });
    
    console.log('\n📋 Users to be deleted by domain:');
    Array.from(domainGroups.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([domain, count]) => {
        console.log(`   ${domain}: ${count} user(s)`);
      });
    
    // Show preview
    console.log('\n📋 Sample users to be deleted (first 20):');
    usersToDelete.slice(0, 20).forEach(user => {
      const userData = allUsers.find(u => u.id === user.id);
      console.log(`  - ${user.id} (${user.email}) - ${userData?.name || 'No name'} - Domain: ${user.domain}`);
    });
    if (usersToDelete.length > 20) {
      console.log(`  ... and ${usersToDelete.length - 20} more`);
    }
    
    // Confirm deletion
    console.log(`\n⚠️  About to delete ${usersToDelete.length} user(s) with non-company domains.`);
    console.log('   This action cannot be undone.');
    
    let deletedCount = 0;
    let errorCount = 0;
    
    for (const user of usersToDelete) {
      try {
        await db.collection('users').doc(user.id).delete();
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
    console.log(`   Remaining users with ${CORRECT_DOMAIN}: ${allUsers.length - deletedCount}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }
}

// Run cleanup
cleanupNonCompanyUsers();

