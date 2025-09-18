const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs, updateDoc, doc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: 'AIzaSyD0tA1fvWs5dCr-7JqJv_bxlay2Bhs72jQ',
  authDomain: 'pr-system-4ea55.firebaseapp.com',
  projectId: 'pr-system-4ea55',
  storageBucket: 'pr-system-4ea55.firebasestorage.app',
  appId: '1:562987209098:web:2f788d189f1c0867cb3873'
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function fixPhokaPermissions() {
  try {
    console.log('🔍 Searching for Phoka\'s user record...');
    
    // Find Phoka's user document
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', 'phoka@1pwrafrica.com'));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      console.log('❌ User not found: phoka@1pwrafrica.com');
      return;
    }
    
    const userDoc = snapshot.docs[0];
    const userData = userDoc.data();
    
    console.log('📋 Current user data:');
    console.log('   Email:', userData.email);
    console.log('   Permission Level:', userData.permissionLevel);
    console.log('   Role:', userData.role);
    console.log('   Organization:', userData.organization);
    
    if (userData.permissionLevel === 3) {
      console.log('✅ Permission level is already correct (3 - Procurement)');
      return;
    }
    
    console.log('🔧 Updating permission level to 3 (Procurement)...');
    
    await updateDoc(doc(db, 'users', userDoc.id), {
      permissionLevel: 3,
      role: 'PROC', // Update role as well
      updatedAt: new Date().toISOString()
    });
    
    console.log('✅ Successfully updated Phoka\'s permissions!');
    console.log('📝 Updated fields:');
    console.log('   permissionLevel: 3 (Procurement)');
    console.log('   role: PROC');
    console.log('   updatedAt:', new Date().toISOString());
    
    // Verify the update
    const updatedDoc = await getDocs(q);
    const updatedData = updatedDoc.docs[0].data();
    console.log('🔍 Verification - New permission level:', updatedData.permissionLevel);
    
  } catch (error) {
    console.error('❌ Error updating permissions:', error);
  }
}

fixPhokaPermissions();

