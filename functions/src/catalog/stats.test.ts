import { describe, expect, it } from "vitest";
import { daysBetween, percentile, percentileBlock } from "./stats";
import { deriveVendorOrigin } from "./vendorOrigin";

describe("percentile", () => {
  it("returns the only value for a singleton", () => {
    expect(percentile([18], 50)).toBe(18);
    expect(percentile([18], 95)).toBe(18);
  });

  it("interpolates between ranks", () => {
    expect(percentile([10, 20, 30, 40, 50], 50)).toBe(30);
    expect(percentile([10, 20], 50)).toBe(15);
  });
});

describe("percentileBlock", () => {
  it("returns null for an empty set", () => {
    expect(percentileBlock([])).toBeNull();
  });

  it("publishes p50/p80/p95 and mean", () => {
    const block = percentileBlock([10, 20, 30, 40, 50]);
    expect(block).toEqual({ p50: 30, p80: 42, p95: 48, mean: 30 });
  });
});

describe("daysBetween", () => {
  it("returns fractional days and rejects inverted ranges", () => {
    expect(daysBetween("2026-07-01T00:00:00Z", "2026-07-19T00:00:00Z")).toBe(18);
    expect(daysBetween("2026-07-19T00:00:00Z", "2026-07-01T00:00:00Z")).toBeNull();
    expect(daysBetween(null, "2026-07-01T00:00:00Z")).toBeNull();
  });
});

describe("deriveVendorOrigin", () => {
  it("honours an explicit override", () => {
    expect(deriveVendorOrigin("China", "local")).toBe("local");
  });

  it("classifies operating countries as local and SA as regional", () => {
    expect(deriveVendorOrigin("Lesotho")).toBe("local");
    expect(deriveVendorOrigin("ZM")).toBe("local");
    expect(deriveVendorOrigin("South Africa")).toBe("regional");
    expect(deriveVendorOrigin("ZA")).toBe("regional");
  });

  it("classifies China / India / Europe as import", () => {
    expect(deriveVendorOrigin("China")).toBe("import");
    expect(deriveVendorOrigin("CN")).toBe("import");
    expect(deriveVendorOrigin("India")).toBe("import");
  });

  it("returns null when country is unknown", () => {
    expect(deriveVendorOrigin(null)).toBeNull();
    expect(deriveVendorOrigin("Atlantis")).toBeNull();
  });
});
