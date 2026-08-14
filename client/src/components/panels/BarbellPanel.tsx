import { useMemo, useState } from "react";
import { computeBarbell, limits, type Params } from "../../engine";
import { FormulaBlock } from "../FormulaBlock";
import { ExplanationCard } from "../ExplanationCard";
import { BarChart } from "../charts/BarChart";

/**
 * BarbellPanel — Sec 4.3. Deliberately has its own k1/k2/alpha controls
 * separate from the global parameter panel, because the barbell strategy's
 * whole point is modeling two *different* subset sizes at once (a small
 * "safe" pool, a larger "risk" pool) rather than reusing the single global
 * k. lambda is shared with the global slider since it represents the same
 * "how risk-averse are you" dial as the mean-variance panel.
 */
export function BarbellPanel({
  params,
  config,
  maxK: maxKFullDetail = limits.MAX_K_FULL_DETAIL,
}: {
  params: Params;
  config: Record<string, string>;
  /** Smaller of the engine's own ceiling and the admin-editable `limits.maxKFullDetail` site-config key (see App.tsx). */
  maxK?: number;
}) {
  const maxK = Math.min(params.universe.length, maxKFullDetail);
  const [k1, setK1] = useState(Math.min(2, maxK));
  const [k2Start, setK2Start] = useState(Math.min(2, maxK));
  const [alphaSafe, setAlphaSafe] = useState(1.5);
  const [alphaRisk, setAlphaRisk] = useState(0.7);

  const result = useMemo(() => {
    try {
      return computeBarbell(params.universe, k1, k2Start, params.capital, alphaSafe, alphaRisk, params.lambda);
    } catch {
      return null;
    }
  }, [params.universe, k1, k2Start, params.capital, alphaSafe, alphaRisk, params.lambda]);

  return (
    <div className="card">
      <h2>4.3 Barbell strategy</h2>
      <FormulaBlock
        tex={"\\max_{r \\in [0,1]} \\; rA + (1-r)B - \\lambda\\big(r^2 V_s + (1-r)^2 V_r\\big)"}
      />
      <ExplanationCard config={config} configKey="barbell" />

      <div className="row">
        <div className="col slider-row">
          <label>
            Safe pool size k<sub>1</sub> (events 1..k1) <span className="slider-value">{k1}</span>
          </label>
          <input type="range" min={1} max={Math.max(1, maxK)} value={k1} onChange={(e) => setK1(Number(e.target.value))} />
        </div>
        <div className="col slider-row">
          <label>
            Risk pool start k<sub>2</sub> (events k2..n) <span className="slider-value">{k2Start}</span>
          </label>
          <input
            type="range"
            min={0}
            max={Math.max(0, params.universe.length - 1)}
            value={k2Start}
            onChange={(e) => setK2Start(Number(e.target.value))}
          />
        </div>
      </div>
      <div className="row">
        <div className="col slider-row">
          <label>
            Safe pool &alpha; <span className="slider-value">{alphaSafe.toFixed(2)}</span>
          </label>
          <input type="range" min={0} max={5} step={0.05} value={alphaSafe} onChange={(e) => setAlphaSafe(Number(e.target.value))} />
        </div>
        <div className="col slider-row">
          <label>
            Risk pool &alpha; <span className="slider-value">{alphaRisk.toFixed(2)}</span>
          </label>
          <input type="range" min={0} max={5} step={0.05} value={alphaRisk} onChange={(e) => setAlphaRisk(Number(e.target.value))} />
        </div>
      </div>

      {result ? (
        <>
          <p className="small">
            Optimal safe ratio r<sup>*</sup> = <span className="slider-value">{result.ratioSafe.toFixed(3)}</span> &rarr; safe pool{" "}
            {result.capitalSafe.toLocaleString(undefined, { maximumFractionDigits: 2 })}, risk pool{" "}
            {result.capitalRisk.toLocaleString(undefined, { maximumFractionDigits: 2 })}. Portfolio expected return{" "}
            {(result.portfolioExpectedReturn * 100).toFixed(3)}%, variance {result.portfolioVariance.toFixed(6)}.
          </p>
          <BarChart
            values={[result.capitalSafe, result.capitalRisk]}
            labels={["Safe pool", "Risk pool"]}
            yLabel="Capital"
            color="var(--series-green)"
          />
        </>
      ) : (
        <p className="muted small">Pick a valid k1/k2 combination (each pool needs at least one event).</p>
      )}
    </div>
  );
}
