import { initializeApp, cert, getApps, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

type ExportRow = {
  source_pr_uid: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  status: string;
  role: string;
  permission_level: string;
  hr_portal_role_suggestion: string;
  country_code: string;
  department: string;
  primary_organization: string;
  additional_organizations: string;
  employee_type: string;
  notes: string;
};

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

function normalize(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

function normalizeOrg(value: unknown): string {
  return normalize(value).replace(/[^a-z0-9]/g, '_');
}

function csvEscape(value: unknown): string {
  const s = String(value ?? '');
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCsv(rows: ExportRow[]): string {
  const headers: (keyof ExportRow)[] = [
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

function hrRoleSuggestion(user: Record<string, unknown>): string {
  const isHrLead = user.isHrLead === true;
  const permission = Number(user.permissionLevel ?? 0);
  if (isHrLead) return 'hr';
  if (permission >= 5) return 'admin';
  return 'user';
}

async function main() {
  const root = process.cwd();
  const serviceAccountPath = join(root, 'firebase-service-account.json');
  if (!existsSync(serviceAccountPath)) {
    throw new Error(`Missing service account file: ${serviceAccountPath}`);
  }

  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8')) as ServiceAccount;
  if (getApps().length === 0) {
    initializeApp({ credential: cert(serviceAccount) });
  }
  const db = getFirestore();

  // Discover Benin organizations from reference data first.
  const beninOrgIds = new Set<string>();
  const beninOrgDisplay = new Set<string>();

  const beninOrgs = await db
    .collection('referenceData_organizations')
    .where('country', '==', 'Benin')
    .get();

  for (const doc of beninOrgs.docs) {
    beninOrgIds.add(normalizeOrg(doc.id));
    const data = doc.data() as Record<string, unknown>;
    beninOrgDisplay.add(String(data.name ?? doc.id));
    beninOrgDisplay.add(String(data.code ?? ''));
  }

  // Pull all users; evaluate both primary and additional org assignment.
  const users = await db.collection('users').get();
  const rows: ExportRow[] = [];
  const audit: Record<string, unknown>[] = [];

  for (const doc of users.docs) {
    const u = doc.data() as Record<string, unknown>;
    const primaryOrgRaw = String(u.organization ?? '');
    const primaryNorm = normalizeOrg(primaryOrgRaw);
    const additional = Array.isArray(u.additionalOrganizations)
      ? u.additionalOrganizations.map((x) => String(x))
      : [];
    const additionalNorm = additional.map((x) => normalizeOrg(x));

    const isBeninByPrimary =
      beninOrgIds.has(primaryNorm) ||
      BENIN_ALIASES.has(normalize(primaryOrgRaw)) ||
      BENIN_ALIASES.has(primaryNorm);
    const isBeninByAdditional = additionalNorm.some(
      (o) => beninOrgIds.has(o) || BENIN_ALIASES.has(o) || BENIN_ALIASES.has(o.replace(/_/g, ' '))
    );

    if (!isBeninByPrimary && !isBeninByAdditional) {
      continue;
    }

    const firstName = String(u.firstName ?? '').trim();
    const lastName = String(u.lastName ?? '').trim();
    const fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || String(u.name ?? '').trim();
    const email = String(u.email ?? '').trim().toLowerCase();
    const isActive = u.isActive !== false;
    const orgs = [primaryOrgRaw, ...additional].filter(Boolean);

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
      isHrLead: u.isHrLead === true,
      hrLeadCountryCodes: u.hrLeadCountryCodes ?? [],
      matchedBy: {
        primary: isBeninByPrimary,
        additional: isBeninByAdditional,
      },
    });
  }

  rows.sort((a, b) => a.email.localeCompare(b.email));

  const outDir = join(root, 'exports');
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const csvPath = join(outDir, `benin-users-for-hr-portal-${timestamp}.csv`);
  const jsonPath = join(outDir, `benin-users-for-hr-portal-${timestamp}.json`);

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
