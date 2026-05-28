/**
 * Retrospective audit for the 25 approved-PO cap:
 * 1) Replay statusHistory for transitions that should have been blocked
 * 2) Read persisted `poCapAudit` entries (after deploy with recordPoCapAudit)
 *
 * Usage (from repo root):
 *   npx tsx scripts/audit-po-cap-violations.ts
 *   npx tsx scripts/audit-po-cap-violations.ts --since=2026-01-01
 *
 * Requires Firestore read access (authenticated rules or service account).
 */

import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';

const MAX_APPROVED_POS_BEFORE_BLOCK = 25;
const PO_CAP_AUDIT_COLLECTION = 'poCapAudit';

const firebaseConfig = {
  apiKey: 'AIzaSyD0tA1fvWs5dCr-7JqJv_bxlay2Bhs72jQ',
  authDomain: 'pr-system-4ea55.firebaseapp.com',
  projectId: 'pr-system-4ea55',
  storageBucket: 'pr-system-4ea55.firebasestorage.app',
  messagingSenderId: '562987209098',
  appId: '1:562987209098:web:2f788d189f1c0867cb3873',
  measurementId: 'G-ZT7LN4XP80',
};

const TERMINAL_FROM_APPROVED = new Set(['ORDERED', 'COMPLETED', 'REJECTED', 'CANCELED']);

type StatusEvent = {
  prId: string;
  prNumber: string;
  organization: string;
  timestamp: number;
  fromStatus: string;
  toStatus: string;
};

function parseTimestamp(value: unknown): number | null {
  if (!value) return null;
  if (typeof value === 'string') {
    const t = Date.parse(value);
    return Number.isNaN(t) ? null : t;
  }
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    try {
      return (value as { toDate: () => Date }).toDate().getTime();
    } catch {
      return null;
    }
  }
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    return (value as { seconds: number }).seconds * 1000;
  }
  return null;
}

function normalizeOrg(org: unknown): string {
  return String(org || '').trim() || 'UNKNOWN';
}

async function replayStatusHistoryViolations(sinceMs: number) {
  const db = getFirestore(initializeApp(firebaseConfig));
  const snap = await getDocs(collection(db, 'purchaseRequests'));

  const allEvents: StatusEvent[] = [];
  const prStatus = new Map<string, string>();

  snap.forEach((docSnap) => {
    const data = docSnap.data();
    const organization = normalizeOrg(data.organization);
    const prNumber = String(data.prNumber || docSnap.id);
    const history = Array.isArray(data.statusHistory) ? data.statusHistory : [];
    for (const entry of history) {
      const ts = parseTimestamp(entry.timestamp);
      if (ts === null) continue;
      const toStatus = String(entry.status || entry.toStatus || '').toUpperCase();
      const fromStatus = String(entry.fromStatus || '').toUpperCase();
      if (!toStatus) continue;
      allEvents.push({
        prId: docSnap.id,
        prNumber,
        organization,
        timestamp: ts,
        fromStatus,
        toStatus,
      });
    }
  });

  allEvents.sort((a, b) => a.timestamp - b.timestamp);

  const approvedCountByOrg = new Map<string, number>();
  const violations: Array<{
    at: string;
    organization: string;
    prNumber: string;
    approvedCount: number;
    fromStatus: string;
  }> = [];

  let pendingApprovalTransitions = 0;

  for (const ev of allEvents) {
    const org = ev.organization;
    const prevStatus = prStatus.get(ev.prId);
    const countBefore = approvedCountByOrg.get(org) ?? 0;

    const entersPending =
      ev.toStatus === 'PENDING_APPROVAL' &&
      (['IN_QUEUE', 'SUBMITTED', 'RESUBMITTED'].includes(ev.fromStatus || '') ||
        ['IN_QUEUE', 'SUBMITTED', 'RESUBMITTED'].includes(prevStatus || ''));

    if (entersPending && ev.timestamp >= sinceMs) {
      pendingApprovalTransitions++;
      if (countBefore >= MAX_APPROVED_POS_BEFORE_BLOCK) {
        violations.push({
          at: new Date(ev.timestamp).toISOString(),
          organization: org,
          prNumber: ev.prNumber,
          approvedCount: countBefore,
          fromStatus: ev.fromStatus || prevStatus || '?',
        });
      }
    }

    if (prevStatus === 'APPROVED' && TERMINAL_FROM_APPROVED.has(ev.toStatus)) {
      approvedCountByOrg.set(org, Math.max(0, countBefore - 1));
    } else if (ev.toStatus === 'APPROVED' && prevStatus !== 'APPROVED') {
      approvedCountByOrg.set(org, countBefore + 1);
    }

    prStatus.set(ev.prId, ev.toStatus);
  }

  return { pendingApprovalTransitions, violations, snap };
}

async function loadPoCapAuditLog(sinceMs: number) {
  const db = getFirestore();
  const auditRef = collection(db, PO_CAP_AUDIT_COLLECTION);
  let auditSnap;
  try {
    auditSnap = await getDocs(query(auditRef, orderBy('createdAt', 'desc'), limit(5000)));
  } catch {
    auditSnap = await getDocs(auditRef);
  }

  const entries: Array<{
    at: string;
    organization: string;
    outcome: string;
    source: string;
    approvedCount: number;
    prNumber?: string;
    userEmail?: string;
  }> = [];

  auditSnap.forEach((docSnap) => {
    const d = docSnap.data();
    const ts = parseTimestamp(d.createdAt);
    if (ts !== null && ts < sinceMs) return;
    entries.push({
      at: ts ? new Date(ts).toISOString() : 'unknown',
      organization: normalizeOrg(d.organization),
      outcome: String(d.outcome || ''),
      source: String(d.source || ''),
      approvedCount: Number(d.approvedCount ?? 0),
      prNumber: d.prNumber ? String(d.prNumber) : undefined,
      userEmail: d.userEmail ? String(d.userEmail) : undefined,
    });
  });

  return entries;
}

async function main() {
  const sinceArg = process.argv.find((a) => a.startsWith('--since='));
  const sinceMs = sinceArg ? Date.parse(sinceArg.split('=')[1]) : 0;

  if (sinceArg && Number.isNaN(sinceMs)) {
    console.error('Invalid --since= date');
    process.exit(1);
  }

  console.log('Loading purchaseRequests for history replay...');
  const { pendingApprovalTransitions, violations, snap } =
    await replayStatusHistoryViolations(sinceMs);

  console.log('\n=== A) Status history replay (cap rule) ===');
  console.log(`Threshold: block when APPROVED count >= ${MAX_APPROVED_POS_BEFORE_BLOCK}`);
  if (sinceMs) {
    console.log(`Since: ${new Date(sinceMs).toISOString()}`);
  }
  console.log(`Transitions to PENDING_APPROVAL: ${pendingApprovalTransitions}`);
  console.log(`Suspected violations (should have been blocked): ${violations.length}`);

  if (violations.length === 0) {
    console.log('No historical violations detected by replay.');
  } else {
    console.log('\n--- Suspected violations ---');
    for (const v of violations) {
      console.log(
        `${v.at} | ${v.organization} | ${v.prNumber} | APPROVED@${v.approvedCount} | from ${v.fromStatus}`
      );
    }
  }

  console.log('\n--- Current APPROVED counts by organization ---');
  const currentByOrg = new Map<string, number>();
  snap.forEach((docSnap) => {
    const data = docSnap.data();
    if (data.status === 'APPROVED') {
      const org = normalizeOrg(data.organization);
      currentByOrg.set(org, (currentByOrg.get(org) ?? 0) + 1);
    }
  });
  [...currentByOrg.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([org, n]) => {
      console.log(`${org}: ${n}${n >= MAX_APPROVED_POS_BEFORE_BLOCK ? ' (at/over cap)' : ''}`);
    });

  console.log('\n=== B) poCapAudit collection (after deploy) ===');
  try {
    const auditEntries = await loadPoCapAuditLog(sinceMs);
    if (auditEntries.length === 0) {
      console.log('No poCapAudit entries found (collection empty or not deployed yet).');
    } else {
      const blocked = auditEntries.filter((e) => e.outcome === 'blocked');
      const allowed = auditEntries.filter((e) => e.outcome === 'allowed');
      const suspiciousAllowed = allowed.filter(
        (e) => e.approvedCount >= MAX_APPROVED_POS_BEFORE_BLOCK
      );
      console.log(`Total audit entries: ${auditEntries.length}`);
      console.log(`Blocked: ${blocked.length} | Allowed: ${allowed.length}`);
      console.log(
        `Allowed while at/over cap (true violations if rule deployed): ${suspiciousAllowed.length}`
      );
      if (suspiciousAllowed.length > 0) {
        console.log('\n--- Allowed-at-cap audit entries (investigate) ---');
        for (const e of suspiciousAllowed.slice(0, 50)) {
          console.log(
            `${e.at} | ${e.organization} | ${e.prNumber || '?'} | APPROVED@${e.approvedCount} | ${e.source} | ${e.userEmail || ''}`
          );
        }
      }
      if (blocked.length > 0) {
        console.log('\n--- Recent blocked attempts (last 20) ---');
        for (const e of blocked.slice(0, 20)) {
          console.log(
            `${e.at} | ${e.organization} | APPROVED@${e.approvedCount} | ${e.source} | ${e.userEmail || ''}`
          );
        }
      }
    }
  } catch (err) {
    console.log('Could not read poCapAudit:', err);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
