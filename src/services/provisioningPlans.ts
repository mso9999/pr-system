/**
 * Client-side Firestore service for provisioning plans.
 *
 * Mirrors the PR service's pattern: client-side writes with a Firestore counter for
 * sequential plan numbers. Plans are org-scoped and visible to the org's members;
 * procurement/finance/admins can edit; requesters read.
 */
import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
  deleteDoc,
  runTransaction,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { normalizeOrganizationId } from '@/utils/organization';
import type { ProvisioningPlan, ProvisioningPlanStatus } from '@/types/provisioning';

const PLANS_COLLECTION = 'provisioningPlans';
const COUNTER_COLLECTION = 'counters';

export async function generatePlanNumber(organization: string, countryCode: string): Promise<string> {
  const now = new Date();
  const yy = now.getFullYear().toString().slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const year = now.getFullYear();
  const normalizedOrg = normalizeOrganizationId(organization).toUpperCase().slice(0, 12);
  const cc = (countryCode || 'XX').toUpperCase();

  const counterDocId = `pp_counter_${year}_${normalizeOrganizationId(organization)}`;
  const counterRef = doc(db, COUNTER_COLLECTION, counterDocId);

  try {
    const seq = await runTransaction(db, async (tx) => {
      const snap = await tx.get(counterRef);
      let next = 1;
      if (snap.exists()) {
        next = Number(snap.data().count || 0) + 1;
      }
      tx.set(counterRef, {
        count: next,
        year,
        organization: normalizeOrganizationId(organization),
        lastUpdated: now.toISOString(),
      });
      return next;
    });
    const seqStr = String(seq).padStart(4, '0');
    return `PP-${yy}${mm}${dd}-${seqStr}-${normalizedOrg}-${cc}`;
  } catch (err) {
    console.error('generatePlanNumber counter failed, using timestamp fallback:', err);
    const fallback = String(Date.now() % 10000).padStart(4, '0');
    return `PP-${yy}${mm}${dd}-${fallback}-${normalizedOrg}-${cc}`;
  }
}

export async function savePlan(plan: Omit<ProvisioningPlan, 'id' | 'planNumber' | 'createdAt' | 'updatedAt'> & {
  id?: string;
  planNumber?: string;
}): Promise<ProvisioningPlan> {
  const now = new Date().toISOString();
  if (plan.id) {
    const ref = doc(db, PLANS_COLLECTION, plan.id);
    const update = { ...plan, updatedAt: now } as Partial<ProvisioningPlan>;
    delete (update as any).id;
    await updateDoc(ref, update);
    const fresh = await getDoc(ref);
    return { id: ref.id, ...(fresh.data() as Omit<ProvisioningPlan, 'id'>) };
  }

  const planNumber = plan.planNumber || await generatePlanNumber(plan.organizationId, plan.countryCode);
  const payload = { ...plan, planNumber, createdAt: now, updatedAt: now };
  const ref = await addDoc(collection(db, PLANS_COLLECTION), payload);
  return { id: ref.id, ...payload };
}

export async function getPlan(id: string): Promise<ProvisioningPlan | null> {
  const snap = await getDoc(doc(db, PLANS_COLLECTION, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<ProvisioningPlan, 'id'>) };
}

export async function listPlansForOrg(organizationId: string): Promise<ProvisioningPlan[]> {
  const org = normalizeOrganizationId(organizationId);
  const q = query(
    collection(db, PLANS_COLLECTION),
    where('organizationId', '==', org),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ProvisioningPlan, 'id'>) }));
}

export async function updatePlanStatus(id: string, status: ProvisioningPlanStatus, generatedPrId?: string): Promise<void> {
  const update: Record<string, unknown> = { status, updatedAt: new Date().toISOString() };
  if (generatedPrId) update.generatedPrId = generatedPrId;
  await updateDoc(doc(db, PLANS_COLLECTION, id), update);
}

export async function deletePlan(id: string): Promise<void> {
  await deleteDoc(doc(db, PLANS_COLLECTION, id));
}
