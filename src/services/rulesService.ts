/**
 * @fileoverview Rules Service - Single Source of Truth for Organizational Rules
 * @description Provides a unified interface for managing rules stored in referenceData_rules collection
 */

import { 
  doc, 
  getDoc, 
  updateDoc,
  setDoc,
  collection, 
  query, 
  where, 
  getDocs 
} from 'firebase/firestore';
import { db } from '@/config/firebase';

export interface OrganizationRules {
  rule1: {
    threshold: number;
    uom: string;
    description: string;
  };
  rule2: {
    threshold: number; // Multiplier
    description: string;
  };
  rule3: {
    threshold: number;
    uom: string;
    description: string;
  };
  rule4: {
    threshold: number; // Number of quotes
    description: string;
  };
  rule5: {
    threshold: number; // Number of unique approvers
    description: string;
  };
  rule6: {
    threshold: number; // Upward variance percentage
    description: string;
  };
  rule7: {
    threshold: number; // Downward variance percentage
    description: string;
  };
}

/**
 * Get all rules for an organization from referenceData_rules collection
 */
export async function getOrganizationRules(organizationId: string): Promise<OrganizationRules | null> {
  try {
    const rulesRef = collection(db, 'referenceData_rules');
    const q = query(rulesRef, where('organizationId', '==', organizationId));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      console.warn(`No rules found for organization: ${organizationId}`);
      return null;
    }

    const rules: any = {};
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const ruleNumber = data.number;
      if (ruleNumber) {
        rules[`rule${ruleNumber}`] = {
          id: doc.id,
          threshold: data.threshold || 0,
          uom: data.uom || data.currency || 'NA',
          description: data.description || '',
          active: data.active ?? true,
          ...data
        };
      }
    });

    return rules as OrganizationRules;
  } catch (error) {
    console.error('Error fetching organization rules:', error);
    throw error;
  }
}

/**
 * Update a specific rule for an organization
 * Creates the rule document if it doesn't exist
 */
export async function updateOrganizationRule(
  organizationId: string,
  ruleNumber: number,
  updates: { threshold?: number; uom?: string; description?: string; active?: boolean }
): Promise<void> {
  try {
    const ruleDocId = `${organizationId}_rule_${ruleNumber}`;
    const ruleRef = doc(db, 'referenceData_rules', ruleDocId);
    
    // Check if document exists first
    const docSnap = await getDoc(ruleRef);
    
    const updateData: any = {
      ...updates,
      updatedAt: new Date().toISOString()
    };

    // Keep currency field in sync for backwards compatibility
    if (updates.uom) {
      updateData.currency = updates.uom;
    }

    if (!docSnap.exists()) {
      // Create new document with required fields
      await setDoc(ruleRef, {
        organizationId,
        number: ruleNumber,
        name: `Rule ${ruleNumber}`,
        description: updates.description || `Rule ${ruleNumber}`,
        threshold: updates.threshold || 0,
        uom: updates.uom || 'LSL',
        currency: updates.uom || 'LSL',
        active: updates.active ?? true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      console.log(`Created Rule ${ruleNumber} for ${organizationId}`);
    } else {
      // Update existing document
      await updateDoc(ruleRef, updateData);
      console.log(`Updated Rule ${ruleNumber} for ${organizationId}`);
    }
  } catch (error) {
    console.error(`Error updating Rule ${ruleNumber}:`, error);
    throw error;
  }
}

/**
 * Get a summary of key thresholds for quick access
 * (Used by Organization Settings UI for display)
 */
export async function getRuleThresholds(organizationId: string): Promise<{
  rule1Threshold: number;
  rule2Multiplier: number;
  rule3Threshold: number;
  rule4QuotesRequired: number;
  rule5ApproversRequired: number;
  rule6UpwardVariance: number;
  rule7DownwardVariance: number;
  baseCurrency: string;
} | null> {
  try {
    const rules = await getOrganizationRules(organizationId);
    if (!rules) return null;

    return {
      rule1Threshold: rules.rule1?.threshold || 0,
      rule2Multiplier: rules.rule2?.threshold || 0,
      rule3Threshold: rules.rule3?.threshold || 0,
      rule4QuotesRequired: rules.rule4?.threshold || 0,
      rule5ApproversRequired: rules.rule5?.threshold || 0,
      rule6UpwardVariance: rules.rule6?.threshold || 5,
      rule7DownwardVariance: rules.rule7?.threshold || 20,
      baseCurrency: rules.rule1?.uom || 'LSL'
    };
  } catch (error) {
    console.error('Error fetching rule thresholds:', error);
    throw error;
  }
}

/**
 * Update multiple rules at once (batch update)
 * Used by Organization Settings when updating thresholds
 */
export async function updateOrganizationRules(
  organizationId: string,
  updates: {
    rule1Threshold?: number;
    rule2Multiplier?: number;
    rule3Threshold?: number;
    rule6UpwardVariance?: number;
    rule7DownwardVariance?: number;
  }
): Promise<void> {
  try {
    const promises: Promise<void>[] = [];

    if (updates.rule1Threshold !== undefined) {
      promises.push(
        updateOrganizationRule(organizationId, 1, { threshold: updates.rule1Threshold })
      );
    }

    if (updates.rule2Multiplier !== undefined) {
      promises.push(
        updateOrganizationRule(organizationId, 2, { threshold: updates.rule2Multiplier })
      );
    }

    if (updates.rule3Threshold !== undefined) {
      promises.push(
        updateOrganizationRule(organizationId, 3, { threshold: updates.rule3Threshold })
      );
    }

    if (updates.rule6UpwardVariance !== undefined) {
      promises.push(
        updateOrganizationRule(organizationId, 6, { threshold: updates.rule6UpwardVariance })
      );
    }

    if (updates.rule7DownwardVariance !== undefined) {
      promises.push(
        updateOrganizationRule(organizationId, 7, { threshold: updates.rule7DownwardVariance })
      );
    }

    await Promise.all(promises);
    console.log(`Batch updated rules for ${organizationId}`);
  } catch (error) {
    console.error('Error batch updating rules:', error);
    throw error;
  }
}

/**
 * Check if an organization has rules initialized
 */
export async function hasRulesInitialized(organizationId: string): Promise<boolean> {
  try {
    const rulesRef = collection(db, 'referenceData_rules');
    const q = query(rulesRef, where('organizationId', '==', organizationId));
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  } catch (error) {
    console.error('Error checking rules initialization:', error);
    return false;
  }
}

