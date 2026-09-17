/** Calendar-day rules for stale PENDING_APPROVAL PRs. Pure — no Firebase. */

export const WARN_AFTER_DAYS = 30;
export const REJECT_GRACE_DAYS = 7;

export function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date && Number.isFinite(value.getTime())) return value;
  if (typeof value === "string") {
    const t = Date.parse(value);
    return Number.isFinite(t) ? new Date(t) : null;
  }
  if (typeof (value as { toDate?: () => Date }).toDate === "function") {
    const d = (value as { toDate: () => Date }).toDate();
    return d instanceof Date && Number.isFinite(d.getTime()) ? d : null;
  }
  return null;
}

export function calendarDaysBetween(from: Date, to: Date): number {
  const start = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.floor((end - start) / 86_400_000);
}

/** Most recent time this PR entered PENDING_APPROVAL. */
export function lastPendingApprovalAt(data: {
  statusHistory?: Array<{ status?: string; timestamp?: unknown }>;
  updatedAt?: unknown;
  createdAt?: unknown;
}): Date | null {
  const hist = Array.isArray(data.statusHistory) ? data.statusHistory : [];
  for (let i = hist.length - 1; i >= 0; i--) {
    if (String(hist[i].status || "").toUpperCase() === "PENDING_APPROVAL") {
      const d = toDate(hist[i].timestamp);
      if (d) return d;
    }
  }
  return toDate(data.updatedAt) || toDate(data.createdAt);
}

export type StaleAction = "warn" | "reject" | "none";

export function decideStaleAction(args: {
  now: Date;
  pendingSince: Date | null;
  warningSentAt: Date | null;
}): StaleAction {
  if (!args.pendingSince) return "none";
  const pendingDays = calendarDaysBetween(args.pendingSince, args.now);
  if (pendingDays < WARN_AFTER_DAYS) return "none";

  const warningIsForThisStay =
    args.warningSentAt && args.warningSentAt.getTime() >= args.pendingSince.getTime();

  if (!warningIsForThisStay) return "warn";

  const daysSinceWarning = calendarDaysBetween(args.warningSentAt, args.now);
  if (daysSinceWarning >= REJECT_GRACE_DAYS) return "reject";
  return "none";
}
