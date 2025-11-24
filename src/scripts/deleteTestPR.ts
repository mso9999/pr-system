/**
 * Delete Test PR Script
 * Deletes a specific PR by ID (H3cQplynU4vKuTJ6qAvs)
 * 
 * Usage:
 *   npm run delete-test-pr
 * 
 * Requires FIREBASE_SERVICE_ACCOUNT_KEY environment variable or firebase-service-account.json file
 */

import { config } from 'dotenv';
import * as admin from 'firebase-admin';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load environment variables from .env file
config();

const PR_COLLECTION = 'purchaseRequests';
const PR_ID = 'H3cQplynU4vKuTJ6qAvs';

async function deleteTestPR() {
  try {
    // Initialize Firebase Admin SDK
    let serviceAccount;
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    
      if (serviceAccountKey) {
        try {
          // Handle escaped newlines in the JSON string
          // First, try parsing as-is (in case it's already valid JSON)
          try {
            serviceAccount = JSON.parse(serviceAccountKey);
          } catch (firstError) {
            // If that fails, try cleaning up escaped characters
            const cleanedKey = serviceAccountKey
              .replace(/\\n/g, '\n')
              .replace(/\\"/g, '"')
              .replace(/\\\\/g, '\\');
            serviceAccount = JSON.parse(cleanedKey);
          }
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
    console.log('✅ Firebase Admin SDK initialized');

    const db = getFirestore(app);
    
    console.log(`\n🗑️  Attempting to delete PR: ${PR_ID}`);
    
    // First, check if the PR exists
    const prRef = db.collection(PR_COLLECTION).doc(PR_ID);
    const prDoc = await prRef.get();
    
    if (!prDoc.exists) {
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
    await prRef.delete();
    
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

