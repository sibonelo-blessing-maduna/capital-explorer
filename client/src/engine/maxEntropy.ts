/**
 * maxEntropy.ts — Sec 4.4: closed-form Gibbs/Boltzmann maximum-entropy solution.
 *
 * B(C) = P * exp(beta * g(C)) / sum exp(beta * g(C')), g(C) = O(C)*p(C),
 * for the beta satisfying the return constraint. Solved by bisection with
 * a single reused scratch buffer (see meanVariance.ts / principalProtection.ts
 * for the same pattern and why it matters at large k).
 */
import type { Combination } from "./events";
import { shannonEntropy } from "./weighting";

export interface MaxEntropyResult {
  stakes: number[];
  beta: number;
  achievedReturnRatio: number; // sum(B(C)*g(C)) / P
  entropy: number;
}

function computeG(combos: Combination[]): Float64Array {
  const g = new Float64Array(combos.length);
  for (let i = 0; i < combos.length; i++) g[i] = combos[i].odds * combos[i].trueProbability;
  return g;
}

function minMax(g: Float64Array): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < g.length; i++) {
    if (g[i] < lo) lo = g[i];
    if (g[i] > hi) hi = g[i];
  }
  return [lo, hi];
}

export function feasibleTauRange(combos: Combination[]): [number, number] {
  const [lo, hi] = minMax(computeG(combos));
  return [lo - 1, hi - 1];
}

export function maxEntropyAllocate(combos: Combination[], capital: number, tau: number): MaxEntropyResult {
  const n = combos.length;
  const g = computeG(combos);
  const target = 1 + tau;
  const [gMin, gMax] = minMax(g);
  if (target < gMin || target > gMax) {
    throw new Error(
      `tau=${tau} is infeasible: achievable return ratio must lie in [${(gMin - 1).toFixed(6)}, ${(gMax - 1).toFixed(6)}]`
    );
  }

  const ez = new Float64Array(n); // scratch buffer reused across every bisection step

  function evalBeta(beta: number): { achieved: number; total: number } {
    let total = 0;
    for (let i = 0; i < n; i++) {
      const e = Math.exp(beta * (g[i] - gMax));
      ez[i] = e;
      total += e;
    }
    let weighted = 0;
    for (let i = 0; i < n; i++) weighted += ez[i] * g[i];
    return { achieved: weighted / total, total };
  }

  function stakesFromEz(total: number): number[] {
    const stakes = new Array<number>(n);
    for (let i = 0; i < n; i++) stakes[i] = (capital * ez[i]) / total;
    return stakes;
  }

  if (gMax - gMin < 1e-12) {
    const { total } = evalBeta(0);
    const stakes = stakesFromEz(total);
    return { stakes, beta: 0, achievedReturnRatio: gMin, entropy: shannonEntropy(stakes) };
  }

  // Bisection: achieved-return is monotonically increasing in beta.
  let lo = -300;
  let hi = 300;
  let lastTotal = 1;
  for (let iter = 0; iter < 50; iter++) {
    const mid = (lo + hi) / 2;
    const { achieved, total } = evalBeta(mid);
    lastTotal = total;
    if (achieved - target < 0) lo = mid;
    else hi = mid;
  }
  const beta = (lo + hi) / 2;
  const { achieved, total } = evalBeta(beta);
  lastTotal = total;
  const stakes = stakesFromEz(lastTotal);
  return { stakes, beta, achievedReturnRatio: achieved, entropy: shannonEntropy(stakes) };
}
