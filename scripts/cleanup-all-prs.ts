/**
 * ONE-TIME CLEANUP SCRIPT
 * 
 * WARNING: This script will DELETE ALL Purchase Requests from Firestore
 * Use only in development/testing environments!
 * 
 * Usage:
 *   npx ts-node scripts/cleanup-all-prs.ts
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as readline from 'readline';

// Initialize Firebase Admin
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || './serviceAccountKey.json';

try {
  const serviceAccount = require(serviceAccountPath);
  
  initializeApp({
    credential: cert(serviceAccount)
  });
  
  console.log('✅ Firebase Admin initialized successfully');
} catch (error) {
  console.error('❌ Error initializing Firebase Admin:', error);
  console.log('\nMake sure you have serviceAccountKey.json in the project root');
  console.log('Or set GOOGLE_APPLICATION_CREDENTIALS environment variable');
  process.exit(1);
}

const db = getFirestore();

// Create readline interface for user confirmation
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function deleteCollection(collectionName: string): Promise<number> {
  const collectionRef = db.collection(collectionName);
  const snapshot = await collectionRef.get();
  
  if (snapshot.empty) {
    console.log(`  ℹ️  Collection '${collectionName}' is already empty`);
    return 0;
  }
  
  console.log(`  🗑️  Deleting ${snapshot.size} documents from '${collectionName}'...`);
  
  const batchSize = 500;
  let deletedCount = 0;
  
  while (true) {
    const batch = db.batch();
    const docs = await collectionRef.limit(batchSize).get();
    
    if (docs.empty) {
      break;
    }
    
    docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    deletedCount += docs.size;
    
    console.log(`    Deleted ${deletedCount} documents...`);
    
    if (docs.size < batchSize) {
      break;
    }
  }
  
  console.log(`  ✅ Deleted ${deletedCount} documents from '${collectionName}'`);
  return deletedCount;
}

async function cleanupAllPRs() {
  console.log('\n' + '='.repeat(70));
  console.log('  🚨 DESTRUCTIVE OPERATION WARNING 🚨');
  console.log('='.repeat(70));
  console.log('\nThis script will DELETE ALL Purchase Requests and related data:');
  console.log('  • All PRs (purchase requests)');
  console.log('  • All PR notifications (purchaseRequestsNotifications)');
  console.log('  • All notifications (notifications)');
  console.log('\n⚠️  THIS OPERATION CANNOT BE UNDONE! ⚠️\n');
  
  // Check for --confirm flag for non-interactive mode
  const hasConfirmFlag = process.argv.includes('--confirm');
  
  if (hasConfirmFlag) {
    console.log('✅ --confirm flag detected, proceeding with cleanup...\n');
  } else {
    // Get confirmation interactively
    const answer1 = await askQuestion('Are you sure you want to continue? (type "yes" to confirm): ');
    
    if (answer1.toLowerCase() !== 'yes') {
      console.log('\n❌ Operation cancelled');
      rl.close();
      process.exit(0);
    }
    
    const answer2 = await askQuestion('\n⚠️  FINAL CONFIRMATION: Type "DELETE ALL" to proceed: ');
    
    if (answer2 !== 'DELETE ALL') {
      console.log('\n❌ Operation cancelled - incorrect confirmation text');
      rl.close();
      process.exit(0);
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('  Starting cleanup process...');
  console.log('='.repeat(70) + '\n');
  
  const startTime = Date.now();
  let totalDeleted = 0;
  
  try {
    // Delete Purchase Requests
    console.log('1️⃣  Cleaning up Purchase Requests...');
    const prCount = await deleteCollection('purchaseRequests');
    totalDeleted += prCount;
    
    // Delete PR Notifications
    console.log('\n2️⃣  Cleaning up PR Notifications...');
    const prNotifCount = await deleteCollection('purchaseRequestsNotifications');
    totalDeleted += prNotifCount;
    
    // Delete General Notifications
    console.log('\n3️⃣  Cleaning up General Notifications...');
    const notifCount = await deleteCollection('notifications');
    totalDeleted += notifCount;
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log('\n' + '='.repeat(70));
    console.log('  ✅ CLEANUP COMPLETED SUCCESSFULLY');
    console.log('='.repeat(70));
    console.log(`\nSummary:`);
    console.log(`  • Total documents deleted: ${totalDeleted}`);
    console.log(`  • Purchase Requests: ${prCount}`);
    console.log(`  • PR Notifications: ${prNotifCount}`);
    console.log(`  • General Notifications: ${notifCount}`);
    console.log(`  • Time taken: ${duration}s`);
    console.log('\n✨ Database is now clean and ready for fresh testing!\n');
    
  } catch (error) {
    console.error('\n❌ Error during cleanup:', error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run the cleanup
cleanupAllPRs().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

