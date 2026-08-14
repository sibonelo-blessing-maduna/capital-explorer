/**
 * principalProtection.ts — Sec 4.2: guarantee P back if the favorite hits.
 */
import type { Combination } from "./events";
import { allocate } from "./weighting";

export interface PrincipalProtectionResult {
  favorite: Combination;
  favoriteStake: number;
  remainingCapital: number;
  remainingCombos: Combination[];
  remainingStakes: number[];
  alphaUsed: number;
}

function findFavoriteIndex(combos: Combination[]): number {
  let bestIdx = 0;
  for (let i = 1; i < combos.length; i++) {
    if (combos[i].impliedProbability > combos[bestIdx].impliedProbability) bestIdx = i;
  }
  return bestIdx;
}

export function principalProtectionAllocate(
  combos: Combination[],
  capital: number,
  alpha: number
): PrincipalProtectionResult {
  const favIdx = findFavoriteIndex(combos);
  const favorite = combos[favIdx];
  const favoriteStake = capital / favorite.odds;
  if (favoriteStake > capital) {
    throw new Error("Favorite's odds are too short to protect all of P at this capital level.");
  }
  const remainingCombos = combos.filter((_, i) => i !== favIdx);
  const remainingCapital = capital - favoriteStake;
  const remainingStakes = allocate(remainingCombos, alpha, remainingCapital);
  return { favorite, favoriteStake, remainingCapital, remainingCombos, remainingStakes, alphaUsed: alpha };
}

/** Builds a fast, allocation-free evaluator of "expected profit of the remainder at alpha", reused by both the optimizer and the chart-curve function below. */
function makeEvEvaluator(combos: Combination[], capital: number) {
  const favIdx = findFavoriteIndex(combos);
  const favorite = combos[favIdx];
  const favoriteStake = capital / favorite.odds;
  const remainingCapital = capital - favoriteStake;

  const n = combos.length - 1;
  const logImplied = new Float64Array(n); // ln(1/O(C)); W(C)=(1/O(C))^alpha = exp(alpha * logImplied)
  const remOdds = new Float64Array(n);
  const remTrueProb = new Float64Array(n);
  const remWeight = new Float64Array(n); // scratch, reused every call
  {
    let j = 0;
    for (let i = 0; i < combos.length; i++) {
      if (i === favIdx) continue;
      logImplied[j] = Math.log(combos[i].impliedProbability);
      remOdds[j] = combos[i].odds;
      remTrueProb[j] = combos[i].trueProbability;
      j++;
    }
  }

  // Precomputing ln(1/O(C)) once (above) and using exp(alpha * ln(x)) instead
  // of Math.pow(x, alpha) inside the search loop roughly halves the cost of
  // each evaluation, since Math.pow recomputes the log internally on every
  // call even though x is fixed across the whole search — see
  // ARCHITECTURE.md "Performance envelope".
  function evAtAlpha(alpha: number): number {
    let total = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.exp(alpha * logImplied[i]);
      remWeight[i] = w;
      total += w;
    }
    let ev = 0;
    for (let i = 0; i < n; i++) {
      const stake = (remainingCapital * remWeight[i]) / total;
      ev += remTrueProb[i] * stake * remOdds[i];
    }
    return ev - remainingCapital;
  }

  return evAtAlpha;
}

const GOLDEN = (Math.sqrt(5) - 1) / 2;

/**
 * Golden-section search for the alpha maximizing the remainder's expected
 * profit (the paper's "maximize alpha" instruction, given a concrete
 * stopping rule — see MATH.md Finding 3). Reuses one function evaluation
 * per iteration, so ~60 iterations (very high precision) costs ~61 calls
 * to the O(n) evaluator — a few milliseconds even at k=14, versus the
 * ~170-evaluation grid+refine approach this replaced (see
 * ARCHITECTURE.md "Performance envelope").
 */
export function optimizeAlphaForPrincipalProtection(
  combos: Combination[],
  capital: number,
  alphaMax = 20
): { alphaStar: number; result: PrincipalProtectionResult } {
  const evAtAlpha = makeEvEvaluator(combos, capital);

  let a = 0;
  let b = alphaMax;
  let c = b - GOLDEN * (b - a);
  let d = a + GOLDEN * (b - a);
  let fc = evAtAlpha(c);
  let fd = evAtAlpha(d);

  for (let i = 0; i < 60; i++) {
    if (fc > fd) {
      b = d;
      d = c;
      fd = fc;
      c = b - GOLDEN * (b - a);
      fc = evAtAlpha(c);
    } else {
      a = c;
      c = d;
      fc = fd;
      d = a + GOLDEN * (b - a);
      fd = evAtAlpha(d);
    }
  }
  const alphaStar = (a + b) / 2;
  return { alphaStar, result: principalProtectionAllocate(combos, capital, alphaStar) };
}

/**
 * A modest-resolution EV-vs-alpha curve for the chart in the Principal
 * Protection panel. Deliberately separate from the optimizer above and
 * only called when that panel is actually visible (see the `usePanelData`
 * hook in the client state layer) — computing a display curve on every
 * keystroke for a panel the user isn't looking at would waste the budget
 * the golden-section rewrite just bought back.
 */
export function principalProtectionEvCurve(
  combos: Combination[],
  capital: number,
  alphaMax = 20,
  points = 60
): { alpha: number; ev: number }[] {
  const evAtAlpha = makeEvEvaluator(combos, capital);
  const curve = new Array<{ alpha: number; ev: number }>(points + 1);
  for (let i = 0; i <= points; i++) {
    const alpha = (alphaMax * i) / points;
    curve[i] = { alpha, ev: evAtAlpha(alpha) };
  }
  return curve;
}
