import { describe, expect, it } from "vitest";
import {
  calendarDaysBetween,
  decideStaleAction,
  lastPendingApprovalAt,
  REJECT_GRACE_DAYS,
  WARN_AFTER_DAYS,
} from "./logic";

describe("calendarDaysBetween", () => {
  it("counts UTC calendar days, not elapsed hours", () => {
    expect(calendarDaysBetween(new Date("2026-08-01T23:00:00Z"), new Date("2026-08-31T01:00:00Z"))).toBe(30);
    expect(calendarDaysBetween(new Date("2026-08-01T00:00:00Z"), new Date("2026-08-01T23:00:00Z"))).toBe(0);
  });
});

describe("lastPendingApprovalAt", () => {
  it("uses the latest PENDING_APPROVAL history entry", () => {
    const d = lastPendingApprovalAt({
      statusHistory: [
        { status: "IN_QUEUE", timestamp: "2026-07-01T00:00:00Z" },
        { status: "PENDING_APPROVAL", timestamp: "2026-08-01T00:00:00Z" },
        { status: "REVISION_REQUIRED", timestamp: "2026-08-10T00:00:00Z" },
        { status: "PENDING_APPROVAL", timestamp: "2026-09-01T00:00:00Z" },
      ],
    });
    expect(d?.toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });

  it("falls back to updatedAt when history has no pending stamp", () => {
    const d = lastPendingApprovalAt({
      updatedAt: "2026-09-10T00:00:00Z",
      createdAt: "2026-01-01T00:00:00Z",
    });
    expect(d?.toISOString()).toBe("2026-09-10T00:00:00.000Z");
  });
});

describe("decideStaleAction", () => {
  const pendingSince = new Date("2026-08-01T00:00:00Z");

  it("does nothing before day 30", () => {
    expect(
      decideStaleAction({
        now: new Date("2026-08-30T12:00:00Z"),
        pendingSince,
        warningSentAt: null,
      })
    ).toBe("none");
  });

  it("warns once on or after day 30", () => {
    expect(
      decideStaleAction({
        now: new Date("2026-08-31T12:00:00Z"),
        pendingSince,
        warningSentAt: null,
      })
    ).toBe("warn");
    expect(WARN_AFTER_DAYS).toBe(30);
  });

  it("does not reject until 7 days after the warning", () => {
    expect(
      decideStaleAction({
        now: new Date("2026-09-06T12:00:00Z"),
        pendingSince,
        warningSentAt: new Date("2026-08-31T00:00:00Z"),
      })
    ).toBe("none");
    expect(
      decideStaleAction({
        now: new Date("2026-09-07T12:00:00Z"),
        pendingSince,
        warningSentAt: new Date("2026-08-31T00:00:00Z"),
      })
    ).toBe("reject");
    expect(REJECT_GRACE_DAYS).toBe(7);
  });

  it("re-warns if the PR re-entered PENDING_APPROVAL after a previous warning", () => {
    expect(
      decideStaleAction({
        now: new Date("2026-10-15T12:00:00Z"),
        pendingSince: new Date("2026-09-15T00:00:00Z"),
        warningSentAt: new Date("2026-08-31T00:00:00Z"),
      })
    ).toBe("warn");
  });

  it("warns first even if the PR is already far past 37 days (no silent reject)", () => {
    expect(
      decideStaleAction({
        now: new Date("2026-10-01T12:00:00Z"),
        pendingSince,
        warningSentAt: null,
      })
    ).toBe("warn");
  });
});
