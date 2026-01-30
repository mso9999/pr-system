import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, updateDoc, doc } from 'firebase/firestore';

// Firebase configuration (from src/config/firebase.js defaults)
const firebaseConfig = {
  apiKey: 'AIzaSyD0tA1fvWs5dCr-7JqJv_bxlay2Bhs72jQ',
  authDomain: 'pr-system-4ea55.firebaseapp.com',
  projectId: 'pr-system-4ea55',
  storageBucket: 'pr-system-4ea55.firebasestorage.app',
  messagingSenderId: '562987209098',
  appId: '1:562987209098:web:2f788d189f1c0867cb3873'
};

// Initialize Firebase app and services
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function fixOlivierDepartment(): Promise<void> {
  try {
    console.log('Searching for Olivier DUMONT in users collection...');
    
    const usersRef = collection(db, 'users');
    
    // Search by first name containing "Olivier" or last name containing "DUMONT"
    const snapshot = await getDocs(usersRef);
    
    let olivierDoc: any = null;
    let olivierData: any = null;
    
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const firstName = (data.firstName || '').toLowerCase();
      const lastName = (data.lastName || '').toLowerCase();
      
      if (firstName.includes('olivier') || lastName.includes('dumont')) {
        olivierDoc = docSnap;
        olivierData = data;
        console.log('\nFound user:', {
          id: docSnap.id,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          department: data.department,
          organization: data.organization,
          permissionLevel: data.permissionLevel
        });
      }
    });
    
    if (!olivierDoc) {
      console.log('Olivier DUMONT not found in users collection.');
      return;
    }
    
    // Check if department looks like a UID
    const currentDept = olivierData.department || '';
    const isUidLike = /^[A-Za-z0-9]{20,28}$/.test(currentDept);
    
    if (isUidLike) {
      console.log(`\nCurrent department "${currentDept}" looks like a Firebase UID.`);
      
      // Try to find the actual department name from referenceData_departments
      const deptRef = collection(db, 'referenceData_departments');
      const deptSnapshot = await getDocs(deptRef);
      
      let foundDeptName: string | null = null;
      deptSnapshot.forEach((deptDoc) => {
        if (deptDoc.id === currentDept) {
          const deptData = deptDoc.data();
          foundDeptName = deptData.name || deptData.displayName || null;
          console.log('Found matching department document:', {
            id: deptDoc.id,
            name: deptData.name,
            displayName: deptData.displayName,
            organizationId: deptData.organizationId
          });
        }
      });
      
      if (foundDeptName) {
        console.log(`\nUpdating department from UID to name: "${foundDeptName}"`);
        await updateDoc(doc(db, 'users', olivierDoc.id), {
          department: foundDeptName
        });
        console.log('✅ Successfully updated Olivier\'s department to:', foundDeptName);
      } else {
        // If we can't find the department, set it to empty string
        console.log('\nCould not find department name for UID. Setting to empty string.');
        await updateDoc(doc(db, 'users', olivierDoc.id), {
          department: ''
        });
        console.log('✅ Cleared Olivier\'s invalid department field.');
      }
    } else {
      console.log(`\nDepartment "${currentDept}" does not look like a UID. No changes needed.`);
    }
    
  } catch (error) {
    console.error('Error fixing Olivier\'s department:', error);
    throw error;
  }
}

// Run the script
fixOlivierDepartment()
  .then(() => {
    console.log('\nScript completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
