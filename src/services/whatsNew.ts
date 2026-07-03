import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { WhatsNewItem, WhatsNewItemInput } from '../types/whatsNew';

const COLL = 'whatsNew';

/** First-time users (no lastWhatsNewSeenAt) see items from the last N days. */
const FIRST_TIME_WINDOW_DAYS = 90;

function snapToItems(snap: Awaited<ReturnType<typeof getDocs>>): WhatsNewItem[] {
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as WhatsNewItem[];
}

/**
 * Returns active whatsNew items the user hasn't seen yet, newest first.
 * - `lastSeenAt`: the user's `lastWhatsNewSeenAt` (ISO) or undefined.
 * - `userRoles`: permission levels the user holds (typically [permissionLevel]).
 * - Items with `audienceRoles` are shown only if the user holds one of them.
 */
export async function fetchUnseenWhatsNew(
  lastSeenAt: string | undefined,
  userRoles: number[],
): Promise<WhatsNewItem[]> {
  const now = Date.now();
  const cutoffMs = lastSeenAt
    ? new Date(lastSeenAt).getTime()
    : now - FIRST_TIME_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  const snap = await getDocs(collection(db, COLL));
  const items = snapToItems(snap);

  return items
    .filter((it) => it.active !== false)
    .filter((it) => !it.audienceRoles || it.audienceRoles.length === 0 || it.audienceRoles.some((r) => userRoles.includes(r)))
    .filter((it) => {
      const t = new Date(it.date).getTime();
      return Number.isFinite(t) ? t > cutoffMs : false;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/** Stamp the user's `lastWhatsNewSeenAt` so the primer won't resurface. */
export async function markWhatsNewSeen(uid: string): Promise<void> {
  const now = new Date().toISOString();
  await setDoc(
    doc(db, 'users', uid),
    { lastWhatsNewSeenAt: now, updatedAt: now },
    { merge: true },
  );
}

// ── Admin CRUD ──────────────────────────────────────────────────────────────

export async function listAllWhatsNew(): Promise<WhatsNewItem[]> {
  const snap = await getDocs(collection(db, COLL));
  const items = snapToItems(snap);
  return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function createWhatsNew(data: WhatsNewItemInput): Promise<string> {
  const now = new Date().toISOString();
  const ref = await addDoc(collection(db, COLL), { ...data, createdAt: now, updatedAt: now });
  return ref.id;
}

export async function updateWhatsNew(id: string, data: Partial<WhatsNewItemInput>): Promise<void> {
  const now = new Date().toISOString();
  await updateDoc(doc(db, COLL, id), { ...data, updatedAt: now });
}

export async function deleteWhatsNew(id: string): Promise<void> {
  await deleteDoc(doc(db, COLL, id));
}
