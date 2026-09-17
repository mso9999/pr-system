"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPendingApprovalTimeoutNow = exports.pendingApprovalTimeout = void 0;
/**
 * PENDING_APPROVAL stale-out: warn at 30 days, auto-reject 7 days later.
 *
 * Clock starts at the latest statusHistory PENDING_APPROVAL stamp (resets if
 * the PR leaves and re-enters). A PR is never rejected without a prior
 * warning for the current stay — even if it is already far past 37 days
 * when this job first sees it.
 */
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const emailSender_1 = require("../utils/emailSender");
const logic_1 = require("../pendingApprovalTimeout/logic");
const db = admin.firestore();
const APP_URL = process.env.APP_URL || "https://pr.1pwrafrica.com";
const SYSTEM_USER = {
    id: "system",
    email: "notifications@1pwrafrica.com",
    name: "PR System",
};
const REJECT_NOTES = `Automatically rejected: pending approval for ${logic_1.WARN_AFTER_DAYS} days plus a ${logic_1.REJECT_GRACE_DAYS}-day grace after the warning.`;
function uniqueEmails(values) {
    const seen = new Set();
    const out = [];
    for (const raw of values) {
        const email = String(raw || "").trim().toLowerCase();
        if (!email || !email.includes("@") || seen.has(email))
            continue;
        seen.add(email);
        out.push(email);
    }
    return out;
}
async function userEmail(userId) {
    var _a;
    if (!userId)
        return null;
    const snap = await db.collection("users").doc(userId).get();
    return snap.exists ? String(((_a = snap.data()) === null || _a === void 0 ? void 0 : _a.email) || "").trim() || null : null;
}
async function recipientsFor(pr) {
    var _a;
    const requestor = pr.requestorEmail || ((_a = pr.requestor) === null || _a === void 0 ? void 0 : _a.email);
    const approverEmails = await Promise.all([userEmail(pr.approver), userEmail(pr.approver2)]);
    return uniqueEmails([requestor, ...approverEmails]);
}
function prLink(prId) {
    return `${APP_URL.replace(/\/$/, "")}/pr/${prId}`;
}
function money(pr) {
    var _a;
    const amount = (_a = pr.estimatedAmount) !== null && _a !== void 0 ? _a : pr.totalAmount;
    const currency = pr.currency || "";
    if (amount == null)
        return "n/a";
    return `${currency} ${Number(amount).toLocaleString("en-US", { maximumFractionDigits: 2 })}`.trim();
}
async function sendWarning(args) {
    const to = await recipientsFor(args.pr);
    if (!to.length) {
        throw new Error(`no recipients for ${args.pr.prNumber || args.prId}`);
    }
    const link = prLink(args.prId);
    const subject = `Action required: PR ${args.pr.prNumber} will be auto-rejected in ${logic_1.REJECT_GRACE_DAYS} days`;
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
    <p>If the assigned approver does not approve or return it for revision, it will be <strong>automatically rejected on ${args.rejectOn}</strong> (${logic_1.REJECT_GRACE_DAYS} days from this notice).</p>
    <ul>
      <li><strong>Description:</strong> ${args.pr.description || "n/a"}</li>
      <li><strong>Amount:</strong> ${money(args.pr)}</li>
      <li><strong>Organization:</strong> ${args.pr.organization || "n/a"}</li>
    </ul>
    <p><a href="${link}" style="display:inline-block;padding:10px 20px;background:#d97706;color:#fff;text-decoration:none;border-radius:4px;">Open PR</a></p>
    <p style="color:#666;font-size:12px;">This notice was sent to the requestor and the assigned approver(s).</p>
  `.trim();
    await (0, emailSender_1.sendEmail)({ to, subject, text, html });
    await db.collection("notificationLogs").add({
        type: "STALE_APPROVAL_WARNING",
        prId: args.prId,
        prNumber: args.pr.prNumber || null,
        recipients: to,
        status: "sent",
        timestamp: new Date().toISOString(),
    });
}
async function sendRejected(args) {
    const to = await recipientsFor(args.pr);
    if (!to.length)
        return;
    const link = prLink(args.prId);
    const subject = `PR ${args.pr.prNumber} automatically rejected`;
    const text = [
        `PR ${args.pr.prNumber} was automatically rejected because it stayed in Pending Approval after the ${logic_1.WARN_AFTER_DAYS}-day warning and ${logic_1.REJECT_GRACE_DAYS}-day grace period.`,
        "",
        REJECT_NOTES,
        "",
        `View PR: ${link}`,
    ].join("\n");
    const html = `
    <h2>PR ${args.pr.prNumber} automatically rejected</h2>
    <p>This purchase request was rejected by the PR System because it remained in Pending Approval after the ${logic_1.WARN_AFTER_DAYS}-day warning and ${logic_1.REJECT_GRACE_DAYS}-day grace period.</p>
    <p><strong>Reason:</strong> ${REJECT_NOTES}</p>
    <p><a href="${link}" style="display:inline-block;padding:10px 20px;background:#dc3545;color:#fff;text-decoration:none;border-radius:4px;">View PR</a></p>
  `.trim();
    await (0, emailSender_1.sendEmail)({ to, subject, text, html });
    await db.collection("notificationLogs").add({
        type: "STALE_APPROVAL_AUTO_REJECT",
        prId: args.prId,
        prNumber: args.pr.prNumber || null,
        recipients: to,
        status: "sent",
        timestamp: new Date().toISOString(),
    });
}
async function autoReject(prId, pr) {
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
async function processPendingApprovalTimeouts(now = new Date()) {
    const stats = { checked: 0, warned: 0, rejected: 0, skipped: 0, errors: [] };
    const snap = await db.collection("purchaseRequests").where("status", "==", "PENDING_APPROVAL").get();
    for (const doc of snap.docs) {
        const pr = doc.data();
        if (pr.isTutorialSandbox) {
            stats.skipped += 1;
            continue;
        }
        stats.checked += 1;
        const pendingSince = (0, logic_1.lastPendingApprovalAt)(pr);
        const warningSentAt = (0, logic_1.toDate)(pr.staleApprovalWarningSentAt);
        const action = (0, logic_1.decideStaleAction)({ now, pendingSince, warningSentAt });
        try {
            if (action === "warn") {
                const pendingDays = pendingSince ? (0, logic_1.calendarDaysBetween)(pendingSince, now) : logic_1.WARN_AFTER_DAYS;
                const rejectOn = new Date(now);
                rejectOn.setUTCDate(rejectOn.getUTCDate() + logic_1.REJECT_GRACE_DAYS);
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
            }
            else if (action === "reject") {
                await autoReject(doc.id, pr);
                stats.rejected += 1;
            }
            else {
                stats.skipped += 1;
            }
        }
        catch (err) {
            console.error(`[pendingApprovalTimeout] ${doc.id}:`, err);
            stats.errors.push(`${doc.id}: ${(err === null || err === void 0 ? void 0 : err.message) || err}`);
        }
    }
    return stats;
}
exports.pendingApprovalTimeout = functions
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
exports.runPendingApprovalTimeoutNow = functions
    .runWith({ memory: "512MB", timeoutSeconds: 300 })
    .https.onCall(async (_data, context) => {
    var _a;
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Sign in required");
    }
    const userSnap = await db.collection("users").doc(context.auth.uid).get();
    const level = Number(((_a = userSnap.data()) === null || _a === void 0 ? void 0 : _a.permissionLevel) || 0);
    if (level !== 1 && level !== 9) {
        throw new functions.https.HttpsError("permission-denied", "Admin only");
    }
    const stats = await processPendingApprovalTimeouts();
    console.log("[runPendingApprovalTimeoutNow] done", stats);
    return stats;
});
//# sourceMappingURL=pendingApprovalTimeout.js.map