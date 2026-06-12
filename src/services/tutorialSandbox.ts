import {
  collection,
  doc,
  setDoc,
  query,
  where,
  getDocs,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { PRRequest, PRStatus, Quote, LineItem } from '@/types/pr';
import { User } from '@/types/user';
import type { TourId } from '@/tutorial/tourConfig';
import { tourUsesSandboxPR } from '@/tutorial/tourConfig';

const PR_COLLECTION = 'purchaseRequests';

export const TUTORIAL_SANDBOX_MARKER = '[pr tutorial sandbox]';
export const TUTORIAL_PR_NUMBER_PREFIX = 'TUT-';

export { tourUsesSandboxPR };

export function isTutorialSandboxPR(pr: Partial<PRRequest> | null | undefined): boolean {
  if (!pr) return false;
  if (pr.isTutorialSandbox === true) return true;
  return typeof pr.prNumber === 'string' && pr.prNumber.startsWith(TUTORIAL_PR_NUMBER_PREFIX);
}

export interface TutorialSandboxSeedResult {
  primaryPrId: string;
  prNumber: string;
  prIds: string[];
}

function newId(): string {
  return crypto.randomUUID();
}

function buildRequestorRef(user: User) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    name: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
    role: user.role,
    organization: user.organization,
    department: user.department,
  };
}

function sampleLineItems(): LineItem[] {
  return [
    {
      id: newId(),
      description: 'Tutorial demo item — office supplies',
      quantity: 10,
      uom: 'ea',
      attachments: [],
      estimatedUnitPrice: 50,
      estimatedTotal: 500,
    },
  ];
}

function sampleQuotes(): Quote[] {
  const now = new Date().toISOString();
  return [
    {
      id: newId(),
      vendorId: 'tut-vendor-a',
      vendorName: 'Tutorial Vendor A',
      quoteDate: now,
      amount: 480,
      currency: 'LSL',
      notes: TUTORIAL_SANDBOX_MARKER,
      attachments: [],
    },
    {
      id: newId(),
      vendorId: 'tut-vendor-b',
      vendorName: 'Tutorial Vendor B',
      quoteDate: now,
      amount: 520,
      currency: 'LSL',
      notes: TUTORIAL_SANDBOX_MARKER,
      attachments: [],
    },
  ];
}

function resolveOrganization(user: User): string {
  const org = user.organization;
  if (typeof org === 'string' && org.trim()) return org.trim();
  if (Array.isArray(user.additionalOrganizations) && user.additionalOrganizations[0]) {
    return user.additionalOrganizations[0];
  }
  return 'Tutorial Org';
}

function statusForTour(tourId: TourId): PRStatus {
  switch (tourId) {
    case 'roleApprover':
    case 'roleFinanceApprover':
      return PRStatus.PENDING_APPROVAL;
    case 'roleProcurement':
    case 'roleSuperadmin':
      return PRStatus.IN_QUEUE;
    case 'roleFinanceAdmin':
      return PRStatus.APPROVED;
    case 'roleRequestor':
    default:
      return PRStatus.SUBMITTED;
  }
}

function buildSandboxPR(user: User, tourId: TourId): Omit<PRRequest, 'id'> {
  const now = new Date().toISOString();
  const org = resolveOrganization(user);
  const requestor = buildRequestorRef(user);
  const status = statusForTour(tourId);
  const shortId = newId().slice(0, 8).toUpperCase();
  const prNumber = `${TUTORIAL_PR_NUMBER_PREFIX}${shortId}`;

  const pr: Omit<PRRequest, 'id'> = {
    prNumber,
    organization: org,
    department: user.department || 'General',
    projectCategory: 'Operations',
    description: `Tutorial demo PR for ${tourId}. ${TUTORIAL_SANDBOX_MARKER} Removed when the tour ends.`,
    sites: ['HQ'],
    expenseType: 'OPEX',
    estimatedAmount: 500,
    totalAmount: 500,
    currency: 'LSL',
    requiredDate: new Date(Date.now() + 14 * 86400000).toISOString(),
    requestorId: user.id,
    requestorEmail: user.email,
    requestor,
    status,
    lineItems: sampleLineItems(),
    quotes: sampleQuotes(),
    isTutorialSandbox: true,
    tutorialTourId: tourId,
    createdAt: now,
    updatedAt: now,
    history: [],
    statusHistory: [],
  };

  if (status === PRStatus.PENDING_APPROVAL) {
    pr.approver = user.id;
    pr.approvalWorkflow = {
      currentApprover: user.id,
      requiresDualApproval: false,
    };
  }

  if (status === PRStatus.APPROVED) {
    pr.objectType = 'PO';
    pr.selectedVendor = 'tut-vendor-a';
  }

  return pr;
}

export async function seedTutorialSandboxPR(user: User, tourId: TourId): Promise<TutorialSandboxSeedResult> {
  await cleanupTutorialSandboxPRs(user.id);

  const prData = buildSandboxPR(user, tourId);
  const docId = newId();
  await setDoc(doc(db, PR_COLLECTION, docId), prData);

  return {
    primaryPrId: docId,
    prNumber: prData.prNumber,
    prIds: [docId],
  };
}

export async function cleanupTutorialSandboxPRs(userId: string): Promise<number> {
  if (!userId) return 0;

  const q = query(collection(db, PR_COLLECTION), where('requestorId', '==', userId));
  const snap = await getDocs(q);
  let deleted = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data() as Partial<PRRequest>;
    if (isTutorialSandboxPR(data)) {
      await deleteDoc(docSnap.ref);
      deleted += 1;
    }
  }

  return deleted;
}
