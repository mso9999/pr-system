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

const rules = [
  {
    number: 1,
    name: 'Rule 1',
    description: 'First approval threshold - Finance Approvers can approve up to this amount',
    threshold: 50000,
    currency: 'USD',
    organizationId: '1pwr_lesotho',
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    number: 2,
    name: 'Rule 2',
    description: 'Second approval threshold - Requires dual approval above this amount',
    threshold: 100000,
    currency: 'USD',
    organizationId: '1pwr_lesotho',
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    number: 1,
    name: 'Rule 1',
    description: 'First approval threshold - Finance Approvers can approve up to this amount',
    threshold: 50000,
    currency: 'USD',
    organizationId: '1pwr_benin',
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    number: 2,
    name: 'Rule 2',
    description: 'Second approval threshold - Requires dual approval above this amount',
    threshold: 100000,
    currency: 'USD',
    organizationId: '1pwr_benin',
    active: true,
    createdAt: new Date().toISOString(),
  },
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


