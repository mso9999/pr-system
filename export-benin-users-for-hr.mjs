import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BENIN_ALIASES = new Set([
  '1pwr_benin',
  '1pwr benin',
  'benin',
  'pueco_benin',
  'inclusive/pueco benin',
  'inclusive_pueco_benin',
  'mgb',
  'mionwa_gen',
]);

const normalize = (value) => String(value ?? '').trim().toLowerCase();
const normalizeOrg = (value) => normalize(value).replace(/[^a-z0-9]/g, '_');

const csvEscape = (value) => {
  const s = String(value ?? '');
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
};

const hrRoleSuggestion = (user) => {
  const isHrLead = user.isHrLead === true;
  const permission = Number(user.permissionLevel ?? 0);
  if (isHrLead) return 'hr';
  if (permission >= 5) return 'admin';
  return 'user';
};

function toCsv(rows) {
  const headers = [
    'source_pr_uid',
    'email',
    'first_name',
    'last_name',
    'full_name',
    'status',
    'role',
    'permission_level',
    'hr_portal_role_suggestion',
    'country_code',
    'department',
    'primary_organization',
    'additional_organizations',
    'employee_type',
    'notes',
  ];
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(','));
  }
  return lines.join('\n');
}

async function main() {
  const root = process.cwd();
  const serviceAccountPath = join(root, 'firebase-service-account.json');
  if (!existsSync(serviceAccountPath)) {
    throw new Error(`Missing service account file: ${serviceAccountPath}`);
  }
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
  if (getApps().length === 0) {
    initializeApp({ credential: cert(serviceAccount) });
  }
  const db = getFirestore();

  const beninOrgIds = new Set();
  const beninOrgDisplay = new Set();
  const beninOrgs = await db.collection('referenceData_organizations').where('country', '==', 'Benin').get();
  for (const doc of beninOrgs.docs) {
    beninOrgIds.add(normalizeOrg(doc.id));
    const data = doc.data();
    beninOrgDisplay.add(String(data.name ?? doc.id));
    beninOrgDisplay.add(String(data.code ?? ''));
  }

  const users = await db.collection('users').get();
  const rows = [];
  const audit = [];

  for (const doc of users.docs) {
    const u = doc.data();
    const primaryOrgRaw = String(u.organization ?? '');
    const primaryNorm = normalizeOrg(primaryOrgRaw);
    const additional = Array.isArray(u.additionalOrganizations) ? u.additionalOrganizations.map((x) => String(x)) : [];
    const additionalNorm = additional.map((x) => normalizeOrg(x));

    const isBeninByPrimary =
      beninOrgIds.has(primaryNorm) ||
      BENIN_ALIASES.has(normalize(primaryOrgRaw)) ||
      BENIN_ALIASES.has(primaryNorm);
    const isBeninByAdditional = additionalNorm.some(
      (o) => beninOrgIds.has(o) || BENIN_ALIASES.has(o) || BENIN_ALIASES.has(o.replace(/_/g, ' '))
    );
    if (!isBeninByPrimary && !isBeninByAdditional) continue;

    const firstName = String(u.firstName ?? '').trim();
    const lastName = String(u.lastName ?? '').trim();
    const fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || String(u.name ?? '').trim();
    const email = String(u.email ?? '').trim().toLowerCase();
    const isActive = u.isActive !== false;

    rows.push({
      source_pr_uid: doc.id,
      email,
      first_name: firstName,
      last_name: lastName,
      full_name: fullName,
      status: isActive ? 'active' : 'inactive',
      role: String(u.role ?? ''),
      permission_level: String(u.permissionLevel ?? ''),
      hr_portal_role_suggestion: hrRoleSuggestion(u),
      country_code: 'BJ',
      department: String(u.department ?? ''),
      primary_organization: primaryOrgRaw,
      additional_organizations: additional.join(' | '),
      employee_type: '',
      notes: 'Source: PR System users collection (Benin org filter)',
    });

    audit.push({
      uid: doc.id,
      email,
      isActive,
      organization: primaryOrgRaw,
      additionalOrganizations: additional,
      matchedBy: {
        primary: isBeninByPrimary,
        additional: isBeninByAdditional,
      },
    });
  }

  rows.sort((a, b) => a.email.localeCompare(b.email));
  const outDir = join(root, 'exports');
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const csvPath = join(outDir, `benin-users-for-hr-portal-${stamp}.csv`);
  const jsonPath = join(outDir, `benin-users-for-hr-portal-${stamp}.json`);
  writeFileSync(csvPath, toCsv(rows) + '\n', 'utf8');
  writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        sourceProject: serviceAccount.project_id ?? 'unknown',
        beninOrganizationsFound: Array.from(beninOrgDisplay).filter(Boolean),
        rowCount: rows.length,
        rows: audit,
      },
      null,
      2
    ),
    'utf8'
  );

  console.log(`Exported ${rows.length} Benin users`);
  console.log(`CSV: ${csvPath}`);
  console.log(`Audit JSON: ${jsonPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
