import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';

// Initialize environment variables
config();

// Load service account - try multiple possible locations
let serviceAccount: any;
const possiblePaths = [
  join(__dirname, '../firebase-service-account.json'),
  join(__dirname, '../firebase-credentials.json'),
  process.env.FIREBASE_SERVICE_ACCOUNT ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT) : null
];

for (const path of possiblePaths) {
  if (!path) continue;
  try {
    if (typeof path === 'string') {
      serviceAccount = JSON.parse(readFileSync(path, 'utf8'));
      console.log(`Loaded service account from: ${path}`);
      break;
    } else {
      serviceAccount = path;
      console.log('Loaded service account from environment variable');
      break;
    }
  } catch (error) {
    // Continue to next path
  }
}

// Initialize Firebase Admin - try service account first, then application default credentials
let app: any;
if (serviceAccount) {
  app = initializeApp({
    credential: cert(serviceAccount)
  });
} else {
  // Try application default credentials (from Firebase CLI or GCP)
  // Need to specify project ID
  const projectId = process.env.FIREBASE_PROJECT_ID || 'pr-system-1pwrafrica';
  try {
    app = initializeApp({
      projectId: projectId
    });
    console.log(`Using Firebase application default credentials for project: ${projectId}`);
  } catch (error: any) {
    console.error('❌ Error: Could not find Firebase service account file or application default credentials.');
    console.error('Please ensure one of the following:');
    console.error('  - firebase-service-account.json (in project root)');
    console.error('  - firebase-credentials.json (in project root)');
    console.error('  - FIREBASE_SERVICE_ACCOUNT environment variable');
    console.error('  - Firebase CLI authentication (run: firebase login)');
    process.exit(1);
  }
}

const db = getFirestore(app);

// Source organization (1PWR Lesotho)
const SOURCE_ORG_ID = '1pwr_lesotho';
const SOURCE_ORG_NAME = '1PWR LESOTHO';

// Target Lesotho organizations
const TARGET_ORGS = [
  { id: 'pueco_lesotho', name: 'PUECO LESOTHO' },
  { id: 'neo1', name: 'NEO1' },
  { id: 'smp', name: 'SMP' }
];

// Reference data types to copy
const REFERENCE_DATA_TYPES = [
  'departments',
  'projectCategories',
  'sites',
  'vehicles',
  'expenseTypes'
];

interface ReferenceDataItem {
  id: string;
  name: string;
  code?: string;
  organizationId?: string;
  organization?: string;
  active?: boolean;
  [key: string]: any;
}

async function copyReferenceData() {
  try {
    console.log(`\n=== Copying Reference Data from ${SOURCE_ORG_NAME} ===`);
    console.log(`Source Organization: ${SOURCE_ORG_ID}`);
    console.log(`Target Organizations: ${TARGET_ORGS.map(o => o.name).join(', ')}\n`);

    let totalCopied = 0;

    for (const dataType of REFERENCE_DATA_TYPES) {
      const collectionName = `referenceData_${dataType}`;
      console.log(`\n📋 Processing ${dataType}...`);

      // Fetch all items from source organization
      const sourceQuery = db.collection(collectionName)
        .where('organizationId', '==', SOURCE_ORG_ID);
      
      const sourceSnapshot = await sourceQuery.get();
      
      if (sourceSnapshot.empty) {
        console.log(`  ⚠️  No ${dataType} found for ${SOURCE_ORG_NAME}`);
        continue;
      }

      console.log(`  Found ${sourceSnapshot.size} ${dataType} in ${SOURCE_ORG_NAME}`);

      // Process each target organization
      for (const targetOrg of TARGET_ORGS) {
        console.log(`  → Copying to ${targetOrg.name}...`);

        const batch = db.batch();
        let itemCount = 0;

        sourceSnapshot.forEach((doc) => {
          const sourceData = doc.data() as ReferenceDataItem;
          
          // Create new document ID: original_id_target_org_id
          const newId = `${doc.id}_${targetOrg.id}`;
          
          // Create new document data
          const newData: any = {
            ...sourceData,
            id: newId,
            organizationId: targetOrg.id,
            organization: targetOrg.name
          };

          // Remove the old ID if it exists
          delete newData.oldId;

          const newDocRef = db.collection(collectionName).doc(newId);
          batch.set(newDocRef, newData);
          itemCount++;
        });

        // Commit batch
        if (itemCount > 0) {
          await batch.commit();
          console.log(`    ✅ Copied ${itemCount} ${dataType} to ${targetOrg.name}`);
          totalCopied += itemCount;
        } else {
          console.log(`    ⚠️  No items to copy for ${targetOrg.name}`);
        }
      }
    }

    console.log(`\n✅ Successfully copied ${totalCopied} reference data items`);
    console.log(`   From: ${SOURCE_ORG_NAME} (${SOURCE_ORG_ID})`);
    console.log(`   To: ${TARGET_ORGS.map(o => o.name).join(', ')}`);
    console.log(`   Types: ${REFERENCE_DATA_TYPES.join(', ')}`);

    process.exit(0);

  } catch (error) {
    console.error('❌ Error copying reference data:', error);
    process.exit(1);
  }
}

// Run the copy
copyReferenceData();

