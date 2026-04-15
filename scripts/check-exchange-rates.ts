import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, addDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function checkExchangeRates() {
  try {
    // Sign in first
    await signInWithEmailAndPassword(
      auth,
      process.env.VITE_TEST_EMAIL!,
      process.env.VITE_TEST_PASSWORD!
    );

    console.log('\n📊 Checking Exchange Rates in Firestore\n');
    console.log('===============================');
    
    const collectionRef = collection(db, 'exchangeRates');
    const snapshot = await getDocs(collectionRef);
    
    if (snapshot.empty) {
      console.log('\n❌ No exchange rates found in Firestore!');
      console.log('\nYou need to add exchange rates for currency conversion to work.');
      console.log('\nExample rates needed:');
      console.log('  - USD → LSL (Lesotho Loti) - approx 18.5');
      console.log('  - EUR → LSL - approx 20.0');
      console.log('  - USD → XOF (CFA Franc for Benin) - approx 600');
      console.log('  - EUR → XOF - approx 656');
      console.log('  - ZAR → LSL - approx 1.0 (pegged)');
    } else {
      console.log(`\n✅ Found ${snapshot.size} exchange rate(s):\n`);
      snapshot.forEach(doc => {
        const data = doc.data();
        console.log(`  ${data.from} → ${data.to}: ${data.rate}`);
        console.log(`    (Updated: ${data.updatedAt || 'unknown'})`);
      });
    }

    // Sign out after we're done
    await auth.signOut();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkExchangeRates();
