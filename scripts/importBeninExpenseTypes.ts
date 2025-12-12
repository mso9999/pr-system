import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as XLSX from 'xlsx';
import { config } from 'dotenv';

// Initialize environment variables
config();

// Check for dry-run flag first (before requiring Firebase)
const dryRun = process.argv.includes('--dry-run') || process.argv.includes('-d');

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

// Only initialize Firebase if not in dry-run mode
let db: any = null;
if (!dryRun) {
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
      console.error('\nOr run with --dry-run flag to preview without importing.');
      process.exit(1);
    }
  }

  db = getFirestore(app);
}
const COLLECTION_NAME = 'referenceData_expenseTypes';

// Benin organizations
const BENIN_ORGANIZATIONS = [
  { id: '1pwr_benin', name: '1PWR BENIN' },
  { id: 'pueco_benin', name: 'Inclusive/PUECO BENIN' },
  { id: 'mgb', name: 'Mionwa Gen' }
];

interface ExpenseTypeData {
  name: string;
  code: string;
  organizationId: string;
  organization: string;
  active: boolean;
  id: string;
}

async function importBeninExpenseTypes(dryRun: boolean = false) {
  try {
    // Read Excel file
    const excelPath = join(__dirname, '..', 'Accounts - Categories.xlsx');
    console.log(`Reading Excel file: ${excelPath}`);
    
    const workbook = XLSX.readFile(excelPath);
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    console.log(`Reading from sheet: ${firstSheetName}`);
    
    // Convert to JSON - this will give us rows as objects
    // We need to access by column letter, so we'll use the raw cell data
    const data: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    
    console.log(`Total rows in sheet: ${data.length}`);
    
    // Process rows 2-55 (index 1-54, since row 1 is index 0 which is headers)
    const expenseTypes: ExpenseTypeData[] = [];
    
    for (let rowIndex = 1; rowIndex <= 54; rowIndex++) { // Rows 2-55 (0-indexed: 1-54)
      const row = data[rowIndex];
      
      if (!row || row.length === 0) {
        console.log(`Skipping empty row ${rowIndex + 1}`);
        continue;
      }
      
      // Column B = index 1, Column D = index 3, Column E = index 4
      const columnB = row[1]?.toString().trim() || ''; // Name part 1
      const columnD = row[3]?.toString().trim() || '';  // Code
      const columnE = row[4]?.toString().trim() || ''; // Name part 2
      
      // Skip if essential data is missing
      if (!columnB && !columnE) {
        console.log(`Skipping row ${rowIndex + 1}: Missing both column B and E`);
        continue;
      }
      
      if (!columnD) {
        console.log(`Skipping row ${rowIndex + 1}: Missing code (column D)`);
        continue;
      }
      
      // Name = B + "-" + E
      const name = columnB && columnE 
        ? `${columnB}-${columnE}`.trim()
        : columnB || columnE;
      
      const code = columnD;
      
      if (dryRun) {
        console.log(`Row ${rowIndex + 1}: B="${columnB}", D="${columnD}", E="${columnE}" -> Name="${name}", Code="${code}"`);
      }
      
      // Create expense type for each Benin organization
      for (const org of BENIN_ORGANIZATIONS) {
        // Generate unique ID: code_orgId (lowercase, normalized)
        const expenseTypeId = `${code.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${org.id}`.replace(/^_+|_+$/g, '');
        
        const expenseType: ExpenseTypeData = {
          id: expenseTypeId,
          name: name,
          code: code,
          organizationId: org.id,
          organization: org.name,
          active: true
        };
        
        expenseTypes.push(expenseType);
      }
    }
    
    console.log(`\nTotal expense types to import: ${expenseTypes.length} (${expenseTypes.length / BENIN_ORGANIZATIONS.length} unique types × ${BENIN_ORGANIZATIONS.length} organizations)`);
    
    if (dryRun) {
      console.log('\n=== DRY RUN MODE - No data will be imported ===');
      console.log('\nSample expense types (first 5):');
      expenseTypes.slice(0, 5).forEach(et => {
        console.log(`  - ID: ${et.id}`);
        console.log(`    Name: ${et.name}`);
        console.log(`    Code: ${et.code}`);
        console.log(`    Organization: ${et.organization} (${et.organizationId})`);
        console.log('');
      });
      console.log('✅ Dry run completed. Remove --dry-run flag to perform actual import.');
      process.exit(0);
      return;
    }
    
    // Import to Firestore
    // Commit in batches of 500 (Firestore limit)
    const batchSize = 500;
    const batches: any[] = [];
    
    for (let i = 0; i < expenseTypes.length; i += batchSize) {
      const batch = db.batch();
      const chunk = expenseTypes.slice(i, i + batchSize);
      
      for (const expenseType of chunk) {
        const docRef = db.collection(COLLECTION_NAME).doc(expenseType.id);
        batch.set(docRef, expenseType);
      }
      
      batches.push(batch);
    }
    
    console.log(`\nCommitting ${batches.length} batch(es)...`);
    
    for (let i = 0; i < batches.length; i++) {
      await batches[i].commit();
      console.log(`Committed batch ${i + 1}/${batches.length}`);
    }
    
    console.log(`\n✅ Successfully imported ${expenseTypes.length} expense types for Benin organizations`);
    console.log(`   - ${expenseTypes.length / BENIN_ORGANIZATIONS.length} unique expense types`);
    console.log(`   - ${BENIN_ORGANIZATIONS.length} organizations (${BENIN_ORGANIZATIONS.map(o => o.name).join(', ')})`);
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error importing expense types:', error);
    process.exit(1);
  }
}

// Run the import
importBeninExpenseTypes(dryRun);

