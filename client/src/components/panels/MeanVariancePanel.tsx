import { useMemo } from "react";
import { meanVarianceWeights, type Snapshot } from "../../engine";
import { FormulaBlock } from "../FormulaBlock";
import { ExplanationCard } from "../ExplanationCard";
import { Heatmap } from "../charts/Heatmap";
import { AllocationTable } from "../AllocationTable";
import { LineChart } from "../charts/LineChart";

/**
 * MeanVariancePanel — Sec 4.1. Shows the optimal Frank-Wolfe weights, the
 * dense Sigma heatmap (only when k<=6, i.e. <=64 combinations — see
 * denseSigma's own comment), and a risk-return frontier traced by
 * sweeping lambda through the *same already-computed* combos so the
 * frontier curve costs a handful of extra Frank-Wolfe solves, not a
 * network round trip.
 */
export function MeanVariancePanel({
  snapshot,
  lambda,
  config,
}: {
  snapshot: Snapshot;
  lambda: number;
  config: Record<string, string>;
}) {
  const { combos, meanVariance, sigma } = snapshot;
  const stakes = meanVariance.weights.map((w) => w * (combos.length ? snapshotCapitalGuess(snapshot) : 0));

  const frontier = useMemo(() => {
    if (combos.length === 0 || combos.length > 4096) return []; // keep the sweep itself cheap; frontier is illustrative
    const lambdas = [0, 0.25, 0.5, 1, 2, 4, 6, 8, 10, 15, 20];
    return lambdas.map((l) => {
      const r = meanVarianceWeights(combos, l, 150);
      return { x: r.variance, y: r.expectedNetReturn, lambda: l };
    });
  }, [combos]);

  return (
    <div className="card">
      <h2>4.1 Mean-variance optimization</h2>
      <FormulaBlock
        tex={
          "\\max_{w \\in \\Delta} \\; \\mu^\\top w - \\lambda \\, w^\\top \\Sigma w, \\qquad \\mu_i = O_i p_i, \\;\\; \\Sigma_{ii} = O_i^2 p_i(1-p_i), \\;\\; \\Sigma_{ij} = -O_iO_jp_ip_j"
        }
      />
      <ExplanationCard config={config} configKey="meanVariance" />
      <ExplanationCard config={config} configKey="sigmaDense" title="Why Sigma is dense, not sparse" />

      {/* Stacked rather than side-by-side: the allocation table's combination
          labels are long and use white-space: nowrap (see theme.css), so a
          flex row would fight the heatmap's fixed-pixel SVG width for space
          and visually collide with it at most viewport widths. Full-width
          sections avoid that entirely. */}
      <p className="small" style={{ marginTop: 10 }}>
        &lambda; = {lambda.toFixed(2)} &middot; Expected net return = {(meanVariance.expectedNetReturn * 100).toFixed(3)}%{" "}
        &middot; Variance = {meanVariance.variance.toFixed(6)} &middot; Objective = {meanVariance.objectiveValue.toFixed(6)}
      </p>

      {sigma ? (
        <div style={{ overflowX: "auto", marginBottom: 16 }}>
          <h3>&Sigma; heatmap ({combos.length}&times;{combos.length})</h3>
          {/* Labeled C1..Cn rather than combo names: every combination in a
              given subset shares the first event's outcome for roughly half
              the rows, so a truncated-name prefix collapses to the same
              string for many combos (not a useful axis label) — see the
              AllocationTable below and the SVG <title> tooltip on each cell
              for the full combination detail. */}
          <Heatmap matrix={sigma} labels={combos.map((_, i) => `C${i + 1}`)} />
        </div>
      ) : (
        <p className="muted small">
          The &Sigma; heatmap only renders through k=6 (64&times;64) for legibility — reduce k to see it, or read the
          dense-Sigma explanation above, which holds at every k.
        </p>
      )}

      <h3>Optimal weights</h3>
      <AllocationTable combos={combos} stakes={stakes} />

      {frontier.length > 1 && (
        <>
          <h3 style={{ marginTop: 16 }}>Risk-return frontier (sweeping &lambda; at the current k)</h3>
          <LineChart
            series={[
              {
                label: "Efficient frontier",
                color: "var(--series-aqua)",
                points: frontier.map((f) => ({ x: f.x, y: f.y })),
              },
            ]}
            xLabel="Variance"
            yLabel="Expected net return"
          />
        </>
      )}
    </div>
  );
}

// The Snapshot type doesn't carry capital directly (it's a Params input,
// not an output) — meanVariance.weights already sums to 1, so stakes for
// display are weights * capital. We recover capital from the allocation
// snapshot's own alpha-allocation total, which was built from the same
// params.capital.
function snapshotCapitalGuess(snapshot: Snapshot): number {
  return snapshot.allocationAlpha.reduce((a, b) => a + b, 0);
}
