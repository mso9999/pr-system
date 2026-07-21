/**
 * @fileoverview Invoice Service
 * @description Firestore CRUD operations for invoices and PDF generation helper
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { Invoice, InvoiceLineItem } from '@/types/invoice';

const INVOICE_COLLECTION = 'invoices';

export async function createInvoice(
  invoiceData: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const docRef = await addDoc(collection(db, INVOICE_COLLECTION), {
    ...invoiceData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateInvoice(
  invoiceId: string,
  updates: Partial<Invoice>
): Promise<void> {
  const docRef = doc(db, INVOICE_COLLECTION, invoiceId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function getInvoice(invoiceId: string): Promise<Invoice | null> {
  const docRef = doc(db, INVOICE_COLLECTION, invoiceId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;
  const data = docSnap.data();
  return {
    id: docSnap.id,
    ...data,
    issueDate: data.issueDate?.toDate?.()?.toISOString() || data.issueDate,
    dueDate: data.dueDate?.toDate?.()?.toISOString() || data.dueDate,
    createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
    updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
  } as Invoice;
}

export async function getInvoicesByPO(poReference: string): Promise<Invoice[]> {
  const q = query(
    collection(db, INVOICE_COLLECTION),
    where('poReference', '==', poReference),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({
    id: d.id,
    ...d.data(),
  })) as Invoice[];
}

export function computeInvoiceTotal(lineItems: InvoiceLineItem[]): number {
  return lineItems.reduce((sum, item) => sum + item.total, 0);
}

export function generateInvoiceNumber(): string {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
  return `INV-${year}-${random}`;
}
