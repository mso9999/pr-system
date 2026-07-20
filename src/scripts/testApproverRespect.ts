/**
 * Test script to verify the PR approver logic fixes
 * 
 * This script tests that:
 * 1. The PR service respects the manually assigned approver
 * 2. The PR.approver field is the single source of truth
 * 3. The approval workflow tracks history correctly
 */

import { prService } from '../services/pr';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';

// Import Firebase configuration
import '../config/firebase'; // Just import to initialize Firebase
import { auth, db } from '../config/firebase'; // Use the initialized Firebase instances

async function testApproverRespect() {
  try {
    console.log('========== TESTING APPROVER SELECTION LOGIC ==========');
    
    // 1. Sign in as a test user
    await signInWithEmailAndPassword(auth, 'test@example.com', 'password');
    console.log('Signed in successfully');
    
    // 2. Create a test PR with a manually assigned approver
    const manuallyAssignedApproverId = "user123"; // Replace with an actual user ID
    console.log(`Creating test PR with manually assigned approver: ${manuallyAssignedApproverId}`);
    
    const prData = {
      organization: '1PWR LESOTHO',
      department: 'IS&T',
      projectCategory: 'Software',
      description: 'Test PR for approver logic',
      site: 'Office',
      expenseType: 'OPEX',
      estimatedAmount: 500,
      currency: 'USD',
      requiredDate: new Date().toISOString(),
      approver: manuallyAssignedApproverId
    };
    
    // Create PR
    const prId = await prService.createPR(prData);
    console.log(`Created test PR with ID: ${prId}`);
    
    // 3. Fetch the created PR to verify the approver is set correctly
    const pr = await prService.getPR(prId);
    console.log('Initial PR data:', {
      prId,
      approver: pr?.approver,
      approvalWorkflow: pr?.approvalWorkflow
    });
    
    // 4. Verify the PR.approver field matches our manually assigned approver
    if (pr?.approver !== manuallyAssignedApproverId) {
      console.error(`FAILED: PR.approver (${pr?.approver}) does not match manually assigned approver (${manuallyAssignedApproverId})`);
    } else {
      console.log(`PASSED: PR.approver correctly set to ${manuallyAssignedApproverId}`);
    }
    
    // 5. Verify the approvalWorkflow.currentApprover reflects PR.approver
    if (pr?.approvalWorkflow?.currentApprover !== manuallyAssignedApproverId) {
      console.error(`FAILED: approvalWorkflow.currentApprover (${pr?.approvalWorkflow?.currentApprover}) does not match PR.approver (${manuallyAssignedApproverId})`);
    } else {
      console.log(`PASSED: approvalWorkflow.currentApprover correctly reflects PR.approver`);
    }
    
    // 6. Test the bug fix by calling getApproverForPR and verify it respects the manually assigned approver
    const approver = await prService.getApproverForPR(pr!);
    console.log('Selected approver:', approver ? {
      id: approver.id,
      name: `${approver.firstName || ''} ${approver.lastName || ''}`.trim(),
    } : 'No approver found');
    
    if (approver?.id !== manuallyAssignedApproverId) {
      console.error(`FAILED: getApproverForPR returned ${approver?.id}, not the manually assigned approver ${manuallyAssignedApproverId}`);
    } else {
      console.log(`PASSED: getApproverForPR correctly respected the manually assigned approver`);
    }
    
    // 7. Test changing the approver and verify the history is updated
    const newApproverId = "user456"; // Replace with another actual user ID
    console.log(`Updating PR approver from ${manuallyAssignedApproverId} to ${newApproverId}`);
    
    await prService.updatePR(prId, {
      approver: newApproverId,
      notes: 'Testing approver change'
    });
    
    // 8. Fetch the updated PR
    const updatedPr = await prService.getPR(prId);
    console.log('Updated PR data:', {
      prId,
      approver: updatedPr?.approver,
      approvalWorkflow: updatedPr?.approvalWorkflow
    });
    
    // 9. Verify PR.approver is updated
    if (updatedPr?.approver !== newApproverId) {
      console.error(`FAILED: PR.approver (${updatedPr?.approver}) was not updated to ${newApproverId}`);
    } else {
      console.log(`PASSED: PR.approver correctly updated to ${newApproverId}`);
    }
    
    // 10. Verify approvalWorkflow.currentApprover is updated
    if (updatedPr?.approvalWorkflow?.currentApprover !== newApproverId) {
      console.error(`FAILED: approvalWorkflow.currentApprover (${updatedPr?.approvalWorkflow?.currentApprover}) was not updated to ${newApproverId}`);
    } else {
      console.log(`PASSED: approvalWorkflow.currentApprover correctly updated to ${newApproverId}`);
    }
    
    // 11. Verify approvalWorkflow.approvalHistory contains the change
    const historyItem = updatedPr?.approvalWorkflow?.approvalHistory.find(
      item => item.approverId === newApproverId
    );
    
    if (!historyItem) {
      console.error(`FAILED: No history item found for approver change to ${newApproverId}`);
    } else {
      console.log(`PASSED: History item correctly added for approver change:`, historyItem);
    }
    
    // 12. Verify that approvers array is not present or is empty
    if (updatedPr && 'approvers' in updatedPr && Array.isArray(updatedPr.approvers) && updatedPr.approvers.length > 0) {
      console.error(`FAILED: PR still contains non-empty approvers array: ${JSON.stringify(updatedPr.approvers)}`);
    } else {
      console.log(`PASSED: PR does not contain non-empty approvers array`);
    }
    
    console.log('========== TEST COMPLETE ==========');
    
    // Clean up - delete the test PR
    // Uncomment if you want to keep the test PR for manual inspection
    // await prService.deletePR(prId);
    // console.log(`Deleted test PR: ${prId}`);
    
  } catch (error) {
    console.error('Test failed with error:', error);
  }
}

// Run the test
testApproverRespect();
