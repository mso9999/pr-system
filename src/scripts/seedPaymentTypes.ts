/**
 * Seed script for Payment Types reference data
 * Run with: npm run seed-payment-types
 */

import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { signIn } from '../services/auth';

const PAYMENT_TYPES = [
  {
    id: 'cash',
    code: 'CASH',
    name: 'Cash',
    isActive: true
  },
  {
    id: 'eft',
    code: 'EFT',
    name: 'EFT (Electronic Funds Transfer)',
    isActive: true
  },
  {
    id: 'credit_card',
    code: 'CREDIT_CARD',
    name: 'Credit Card',
    isActive: true
  },
  {
    id: 'check',
    code: 'CHECK',
    name: 'Check',
    isActive: true
  },
  {
    id: 'bank_transfer',
    code: 'BANK_TRANSFER',
    name: 'Bank Transfer',
    isActive: true
  }
];

async function seedPaymentTypes() {
  try {
    console.log('Starting payment types seed...');
    
    const collectionRef = collection(db, 'referenceData_paymentTypes');
    
    // Check if payment types already exist
    const snapshot = await getDocs(collectionRef);
    if (!snapshot.empty) {
      console.log(`⚠️  Payment types already exist (${snapshot.size} found). Skipping...`);
      return;
    }
    
    // Add each payment type
    for (const paymentType of PAYMENT_TYPES) {
      await addDoc(collectionRef, {
        ...paymentType,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      console.log(`✅ Added payment type: ${paymentType.name}`);
    }
    
    console.log('\n✨ Payment types seeded successfully!');
    console.log(`Total: ${PAYMENT_TYPES.length} payment types`);
    
  } catch (error) {
    console.error('❌ Error seeding payment types:', error);
    throw error;
  }
}

// Main execution
(async () => {
  try {
    // Note: You may need to authenticate first
    // await signIn('your-email@example.com', 'your-password');
    
    await seedPaymentTypes();
    process.exit(0);
  } catch (error) {
    console.error('Script failed:', error);
    process.exit(1);
  }
})();

