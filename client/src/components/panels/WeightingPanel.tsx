import type { Snapshot } from "../../engine";
import { FormulaBlock } from "../FormulaBlock";
import { AllocationTable } from "../AllocationTable";
import { ExplanationCard } from "../ExplanationCard";
import { BarChart } from "../charts/BarChart";

/**
 * WeightingPanel — Sec 3: the base weighting function B(C), plus the
 * alpha=1 guaranteed-hedge callout (Sec 3.1 / MATH.md Proposition 1) and
 * the combinatorial growth chart motivating why k is capped.
 */
export function WeightingPanel({ snapshot, config }: { snapshot: Snapshot; config: Record<string, string> }) {
  const { combos, allocationAlpha, alphaOneHedge, combinatorialGrowth } = snapshot;

  return (
    <div className="card">
      <h2>3. Weighting &amp; allocation B(C)</h2>
      <FormulaBlock tex={"W(C) = \\left(\\frac{1}{O(C)}\\right)^{\\alpha}, \\qquad B(C) = P \\cdot \\frac{W(C)}{\\sum_{C'} W(C')}"} />
      <ExplanationCard config={config} configKey="weightingFunction" />

      <div className="finding-box">
        <strong style={{ display: "block", marginBottom: 4 }}>The &alpha;=1 guaranteed hedge</strong>
        <span className="small">
          Book load S = &Sigma; implied probabilities = {alphaOneHedge.bookLoad.toFixed(4)}. At &alpha;=1 every
          combination pays back the same amount if it wins: P/S = {alphaOneHedge.deterministicPayout.toFixed(2)},
          a deterministic return of {(alphaOneHedge.deterministicReturn * 100).toFixed(2)}%
          {alphaOneHedge.deterministicReturn < 0 ? " (a small guaranteed loss — the vig, S>1)." : " (a guaranteed arbitrage — S<1)."}
        </span>
      </div>
      <ExplanationCard config={config} configKey="alphaOneHedge" title="Why alpha=1 is special" />

      <h3>Allocation across all {combos.length.toLocaleString()} combinations</h3>
      <AllocationTable combos={combos} stakes={allocationAlpha} />

      <h3 style={{ marginTop: 20 }}>Combinatorial growth (why k is capped)</h3>
      <ExplanationCard config={config} configKey="combinatorialSpace" title="Why 2^k grows so fast" />
      <BarChart
        values={combinatorialGrowth.map((r) => r.combinations)}
        labels={combinatorialGrowth.map((r) => `k=${r.k}`)}
        yLabel="2^k combinations"
        color="var(--series-violet)"
      />
    </div>
  );
}
