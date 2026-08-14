/**
 * __verify.ts — scratch script cross-checking the TS engine against the
 * known numerical results from the Python reference implementation and
 * the paper. Not part of the app; run with `npx tsx src/engine/__verify.ts`.
 */
import { computeAll, computeBarbell, type Params, type EventDef } from "../src/engine/index";

const UNIVERSE: EventDef[] = [
  { name: "Team A vs B", oddsA: 1.85, oddsB: 2.05, trueProbA: 0.53 },
  { name: "Team C vs D", oddsA: 1.55, oddsB: 2.55, trueProbA: 0.6 },
  { name: "Team E vs F", oddsA: 2.2, oddsB: 1.75, trueProbA: 0.44 },
  { name: "Team G vs H", oddsA: 1.4, oddsB: 3.1, trueProbA: 0.68 },
  { name: "Team I vs J", oddsA: 2.6, oddsB: 1.55, trueProbA: 0.37 },
  { name: "Team K vs L", oddsA: 1.95, oddsB: 1.95, trueProbA: 0.5 },
];

let failures = 0;
function check(name: string, actual: number, expected: number, tol = 1e-3) {
  const diff = Math.abs(actual - expected);
  const ok = diff <= tol;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}: actual=${actual.toFixed(6)} expected=${expected.toFixed(6)} diff=${diff.toExponential(2)}`);
}

const baseParams: Params = { universe: UNIVERSE, k: 3, alpha: 1.0, lambda: 2.0, tau: -0.076, capital: 10000 };
const snap = computeAll(baseParams);

// 1. Allocations sum to capital
const allocSum = snap.allocationAlpha.reduce((a, b) => a + b, 0);
check("allocation sums to capital", allocSum, 10000, 1e-6);

// 2. alpha=1 hedge: deterministic payout, matches S=1.09443, return=-0.08628 (Finding 1 / paper Sec 3.2)
check("alpha=1 hedge book load S", snap.alphaOneHedge.bookLoad, 1.0944284189065974, 1e-9);
check("alpha=1 hedge deterministic return", snap.alphaOneHedge.deterministicReturn, -0.08628103700097378, 1e-9);

// verify every combo pays the exact same amount at alpha=1
const alpha1 = computeAll({ ...baseParams, alpha: 1.0 });
const payouts = alpha1.combos.map((c, i) => alpha1.allocationAlpha[i] * c.odds);
const maxPayoutDiff = Math.max(...payouts) - Math.min(...payouts);
check("alpha=1 payouts identical across combos (max-min)", maxPayoutDiff, 0, 1e-6);

// 3. Mean-variance at lambda=100 converges to the same hedge return (paper Sec 4.1.3 cross-check)
const mvHighLambda = computeAll({ ...baseParams, lambda: 100 });
check("mean-variance lambda=100 expected return matches hedge", mvHighLambda.meanVariance.expectedNetReturn, -0.08628103700097378, 5e-3);
check("mean-variance lambda=100 variance -> 0", mvHighLambda.meanVariance.variance, 0, 5e-3);

// 4. Principal protection breakeven identity
const pp = snap.principalProtection;
check("principal protection breakeven", pp.favoriteStake * pp.favorite.odds, 10000, 1e-6);

// 5. Barbell ratio closed form vs scipy numeric result at lambda=1 (paper Table 7 row lambda=1.00 -> ratio 0.1372)
const barbell = computeBarbell(UNIVERSE, 2, 2, 10000, 3.0, 0.8, 1.0);
check("barbell ratio at lambda=1", barbell.ratioSafe, 0.137228, 1e-4);

// 6. Max entropy: beta=0 at the uniform-baseline tau (paper Table 8 -> tau=-0.0763, beta~0)
const g = snap.combos.map((c) => c.odds * c.trueProbability);
const uniformReturnRatio = g.reduce((a, b) => a + b, 0) / g.length;
const meUniform = computeAll({ ...baseParams, tau: uniformReturnRatio - 1 });
check("max entropy beta=0 at uniform-baseline tau", meUniform.maxEntropy!.beta, 0, 1e-2);

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
