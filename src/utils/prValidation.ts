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
  
  const errors: string[] = [];
  
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
    // If PO is in PENDING_APPROVAL, only approvers can approve it
    if (pr.status === PRStatus.PENDING_APPROVAL && pr.type === 'PO') {
      return pr.approvers?.includes(user.id) || false;
    }
    
    // For other cases, procurement and approvers can approve
    return user.permissionLevel === 1 || user.permissionLevel === 3 || pr.approvers?.includes(user.id) || false;
  };

  console.log('Validating PR:', {
    preferredVendor: pr.preferredVendor,
    quotes: pr.quotes?.length,
    canPushToApprover: canPushToApprover(user),
    canApprove: canApprove(user, pr)
  });

  // 1. Check if user can take action
  if (targetStatus === PRStatus.PENDING_APPROVAL && !canPushToApprover(user)) {
    errors.push('Only system administrators and procurement users can push PRs to approver');
  } else if (targetStatus === PRStatus.APPROVED && !canApprove(user, pr)) {
    errors.push('You do not have permission to approve this document');
  }

  // 2. Get rules first since we need them for validation
  // Try multiple approaches to find the rules (type, name, or id field)
  const rule1 = rules.find(r => 
    r.type === 'RULE_1' || 
    r.name?.includes('RULE 1') || 
    r.id === 'rule_1' ||
    (r as any).number === '1'
  );
  const rule2 = rules.find(r => 
    r.type === 'RULE_2' || 
    r.name?.includes('RULE 2') || 
    r.id === 'rule_2' ||
    (r as any).number === '2'
  );

  console.log('Rules matching:', {
    rule1Found: !!rule1,
    rule2Found: !!rule2,
    rule1Data: rule1 ? { id: rule1.id, type: rule1.type, name: (rule1 as any).name, threshold: rule1.threshold } : null,
    rule2Data: rule2 ? { id: rule2.id, type: rule2.type, name: (rule2 as any).name, threshold: rule2.threshold } : null,
    allRules: rules.map(r => ({ 
      id: r.id, 
      type: r.type, 
      name: (r as any).name, 
      number: (r as any).number,
      threshold: r.threshold 
    }))
  });

  // If no rules found for organization, bypass rule checks
  if (!rule1 && !rule2) {
    console.warn('No rules found for organization - this should not happen in production!', {
      rulesProvided: rules.length,
      rulesData: rules
    });
    // Don't bypass - fail validation if rules are expected
    errors.push('Business rules are not configured for this organization. Please contact system administrator.');
    return { isValid: false, errors };
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

  console.log('Threshold check:', {
    lowestQuoteAmount,
    rule1Threshold: rule1?.threshold,
    rule2Threshold: rule2?.threshold,
    estimatedAmount: pr.estimatedAmount,
    isAboveRule1: rule1 ? lowestQuoteAmount >= rule1.threshold : false,
    isAboveRule2: rule2 ? lowestQuoteAmount >= rule2.threshold : false
  });

  const isAboveRule2Threshold = rule2 ? lowestQuoteAmount >= rule2.threshold : false;
  const isAboveRule1Threshold = rule1 ? lowestQuoteAmount >= rule1.threshold : false;

  // 5. Apply quote requirements based on thresholds
  if (isAboveRule2Threshold && rule2) {
    // Above Rule 2: Need at least 3 quotes with attachments
    if (validQuotes.length < 3) {
      errors.push(`At least three quotes with attachments are required for amounts above ${rule2.threshold} ${rule2.currency}`);
    }
  } else if (isAboveRule1Threshold && rule1) {
    const isPreferredVendor = pr.preferredVendor && await isVendorApproved(pr.preferredVendor.toLowerCase());
    const is4xRule1 = lowestQuoteAmount >= (rule1.threshold * 4);
    
    console.log('Rule 1 validation:', {
      isPreferredVendor,
      is4xRule1,
      quotesRequired: is4xRule1 ? 3 : (isPreferredVendor ? 1 : 3),
      quotesProvided: validQuotes.length,
      validQuotes: validQuotes.map(q => ({
        id: q.id,
        attachmentsCount: q.attachments?.length || 0
      }))
    });
    
    if (is4xRule1 && validQuotes.length < 3) {
      errors.push(`Three quotes with attachments are required for amounts above ${rule1.threshold * 4} ${rule1.currency}`);
    } else if (!isPreferredVendor && validQuotes.length < 3) {
      errors.push(`Three quotes with attachments are required for amounts above ${rule1.threshold} ${rule1.currency} unless using an approved vendor`);
    } else if (isPreferredVendor && validQuotes.length < 1) {
      errors.push(`At least one quote with attachment is required when using an approved vendor`);
    }
  }
  // Below Rule 1: Quotes are optional, no validation needed

  // 6. Check if there are approvers with sufficient permission
  const approvers = await approverService.getApprovers(pr.organization);
  console.log('Available approvers:', approvers);

  // Check if any approver has insufficient permissions
  const hasInsufficientApprover = approvers.some(approver => {
    // Level 1 and 2 can approve any amount
    if (approver.permissionLevel === 1 || approver.permissionLevel === 2) {
      return false;
    }
    
    // Senior Approvers (Level 2) can approve PRs of any value (per specifications)
    
    return false;
  });

  if (hasInsufficientApprover) {
    if (isAboveRule2Threshold && rule2) {
      errors.push(`Only Level 1 or 2 approvers can approve PRs above ${rule2.threshold} ${rule2.currency}`);
    } else if (isAboveRule1Threshold && rule1) {
      errors.push(`Only Level 1 or 2 approvers can approve PRs above ${rule1.threshold} ${rule1.currency}`);
    }
  }

  // Also check if there are any approvers at all
  if (approvers.length === 0) {
    errors.push('No approvers found for this organization');
  }

  // 7. Verify vendor status if preferred vendor is specified
  if (pr.preferredVendor) {
    const isApproved = await isVendorApproved(pr.preferredVendor.toLowerCase());
    if (!isApproved) {
      errors.push('Preferred vendor is not approved');
    }
  }

  // 8. Check adjudication requirements
  if (targetStatus === PRStatus.APPROVED && lowestQuoteAmount > rule2.threshold) {
    if (!pr.adjudication?.notes) {
      errors.push('Validation Error:\nAdjudication notes are required for high-value PRs');
    }
  }
  
  // Return validation result
  return {
    isValid: errors.length === 0,
    errors
  };
}
