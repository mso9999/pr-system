/**
 * "What's New" primer items shown to users after login.
 *
 * Storage: Firestore `whatsNew` collection (org-independent).
 * Per-user seen state: `lastWhatsNewSeenAt` (ISO timestamp) on the user's
 * `users` doc. The post-login dialog shows active items whose `date` is after
 * the user's `lastWhatsNewSeenAt` (first-time users see the last ~90 days).
 */

export interface WhatsNewItem {
  id: string;
  title: string;
  body: string;
  /** ISO date (yyyy-mm-dd) — the item's publish/effective date. */
  date: string;
  active: boolean;
  /** Optional audience filter by permission level. Empty/undefined = everyone. */
  audienceRoles?: number[];
  /** Optional in-app link (e.g. "Try it" → /provisioning). */
  linkLabel?: string;
  linkRoute?: string;
  createdAt?: string;
  updatedAt?: string;
  createdByUid?: string;
  createdByName?: string;
}

export type WhatsNewItemInput = Omit<WhatsNewItem, 'id' | 'createdAt' | 'updatedAt'>;
