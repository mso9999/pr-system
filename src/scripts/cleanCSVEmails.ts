/**
 * Clean CSV Email Addresses Script
 * Intelligently maps email typos to existing users and creates a cleaned CSV
 */

import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { config } from 'dotenv';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

// Load environment variables
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

const COMPANY_DOMAIN = '1pwrafrica.com';

/**
 * Extract username from email (part before @)
 */
function extractUsername(email: string): string {
  if (!email || !email.includes('@')) return '';
  return email.split('@')[0].toLowerCase().trim();
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
 * Find best matching user for a given email
 */
function findBestMatch(
  email: string,
  existingUsers: Array<{ email: string; username: string }>
): { email: string; confidence: number } | null {
  const username = extractUsername(email);
  if (!username) return null;
  
  // If it's already a valid company email, check if user exists
  if (email.toLowerCase().endsWith(`@${COMPANY_DOMAIN}`)) {
    const exactMatch = existingUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (exactMatch) {
      return { email: exactMatch.email, confidence: 1.0 };
    }
  }
  
  // Find best match by username similarity
  let bestMatch: { email: string; confidence: number } | null = null;
  let bestScore = 0;
  
  for (const user of existingUsers) {
    const userUsername = extractUsername(user.email);
    if (!userUsername) continue;
    
    const similarity = calculateSimilarity(username, userUsername);
    
    // Only consider matches with reasonable confidence
    if (similarity > 0.6 && similarity > bestScore) {
      bestScore = similarity;
      bestMatch = { email: user.email, confidence: similarity };
    }
  }
  
  // If we found a good match (confidence > 0.7), use it
  if (bestMatch && bestMatch.confidence > 0.7) {
    return bestMatch;
  }
  
  // If no good match found, return null (will keep original)
  return null;
}

/**
 * Main function to clean CSV emails
 */
async function cleanCSVEmails() {
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
      process.exit(1);
    }

    // Load existing users
    console.log('📋 Loading existing users from Firestore...');
    const usersRef = collection(db, 'users');
    const usersSnapshot = await getDocs(usersRef);
    
    const existingUsers: Array<{ email: string; username: string }> = [];
    usersSnapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      const userEmail = data.email;
      if (userEmail && typeof userEmail === 'string') {
        existingUsers.push({
          email: userEmail,
          username: extractUsername(userEmail)
        });
      }
    });
    
    console.log(`✅ Loaded ${existingUsers.length} existing users`);
    
    // Load CSV
    const csvPath = path.join(process.cwd(), 'Purchase request (Responses) - Form Responses 1.csv');
    if (!fs.existsSync(csvPath)) {
      throw new Error(`CSV file not found at: ${csvPath}`);
    }
    
    console.log('📄 Reading CSV file...');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
      trim: true,
    }) as Array<Record<string, string>>;
    
    console.log(`✅ Parsed ${records.length} rows from CSV`);
    
    // Process emails
    console.log('🔍 Analyzing email addresses...');
    const emailMapping = new Map<string, { original: string; corrected: string; confidence: number }>();
    const uniqueEmails = new Set<string>();
    
    // Collect all unique emails
    records.forEach(row => {
      const email = (row['Email Address'] || '').trim();
      if (email) {
        uniqueEmails.add(email.toLowerCase());
      }
    });
    
    console.log(`📊 Found ${uniqueEmails.size} unique email addresses`);
    
    // Map each email
    let mappedCount = 0;
    let keptCount = 0;
    
    for (const originalEmail of uniqueEmails) {
      const match = findBestMatch(originalEmail, existingUsers);
      
      if (match) {
        emailMapping.set(originalEmail, {
          original: originalEmail,
          corrected: match.email,
          confidence: match.confidence
        });
        mappedCount++;
      } else {
        // Keep original if no good match found
        emailMapping.set(originalEmail, {
          original: originalEmail,
          corrected: originalEmail,
          confidence: 0
        });
        keptCount++;
      }
    }
    
    console.log(`\n📊 Email mapping results:`);
    console.log(`   Mapped to existing users: ${mappedCount}`);
    console.log(`   Kept as-is: ${keptCount}`);
    
    // Show some examples
    console.log(`\n📋 Sample mappings (first 20):`);
    let shown = 0;
    for (const [original, mapping] of emailMapping.entries()) {
      if (mapping.corrected !== original && shown < 20) {
        console.log(`   ${original} → ${mapping.corrected} (confidence: ${(mapping.confidence * 100).toFixed(1)}%)`);
        shown++;
      }
    }
    
    // Create cleaned CSV
    console.log('\n✏️  Creating cleaned CSV...');
    const cleanedRecords = records.map(row => {
      const originalEmail = (row['Email Address'] || '').trim();
      const mapping = emailMapping.get(originalEmail.toLowerCase());
      if (mapping && mapping.corrected !== originalEmail) {
        return {
          ...row,
          'Email Address': mapping.corrected
        };
      }
      return row;
    });
    
    // Write cleaned CSV
    const outputPath = path.join(process.cwd(), 'Purchase request (Responses) - Form Responses 1 - CLEANED.csv');
    const cleanedCSV = stringify(cleanedRecords, {
      header: true,
      columns: Object.keys(records[0] || {})
    });
    
    fs.writeFileSync(outputPath, cleanedCSV);
    console.log(`✅ Cleaned CSV saved to: ${outputPath}`);
    
    // Save mapping file for reference
    const mappingPath = path.join(process.cwd(), 'email-mapping.json');
    const mappingData = Array.from(emailMapping.entries())
      .filter(([_, mapping]) => mapping.corrected !== mapping.original)
      .map(([original, mapping]) => ({
        original,
        corrected: mapping.corrected,
        confidence: mapping.confidence
      }))
      .sort((a, b) => b.confidence - a.confidence);
    
    fs.writeFileSync(mappingPath, JSON.stringify(mappingData, null, 2));
    console.log(`✅ Email mapping saved to: ${mappingPath}`);
    
    console.log('\n✅ CSV cleaning complete!');
    console.log(`   Total rows processed: ${records.length}`);
    console.log(`   Emails mapped: ${mappedCount}`);
    console.log(`   Emails kept as-is: ${keptCount}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ CSV cleaning failed:', error);
    process.exit(1);
  }
}

// Run cleaning
cleanCSVEmails();

