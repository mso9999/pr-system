import { User, UserRole } from '../types/user';
import { PRRequest } from '../types/pr';
import { Rule } from '../types/referenceData';
import { convertAmount } from './currencyConverter';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { PRStatus } from '../types/pr';
import { approverService } from '../services/approver';

const VENDORS_COLLECTION = 'referenceData_vendors';

interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

// Use centralized permission levels from config
import { PERMISSION_LEVELS } from '../config/permissions';

async function isVendorApproved(vendorId: string): Promise<boolean> {
  const db = getFirestore();
  // Normalize vendor ID to lowercase
  const normalizedVendorId = vendorId.toLowerCase();
  console.log('Checking vendor approval:', { original: vendorId, normalized: normalizedVendorId });
  
  const vendorRef = doc(db, VENDORS_COLLECTION, normalizedVendorId);
  const vendorDoc = await getDoc(vendorRef);
  
  if (!vendorDoc.exists()) {
    console.warn(`Vendor not found: ${vendorId} (normalized: ${normalizedVendorId})`);
    return false;
  }
  
  const data = vendorDoc.data();
  const isApproved = data.isApproved === true || data.approved === true;
  console.log(`Vendor ${vendorId} data:`, data);
  console.log(`Vendor ${vendorId} approval status:`, isApproved);
  return isApproved;
}

export async function validatePRForApproval(
  pr: PRRequest,
  rules: Rule[],
  user: User,
  targetStatus: PRStatus = PRStatus.PENDING_APPROVAL
): Promise<ValidationResult> {
  console.log('Validating PR with user:', {
    userRole: user.role,
    permissionLevel: user.permissionLevel,
    email: user.email
  });
  
  // Categorized errors for better organization
  const quoteErrors: string[] = [];
  const approverErrors: string[] = [];
  const vendorErrors: string[] = [];
  const permissionErrors: string[] = [];
  const otherErrors: string[] = [];
  
  // Helper function to check if user can push to approver
  const canPushToApprover = (user: User): boolean => {
    console.log('Checking if user can push to approver:', {
      role: user.role,
      permissionLevel: user.permissionLevel,
      email: user.email
    });
    
    // Only Level 1 (admin) or Level 3 (procurement) can push to approver
    return user.permissionLevel === 1 || user.permissionLevel === 3;
  };

  // Helper function to check if user can approve
  const canApprove = (user: User, pr: PRRequest): boolean => {
    // For PRs in PENDING_APPROVAL, check if user is assigned approver OR has approval permissions
    if (pr.status === PRStatus.PENDING_APPROVAL) {
      // Check if user is an assigned approver
      const isAssignedApprover = pr.approvers?.includes(user.id) || 
                                 user.id === pr.approver || 
                                 user.id === pr.approver2;
      
      // Check if user has general approval permissions (Level 1, 2, 4, or 6)
      // Level 3 (Procurement) can process but NOT approve
      const hasApprovalPermissions = user.permissionLevel === 1 || // Admin
                                    user.permissionLevel === 2 || // Senior Approver
                                    user.permissionLevel === 4 || // Finance Admin
                                    user.permissionLevel === 6;   // Finance Approver
      
      return isAssignedApprover || hasApprovalPermissions;
    }
    
    // For other cases, approvers and finance approvers can approve (but not procurement)
    return user.permissionLevel === 1 || user.permissionLevel === 2 || user.permissionLevel === 4 || user.permissionLevel === 6 || pr.approvers?.includes(user.id) || false;
  };

  console.log('Validating PR:', {
    preferredVendor: pr.preferredVendor,
    quotes: pr.quotes?.length,
    canPushToApprover: canPushToApprover(user),
    canApprove: canApprove(user, pr)
  });

  // 1. Check if user can take action
  if (targetStatus === PRStatus.PENDING_APPROVAL && !canPushToApprover(user)) {
    permissionErrors.push('Only system administrators and procurement users can push PRs to approver');
  } else if (targetStatus === PRStatus.APPROVED && !canApprove(user, pr)) {
    permissionErrors.push('You do not have permission to approve this document');
  }

  // 2. Get all 5 rules for comprehensive validation
  const rule1 = rules.find(r => (r as any).number === 1 || (r as any).number === '1');
  const rule2 = rules.find(r => (r as any).number === 2 || (r as any).number === '2');
  const rule3 = rules.find(r => (r as any).number === 3 || (r as any).number === '3');
  const rule4 = rules.find(r => (r as any).number === 4 || (r as any).number === '4');
  const rule5 = rules.find(r => (r as any).number === 5 || (r as any).number === '5');

  console.log('Rules matching:', {
    rule1: rule1 ? { threshold: rule1.threshold, currency: rule1.currency } : null,
    rule2: rule2 ? { threshold: rule2.threshold, desc: 'multiplier' } : null,
    rule3: rule3 ? { threshold: rule3.threshold, currency: rule3.currency } : null,
    rule4: rule4 ? { threshold: rule4.threshold, desc: 'number of quotes' } : null,
    rule5: rule5 ? { threshold: rule5.threshold, desc: 'number of approvers' } : null,
    allRules: rules.map(r => ({ 
      id: r.id, 
      name: (r as any).name, 
      number: (r as any).number,
      threshold: r.threshold 
    }))
  });

  // If no rules found for organization, fail validation
  if (!rule1 || !rule2 || !rule3 || !rule4 || !rule5) {
    console.warn('Incomplete rules configuration for organization', {
      rulesProvided: rules.length,
      rule1: !!rule1,
      rule2: !!rule2,
      rule3: !!rule3,
      rule4: !!rule4,
      rule5: !!rule5
    });
    otherErrors.push('Business rules are not configured for this organization. Please contact system administrator.');
    return { isValid: false, errors: otherErrors };
  }

  // 3. Early validation of quotes
  const hasQuotes = pr.quotes && pr.quotes.length > 0;
  const validQuotes = hasQuotes ? pr.quotes.filter(quote => {
    // For quotes below Rule 1 threshold, attachments are optional
    if (rule1 && quote.amount < rule1.threshold) {
      return true;
    }
    // Above Rule 1 threshold, quote needs attachments
    const attachments = quote.attachments || [];
    const hasAttachments = attachments.length > 0;
    console.log('Validating quote:', {
      quoteId: quote.id,
      hasAttachments,
      attachmentsCount: attachments.length,
      attachments
    });
    return hasAttachments;
  }) : [];

  console.log('Quote validation summary:', {
    totalQuotes: pr.quotes?.length || 0,
    validQuotesCount: validQuotes.length,
    quotesWithAttachments: validQuotes.map(q => ({
      id: q.id,
      attachmentsCount: q.attachments?.length || 0,
      attachments: q.attachments || []
    }))
  });

  // 4. Convert quote amounts to rule currency for comparison
  let lowestQuoteAmount = 0;
  const defaultCurrency = 'LSL';

  if (hasQuotes) {
    console.log('Converting quote amounts:', {
      quotes: pr.quotes,
      targetCurrency: rule1?.currency || defaultCurrency
    });

    const convertedQuoteAmounts = await Promise.all(
      pr.quotes.map(async quote => ({
        quote,
        convertedAmount: await convertAmount(
          quote.amount || 0,
          quote.currency || defaultCurrency,
          rule1?.currency || defaultCurrency
        )
      }))
    );

    // Get lowest quote amount for threshold comparison
    if (convertedQuoteAmounts.length > 0) {
      lowestQuoteAmount = Math.min(...convertedQuoteAmounts.map(q => q.convertedAmount));
    }
  }
  // If no quotes or amounts, use estimated amount for threshold comparison
  if (lowestQuoteAmount === 0) {
    lowestQuoteAmount = pr.estimatedAmount || 0;
  }

  // Calculate the key thresholds
  const rule1Threshold = rule1.threshold; // e.g., 1500 LSL
  const rule1xRule2Threshold = rule1.threshold * rule2.threshold; // e.g., 1500 × 4 = 6000 LSL
  const rule3Threshold = rule3.threshold; // e.g., 50000 LSL
  const quotesRequired = rule4.threshold; // e.g., 3 quotes
  const approversRequired = rule5.threshold; // e.g., 2 approvers

  console.log('Threshold check:', {
    lowestQuoteAmount,
    rule1Threshold,
    rule1xRule2Threshold,
    rule3Threshold,
    quotesRequired,
    approversRequired,
    estimatedAmount: pr.estimatedAmount
  });

  // Check if vendor is approved
  const isApprovedVendor = pr.preferredVendor && await isVendorApproved(pr.preferredVendor.toLowerCase());

  // 5. Apply quote requirements based on thresholds
  // Business Rules:
  // - Below Rule 1: No quotes required
  // - Rule 1 to Rule 1×Rule 2: 1 quote (0 if approved vendor)
  // - Rule 1×Rule 2 to Rule 3: [Rule 4] quotes (1 if approved vendor)
  // - Above Rule 3: [Rule 4] quotes (Rule 4 - 1 if approved vendor)

  if (lowestQuoteAmount < rule1Threshold) {
    // Below Rule 1: No quotes required, any approver level OK
    console.log('Below Rule 1: No quotes required');
  } else if (lowestQuoteAmount < rule1xRule2Threshold) {
    // Between Rule 1 and Rule 1×Rule 2: 1 quote required (0 if approved vendor)
    const requiredQuotes = isApprovedVendor ? 0 : 1;
    console.log(`Between Rule 1 and Rule 1×Rule 2: ${requiredQuotes} quote(s) required`, {
      isApprovedVendor,
      validQuotes: validQuotes.length
    });
    
    if (validQuotes.length < requiredQuotes) {
      if (isApprovedVendor) {
        // Should not happen since requiredQuotes = 0
      } else {
        quoteErrors.push(`At least one quote with attachment is required for amounts between ${rule1Threshold} and ${rule1xRule2Threshold} ${rule1.currency}.`);
      }
    }
  } else if (lowestQuoteAmount < rule3Threshold) {
    // Between Rule 1×Rule 2 and Rule 3: [Rule 4] quotes (1 if approved vendor)
    const requiredQuotes = isApprovedVendor ? 1 : quotesRequired;
    console.log(`Between Rule 1×Rule 2 and Rule 3: ${requiredQuotes} quote(s) required`, {
      isApprovedVendor,
      validQuotes: validQuotes.length
    });
    
    if (validQuotes.length < requiredQuotes) {
      if (isApprovedVendor) {
        quoteErrors.push(`At least one quote with attachment is required for amounts between ${rule1xRule2Threshold} and ${rule3Threshold} ${rule1.currency} when using an approved vendor.`);
      } else {
        quoteErrors.push(`At least ${quotesRequired} quotes with attachments are required for amounts between ${rule1xRule2Threshold} and ${rule3Threshold} ${rule1.currency}. (Use an approved vendor to reduce to 1 quote.)`);
      }
    }
  } else {
    // Above Rule 3: [Rule 4] quotes required ([Rule 4] - 1 if approved vendor)
    const requiredQuotes = isApprovedVendor ? (quotesRequired - 1) : quotesRequired;
    console.log(`Above Rule 3: ${requiredQuotes} quote(s) required, ${approversRequired} approvers required`, {
      isApprovedVendor,
      validQuotes: validQuotes.length
    });
    
    if (validQuotes.length < requiredQuotes) {
      if (isApprovedVendor) {
        quoteErrors.push(`At least ${quotesRequired - 1} quotes with attachments are required for amounts above ${rule3Threshold} ${rule3.currency} when using an approved vendor.`);
      } else {
        quoteErrors.push(`At least ${quotesRequired} quotes with attachments are required for amounts above ${rule3Threshold} ${rule3.currency}. (Use an approved vendor to reduce to ${quotesRequired - 1} quotes.)`);
      }
    }
    
    // Check dual approval requirement for high-value PRs
    // Check both new format (approver + approver2) and old format (approvers array)
    const assignedApproversCount = pr.approver2 ? 2 : (pr.approver ? 1 : 0);
    const oldFormatCount = pr.approvers?.length || 0;
    const actualApproversCount = Math.max(assignedApproversCount, oldFormatCount);
    
    console.log('Dual approver check:', {
      approver: pr.approver,
      approver2: pr.approver2,
      approvers: pr.approvers,
      assignedApproversCount,
      oldFormatCount,
      actualApproversCount,
      required: approversRequired
    });
    
    if (actualApproversCount < approversRequired) {
      approverErrors.push(`At least ${approversRequired} unique approvers are required for amounts above ${rule3Threshold} ${rule3.currency}. Please assign a second approver before pushing to approval.`);
    }
  }

  // 6. Check approver permission level requirements based on amount
  // Business Rules:
  // - Below Rule 1: Any approver level can approve (Levels 1, 2, 4, 6)
  // - Above Rule 1: Only Level 1 (Admin) or Level 2 (Senior Approver) can approve
  // - Level 6 (Finance Approver) and Level 4 (Finance Admin) can only approve up to Rule 1 threshold
  
  if (lowestQuoteAmount >= rule1Threshold) {
    // Above Rule 1 threshold - need Level 1 or Level 2
    const assignedApprovers = await approverService.getApprovers(pr.organization);
    console.log('Checking approver levels for amount above Rule 1:', {
      amount: lowestQuoteAmount,
      threshold: rule1Threshold,
      assignedApprovers: assignedApprovers.map(a => ({ id: a.id, name: a.name, level: a.permissionLevel }))
    });
    
    // Check if PR has Level 1 or Level 2 approvers assigned
    const hasHighLevelApprover = assignedApprovers.some(approver => 
      approver.permissionLevel === 1 || approver.permissionLevel === 2
    );
    
    if (!hasHighLevelApprover && assignedApprovers.length > 0) {
      // There are approvers, but none are Level 1 or 2
      approverErrors.push(`Amounts above ${rule1Threshold} ${rule1.currency} require a Level 1 (Admin) or Level 2 (Senior Approver) for approval. Finance Approvers (Level 6) and Finance Admins (Level 4) can only approve amounts up to ${rule1Threshold} ${rule1.currency}.`);
    } else if (assignedApprovers.length === 0) {
      approverErrors.push('No approvers found for this organization');
    }
  }

  // 7. Verify vendor status if preferred vendor is specified
  // Note: Approved vendor is NOT a requirement - it just reduces quote requirements
  // If quote requirements are already met, vendor approval status doesn't matter
  // This check is informational only and does NOT block progression

  // NOTE: Adjudication notes validation is handled in ApproverActions.tsx
  // Notes are provided during the approval action, not stored on PR beforehand
  // The ApproverActions component validates notes based on:
  // - Dual approval requirement (over Rule 3 threshold)
  // - Non-lowest quote selection
  // This validation happens before submission, so we don't need to check here
  
  // Combine all errors with category headers for better clarity
  const allErrors: string[] = [];
  
  if (quoteErrors.length > 0) {
    allErrors.push('QUOTE REQUIREMENTS:');
    quoteErrors.forEach(err => allErrors.push(`• ${err}`));
  }
  
  if (approverErrors.length > 0) {
    if (allErrors.length > 0) allErrors.push(''); // Add blank line between sections
    allErrors.push('APPROVER REQUIREMENTS:');
    approverErrors.forEach(err => allErrors.push(`• ${err}`));
  }
  
  if (vendorErrors.length > 0) {
    if (allErrors.length > 0) allErrors.push(''); // Add blank line between sections
    allErrors.push('VENDOR STATUS:');
    vendorErrors.forEach(err => allErrors.push(`• ${err}`));
  }
  
  if (permissionErrors.length > 0) {
    if (allErrors.length > 0) allErrors.push(''); // Add blank line between sections
    allErrors.push('PERMISSIONS:');
    permissionErrors.forEach(err => allErrors.push(`• ${err}`));
  }
  
  if (otherErrors.length > 0) {
    if (allErrors.length > 0) allErrors.push(''); // Add blank line between sections
    otherErrors.forEach(err => allErrors.push(`• ${err}`));
  }
  
  // Return validation result
  return {
    isValid: allErrors.length === 0,
    errors: allErrors
  };
}
