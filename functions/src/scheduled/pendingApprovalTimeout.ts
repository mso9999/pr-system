/**
 * PENDING_APPROVAL stale-out: warn at 30 days, auto-reject 7 days later.
 *
 * Clock starts at the latest statusHistory PENDING_APPROVAL stamp (resets if
 * the PR leaves and re-enters). A PR is never rejected without a prior
 * warning for the current stay — even if it is already far past 37 days
 * when this job first sees it.
 */
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { sendEmail } from "../utils/emailSender";
import {
  calendarDaysBetween,
  decideStaleAction,
  lastPendingApprovalAt,
  REJECT_GRACE_DAYS,
  toDate,
  WARN_AFTER_DAYS,
} from "../pendingApprovalTimeout/logic";

const db = admin.firestore();
const APP_URL = process.env.APP_URL || "https://pr.1pwrafrica.com";
const SYSTEM_USER = {
  id: "system",
  email: "notifications@1pwrafrica.com",
  name: "PR System",
};

const REJECT_NOTES =
  `Automatically rejected: pending approval for ${WARN_AFTER_DAYS} days plus a ${REJECT_GRACE_DAYS}-day grace after the warning.`;

function uniqueEmails(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const email = String(raw || "").trim().toLowerCase();
    if (!email || !email.includes("@") || seen.has(email)) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
}

async function userEmail(userId: string | undefined): Promise<string | null> {
  if (!userId) return null;
  const snap = await db.collection("users").doc(userId).get();
  return snap.exists ? String(snap.data()?.email || "").trim() || null : null;
}

async function recipientsFor(pr: FirebaseFirestore.DocumentData): Promise<string[]> {
  const requestor = pr.requestorEmail || pr.requestor?.email;
  const approverEmails = await Promise.all([userEmail(pr.approver), userEmail(pr.approver2)]);
  return uniqueEmails([requestor, ...approverEmails]);
}

function prLink(prId: string): string {
  return `${APP_URL.replace(/\/$/, "")}/pr/${prId}`;
}

function money(pr: FirebaseFirestore.DocumentData): string {
  const amount = pr.estimatedAmount ?? pr.totalAmount;
  const currency = pr.currency || "";
  if (amount == null) return "n/a";
  return `${currency} ${Number(amount).toLocaleString("en-US", { maximumFractionDigits: 2 })}`.trim();
}

async function sendWarning(args: {
  prId: string;
  pr: FirebaseFirestore.DocumentData;
  pendingDays: number;
  rejectOn: string;
}): Promise<void> {
  const to = await recipientsFor(args.pr);
  if (!to.length) {
    throw new Error(`no recipients for ${args.pr.prNumber || args.prId}`);
  }
  const link = prLink(args.prId);
  const subject = `Action required: PR ${args.pr.prNumber} will be auto-rejected in ${REJECT_GRACE_DAYS} days`;
  const text = [
    `PR ${args.pr.prNumber} has been pending approval for ${args.pendingDays} days.`,
    `If it is not approved or sent back for revision, it will be automatically rejected on ${args.rejectOn}.`,
    "",
    `Description: ${args.pr.description || "n/a"}`,
    `Amount: ${money(args.pr)}`,
    `Organization: ${args.pr.organization || "n/a"}`,
    "",
    `View PR: ${link}`,
  ].join("\n");
  const html = `
    <h2>PR ${args.pr.prNumber} will be automatically rejected</h2>
    <p>This purchase request has been in <strong>Pending Approval</strong> for <strong>${args.pendingDays} days</strong>.</p>
    <p>If the assigned approver does not approve or return it for revision, it will be <strong>automatically rejected on ${args.rejectOn}</strong> (${REJECT_GRACE_DAYS} days from this notice).</p>
    <ul>
      <li><strong>Description:</strong> ${args.pr.description || "n/a"}</li>
      <li><strong>Amount:</strong> ${money(args.pr)}</li>
      <li><strong>Organization:</strong> ${args.pr.organization || "n/a"}</li>
    </ul>
    <p><a href="${link}" style="display:inline-block;padding:10px 20px;background:#d97706;color:#fff;text-decoration:none;border-radius:4px;">Open PR</a></p>
    <p style="color:#666;font-size:12px;">This notice was sent to the requestor and the assigned approver(s).</p>
  `.trim();
  await sendEmail({ to, subject, text, html });
  await db.collection("notificationLogs").add({
    type: "STALE_APPROVAL_WARNING",
    prId: args.prId,
    prNumber: args.pr.prNumber || null,
    recipients: to,
    status: "sent",
    timestamp: new Date().toISOString(),
  });
}

async function sendRejected(args: {
  prId: string;
  pr: FirebaseFirestore.DocumentData;
}): Promise<void> {
  const to = await recipientsFor(args.pr);
  if (!to.length) return;
  const link = prLink(args.prId);
  const subject = `PR ${args.pr.prNumber} automatically rejected`;
  const text = [
    `PR ${args.pr.prNumber} was automatically rejected because it stayed in Pending Approval after the ${WARN_AFTER_DAYS}-day warning and ${REJECT_GRACE_DAYS}-day grace period.`,
    "",
    REJECT_NOTES,
    "",
    `View PR: ${link}`,
  ].join("\n");
  const html = `
    <h2>PR ${args.pr.prNumber} automatically rejected</h2>
    <p>This purchase request was rejected by the PR System because it remained in Pending Approval after the ${WARN_AFTER_DAYS}-day warning and ${REJECT_GRACE_DAYS}-day grace period.</p>
    <p><strong>Reason:</strong> ${REJECT_NOTES}</p>
    <p><a href="${link}" style="display:inline-block;padding:10px 20px;background:#dc3545;color:#fff;text-decoration:none;border-radius:4px;">View PR</a></p>
  `.trim();
  await sendEmail({ to, subject, text, html });
  await db.collection("notificationLogs").add({
    type: "STALE_APPROVAL_AUTO_REJECT",
    prId: args.prId,
    prNumber: args.pr.prNumber || null,
    recipients: to,
    status: "sent",
    timestamp: new Date().toISOString(),
  });
}

async function autoReject(prId: string, pr: FirebaseFirestore.DocumentData): Promise<void> {
  const hist = Array.isArray(pr.statusHistory) ? [...pr.statusHistory] : [];
  hist.push({
    status: "REJECTED",
    timestamp: new Date().toISOString(),
    user: SYSTEM_USER,
    notes: REJECT_NOTES,
  });
  await db.collection("purchaseRequests").doc(prId).update({
    status: "REJECTED",
    statusHistory: hist,
    rejectedAt: new Date().toISOString(),
    rejectedBy: "system",
    autoRejectedForStaleApproval: true,
    autoRejectedAt: new Date().toISOString(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await sendRejected({ prId, pr });
}

async function processPendingApprovalTimeouts(now = new Date()): Promise<{
  checked: number;
  warned: number;
  rejected: number;
  skipped: number;
  errors: string[];
}> {
  const stats = { checked: 0, warned: 0, rejected: 0, skipped: 0, errors: [] as string[] };
  const snap = await db.collection("purchaseRequests").where("status", "==", "PENDING_APPROVAL").get();

  for (const doc of snap.docs) {
    const pr = doc.data();
    if (pr.isTutorialSandbox) {
      stats.skipped += 1;
      continue;
    }
    stats.checked += 1;
    const pendingSince = lastPendingApprovalAt(pr);
    const warningSentAt = toDate(pr.staleApprovalWarningSentAt);
    const action = decideStaleAction({ now, pendingSince, warningSentAt });
    try {
      if (action === "warn") {
        const pendingDays = pendingSince ? calendarDaysBetween(pendingSince, now) : WARN_AFTER_DAYS;
        const rejectOn = new Date(now);
        rejectOn.setUTCDate(rejectOn.getUTCDate() + REJECT_GRACE_DAYS);
        await sendWarning({
          prId: doc.id,
          pr,
          pendingDays,
          rejectOn: rejectOn.toISOString().slice(0, 10),
        });
        await doc.ref.update({
          staleApprovalWarningSentAt: now.toISOString(),
          staleApprovalWarningPendingSince: pendingSince ? pendingSince.toISOString() : null,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        stats.warned += 1;
      } else if (action === "reject") {
        await autoReject(doc.id, pr);
        stats.rejected += 1;
      } else {
        stats.skipped += 1;
      }
    } catch (err: any) {
      console.error(`[pendingApprovalTimeout] ${doc.id}:`, err);
      stats.errors.push(`${doc.id}: ${err?.message || err}`);
    }
  }
  return stats;
}

export const pendingApprovalTimeout = functions
  .runWith({ memory: "512MB", timeoutSeconds: 300 })
  .pubsub.schedule("30 8 * * *")
  .timeZone("Africa/Maseru")
  .onRun(async () => {
    console.log("[pendingApprovalTimeout] starting");
    const stats = await processPendingApprovalTimeouts();
    console.log("[pendingApprovalTimeout] done", stats);
    return stats;
  });

/** Manual / dry-run from an admin: process now without waiting for 08:30. */
export const runPendingApprovalTimeoutNow = functions
  .runWith({ memory: "512MB", timeoutSeconds: 300 })
  .https.onCall(async (_data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Sign in required");
    }
    const userSnap = await db.collection("users").doc(context.auth.uid).get();
    const level = Number(userSnap.data()?.permissionLevel || 0);
    if (level !== 1 && level !== 9) {
      throw new functions.https.HttpsError("permission-denied", "Admin only");
    }
    const stats = await processPendingApprovalTimeouts();
    console.log("[runPendingApprovalTimeoutNow] done", stats);
    return stats;
  });
