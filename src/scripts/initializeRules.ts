import { config } from 'dotenv';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

// Load environment variables
config();

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Helper function to create 7 rules for an organization
function createOrgRules(
  organizationId: string, 
  orgName: string, 
  rule1Threshold?: number, 
  rule3Threshold?: number, 
  rule2Multiplier?: number, 
  rule4Quotes?: number, 
  rule5Approvers?: number,
  rule6UpwardVariance?: number,
  rule7DownwardVariance?: number,
  currency: string = 'LSL'
) {
  const timestamp = new Date().toISOString();
  return [
    {
      number: 1,
      name: 'Rule 1',
      description: 'Finance admin approvers can approve low value PRs',
      threshold: rule1Threshold || 0, // Will need to be updated per org
      uom: currency,
      currency: currency, // Deprecated, kept for backwards compatibility
      organizationId: organizationId,
      organization: orgName,
      active: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      number: 2,
      name: 'Rule 2',
      description: 'Low Threshold Multiplier to set the boundary between 1 quote (if vendor is approved revert to zero quotes required) or [rule 4] quotes (if vendor is approved revert to floor)',
      threshold: rule2Multiplier || 0, // Will need to be updated per org
      uom: 'NA',
      currency: 'NA', // Deprecated, kept for backwards compatibility
      organizationId: organizationId,
      organization: orgName,
      active: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      number: 3,
      name: 'Rule 3',
      description: 'Items below this high value threshold (and above rule 1 * rule 2) require [rule 4] quotes unless the vendor is approved; above the threshold [rule 4] quotes, [rule 5] unique approvers, and adjudication notes are always required',
      threshold: rule3Threshold || 0, // Will need to be updated per org
      uom: currency,
      currency: currency, // Deprecated, kept for backwards compatibility
      organizationId: organizationId,
      organization: orgName,
      active: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      number: 4,
      name: 'Rule 4',
      description: 'Number of Quotes required above minimum floor of 1 quote',
      threshold: rule4Quotes || 0, // Will need to be updated per org
      uom: currency,
      currency: currency, // Deprecated, kept for backwards compatibility
      organizationId: organizationId,
      organization: orgName,
      active: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      number: 5,
      name: 'Rule 5',
      description: 'Number of approvers required for high value expenditures',
      threshold: rule5Approvers || 0, // Will need to be updated per org
      uom: 'NA',
      currency: 'NA', // Deprecated, kept for backwards compatibility
      organizationId: organizationId,
      organization: orgName,
      active: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      number: 6,
      name: 'Rule 6',
      description: 'Final Price Upward Variance Threshold: Maximum percentage increase allowed from approved amount to final price without re-approval',
      threshold: rule6UpwardVariance ?? 5, // Default 5%
      uom: '%',
      currency: '%', // Deprecated, kept for backwards compatibility
      organizationId: organizationId,
      organization: orgName,
      active: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      number: 7,
      name: 'Rule 7',
      description: 'Final Price Downward Variance Threshold: Maximum percentage decrease allowed from approved amount to final price without re-approval',
      threshold: rule7DownwardVariance ?? 20, // Default 20%
      uom: '%',
      currency: '%', // Deprecated, kept for backwards compatibility
      organizationId: organizationId,
      organization: orgName,
      active: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ];
}

const rules = [
  // 1PWR LESOTHO - FULLY CONFIGURED (Reference)
  ...createOrgRules('1pwr_lesotho', '1PWR LESOTHO', 1500, 50000, 4, 3, 2, 5, 20, 'LSL'),
  
  // SMP - TO BE CONFIGURED (thresholds set to 0, variance thresholds set to defaults)
  ...createOrgRules('smp', 'SMP', 0, 0, 0, 0, 0, 5, 20, 'LSL'),
  
  // PUECO LESOTHO - TO BE CONFIGURED (thresholds set to 0, variance thresholds set to defaults)
  ...createOrgRules('pueco_lesotho', 'PUECO LESOTHO', 0, 0, 0, 0, 0, 5, 20, 'LSL'),
  
  // NEO1 - TO BE CONFIGURED (thresholds set to 0, variance thresholds set to defaults)
  ...createOrgRules('neo1', 'NEO1', 0, 0, 0, 0, 0, 5, 20, 'LSL'),
  
  // 1PWR BENIN - TO BE CONFIGURED (thresholds set to 0, variance thresholds set to defaults)
  ...createOrgRules('1pwr_benin', '1PWR BENIN', 0, 0, 0, 0, 0, 5, 20, 'XOF'),
  
  // 1PWR ZAMBIA - TO BE CONFIGURED (thresholds set to 0, org inactive, variance thresholds set to defaults)
  ...createOrgRules('1pwr_zambia', '1PWR ZAMBIA', 0, 0, 0, 0, 0, 5, 20, 'ZMW'),
  
  // PUECO BENIN - TO BE CONFIGURED (thresholds set to 0, org inactive, variance thresholds set to defaults)
  ...createOrgRules('pueco_benin', 'PUECO BENIN', 0, 0, 0, 0, 0, 5, 20, 'XOF'),
];

async function initializeRules() {
  try {
    // Sign in as admin
    if (!process.env.VITE_TEST_EMAIL || !process.env.VITE_TEST_PASSWORD) {
      throw new Error('Test credentials not found in environment variables');
    }
    
    await signInWithEmailAndPassword(auth, process.env.VITE_TEST_EMAIL, process.env.VITE_TEST_PASSWORD);
    console.log('Successfully authenticated');

    const rulesRef = collection(db, 'referenceData_rules');
    
    for (const rule of rules) {
      // Create a unique ID based on organization and rule number
      const docId = `${rule.organizationId}_rule_${rule.number}`;
      const docRef = doc(rulesRef, docId);
      
      // Check if document exists
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        console.log(`Updating rule: ${rule.name} for ${rule.organizationId}`);
      } else {
        console.log(`Creating rule: ${rule.name} for ${rule.organizationId}`);
      }
      
      await setDoc(docRef, rule);
    }
    
    console.log('All rules initialized successfully');
  } catch (error) {
    console.error('Error initializing rules:', error);
    process.exit(1);
  }
}

// Run the initialization
initializeRules().then(() => {
  console.log('Rules initialization complete');
  process.exit(0);
}).catch((error) => {
  console.error('Rules initialization failed:', error);
  process.exit(1);
});


