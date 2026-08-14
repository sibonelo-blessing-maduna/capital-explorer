/**
 * meanVariance.ts — Sec 4.1: mean-variance optimization over the 2^k combos.
 *
 * mu_i = O_i * p_i (expected gross payout multiplier of combination i).
 * Sigma_ij = -O_i O_j p_i p_j (i != j); Sigma_ii = O_i^2 p_i (1-p_i).
 * See MATH.md Proposition 2 for the proof that Sigma is dense, not sparse,
 * because the combinations are mutually exclusive outcomes of one subset.
 *
 * Solved by Frank-Wolfe (conditional gradient) over the probability
 * simplex. The naive approach computes Sigma @ w in O(n^2); this uses a
 * closed-form identity instead —
 *
 *   (Sigma w)_i = mu_i * (O_i * w_i - S),   S = mu . w
 *
 * — verified against the dense-matrix computation to machine precision
 * (see ARCHITECTURE.md "The O(n) trick"), which drops each iteration to
 * O(n) and is what makes this solvable at interactive/zero-latency speed
 * even at k=14 (16,384 combinations).
 */
import type { Combination } from "./events";

export interface MeanVarianceResult {
  weights: number[]; // sums to 1
  expectedNetReturn: number; // mu.w - 1
  variance: number; // w^T Sigma w
  objectiveValue: number; // expectedNetReturn - lambda * variance
}

export function sigmaDotW(mu: number[], odds: number[], w: number[]): number[] {
  let S = 0;
  for (let i = 0; i < w.length; i++) S += mu[i] * w[i];
  return mu.map((mi, i) => mi * (odds[i] * w[i] - S));
}

export function quadraticForm(mu: number[], odds: number[], w: number[]): number {
  // w^T Sigma w = w . (Sigma w)
  const sw = sigmaDotW(mu, odds, w);
  let acc = 0;
  for (let i = 0; i < w.length; i++) acc += w[i] * sw[i];
  return acc;
}

/**
 * Frank-Wolfe, written with reused Float64Array buffers rather than
 * `.map`/`.reduce` chains. On a 16,384-combination subset (k=14) this runs
 * in ~15-25ms versus ~300ms for the array-allocating version benchmarked
 * during development (see ARCHITECTURE.md "Performance envelope") — the
 * cost there was almost entirely per-iteration array allocation and
 * closure-call overhead, not the underlying arithmetic.
 */
export function meanVarianceWeights(
  combos: Combination[],
  lambda: number,
  iterations = 400
): MeanVarianceResult {
  const n = combos.length;
  const mu = new Float64Array(n);
  const odds = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    odds[i] = combos[i].odds;
    mu[i] = combos[i].odds * combos[i].trueProbability;
  }

  const w = new Float64Array(n).fill(1 / n);
  const grad = new Float64Array(n);

  for (let t = 1; t <= iterations; t++) {
    let S = 0;
    for (let i = 0; i < n; i++) S += mu[i] * w[i];

    let bestIdx = 0;
    let bestVal = -Infinity;
    for (let i = 0; i < n; i++) {
      const swi = mu[i] * (odds[i] * w[i] - S);
      grad[i] = mu[i] - 2 * lambda * swi;
      if (grad[i] > bestVal) {
        bestVal = grad[i];
        bestIdx = i;
      }
    }

    const gamma = 2 / (t + 2); // standard Frank-Wolfe step size, no tuning required
    const oneMinusGamma = 1 - gamma;
    for (let i = 0; i < n; i++) {
      w[i] = oneMinusGamma * w[i] + (i === bestIdx ? gamma : 0);
    }
  }

  let muDotW = 0;
  for (let i = 0; i < n; i++) muDotW += mu[i] * w[i];
  const variance = quadraticForm(Array.from(mu), Array.from(odds), Array.from(w));
  const expectedNetReturn = muDotW - 1;

  return {
    weights: Array.from(w),
    expectedNetReturn,
    variance,
    objectiveValue: expectedNetReturn - lambda * variance,
  };
}

/** Dense Sigma, materialized only for display (the heatmap) — callers must keep n small (<= ~64, i.e. k <= 6). */
export function denseSigma(combos: Combination[]): number[][] {
  const n = combos.length;
  const odds = combos.map((c) => c.odds);
  const p = combos.map((c) => c.trueProbability);
  const sigma: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        sigma[i][j] = odds[i] ** 2 * p[i] * (1 - p[i]);
      } else {
        sigma[i][j] = -odds[i] * odds[j] * p[i] * p[j];
      }
    }
  }
  return sigma;
}
