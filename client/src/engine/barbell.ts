/**
 * barbell.ts — Sec 4.3: two-pool multi-tiered distribution.
 *
 * The ratio optimization has a closed form here (rather than a numerical
 * search): the objective r*A + (1-r)*B - lambda*(r^2*Vs + (1-r)^2*Vr) is
 * quadratic (concave for lambda>0) in the single scalar r, so its
 * maximizer is found by setting the derivative to zero directly.
 */
import type { Combination } from "./events";
import { allocate } from "./weighting";
import { quadraticForm } from "./meanVariance";

export interface PoolStats {
  expectedReturnPerUnit: number;
  variancePerUnit: number;
}

export function poolStats(combos: Combination[], alpha: number): PoolStats {
  const weights = allocate(combos, alpha, 1);
  const mu = combos.map((c) => c.odds * c.trueProbability);
  const odds = combos.map((c) => c.odds);
  const expectedReturnPerUnit = mu.reduce((s, mi, i) => s + mi * weights[i], 0) - 1;
  const variancePerUnit = quadraticForm(mu, odds, weights);
  return { expectedReturnPerUnit, variancePerUnit };
}

export interface BarbellResult {
  ratioSafe: number;
  capitalSafe: number;
  capitalRisk: number;
  safeStats: PoolStats;
  riskStats: PoolStats;
  portfolioExpectedReturn: number;
  portfolioVariance: number;
}

export function barbellOptimize(
  safeCombos: Combination[],
  riskCombos: Combination[],
  capital: number,
  alphaSafe: number,
  alphaRisk: number,
  lambda: number
): BarbellResult {
  const safeStats = poolStats(safeCombos, alphaSafe);
  const riskStats = poolStats(riskCombos, alphaRisk);
  const { expectedReturnPerUnit: A, variancePerUnit: Vs } = safeStats;
  const { expectedReturnPerUnit: B, variancePerUnit: Vr } = riskStats;

  let ratioSafe: number;
  if (lambda <= 0) {
    ratioSafe = A >= B ? 1 : 0; // pure EV maximization is a boundary solution
  } else if (Vs + Vr === 0) {
    ratioSafe = 0.5;
  } else {
    ratioSafe = (A - B + 2 * lambda * Vr) / (2 * lambda * (Vs + Vr));
  }
  ratioSafe = Math.min(1, Math.max(0, ratioSafe));

  const portfolioExpectedReturn = ratioSafe * A + (1 - ratioSafe) * B;
  const portfolioVariance = ratioSafe ** 2 * Vs + (1 - ratioSafe) ** 2 * Vr;

  return {
    ratioSafe,
    capitalSafe: ratioSafe * capital,
    capitalRisk: (1 - ratioSafe) * capital,
    safeStats,
    riskStats,
    portfolioExpectedReturn,
    portfolioVariance,
  };
}
