import type { Snapshot } from "../../engine";
import { FormulaBlock } from "../FormulaBlock";
import { ExplanationCard } from "../ExplanationCard";
import { AllocationTable } from "../AllocationTable";

/**
 * MaxEntropyPanel — Sec 4.4. tau is controlled by the global slider
 * (ParameterPanel), clamped to this subset's feasible range in
 * computeAll(); this panel just displays the closed-form Gibbs/Boltzmann
 * solution for the current tau.
 */
export function MaxEntropyPanel({ snapshot, config }: { snapshot: Snapshot; config: Record<string, string> }) {
  const { maxEntropy, combos, tauRange } = snapshot;

  return (
    <div className="card">
      <h2>4.4 Maximum entropy</h2>
      <FormulaBlock
        tex={"B(C) = P\\cdot\\frac{e^{\\beta g(C)}}{\\sum_{C'} e^{\\beta g(C')}}, \\qquad g(C) = O(C)p(C), \\qquad \\text{s.t. } \\textstyle\\sum_C B(C)g(C) = P(1+\\tau)"}
      />
      <ExplanationCard config={config} configKey="maxEntropy" />
      <p className="muted small">
        Feasible &tau; range for this subset: [{tauRange[0].toFixed(4)}, {tauRange[1].toFixed(4)}] — adjust &tau; in the
        Parameters panel above.
      </p>

      {maxEntropy ? (
        <>
          <p className="small">
            &beta; = {maxEntropy.beta.toFixed(4)} &middot; achieved return ratio ={" "}
            {maxEntropy.achievedReturnRatio.toFixed(4)} &middot; entropy = {maxEntropy.entropy.toFixed(4)} nats (max
            possible for {combos.length} outcomes: {Math.log(combos.length || 1).toFixed(4)} nats)
          </p>
          <AllocationTable combos={combos} stakes={maxEntropy.stakes} />
        </>
      ) : (
        <p className="muted small">
          The current &tau; is infeasible for this subset (see the range above) — the panel falls back gracefully
          rather than showing broken numbers.
        </p>
      )}
    </div>
  );
}
