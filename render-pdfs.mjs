import { build } from 'esbuild';
import { renderToBuffer } from '@react-pdf/renderer';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

const OUTPUT_DIR = '/Users/mattmso/Dropbox/AI Projects/1PWR Africa/docs/Software Procurement Supply/POs and Invoices';

// ─── Organization & Vendor Details ───────────────────────────────────────────

const orgDetails = {
  companyLegalName: 'Mionwa Generation SA',
  companyAddress: {
    street: 'Ilot QIP 1145-N, Parcelle Q, Maison Lucien Gnonlonfou Gandonou, Agontinkon',
    city: '8ème Arrondissement, Cotonou',
    country: 'Bénin',
  },
  companyPhone: '+229 01 20 60 37 37',
  companyWebsite: 'www.mionwa.com',
};

const vendorDetails = {
  name: 'One Power Africa GBC',
  contactName: 'Matthew S. Orosz',
  contactEmail: 'mso@1pwrafrica.com',
  contactPhone: '+230 5 250 00 00',
  address: 'c/o Nexus Global Financial Services Limited, Lot 02, Floor 1, CentrePoint, Trianon',
  city: 'Trianon',
  country: 'Mauritius',
};

// ─── Banking Details (AfrAsia Bank) ──────────────────────────────────────────

const banking = {
  bankName: 'AfrAsia Bank Limited',
  bankAddress: 'AfrAsia House, Level 1, Ebene, Mauritius',
  accountName: 'One Power Africa GBC',
  accountNumber: '000123456789',
  swiftCode: 'AFRIMUMU',
  iban: 'MU43AFRI0001234567890123456',
  correspondent1: 'Standard Chartered Bank, New York (USD) — SWIFT: SCBLUS33',
  correspondent2: 'Standard Chartered Bank, London (USD) — SWIFT: SCBLGB2L',
};

// ─── Transaction: Steel Structure Warehouse ───────────────────────────────────
// OEM: Weizhengheng Group (Crystal Li)
// Product: Steel Structure Warehouse (36×14×7m), 504m²
// OEM FOB: $21,995 (steel structure $20,184 + inland freight/port $1,811)
// Ocean freight to Cotonou: $4,950
// OEM CIF Cotonou: $26,945
// 1PWR A price: CIF × 1.125 = $30,313.13 (margin applies to full CIF including freight)
// Payment: 50% deposit, 50% balance before shipment
// This is a NEW procurement (not a takeover)

const PR_NUMBER = '260716-1001-MIO-BN';
const INVOICE_NUMBER = 'INV-OPA-2026-008';
const PO_DATE = '2026-07-16';
const FINAL_PAYMENT_DATE = '2026-07-30';
const DELIVERY_DATE = '2026-09-13'; // 45 days from final payment

const oemCifTotal = 26945.00;
const marginRate = 0.125;
const total1PwrA = oemCifTotal * (1 + marginRate); // $30,313.13

// Line items (scaled by 1.125 to embed margin on full CIF)
const steelStructureOem = 13666 + 4263 + 747 + 1508; // $20,184
const logisticsOem = 1811 + 4950; // $6,761
const steelStructure1PwrA = steelStructureOem * 1.125; // $22,707.00
const logistics1PwrA = total1PwrA - steelStructure1PwrA; // $7,606.13 (adjusted for rounding)

const depositPct = 50;
const depositAmount = total1PwrA * (depositPct / 100); // $15,156.57
const balanceAmount = total1PwrA - depositAmount; // $15,156.56

// ─── Build PR object for PO ───────────────────────────────────────────────────

const pr = {
  prNumber: PR_NUMBER,
  poIssueDate: PO_DATE,
  createdAt: PO_DATE,
  currency: 'USD',
  organization: 'Mionwa Generation SA',
  selectedVendor: 'One Power Africa GBC',
  buyerRepresentativeName: 'Jean-Philippe Sastre',
  buyerRepresentativeTitle: 'Directeur Administratif et Financier',
  buyerRepresentativeEmail: 'contact@mionwa.com',
  supplierName: 'One Power Africa GBC',
  supplierRepresentativeName: 'Matthew S. Orosz',
  supplierRepresentativeTitle: 'CEO',
  supplierRepresentativeEmail: 'mso@1pwrafrica.com',
  incoterm: 'CIF',
  modeOfDelivery: 'Sea',
  estimatedDeliveryDate: DELIVERY_DATE,
  paymentMethod: 'Bank Transfer',
  paymentTerms: `50% advance payment due per contract terms. Balance of $${balanceAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} due before shipment. Expected delivery: 45 days from final payment (${DELIVERY_DATE}).`,
  referenceContractNumber: 'Software Platform, Procurement and Supply Services Agreement dated 15 June 2026',
  oemManufacturer: {
    name: 'Weizhengheng Group',
    address: 'Shijiazhuang, Hebei, China',
    contact: 'Crystal Li, Export Department — Tel: +86-0311-85252196, Mob: +86-15132116516, Email: Crystal@wzhgroup.com',
  },
  manufacturerRole: 'OEM manufacturer and exporter of steel structure warehouse',
  certificateOfOrigin: 'China',
  hsCodes: '7308.90 (Steel structures)',
  importInvoiceIssuer: 'One Power Africa GBC',
  importValueBasis: 'Supplier-to-Customer transaction value (CIF Cotonou)',
  lineItemsWithSKU: [
    {
      lineNumber: 1,
      description: 'Steel Structure Warehouse (36×14×7m) — 504m² — Complete kit including: Welded/Hot Rolled H Steel (Q355B), Column & Beam Bracing, Purlins (Galvanized Q235B), Foundation Bolts (M24), High-Strength Bolts (M20), Ordinary Bolts (M12/M16), Processing Fee, Shotblasting & Derust, Two-coat Paint, Color Steel Sheet Roof/Wall (0.4mm), Sunlight Sheet, Roller Shutter Door (4m×4.5m), Flashing & Accessories, Screws/Rivets/Sealant',
      quantity: 1,
      uom: 'set',
      unitPrice: steelStructure1PwrA,
      totalAmount: steelStructure1PwrA,
      currency: 'USD',
      origin: 'China',
    },
    {
      lineNumber: 2,
      description: 'Logistics & Freight — Inland Freight + Port Cost (40\'HQ), Packing Fee, Steel Pallet (1.0 ton), Ocean Freight to Cotonou (CIF)',
      quantity: 1,
      uom: 'lot',
      unitPrice: logistics1PwrA,
      totalAmount: logistics1PwrA,
      currency: 'USD',
      origin: 'China',
    },
  ],
  poRemarks: 'Building specifications: Wind Load 80km/h, Snow Load 0kg/m², Brick Wall 0m. Excludes concrete ground foundation. Steel pallet can be eliminated if open-top containers are acceptable (cost reduction available). Quotation valid 7 days from OEM PI date (16-Jul-2026).',
};

// ─── Build Invoice object ────────────────────────────────────────────────────

const invoice = {
  id: 'inv-warehouse-001',
  invoiceNumber: INVOICE_NUMBER,
  poReference: PR_NUMBER,
  contractReference: 'Software Platform, Procurement and Supply Services Agreement dated 15 June 2026',
  issuer: {
    name: 'One Power Africa GBC',
    address: 'c/o Nexus Global Financial Services Limited, Lot 02, Floor 1, CentrePoint, Trianon, Mauritius',
    registrationNumber: 'C202435',
    taxId: 'MU-TAX-789',
    banking,
  },
  customer: {
    name: 'Mionwa Generation SA',
    address: 'Ilot QIP 1145-N, Parcelle Q, Maison Lucien Gnonlonfou Gandonou, Agontinkon, 8ème Arrondissement, Cotonou, Bénin',
    contactPerson: 'Jean-Philippe Sastre',
    contactEmail: 'contact@mionwa.com',
    contactPhone: '+229 01 20 60 37 37',
  },
  milestone: '50% Advance Payment — Production Start',
  lineItems: [
    {
      description: 'Steel Structure Warehouse (36×14×7m) — 504m² — Complete kit including steel structure, roof/wall system, door/window system, accessories (CIF Cotonou)',
      quantity: 1,
      unit: 'set',
      unitPrice: steelStructure1PwrA,
      total: steelStructure1PwrA,
    },
    {
      description: 'Logistics & Freight — Inland Freight, Port Cost, Packing, Steel Pallet, Ocean Freight to Cotonou (CIF)',
      quantity: 1,
      unit: 'lot',
      unitPrice: logistics1PwrA,
      total: logistics1PwrA,
    },
  ],
  totalAmount: depositAmount,
  currency: 'USD',
  issueDate: PO_DATE,
  dueDate: PO_DATE,
  paymentTerms: `50% advance payment due per contract terms ($${depositAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}). Remaining balance of $${balanceAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} due before shipment. Expected delivery: 45 days from final payment (${DELIVERY_DATE}).`,
  supportingDocuments: [
    'Supplier commercial invoice to Customer',
    'PO reference: ' + PR_NUMBER,
    'OEM proforma invoice (Weizhengheng Group, dated 16-Jul-2026)',
    'OEM order acknowledgment or production confirmation for production-start payment',
  ],
  notes: [
    'Pricing Note: The Supplier Sale Price is the commercial transaction price charged by Supplier to Customer. It may include Supplier\'s procurement work, supply-chain coordination, documentation support, risk assumption, overhead and margin without separate line-item disclosure.',
    'Building specifications: Wind Load 80km/h, Snow Load 0kg/m², Brick Wall 0m. Excludes concrete ground foundation.',
    'Incoterm: CIF Cotonou (Cost, Insurance and Freight).',
  ],
  validityDays: 7,
  upfrontPercentage: depositPct,
  upfrontAmount: depositAmount,
  oemCreditAmount: 0,
  status: 'issued',
  createdAt: PO_DATE,
  updatedAt: PO_DATE,
};

// ─── Render PDFs ─────────────────────────────────────────────────────────────

async function main() {
  console.log('Bundle size check — building with esbuild...');

  // Bundle the PODocument and InvoiceDocument components
  const poBundle = await build({
    entryPoints: [join(__dirname, 'src/components/pr/PODocument.tsx')],
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node18',
    external: ['react', 'react-dom', 'firebase', 'firebase/*'],
    tsconfig: join(__dirname, 'tsconfig.json'),
    write: false,
    jsx: 'automatic',
  });

  const invBundle = await build({
    entryPoints: [join(__dirname, 'src/components/pr/InvoiceDocument.tsx')],
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node18',
    external: ['react', 'react-dom', 'firebase', 'firebase/*'],
    tsconfig: join(__dirname, 'tsconfig.json'),
    write: false,
    jsx: 'automatic',
  });

  // Write bundles to project dir so node_modules can be resolved
  const { writeFileSync, mkdirSync } = await import('fs');
  const tmpDir = join(__dirname, '.tmp-pdf-bundles');
  mkdirSync(tmpDir, { recursive: true });

  const poBundlePath = join(tmpDir, 'PODocument.bundle.mjs');
  const invBundlePath = join(tmpDir, 'InvoiceDocument.bundle.mjs');
  writeFileSync(poBundlePath, poBundle.outputFiles[0].text);
  writeFileSync(invBundlePath, invBundle.outputFiles[0].text);

  const { PODocument } = await import(poBundlePath);
  const { InvoiceDocument } = await import(invBundlePath);

  // Render PO
  console.log(`Rendering PO for ${PR_NUMBER}...`);
  const poElement = PODocument({ pr, organizationDetails: orgDetails, vendorDetails, logoBase64: undefined });
  const poBuffer = await renderToBuffer(poElement);
  const poFileName = `PO_${PR_NUMBER}.pdf`;
  const poPath = join(OUTPUT_DIR, poFileName);
  writeFileSync(poPath, poBuffer);
  console.log(`  ✓ Saved: ${poFileName} (${poBuffer.length} bytes)`);

  // Render Invoice
  console.log(`Rendering Invoice ${INVOICE_NUMBER}...`);
  const invElement = InvoiceDocument({ invoice, logoBase64: undefined });
  const invBuffer = await renderToBuffer(invElement);
  const invFileName = `INV_${INVOICE_NUMBER}.pdf`;
  const invPath = join(OUTPUT_DIR, invFileName);
  writeFileSync(invPath, invBuffer);
  console.log(`  ✓ Saved: ${invFileName} (${invBuffer.length} bytes)`);

  console.log('\n=== Summary ===');
  console.log(`PR Number:    ${PR_NUMBER}`);
  console.log(`Invoice:      ${INVOICE_NUMBER}`);
  console.log(`Total (1PWR A): $${total1PwrA.toFixed(2)}`);
  console.log(`  Deposit (30%):  $${depositAmount.toFixed(2)}`);
  console.log(`  Balance (70%):  $${balanceAmount.toFixed(2)}`);
  console.log(`Delivery:     ${DELIVERY_DATE} (45 days from final payment ${FINAL_PAYMENT_DATE})`);
  console.log(`Incoterm:     CIF Cotonou`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
