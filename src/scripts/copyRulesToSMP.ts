import { config } from 'dotenv';
import type { ServiceAccount } from 'firebase-admin';
import { initializeApp, cert, getApp, getApps, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load environment variables
config();

let cachedApp: App | null = null;

async function initializeAdmin() {
  if (cachedApp) {
    return cachedApp;
  }
  const existingApps = getApps();
  if (existingApps.length) {
    cachedApp = getApp();
    return cachedApp;
  }

  let serviceAccount: Record<string, unknown> | undefined;
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (serviceAccountKey) {
    try {
      try {
        serviceAccount = JSON.parse(serviceAccountKey);
      } catch {
        const cleanedKey = serviceAccountKey
          .replace(/\\n/g, '\n')
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, '\\');
        serviceAccount = JSON.parse(cleanedKey);
      }
    } catch (error) {
      console.error('❌ Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:', error);
      process.exit(1);
    }
  } else {
    const serviceAccountPath = join(process.cwd(), 'firebase-service-account.json');
    try {
      serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
    } catch {
      try {
        serviceAccount = JSON.parse(readFileSync('/tmp/firebase-service-account.json', 'utf8'));
      } catch (tempError) {
        console.error('❌ Could not load service account. Set FIREBASE_SERVICE_ACCOUNT_KEY or add firebase-service-account.json');
        console.error(tempError);
        process.exit(1);
      }
    }
  }

  cachedApp = initializeApp({
    credential: cert(serviceAccount as ServiceAccount),
  });
  return cachedApp;
}

const SOURCE_ORG_ID = '1pwr_lesotho';
const SOURCE_ORG_NAME = '1PWR LESOTHO';
const TARGET_ORG_ID = 'smp';
const TARGET_ORG_NAME = 'Sotho Minigrid Portfolio';

async function copyRulesToSMP() {
  try {
    // Initialize Firebase Admin
    await initializeAdmin();
    console.log('✅ Successfully initialized Firebase Admin');

    const db = getFirestore();
    const rulesRef = db.collection('referenceData_rules');
    
    // Fetch all rules for 1PWR LESOTHO
    console.log(`\n📋 Fetching rules for ${SOURCE_ORG_NAME} (${SOURCE_ORG_ID})...`);
    const sourceSnapshot = await rulesRef.where('organizationId', '==', SOURCE_ORG_ID).get();
    
    if (sourceSnapshot.empty) {
      console.warn(`⚠️  No rules found for ${SOURCE_ORG_NAME}`);
      return;
    }
    
    console.log(`✅ Found ${sourceSnapshot.size} rules for ${SOURCE_ORG_NAME}`);
    
    // Copy each rule to SMP
    const timestamp = new Date().toISOString();
    let copiedCount = 0;
    let updatedCount = 0;
    
    for (const sourceDoc of sourceSnapshot.docs) {
      const sourceData = sourceDoc.data();
      const ruleNumber = sourceData.number;
      
      if (!ruleNumber) {
        console.warn(`⚠️  Skipping rule ${sourceDoc.id} - missing rule number`);
        continue;
      }
      
      // Create target document ID
      const targetDocId = `${TARGET_ORG_ID}_rule_${ruleNumber}`;
      const targetDocRef = rulesRef.doc(targetDocId);
      
      // Check if rule already exists
      const targetDocSnap = await targetDocRef.get();
      const exists = targetDocSnap.exists;
      
      // Prepare rule data for SMP
      const targetRule: Record<string, any> = {
        ...sourceData,
        organizationId: TARGET_ORG_ID,
        organization: TARGET_ORG_NAME,
        updatedAt: timestamp,
        // Preserve createdAt if creating new, otherwise keep existing
        createdAt: exists ? (targetDocSnap.data()?.createdAt || timestamp) : timestamp,
      };
      
      // Remove the document ID from the data (it's in the doc reference)
      delete targetRule.id;
      
      await targetDocRef.set(targetRule);
      
      if (exists) {
        updatedCount++;
        console.log(`  🔄 Updated Rule ${ruleNumber} for ${TARGET_ORG_NAME}`);
      } else {
        copiedCount++;
        console.log(`  ✨ Created Rule ${ruleNumber} for ${TARGET_ORG_NAME}`);
      }
    }
    
    console.log(`\n✅ Successfully copied rules to ${TARGET_ORG_NAME}:`);
    console.log(`   - Created: ${copiedCount} rules`);
    console.log(`   - Updated: ${updatedCount} rules`);
    console.log(`   - Total: ${copiedCount + updatedCount} rules`);
    
  } catch (error) {
    console.error('❌ Error copying rules:', error);
    process.exit(1);
  }
}

// Run the copy operation
copyRulesToSMP().then(() => {
  console.log('\n🎉 Rules copy operation complete');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Rules copy operation failed:', error);
  process.exit(1);
});

