/**
 * Vendor Mapping Script
 * Analyzes legacy vendor names from CSV and maps them to vendor codes in current system
 * Creates a mapping file for use during import
 */

import * as fs from 'fs';
import * as path from 'path';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

// Firebase configuration
const firebaseConfig = {
  apiKey: 'AIzaSyD0tA1fvWs5dCr-7JqJv_bxlay2Bhs72jQ',
  authDomain: 'pr-system-4ea55.firebaseapp.com',
  projectId: 'pr-system-4ea55',
  storageBucket: 'pr-system-4ea55.firebasestorage.app',
  messagingSenderId: '562987209098',
  appId: '1:562987209098:web:2f788d189f1c0867cb3873',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

interface CSVRow {
  [key: string]: string;
}

/**
 * Parse CSV file
 */
function parseCSV(filePath: string): CSVRow[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  if (lines.length < 2) {
    throw new Error('CSV file must have at least a header and one data row');
  }

  const headers = parseCSVLine(lines[0]);
  const rows: CSVRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: CSVRow = {};
    
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    
    rows.push(row);
  }

  return rows;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

/**
 * Normalize vendor name for matching
 */
function normalizeVendorName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '') // Remove special chars
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/\b(ltd|pty|inc|llc|corp|corporation|limited|proprietary|company|co)\b/gi, '') // Remove common suffixes
    .trim();
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = [];

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,     // deletion
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j - 1] + 1  // substitution
        );
      }
    }
  }

  return matrix[len1][len2];
}

/**
 * Calculate similarity between two strings using multiple methods
 */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = normalizeVendorName(str1);
  const s2 = normalizeVendorName(str2);
  
  // Exact match
  if (s1 === s2) return 1.0;
  
  // One contains the other (handles abbreviations)
  if (s1.includes(s2) || s2.includes(s1)) {
    const shorter = s1.length < s2.length ? s1 : s2;
    const longer = s1.length >= s2.length ? s1 : s2;
    // If shorter is at least 60% of longer, it's likely an abbreviation
    if (shorter.length / longer.length >= 0.6) {
      return 0.9;
    }
    return 0.75;
  }
  
  // Word-based similarity (handles word order differences)
  const words1 = s1.split(' ').filter(w => w.length > 1);
  const words2 = s2.split(' ').filter(w => w.length > 1);
  
  if (words1.length > 0 && words2.length > 0) {
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    const intersection = [...set1].filter(w => set2.has(w)).length;
    const union = set1.size + set2.size - intersection;
    const wordOverlap = union > 0 ? intersection / union : 0;
    
    // If most words match, it's likely the same vendor
    if (wordOverlap >= 0.6) {
      return Math.max(0.7, wordOverlap);
    }
  }
  
  // Levenshtein distance similarity (handles typos and misspellings)
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen > 0) {
    const distance = levenshteinDistance(s1, s2);
    const levenshteinSimilarity = 1 - (distance / maxLen);
    
    // Be generous with Levenshtein - if similarity is > 0.6, consider it a match
    if (levenshteinSimilarity >= 0.6) {
      return Math.max(levenshteinSimilarity, 0.65);
    }
    
    // For shorter strings, be even more generous
    if (maxLen <= 15 && levenshteinSimilarity >= 0.5) {
      return 0.6;
    }
  }
  
  // Check if key words match (first word, last word, etc.)
  if (words1.length > 0 && words2.length > 0) {
    if (words1[0] === words2[0] && words1[0].length >= 3) {
      return 0.55; // Same first word
    }
    if (words1[words1.length - 1] === words2[words2.length - 1] && 
        words1[words1.length - 1].length >= 3) {
      return 0.55; // Same last word
    }
  }
  
  return 0;
}

async function mapVendors() {
  try {
    // Authenticate if credentials are provided
    const auth = getAuth(app);
    const email = process.env.FIREBASE_AUTH_EMAIL || 'mso@1pwrafrica.com';
    const password = process.env.FIREBASE_AUTH_PASSWORD;
    
    if (!password) {
      console.log('⚠️  No FIREBASE_AUTH_PASSWORD environment variable set.');
      console.log('   Please set it or authenticate manually in Firebase Console.');
      console.log('   For now, attempting access without auth (may fail if rules require auth)...');
    } else {
      console.log('🔐 Authenticating with Firebase...');
      try {
        await signInWithEmailAndPassword(auth, email, password);
        console.log('✅ Authenticated successfully');
      } catch (authError: any) {
        console.error('❌ Authentication failed:', authError.message);
        console.log('   Continuing without authentication (may fail if rules require auth)...');
      }
    }
    
    console.log('📊 Loading vendors from Firestore...');
    let vendors: Array<{ code: string; name: string; normalized: string }> = [];
    
    try {
      const vendorsRef = collection(db, 'referenceData_vendors');
      const vendorsSnapshot = await getDocs(vendorsRef);
      
      vendorsSnapshot.forEach((doc) => {
        const data = doc.data();
        const code = data.code || data.Code || doc.id;
        const name = data.name || data.Name || '';
        if (code && name) {
          vendors.push({
            code: String(code),
            name,
            normalized: normalizeVendorName(name),
          });
        }
      });
      
      console.log(`✅ Loaded ${vendors.length} vendors from Firestore`);
    } catch (error: any) {
      console.log('⚠️  Could not load from Firestore, trying CSV fallback...');
      // Fallback to CSV file
      try {
        const csvPath = path.join(process.cwd(), 'Vendors.csv');
        if (fs.existsSync(csvPath)) {
          const csvContent = fs.readFileSync(csvPath, 'utf-8');
          const csvLines = csvContent.split('\n').filter(line => line.trim());
          const headers = parseCSVLine(csvLines[0]);
          
          for (let i = 1; i < csvLines.length; i++) {
            const values = parseCSVLine(csvLines[i]);
            const row: CSVRow = {};
            headers.forEach((header, index) => {
              row[header] = values[index] || '';
            });
            
            const code = row['Code'] || row['code'] || '';
            const name = row['Name'] || row['name'] || '';
            if (code && name) {
              vendors.push({
                code: String(code).trim(),
                name: name.trim(),
                normalized: normalizeVendorName(name),
              });
            }
          }
          console.log(`✅ Loaded ${vendors.length} vendors from CSV file`);
        } else {
          throw new Error('Vendors.csv not found');
        }
      } catch (csvError) {
        console.error('❌ Could not load vendors from CSV either:', csvError);
        throw new Error('Failed to load vendors from both Firestore and CSV');
      }
    }

    console.log('📄 Reading CSV file...');
    const csvPath = path.join(process.cwd(), 'Purchase request (Responses) - Form Responses 1.csv');
    const rows = parseCSV(csvPath);
    
    // Extract unique vendor names from CSV
    const vendorColumn = 'Who is the vendor?';
    const legacyVendors = new Set<string>();
    rows.forEach(row => {
      const vendor = row[vendorColumn]?.trim();
      if (vendor && vendor.length > 0) {
        legacyVendors.add(vendor);
      }
    });
    
    console.log(`✅ Found ${legacyVendors.size} unique vendor names in CSV`);

    // Create mapping
    const mapping: Array<{
      legacyName: string;
      vendorCode?: string;
      vendorName?: string;
      confidence: number;
      matchType: 'exact' | 'similar' | 'none';
    }> = [];

    legacyVendors.forEach(legacyName => {
      const normalized = normalizeVendorName(legacyName);
      let bestMatch: { code: string; name: string; similarity: number } | null = null;
      
      // Try exact match first
      let exactMatch = vendors.find(v => v.normalized === normalized);
      if (exactMatch) {
        mapping.push({
          legacyName,
          vendorCode: exactMatch.code,
          vendorName: exactMatch.name,
          confidence: 1.0,
          matchType: 'exact',
        });
        return;
      }
      
      // Try similar matches
      vendors.forEach(vendor => {
        const similarity = calculateSimilarity(legacyName, vendor.name);
        if (!bestMatch || similarity > bestMatch.similarity) {
          bestMatch = { code: vendor.code, name: vendor.name, similarity };
        }
      });
      
      // Lower threshold to be more generous with matches
      if (bestMatch && bestMatch.similarity >= 0.5) {
        mapping.push({
          legacyName,
          vendorCode: bestMatch.code,
          vendorName: bestMatch.name,
          confidence: bestMatch.similarity,
          matchType: 'similar',
        });
      } else {
        mapping.push({
          legacyName,
          confidence: 0,
          matchType: 'none',
        });
      }
    });

    // Save mapping to JSON file
    const mappingPath = path.join(process.cwd(), 'archive-vendor-mapping.json');
    fs.writeFileSync(mappingPath, JSON.stringify(mapping, null, 2));
    
    console.log('\n📋 Mapping Summary:');
    const exact = mapping.filter(m => m.matchType === 'exact').length;
    const similar = mapping.filter(m => m.matchType === 'similar').length;
    const none = mapping.filter(m => m.matchType === 'none').length;
    
    console.log(`   Exact matches: ${exact}`);
    console.log(`   Similar matches: ${similar}`);
    console.log(`   No matches: ${none}`);
    console.log(`\n✅ Mapping saved to: ${mappingPath}`);
    console.log('\n⚠️  Please review the mapping file and update any incorrect matches before running import.');
    
    // Show unmatched vendors
    if (none > 0) {
      console.log('\n📝 Unmatched vendors (need manual mapping):');
      mapping
        .filter(m => m.matchType === 'none')
        .slice(0, 20)
        .forEach(m => console.log(`   - ${m.legacyName}`));
      if (none > 20) {
        console.log(`   ... and ${none - 20} more`);
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

mapVendors();

