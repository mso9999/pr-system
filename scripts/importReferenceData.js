const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parse/sync');
const serviceAccount = require(path.join(__dirname, '..', 'firebase-service-account.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const COLLECTION_PREFIX = 'referenceData';

// Organizations data
const organizations = [
  { 
    id: '1pwr_lesotho',
    code: '1PWR_LSO',
    name: '1PWR LESOTHO',
    shortName: '1PWR LSO',
    country: 'Lesotho',
    timezone: 'Africa/Maseru',
    currency: 'LSL',
    active: true
  },
  { 
    id: '1pwr_benin',
    code: '1PWR_BEN',
    name: '1PWR BENIN',
    shortName: '1PWR BEN',
    country: 'Benin',
    timezone: 'Africa/Porto-Novo',
    currency: 'XOF',
    active: true
  },
  { 
    id: '1pwr_zambia',
    code: '1PWR_ZAM',
    name: '1PWR ZAMBIA',
    shortName: '1PWR ZAM',
    country: 'Zambia',
    timezone: 'Africa/Lusaka',
    currency: 'ZMW',
    active: false
  },
  { 
    id: 'pueco_lesotho',
    code: 'PUECO_LSO',
    name: 'PUECO LESOTHO',
    shortName: 'PUECO LSO',
    country: 'Lesotho',
    timezone: 'Africa/Maseru',
    currency: 'LSL',
    active: true
  },
  { 
    id: 'pueco_benin',
    code: 'PUECO_BEN',
    name: 'PUECO BENIN',
    shortName: 'PUECO BEN',
    country: 'Benin',
    timezone: 'Africa/Porto-Novo',
    currency: 'XOF',
    active: false
  },
  { 
    id: 'neo1',
    code: 'NEO1',
    name: 'NEO1',
    shortName: 'NEO1',
    country: 'Lesotho',
    timezone: 'Africa/Maseru',
    currency: 'LSL',
    active: true
  },
  { 
    id: 'smp',
    code: 'SMP',
    name: 'SMP',
    shortName: 'SMP',
    country: 'Lesotho',
    timezone: 'Africa/Maseru',
    currency: 'LSL',
    active: true
  }
];

// Permissions data
const permissions = [
  {
    id: 'admin',
    code: 'ADMIN',
    name: 'Administrator',
    description: 'Full system access',
    level: 1,
    actions: ['*'],
    scope: ['*'],
    active: true
  },
  {
    id: 'proc_mgr',
    code: 'PROC_MGR',
    name: 'Procurement Manager',
    description: 'Can manage procurement process and view Admin Dashboard and edit select Admin Dashboard items',
    level: 2,
    actions: ['create', 'read', 'update', 'delete', 'approve'],
    scope: ['pr', 'po', 'vendors'],
    active: true
  },
  {
    id: 'dept_head',
    code: 'DEPT_HEAD',
    name: 'Department Head',
    description: 'Can approve department requests and view (but not edit) Admin Dashboard',
    level: 4,
    actions: ['read', 'approve'],
    scope: ['pr'],
    active: true
  },
  {
    id: 'fin_ad',
    code: 'FIN_AD',
    name: 'Finance Admin',
    description: 'Can process procurement requests and view (but not edit) Admin Dashboard',
    level: 3,
    actions: ['create', 'read', 'update'],
    scope: ['pr', 'po'],
    active: true
  },
  {
    id: 'requester',
    code: 'REQ',
    name: 'Requester',
    description: 'Can create and view requests',
    level: 5,
    actions: ['create', 'read'],
    scope: ['pr'],
    active: true
  }
];

function generateId(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

async function importFromCsv(type, csvPath, options = {}) {
  const collectionName = `${COLLECTION_PREFIX}_${type}`;
  console.log(`\nImporting ${type} from ${csvPath}...`);

  try {
    // Read and parse CSV file
    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    const records = csv.parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true
    });

    console.log(`Parsed ${records.length} records from CSV`);

    // Clear existing collection
    const snapshot = await db.collection(collectionName).get();
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    console.log(`Cleared existing ${type}`);

    // Create new batch for imports
    const importBatch = db.batch();

    // Process each record
    for (const record of records) {
      const id = options.generateId ? options.generateId(record) : record.id || generateId(record.name);
      const docRef = db.collection(collectionName).doc(id);

      // Transform record if needed
      const data = options.transform ? options.transform(record) : record;

      // Add to batch
      importBatch.set(docRef, {
        ...data,
        id,
        createdAt: new Date().toISOString()
      });
    }

    // Commit the batch
    await importBatch.commit();
    console.log(`Successfully imported ${records.length} ${type}`);
  } catch (error) {
    console.error(`Error importing ${type}:`, error);
    throw error;
  }
}

async function importOrganizationsAndPermissions() {
  try {
    // Import organizations
    console.log('\nImporting organizations...');
    const organizationsCollection = db.collection(`${COLLECTION_PREFIX}_organizations`);
    const orgBatch = db.batch();

    // Clear existing organizations
    const orgSnapshot = await organizationsCollection.get();
    orgSnapshot.docs.forEach((doc) => {
      orgBatch.delete(doc.ref);
    });
    await orgBatch.commit();
    console.log('Cleared existing organizations');

    // Import new organizations
    const newOrgBatch = db.batch();
    organizations.forEach((org) => {
      const docRef = organizationsCollection.doc(org.id);
      newOrgBatch.set(docRef, {
        ...org,
        createdAt: new Date().toISOString()
      });
    });
    await newOrgBatch.commit();
    console.log(`Successfully imported ${organizations.length} organizations`);

    // Import permissions
    console.log('\nImporting permissions...');
    const permissionsCollection = db.collection(`${COLLECTION_PREFIX}_permissions`);
    const permBatch = db.batch();

    // Clear existing permissions
    const permSnapshot = await permissionsCollection.get();
    permSnapshot.docs.forEach((doc) => {
      permBatch.delete(doc.ref);
    });
    await permBatch.commit();
    console.log('Cleared existing permissions');

    // Import new permissions
    const newPermBatch = db.batch();
    permissions.forEach((perm) => {
      const docRef = permissionsCollection.doc(perm.id);
      newPermBatch.set(docRef, {
        ...perm,
        createdAt: new Date().toISOString()
      });
    });
    await newPermBatch.commit();
    console.log(`Successfully imported ${permissions.length} permissions`);

  } catch (error) {
    console.error('Error importing organizations and permissions:', error);
    throw error;
  }
}

async function importAllReferenceData() {
  try {
    // Import organizations and permissions first
    await importOrganizationsAndPermissions();

    // Import other reference data from CSV files
    await importFromCsv('departments', path.join(__dirname, '..', 'Departments.csv'), {
      transform: (record) => ({
        name: record['Department Name'],
        active: record['Active Status (Y/N)'].toUpperCase() === 'Y',
        organization: {
          id: record['Organization ID'],
          name: record['Organization']
        }
      })
    });
    await importFromCsv('sites', path.join(__dirname, '..', 'Sites.csv'));
    await importFromCsv('expenseTypes', path.join(__dirname, '..', 'Expense Type.csv'));
    await importFromCsv('projectCategories', path.join(__dirname, '..', 'Project Categories.csv'));
    await importFromCsv('vehicles', path.join(__dirname, '..', 'Vehicle.csv'));
    await importFromCsv('vendors', path.join(__dirname, '..', 'Vendors.csv'));

    console.log('\nAll reference data imported successfully!');
  } catch (error) {
    console.error('Error importing reference data:', error);
  } finally {
    process.exit();
  }
}

// Run the import
importAllReferenceData();
