import { useMemo } from "react";
import { comboLabel, principalProtectionEvCurve, type Params, type Snapshot } from "../../engine";
import { FormulaBlock } from "../FormulaBlock";
import { ExplanationCard } from "../ExplanationCard";
import { AllocationTable } from "../AllocationTable";
import { LineChart } from "../charts/LineChart";

/**
 * PrincipalProtectionPanel — Sec 4.2. Stakes P/O(favorite) on the single
 * most probable combination, then allocates the remainder by the same
 * W(C) weighting. The EV-vs-alpha curve and its golden-section optimum
 * (optimizeAlphaForPrincipalProtection, computed once per Snapshot) let the
 * user jump straight to the alpha that maximizes the remainder's expected
 * profit, rather than hunting for it by hand with the global alpha slider.
 */
export function PrincipalProtectionPanel({
  snapshot,
  params,
  setParams,
  config,
}: {
  snapshot: Snapshot;
  params: Params;
  setParams: (fn: (p: Params) => Params) => void;
  config: Record<string, string>;
}) {
  const { principalProtection: pp, principalProtectionOptimum: opt, combos } = snapshot;

  const curve = useMemo(() => {
    if (combos.length === 0 || combos.length > 4096) return [];
    return principalProtectionEvCurve(combos, params.capital, 20, 50);
  }, [combos, params.capital]);

  return (
    <div className="card">
      <h2>4.2 Principal protection</h2>
      <FormulaBlock tex={"\\text{stake on } C_{\\text{favorite}} = \\frac{P}{O(C_{\\text{favorite}})}, \\qquad \\text{remainder allocated by } B(C)"} />
      <ExplanationCard config={config} configKey="principalProtection" />

      <p className="small">
        Favorite: <strong>{comboLabel(pp.favorite)}</strong> (odds {pp.favorite.odds.toFixed(3)}) &mdash; stake{" "}
        {pp.favoriteStake.toLocaleString(undefined, { maximumFractionDigits: 2 })} to guarantee P back if it hits.
        Remaining capital {pp.remainingCapital.toLocaleString(undefined, { maximumFractionDigits: 2 })} spread across
        the other {pp.remainingCombos.length} combinations at &alpha;={pp.alphaUsed.toFixed(2)}.
      </p>

      {curve.length > 1 && (
        <>
          <LineChart
            series={[{ label: "Remainder EV", color: "var(--series-orange)", points: curve.map((c) => ({ x: c.alpha, y: c.ev })) }]}
            xLabel="alpha (remainder weighting exponent)"
            yLabel="Expected profit on remainder"
            markerX={opt.alphaStar}
          />
          <p className="small">
            Optimal &alpha;<sup>*</sup> = <span className="slider-value">{opt.alphaStar.toFixed(3)}</span> (found by
            golden-section search — see the dashed marker above).{" "}
            <button className="btn secondary small" onClick={() => setParams((p) => ({ ...p, alpha: opt.alphaStar }))}>
              Use &alpha;<sup>*</sup> globally
            </button>
          </p>
        </>
      )}

      <h3 style={{ marginTop: 16 }}>Remainder allocation</h3>
      <AllocationTable combos={pp.remainingCombos} stakes={pp.remainingStakes} />
    </div>
  );
}
