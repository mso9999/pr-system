/**
 * Reconciliation Script: Fix Approved POs Missing Second Approver
 * 
 * Problem: Some POs were approved that exceeded the Rule 3 threshold
 * (dual approval threshold) but don't have a valid second approver assigned.
 * 
 * This script will:
 * 1. Find all APPROVED PRs/POs
 * 2. Check if they should have required dual approval (amount >= Rule 3 threshold)
 * 3. Identify those missing a valid second approver
 * 4. Revert them to PENDING_APPROVAL status with proper status history
 * 
 * Run with: npx ts-node scripts/reconcile-dual-approval-violations.ts
 * 
 * Options:
 *   --dry-run     Preview changes without applying them (default)
 *   --apply       Actually apply the changes
 *   --org=<id>    Filter to a specific organization (e.g., --org=mgb)
 */

import { initializeApp, cert, ServiceAccount } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import * as path from 'path';

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = !args.includes('--apply');
const orgFilter = args.find(a => a.startsWith('--org='))?.split('=')[1] || null;

// Organization alias mapping (same as in src/utils/organization.ts)
const ORGANIZATION_ALIAS_MAP: Record<string, string> = {
  '1pwr_lesotho': '1pwr_lesotho',
  '1pwr lesotho': '1pwr_lesotho',
  '1pwr_benin': '1pwr_benin',
  '1pwr benin': '1pwr_benin',
  '1pwr_zambia': '1pwr_zambia',
  '1pwr zambia': '1pwr_zambia',
  neo1: 'neo1',
  'pueco_lesotho': 'pueco_lesotho',
  'pueco_benin': 'pueco_benin',
  smp: 'smp',
  mgb: 'mgb',
  'mionwa_gen': 'mgb',
  'mionwa gen': 'mgb',
  mionwa: 'mgb',
  'mionwa_generation': 'mgb',
  'mionwa generation': 'mgb',
};

function normalizeOrganizationId(input: string | any): string {
  if (!input) return '';
  
  let rawValue: string;
  if (typeof input === 'object') {
    rawValue = input.code || input.id || input.name || '';
  } else {
    rawValue = String(input);
  }
  
  const normalized = rawValue.toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
  return ORGANIZATION_ALIAS_MAP[normalized] || normalized;
}

// Static exchange rates for currency conversion
// These are approximate rates for threshold comparison purposes
const EXCHANGE_RATES: Record<string, Record<string, number>> = {
  'USD': { 'XOF': 603.48, 'LSL': 18.49, 'ZMW': 27.5 },
  'XOF': { 'USD': 0.00166, 'LSL': 0.0306, 'ZMW': 0.0456 },
  'LSL': { 'USD': 0.054, 'XOF': 32.68, 'ZMW': 1.49 },
  'ZMW': { 'USD': 0.036, 'XOF': 21.94, 'LSL': 0.67 },
  'EUR': { 'USD': 1.08, 'XOF': 655.96, 'LSL': 19.97, 'ZMW': 29.7 },
};

function convertAmount(amount: number, fromCurrency: string, toCurrency: string): number {
  if (fromCurrency === toCurrency) return amount;
  
  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();
  
  if (EXCHANGE_RATES[from]?.[to]) {
    return amount * EXCHANGE_RATES[from][to];
  }
  
  // Try via USD as intermediate
  if (EXCHANGE_RATES[from]?.['USD'] && EXCHANGE_RATES['USD']?.[to]) {
    return amount * EXCHANGE_RATES[from]['USD'] * EXCHANGE_RATES['USD'][to];
  }
  
  console.warn(`  Warning: No exchange rate for ${from} -> ${to}, using amount as-is`);
  return amount;
}

function isValidApprover(approver: string | null | undefined): boolean {
  if (!approver) return false;
  const trimmed = approver.trim().toLowerCase();
  return trimmed !== '' && 
         trimmed !== '(not set)' && 
         trimmed !== 'not set' &&
         trimmed !== 'null' &&
         trimmed !== 'undefined';
}

interface RuleData {
  threshold: number;
  currency: string;
  uom?: string;
}

interface PRViolation {
  id: string;
  prNumber: string;
  organization: string;
  normalizedOrgId: string;
  status: string;
  estimatedAmount: number;
  currency: string;
  convertedAmount: number;
  rule3Threshold: number;
  rule3Currency: string;
  approver: string;
  approver2: string | null;
  approverName?: string;
  requiresDualApproval: boolean;
  violationReason: string;
}

async function main() {
  console.log('='.repeat(70));
  console.log('RECONCILIATION: Fix Approved POs Missing Second Approver');
  console.log('='.repeat(70));
  console.log(`Mode: ${isDryRun ? 'DRY RUN (preview only)' : 'APPLY CHANGES'}`);
  if (orgFilter) console.log(`Organization filter: ${orgFilter}`);
  console.log('');

  // Initialize Firebase Admin
  try {
    const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || 
      path.join(__dirname, '../pr-system-4ea55-firebase-adminsdk-f3uff-2cec628657.json');
    
    const serviceAccount = require(serviceAccountPath) as ServiceAccount;
    
    initializeApp({
      credential: cert(serviceAccount)
    });
    console.log('✓ Firebase Admin initialized\n');
  } catch (error) {
    console.error('Failed to initialize Firebase Admin.');
    console.error('Make sure you have a serviceAccountKey.json file or GOOGLE_APPLICATION_CREDENTIALS set.');
    console.error(error);
    process.exit(1);
  }

  const db = getFirestore();

  // Step 1: Load all organization rules
  console.log('Step 1: Loading organization rules...');
  const rulesRef = db.collection('referenceData_rules');
  const rulesSnapshot = await rulesRef.get();
  
  const orgRules: Record<string, { rule3: RuleData; rule5: number }> = {};
  
  for (const doc of rulesSnapshot.docs) {
    const data = doc.data();
    const orgId = normalizeOrganizationId(data.organizationId);
    const ruleNumber = data.number;
    
    if (!orgRules[orgId]) {
      orgRules[orgId] = { 
        rule3: { threshold: 0, currency: 'LSL' },
        rule5: 2 
      };
    }
    
    if (ruleNumber === 3 || ruleNumber === '3') {
      orgRules[orgId].rule3 = {
        threshold: data.threshold || 0,
        currency: data.currency || data.uom || 'LSL'
      };
    }
    
    if (ruleNumber === 5 || ruleNumber === '5') {
      orgRules[orgId].rule5 = data.threshold || 2;
    }
  }
  
  console.log(`  Loaded rules for ${Object.keys(orgRules).length} organizations`);
  for (const [orgId, rules] of Object.entries(orgRules)) {
    console.log(`    ${orgId}: Rule 3 threshold = ${rules.rule3.threshold.toLocaleString()} ${rules.rule3.currency}`);
  }
  console.log('');

  // Step 2: Load all APPROVED PRs
  console.log('Step 2: Loading APPROVED PRs...');
  const prsRef = db.collection('purchaseRequests');
  const approvedQuery = prsRef.where('status', '==', 'APPROVED');
  const approvedSnapshot = await approvedQuery.get();
  
  console.log(`  Found ${approvedSnapshot.size} APPROVED PRs\n`);

  // Step 3: Identify violations
  console.log('Step 3: Checking for dual approval violations...');
  const violations: PRViolation[] = [];
  
  for (const doc of approvedSnapshot.docs) {
    const data = doc.data();
    const prNumber = data.prNumber || doc.id;
    const organization = data.organization || '';
    const normalizedOrgId = normalizeOrganizationId(organization);
    
    // Apply organization filter if specified
    if (orgFilter && normalizedOrgId !== orgFilter) {
      continue;
    }
    
    const rules = orgRules[normalizedOrgId];
    if (!rules || !rules.rule3.threshold) {
      // No rules or no Rule 3 threshold for this org
      continue;
    }
    
    const estimatedAmount = data.estimatedAmount || 0;
    const currency = data.currency || 'USD';
    
    // Convert amount to Rule 3 currency for comparison
    const convertedAmount = convertAmount(estimatedAmount, currency, rules.rule3.currency);
    
    // Check if dual approval was required
    const requiresDualApproval = convertedAmount >= rules.rule3.threshold;
    
    if (!requiresDualApproval) {
      // PR is below threshold, no dual approval needed
      continue;
    }
    
    // Check if second approver is valid
    const approver = data.approver || '';
    const approver2 = data.approver2 || data.approvalWorkflow?.secondApprover || null;
    
    const hasValidApprover2 = isValidApprover(approver2);
    
    if (!hasValidApprover2) {
      violations.push({
        id: doc.id,
        prNumber,
        organization,
        normalizedOrgId,
        status: data.status,
        estimatedAmount,
        currency,
        convertedAmount,
        rule3Threshold: rules.rule3.threshold,
        rule3Currency: rules.rule3.currency,
        approver,
        approver2,
        requiresDualApproval: true,
        violationReason: `Amount ${convertedAmount.toLocaleString()} ${rules.rule3.currency} exceeds Rule 3 threshold (${rules.rule3.threshold.toLocaleString()} ${rules.rule3.currency}) but no valid second approver assigned`
      });
    }
  }

  console.log(`\n  Found ${violations.length} PR(s) with dual approval violations\n`);

  if (violations.length === 0) {
    console.log('No violations found. All approved PRs above Rule 3 threshold have valid second approvers.');
    return;
  }

  // Step 4: Display violations
  console.log('='.repeat(70));
  console.log('VIOLATIONS FOUND:');
  console.log('='.repeat(70));
  
  for (const v of violations) {
    console.log(`\n  PR: ${v.prNumber}`);
    console.log(`    ID: ${v.id}`);
    console.log(`    Organization: ${v.organization} (${v.normalizedOrgId})`);
    console.log(`    Amount: ${v.estimatedAmount.toLocaleString()} ${v.currency}`);
    if (v.currency !== v.rule3Currency) {
      console.log(`    Converted: ${v.convertedAmount.toLocaleString()} ${v.rule3Currency}`);
    }
    console.log(`    Rule 3 Threshold: ${v.rule3Threshold.toLocaleString()} ${v.rule3Currency}`);
    console.log(`    Approver 1: ${v.approver || '(none)'}`);
    console.log(`    Approver 2: ${v.approver2 || '(not set)'}`);
    console.log(`    Violation: ${v.violationReason}`);
  }

  console.log('\n' + '='.repeat(70));

  if (isDryRun) {
    console.log('\nDRY RUN - No changes applied.');
    console.log('To apply changes, run with: npx ts-node scripts/reconcile-dual-approval-violations.ts --apply');
    return;
  }

  // Step 5: Apply fixes - Revert to PENDING_APPROVAL
  console.log('\nStep 5: Reverting PRs to PENDING_APPROVAL status...');
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const v of violations) {
    try {
      const docRef = db.collection('purchaseRequests').doc(v.id);
      const currentDoc = await docRef.get();
      const currentData = currentDoc.data();
      
      // Build status history entry
      const statusHistoryEntry = {
        status: 'PENDING_APPROVAL',
        timestamp: new Date().toISOString(),
        user: {
          id: 'SYSTEM',
          email: 'system@1pwrafrica.com',
          firstName: 'System',
          lastName: 'Reconciliation',
          name: 'System Reconciliation',
          role: 'system',
          organization: 'system',
          isActive: true,
          permissionLevel: 0,
          permissions: {}
        },
        notes: `Reverted from APPROVED: PR amount (${v.convertedAmount.toLocaleString()} ${v.rule3Currency}) exceeds dual approval threshold (${v.rule3Threshold.toLocaleString()} ${v.rule3Currency}). Second approver required.`
      };
      
      // Get existing status history and append new entry
      const existingHistory = currentData?.statusHistory || [];
      const updatedHistory = [...existingHistory, statusHistoryEntry];
      
      // Update the PR
      await docRef.update({
        status: 'PENDING_APPROVAL',
        statusHistory: updatedHistory,
        requiresDualApproval: true,
        'approvalWorkflow.requiresDualApproval': true,
        'approvalWorkflow.firstApprovalComplete': true, // Keep first approval
        'approvalWorkflow.secondApprovalComplete': false, // Reset second approval
        updatedAt: new Date().toISOString(),
        '_migration': {
          dualApprovalReconciliation: true,
          reconciledAt: new Date().toISOString(),
          originalStatus: 'APPROVED',
          revertReason: v.violationReason
        }
      });
      
      console.log(`  ✓ Reverted ${v.prNumber} to PENDING_APPROVAL`);
      successCount++;
    } catch (error) {
      console.error(`  ✗ Failed to revert ${v.prNumber}:`, error);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('RECONCILIATION COMPLETE');
  console.log('='.repeat(70));
  console.log(`  Total violations found: ${violations.length}`);
  console.log(`  Successfully reverted: ${successCount}`);
  console.log(`  Errors: ${errorCount}`);
  console.log('\nAffected PRs have been moved back to PENDING_APPROVAL status.');
  console.log('Users can now assign a second approver in the UI and complete the dual approval process.');
}

main().catch(console.error);
