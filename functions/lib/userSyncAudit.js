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
exports.runUserSyncAudit = exports.weeklyUserSyncAudit = void 0;
exports.runAudit = runAudit;
/**
 * Weekly Auth ↔ Firestore user-sync audit.
 *
 * Compares Firebase Auth accounts with `users/<uid>` documents and
 * reports drift via:
 *   1. A document in `auditLogs/userSync_<timestamp>` for history.
 *   2. An email to active superadmins (level 1) and user-admins
 *      (level 8) IF drift is detected.
 *
 * Anonymous Auth accounts (no email AND empty providerData) are
 * ignored — the Firebase project is shared with the 1PWR AM project,
 * which uses anonymous auth and produces large numbers of such
 * accounts that are not orphans of THIS app.
 *
 * Schedule: Mondays at 06:00 Africa/Maseru.
 *
 * Also exports a callable `runUserSyncAudit` for ad-hoc/manual runs
 * by superadmins.
 */
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const emailSender_1 = require("./utils/emailSender");
const db = admin.firestore();
const auth = admin.auth();
const ADMIN_LEVEL = 1;
const USER_ADMIN_LEVEL = 8;
async function listAllAuthUsers() {
    const out = [];
    let token;
    do {
        const r = await auth.listUsers(1000, token);
        out.push(...r.users);
        token = r.pageToken;
    } while (token);
    return out;
}
function isAnonymousAuth(u) {
    // Heuristic: anonymous Firebase Auth accounts have no email and no
    // provider data. We also catch users with an email but no provider
    // data (rare) by not treating those as anonymous, since they likely
    // result from an admin-SDK createUser path that lost its provider
    // entry.
    return !u.email && (!u.providerData || u.providerData.length === 0);
}
async function runAudit() {
    const fsSnap = await db.collection("users").get();
    const fsByUid = new Map();
    fsSnap.forEach((d) => fsByUid.set(d.id, d.data()));
    const authUsers = await listAllAuthUsers();
    const result = {
        timestamp: new Date().toISOString(),
        generatedAtMs: Date.now(),
        totals: {
            authUsers: authUsers.length,
            firestoreUsers: fsByUid.size,
            authOrphans: 0,
            firestoreOrphans: 0,
            emailMismatch: 0,
            anonymousAuthIgnored: 0,
            properlySynced: 0,
        },
        authOrphans: [],
        firestoreOrphans: [],
        emailMismatch: [],
    };
    const authByUid = new Map();
    for (const u of authUsers)
        authByUid.set(u.uid, u);
    for (const u of authUsers) {
        if (isAnonymousAuth(u)) {
            result.totals.anonymousAuthIgnored++;
            continue;
        }
        if (!fsByUid.has(u.uid)) {
            result.authOrphans.push({
                uid: u.uid,
                email: u.email || null,
                displayName: u.displayName || null,
                lastSignIn: u.metadata.lastSignInTime || null,
                createdAt: u.metadata.creationTime || null,
            });
            result.totals.authOrphans++;
        }
    }
    for (const [uid, data] of fsByUid) {
        const a = authByUid.get(uid);
        const fsEmail = String(data.email || "").trim().toLowerCase();
        if (!a) {
            result.firestoreOrphans.push({
                uid,
                email: fsEmail,
                firstName: data.firstName || "",
                lastName: data.lastName || "",
            });
            result.totals.firestoreOrphans++;
            continue;
        }
        const authEmail = String(a.email || "").trim().toLowerCase();
        if (fsEmail && authEmail && fsEmail !== authEmail) {
            result.emailMismatch.push({ uid, firestoreEmail: fsEmail, authEmail });
            result.totals.emailMismatch++;
        }
        else {
            result.totals.properlySynced++;
        }
    }
    return result;
}
async function getAdminRecipients() {
    const recipients = new Set();
    for (const lvl of [ADMIN_LEVEL, USER_ADMIN_LEVEL]) {
        const s = await db.collection("users")
            .where("permissionLevel", "==", lvl)
            .where("isActive", "==", true)
            .get();
        s.forEach((d) => {
            const e = String(d.data().email || "").trim();
            if (e)
                recipients.add(e);
        });
    }
    return [...recipients];
}
function htmlSummary(r) {
    const drift = r.totals.authOrphans + r.totals.firestoreOrphans + r.totals.emailMismatch;
    const escape = (s) => s.replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
    const orphanRows = r.authOrphans
        .slice(0, 50)
        .map((o) => `<tr><td>${escape(o.email || "<none>")}</td><td>${escape(o.uid)}</td><td>${escape(o.displayName || "")}</td><td>${escape(o.lastSignIn || "(never)")}</td></tr>`)
        .join("");
    const fsOrphanRows = r.firestoreOrphans
        .slice(0, 50)
        .map((o) => `<tr><td>${escape(o.email || "<none>")}</td><td>${escape(o.uid)}</td><td>${escape(`${o.firstName} ${o.lastName}`.trim())}</td></tr>`)
        .join("");
    const mismatchRows = r.emailMismatch
        .slice(0, 50)
        .map((m) => `<tr><td>${escape(m.uid)}</td><td>${escape(m.firestoreEmail)}</td><td>${escape(m.authEmail)}</td></tr>`)
        .join("");
    return `
<h2>PR System User-Sync Audit</h2>
<p><strong>Run at:</strong> ${escape(r.timestamp)}</p>
<p><strong>Drift:</strong> ${drift > 0 ? `<span style="color:#b00">${drift} issue(s)</span>` : `<span style="color:#070">none</span>`}</p>
<table border="1" cellpadding="4" cellspacing="0" style="border-collapse:collapse">
  <tr><th>Metric</th><th>Count</th></tr>
  <tr><td>Auth users (total)</td><td>${r.totals.authUsers}</td></tr>
  <tr><td>Anonymous Auth users (ignored — likely 1PWR AM)</td><td>${r.totals.anonymousAuthIgnored}</td></tr>
  <tr><td>Firestore users</td><td>${r.totals.firestoreUsers}</td></tr>
  <tr><td>Properly synced</td><td>${r.totals.properlySynced}</td></tr>
  <tr><td><strong>Auth orphans (no Firestore profile)</strong></td><td><strong>${r.totals.authOrphans}</strong></td></tr>
  <tr><td><strong>Firestore orphans (no Auth account)</strong></td><td><strong>${r.totals.firestoreOrphans}</strong></td></tr>
  <tr><td><strong>Email mismatch</strong></td><td><strong>${r.totals.emailMismatch}</strong></td></tr>
</table>
${r.authOrphans.length ? `<h3>Auth orphans (top ${Math.min(50, r.authOrphans.length)})</h3>
<table border="1" cellpadding="4" cellspacing="0" style="border-collapse:collapse">
  <tr><th>Email</th><th>UID</th><th>Display name</th><th>Last sign-in</th></tr>
  ${orphanRows}
</table>` : ""}
${r.firestoreOrphans.length ? `<h3>Firestore orphans (top ${Math.min(50, r.firestoreOrphans.length)})</h3>
<table border="1" cellpadding="4" cellspacing="0" style="border-collapse:collapse">
  <tr><th>Email</th><th>UID</th><th>Name</th></tr>
  ${fsOrphanRows}
</table>` : ""}
${r.emailMismatch.length ? `<h3>Email mismatch (top ${Math.min(50, r.emailMismatch.length)})</h3>
<table border="1" cellpadding="4" cellspacing="0" style="border-collapse:collapse">
  <tr><th>UID</th><th>Firestore email</th><th>Auth email</th></tr>
  ${mismatchRows}
</table>` : ""}
<p style="color:#666;font-size:12px">
Generated by <code>weeklyUserSyncAudit</code> cloud function. Use
<code>scripts/reconcile-firestore-user.ts</code> to fix Auth orphans
or <code>scripts/fix-user-auth.ts</code> to fix Firestore orphans.
</p>`;
}
exports.weeklyUserSyncAudit = functions
    .runWith({ timeoutSeconds: 540, memory: "512MB" })
    .pubsub.schedule("0 6 * * 1") // Mondays at 06:00
    .timeZone("Africa/Maseru")
    .onRun(async () => {
    console.log("Running weekly user-sync audit...");
    const result = await runAudit();
    const docId = `userSync_${new Date().toISOString().replace(/[:.]/g, "-")}`;
    await db.collection("auditLogs").doc(docId).set(result);
    const drift = result.totals.authOrphans + result.totals.firestoreOrphans + result.totals.emailMismatch;
    console.log(`Audit complete. Drift: ${drift}. Stored at auditLogs/${docId}`);
    if (drift === 0)
        return null;
    const recipients = await getAdminRecipients();
    if (recipients.length === 0) {
        console.warn("No admin recipients — skipping email notification");
        return null;
    }
    try {
        await (0, emailSender_1.sendEmail)({
            from: '"1PWR System" <notifications@1pwrafrica.com>',
            to: recipients,
            subject: `[PR System] User-sync audit: ${drift} drift issue(s)`,
            text: `User-sync audit detected ${drift} issue(s). See auditLogs/${docId} or open the app to view details.`,
            html: htmlSummary(result),
        });
        console.log(`Sent audit summary to ${recipients.length} admin(s)`);
    }
    catch (e) {
        console.error("Failed to send audit email:", e);
    }
    return null;
});
exports.runUserSyncAudit = functions.https.onCall(async (_data, context) => {
    var _a;
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Sign-in required");
    }
    const callerDoc = await db.collection("users").doc(context.auth.uid).get();
    const lvl = Number((_a = callerDoc.data()) === null || _a === void 0 ? void 0 : _a.permissionLevel);
    if (lvl !== ADMIN_LEVEL && lvl !== USER_ADMIN_LEVEL) {
        throw new functions.https.HttpsError("permission-denied", "Superadmin or User Admin only");
    }
    const result = await runAudit();
    const docId = `userSync_${new Date().toISOString().replace(/[:.]/g, "-")}`;
    await db.collection("auditLogs").doc(docId).set(result);
    return { success: true, auditId: docId, totals: result.totals };
});
//# sourceMappingURL=userSyncAudit.js.map