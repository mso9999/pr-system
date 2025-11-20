/**
 * Import Archive PRs from CSV
 * One-time script to import legacy Google Forms purchase requests into Firestore
 */

import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { config } from 'dotenv';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, addDoc, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

// Load environment variables from .env file
config();

// Firebase configuration
const firebaseConfig = {
  apiKey: 'AIzaSyD0tA1fvWs5dCr-7JqJv_bxlay2Bhs72jQ',
  authDomain: 'pr-system-4ea55.firebaseapp.com',
  projectId: 'pr-system-4ea55',
  storageBucket: 'pr-system-4ea55.firebasestorage.app',
  messagingSenderId: '562987209098',
  appId: '1:562987209098:web:2f788d189f1c0867cb3873',
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

interface CSVRow {
  [key: string]: string;
}

interface CachedUserInfo {
  name?: string;
  firstName?: string;
  lastName?: string;
  department?: string;
}

/**
 * Get user by email from Firestore
 */
const userInfoCache = new Map<string, CachedUserInfo | null>();
const userLookupPromises = new Map<string, Promise<CachedUserInfo | null>>();
const activeUsersCache = new Map<string, { email: string; username: string; userData: any }>();

const COMPANY_DOMAIN = '1pwrafrica.com';

function normalizeEmail(email?: string): string {
  return (email || '').trim().toLowerCase();
}

function extractUsername(email: string): string {
  if (!email || !email.includes('@')) return '';
  return email.split('@')[0].toLowerCase().trim();
}

function capitalize(value: string): string {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function deriveNameParts(value: string): { firstName?: string; lastName?: string; displayName: string } {
  if (!value) {
    return { displayName: '' };
  }

  const cleaned = value
    .replace(/[_\.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) {
    return { displayName: value };
  }

  const parts = cleaned.split(' ');
  const firstName = capitalize(parts[0]);
  const lastName = parts.slice(1).map(capitalize).join(' ');
  const displayName = [firstName, lastName].filter(Boolean).join(' ') || value;

  return { firstName, lastName, displayName };
}

/**
 * Calculate similarity between two strings using multiple methods
 */
function calculateSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  
  // Exact match
  if (s1 === s2) return 1.0;
  
  // One contains the other (for abbreviations)
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;
  
  // Levenshtein distance
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1.0;
  
  const distance = levenshteinDistance(s1, s2);
  const similarity = 1 - (distance / maxLen);
  
  // Word overlap
  const words1 = s1.split(/[^a-z0-9]+/).filter(w => w.length > 0);
  const words2 = s2.split(/[^a-z0-9]+/).filter(w => w.length > 0);
  const commonWords = words1.filter(w => words2.includes(w));
  const wordOverlap = words1.length > 0 && words2.length > 0
    ? (commonWords.length * 2) / (words1.length + words2.length)
    : 0;
  
  // Combine metrics (weighted average)
  return (similarity * 0.5) + (wordOverlap * 0.5);
}

/**
 * Levenshtein distance calculation
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Find best matching active user for a given email using intelligent matching
 */
function findBestActiveUserMatch(email: string): { email: string; userData: any; confidence: number } | null {
  const username = extractUsername(email);
  if (!username) return null;
  
  // If it's already a valid company email, check for exact match first
  if (email.toLowerCase().endsWith(`@${COMPANY_DOMAIN}`)) {
    const exactMatch = activeUsersCache.get(email.toLowerCase());
    if (exactMatch) {
      return { email: exactMatch.email, userData: exactMatch.userData, confidence: 1.0 };
    }
  }
  
  // Find best match by username similarity
  let bestMatch: { email: string; userData: any; confidence: number } | null = null;
  let bestScore = 0;
  
  for (const [cachedEmail, cached] of activeUsersCache.entries()) {
    const userUsername = extractUsername(cachedEmail);
    if (!userUsername) continue;
    
    const similarity = calculateSimilarity(username, userUsername);
    
    // Only consider matches with reasonable confidence (>0.7)
    if (similarity > 0.7 && similarity > bestScore) {
      bestScore = similarity;
      bestMatch = { 
        email: cached.email, 
        userData: cached.userData, 
        confidence: similarity 
      };
    }
  }
  
  return bestMatch;
}

/**
 * Load all active users into cache for intelligent matching
 */
async function loadActiveUsers(): Promise<void> {
  try {
    const usersRef = collection(db, 'users');
    const snapshot = await getDocs(usersRef);
    
    snapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      const email = data.email;
      const isActive = data.isActive !== false; // Default to true if undefined
      
      // Only cache active users
      if (email && typeof email === 'string' && isActive) {
        const normalized = normalizeEmail(email);
        activeUsersCache.set(normalized, {
          email: normalized,
          username: extractUsername(email),
          userData: data
        });
      }
    });
    
    console.log(`✅ Loaded ${activeUsersCache.size} active users for intelligent matching`);
  } catch (error) {
    console.warn('Could not load active users:', error);
  }
}

async function lookupUserByEmail(email: string): Promise<CachedUserInfo | null> {
  const normalized = normalizeEmail(email);
  
  // First try intelligent matching with active users
  const bestMatch = findBestActiveUserMatch(normalized);
  if (bestMatch && bestMatch.confidence > 0.7) {
    const userData = bestMatch.userData;
    return {
      name: userData.name || userData.displayName || `${userData.firstName || ''} ${userData.lastName || ''}`.trim(),
      firstName: userData.firstName,
      lastName: userData.lastName,
      department: userData.department || ''
    };
  }
  
  // Fallback to exact lookup (for non-company domains or exact matches)
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', normalized));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const userData = querySnapshot.docs[0].data();
      const isActive = userData.isActive !== false;
      
      // Only return if user is active
      if (isActive) {
        return {
          name: userData.name || userData.displayName || `${userData.firstName || ''} ${userData.lastName || ''}`.trim(),
          firstName: userData.firstName,
          lastName: userData.lastName,
          department: userData.department || ''
        };
      }
    }
  } catch (error) {
    console.warn(`Could not lookup user for email ${email}:`, error);
  }
  return null;
}

async function createPlaceholderUser(email: string, fallbackName: string): Promise<CachedUserInfo> {
  const { firstName, lastName, displayName } = deriveNameParts(fallbackName || email.split('@')[0]);
  const now = new Date().toISOString();
  const docId = `legacy_${email.replace(/[^a-z0-9]/gi, '_')}`;

  const placeholderData = {
    email,
    firstName: firstName || displayName || email,
    lastName: lastName || '',
    name: displayName || email,
    department: '',
    organization: '1PWR LESOTHO',
    isActive: false,
    permissionLevel: 5,
    role: 'REQ',
    additionalOrganizations: [],
    createdAt: now,
    updatedAt: now,
    source: 'archive-import',
    isLegacy: true
  };

  await setDoc(doc(db, 'users', docId), placeholderData, { merge: true });
  console.log(`🆕 Created placeholder user for ${email} (docId: ${docId})`);

  return {
    name: displayName || email,
    firstName: firstName || displayName || email,
    lastName,
    department: ''
  };
}

async function getOrCreateUserInfo(email: string, fallbackName: string): Promise<CachedUserInfo | null> {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return null;
  }

  if (userInfoCache.has(normalized)) {
    return userInfoCache.get(normalized) || null;
  }

  if (userLookupPromises.has(normalized)) {
    return userLookupPromises.get(normalized)!;
  }

  const lookupPromise = (async () => {
    const existingUser = await lookupUserByEmail(normalized);
    if (existingUser) {
      userInfoCache.set(normalized, existingUser);
      userLookupPromises.delete(normalized);
      return existingUser;
    }

    try {
      const placeholder = await createPlaceholderUser(normalized, fallbackName);
      userInfoCache.set(normalized, placeholder);
      userLookupPromises.delete(normalized);
      return placeholder;
    } catch (error) {
      console.warn(`Failed to create placeholder user for ${normalized}:`, error);
      userInfoCache.set(normalized, null);
      userLookupPromises.delete(normalized);
      return null;
    }
  })();

  userLookupPromises.set(normalized, lookupPromise);
  return lookupPromise;
}

/**
 * Extract department from expense type or project field
 * Expense type format: "2:Engineering R&D" -> "Engineering R&D"
 */
function extractLabeledValue(value?: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const match = trimmed.match(/^\s*\d+\s*:\s*(.+)$/);
  if (match && match[1]) {
    return match[1].trim();
  }
  return trimmed;
}

/**
 * Map CSV row to ArchivePR format
 */
async function mapCSVRowToArchivePR(row: CSVRow, index: number): Promise<any> {
  // Extract each field individually from the CSV row
  const timestamp = (row['Timestamp'] || '').trim();
  const email = (row['Email Address'] || '').trim();
  const description = (row['Please provide a brief description of the items being requested.'] || '').trim();
  const vendor = (row['Who is the vendor?'] || '').trim();
  const currency = (row['What currency is this purchase?'] || '').trim();
  const cost = (row['Please estimate total cost of request as a number only.'] || '').trim();
  const urgent = (row['Does this request relate to an urgent issue, for example, vehicle breakdown or minigrid repair needed?'] || '').trim();
  const paymentFormat = (row['What format of payment is needed for this request?  If payment is needed or could be accepted in multiple forms, select "Other" and provide a brief explanation'] || '').trim();
  const site = (row['If purchase relates to a specific 1PWR project site, select below.  Otherwise select "HQ".  If purchase is for multiple sites, please select all that apply.'] || '').trim();
  const entity = (row['Which entity should be paying this expense?  NOTE:  generally only materials/equipment expenses related to the minigrids projects may be charged to SMP.'] || '').trim();
  const project = (row['Which project is this expense for?'] || '').trim();
  const expenseType = (row['Which expense type is this?  Please select all that apply.'] || '').trim();
  const reason = (row['Please provide reason / context for this request.  For example:  site work at Ha Makebe, tracker construction, Pajero refueling, new employee PPE, etc.'] || '').trim();
  const vehicle = (row['If this expense is for a vehicle, please indicate which vehicle.  If this is for a different vehicle (e.g., rental) please select "Other" and provide explanation.'] || '').trim();
  const budgetApproval = (row['Was any part of this expense already approved on a monthly budget?  If part of the request was approved, select "Other" and provide brief explanation (which thrust area and which budget lines).'] || '').trim();
  const deadline = (row['What is the deadline date for making this purchase?  Recall that requests should be made a minimum of 24 hours in advance.'] || '').trim();
  const attachments = (row['Please attach any relevant files:  quotations, fuel usage calculator, banking details for EFT payment, PPE schedule, etc.'] || '').trim();
  const otherInfo = (row['Please provide any other information the finance team might require to process this request.'] || '').trim();
  const approver = (row['Who is the approver for this request?'] || '').trim();

  // Parse amount
  let amount: number | undefined;
  if (cost) {
    const cleaned = cost.replace(/[^\d.-]/g, '');
    const parsed = parseFloat(cleaned);
    if (!isNaN(parsed) && parsed > 0) {
      amount = parsed;
    }
  }

  // Parse date
  let submittedDate: string | undefined;
  if (timestamp) {
    try {
      const date = new Date(timestamp);
      if (!isNaN(date.getTime())) {
        submittedDate = date.toISOString();
      }
    } catch (e) {
      // Keep as string if parsing fails
      submittedDate = timestamp;
    }
  }

  const derivedRequestorName = deriveNameParts(email.split('@')[0] || '').displayName || email;
  let requestorName: string = derivedRequestorName || email || 'Unknown';

  const projectLabel = extractLabeledValue(project);
  const expenseTypeLabel = extractLabeledValue(expenseType);

  // All archive PRs are for 1PWR LESOTHO
  const organization = '1PWR LESOTHO';

  // Use description as-is (reason is stored separately)
  const fullDescription = description || '';

  // Requestor info and department mapping with intelligent matching
  const cacheKey = normalizeEmail(email);
  let cachedUser = cacheKey ? userInfoCache.get(cacheKey) : null;
  if (cacheKey && cachedUser === undefined) {
    cachedUser = await getOrCreateUserInfo(email, requestorName);
    userInfoCache.set(cacheKey, cachedUser);
  } else if (!cachedUser && cacheKey && !userInfoCache.has(cacheKey)) {
    cachedUser = await getOrCreateUserInfo(email, requestorName);
    userInfoCache.set(cacheKey, cachedUser);
  }

  const departmentFromUser = cachedUser?.department?.trim();
  if (cachedUser?.name) {
    requestorName = cachedUser.name;
  }

  // Parse attachments into list
  const attachmentEntries = attachments
    ? attachments
        .split(/[\n\r;,]+/)
        .map(item => item.trim())
        .filter(Boolean)
    : [];

  // Map vendor name to vendor code using mapping file
  let vendorCode: string | undefined;
  let vendorName: string | undefined;
  if (vendor && vendorMapping) {
    const mapping = vendorMapping.find(m => m.legacyName === vendor);
    if (mapping && mapping.vendorCode) {
      vendorCode = mapping.vendorCode;
      vendorName = mapping.vendorName || vendor;
    } else {
      vendorName = vendor;
    }
  } else if (vendor) {
    vendorName = vendor;
  }

  const legacyResponses = Object.entries(row).map(([question, answer]) => ({
    question,
    answer: (answer || '').trim()
  }));

  // Build the document
  const doc: any = {
    // Core fields
    submittedDate: submittedDate || new Date().toISOString(),
    requestorName: cachedUser?.name || requestorName,
    requestorEmail: email,
    description: fullDescription,
    reason: reason || '',
    currency: currency || 'LSL',
    organization,
    site: site || 'HQ',
    projectCategory: projectLabel || project || '',
    expenseType: expenseTypeLabel || expenseType || '',
    department: departmentFromUser || projectLabel || '',
    vehicle: vehicle || '',
    requiredDate: deadline || '',
    paymentType: paymentFormat || '',
    ...(urgent ? { urgent } : {}),
    ...(budgetApproval ? { budgetApproval } : {}),
    ...(attachmentEntries.length ? { attachments: attachmentEntries } : {}),
    ...(otherInfo ? { otherInfo } : {}),
    approver: approver || '',
    entity: entity || '',
    legacyResponses,
    
    // Store all original fields for reference
    originalData: {
      timestamp,
      email,
      description,
      reason,
      vendor: vendor || '',
      ...(vendorCode ? { vendorCode } : {}),
      currency,
      cost,
      urgent,
      paymentFormat,
      site,
      entity,
      project,
      expenseType,
      vehicle,
      budgetApproval,
      deadline,
      attachments,
      otherInfo,
      approver,
    },
    
    // Metadata
    importedAt: new Date().toISOString(),
    sourceFile: 'Purchase request (Responses) - Form Responses 1.csv',
    rowNumber: index + 1,
  };

  // Only add amount if it's a valid number
  if (amount !== undefined && amount !== null && !isNaN(amount)) {
    doc.amount = amount;
  }

  // Only add vendor fields if they exist
  if (vendorCode) {
    doc.vendorCode = vendorCode;
  }
  if (vendorName) {
    doc.vendorName = vendorName;
  }
  if (vendor) {
    doc.vendor = vendor;
  }

  return doc;
}

// Load vendor mapping if available
let vendorMapping: Array<{
  legacyName: string;
  vendorCode?: string;
  vendorName?: string;
  confidence: number;
  matchType: 'exact' | 'similar' | 'none';
}> | null = null;

try {
  const mappingPath = path.join(process.cwd(), 'archive-vendor-mapping.json');
  if (fs.existsSync(mappingPath)) {
    const mappingContent = fs.readFileSync(mappingPath, 'utf-8');
    vendorMapping = JSON.parse(mappingContent);
    console.log(`✅ Loaded vendor mapping: ${vendorMapping?.length} mappings`);
  }
} catch (error) {
  console.log('⚠️  Could not load vendor mapping file, will use vendor names as-is');
}

/**
 * Main import function
 */
async function importArchivePRs() {
  try {
    // Authenticate with Firebase
    const auth = getAuth(app);
    const email = process.env.FIREBASE_AUTH_EMAIL || process.env.VITE_TEST_EMAIL || 'mso@1pwrafrica.com';
    const password = process.env.FIREBASE_AUTH_PASSWORD || process.env.VITE_TEST_PASSWORD || '1PWR00';
    
    console.log('🔐 Authenticating with Firebase...');
    try {
      await signInWithEmailAndPassword(auth, email, password);
      console.log('✅ Authentication successful');
    } catch (authError: any) {
      console.error('❌ Authentication failed:', authError.message);
      console.log('   Please check your credentials.');
      process.exit(1);
    }

    // Try cleaned CSV first, fall back to original
    const cleanedCsvPath = path.join(process.cwd(), 'Purchase request (Responses) - Form Responses 1 - CLEANED.csv');
    const originalCsvPath = path.join(process.cwd(), 'Purchase request (Responses) - Form Responses 1.csv');
    
    let csvPath = cleanedCsvPath;
    if (!fs.existsSync(csvPath)) {
      console.log('⚠️  Cleaned CSV not found, using original CSV');
      csvPath = originalCsvPath;
    } else {
      console.log('✅ Using cleaned CSV file');
    }
    
    if (!fs.existsSync(csvPath)) {
      throw new Error(`CSV file not found at: ${csvPath}`);
    }

    // Load active users first for intelligent matching
    console.log('👥 Loading active users for intelligent email matching...');
    await loadActiveUsers();
    
    console.log('📄 Reading CSV file...');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    
    // Parse CSV with proper handling of multi-line fields
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
      trim: true,
    }) as CSVRow[];
    
    console.log(`✅ Parsed ${records.length} rows from CSV`);

    console.log('🔄 Starting import to Firestore...');
    const archiveRef = collection(db, 'archivePRs');
    
    let successCount = 0;
    let errorCount = 0;
    const batchSize = 25; // Smaller batches to avoid overwhelming Firestore

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1} (rows ${i + 1}-${Math.min(i + batchSize, records.length)})...`);

      const promises = batch.map(async (row, batchIndex) => {
        try {
          const archivePR = await mapCSVRowToArchivePR(row, i + batchIndex);
          await addDoc(archiveRef, archivePR);
          successCount++;
          if ((i + batchIndex + 1) % 50 === 0) {
            console.log(`  ✅ Imported ${i + batchIndex + 1} records...`);
          }
        } catch (error: any) {
          errorCount++;
          if (error.code === 'already-exists') {
            console.warn(`  ⚠️  Row ${i + batchIndex + 1} already exists, skipping...`);
          } else {
            console.error(`  ❌ Error importing row ${i + batchIndex + 1}:`, error.message || error);
          }
        }
      });

      await Promise.all(promises);
      
      // Small delay between batches to avoid rate limiting
      if (i + batchSize < records.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    console.log('\n✅ Import complete!');
    console.log(`   Successfully imported: ${successCount} records`);
    console.log(`   Errors: ${errorCount} records`);
    console.log(`   Total: ${records.length} records`);
    console.log(`   User cache size: ${userInfoCache.size}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  }
}

// Run import
importArchivePRs();
