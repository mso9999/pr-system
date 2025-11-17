/**
 * Import Archive PRs from CSV
 * One-time script to import legacy Google Forms purchase requests into Firestore
 */

import * as fs from 'fs';
import * as path from 'path';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

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

  // Parse header
  const headers = parseCSVLine(lines[0]);
  const rows: CSVRow[] = [];

  // Parse data rows
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

/**
 * Parse a single CSV line, handling quoted fields
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  // Add last field
  result.push(current.trim());
  
  return result;
}

/**
 * Map CSV row to ArchivePR format
 */
function mapCSVRowToArchivePR(row: CSVRow, index: number): any {
  const timestamp = row['Timestamp'] || '';
  const email = row['Email Address'] || '';
  const description = row['Please provide a brief description of the items being requested.'] || '';
  const vendor = row['Who is the vendor?'] || '';
  const currency = row['What currency is this purchase?'] || '';
  const cost = row['Please estimate total cost of request as a number only.'] || '';
  const urgent = row['Does this request relate to an urgent issue, for example, vehicle breakdown or minigrid repair needed?'] || '';
  const paymentFormat = row['What format of payment is needed for this request?  If payment is needed or could be accepted in multiple forms, select "Other" and provide a brief explanation'] || '';
  const site = row['If purchase relates to a specific 1PWR project site, select below.  Otherwise select "HQ".  If purchase is for multiple sites, please select all that apply.'] || '';
  const entity = row['Which entity should be paying this expense?  NOTE:  generally only materials/equipment expenses related to the minigrids projects may be charged to SMP.'] || '';
  const project = row['Which project is this expense for?'] || '';
  const expenseType = row['Which expense type is this?  Please select all that apply.'] || '';
  const reason = row['Please provide reason / context for this request.  For example:  site work at Ha Makebe, tracker construction, Pajero refueling, new employee PPE, etc.'] || '';
  const vehicle = row['If this expense is for a vehicle, please indicate which vehicle.  If this is for a different vehicle (e.g., rental) please select "Other" and provide explanation.'] || '';
  const budgetApproval = row['Was any part of this expense already approved on a monthly budget?  If part of the request was approved, select "Other" and provide brief explanation (which thrust area and which budget lines).'] || '';
  const deadline = row['What is the deadline date for making this purchase?  Recall that requests should be made a minimum of 24 hours in advance.'] || '';
  const attachments = row['Please attach any relevant files:  quotations, fuel usage calculator, banking details for EFT payment, PPE schedule, etc.'] || '';
  const otherInfo = row['Please provide any other information the finance team might require to process this request.'] || '';
  const approver = row['Who is the approver for this request?'] || '';

  // Parse amount
  let amount: number | undefined;
  if (cost) {
    const cleaned = cost.replace(/[^\d.-]/g, '');
    const parsed = parseFloat(cleaned);
    if (!isNaN(parsed)) {
      amount = parsed;
    }
  }

  // Parse date
  let submittedDate: string | undefined;
  if (timestamp) {
    try {
      // Try to parse various date formats
      const date = new Date(timestamp);
      if (!isNaN(date.getTime())) {
        submittedDate = date.toISOString();
      }
    } catch (e) {
      // Keep as string if parsing fails
      submittedDate = timestamp;
    }
  }

  // Extract requestor name from email if possible
  const requestorName = email.split('@')[0] || email;

  // Map entity to organization
  let organization = entity || '1PWR LESOTHO';
  if (entity && entity.toLowerCase().includes('smp')) {
    organization = 'SMP';
  }

  // Combine description and reason for full description
  const fullDescription = description || reason || '';

  // Build notes from various fields
  const notes = [
    urgent && `Urgent: ${urgent}`,
    budgetApproval && `Budget Approval: ${budgetApproval}`,
    otherInfo && `Additional Info: ${otherInfo}`,
    attachments && `Attachments: ${attachments}`,
  ].filter(Boolean).join('\n');

  return {
    // Core fields
    submittedDate: submittedDate || new Date().toISOString(),
    requestorName,
    requestorEmail: email,
    description: fullDescription,
    vendor,
    currency: currency || 'LSL',
    amount,
    organization,
    site: site || 'HQ',
    projectCategory: project || '',
    expenseType: expenseType || '',
    vehicle: vehicle || '',
    requiredDate: deadline || '',
    paymentType: paymentFormat || '',
    notes: notes || '',
    approver: approver || '',
    
    // Store all original fields for reference
    originalData: {
      timestamp,
      email,
      description,
      vendor,
      currency,
      cost,
      urgent,
      paymentFormat,
      site,
      entity,
      project,
      expenseType,
      reason,
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
}

/**
 * Main import function
 */
async function importArchivePRs() {
  try {
    const csvPath = path.join(process.cwd(), 'Purchase request (Responses) - Form Responses 1.csv');
    
    if (!fs.existsSync(csvPath)) {
      throw new Error(`CSV file not found at: ${csvPath}`);
    }

    console.log('📄 Reading CSV file...');
    const rows = parseCSV(csvPath);
    console.log(`✅ Parsed ${rows.length} rows from CSV`);

    console.log('🔄 Starting import to Firestore...');
    const archiveRef = collection(db, 'archivePRs');
    
    let successCount = 0;
    let errorCount = 0;
    const batchSize = 50; // Process in batches to avoid overwhelming Firestore

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1} (rows ${i + 1}-${Math.min(i + batchSize, rows.length)})...`);

      const promises = batch.map(async (row, index) => {
        try {
          const archivePR = mapCSVRowToArchivePR(row, i + index);
          await addDoc(archiveRef, archivePR);
          successCount++;
          if ((i + index + 1) % 100 === 0) {
            console.log(`  ✅ Imported ${i + index + 1} records...`);
          }
        } catch (error) {
          errorCount++;
          console.error(`  ❌ Error importing row ${i + index + 1}:`, error);
        }
      });

      await Promise.all(promises);
      
      // Small delay between batches to avoid rate limiting
      if (i + batchSize < rows.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log('\n✅ Import complete!');
    console.log(`   Successfully imported: ${successCount} records`);
    console.log(`   Errors: ${errorCount} records`);
    console.log(`   Total: ${rows.length} records`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  }
}

// Run import
importArchivePRs();

