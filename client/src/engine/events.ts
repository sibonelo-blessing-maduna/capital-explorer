/**
 * events.ts — client-side port of capital_framework/events.py.
 *
 * Runs entirely in the browser so dragging a slider recomputes everything
 * with zero network round-trip. See ARCHITECTURE.md "Why the math engine
 * is duplicated in TypeScript" for why this isn't just calling a Python
 * backend, and MATH.md Section 2 for the derivations this mirrors.
 */

export interface EventDef {
  name: string;
  /** Decimal odds for outcome 1 (e.g. 1.85 means a winning R1 stake returns R1.85 total). */
  oddsA: number;
  /** Decimal odds for outcome 2. */
  oddsB: number;
  /**
   * Optional "true" probability of outcome 1 from an external model.
   * Defaults to the market-implied probability (1/oddsA) when omitted,
   * i.e. assumes the market is efficient / carries no exploitable edge.
   */
  trueProbA?: number;
}

export type Outcome = 1 | 2;

export function oddsFor(e: EventDef, outcome: Outcome): number {
  return outcome === 1 ? e.oddsA : e.oddsB;
}

export function impliedProb(e: EventDef, outcome: Outcome): number {
  return 1 / oddsFor(e, outcome);
}

export function trueProb(e: EventDef, outcome: Outcome): number {
  const p1 = e.trueProbA ?? impliedProb(e, 1);
  return outcome === 1 ? p1 : 1 - p1;
}

export interface Pick {
  event: EventDef;
  outcome: Outcome;
}

export interface Combination {
  picks: Pick[];
  /** Precomputed eagerly — every numeric downstream function reads these rather than recomputing. */
  odds: number;
  impliedProbability: number;
  trueProbability: number;
}

function buildCombination(picks: Pick[]): Combination {
  let odds = 1;
  let p = 1;
  for (const { event, outcome } of picks) {
    odds *= oddsFor(event, outcome);
    p *= trueProb(event, outcome);
  }
  return { picks, odds, impliedProbability: 1 / odds, trueProbability: p };
}

/**
 * Human-readable label, computed on demand rather than stored on every
 * Combination. At k=14 (16,384 combinations) building all labels eagerly
 * during generateCombinations was measured as the single largest cost in
 * the whole engine (~75-100ms — more than every numerical objective
 * combined; see ARCHITECTURE.md "Performance envelope"), and the UI never
 * renders anywhere near 16,384 table rows at once anyway. Call this only
 * for the rows actually being displayed.
 */
export function comboLabel(combo: Combination): string {
  return combo.picks.map(({ event, outcome }) => `${event.name}:${outcome}`).join(" & ");
}

/**
 * All 2^k prediction combinations for a size-k subset (Sec 2.2's Boolean
 * hypercube). Iterates a k-bit counter rather than recursing, which keeps
 * this allocation-light for the sizes the UI allows (k <= ~14).
 */
export function generateCombinations(subset: EventDef[]): Combination[] {
  const k = subset.length;
  if (k === 0) return [];
  const total = 1 << k; // 2^k — caller is responsible for keeping k small enough (see combinatorics.ts limits)
  const combos: Combination[] = new Array(total);
  for (let mask = 0; mask < total; mask++) {
    const picks: Pick[] = new Array(k);
    for (let bit = 0; bit < k; bit++) {
      const outcome: Outcome = (mask >> bit) & 1 ? 2 : 1;
      picks[bit] = { event: subset[bit], outcome };
    }
    combos[mask] = buildCombination(picks);
  }
  return combos;
}

/** Sum of implied probabilities across all combinations of a subset — the "book load" S used by the alpha=1 hedge proof (MATH.md Proposition 1). */
export function aggregateImpliedProbability(combos: Combination[]): number {
  return combos.reduce((s, c) => s + c.impliedProbability, 0);
}
