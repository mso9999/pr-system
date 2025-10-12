/**
 * ONE-TIME CLEANUP SCRIPT (Web SDK Version)
 * 
 * WARNING: This script will DELETE ALL Purchase Requests from Firestore
 * Use only in development/testing environments!
 * 
 * This version uses the Firebase Web SDK instead of Admin SDK
 * Run this from the browser console or use the existing Firebase config
 * 
 * Usage:
 *   Copy and paste into browser console when logged into the app
 */

import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../src/config/firebase';

async function deleteCollection(collectionName: string): Promise<number> {
  console.log(`🗑️  Deleting documents from '${collectionName}'...`);
  
  const collectionRef = collection(db, collectionName);
  const snapshot = await getDocs(collectionRef);
  
  if (snapshot.empty) {
    console.log(`  ℹ️  Collection '${collectionName}' is already empty`);
    return 0;
  }
  
  console.log(`  Found ${snapshot.size} documents to delete...`);
  
  let deletedCount = 0;
  const deletePromises: Promise<void>[] = [];
  
  snapshot.forEach((document) => {
    deletePromises.push(deleteDoc(doc(db, collectionName, document.id)));
    deletedCount++;
    
    if (deletedCount % 10 === 0) {
      console.log(`    Queued ${deletedCount} documents for deletion...`);
    }
  });
  
  console.log(`  Executing deletion of ${deletedCount} documents...`);
  await Promise.all(deletePromises);
  
  console.log(`  ✅ Deleted ${deletedCount} documents from '${collectionName}'`);
  return deletedCount;
}

export async function cleanupAllPRsWeb() {
  console.log('\n' + '='.repeat(70));
  console.log('  🚨 DESTRUCTIVE OPERATION 🚨');
  console.log('='.repeat(70));
  console.log('\nDeleting ALL Purchase Requests and related data...\n');
  
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
    
    return {
      success: true,
      totalDeleted,
      breakdown: {
        purchaseRequests: prCount,
        prNotifications: prNotifCount,
        notifications: notifCount
      }
    };
    
  } catch (error) {
    console.error('\n❌ Error during cleanup:', error);
    throw error;
  }
}

// If running directly (not imported)
if (require.main === module) {
  console.log('⚠️  Please run this from the browser console or import it in your app');
  console.log('This script uses the Web SDK and needs to run in a browser environment');
  process.exit(1);
}

