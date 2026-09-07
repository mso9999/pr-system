/** Percentile helpers for /lead-times. Pure — no Firebase imports. */

export interface PercentileBlock {
  p50: number;
  p80: number;
  p95: number;
  mean: number;
}

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const w = idx - lo;
  return sorted[lo] * (1 - w) + sorted[hi] * w;
}

export function percentileBlock(values: number[]): PercentileBlock | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mean = sorted.reduce((s, v) => s + v, 0) / sorted.length;
  const round1 = (n: number) => Math.round(n * 10) / 10;
  return {
    p50: round1(percentile(sorted, 50)),
    p80: round1(percentile(sorted, 80)),
    p95: round1(percentile(sorted, 95)),
    mean: round1(mean),
  };
}

export function daysBetween(fromIso: string | null | undefined, toIso: string | null | undefined): number | null {
  if (!fromIso || !toIso) return null;
  const a = Date.parse(fromIso);
  const b = Date.parse(toIso);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
  return (b - a) / 86_400_000;
}
