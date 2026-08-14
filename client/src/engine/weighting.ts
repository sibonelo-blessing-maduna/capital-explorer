/**
 * weighting.ts — Sec 3: W(C) = (1/O(C))^alpha, and the normalized B(C).
 */
import type { Combination } from "./events";

export function weight(combo: Combination, alpha: number): number {
  if (alpha < 0) throw new Error("alpha must be >= 0");
  return Math.pow(combo.impliedProbability, alpha);
}

/** B(C) for every combination, normalized so the stakes sum to `capital`. */
export function allocate(combos: Combination[], alpha: number, capital: number): number[] {
  const weights = combos.map((c) => weight(c, alpha));
  const total = weights.reduce((a, b) => a + b, 0);
  if (total === 0) throw new Error("sum of weights is zero — check alpha/combos");
  return weights.map((w) => (capital * w) / total);
}

export function shannonEntropy(stakes: number[]): number {
  const total = stakes.reduce((a, b) => a + b, 0);
  let h = 0;
  for (const s of stakes) {
    if (s <= 0) continue;
    const p = s / total;
    h -= p * Math.log(p);
  }
  return h;
}
