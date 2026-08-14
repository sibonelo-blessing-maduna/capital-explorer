/**
 * engine/index.ts — single entry point the UI imports from.
 *
 * `computeAll` is the one function the React state layer calls on every
 * parameter change; it fans out to every sub-module and returns a single
 * plain-object snapshot that every panel component reads from. Keeping
 * one call site makes it easy to verify there's no hidden network I/O in
 * the interactive loop (there isn't — see ARCHITECTURE.md).
 */
import { type EventDef, type Combination, generateCombinations, aggregateImpliedProbability } from "./events";
import { allocate, weight, shannonEntropy } from "./weighting";
import { meanVarianceWeights, denseSigma, type MeanVarianceResult } from "./meanVariance";
import { principalProtectionAllocate, optimizeAlphaForPrincipalProtection } from "./principalProtection";
import { barbellOptimize } from "./barbell";
import { maxEntropyAllocate, feasibleTauRange } from "./maxEntropy";
import { nChooseK, combinatorialGrowth, MAX_N, MAX_K_FULL_DETAIL } from "./combinatorics";

export * from "./events";
export * from "./weighting";
export * from "./meanVariance";
export * from "./principalProtection";
export * from "./barbell";
export * from "./maxEntropy";
export * from "./combinatorics";

export interface Params {
  universe: EventDef[];
  k: number;
  alpha: number;
  lambda: number;
  tau: number;
  capital: number;
}

export interface AlphaOneHedge {
  bookLoad: number; // S
  deterministicReturn: number; // 1/S - 1
  deterministicPayout: number; // capital / S
}

export function computeAlphaOneHedge(combos: Combination[], capital: number): AlphaOneHedge {
  const S = aggregateImpliedProbability(combos);
  return { bookLoad: S, deterministicReturn: 1 / S - 1, deterministicPayout: capital / S };
}

export interface Snapshot {
  subset: EventDef[];
  combos: Combination[];
  allocationAlpha: number[];
  sigma: number[][] | null; // null when k is too large to render a heatmap
  meanVariance: MeanVarianceResult;
  principalProtection: ReturnType<typeof principalProtectionAllocate>;
  principalProtectionOptimum: ReturnType<typeof optimizeAlphaForPrincipalProtection>;
  maxEntropy: MaxEntropyResult_or_null;
  tauRange: [number, number];
  alphaOneHedge: AlphaOneHedge;
  combinatorialGrowth: { k: number; combinations: number }[];
}

type MaxEntropyResult_or_null = ReturnType<typeof maxEntropyAllocate> | null;

export function computeAll(params: Params): Snapshot {
  const k = Math.min(params.k, params.universe.length, MAX_K_FULL_DETAIL);
  const subset = params.universe.slice(0, k);
  const combos = generateCombinations(subset);

  const allocationAlpha = allocate(combos, params.alpha, params.capital);
  const sigma = combos.length <= 64 ? denseSigma(combos) : null; // cap heatmap at k<=6 (64 combos) for legibility + speed

  const meanVariance = meanVarianceWeights(combos, params.lambda);
  const principalProtection = principalProtectionAllocate(combos, params.capital, params.alpha);
  const principalProtectionOptimum = optimizeAlphaForPrincipalProtection(combos, params.capital);

  const tauRange = feasibleTauRange(combos);
  let maxEntropy: MaxEntropyResult_or_null = null;
  const clampedTau = Math.min(Math.max(params.tau, tauRange[0] + 1e-6), tauRange[1] - 1e-6);
  try {
    maxEntropy = maxEntropyAllocate(combos, params.capital, clampedTau);
  } catch {
    maxEntropy = null;
  }

  const alphaOneHedge = computeAlphaOneHedge(combos, params.capital);

  return {
    subset,
    combos,
    allocationAlpha,
    sigma,
    meanVariance,
    principalProtection,
    principalProtectionOptimum,
    maxEntropy,
    tauRange,
    alphaOneHedge,
    combinatorialGrowth: combinatorialGrowth(Math.max(k, 12)),
  };
}

export function computeBarbell(
  universe: EventDef[],
  k1: number,
  k2Start: number,
  capital: number,
  alphaSafe: number,
  alphaRisk: number,
  lambda: number
) {
  const safeSubset = universe.slice(0, k1);
  const riskSubset = universe.slice(k2Start, universe.length);
  const safeCombos = generateCombinations(safeSubset);
  const riskCombos = generateCombinations(riskSubset.length > 0 ? riskSubset : universe.slice(k1));
  return barbellOptimize(safeCombos, riskCombos, capital, alphaSafe, alphaRisk, lambda);
}

export const limits = { MAX_N, MAX_K_FULL_DETAIL, nChooseK };
