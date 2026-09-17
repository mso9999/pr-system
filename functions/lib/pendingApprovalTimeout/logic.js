"use strict";
/** Calendar-day rules for stale PENDING_APPROVAL PRs. Pure — no Firebase. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.REJECT_GRACE_DAYS = exports.WARN_AFTER_DAYS = void 0;
exports.toDate = toDate;
exports.calendarDaysBetween = calendarDaysBetween;
exports.lastPendingApprovalAt = lastPendingApprovalAt;
exports.decideStaleAction = decideStaleAction;
exports.WARN_AFTER_DAYS = 30;
exports.REJECT_GRACE_DAYS = 7;
function toDate(value) {
    if (!value)
        return null;
    if (value instanceof Date && Number.isFinite(value.getTime()))
        return value;
    if (typeof value === "string") {
        const t = Date.parse(value);
        return Number.isFinite(t) ? new Date(t) : null;
    }
    if (typeof value.toDate === "function") {
        const d = value.toDate();
        return d instanceof Date && Number.isFinite(d.getTime()) ? d : null;
    }
    return null;
}
function calendarDaysBetween(from, to) {
    const start = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
    const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
    return Math.floor((end - start) / 86400000);
}
/** Most recent time this PR entered PENDING_APPROVAL. */
function lastPendingApprovalAt(data) {
    const hist = Array.isArray(data.statusHistory) ? data.statusHistory : [];
    for (let i = hist.length - 1; i >= 0; i--) {
        if (String(hist[i].status || "").toUpperCase() === "PENDING_APPROVAL") {
            const d = toDate(hist[i].timestamp);
            if (d)
                return d;
        }
    }
    return toDate(data.updatedAt) || toDate(data.createdAt);
}
function decideStaleAction(args) {
    if (!args.pendingSince)
        return "none";
    const pendingDays = calendarDaysBetween(args.pendingSince, args.now);
    if (pendingDays < exports.WARN_AFTER_DAYS)
        return "none";
    const warningIsForThisStay = args.warningSentAt && args.warningSentAt.getTime() >= args.pendingSince.getTime();
    if (!warningIsForThisStay)
        return "warn";
    const daysSinceWarning = calendarDaysBetween(args.warningSentAt, args.now);
    if (daysSinceWarning >= exports.REJECT_GRACE_DAYS)
        return "reject";
    return "none";
}
//# sourceMappingURL=logic.js.map